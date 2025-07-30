// Professional Visual Editor for Photography Storefronts
class VisualEditor {
    constructor() {
        this.currentUser = null;
        this.currentTheme = 'light-airy';
        this.currentPage = 'home';
        this.siteData = {};
        this.isEditing = false;
        this.activeElement = null;
        this.themes = [
            'light-airy', 'bold-editorial', 'earthy-boho', 'modern-luxe', 
            'coastal-lifestyle', 'minimal-portfolio', 'monochrome-studio', 
            'dark-moody-wedding', 'romantic-serif', 'fashion-forward',
            'commercial-grid', 'film-vibe', 'urban-black-gold', 'cottagecore-vibes',
            'rustic-barn', 'luxury-fine-art', 'street-photography', 'scenic-landscapes',
            'scrolling-story', 'storybook-magazine'
        ];
        this.pages = ['home', 'about', 'gallery', 'store', 'contact'];
        
        this.init();
    }
    
    async init() {
        await this.initFirebase();
        await this.authenticateUser();
        this.setupClickToEdit();
        this.setupThemeSelector();
        this.setupPageNavigation();
        this.loadUserSite();
        this.renderPreview();
    }
    
    async initFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM",
            authDomain: "photoshcheduleapp.firebaseapp.com",
            projectId: "photoshcheduleapp",
            storageBucket: "photoshcheduleapp.appspot.com",
            messagingSenderId: "1080892259604",
            appId: "1:1080892259604:web:your-app-id"
        };
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        this.db = firebase.firestore();
        this.storage = firebase.storage();
        this.auth = firebase.auth();
    }
    
    async authenticateUser() {
        return new Promise((resolve) => {
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    this.currentUser = user;
                    console.log('User authenticated:', user.email);
                } else {
                    this.currentUser = { uid: 'dev-user', email: 'dev@example.com' };
                    console.log('Development mode - using test user');
                }
                resolve();
            });
        });
    }
    
    setupClickToEdit() {
        document.addEventListener('click', (e) => {
            const previewFrame = document.getElementById('preview-frame');
            if (!previewFrame || !previewFrame.contains(e.target)) return;
            
            const editableElement = e.target.closest('[data-editable]');
            if (editableElement) {
                e.preventDefault();
                this.startEditingElement(editableElement);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isEditing) {
                this.stopEditing();
            }
        });
    }
    
    startEditingElement(element) {
        if (this.isEditing && this.activeElement) {
            this.stopEditing();
        }
        
        this.isEditing = true;
        this.activeElement = element;
        element.classList.add('editing');
        
        const elementType = element.dataset.editable;
        
        if (elementType === 'text') {
            this.editText(element);
        } else if (elementType === 'image') {
            this.editImage(element);
        }
    }
    
    editText(element) {
        const originalContent = element.innerHTML;
        element.contentEditable = true;
        element.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        const saveChanges = () => {
            element.contentEditable = false;
            element.classList.remove('editing');
            this.saveElementContent(element);
            this.isEditing = false;
            this.activeElement = null;
        };
        
        element.addEventListener('blur', saveChanges, { once: true });
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                element.blur();
            }
        });
    }
    
    editImage(element) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.uploadAndReplaceImage(element, file);
            }
            this.stopEditing();
        });
        
        input.click();
    }
    
    async uploadAndReplaceImage(element, file) {
        try {
            // Show loading state
            element.style.opacity = '0.5';
            
            // Upload to Firebase Storage
            const storageRef = this.storage.ref();
            const imageRef = storageRef.child(`users/${this.currentUser.uid}/storefront/images/${Date.now()}_${file.name}`);
            
            const snapshot = await imageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Update image src
            element.src = downloadURL;
            element.style.opacity = '1';
            
            // Save to Firestore
            await this.saveElementContent(element, downloadURL);
            
            this.showNotification('Image updated successfully!', 'success');
        } catch (error) {
            console.error('Error uploading image:', error);
            element.style.opacity = '1';
            this.showNotification('Failed to upload image', 'error');
        }
    }
    
    async saveElementContent(element, customValue = null) {
        const elementId = element.dataset.elementId;
        const content = customValue || element.innerHTML;
        
        if (!elementId) return;
        
        try {
            await this.db.collection('users').doc(this.currentUser.uid)
                .collection('storefront').doc('content')
                .set({
                    [this.currentPage]: {
                        ...this.siteData[this.currentPage],
                        [elementId]: content
                    }
                }, { merge: true });
                
            // Update local data
            if (!this.siteData[this.currentPage]) {
                this.siteData[this.currentPage] = {};
            }
            this.siteData[this.currentPage][elementId] = content;
            
        } catch (error) {
            console.error('Error saving content:', error);
            this.showNotification('Failed to save changes', 'error');
        }
    }
    
    stopEditing() {
        if (this.activeElement) {
            this.activeElement.contentEditable = false;
            this.activeElement.classList.remove('editing');
        }
        this.isEditing = false;
        this.activeElement = null;
    }
    
    setupThemeSelector() {
        const themeGrid = document.getElementById('theme-grid');
        if (!themeGrid) return;
        
        themeGrid.innerHTML = this.themes.map(theme => `
            <div class="theme-card" data-theme="${theme}" onclick="editor.selectTheme('${theme}')">
                <div class="theme-preview">
                    <img src="/storefront-templates/${theme}/preview.jpg" alt="${this.formatThemeName(theme)}" 
                         onerror="this.src='/storefront-templates/default-preview.jpg'">
                </div>
                <div class="theme-info">
                    <h3>${this.formatThemeName(theme)}</h3>
                    <p>${this.getThemeDescription(theme)}</p>
                </div>
            </div>
        `).join('');
    }
    
    setupPageNavigation() {
        const pageNav = document.getElementById('page-navigation');
        if (!pageNav) return;
        
        pageNav.innerHTML = this.pages.map(page => `
            <button class="page-nav-btn ${page === this.currentPage ? 'active' : ''}" 
                    data-page="${page}" onclick="editor.switchPage('${page}')">
                ${this.formatPageName(page)}
            </button>
        `).join('');
    }
    
    async selectTheme(theme) {
        this.currentTheme = theme;
        
        // Update theme selection UI
        document.querySelectorAll('.theme-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
        
        // Save theme selection
        try {
            await this.db.collection('users').doc(this.currentUser.uid)
                .collection('storefront').doc('settings')
                .set({ theme }, { merge: true });
        } catch (error) {
            console.error('Error saving theme:', error);
        }
        
        this.renderPreview();
        this.showNotification(`Theme changed to ${this.formatThemeName(theme)}`, 'success');
    }
    
    switchPage(page) {
        this.currentPage = page;
        
        // Update page navigation
        document.querySelectorAll('.page-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        this.renderPreview();
    }
    
    async renderPreview() {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        try {
            const response = await fetch(`/storefront-templates/${this.currentTheme}/${this.currentPage}.html`);
            let html = await response.text();
            
            // Replace placeholder content with user data
            html = this.injectUserContent(html);
            
            // Add editing attributes
            html = this.addEditingAttributes(html);
            
            previewFrame.innerHTML = html;
            
            // Apply theme-specific styles
            this.applyThemeStyles();
            
        } catch (error) {
            console.error('Error loading template:', error);
            previewFrame.innerHTML = '<div class="error">Template not found</div>';
        }
    }
    
    injectUserContent(html) {
        const pageData = this.siteData[this.currentPage] || {};
        
        // Replace content placeholders with saved data
        Object.keys(pageData).forEach(key => {
            const placeholder = `{{${key}}}`;
            html = html.replace(new RegExp(placeholder, 'g'), pageData[key]);
        });
        
        return html;
    }
    
    addEditingAttributes(html) {
        // Add data-editable attributes to text elements
        html = html.replace(/<h1([^>]*)>/g, '<h1$1 data-editable="text" data-element-id="title">');
        html = html.replace(/<h2([^>]*)>/g, '<h2$1 data-editable="text" data-element-id="subtitle">');
        html = html.replace(/<p([^>]*)>/g, '<p$1 data-editable="text" data-element-id="paragraph">');
        
        // Add data-editable attributes to images
        html = html.replace(/<img([^>]*?)>/g, '<img$1 data-editable="image" data-element-id="image">');
        
        return html;
    }
    
    applyThemeStyles() {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        // Add editing styles
        const style = document.createElement('style');
        style.textContent = `
            [data-editable] {
                position: relative;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            [data-editable]:hover {
                outline: 2px dashed #007bff;
                outline-offset: 2px;
            }
            
            [data-editable].editing {
                outline: 2px solid #007bff;
                outline-offset: 2px;
                background: rgba(0, 123, 255, 0.1);
            }
            
            [data-editable="text"]:focus {
                outline: 2px solid #007bff;
                background: rgba(0, 123, 255, 0.1);
            }
        `;
        
        previewFrame.appendChild(style);
    }
    
    async loadUserSite() {
        try {
            const doc = await this.db.collection('users').doc(this.currentUser.uid)
                .collection('storefront').doc('content').get();
                
            if (doc.exists) {
                this.siteData = doc.data();
            }
            
            const settingsDoc = await this.db.collection('users').doc(this.currentUser.uid)
                .collection('storefront').doc('settings').get();
                
            if (settingsDoc.exists) {
                const settings = settingsDoc.data();
                if (settings.theme) {
                    this.currentTheme = settings.theme;
                }
            }
        } catch (error) {
            console.error('Error loading user site:', error);
        }
    }
    
    formatThemeName(theme) {
        return theme.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    formatPageName(page) {
        return page.charAt(0).toUpperCase() + page.slice(1);
    }
    
    getThemeDescription(theme) {
        const descriptions = {
            'light-airy': 'Soft, elegant design with warm tones and natural lighting',
            'bold-editorial': 'Strong typography and dramatic layouts for impactful storytelling',
            'earthy-boho': 'Natural textures and earthy colors with bohemian flair',
            'modern-luxe': 'Sleek minimalism with luxury accents and premium feel',
            'coastal-lifestyle': 'Fresh, breezy design inspired by ocean and coastal living',
            'minimal-portfolio': 'Clean, uncluttered layouts focusing on your work',
            'monochrome-studio': 'Classic black and white with timeless elegance',
            'dark-moody-wedding': 'Romantic and dramatic with deep, rich tones',
            'romantic-serif': 'Elegant typography with soft, romantic styling',
            'fashion-forward': 'Cutting-edge design with bold visual statements',
            'commercial-grid': 'Professional grid layouts perfect for commercial work',
            'film-vibe': 'Vintage-inspired with grainy textures and retro aesthetics',
            'urban-black-gold': 'Modern city vibes with sophisticated black and gold',
            'cottagecore-vibes': 'Cozy, countryside charm with warm, inviting elements',
            'rustic-barn': 'Warm wood tones and country-inspired design elements',
            'luxury-fine-art': 'Museum-quality presentation with refined elegance',
            'street-photography': 'Urban energy with dynamic layouts and bold contrasts',
            'scenic-landscapes': 'Horizontal showcases perfect for landscape photography',
            'scrolling-story': 'Full-page sections that tell your story as users scroll',
            'storybook-magazine': 'Editorial layouts with magazine-style storytelling'
        };
        
        return descriptions[theme] || 'Beautiful photography website template';
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    async publishSite() {
        try {
            const response = await fetch('/api/storefront/publish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.currentUser.uid,
                    theme: this.currentTheme,
                    content: this.siteData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Site published successfully!', 'success');
                window.open(result.url, '_blank');
            } else {
                this.showNotification('Failed to publish site', 'error');
            }
        } catch (error) {
            console.error('Error publishing site:', error);
            this.showNotification('Failed to publish site', 'error');
        }
    }
}

// Initialize the visual editor when the page loads
let editor;
document.addEventListener('DOMContentLoaded', () => {
    editor = new VisualEditor();
});
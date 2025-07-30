// Advanced Visual Website Editor with Inline Editing, Theme Switching, and Block-Based Layouts
class AdvancedVisualEditor {
    constructor() {
        this.themes = {
            'light-airy': 'Light + Airy Creative Studio',
            'bold-editorial': 'Bold Editorial',
            'earthy-boho': 'Earthy Boho',
            'modern-luxe': 'Modern Luxe',
            'coastal-lifestyle': 'Coastal Lifestyle',
            'minimal-portfolio': 'Minimal Portfolio',
            'monochrome-studio': 'Monochrome Studio',
            'dark-moody-wedding': 'Dark Moody Wedding',
            'romantic-serif': 'Romantic Serif',
            'fashion-forward': 'Fashion Forward',
            'commercial-grid': 'Commercial Grid',
            'film-vibe': 'Film Vibe',
            'urban-black-gold': 'Urban Black Gold',
            'cottagecore-vibes': 'Cottagecore Vibes',
            'rustic-barn': 'Rustic Barn',
            'luxury-fine-art': 'Luxury Fine Art',
            'street-photography': 'Street Photography',
            'scenic-landscapes': 'Scenic Landscapes',
            'scrolling-story': 'Scrolling Story',
            'storybook-magazine': 'Storybook Magazine'
        };
        
        this.currentTheme = 'light-airy';
        this.currentPage = 'home';
        this.userId = 'dev-user-123'; // Get from Firebase Auth in production
        this.isEditing = false;
        this.autoSaveTimeout = null;
        this.firebaseInitialized = false;
        
        // Available pages
        this.pages = [
            { id: 'home', name: 'Home', icon: '🏠' },
            { id: 'about', name: 'About', icon: '👤' },
            { id: 'gallery', name: 'Portfolio', icon: '📸' },
            { id: 'contact', name: 'Contact', icon: '📧' }
        ];
        
        // Block types available for adding
        this.blockTypes = {
            'hero': { name: 'Hero Section', icon: '🎯' },
            'text': { name: 'Text Block', icon: '📝' },
            'image': { name: 'Image Block', icon: '🖼️' },
            'gallery': { name: 'Photo Gallery', icon: '📸' },
            'contact': { name: 'Contact Form', icon: '📧' },
            'testimonial': { name: 'Testimonial', icon: '💬' },
            'services': { name: 'Services List', icon: '⭐' },
            'about': { name: 'About Section', icon: '👤' }
        };
        
        // Current page blocks structure
        this.pageBlocks = {
            home: [],
            about: [],
            gallery: [],
            contact: []
        };
        
        // Content storage for all blocks
        this.contentData = {};
        
        this.init();
    }

    async init() {
        console.log('Initializing Advanced Visual Editor...');
        
        // Initialize Firebase if available
        await this.initializeFirebase();
        
        // Load saved content and layout
        await this.loadUserContent();
        
        // Setup UI components
        this.setupUI();
        
        // Load initial theme and page
        await this.loadTheme(this.currentTheme);
        
        console.log('Advanced Visual Editor initialized successfully');
    }

    async initializeFirebase() {
        try {
            if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.firebaseInitialized = true;
                console.log('Firebase initialized for visual editor');
            }
        } catch (error) {
            console.log('Firebase not available, using local storage fallback');
            this.firebaseInitialized = false;
        }
    }

    setupUI() {
        this.setupPageNavigation();
        this.setupThemeGrid();
        this.setupDeviceControls();
        this.setupBlockSidebar();
        this.setupAutoSave();
    }

    setupPageNavigation() {
        const pageNav = document.getElementById('page-navigation');
        if (!pageNav) return;

        pageNav.innerHTML = '';
        this.pages.forEach(page => {
            const pageItem = document.createElement('div');
            pageItem.className = `page-nav-item ${page.id === this.currentPage ? 'active' : ''}`;
            pageItem.dataset.page = page.id;
            pageItem.innerHTML = `
                <span class="page-icon">${page.icon}</span>
                <span>${page.name}</span>
            `;
            pageItem.addEventListener('click', () => this.selectPage(page.id));
            pageNav.appendChild(pageItem);
        });
    }

    setupThemeGrid() {
        const themeGrid = document.getElementById('theme-grid');
        if (!themeGrid) return;

        themeGrid.innerHTML = '';
        
        Object.entries(this.themes).forEach(([key, name]) => {
            const themeOption = document.createElement('div');
            themeOption.className = `theme-option ${key === this.currentTheme ? 'active' : ''}`;
            themeOption.dataset.theme = key;
            themeOption.innerHTML = `
                <div class="theme-preview" style="background: linear-gradient(135deg, #f7f3f0, #e8ddd4)"></div>
                <div class="theme-name">${name}</div>
            `;
            themeOption.addEventListener('click', () => this.selectTheme(key));
            themeGrid.appendChild(themeOption);
        });
    }

    setupDeviceControls() {
        const deviceButtons = document.querySelectorAll('.device-btn');
        deviceButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                deviceButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setDeviceView(btn.dataset.device);
            });
        });
    }

    setupBlockSidebar() {
        // Create block management sidebar
        this.createBlockSidebar();
    }

    createBlockSidebar() {
        // Check if we need to add block management to existing sidebar
        const sidebar = document.querySelector('.editor-sidebar');
        if (!sidebar) return;

        // Check if block section already exists
        if (sidebar.querySelector('.block-section')) return;

        const blockSection = document.createElement('div');
        blockSection.className = 'block-section';
        blockSection.innerHTML = `
            <h3>🧱 Blocks</h3>
            <div class="block-actions">
                <button class="btn btn-primary" onclick="window.editor && window.editor.showAddBlockModal()">
                    ➕ Add Block
                </button>
            </div>
            <div id="current-blocks" class="current-blocks">
                <!-- Current page blocks will be listed here -->
            </div>
        `;
        
        sidebar.appendChild(blockSection);
    }

    async selectPage(pageId) {
        // Update active state
        document.querySelectorAll('.page-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const pageElement = document.querySelector(`[data-page="${pageId}"]`);
        if (pageElement) {
            pageElement.classList.add('active');
        }
        
        this.currentPage = pageId;
        await this.loadPageContent(pageId);
        this.showSuccess(`Switched to ${pageId} page`);
    }

    async selectTheme(themeKey) {
        // Update active theme
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        
        const selectedTheme = document.querySelector(`[data-theme="${themeKey}"]`);
        if (selectedTheme) {
            selectedTheme.classList.add('active');
        }
        
        this.currentTheme = themeKey;
        await this.loadTheme(themeKey);
        await this.saveUserSettings();
        this.showSuccess(`Applied ${this.themes[themeKey]} theme`);
    }

    async loadTheme(themeKey) {
        try {
            const response = await fetch(`/storefront-templates/${themeKey}/home.html`);
            if (!response.ok) throw new Error('Theme not found');
            
            let html = await response.text();
            
            // Replace template variables with current content
            html = this.replaceTemplateVariables(html);
            
            // Add hamburger menu to template
            html = this.addHamburgerMenu(html);
            
            // Make all content inline editable
            html = this.makeContentEditable(html);
            
            // Load into preview frame
            const previewFrame = document.getElementById('preview-frame');
            if (previewFrame) {
                previewFrame.innerHTML = html;
                this.setupInlineEditing(previewFrame);
            }
            
        } catch (error) {
            console.error('Failed to load theme:', error);
            this.showError('Failed to load theme');
        }
    }

    async loadPageContent(pageId) {
        // Load specific page content
        try {
            let response = await fetch(`/storefront-templates/${this.currentTheme}/${pageId}.html`);
            let html;
            
            if (response.ok) {
                html = await response.text();
            } else {
                // Try alternative page names
                const alternatives = {
                    'gallery': 'portfolio',
                    'portfolio': 'gallery'
                };
                
                if (alternatives[pageId]) {
                    response = await fetch(`/storefront-templates/${this.currentTheme}/${alternatives[pageId]}.html`);
                    if (response.ok) {
                        html = await response.text();
                    }
                }
                
                // Final fallback to home page
                if (!html) {
                    const homeResponse = await fetch(`/storefront-templates/${this.currentTheme}/home.html`);
                    html = await homeResponse.text();
                    console.log(`Using home template as fallback for ${pageId}`);
                }
            }
            
            // Process the HTML
            html = this.replaceTemplateVariables(html);
            html = this.addHamburgerMenu(html);
            html = this.makeContentEditable(html);
            
            // Load into preview
            const previewFrame = document.getElementById('preview-frame');
            if (previewFrame) {
                previewFrame.innerHTML = html;
                this.setupInlineEditing(previewFrame);
            }
            
        } catch (error) {
            console.error('Failed to load page content:', error);
            this.showError(`Failed to load ${pageId} page`);
        }
    }

    makeContentEditable(html) {
        // Make text elements editable
        html = html.replace(/<h1([^>]*)>/g, '<h1$1 contenteditable="true" data-editable="text">');
        html = html.replace(/<h2([^>]*)>/g, '<h2$1 contenteditable="true" data-editable="text">');
        html = html.replace(/<h3([^>]*)>/g, '<h3$1 contenteditable="true" data-editable="text">');
        html = html.replace(/<p([^>]*)>/g, '<p$1 contenteditable="true" data-editable="text">');
        
        // Make images editable
        html = html.replace(/<img([^>]+)>/g, (match, attrs) => {
            return `<div class="editable-image-wrapper" data-editable="image">
                        <img${attrs}>
                        <div class="image-edit-overlay">
                            <button class="image-edit-btn">📷 Change Image</button>
                        </div>
                    </div>`;
        });
        
        return html;
    }

    setupInlineEditing(container) {
        // Setup text editing
        const editableTexts = container.querySelectorAll('[data-editable="text"]');
        editableTexts.forEach(element => {
            this.setupTextEditing(element);
        });
        
        // Setup image editing
        const editableImages = container.querySelectorAll('[data-editable="image"]');
        editableImages.forEach(wrapper => {
            this.setupImageEditing(wrapper);
        });
    }

    setupTextEditing(element) {
        let originalContent = '';
        
        element.addEventListener('focus', () => {
            originalContent = element.innerHTML;
            this.isEditing = true;
            element.classList.add('editing');
        });
        
        element.addEventListener('blur', () => {
            this.isEditing = false;
            element.classList.remove('editing');
            
            if (element.innerHTML !== originalContent) {
                this.saveContentChange(element, 'text', element.innerHTML);
            }
        });
        
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                element.blur();
            }
        });
        
        // Add hover effects
        element.addEventListener('mouseenter', () => {
            if (!this.isEditing) {
                element.style.outline = '2px dashed var(--muted-gold)';
                element.style.outlineOffset = '4px';
            }
        });
        
        element.addEventListener('mouseleave', () => {
            if (!this.isEditing) {
                element.style.outline = 'none';
            }
        });
    }

    setupImageEditing(wrapper) {
        const img = wrapper.querySelector('img');
        const editBtn = wrapper.querySelector('.image-edit-btn');
        
        if (!img || !editBtn) return;
        
        editBtn.addEventListener('click', () => {
            this.openImagePicker(img);
        });
        
        // Add hover effects
        wrapper.addEventListener('mouseenter', () => {
            wrapper.querySelector('.image-edit-overlay').style.opacity = '1';
        });
        
        wrapper.addEventListener('mouseleave', () => {
            wrapper.querySelector('.image-edit-overlay').style.opacity = '0';
        });
    }

    openImagePicker(imgElement) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.uploadAndReplaceImage(imgElement, file);
            }
        });
        
        input.click();
    }

    async uploadAndReplaceImage(imgElement, file) {
        try {
            this.showLoading('Uploading image...');
            
            if (this.firebaseInitialized) {
                // Upload to Firebase Storage
                const storageRef = firebase.storage().ref();
                const imageRef = storageRef.child(`storefront-images/${this.userId}/${Date.now()}_${file.name}`);
                
                const snapshot = await imageRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                
                imgElement.src = downloadURL;
                this.saveContentChange(imgElement, 'image', downloadURL);
            } else {
                // Fallback to local file reading
                const reader = new FileReader();
                reader.onload = (e) => {
                    imgElement.src = e.target.result;
                    this.saveContentChange(imgElement, 'image', e.target.result);
                };
                reader.readAsDataURL(file);
            }
            
            this.showSuccess('Image updated successfully!');
            
        } catch (error) {
            console.error('Image upload failed:', error);
            this.showError('Failed to upload image');
        }
    }

    async saveContentChange(element, type, content) {
        // Generate unique ID for this element
        const blockId = this.generateBlockId(element);
        element.dataset.blockId = blockId;
        
        // Save to content data
        if (!this.contentData[this.currentPage]) {
            this.contentData[this.currentPage] = {};
        }
        
        this.contentData[this.currentPage][blockId] = {
            type: type,
            content: content,
            timestamp: Date.now()
        };
        
        // Auto-save to Firebase
        this.scheduleAutoSave();
        
        console.log(`Saved ${type} content for block ${blockId} on page ${this.currentPage}`);
    }

    generateBlockId(element) {
        // Generate a unique ID based on element characteristics
        const tagName = element.tagName.toLowerCase();
        const textContent = element.textContent.slice(0, 20).replace(/\s+/g, '-');
        const timestamp = Date.now();
        return `${tagName}-${textContent}-${timestamp}`.toLowerCase();
    }

    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveToFirebase();
        }, 2000); // Auto-save after 2 seconds of inactivity
    }

    async saveToFirebase() {
        if (!this.firebaseInitialized) {
            console.log('Firebase not available, saving to localStorage');
            this.saveToLocalStorage();
            return;
        }
        
        try {
            const db = firebase.firestore();
            
            // Save content data
            await db.collection('users').doc(this.userId).collection('storefront').doc('content').set({
                pages: this.contentData,
                theme: this.currentTheme,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('Content saved to Firebase successfully');
            this.showSuccess('Changes saved', 1500);
            
        } catch (error) {
            console.error('Failed to save to Firebase:', error);
            this.showError('Failed to save changes');
        }
    }

    saveToLocalStorage() {
        try {
            const data = {
                contentData: this.contentData,
                currentTheme: this.currentTheme,
                lastUpdated: Date.now()
            };
            
            localStorage.setItem(`storefront_${this.userId}`, JSON.stringify(data));
            console.log('Content saved to localStorage');
            this.showSuccess('Changes saved locally', 1500);
            
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    async loadUserContent() {
        if (!this.firebaseInitialized) {
            this.loadFromLocalStorage();
            return;
        }
        
        try {
            const db = firebase.firestore();
            const doc = await db.collection('users').doc(this.userId).collection('storefront').doc('content').get();
            
            if (doc.exists) {
                const data = doc.data();
                this.contentData = data.pages || {};
                this.currentTheme = data.theme || 'light-airy';
                console.log('Content loaded from Firebase');
            }
            
        } catch (error) {
            console.error('Failed to load from Firebase:', error);
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(`storefront_${this.userId}`);
            if (saved) {
                const data = JSON.parse(saved);
                this.contentData = data.contentData || {};
                this.currentTheme = data.currentTheme || 'light-airy';
                console.log('Content loaded from localStorage');
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
    }

    async saveUserSettings() {
        const settings = {
            theme: this.currentTheme,
            currentPage: this.currentPage
        };
        
        if (this.firebaseInitialized) {
            try {
                const db = firebase.firestore();
                await db.collection('users').doc(this.userId).collection('storefront').doc('settings').set(settings);
            } catch (error) {
                console.error('Failed to save settings:', error);
            }
        } else {
            localStorage.setItem(`storefront_settings_${this.userId}`, JSON.stringify(settings));
        }
    }

    // Block Management Functions
    showAddBlockModal() {
        const modal = this.createModal('Add New Block', this.createAddBlockForm());
        document.body.appendChild(modal);
    }

    createAddBlockForm() {
        const form = document.createElement('div');
        form.className = 'add-block-form';
        form.innerHTML = `
            <div class="block-types-grid">
                ${Object.entries(this.blockTypes).map(([key, block]) => `
                    <div class="block-type-option" data-block-type="${key}">
                        <span class="block-icon">${block.icon}</span>
                        <span class="block-name">${block.name}</span>
                    </div>
                `).join('')}
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="window.editor && window.editor.addSelectedBlock()">Add Block</button>
            </div>
        `;
        
        // Add click handlers
        form.querySelectorAll('.block-type-option').forEach(option => {
            option.addEventListener('click', () => {
                form.querySelectorAll('.block-type-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        return form;
    }

    async addSelectedBlock() {
        const selectedOption = document.querySelector('.block-type-option.selected');
        if (!selectedOption) {
            this.showError('Please select a block type');
            return;
        }
        
        const blockType = selectedOption.dataset.blockType;
        await this.addBlock(blockType);
        
        // Close modal
        document.querySelector('.modal').remove();
    }

    async addBlock(blockType) {
        try {
            // Load block template
            const blockHtml = await this.loadBlockTemplate(blockType);
            
            // Add to current page
            const previewFrame = document.getElementById('preview-frame');
            if (previewFrame) {
                const blockContainer = document.createElement('div');
                blockContainer.className = `block block-${blockType}`;
                blockContainer.innerHTML = blockHtml;
                
                // Make the new block editable
                this.makeContentEditable(blockContainer.innerHTML);
                this.setupInlineEditing(blockContainer);
                
                previewFrame.appendChild(blockContainer);
            }
            
            // Update page blocks
            if (!this.pageBlocks[this.currentPage]) {
                this.pageBlocks[this.currentPage] = [];
            }
            
            const blockId = `block-${blockType}-${Date.now()}`;
            this.pageBlocks[this.currentPage].push({
                id: blockId,
                type: blockType,
                content: {}
            });
            
            this.scheduleAutoSave();
            this.showSuccess(`${this.blockTypes[blockType].name} added successfully!`);
            
        } catch (error) {
            console.error('Failed to add block:', error);
            this.showError('Failed to add block');
        }
    }

    async loadBlockTemplate(blockType) {
        // For now, return simple templates
        const templates = {
            hero: `
                <section class="hero-section" style="padding: 4rem 2rem; text-align: center; background: linear-gradient(135deg, #f7f3f0, #e8ddd4);">
                    <h1 contenteditable="true" data-editable="text">New Hero Title</h1>
                    <p contenteditable="true" data-editable="text">Hero subtitle goes here</p>
                </section>
            `,
            text: `
                <div style="padding: 2rem;">
                    <h2 contenteditable="true" data-editable="text">Text Block Title</h2>
                    <p contenteditable="true" data-editable="text">Add your text content here. This is a flexible text block that you can customize.</p>
                </div>
            `,
            image: `
                <div style="padding: 2rem; text-align: center;">
                    <div class="editable-image-wrapper" data-editable="image">
                        <img src="https://images.unsplash.com/photo-1554048612-b6a482b22084?ixlib=rb-4.0.3&w=800&q=80" style="max-width: 100%; height: auto; border-radius: 8px;">
                        <div class="image-edit-overlay">
                            <button class="image-edit-btn">📷 Change Image</button>
                        </div>
                    </div>
                </div>
            `,
            gallery: `
                <div style="padding: 2rem;">
                    <h2 contenteditable="true" data-editable="text">Photo Gallery</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                        <div class="editable-image-wrapper" data-editable="image">
                            <img src="https://images.unsplash.com/photo-1554048612-b6a482b22084?ixlib=rb-4.0.3&w=400&q=80" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;">
                            <div class="image-edit-overlay">
                                <button class="image-edit-btn">📷 Change</button>
                            </div>
                        </div>
                        <div class="editable-image-wrapper" data-editable="image">
                            <img src="https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?ixlib=rb-4.0.3&w=400&q=80" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;">
                            <div class="image-edit-overlay">
                                <button class="image-edit-btn">📷 Change</button>
                            </div>
                        </div>
                    </div>
                </div>
            `
        };
        
        return templates[blockType] || templates.text;
    }

    // Publishing Functions
    async previewSite() {
        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(this.generateFullSiteHTML());
        previewWindow.document.close();
        this.showSuccess('Preview opened in new tab');
    }

    async publishSite() {
        try {
            this.showLoading('Publishing site...');
            
            const siteHTML = this.generateFullSiteHTML();
            
            if (this.firebaseInitialized) {
                // Save to published sites collection
                const db = firebase.firestore();
                await db.collection('published-sites').doc(this.userId).set({
                    html: siteHTML,
                    theme: this.currentTheme,
                    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    pages: Object.keys(this.contentData)
                });
            }
            
            this.showSuccess('Site published successfully!');
            
        } catch (error) {
            console.error('Publishing failed:', error);
            this.showError('Failed to publish site');
        }
    }

    generateFullSiteHTML() {
        // Generate complete HTML for the current site
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return '';
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.contentData.siteTitle || 'Photography Studio'}</title>
                <style>
                    /* Add compiled styles here */
                    ${this.getCompiledStyles()}
                </style>
            </head>
            <body>
                ${previewFrame.innerHTML}
            </body>
            </html>
        `;
    }

    getCompiledStyles() {
        // Return styles for the published site
        return `
            body { font-family: 'Quicksand', sans-serif; margin: 0; padding: 0; }
            .editable-image-wrapper .image-edit-overlay { display: none !important; }
            [contenteditable] { outline: none !important; }
            .editing { outline: none !important; }
        `;
    }

    // Utility Functions
    replaceTemplateVariables(html) {
        // Replace template placeholders with saved content or defaults
        const replacements = {
            '{{heroTitle}}': this.getContentValue('hero_title') || 'Light + Airy Creative Studio',
            '{{heroSubtitle}}': this.getContentValue('hero_subtitle') || 'Capturing Life\'s Beautiful Moments',
            '{{studioName}}': this.getContentValue('studio_name') || 'Light + Airy Creative Studio',
            '{{tagline}}': this.getContentValue('tagline') || 'Professional Photography Services',
            '{{aboutText}}': this.getContentValue('about_text') || 'We specialize in capturing the moments that matter most to you.',
            '{{contactEmail}}': this.getContentValue('contact_email') || 'hello@lightairycreative.com',
            '{{contactPhone}}': this.getContentValue('contact_phone') || '(555) 123-4567'
        };
        
        Object.entries(replacements).forEach(([placeholder, value]) => {
            html = html.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        });
        
        // Replace content in elements with matching block IDs
        Object.entries(this.contentData[this.currentPage] || {}).forEach(([blockId, data]) => {
            if (data.type === 'text') {
                const regex = new RegExp(`data-block-id="${blockId}"[^>]*>([^<]*)<`, 'g');
                html = html.replace(regex, `data-block-id="${blockId}">${data.content}<`);
            }
        });
        
        return html;
    }
    
    getContentValue(key) {
        // Get content value from saved data or defaults
        const pageData = this.contentData[this.currentPage] || {};
        const blockData = Object.values(pageData).find(block => 
            block.type === 'text' && block.content && block.content.includes(key)
        );
        return blockData ? blockData.content : null;
    }

    addHamburgerMenu(html) {
        const hamburgerMenuHTML = `
        <!-- Hamburger Menu -->
        <div class="hamburger-menu-overlay" id="hamburger-overlay"></div>
        <div class="hamburger-menu" id="hamburger-menu">
            <div class="hamburger-header">
                <h3>Navigate Pages</h3>
                <button class="hamburger-close" id="hamburger-close">&times;</button>
            </div>
            <div class="hamburger-nav">
                ${this.pages.map(page => `
                    <a href="#" class="hamburger-nav-item ${page.id === this.currentPage ? 'active' : ''}" data-page="${page.id}">
                        <span class="nav-icon">${page.icon}</span>
                        <span>${page.name}</span>
                    </a>
                `).join('')}
            </div>
        </div>
        
        <!-- Hamburger Button -->
        <button class="hamburger-btn" id="hamburger-btn">
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
        </button>
        
        <style>
        .hamburger-btn {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            background: rgba(196, 150, 45, 0.9);
            border: none;
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        .hamburger-line {
            display: block;
            width: 20px;
            height: 3px;
            background: white;
            margin: 3px 0;
            transition: all 0.3s ease;
            border-radius: 2px;
        }
        
        .hamburger-menu-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1001;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        
        .hamburger-menu {
            position: fixed;
            top: 0;
            left: -300px;
            width: 280px;
            height: 100vh;
            background: #f7f3f0;
            z-index: 1002;
            transition: all 0.3s ease;
            box-shadow: 2px 0 15px rgba(0, 0, 0, 0.1);
        }
        
        .hamburger-header {
            padding: 20px;
            border-bottom: 1px solid #e8ddd4;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #e8ddd4;
        }
        
        .hamburger-nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 15px 20px;
            color: #2c2c2c;
            text-decoration: none;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
        }
        
        .hamburger-nav-item:hover {
            background: rgba(196, 150, 45, 0.1);
            border-left-color: #c4962d;
        }
        
        .hamburger-nav-item.active {
            background: rgba(196, 150, 45, 0.2);
            border-left-color: #c4962d;
            color: #c4962d;
            font-weight: 600;
        }
        
        .editable-image-wrapper {
            position: relative;
            display: inline-block;
        }
        
        .image-edit-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .image-edit-btn {
            background: #c4962d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
        }
        
        [contenteditable]:hover {
            outline: 2px dashed #c4962d;
            outline-offset: 4px;
        }
        
        .editing {
            outline: 2px solid #c4962d !important;
            outline-offset: 4px;
        }
        </style>
        
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            const hamburgerBtn = document.getElementById('hamburger-btn');
            const hamburgerMenu = document.getElementById('hamburger-menu');
            const hamburgerOverlay = document.getElementById('hamburger-overlay');
            const hamburgerClose = document.getElementById('hamburger-close');
            const navItems = document.querySelectorAll('.hamburger-nav-item');
            
            function openMenu() {
                hamburgerMenu.style.left = '0';
                hamburgerOverlay.style.opacity = '1';
                hamburgerOverlay.style.visibility = 'visible';
            }
            
            function closeMenu() {
                hamburgerMenu.style.left = '-300px';
                hamburgerOverlay.style.opacity = '0';
                hamburgerOverlay.style.visibility = 'hidden';
            }
            
            hamburgerBtn.addEventListener('click', openMenu);
            hamburgerClose.addEventListener('click', closeMenu);
            hamburgerOverlay.addEventListener('click', closeMenu);
            
            navItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    navItems.forEach(nav => nav.classList.remove('active'));
                    this.classList.add('active');
                    closeMenu();
                    
                    // Trigger page change in editor
                    if (window.editor) {
                        window.editor.selectPage(this.dataset.page);
                    } else {
                        console.log('Editor not available, page change skipped');
                    }
                });
            });
        });
        </script>
        `;
        
        // Insert after opening body tag
        const bodyIndex = html.indexOf('<body');
        if (bodyIndex !== -1) {
            const bodyCloseIndex = html.indexOf('>', bodyIndex) + 1;
            html = html.slice(0, bodyCloseIndex) + hamburgerMenuHTML + html.slice(bodyCloseIndex);
        }
        
        return html;
    }

    setDeviceView(device) {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        previewFrame.classList.remove('desktop', 'tablet', 'mobile');
        previewFrame.classList.add(device);
        
        switch (device) {
            case 'desktop':
                previewFrame.style.maxWidth = '100%';
                break;
            case 'tablet':
                previewFrame.style.maxWidth = '768px';
                break;
            case 'mobile':
                previewFrame.style.maxWidth = '375px';
                break;
        }
    }

    setupAutoSave() {
        // Save every 30 seconds if there are unsaved changes
        setInterval(() => {
            if (this.autoSaveTimeout) {
                this.saveToFirebase();
            }
        }, 30000);
    }

    // UI Helper Functions
    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body"></div>
            </div>
        `;
        
        modal.querySelector('.modal-body').appendChild(content);
        return modal;
    }

    showSuccess(message, duration = 3000) {
        this.showNotification(message, 'success', duration);
    }

    showError(message, duration = 5000) {
        this.showNotification(message, 'error', duration);
    }

    showLoading(message) {
        this.showNotification(message, 'loading', 0);
    }

    showNotification(message, type = 'info', duration = 3000) {
        // Remove existing notifications of the same type
        const existing = document.querySelectorAll(`.notification-${type}`);
        existing.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);
        }
        
        return notification;
    }
}

// Global functions for HTML onclick handlers
function publishSite() {
    if (window.editor) {
        window.editor.publishSite();
    } else {
        console.error('Editor not initialized');
        alert('Editor not ready. Please wait for initialization.');
    }
}

function previewSite() {
    if (window.editor) {
        window.editor.previewSite();
    } else {
        console.error('Editor not initialized');
        alert('Editor not ready. Please wait for initialization.');
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.editor) {
        window.editor = new AdvancedVisualEditor();
    }
});
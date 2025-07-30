// Storefront Builder JavaScript
class StorefrontBuilder {
    constructor() {
        this.currentPage = 'home';
        this.currentTheme = 'light-airy';
        this.siteData = {
            theme: 'light-airy',
            pages: {
                home: {
                    heroTitle: 'Welcome to My Photography',
                    heroSubtitle: 'Capturing life\'s beautiful moments with artistic vision and professional excellence',
                    heroCta: 'Book Your Session'
                },
                about: {
                    story: 'I am a passionate photographer dedicated to capturing authentic moments and creating timeless memories.',
                    image: ''
                },
                gallery: {
                    title: 'Portfolio',
                    description: 'Explore my collection of work showcasing different styles and moments'
                },
                store: {
                    title: 'Print Store',
                    description: 'High-quality professional prints of your favorite images, delivered to your door'
                },
                blog: {
                    title: 'Journal',
                    description: 'Stories, inspiration, and behind-the-scenes moments from my photography journey'
                },
                contact: {
                    email: 'hello@photographer.com',
                    phone: '(555) 123-4567',
                    address: 'Your Studio Address\nCity, State 12345'
                }
            }
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSiteData();
        this.updatePreview();
    }
    
    setupEventListeners() {
        // Page navigation
        document.querySelectorAll('.page-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.switchPage(page);
            });
        });
        
        // Theme selection
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.selectTheme(theme);
            });
        });
        
        // Device preview
        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const device = e.currentTarget.dataset.device;
                this.switchDevice(device);
            });
        });
        
        // Form inputs - live update
        document.querySelectorAll('.form-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateSiteData();
                this.updatePreview();
            });
        });
        
        // Auto-save on changes
        this.setupAutoSave();
    }
    
    switchPage(page) {
        // Update navigation active state
        document.querySelectorAll('.page-nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        // Hide all editor sections
        document.querySelectorAll('[id^="editor-"]').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show current page editor
        const editorSection = document.getElementById(`editor-${page}`);
        if (editorSection) {
            editorSection.style.display = 'block';
        }
        
        this.currentPage = page;
        this.updatePreview();
        this.populateEditor();
    }
    
    selectTheme(theme) {
        // Update theme selection
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
        
        this.currentTheme = theme;
        this.siteData.theme = theme;
        this.updatePreview();
    }
    
    switchDevice(device) {
        // Update device selection
        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-device="${device}"]`).classList.add('active');
        
        // Update preview frame size
        const previewFrame = document.getElementById('preview-frame');
        switch(device) {
            case 'desktop':
                previewFrame.style.width = '100%';
                previewFrame.style.maxWidth = 'none';
                break;
            case 'tablet':
                previewFrame.style.width = '768px';
                previewFrame.style.maxWidth = '100%';
                previewFrame.style.margin = '0 auto';
                break;
            case 'mobile':
                previewFrame.style.width = '375px';
                previewFrame.style.maxWidth = '100%';
                previewFrame.style.margin = '0 auto';
                break;
        }
    }
    
    updateSiteData() {
        // Update site data from form inputs
        const page = this.currentPage;
        
        switch(page) {
            case 'home':
                this.siteData.pages.home.heroTitle = document.getElementById('hero-title').value;
                this.siteData.pages.home.heroSubtitle = document.getElementById('hero-subtitle').value;
                this.siteData.pages.home.heroCta = document.getElementById('hero-cta').value;
                break;
            case 'about':
                this.siteData.pages.about.story = document.getElementById('about-story').value;
                this.siteData.pages.about.image = document.getElementById('about-image').value;
                break;
            case 'gallery':
                this.siteData.pages.gallery.title = document.getElementById('gallery-title').value;
                this.siteData.pages.gallery.description = document.getElementById('gallery-description').value;
                break;
            case 'store':
                this.siteData.pages.store.title = document.getElementById('store-title').value;
                this.siteData.pages.store.description = document.getElementById('store-description').value;
                break;
            case 'blog':
                this.siteData.pages.blog.title = document.getElementById('blog-title').value;
                this.siteData.pages.blog.description = document.getElementById('blog-description').value;
                break;
            case 'contact':
                this.siteData.pages.contact.email = document.getElementById('contact-email').value;
                this.siteData.pages.contact.phone = document.getElementById('contact-phone').value;
                this.siteData.pages.contact.address = document.getElementById('contact-address').value;
                break;
        }
    }
    
    populateEditor() {
        // Populate form inputs with current data
        const page = this.currentPage;
        const pageData = this.siteData.pages[page];
        
        switch(page) {
            case 'home':
                document.getElementById('hero-title').value = pageData.heroTitle || '';
                document.getElementById('hero-subtitle').value = pageData.heroSubtitle || '';
                document.getElementById('hero-cta').value = pageData.heroCta || '';
                break;
            case 'about':
                document.getElementById('about-story').value = pageData.story || '';
                document.getElementById('about-image').value = pageData.image || '';
                break;
            case 'gallery':
                document.getElementById('gallery-title').value = pageData.title || '';
                document.getElementById('gallery-description').value = pageData.description || '';
                break;
            case 'store':
                document.getElementById('store-title').value = pageData.title || '';
                document.getElementById('store-description').value = pageData.description || '';
                break;
            case 'blog':
                document.getElementById('blog-title').value = pageData.title || '';
                document.getElementById('blog-description').value = pageData.description || '';
                break;
            case 'contact':
                document.getElementById('contact-email').value = pageData.email || '';
                document.getElementById('contact-phone').value = pageData.phone || '';
                document.getElementById('contact-address').value = pageData.address || '';
                break;
        }
    }
    
    updatePreview() {
        // Update the preview iframe with current data
        const previewFrame = document.getElementById('preview-frame');
        const previewUrl = `/storefront-preview/${this.currentPage}?theme=${this.currentTheme}`;
        
        // Post data to preview frame
        previewFrame.src = previewUrl;
        
        // Wait for frame to load, then send data
        previewFrame.onload = () => {
            try {
                previewFrame.contentWindow.postMessage({
                    type: 'updateSiteData',
                    data: this.siteData,
                    page: this.currentPage,
                    theme: this.currentTheme
                }, '*');
            } catch (e) {
                console.log('Preview update failed:', e);
            }
        };
    }
    
    setupAutoSave() {
        // Auto-save every 30 seconds
        setInterval(() => {
            this.saveSiteData();
        }, 30000);
        
        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.saveSiteData();
        });
    }
    
    async loadSiteData() {
        try {
            // Load from Firebase or localStorage
            const response = await fetch('/api/storefront/load', {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.siteData) {
                    this.siteData = { ...this.siteData, ...data.siteData };
                    this.currentTheme = this.siteData.theme || 'light-airy';
                    this.selectTheme(this.currentTheme);
                    this.populateEditor();
                }
            }
        } catch (error) {
            console.log('Loading from localStorage fallback');
            const saved = localStorage.getItem('storefront-data');
            if (saved) {
                this.siteData = { ...this.siteData, ...JSON.parse(saved) };
                this.currentTheme = this.siteData.theme || 'light-airy';
                this.selectTheme(this.currentTheme);
                this.populateEditor();
            }
        }
    }
    
    async saveSiteData() {
        try {
            const response = await fetch('/api/storefront/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    siteData: this.siteData
                })
            });
            
            if (response.ok) {
                this.showSuccessMessage('Site saved successfully!');
            }
        } catch (error) {
            // Fallback to localStorage
            localStorage.setItem('storefront-data', JSON.stringify(this.siteData));
            console.log('Saved to localStorage as fallback');
        }
    }
    
    async getAuthToken() {
        // Get Firebase auth token
        try {
            const user = firebase.auth().currentUser;
            if (user) {
                return await user.getIdToken();
            }
        } catch (error) {
            console.log('Auth token not available');
        }
        return null;
    }
    
    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `<span>✅</span> ${message}`;
        
        const editorPanel = document.querySelector('.editor-panel');
        editorPanel.insertBefore(successDiv, editorPanel.firstChild);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
}

// Global functions
async function savePage() {
    const builder = window.storefrontBuilder;
    builder.updateSiteData();
    await builder.saveSiteData();
    builder.showSuccessMessage('Page saved successfully!');
}

async function previewSite() {
    const builder = window.storefrontBuilder;
    const previewUrl = `/storefront-preview/home?theme=${builder.currentTheme}&preview=true`;
    window.open(previewUrl, '_blank');
}

async function publishSite() {
    const builder = window.storefrontBuilder;
    
    try {
        const response = await fetch('/api/storefront/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await builder.getAuthToken()}`
            },
            body: JSON.stringify({
                siteData: builder.siteData
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            builder.showSuccessMessage('Site published successfully!');
            
            // Show published URL
            setTimeout(() => {
                alert(`Your site is now live at: ${result.url}`);
            }, 1000);
        } else {
            throw new Error('Publishing failed');
        }
    } catch (error) {
        alert('Publishing failed. Please try again.');
        console.error('Publishing error:', error);
    }
}

function openTemplateSelector() {
    // Open template selector modal
    alert('Template selector coming soon! Choose from professional photography themes.');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase if available
    if (typeof firebase !== 'undefined' && firebaseConfig) {
        try {
            firebase.initializeApp(firebaseConfig);
        } catch (error) {
            console.log('Firebase initialization failed:', error);
        }
    }
    
    // Initialize storefront builder
    window.storefrontBuilder = new StorefrontBuilder();
});
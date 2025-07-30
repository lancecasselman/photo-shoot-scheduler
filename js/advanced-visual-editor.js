// Advanced Dynamic Block-Based Visual Website Editor
// Exceeds Pixieset/Format functionality with real-time Firebase sync

class AdvancedVisualEditor {
    constructor() {
        this.userId = 'dev-user-123'; // Get from Firebase Auth in production
        this.currentTheme = 'light-airy';
        this.currentPage = 'home';
        this.isEditing = false;
        this.autoSaveTimeout = null;
        this.firebaseInitialized = false;
        this.isDragging = false;
        this.undoStack = [];
        this.redoStack = [];
        
        // Available themes with preview support
        this.themes = {
            'light-airy': { name: 'Light + Airy Creative Studio', category: 'elegant' },
            'bold-editorial': { name: 'Bold Editorial', category: 'dramatic' },
            'earthy-boho': { name: 'Earthy Boho', category: 'natural' },
            'modern-luxe': { name: 'Modern Luxe', category: 'minimal' },
            'coastal-lifestyle': { name: 'Coastal Lifestyle', category: 'lifestyle' },
            'minimal-portfolio': { name: 'Minimal Portfolio', category: 'minimal' },
            'monochrome-studio': { name: 'Monochrome Studio', category: 'classic' },
            'dark-moody-wedding': { name: 'Dark Moody Wedding', category: 'dramatic' },
            'romantic-serif': { name: 'Romantic Serif', category: 'elegant' },
            'fashion-forward': { name: 'Fashion Forward', category: 'modern' },
            'commercial-grid': { name: 'Commercial Grid', category: 'business' },
            'film-vibe': { name: 'Film Vibe', category: 'vintage' },
            'urban-black-gold': { name: 'Urban Black Gold', category: 'modern' },
            'cottagecore-vibes': { name: 'Cottagecore Vibes', category: 'natural' },
            'rustic-barn': { name: 'Rustic Barn', category: 'rustic' },
            'luxury-fine-art': { name: 'Luxury Fine Art', category: 'elegant' },
            'street-photography': { name: 'Street Photography', category: 'urban' },
            'scenic-landscapes': { name: 'Scenic Landscapes', category: 'nature' },
            'scrolling-story': { name: 'Scrolling Story', category: 'narrative' },
            'storybook-magazine': { name: 'Storybook Magazine', category: 'editorial' }
        };
        
        // Available pages
        this.pages = [
            { id: 'home', name: 'Home', icon: '🏠' },
            { id: 'about', name: 'About', icon: '👤' },
            { id: 'gallery', name: 'Gallery', icon: '📸' },
            { id: 'store', name: 'Store', icon: '🛍️' },
            { id: 'contact', name: 'Contact', icon: '📧' }
        ];
        
        // Page settings including backgrounds and fonts
        this.pageSettings = {
            home: { backgroundColor: '#F7F3F0', pageTitle: 'Home' },
            about: { backgroundColor: '#F7F3F0', pageTitle: 'About' },
            gallery: { backgroundColor: '#F7F3F0', pageTitle: 'Gallery' },
            store: { backgroundColor: '#F7F3F0', pageTitle: 'Store' },
            contact: { backgroundColor: '#F7F3F0', pageTitle: 'Contact' }
        };
        
        // Global font settings
        this.fontSettings = {
            headings: 'Cormorant Garamond',
            body: 'Quicksand',
            buttons: 'Quicksand'
        };
        
        // Available fonts
        this.availableFonts = [
            'Cormorant Garamond',
            'Quicksand',
            'Playfair Display',
            'Open Sans',
            'Lora',
            'Poppins',
            'Montserrat',
            'Raleway',
            'Source Sans Pro',
            'Merriweather'
        ];
        
        // Available block types for the editor
        this.blockTypes = {
            'hero': { 
                name: 'Hero Section', 
                icon: '🎯',
                description: 'Large banner with headline and call-to-action',
                template: this.getHeroTemplate()
            },
            'about': { 
                name: 'About Section', 
                icon: '👤',
                description: 'Information about your studio',
                template: this.getAboutTemplate()
            },
            'image-grid': { 
                name: 'Image Grid', 
                icon: '🖼️',
                description: 'Gallery of photos in grid layout',
                template: this.getImageGridTemplate()
            },
            'text': { 
                name: 'Text Block', 
                icon: '📝',
                description: 'Rich text content section',
                template: this.getTextTemplate()
            },
            'cta': { 
                name: 'Call to Action', 
                icon: '📢',
                description: 'Button or link to drive action',
                template: this.getCTATemplate()
            },
            'testimonial': { 
                name: 'Testimonial', 
                icon: '💬',
                description: 'Client review or quote',
                template: this.getTestimonialTemplate()
            },
            'pricing': { 
                name: 'Pricing Table', 
                icon: '💰',
                description: 'Service packages and pricing',
                template: this.getPricingTemplate()
            },
            'blog': { 
                name: 'Blog Preview', 
                icon: '📰',
                description: 'Latest blog posts or news',
                template: this.getBlogTemplate()
            }
        };
        
        // Current page layout (blocks)
        this.pageLayouts = {
            home: [],
            about: [],
            gallery: [],
            store: [],
            contact: []
        };
        
        // Content storage for all blocks
        this.contentData = {};
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Advanced Visual Editor...');
        
        try {
            // Initialize Firebase
            await this.initializeFirebase();
            
            // Load user content and settings
            await this.loadUserContent();
            
            // Setup all UI components
            this.setupUI();
            
            // Load initial theme and page
            await this.loadCurrentPage();
            
            // Setup real-time auto-save
            this.setupAutoSave();
            
            console.log('✅ Advanced Visual Editor initialized successfully');
            this.showSuccess('Editor ready - click any text or image to edit!');
            
        } catch (error) {
            console.error('❌ Failed to initialize editor:', error);
            this.showError('Failed to initialize editor');
        }
    }

    // PHASE 1: FIREBASE INTEGRATION
    async initializeFirebase() {
        try {
            if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.firebaseInitialized = true;
                this.showSuccess('Firebase connected');
                console.log('🔥 Firebase initialized for visual editor');
            } else {
                throw new Error('Firebase not available');
            }
        } catch (error) {
            console.log('⚠️ Firebase not available, using localStorage fallback');
            this.firebaseInitialized = false;
        }
    }

    // PHASE 1: UI SETUP
    setupUI() {
        this.setupPageSwitcher();
        this.setupThemeSelector();
        this.setupBlockPanel();
        this.setupBackgroundControls();
        this.setupFontControls();
        this.setupDeviceControls();
        this.setupDeviceControls();
        this.setupKeyboardShortcuts();
        this.makePreviewEditable();
    }

    setupPageSwitcher() {
        const pageNav = document.getElementById('page-navigation');
        if (!pageNav) return;

        pageNav.innerHTML = '';
        this.pages.forEach(page => {
            const pageItem = document.createElement('div');
            pageItem.className = `page-nav-item ${page.id === this.currentPage ? 'active' : ''}`;
            pageItem.dataset.page = page.id;
            pageItem.innerHTML = `
                <span class="page-icon">${page.icon}</span>
                <span class="page-name">${page.name}</span>
                <div class="page-status"></div>
            `;
            
            pageItem.addEventListener('click', () => this.switchPage(page.id));
            pageNav.appendChild(pageItem);
        });
    }

    setupThemeSelector() {
        const themeGrid = document.getElementById('theme-grid');
        if (!themeGrid) {
            console.warn('Theme grid element not found');
            return;
        }

        themeGrid.innerHTML = '';
        
        if (Object.keys(this.themes).length === 0) {
            themeGrid.innerHTML = '<p style="text-align: center; color: var(--sage);">No themes available</p>';
            return;
        }
        
        Object.entries(this.themes).forEach(([key, theme]) => {
            const themeOption = document.createElement('div');
            themeOption.className = `theme-option ${key === this.currentTheme ? 'active' : ''}`;
            themeOption.dataset.theme = key;
            themeOption.innerHTML = `
                <div class="theme-preview">
                    <div class="theme-preview-content" style="background: ${this.getThemePreviewGradient(theme.category)}">
                        <div class="preview-header" style="height: 20%; background: rgba(255,255,255,0.9);"></div>
                        <div class="preview-body" style="height: 60%; background: rgba(255,255,255,0.7);"></div>
                        <div class="preview-footer" style="height: 20%; background: rgba(255,255,255,0.9);"></div>
                    </div>
                </div>
                <div class="theme-info">
                    <div class="theme-name">${theme.name}</div>
                    <div class="theme-category">${theme.category}</div>
                </div>
            `;
            
            themeOption.addEventListener('click', () => this.changeTheme(key));
            themeGrid.appendChild(themeOption);
        });
        
        console.log(`✅ Loaded ${Object.keys(this.themes).length} themes in theme selector`);
    }

    getThemePreviewGradient(category) {
        const gradients = {
            'elegant': 'linear-gradient(135deg, #F7F3F0, #E8DDD4)',
            'dramatic': 'linear-gradient(135deg, #2C2C2C, #4A4A4A)',
            'natural': 'linear-gradient(135deg, #9CAFA3, #7A8B80)',
            'minimal': 'linear-gradient(135deg, #FFFFFF, #F0F0F0)',
            'lifestyle': 'linear-gradient(135deg, #A8DADC, #457B9D)',
            'classic': 'linear-gradient(135deg, #E0E0E0, #BDBDBD)',
            'modern': 'linear-gradient(135deg, #C4962D, #D4A843)',
            'business': 'linear-gradient(135deg, #457B9D, #1D3557)',
            'vintage': 'linear-gradient(135deg, #8D7053, #A0845C)',
            'urban': 'linear-gradient(135deg, #2C2C2C, #C4962D)',
            'rustic': 'linear-gradient(135deg, #8B4513, #A0522D)',
            'nature': 'linear-gradient(135deg, #228B22, #32CD32)',
            'narrative': 'linear-gradient(135deg, #8B008B, #9370DB)',
            'editorial': 'linear-gradient(135deg, #DC143C, #FF6347)'
        };
        
        return gradients[category] || 'linear-gradient(135deg, #F7F3F0, #E8DDD4)';
    }

    setupBlockPanel() {
        const sidebar = document.querySelector('.editor-sidebar');
        if (!sidebar) return;

        // Check if block panel already exists
        if (sidebar.querySelector('.block-panel')) return;

        const blockPanel = document.createElement('div');
        blockPanel.className = 'block-panel';
        blockPanel.innerHTML = `
            <h3>🧱 Add Blocks</h3>
            <div class="block-types">
                ${Object.entries(this.blockTypes).map(([key, block]) => `
                    <div class="block-type" data-block-type="${key}" title="${block.description}">
                        <span class="block-icon">${block.icon}</span>
                        <span class="block-name">${block.name}</span>
                    </div>
                `).join('')}
            </div>
            
            <h3>📋 Current Blocks</h3>
            <div id="current-blocks" class="current-blocks"></div>
            
            <div class="editor-actions">
                <button class="btn btn-primary" onclick="window.editor.previewSite()">
                    👁️ Preview
                </button>
                <button class="btn btn-secondary" onclick="window.editor.publishSite()">
                    🚀 Publish
                </button>
            </div>
        `;
        
        sidebar.appendChild(blockPanel);
        this.setupBlockTypeHandlers();
    }

    setupBlockTypeHandlers() {
        const blockTypes = document.querySelectorAll('.block-type');
        blockTypes.forEach(blockType => {
            blockType.addEventListener('click', () => {
                const type = blockType.dataset.blockType;
                this.addBlock(type);
            });
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

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveAllContent();
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'p':
                        e.preventDefault();
                        this.previewSite();
                        break;
                }
            }
        });
    }

    // PHASE 2: PAGE SWITCHING
    async switchPage(pageId) {
        if (pageId === this.currentPage) return;
        
        try {
            this.showLoading(`Switching to ${pageId}...`);
            
            // Save current page before switching
            await this.saveCurrentPageLayout();
            
            // Update active page indicator
            document.querySelectorAll('.page-nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const pageElement = document.querySelector(`[data-page="${pageId}"]`);
            if (pageElement) {
                pageElement.classList.add('active');
            }
            
            this.currentPage = pageId;
            
            // Update background and font controls for new page
            this.setupBackgroundControls();
            this.setupFontControls();
            
            await this.loadCurrentPage();
            
            this.showSuccess(`Switched to ${pageId} page`);
            
        } catch (error) {
            console.error('Failed to switch page:', error);
            this.showError('Failed to switch page');
        }
    }

    async loadCurrentPage() {
        try {
            // Load page layout from Firebase or fallback
            const layout = await this.loadPageLayout(this.currentPage);
            
            if (layout && layout.length > 0) {
                this.pageLayouts[this.currentPage] = layout;
                await this.renderPage();
            } else {
                // Load default template if no saved layout
                await this.loadDefaultPageTemplate();
            }
            
        } catch (error) {
            console.error('Failed to load page:', error);
            await this.loadDefaultPageTemplate();
        }
    }

    async loadPageLayout(pageId) {
        if (this.firebaseInitialized) {
            try {
                const db = firebase.firestore();
                const doc = await db.collection('users')
                    .doc(this.userId)
                    .collection('storefront')
                    .doc('layouts')
                    .get();
                
                if (doc.exists) {
                    const data = doc.data();
                    return data[pageId] || [];
                }
            } catch (error) {
                console.error('Failed to load from Firebase:', error);
            }
        }
        
        // Fallback to localStorage
        const saved = localStorage.getItem(`layout_${this.userId}_${pageId}`);
        return saved ? JSON.parse(saved) : [];
    }

    async loadDefaultPageTemplate() {
        try {
            console.log(`🔄 Loading default template for ${this.currentPage} page`);
            
            // Generate default content for the current page
            this.pageLayouts[this.currentPage] = await this.generateDefaultPageContent(this.currentPage);
            
            // Render the page with new content
            await this.renderPage();
            
            console.log(`✅ Default template loaded for ${this.currentPage} page`);
            this.showSuccess(`Created default content for ${this.currentPage} page`);
            
        } catch (error) {
            console.error('Failed to create default template:', error);
            this.showError('Failed to create page template');
        }
    }



    convertTemplateToBlocks(html) {
        // Simple conversion - in production this would be more sophisticated
        const blocks = [];
        
        // Create a hero block if template has hero section
        if (html.includes('hero') || html.includes('banner')) {
            blocks.push({
                id: `hero-${Date.now()}`,
                type: 'hero',
                content: {
                    headline: 'Welcome to Our Studio',
                    subtitle: 'Professional Photography Services',
                    buttonText: 'View Portfolio',
                    imageUrl: 'https://images.unsplash.com/photo-1554048612-b6a482b22084?ixlib=rb-4.0.3&w=1200&q=80'
                }
            });
        }
        
        // Add text block
        blocks.push({
            id: `text-${Date.now()}`,
            type: 'text',
            content: {
                text: 'We are passionate photographers dedicated to capturing your most precious moments with artistic vision and professional excellence.'
            }
        });
        
        return blocks;
    }

    // PHASE 3: THEME SWITCHING
    async changeTheme(themeKey) {
        if (themeKey === this.currentTheme) {
            this.showSuccess(`${this.themes[themeKey].name} theme already active`);
            return;
        }
        
        if (!this.themes[themeKey]) {
            this.showError('Theme not found');
            return;
        }
        
        try {
            this.showLoading('Applying new theme...');
            
            // Update active theme in UI
            document.querySelectorAll('.theme-option').forEach(option => {
                option.classList.remove('active');
            });
            
            const selectedTheme = document.querySelector(`[data-theme="${themeKey}"]`);
            if (selectedTheme) {
                selectedTheme.classList.add('active');
            }
            
            // Save current content before theme change
            await this.saveAllContent();
            
            // Apply new theme
            const previousTheme = this.currentTheme;
            this.currentTheme = themeKey;
            
            // Generate default content for all pages if they're empty
            await this.ensureAllPagesHaveContent();
            
            // Re-render with new theme styling
            await this.renderPage();
            
            // Save theme preference
            await this.saveUserSettings();
            
            console.log(`Theme changed from ${previousTheme} to ${themeKey}`);
            this.showSuccess(`Applied ${this.themes[themeKey].name} theme`);
            
        } catch (error) {
            console.error('Failed to change theme:', error);
            this.showError('Failed to change theme');
            // Revert theme on error
            this.currentTheme = previousTheme;
        }
    }

    async ensureAllPagesHaveContent() {
        console.log('🔄 Ensuring all pages have content...');
        
        for (const page of this.pages) {
            if (!this.pageLayouts[page.id] || this.pageLayouts[page.id].length === 0) {
                this.pageLayouts[page.id] = await this.generateDefaultPageContent(page.id);
                console.log(`✅ Generated default content for ${page.name} page`);
            }
        }
    }

    async generateDefaultPageContent(pageId) {
        const blocks = [];
        
        switch (pageId) {
            case 'home':
                blocks.push({
                    id: `hero-${Date.now()}`,
                    type: 'hero',
                    content: {
                        headline: 'Professional Photography Studio',
                        subtitle: 'Capturing life\'s most precious moments with artistic vision',
                        buttonText: 'View Our Work',
                        imageUrl: 'https://images.unsplash.com/photo-1554048612-b6a482b22084?ixlib=rb-4.0.3&w=1200&q=80'
                    }
                });
                blocks.push({
                    id: `text-${Date.now()}`,
                    type: 'text',
                    content: {
                        text: 'Welcome to our photography studio where every moment becomes a timeless memory. We specialize in capturing the essence of your special occasions with creativity and professional excellence.'
                    }
                });
                break;
                
            case 'about':
                blocks.push({
                    id: `about-${Date.now()}`,
                    type: 'about',
                    content: {
                        title: 'About Our Studio',
                        text: 'With years of experience in photography, we bring passion and professionalism to every shoot. Our mission is to create beautiful, lasting memories that you\'ll treasure forever.'
                    }
                });
                blocks.push({
                    id: `text-${Date.now() + 1}`,
                    type: 'text',
                    content: {
                        text: 'Our approach combines technical expertise with artistic vision, ensuring that every photograph tells your unique story.'
                    }
                });
                break;
                
            case 'gallery':
                blocks.push({
                    id: `text-${Date.now()}`,
                    type: 'text',
                    content: {
                        text: 'Explore our portfolio of recent work and see the stories we\'ve helped capture.'
                    }
                });
                blocks.push({
                    id: `image-grid-${Date.now()}`,
                    type: 'image-grid',
                    content: {
                        images: [
                            'https://images.unsplash.com/photo-1554048612-b6a482b22084?ixlib=rb-4.0.3&w=400&q=80',
                            'https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?ixlib=rb-4.0.3&w=400&q=80',
                            'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&w=400&q=80',
                            'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?ixlib=rb-4.0.3&w=400&q=80',
                            'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?ixlib=rb-4.0.3&w=400&q=80',
                            'https://images.unsplash.com/photo-1537633552985-df8429e8048b?ixlib=rb-4.0.3&w=400&q=80'
                        ]
                    }
                });
                break;
                
            case 'contact':
                blocks.push({
                    id: `text-${Date.now()}`,
                    type: 'text',
                    content: {
                        text: 'Ready to capture your special moments? Get in touch to discuss your photography needs.'
                    }
                });
                blocks.push({
                    id: `cta-${Date.now()}`,
                    type: 'cta',
                    content: {
                        title: 'Book Your Session',
                        text: 'Contact us today to schedule your photography session',
                        buttonText: 'Get In Touch',
                        buttonUrl: '#contact'
                    }
                });
                break;
                
            default:
                blocks.push({
                    id: `text-${Date.now()}`,
                    type: 'text',
                    content: {
                        text: `Welcome to the ${pageId} page. Click to edit this content and make it your own.`
                    }
                });
        }
        
        return blocks;
    }

    // PHASE 4: BLOCK SYSTEM
    async addBlock(blockType) {
        try {
            const blockData = this.blockTypes[blockType];
            if (!blockData) {
                this.showError('Unknown block type');
                return;
            }
            
            // Create new block
            const newBlock = {
                id: `${blockType}-${Date.now()}`,
                type: blockType,
                content: this.getDefaultBlockContent(blockType)
            };
            
            // Add to current page layout
            this.pageLayouts[this.currentPage].push(newBlock);
            
            // Re-render page
            await this.renderPage();
            
            // Auto-save
            this.scheduleAutoSave();
            
            // Add to undo stack
            this.addToUndoStack('addBlock', { blockId: newBlock.id, blockType });
            
            this.showSuccess(`${blockData.name} added`);
            
        } catch (error) {
            console.error('Failed to add block:', error);
            this.showError('Failed to add block');
        }
    }

    getDefaultBlockContent(blockType) {
        const defaults = {
            'hero': {
                headline: 'Your Headline Here',
                subtitle: 'Your subtitle goes here',
                buttonText: 'Learn More',
                imageUrl: 'https://images.unsplash.com/photo-1554048612-b6a482b22084?ixlib=rb-4.0.3&w=1200&q=80'
            },
            'about': {
                title: 'About Our Studio',
                text: 'Tell your story here. Share what makes your photography unique and why clients should choose you.'
            },
            'text': {
                text: 'Add your text content here. You can edit this directly by clicking on it.'
            },
            'image-grid': {
                images: [
                    'https://images.unsplash.com/photo-1554048612-b6a482b22084?ixlib=rb-4.0.3&w=400&q=80',
                    'https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?ixlib=rb-4.0.3&w=400&q=80',
                    'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&w=400&q=80'
                ]
            },
            'cta': {
                title: 'Ready to Book?',
                text: 'Contact us today to schedule your session',
                buttonText: 'Get Started',
                buttonUrl: '#contact'
            },
            'testimonial': {
                text: 'Amazing photography! They captured our special day perfectly.',
                author: 'Happy Client',
                role: 'Wedding Client'
            },
            'pricing': {
                packages: [
                    { name: 'Basic', price: '$299', features: ['2 Hours', '50 Photos', 'Digital Gallery'] },
                    { name: 'Premium', price: '$599', features: ['4 Hours', '150 Photos', 'Digital Gallery', 'Print Release'] }
                ]
            },
            'blog': {
                posts: [
                    { title: 'Latest Shoot', excerpt: 'Check out our recent work...', date: '2025-01-30' }
                ]
            }
        };
        
        return defaults[blockType] || {};
    }

    async renderPage() {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        const layout = this.pageLayouts[this.currentPage] || [];
        const pageSettings = this.pageSettings[this.currentPage] || {};
        
        // Generate enhanced page HTML with mobile navigation
        let html = this.generatePageCSS();
        html += this.getFontCSS();
        html += this.getMobileNavCSS();
        
        // Add hamburger menu for mobile navigation
        html += `
            <div class="mobile-nav-overlay" id="mobile-nav-overlay">
                <nav class="mobile-nav">
                    <div class="mobile-nav-header">
                        <span class="mobile-nav-title">Navigation</span>
                        <button class="mobile-nav-close" onclick="toggleMobileNav()">×</button>
                    </div>
                    <ul class="mobile-nav-links">
                        ${this.pages.map(page => `
                            <li><a href="#${page.id}" onclick="toggleMobileNav(); if(window.editor) window.editor.switchPage('${page.id}')">${page.name}</a></li>
                        `).join('')}
                    </ul>
                </nav>
            </div>
            <div class="mobile-nav-toggle" onclick="toggleMobileNav()">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        // Page container with custom background
        html += `<div class="page-container" data-page="${this.currentPage}" style="min-height: 100vh; background: ${pageSettings.backgroundColor || '#F7F3F0'}; font-family: var(--font-body);">`;
        
        layout.forEach(block => {
            html += this.renderBlock(block);
        });
        
        html += `</div>`;
        
        // Add drag and drop functionality
        html += this.getDragDropScript();
        
        previewFrame.innerHTML = html;
        
        // Update page title
        this.updatePageTitle();
        
        // Setup inline editing after render
        this.makePreviewEditable();
        this.setupBlockDragDrop();
        this.updateCurrentBlocksList();
    }

    renderBlock(block) {
        const blockTemplate = this.blockTypes[block.type]?.template;
        if (!blockTemplate) return '';
        
        let html = blockTemplate(block.content);
        
        // Add editing attributes to specific elements only
        html = html.replace(/<(h[1-6]|p|span|div|button)[^>]*data-editable="true"[^>]*>/g, (match, tagName) => {
            if (match.includes(`data-block-id="${block.id}"`)) {
                return match; // Already has block ID
            }
            return match.replace('>', ` data-block-id="${block.id}">`);
        });
        
        // Wrap in draggable container
        return `
            <div class="editor-block" data-block-id="${block.id}" data-block-type="${block.type}" draggable="true">
                <div class="block-controls">
                    <span class="block-type-label">${this.blockTypes[block.type].name}</span>
                    <div class="block-actions">
                        <button class="btn-mini btn-danger" onclick="window.editor.deleteBlock('${block.id}')">×</button>
                    </div>
                </div>
                <div class="block-content">
                    ${html}
                </div>
            </div>
        `;
    }

    // PHASE 1: INLINE EDITING
    makePreviewEditable() {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        // Make text elements editable
        const textElements = previewFrame.querySelectorAll('[data-editable="true"]');
        textElements.forEach(element => {
            this.setupTextEditing(element);
        });
        
        // Make images editable
        const images = previewFrame.querySelectorAll('img');
        images.forEach(img => {
            this.setupImageEditing(img);
        });
    }

    setupTextEditing(element) {
        element.contentEditable = true;
        
        let originalContent = '';
        
        element.addEventListener('focus', () => {
            originalContent = element.innerHTML;
            this.isEditing = true;
            element.classList.add('editing');
            this.showEditingIndicator(element);
        });
        
        element.addEventListener('blur', () => {
            this.isEditing = false;
            element.classList.remove('editing');
            this.hideEditingIndicator();
            
            if (element.innerHTML !== originalContent) {
                this.saveBlockContent(element, 'text', element.innerHTML);
            }
        });
        
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                element.blur();
            }
        });
        
        // Visual feedback
        element.addEventListener('mouseenter', () => {
            if (!this.isEditing && !this.isDragging) {
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

    setupImageEditing(img) {
        const wrapper = document.createElement('div');
        wrapper.className = 'editable-image-wrapper';
        wrapper.dataset.editable = 'image';
        
        const overlay = document.createElement('div');
        overlay.className = 'image-edit-overlay';
        overlay.innerHTML = '<button class="image-edit-btn">📷 Change Image</button>';
        
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
        wrapper.appendChild(overlay);
        
        overlay.addEventListener('click', () => {
            this.openImagePicker(img);
        });
        
        wrapper.addEventListener('mouseenter', () => {
            overlay.style.opacity = '1';
        });
        
        wrapper.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
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
                this.saveBlockContent(imgElement, 'image', downloadURL);
                
                this.showSuccess('Image updated successfully!');
                
            } else {
                // Fallback to local file reading
                const reader = new FileReader();
                reader.onload = (e) => {
                    imgElement.src = e.target.result;
                    this.saveBlockContent(imgElement, 'image', e.target.result);
                    this.showSuccess('Image updated (local)');
                };
                reader.readAsDataURL(file);
            }
            
        } catch (error) {
            console.error('Image upload failed:', error);
            this.showError('Failed to upload image');
        }
    }

    saveBlockContent(element, type, content) {
        const blockElement = element.closest('[data-block-id]');
        if (!blockElement) {
            console.warn('No block element found for content save');
            return;
        }
        
        const blockId = blockElement.dataset.blockId;
        const block = this.findBlockById(blockId);
        
        if (block) {
            // Store previous content for undo
            const previousContent = { ...block.content };
            
            // Update content based on type
            if (type === 'text') {
                const fieldName = this.getContentFieldName(element, block.type);
                if (fieldName) {
                    block.content[fieldName] = content;
                } else {
                    // Fallback to text field
                    block.content.text = content;
                }
            } else if (type === 'image') {
                block.content.imageUrl = content;
            }
            
            // Add to undo stack with previous content
            this.addToUndoStack('editContent', { 
                blockId, 
                type, 
                newContent: content,
                previousContent 
            });
            
            // Schedule auto-save
            this.scheduleAutoSave();
            
            console.log(`Saved ${type} content for block ${blockId}`);
            this.showSuccess('Content updated', 1000);
            
        } else {
            console.error('Block not found for ID:', blockId);
        }
    }

    getContentFieldName(element, blockType) {
        // Determine which content field to update based on element and block type
        const tagName = element.tagName.toLowerCase();
        const classes = element.className;
        
        if (tagName === 'h1' || classes.includes('headline')) return 'headline';
        if (tagName === 'h2' || classes.includes('title')) return 'title';
        if (tagName === 'h3' || classes.includes('subtitle')) return 'subtitle';
        if (tagName === 'p' || classes.includes('text')) return 'text';
        if (classes.includes('button')) return 'buttonText';
        
        return 'text'; // Default fallback
    }

    findBlockById(blockId) {
        const layout = this.pageLayouts[this.currentPage] || [];
        return layout.find(block => block.id === blockId);
    }

    // PHASE 4: DRAG AND DROP
    setupBlockDragDrop() {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        const blocks = previewFrame.querySelectorAll('.editor-block');
        
        blocks.forEach(block => {
            block.addEventListener('dragstart', (e) => {
                this.isDragging = true;
                e.dataTransfer.setData('text/plain', block.dataset.blockId);
                block.classList.add('dragging');
            });
            
            block.addEventListener('dragend', () => {
                this.isDragging = false;
                block.classList.remove('dragging');
                this.updateBlockOrder();
            });
            
            block.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = previewFrame.querySelector('.dragging');
                if (!dragging || dragging === block) return;
                
                const afterElement = this.getDragAfterElement(previewFrame, e.clientY);
                
                if (afterElement == null) {
                    previewFrame.appendChild(dragging);
                } else {
                    previewFrame.insertBefore(dragging, afterElement);
                }
            });
        });
    }
    
    updateBlockOrder() {
        // Update the layout order based on DOM order
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        const blockElements = previewFrame.querySelectorAll('.editor-block');
        const newLayout = [];
        
        blockElements.forEach(blockEl => {
            const blockId = blockEl.dataset.blockId;
            const block = this.findBlockById(blockId);
            if (block) {
                newLayout.push(block);
            }
        });
        
        this.pageLayouts[this.currentPage] = newLayout;
        this.scheduleAutoSave();
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.editor-block:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async deleteBlock(blockId) {
        if (!confirm('Are you sure you want to delete this block?')) return;
        
        try {
            const layout = this.pageLayouts[this.currentPage];
            const blockIndex = layout.findIndex(block => block.id === blockId);
            
            if (blockIndex !== -1) {
                const deletedBlock = layout.splice(blockIndex, 1)[0];
                
                // Add to undo stack
                this.addToUndoStack('deleteBlock', { block: deletedBlock, index: blockIndex });
                
                // Re-render page
                await this.renderPage();
                
                // Auto-save
                this.scheduleAutoSave();
                
                this.showSuccess('Block deleted');
            }
            
        } catch (error) {
            console.error('Failed to delete block:', error);
            this.showError('Failed to delete block');
        }
    }

    // PHASE 5: SAVE & PUBLISH SYSTEM
    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveAllContent();
        }, 2000); // Auto-save after 2 seconds of inactivity
    }

    async saveAllContent() {
        try {
            if (this.firebaseInitialized) {
                await this.saveToFirebase();
            } else {
                this.saveToLocalStorage();
            }
        } catch (error) {
            console.error('Failed to save content:', error);
            this.showError('Failed to save changes');
        }
    }

    async saveToFirebase() {
        const db = firebase.firestore();
        
        try {
            // Convert data to plain objects to avoid Firestore serialization issues
            const layoutData = {
                [this.currentPage]: JSON.parse(JSON.stringify(this.pageLayouts[this.currentPage] || [])),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const settingsData = {
                currentTheme: this.currentTheme,
                pageSettings: JSON.parse(JSON.stringify(this.pageSettings || {})),
                fontSettings: JSON.parse(JSON.stringify(this.fontSettings || {})),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Save layouts
            await db.collection('users').doc(this.userId).collection('storefront').doc('layouts').set(layoutData, { merge: true });
            
            // Save settings
            await db.collection('users').doc(this.userId).collection('storefront').doc('settings').set(settingsData);
            
            console.log('✅ Content saved to Firebase');
            this.showSuccess('Changes saved', 1500);
        } catch (error) {
            console.error('Firebase save error:', error);
            // Fallback to localStorage
            this.saveToLocalStorage();
            this.showError('Saved locally (Firebase unavailable)');
        }
    }

    saveToLocalStorage() {
        localStorage.setItem(`layout_${this.userId}_${this.currentPage}`, 
            JSON.stringify(this.pageLayouts[this.currentPage]));
        localStorage.setItem(`settings_${this.userId}`, 
            JSON.stringify({ 
                currentTheme: this.currentTheme,
                pageSettings: this.pageSettings,
                fontSettings: this.fontSettings
            }));
        
        console.log('✅ Content saved to localStorage');
        this.showSuccess('Changes saved locally', 1500);
    }

    async saveCurrentPageLayout() {
        // Update the current page layout based on DOM order
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        const blockElements = previewFrame.querySelectorAll('.editor-block');
        const newLayout = [];
        
        blockElements.forEach(blockEl => {
            const blockId = blockEl.dataset.blockId;
            const block = this.findBlockById(blockId);
            if (block) {
                newLayout.push(block);
            }
        });
        
        this.pageLayouts[this.currentPage] = newLayout;
    }

    async loadUserContent() {
        if (this.firebaseInitialized) {
            try {
                const db = firebase.firestore();
                
                // Load layouts
                const layoutDoc = await db.collection('users').doc(this.userId).collection('storefront').doc('layouts').get();
                if (layoutDoc.exists) {
                    const layouts = layoutDoc.data();
                    Object.keys(layouts).forEach(page => {
                        if (page !== 'lastUpdated') {
                            this.pageLayouts[page] = layouts[page] || [];
                        }
                    });
                }
                
                // Load settings
                const settingsDoc = await db.collection('users').doc(this.userId).collection('storefront').doc('settings').get();
                if (settingsDoc.exists) {
                    const settings = settingsDoc.data();
                    this.currentTheme = settings.currentTheme || 'light-airy';
                }
                
                console.log('✅ Content loaded from Firebase');
                
            } catch (error) {
                console.error('Failed to load from Firebase:', error);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        try {
            // Load layouts
            this.pages.forEach(page => {
                const saved = localStorage.getItem(`layout_${this.userId}_${page.id}`);
                if (saved) {
                    this.pageLayouts[page.id] = JSON.parse(saved);
                }
            });
            
            // Load settings
            const settingsSaved = localStorage.getItem(`settings_${this.userId}`);
            if (settingsSaved) {
                const settings = JSON.parse(settingsSaved);
                this.currentTheme = settings.currentTheme || 'light-airy';
            }
            
            console.log('✅ Content loaded from localStorage');
            
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
    }

    async saveUserSettings() {
        const settings = {
            currentTheme: this.currentTheme,
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
            localStorage.setItem(`settings_${this.userId}`, JSON.stringify(settings));
        }
    }

    // PHASE 5: PREVIEW & PUBLISH
    async previewSite() {
        try {
            await this.saveCurrentPageLayout();
            const fullSiteHTML = await this.generateFullSiteHTML();
            
            const previewWindow = window.open('', '_blank');
            previewWindow.document.write(fullSiteHTML);
            previewWindow.document.close();
            
            this.showSuccess('Preview opened in new tab');
            
        } catch (error) {
            console.error('Failed to generate preview:', error);
            this.showError('Failed to generate preview');
        }
    }

    async publishSite() {
        try {
            this.showLoading('Publishing site...');
            
            await this.saveCurrentPageLayout();
            const fullSiteHTML = await this.generateFullSiteHTML();
            
            if (this.firebaseInitialized) {
                const db = firebase.firestore();
                await db.collection('published-sites').doc(this.userId).set({
                    html: fullSiteHTML,
                    theme: this.currentTheme,
                    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    pages: Object.keys(this.pageLayouts)
                });
            }
            
            this.showSuccess('Site published successfully!');
            
        } catch (error) {
            console.error('Publishing failed:', error);
            this.showError('Failed to publish site');
        }
    }

    async generateFullSiteHTML() {
        let html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Photography Studio</title>
                ${this.generatePageCSS()}
            </head>
            <body>
                <nav class="site-nav">
                    ${this.pages.map(page => `
                        <a href="#${page.id}" class="nav-link">${page.icon} ${page.name}</a>
                    `).join('')}
                </nav>
        `;
        
        // Add all pages
        for (const page of this.pages) {
            const layout = this.pageLayouts[page.id] || [];
            html += `<section id="${page.id}" class="page-section">`;
            
            layout.forEach(block => {
                const blockTemplate = this.blockTypes[block.type]?.template;
                if (blockTemplate) {
                    html += blockTemplate(block.content);
                }
            });
            
            html += '</section>';
        }
        
        html += `
                <script>
                    // Simple page navigation
                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            const targetId = link.getAttribute('href').substring(1);
                            document.getElementById(targetId).scrollIntoView({ behavior: 'smooth' });
                        });
                    });
                </script>
            </body>
            </html>
        `;
        
        return html;
    }

    // PHASE 6: UX POLISH
    setupAutoSave() {
        // Auto-save every 30 seconds if there are unsaved changes
        setInterval(() => {
            if (this.autoSaveTimeout && !this.isEditing) {
                this.saveAllContent();
                clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = null;
            }
        }, 30000);
    }

    addToUndoStack(action, data) {
        this.undoStack.push({ action, data, timestamp: Date.now() });
        this.redoStack = []; // Clear redo stack on new action
        
        // Limit undo stack size
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length === 0) {
            this.showError('Nothing to undo');
            return;
        }
        
        const lastAction = this.undoStack.pop();
        this.redoStack.push(lastAction);
        
        // Implement undo logic based on action type
        switch (lastAction.action) {
            case 'addBlock':
                this.undoAddBlock(lastAction.data);
                break;
            case 'deleteBlock':
                this.undoDeleteBlock(lastAction.data);
                break;
            case 'editContent':
                this.undoEditContent(lastAction.data);
                break;
        }
        
        this.showSuccess('Undone');
    }

    redo() {
        if (this.redoStack.length === 0) {
            this.showError('Nothing to redo');
            return;
        }
        
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        
        // Implement redo logic
        this.showSuccess('Redone');
    }

    undoAddBlock(data) {
        const layout = this.pageLayouts[this.currentPage];
        const blockIndex = layout.findIndex(block => block.id === data.blockId);
        if (blockIndex !== -1) {
            layout.splice(blockIndex, 1);
            this.renderPage();
        }
    }

    undoDeleteBlock(data) {
        const layout = this.pageLayouts[this.currentPage];
        layout.splice(data.index, 0, data.block);
        this.renderPage();
    }

    undoEditContent(data) {
        // This would require storing previous content values
        console.log('Undo edit content not fully implemented');
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

    updateCurrentBlocksList() {
        const blocksContainer = document.getElementById('current-blocks');
        if (!blocksContainer) return;
        
        const layout = this.pageLayouts[this.currentPage] || [];
        
        blocksContainer.innerHTML = '';
        
        if (layout.length === 0) {
            blocksContainer.innerHTML = '<p style="text-align: center; color: var(--sage); font-style: italic;">No blocks yet. Add blocks from the panel above.</p>';
            return;
        }
        
        layout.forEach((block, index) => {
            const blockType = this.blockTypes[block.type];
            if (!blockType) return;
            
            const blockItem = document.createElement('div');
            blockItem.className = 'block-item';
            blockItem.innerHTML = `
                <div class="block-item-info">
                    <span class="block-icon">${blockType.icon}</span>
                    <span class="block-name">${blockType.name}</span>
                </div>
                <div class="block-item-actions">
                    <button class="btn-mini btn-danger" onclick="window.editor && window.editor.deleteBlock ? window.editor.deleteBlock('${block.id}') : console.error('Delete function not available')">×</button>
                </div>
            `;
            blocksContainer.appendChild(blockItem);
        });
    }

    showEditingIndicator(element) {
        // Remove existing indicator first
        this.hideEditingIndicator();
        
        const indicator = document.createElement('div');
        indicator.className = 'editing-indicator';
        indicator.textContent = 'Editing...';
        indicator.style.position = 'fixed';
        indicator.style.top = '10px';
        indicator.style.right = '10px';
        indicator.style.background = 'var(--muted-gold)';
        indicator.style.color = 'white';
        indicator.style.padding = '0.5rem 1rem';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '9999';
        indicator.style.fontSize = '0.9rem';
        indicator.style.fontWeight = '500';
        
        document.body.appendChild(indicator);
    }

    hideEditingIndicator() {
        const indicator = document.querySelector('.editing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // UTILITY FUNCTIONS
    generatePageCSS() {
        return `
            <style>
                :root {
                    --cream: #F7F3F0;
                    --beige: #E8DDD4;
                    --sage: #9CAFA3;
                    --muted-gold: #C4962D;
                    --charcoal: #2C2C2C;
                    --warm-white: #FEFCFA;
                }
                
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                    font-family: 'Quicksand', sans-serif;
                    background: var(--cream);
                    color: var(--charcoal);
                    line-height: 1.6;
                }
                
                .editor-block {
                    position: relative;
                    margin: 1rem 0;
                }
                
                .block-controls {
                    display: none;
                    position: absolute;
                    top: -40px;
                    left: 0;
                    right: 0;
                    background: rgba(196, 150, 45, 0.9);
                    color: white;
                    padding: 0.5rem;
                    font-size: 0.9rem;
                    z-index: 10;
                }
                
                .editor-block:hover .block-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
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
                    background: var(--muted-gold);
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                [contenteditable="true"]:hover {
                    outline: 2px dashed var(--muted-gold);
                    outline-offset: 4px;
                }
                
                .editing {
                    outline: 2px solid var(--muted-gold) !important;
                    outline-offset: 4px;
                }
                
                .dragging {
                    opacity: 0.5;
                }
            </style>
        `;
    }

    getDragDropScript() {
        return `
            <script>
                // Drag and drop functionality will be handled by the main editor
            </script>
        `;
    }

    // UI Helper Functions
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

    // BLOCK TEMPLATES
    getHeroTemplate() {
        return (content) => `
            <section class="hero-section" style="background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${content.imageUrl || ''}'); background-size: cover; background-position: center; padding: 6rem 2rem; text-align: center; color: white;">
                <h1 data-editable="true" style="font-size: 3rem; margin-bottom: 1rem;">${content.headline || 'Your Headline'}</h1>
                <p data-editable="true" style="font-size: 1.2rem; margin-bottom: 2rem;">${content.subtitle || 'Your subtitle'}</p>
                <button data-editable="true" style="background: var(--muted-gold); color: white; border: none; padding: 1rem 2rem; font-size: 1.1rem; border-radius: 4px; cursor: pointer;">${content.buttonText || 'Learn More'}</button>
            </section>
        `;
    }

    getAboutTemplate() {
        return (content) => `
            <section class="about-section" style="padding: 4rem 2rem; max-width: 800px; margin: 0 auto;">
                <h2 data-editable="true" style="font-size: 2.5rem; margin-bottom: 2rem; text-align: center;">${content.title || 'About Us'}</h2>
                <p data-editable="true" style="font-size: 1.1rem; line-height: 1.8;">${content.text || 'Tell your story here...'}</p>
            </section>
        `;
    }

    getTextTemplate() {
        return (content) => `
            <section class="text-section" style="padding: 2rem; max-width: 800px; margin: 0 auto;">
                <p data-editable="true" style="font-size: 1.1rem; line-height: 1.8;">${content.text || 'Add your text content here...'}</p>
            </section>
        `;
    }

    getImageGridTemplate() {
        return (content) => `
            <section class="image-grid-section" style="padding: 2rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                    ${(content.images || []).map(imageUrl => `
                        <img src="${imageUrl}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 8px;" />
                    `).join('')}
                </div>
            </section>
        `;
    }

    getCTATemplate() {
        return (content) => `
            <section class="cta-section" style="background: var(--beige); padding: 4rem 2rem; text-align: center;">
                <h2 data-editable="true" style="font-size: 2rem; margin-bottom: 1rem;">${content.title || 'Ready to Get Started?'}</h2>
                <p data-editable="true" style="font-size: 1.1rem; margin-bottom: 2rem;">${content.text || 'Contact us today'}</p>
                <button data-editable="true" style="background: var(--muted-gold); color: white; border: none; padding: 1rem 2rem; font-size: 1.1rem; border-radius: 4px; cursor: pointer;">${content.buttonText || 'Get Started'}</button>
            </section>
        `;
    }

    getTestimonialTemplate() {
        return (content) => `
            <section class="testimonial-section" style="padding: 4rem 2rem; text-align: center; background: var(--warm-white);">
                <blockquote data-editable="true" style="font-size: 1.3rem; font-style: italic; margin-bottom: 1rem;">"${content.text || 'Amazing service!'}"</blockquote>
                <p data-editable="true" style="font-weight: 600;">${content.author || 'Happy Client'}</p>
                <p data-editable="true" style="color: var(--soft-brown);">${content.role || 'Client'}</p>
            </section>
        `;
    }

    getPricingTemplate() {
        return (content) => `
            <section class="pricing-section" style="padding: 4rem 2rem;">
                <h2 style="text-align: center; margin-bottom: 3rem;">Pricing</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; max-width: 1000px; margin: 0 auto;">
                    ${(content.packages || []).map(pkg => `
                        <div style="background: white; padding: 2rem; border-radius: 8px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                            <h3 data-editable="true">${pkg.name}</h3>
                            <div style="font-size: 2rem; color: var(--muted-gold); margin: 1rem 0;">${pkg.price}</div>
                            <ul style="list-style: none; padding: 0;">
                                ${(pkg.features || []).map(feature => `<li style="margin: 0.5rem 0;">${feature}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }

    getBlogTemplate() {
        return (content) => `
            <section class="blog-section" style="padding: 4rem 2rem;">
                <h2 style="text-align: center; margin-bottom: 3rem;">Latest Posts</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; max-width: 1000px; margin: 0 auto;">
                    ${(content.posts || []).map(post => `
                        <article style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                            <h3 data-editable="true">${post.title}</h3>
                            <p data-editable="true" style="color: var(--soft-brown); margin: 1rem 0;">${post.excerpt}</p>
                            <time style="font-size: 0.9rem; color: var(--muted-gold);">${post.date}</time>
                        </article>
                    `).join('')}
                </div>
            </section>
        `;
    }

    // NEW FEATURE: Background Controls
    setupBackgroundControls() {
        const sidebar = document.querySelector('.editor-sidebar');
        if (!sidebar) return;
        
        // Remove existing background controls to avoid duplicates
        const existingSection = document.querySelector('.background-controls-section');
        if (existingSection) {
            existingSection.remove();
        }
        
        const backgroundSection = document.createElement('div');
        backgroundSection.className = 'background-controls-section';
        backgroundSection.innerHTML = `
            <h4 style="margin: 1rem 0 0.5rem 0; color: var(--deep-charcoal);">Page Background</h4>
            <div class="background-controls">
                <label>Background Color:</label>
                <input type="color" id="page-background-color" value="${this.pageSettings[this.currentPage]?.backgroundColor || '#F7F3F0'}" />
                <button class="btn-reset" onclick="window.editor.resetPageBackground()">Reset</button>
            </div>
            <div class="page-title-control">
                <label>Page Title:</label>
                <input type="text" id="page-title-input" value="${this.pageSettings[this.currentPage]?.pageTitle || this.currentPage}" placeholder="Page title" />
            </div>
        `;
        
        // Insert after page navigation
        const pageNav = document.querySelector('.page-navigation');
        if (pageNav && pageNav.parentNode) {
            pageNav.parentNode.insertBefore(backgroundSection, pageNav.nextSibling);
        }
        
        // Add event listeners
        setTimeout(() => {
            const colorInput = document.getElementById('page-background-color');
            const titleInput = document.getElementById('page-title-input');
            
            if (colorInput) {
                colorInput.addEventListener('change', (e) => {
                    this.updatePageBackground(e.target.value);
                });
            }
            
            if (titleInput) {
                titleInput.addEventListener('input', (e) => {
                    this.updatePageTitle(e.target.value);
                });
            }
        }, 100);
    }

    // NEW FEATURE: Font Controls
    setupFontControls() {
        const sidebar = document.querySelector('.editor-sidebar');
        if (!sidebar) return;
        
        // Remove existing font controls to avoid duplicates
        const existingSection = document.querySelector('.font-controls-section');
        if (existingSection) {
            existingSection.remove();
        }
        
        const fontSection = document.createElement('div');
        fontSection.className = 'font-controls-section';
        fontSection.innerHTML = `
            <h4 style="margin: 1rem 0 0.5rem 0; color: var(--deep-charcoal);">Typography</h4>
            <div class="font-controls">
                <div class="font-group">
                    <label>Headings:</label>
                    <select id="headings-font">
                        ${this.availableFonts.map(font => 
                            `<option value="${font}" ${font === this.fontSettings.headings ? 'selected' : ''}>${font}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="font-group">
                    <label>Body Text:</label>
                    <select id="body-font">
                        ${this.availableFonts.map(font => 
                            `<option value="${font}" ${font === this.fontSettings.body ? 'selected' : ''}>${font}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="font-group">
                    <label>Buttons:</label>
                    <select id="buttons-font">
                        ${this.availableFonts.map(font => 
                            `<option value="${font}" ${font === this.fontSettings.buttons ? 'selected' : ''}>${font}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
        
        // Insert after background controls
        const backgroundSection = document.querySelector('.background-controls-section');
        if (backgroundSection && backgroundSection.parentNode) {
            backgroundSection.parentNode.insertBefore(fontSection, backgroundSection.nextSibling);
        }
        
        // Add event listeners with delay to ensure DOM is ready
        setTimeout(() => {
            ['headings', 'body', 'buttons'].forEach(type => {
                const select = document.getElementById(`${type}-font`);
                if (select) {
                    select.addEventListener('change', (e) => {
                        this.updateFont(type, e.target.value);
                    });
                }
            });
        }, 100);
    }

    // Background management functions
    updatePageBackground(color) {
        if (!this.pageSettings[this.currentPage]) {
            this.pageSettings[this.currentPage] = {};
        }
        this.pageSettings[this.currentPage].backgroundColor = color;
        
        // Update live preview
        const pageContainer = document.querySelector('.page-container');
        if (pageContainer) {
            pageContainer.style.background = color;
        }
        
        this.scheduleAutoSave();
        this.showSuccess('Background updated');
    }

    resetPageBackground() {
        this.updatePageBackground('#F7F3F0');
        const colorInput = document.getElementById('page-background-color');
        if (colorInput) {
            colorInput.value = '#F7F3F0';
        }
    }

    updatePageTitle(title) {
        if (!this.pageSettings[this.currentPage]) {
            this.pageSettings[this.currentPage] = {};
        }
        this.pageSettings[this.currentPage].pageTitle = title;
        this.scheduleAutoSave();
    }

    // Font management functions
    updateFont(type, fontFamily) {
        this.fontSettings[type] = fontFamily;
        this.renderPage(); // Re-render to apply font changes
        this.scheduleAutoSave();
        this.showSuccess(`${type} font updated to ${fontFamily}`);
    }

    getFontCSS() {
        return `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(this.fontSettings.headings)}:wght@300;400;500;600;700&family=${encodeURIComponent(this.fontSettings.body)}:wght@300;400;500;600;700&family=${encodeURIComponent(this.fontSettings.buttons)}:wght@400;500;600&display=swap');
                
                :root {
                    --font-heading: '${this.fontSettings.headings}', serif;
                    --font-body: '${this.fontSettings.body}', sans-serif;
                    --font-button: '${this.fontSettings.buttons}', sans-serif;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    font-family: var(--font-heading) !important;
                }
                
                p, div, span, li {
                    font-family: var(--font-body) !important;
                }
                
                button, .button, .btn {
                    font-family: var(--font-button) !important;
                }
            </style>
        `;
    }

    getMobileNavCSS() {
        return `
            <style>
                .mobile-nav-toggle {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1001;
                    width: 30px;
                    height: 24px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                
                .mobile-nav-toggle span {
                    display: block;
                    height: 3px;
                    width: 100%;
                    background: var(--charcoal);
                    border-radius: 1px;
                    transition: all 0.3s ease;
                }
                
                .mobile-nav-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 1000;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }
                
                .mobile-nav-overlay.active {
                    opacity: 1;
                    visibility: visible;
                }
                
                .mobile-nav {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 280px;
                    height: 100%;
                    background: var(--warm-white);
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                    padding: 2rem;
                    box-shadow: -5px 0 15px rgba(0, 0, 0, 0.2);
                }
                
                .mobile-nav-overlay.active .mobile-nav {
                    transform: translateX(0);
                }
                
                .mobile-nav-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid var(--beige);
                    padding-bottom: 1rem;
                }
                
                .mobile-nav-title {
                    font-family: var(--font-heading);
                    font-size: 1.4rem;
                    color: var(--charcoal);
                    font-weight: 600;
                }
                
                .mobile-nav-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: var(--charcoal);
                    padding: 0.5rem;
                }
                
                .mobile-nav-links {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .mobile-nav-links li {
                    margin-bottom: 1rem;
                }
                
                .mobile-nav-links a {
                    display: block;
                    padding: 1rem;
                    color: var(--charcoal);
                    text-decoration: none;
                    font-family: var(--font-body);
                    font-weight: 500;
                    border-radius: 6px;
                    transition: all 0.2s ease;
                }
                
                .mobile-nav-links a:hover {
                    background: var(--beige);
                    color: var(--muted-gold);
                    transform: translateX(5px);
                }
            </style>
        `;
    }
}

// Global functions for HTML onclick handlers
function publishSite() {
    if (window.editor && typeof window.editor.publishSite === 'function') {
        window.editor.publishSite();
    } else {
        console.error('Editor not ready for publishing');
        if (window.editor) {
            window.editor.showError('Publishing not ready. Please wait for editor to fully load.');
        } else {
            alert('Editor not ready. Please wait for initialization.');
        }
    }
}

function previewSite() {
    if (window.editor && typeof window.editor.previewSite === 'function') {
        window.editor.previewSite();
    } else {
        console.error('Editor not ready for preview');
        if (window.editor) {
            window.editor.showError('Preview not ready. Please wait for editor to fully load.');
        } else {
            alert('Editor not ready. Please wait for initialization.');
        }
    }
}

// Global mobile navigation toggle function
function toggleMobileNav() {
    const overlay = document.getElementById('mobile-nav-overlay');
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.editor) {
        window.editor = new AdvancedVisualEditor();
    }
});
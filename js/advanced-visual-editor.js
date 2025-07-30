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
                template: this.getCtaTemplate()
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
        
        // Initialize luxury components early
        this.initializeLuxuryComponents();
        
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
        this.setupLuxuryComponents();
        this.setupBlockPanel();
        this.setupBackgroundControls();
        this.setupFontControls();
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
            
            // Check if this is a custom page (not one of the default pages)
            const isCustomPage = !['home', 'about', 'portfolio', 'contact'].includes(page.id);
            
            pageItem.innerHTML = `
                <span class="page-icon">${page.icon}</span>
                <span class="page-name">${page.name}</span>
                <div class="page-status"></div>
                ${isCustomPage ? '<button class="page-delete-btn" onclick="event.stopPropagation(); window.editor.showDeletePageModal(\'' + page.id + '\')" title="Delete Page">×</button>' : ''}
            `;
            
            pageItem.addEventListener('click', () => this.switchPage(page.id));
            pageNav.appendChild(pageItem);
        });
        
        // Add "Add Page" button
        const addPageButton = document.createElement('div');
        addPageButton.className = 'page-nav-item add-page-btn';
        addPageButton.innerHTML = `
            <span class="page-icon">➕</span>
            <span class="page-name">Add Page</span>
            <div class="page-status"></div>
        `;
        addPageButton.addEventListener('click', () => this.showAddPageModal());
        pageNav.appendChild(addPageButton);
    }

    setupThemeSelector() {
        const themeDropdown = document.getElementById('theme-dropdown');
        if (!themeDropdown) {
            console.warn('Theme dropdown element not found');
            return;
        }

        // Clear existing options except the first placeholder
        themeDropdown.innerHTML = '<option value="">Select a theme...</option>';
        
        if (Object.keys(this.themes).length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No themes available';
            option.disabled = true;
            themeDropdown.appendChild(option);
            return;
        }
        
        Object.entries(this.themes).forEach(([key, theme]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${theme.name} - ${theme.category}`;
            if (key === this.currentTheme) {
                option.selected = true;
            }
            themeDropdown.appendChild(option);
        });
        
        // Add event listener for theme changes
        themeDropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                this.changeTheme(e.target.value);
            }
        });
        
        console.log(`✅ Loaded ${Object.keys(this.themes).length} themes in dropdown`);
    }

    setupLuxuryComponents() {
        const luxuryContainer = document.getElementById('luxury-components');
        if (!luxuryContainer) {
            console.warn('Luxury components container not found');
            return;
        }

        // Initialize luxury components if not already done
        if (!this.luxuryComponents) {
            this.initializeLuxuryComponents();
        }

        // Create luxury components title
        const title = document.createElement('h3');
        title.textContent = '💎 Luxury Design Components';
        luxuryContainer.innerHTML = '';
        luxuryContainer.appendChild(title);

        // Create component grid
        const componentGrid = document.createElement('div');
        componentGrid.className = 'luxury-component-grid';
        
        Object.entries(this.luxuryComponents).forEach(([key, component]) => {
            const card = document.createElement('div');
            card.className = 'luxury-component-card';
            card.dataset.component = key;
            
            card.innerHTML = `
                <div class="component-icon">${component.icon}</div>
                <div class="component-name">${component.name}</div>
                <div class="component-description">${component.description}</div>
                <div class="component-category">${component.category}</div>
            `;
            
            card.addEventListener('click', () => {
                this.addLuxuryComponent(key);
            });
            
            componentGrid.appendChild(card);
        });
        
        luxuryContainer.appendChild(componentGrid);
        
        console.log(`✅ Loaded ${Object.keys(this.luxuryComponents).length} luxury components`);
    }

    initializePrebuiltTemplates() {
        // Remove all prebuilt templates - user wants ground-up luxury building capability
        this.prebuiltTemplates = {};
    }

    initializeLuxuryComponents() {
        // Define luxury design components inspired by high-end photography websites
        this.luxuryComponents = {
            'massive-hero': {
                name: 'Massive Hero Text',
                icon: '🎭',
                description: 'Full-screen hero with massive typography like luxury photography sites',
                category: 'hero',
                template: {
                    type: 'hero',
                    content: {
                        title: 'Ready to Feel GREAT in your Own Skin?',
                        subtitle: 'Start Your Self-Love Journey',
                        buttonText: 'START MY TRANSFORMATION',
                        layout: 'massive-text',
                        image: 'https://images.unsplash.com/photo-1494790108755-2616c78c1ff1?w=1200'
                    }
                }
            },
            'transformational-messaging': {
                name: 'Transformational Experience',
                icon: '✨',
                description: 'Emotional transformation messaging with personal stories',
                category: 'content',
                template: {
                    type: 'text',
                    content: {
                        title: 'What in the world is this experience?',
                        text: 'Can a photo shoot really change your life? What you see in these photos is women CHOOSING TO CELEBRATE THEMSELVES. This luxury experience allows them to celebrate and LOVE their body, JUST as it is NOW — EVEN if they HAVEN\'T hit that \'magic\' number on the scale.',
                        layout: 'emotional-story'
                    }
                }
            },
            'award-credentials': {
                name: 'Award-Winning Positioning',
                icon: '🏆',
                description: 'Professional credentials and award mentions',
                category: 'credibility',
                template: {
                    type: 'credentials',
                    content: {
                        title: 'Award Winning Photographer',
                        awards: ['Portrait Masters Bronze Award Winner', '100+ Five-Star Google Reviews', 'Featured in Well+Good, SheKnows, refinery29'],
                        experience: '6+ Years Experience',
                        location: 'Servicing Your Area & Surrounding Regions'
                    }
                }
            },
            'destination-luxury': {
                name: 'Destination Luxury',
                icon: '🌍',
                description: 'World-class destination positioning',
                category: 'positioning',
                template: {
                    type: 'destination',
                    content: {
                        title: 'World Destination Photographer',
                        subtitle: 'Worldwide luxury photography at destinations across the globe',
                        locations: ['United States', 'Canada', 'Australia', 'Europe', 'Asia'],
                        specialties: ['Destination Weddings', 'Luxury Portraits', 'Editorial Sessions']
                    }
                }
            },
            'heirloom-products': {
                name: 'Heirloom Products',
                icon: '💎',
                description: 'Luxury product offerings with legacy messaging',
                category: 'products',
                template: {
                    type: 'products',
                    content: {
                        title: 'Your legacy is meant to last...',
                        subtitle: 'Heirloom quality products designed to preserve your memories for generations',
                        products: [
                            { name: 'Heirloom Albums', description: 'Museum-quality albums with archival materials' },
                            { name: 'Wall Art Collection', description: 'Canvas, metal, and acrylic masterpieces' },
                            { name: 'Keepsake Boxes', description: 'Handcrafted memory preservation' }
                        ]
                    }
                }
            },
            'full-width-gallery': {
                name: 'Full-Width Gallery',
                icon: '🖼️',
                description: 'Sophisticated full-width image showcases',
                category: 'gallery',
                template: {
                    type: 'gallery',
                    content: {
                        title: 'Portfolio',
                        layout: 'full-width-masonry',
                        images: [
                            'https://images.unsplash.com/photo-1494790108755-2616c78c1ff1?w=600',
                            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
                            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600'
                        ]
                    }
                }
            },
            'luxury-pricing': {
                name: 'Luxury Pricing',
                icon: '💰',
                description: 'High-end pricing with value positioning',
                category: 'pricing',
                template: {
                    type: 'pricing',
                    content: {
                        title: 'Investment Packages',
                        subtitle: 'Creating heirloom memories deserves exceptional artistry',
                        plans: [
                            {
                                name: 'Signature Experience',
                                price: '$2,500',
                                features: ['2-Hour Session', 'Professional Hair & Makeup', '25+ Edited Images', 'Online Gallery']
                            },
                            {
                                name: 'Luxury Collection', 
                                price: '$4,500',
                                features: ['4-Hour Session', 'Multiple Locations', 'Full Hair & Makeup Team', '50+ Edited Images', 'Heirloom Album']
                            }
                        ]
                    }
                }
            },
            'service-area-focus': {
                name: 'Service Area Focus',
                icon: '📍',
                description: 'Local luxury market positioning',
                category: 'location',
                template: {
                    type: 'service-area',
                    content: {
                        title: 'Luxury Photography in Your Area',
                        areas: ['Main City', 'Suburb A', 'Suburb B', 'Luxury District', 'Historic Area', 'Waterfront'],
                        description: 'Serving the most discerning clients across your luxury market'
                    }
                }
            }
        };

        console.log(`✅ Loaded ${Object.keys(this.luxuryComponents).length} luxury design components`);
    }

    async applyPrebuiltTemplate(templateKey) {
        // This method is now deprecated - templates have been removed
        this.showError('Templates have been removed. Use luxury design components instead.');
        return;
    }



    addLuxuryComponent(componentKey) {
        const component = this.luxuryComponents[componentKey];
        if (!component) {
            console.error('Component not found:', componentKey);
            return;
        }

        const currentPage = this.currentPage;
        if (!this.pageLayouts[currentPage]) {
            this.pageLayouts[currentPage] = [];
        }

        // Add the luxury component as a new block
        const newBlock = {
            id: 'block_' + Date.now(),
            ...component.template
        };

        this.pageLayouts[currentPage].push(newBlock);
        
        // Update preview immediately
        this.updatePreview();
        
        // Save changes
        this.saveToStorage();
        
        this.showNotification(`Added ${component.name} component!`, 'success');
        
        // Trigger celebration for major components
        if (['massive-hero', 'transformational-messaging', 'award-credentials'].includes(componentKey)) {
            this.celebration();
        }
    }

    // Add missing utility functions
    updatePreview() {
        // Simple preview update - just refresh the iframe content
        const iframe = document.getElementById('preview-frame');
        if (iframe) {
            // Trigger a refresh of the preview content
            this.loadCurrentPage();
        }
    }

    saveToStorage() {
        // Save current state to localStorage as backup
        try {
            const editorState = {
                currentPage: this.currentPage,
                currentTheme: this.currentTheme,
                pageLayouts: this.pageLayouts,
                pageSettings: this.pageSettings,
                fontSettings: this.fontSettings
            };
            localStorage.setItem('visualEditorState', JSON.stringify(editorState));
            console.log('💾 Saved to localStorage');
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Try to use existing notification system if available
        if (typeof this.showSuccess === 'function' && type === 'success') {
            this.showSuccess(message);
        } else if (typeof this.showError === 'function' && type === 'error') {
            this.showError(message);
        }
    }

    celebration() {
        // Simple celebration - could be enhanced with confetti
        console.log('🎉 Celebration triggered!');
        
        // Try to use existing celebration system if available
        if (typeof triggerCelebration === 'function') {
            triggerCelebration('component_added', 'Luxury Component');
        }
    }

    // Initialize with luxury component system
    async initializeSystem() {
        await this.init();
    }
}

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
        
        // Block types replaced by luxury components - keeping minimal for compatibility
        this.blockTypes = {};
        
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
            await this.loadUserContentAndSettings();
            
            // Setup all UI components
            this.setupUI();
            
            // Load initial theme and page
            await this.loadCurrentPage();
            
            // Setup real-time auto-save (if exists)
            if (typeof this.setupAutoSave === 'function') {
                this.setupAutoSave();
            }
            
            console.log('✅ Advanced Visual Editor initialized successfully');
            this.showNotification('Editor ready - click any text or image to edit!', 'success');
            
        } catch (error) {
            console.error('❌ Failed to initialize editor:', error);
            console.error('Error details:', error.message, error.stack);
            this.showNotification('Failed to initialize editor', 'error');
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
                this.showNotification('Firebase connected', 'success');
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
        this.setupPrebuiltTemplates();
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

    setupPrebuiltTemplates() {
        // Setup prebuilt templates dropdown
        const templateDropdown = document.getElementById('template-dropdown');
        if (!templateDropdown) {
            console.log('⚠️ Template dropdown not found');
            return;
        }

        // Initialize prebuilt templates if not already done
        if (!this.prebuiltTemplates) {
            console.log('📦 Initializing prebuilt templates...');
            this.initializePrebuiltTemplates();
        }

        console.log(`🏗️ Populating template dropdown with ${Object.keys(this.prebuiltTemplates).length} templates`);

        // Clear existing options (except first one)
        templateDropdown.innerHTML = '<option value="">Choose a website template...</option>';
        
        // Add prebuilt templates to dropdown
        Object.entries(this.prebuiltTemplates).forEach(([key, template]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${template.name} - ${template.category}`;
            templateDropdown.appendChild(option);
        });

        // Add event listener for template selection
        templateDropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                const templateKey = e.target.value;
                const template = this.prebuiltTemplates[templateKey];
                console.log(`🏗️ Loading prebuilt template: ${template.name}`);
                this.loadPrebuiltTemplate(templateKey);
                
                // Reset dropdown
                e.target.value = '';
            }
        });
        
        console.log(`✅ Successfully populated template dropdown with ${Object.keys(this.prebuiltTemplates).length} templates`);
    }

    setupLuxuryComponents() {
        // Setup luxury components dropdown
        const luxuryDropdown = document.getElementById('luxury-dropdown');
        if (!luxuryDropdown) {
            console.log('⚠️ Luxury dropdown not found');
            return;
        }

        // Initialize luxury components if not already done
        if (!this.luxuryComponents) {
            console.log('📦 Initializing luxury components...');
            this.initializeLuxuryComponents();
        }

        console.log(`🎨 Populating luxury dropdown with ${Object.keys(this.luxuryComponents).length} components`);

        // Clear existing options (except first one)
        luxuryDropdown.innerHTML = '<option value="">Add luxury component...</option>';
        
        // Add luxury components to dropdown
        Object.entries(this.luxuryComponents).forEach(([key, component]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${component.icon} ${component.name}`;
            luxuryDropdown.appendChild(option);
        });

        // Add event listener for dropdown selection
        luxuryDropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                const componentKey = e.target.value;
                const component = this.luxuryComponents[componentKey];
                console.log(`🚀 Adding luxury component: ${component.name}`);
                this.addLuxuryComponent(componentKey);
                
                // Reset dropdown
                e.target.value = '';
            }
        });
        
        console.log(`✅ Successfully populated luxury dropdown with ${Object.keys(this.luxuryComponents).length} components`);
    }

    initializePrebuiltTemplates() {
        // Define prebuilt website templates
        this.prebuiltTemplates = {
            'luxury-portrait': {
                name: 'Luxury Portrait Studio',
                description: 'High-end portrait photography website with elegant design',
                category: 'portrait',
                pages: {
                    home: {
                        title: 'Luxury Portrait Studio',
                        sections: [
                            {
                                type: 'hero',
                                content: {
                                    title: 'Capturing Your Most Beautiful Self',
                                    subtitle: 'Professional Portrait Photography',
                                    buttonText: 'Book Your Session',
                                    backgroundImage: 'https://images.unsplash.com/photo-1554844013-894a9d3f2e13?w=1200'
                                }
                            },
                            {
                                type: 'about',
                                content: {
                                    title: 'Award-Winning Photography',
                                    text: 'With over 10 years of experience, we specialize in creating stunning portraits that capture your unique personality and style.',
                                    image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600'
                                }
                            }
                        ]
                    }
                }
            },
            'wedding-photography': {
                name: 'Wedding Photography Studio',
                description: 'Romantic wedding photography website template',
                category: 'wedding',
                pages: {
                    home: {
                        title: 'Wedding Photography',
                        sections: [
                            {
                                type: 'hero',
                                content: {
                                    title: 'Your Love Story Beautifully Told',
                                    subtitle: 'Wedding Photography & Cinematography',
                                    buttonText: 'View Our Work',
                                    backgroundImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200'
                                }
                            }
                        ]
                    }
                }
            },
            'fashion-photography': {
                name: 'Fashion Photography',
                description: 'Modern fashion photography portfolio',
                category: 'fashion',
                pages: {
                    home: {
                        title: 'Fashion Photography',
                        sections: [
                            {
                                type: 'hero',
                                content: {
                                    title: 'Fashion Forward Photography',
                                    subtitle: 'Editorial & Commercial Fashion',
                                    buttonText: 'See Portfolio',
                                    backgroundImage: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200'
                                }
                            }
                        ]
                    }
                }
            },
            'newborn-photography': {
                name: 'Newborn Photography',
                description: 'Gentle newborn and family photography',
                category: 'family',
                pages: {
                    home: {
                        title: 'Newborn Photography',
                        sections: [
                            {
                                type: 'hero',
                                content: {
                                    title: 'Precious First Moments',
                                    subtitle: 'Newborn & Maternity Photography',
                                    buttonText: 'Book Session',
                                    backgroundImage: 'https://images.unsplash.com/photo-1544726889-8cb8c9b7ee00?w=1200'
                                }
                            }
                        ]
                    }
                }
            },
            'landscape-photography': {
                name: 'Landscape Photography',
                description: 'Nature and landscape photography portfolio',
                category: 'landscape',
                pages: {
                    home: {
                        title: 'Landscape Photography',
                        sections: [
                            {
                                type: 'hero',
                                content: {
                                    title: 'Nature\'s Beauty Captured',
                                    subtitle: 'Landscape & Travel Photography',
                                    buttonText: 'Explore Gallery',
                                    backgroundImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200'
                                }
                            }
                        ]
                    }
                }
            }
        };
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
            console.error('❌ Component not found:', componentKey);
            return;
        }

        const currentPage = this.currentPage;
        if (!this.pageLayouts[currentPage]) {
            this.pageLayouts[currentPage] = [];
        }

        // Add the luxury component as a new block
        const newBlock = {
            id: 'luxury_' + Date.now(),
            type: component.template.type,
            content: { ...component.template.content },
            componentKey: componentKey
        };

        this.pageLayouts[currentPage].push(newBlock);
        console.log(`✅ Added ${component.name} to ${currentPage} page`);
        
        // Update the live preview with the new component
        this.updateLivePreviewWithComponent(newBlock);
        
        // Save changes to storage
        this.saveToStorage();
        
        this.showNotification(`Added ${component.name} component!`, 'success');
        
        // Trigger celebration for major components
        if (['massive-hero', 'transformational-messaging', 'award-credentials'].includes(componentKey)) {
            this.celebration();
        }
    }
    
    updateLivePreviewWithComponent(newBlock) {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) {
            console.warn('Preview frame not found');
            return;
        }
        
        // Generate HTML for the new component
        let componentHTML = '';
        const theme = this.themes[this.currentTheme] || this.themes['light-airy'];
        const themeStyles = this.getThemeStyles(theme);
        
        switch(newBlock.type) {
            case 'hero':
                componentHTML = `
                    <div style="${themeStyles.container}; padding: 60px 30px; text-align: center;">
                        <h1 style="${themeStyles.heading}; font-size: 3.5em; line-height: 1.1;">${newBlock.content.title}</h1>
                        <p style="${themeStyles.subtitle}; font-size: 1.4em; margin: 20px 0 30px;">${newBlock.content.subtitle}</p>
                        <button style="background: var(--muted-gold); color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer;">${newBlock.content.buttonText}</button>
                    </div>
                `;
                break;
            case 'text':
                componentHTML = `
                    <div style="${themeStyles.content}; margin: 30px 0;">
                        <h2 style="${themeStyles.heading}; font-size: 2.2em;">${newBlock.content.title}</h2>
                        <p style="${themeStyles.text}; font-size: 1.2em; line-height: 1.6;">${newBlock.content.text}</p>
                    </div>
                `;
                break;
            case 'credentials':
                componentHTML = `
                    <div style="${themeStyles.content}; margin: 30px 0; text-align: center;">
                        <h2 style="${themeStyles.heading}; font-size: 2.5em;">${newBlock.content.title}</h2>
                        <div style="margin: 20px 0;">
                            ${newBlock.content.awards.map(award => `<p style="${themeStyles.text}; margin: 8px 0;">🏆 ${award}</p>`).join('')}
                        </div>
                        <p style="${themeStyles.subtitle}; font-size: 1.3em; margin-top: 20px;">${newBlock.content.experience}</p>
                    </div>
                `;
                break;
            case 'products':
                componentHTML = `
                    <div style="${themeStyles.content}; margin: 30px 0; text-align: center;">
                        <h2 style="${themeStyles.heading}; font-size: 2.8em; margin-bottom: 30px;">${newBlock.content.title}</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                            ${newBlock.content.products ? newBlock.content.products.map(product => `
                                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
                                    <h3 style="${themeStyles.text}; font-size: 1.3em;">${product.name}</h3>
                                    <p style="${themeStyles.text};">${product.price}</p>
                                </div>
                            `).join('') : ''}
                        </div>
                    </div>
                `;
                break;
            default:
                componentHTML = `
                    <div style="${themeStyles.content}; margin: 30px 0; text-align: center;">
                        <h2 style="${themeStyles.heading};">New Component Added</h2>
                        <p style="${themeStyles.text};">Luxury component: ${newBlock.componentKey}</p>
                    </div>
                `;
        }
        
        // Append the new component to existing content
        const existingContent = previewFrame.innerHTML;
        previewFrame.innerHTML = existingContent + componentHTML;
        
        console.log(`🎨 Updated preview with ${newBlock.type} component`);
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

    async saveToStorage() {
        const editorState = {
            currentPage: this.currentPage,
            currentTheme: this.currentTheme,
            pageLayouts: this.pageLayouts,
            pageSettings: this.pageSettings,
            fontSettings: this.fontSettings,
            pages: this.pages,
            contentData: this.contentData,
            previewHTML: this.generatePreviewHTML()
        };

        try {
            if (this.firebaseInitialized) {
                // Save to Firebase if available
                const db = firebase.firestore();
                await db.collection('storefronts').doc(this.userId).set(editorState, { merge: true });
                console.log('💾 Saved to Firebase');
            } else {
                // Save to server database
                const response = await fetch('/api/storefront/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ siteData: editorState })
                });
                
                if (response.ok) {
                    console.log('💾 Saved to server database');
                } else {
                    throw new Error('Server save failed');
                }
            }
            
            // Save to localStorage as backup
            localStorage.setItem('visualEditorState', JSON.stringify(editorState));
            console.log('💾 State saved successfully');
            
        } catch (error) {
            console.error('❌ Failed to save:', error);
            // Still save to localStorage as fallback
            localStorage.setItem('visualEditorState', JSON.stringify(editorState));
            console.log('💾 Saved to localStorage fallback');
        }
    }
    
    generatePreviewHTML() {
        const theme = this.themes[this.currentTheme] || this.themes['light-airy'];
        const themeStyles = this.getThemeStyles(theme);
        const currentLayout = this.pageLayouts[this.currentPage] || [];
        
        let html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Photography Studio - ${this.currentPage}</title>
                <style>
                    body { margin: 0; padding: 0; font-family: ${themeStyles.container.includes('serif') ? '"Cormorant Garamond", serif' : '"Quicksand", sans-serif'}; }
                    .preview-container { ${themeStyles.container} }
                </style>
            </head>
            <body>
                <div class="preview-container">
        `;
        
        // Add all components from current page
        currentLayout.forEach(block => {
            switch(block.type) {
                case 'hero':
                    html += `
                        <div style="padding: 60px 30px; text-align: center;">
                            <h1 style="font-size: 3.5em; line-height: 1.1; margin-bottom: 20px;">${block.content.title}</h1>
                            <p style="font-size: 1.4em; margin: 20px 0 30px;">${block.content.subtitle}</p>
                            <button style="background: #C4962D; color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer;">${block.content.buttonText}</button>
                        </div>
                    `;
                    break;
                case 'text':
                    html += `
                        <div style="margin: 30px; padding: 20px;">
                            <h2 style="font-size: 2.2em; margin-bottom: 15px;">${block.content.title}</h2>
                            <p style="font-size: 1.2em; line-height: 1.6;">${block.content.text}</p>
                        </div>
                    `;
                    break;
                case 'credentials':
                    html += `
                        <div style="margin: 30px; padding: 20px; text-align: center;">
                            <h2 style="font-size: 2.5em; margin-bottom: 20px;">${block.content.title}</h2>
                            <div style="margin: 20px 0;">
                                ${block.content.awards.map(award => `<p style="margin: 8px 0;">🏆 ${award}</p>`).join('')}
                            </div>
                            <p style="font-size: 1.3em; margin-top: 20px;">${block.content.experience}</p>
                        </div>
                    `;
                    break;
                default:
                    html += `
                        <div style="margin: 30px; padding: 20px; text-align: center;">
                            <h2>Component: ${block.componentKey || block.type}</h2>
                        </div>
                    `;
            }
        });
        
        html += `
                </div>
            </body>
            </html>
        `;
        
        return html;
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

    // Add missing functions for proper initialization
    async loadUserContentAndSettings() {
        console.log('📖 Loading user content and settings...');
        
        try {
            // Try to load from localStorage first
            const savedState = localStorage.getItem('visualEditorState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.currentPage = state.currentPage || 'home';
                this.currentTheme = state.currentTheme || 'light-airy';
                this.pageLayouts = state.pageLayouts || this.pageLayouts;
                this.pageSettings = state.pageSettings || this.pageSettings;
                this.fontSettings = state.fontSettings || this.fontSettings;
                console.log('✅ Loaded state from localStorage');
            }
        } catch (error) {
            console.log('⚠️ No saved state found, using defaults');
        }
    }

    async loadCurrentPage() {
        console.log(`📄 Loading current page: ${this.currentPage}`);
        
        // Create basic page content if none exists
        if (!this.pageLayouts[this.currentPage] || this.pageLayouts[this.currentPage].length === 0) {
            this.pageLayouts[this.currentPage] = [
                {
                    id: 'default_hero',
                    type: 'hero',
                    content: {
                        title: 'Welcome to Your Photography Studio',
                        subtitle: 'Capturing life\'s precious moments',
                        buttonText: 'View Portfolio'
                    }
                }
            ];
        }
        
        this.updateLivePreview();
    }

    updateLivePreview() {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) {
            console.warn('Preview frame not found');
            return;
        }
        
        // Get current theme styling
        const theme = this.themes[this.currentTheme] || this.themes['light-airy'];
        let themeStyles = this.getThemeStyles(theme);
        
        // Get current page info
        const currentPageInfo = this.pages.find(p => p.id === this.currentPage);
        const pageName = currentPageInfo ? currentPageInfo.name : 'Page';
        
        // Create enhanced preview content with theme styling
        const currentLayout = this.pageLayouts[this.currentPage] || [];
        let previewHTML = `
            <div style="${themeStyles.container}">
                <div style="${themeStyles.header}">
                    <h1 style="${themeStyles.heading}">${pageName} - Photography Studio</h1>
                    <p style="${themeStyles.subtitle}">Current Theme: ${theme.name}</p>
                </div>
                <div style="${themeStyles.content}">
                    <p style="${themeStyles.text}">Live preview - click to add luxury components</p>
                    <div style="${themeStyles.statusBar}">
                        ${currentLayout.length} components added to ${pageName} page
                    </div>
                </div>
            </div>
        `;
        
        previewFrame.innerHTML = previewHTML;
    }
    
    getThemeStyles(theme) {
        switch(theme.category) {
            case 'elegant':
                return {
                    container: 'min-height: 400px; padding: 30px; background: linear-gradient(135deg, #F7F3F0, #FEFDFB); font-family: "Cormorant Garamond", serif;',
                    header: 'margin-bottom: 20px; text-align: center;',
                    heading: 'color: #C4962D; font-size: 2.5em; margin-bottom: 10px; font-weight: 400;',
                    subtitle: 'color: #8B7355; font-size: 1.1em; font-style: italic;',
                    content: 'padding: 20px; background: rgba(255,255,255,0.3); border-radius: 8px;',
                    text: 'color: #2C2C2C; font-size: 1.2em; margin-bottom: 15px;',
                    statusBar: 'color: #9CAF88; font-size: 0.9em; padding: 10px; background: rgba(156,175,163,0.1); border-radius: 4px;'
                };
            case 'dramatic':
                return {
                    container: 'min-height: 400px; padding: 30px; background: linear-gradient(135deg, #1a1a1a, #2C2C2C); font-family: "Playfair Display", serif;',
                    header: 'margin-bottom: 20px; text-align: center;',
                    heading: 'color: #C4962D; font-size: 2.5em; margin-bottom: 10px; font-weight: 700;',
                    subtitle: 'color: #F7F3F0; font-size: 1.1em; font-style: italic;',
                    content: 'padding: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(196,150,45,0.3); border-radius: 8px;',
                    text: 'color: #F7F3F0; font-size: 1.2em; margin-bottom: 15px;',
                    statusBar: 'color: #C4962D; font-size: 0.9em; padding: 10px; background: rgba(196,150,45,0.1); border-radius: 4px;'
                };
            case 'natural':
                return {
                    container: 'min-height: 400px; padding: 30px; background: linear-gradient(135deg, #8B7355, #9CAF88); font-family: "Lora", serif;',
                    header: 'margin-bottom: 20px; text-align: center;',
                    heading: 'color: #FEFDFB; font-size: 2.5em; margin-bottom: 10px; font-weight: 600; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);',
                    subtitle: 'color: #F7F3F0; font-size: 1.1em; font-style: italic;',
                    content: 'padding: 20px; background: rgba(255,255,255,0.2); border-radius: 8px;',
                    text: 'color: #FEFDFB; font-size: 1.2em; margin-bottom: 15px;',
                    statusBar: 'color: #FEFDFB; font-size: 0.9em; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 4px;'
                };
            case 'minimal':
                return {
                    container: 'min-height: 400px; padding: 40px; background: #FEFDFB; font-family: "Quicksand", sans-serif;',
                    header: 'margin-bottom: 30px; text-align: left; border-bottom: 2px solid #E8DDD4; padding-bottom: 15px;',
                    heading: 'color: #2C2C2C; font-size: 2.2em; margin-bottom: 5px; font-weight: 300;',
                    subtitle: 'color: #8B7355; font-size: 1em; font-weight: 400;',
                    content: 'padding: 0;',
                    text: 'color: #2C2C2C; font-size: 1.1em; margin-bottom: 20px; font-weight: 400;',
                    statusBar: 'color: #9CAF88; font-size: 0.9em; padding: 15px; background: #F7F3F0; border-left: 4px solid #C4962D;'
                };
            case 'modern':
                return {
                    container: 'min-height: 400px; padding: 25px; background: linear-gradient(135deg, #2C2C2C, #C4962D); font-family: "Montserrat", sans-serif;',
                    header: 'margin-bottom: 25px; text-align: center;',
                    heading: 'color: #FEFDFB; font-size: 2.8em; margin-bottom: 8px; font-weight: 700; letter-spacing: -1px;',
                    subtitle: 'color: #F7F3F0; font-size: 1em; font-weight: 400; text-transform: uppercase; letter-spacing: 2px;',
                    content: 'padding: 25px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px;',
                    text: 'color: #FEFDFB; font-size: 1.1em; margin-bottom: 20px; font-weight: 400;',
                    statusBar: 'color: #2C2C2C; font-size: 0.9em; padding: 12px; background: rgba(255,255,255,0.9); border-radius: 6px; font-weight: 600;'
                };
            default:
                return {
                    container: 'min-height: 400px; padding: 30px; background: #F7F3F0; font-family: "Quicksand", sans-serif;',
                    header: 'margin-bottom: 20px; text-align: center;',
                    heading: 'color: #C4962D; font-size: 2.5em; margin-bottom: 10px; font-weight: 600;',
                    subtitle: 'color: #8B7355; font-size: 1.1em;',
                    content: 'padding: 20px; background: rgba(255,255,255,0.5); border-radius: 8px;',
                    text: 'color: #2C2C2C; font-size: 1.2em; margin-bottom: 15px;',
                    statusBar: 'color: #9CAF88; font-size: 0.9em; padding: 10px; background: rgba(156,175,163,0.2); border-radius: 4px;'
                };
        }
    }

    // Theme change handler
    async changeTheme(themeKey) {
        console.log(`🎨 Changing theme to: ${themeKey}`);
        this.currentTheme = themeKey;
        
        const theme = this.themes[themeKey];
        if (!theme) {
            console.error(`❌ Theme not found: ${themeKey}`);
            return;
        }
        
        // Apply theme colors to the preview
        const previewFrame = document.getElementById('preview-frame');
        if (previewFrame) {
            // Apply theme-specific styling based on category
            let themeCSS = '';
            
            switch(theme.category) {
                case 'elegant':
                    themeCSS = `
                        background: linear-gradient(135deg, #F7F3F0, #FEFDFB);
                        color: #2C2C2C;
                        font-family: 'Cormorant Garamond', serif;
                    `;
                    break;
                case 'dramatic':
                    themeCSS = `
                        background: linear-gradient(135deg, #1a1a1a, #2C2C2C);
                        color: #F7F3F0;
                        font-family: 'Playfair Display', serif;
                    `;
                    break;
                case 'natural':
                    themeCSS = `
                        background: linear-gradient(135deg, #8B7355, #9CAF88);
                        color: #FEFDFB;
                        font-family: 'Lora', serif;
                    `;
                    break;
                case 'minimal':
                    themeCSS = `
                        background: #FEFDFB;
                        color: #2C2C2C;
                        font-family: 'Quicksand', sans-serif;
                    `;
                    break;
                case 'modern':
                    themeCSS = `
                        background: linear-gradient(135deg, #2C2C2C, #C4962D);
                        color: #FEFDFB;
                        font-family: 'Montserrat', sans-serif;
                    `;
                    break;
                default:
                    themeCSS = `
                        background: #F7F3F0;
                        color: #2C2C2C;
                        font-family: 'Quicksand', sans-serif;
                    `;
            }
            
            // Apply the theme styling
            previewFrame.style.cssText += themeCSS;
            
            // Update all elements in preview with theme styling
            const allElements = previewFrame.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') {
                    el.style.fontFamily = themeCSS.includes('serif') ? 
                        themeCSS.match(/font-family: '([^']+)'/)[1] : 
                        "'Cormorant Garamond', serif";
                }
            });
        }
        
        this.showNotification(`Theme changed to ${theme.name}`, 'success');
        
        // Update the preview
        this.updateLivePreview();
        
        // Save the changes
        await this.saveToStorage();
    }

    // Hero template getter (to fix the missing function error)
    getHeroTemplate() {
        return {
            id: 'hero_section',
            type: 'hero',
            content: {
                title: 'Capturing Life\'s Precious Moments',
                subtitle: 'Professional Photography Studio',
                buttonText: 'View Portfolio',
                backgroundImage: ''
            }
        };
    }

    // Save current state to storage
    async saveToStorage() {
        const previewFrame = document.getElementById('preview-frame');
        const previewHTML = previewFrame ? previewFrame.innerHTML : '';
        
        const data = {
            currentTheme: this.currentTheme,
            currentPage: this.currentPage,
            pageLayouts: this.pageLayouts,
            pageSettings: this.pageSettings,
            fontSettings: this.fontSettings,
            contentData: this.contentData,
            pages: this.pages,
            previewHTML: previewHTML
        };

        try {
            if (this.firebaseInitialized) {
                // Save to Firebase if available
                const db = firebase.firestore();
                await db.collection('storefronts').doc(this.userId).set(data, { merge: true });
                console.log('💾 Saved to Firebase');
            } else {
                // Save to server database
                const response = await fetch('/api/storefront/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ siteData: data })
                });
                
                if (response.ok) {
                    console.log('💾 Saved to server database');
                } else {
                    throw new Error('Server save failed');
                }
                
                // Also save to localStorage as backup
                localStorage.setItem(`storefront_${this.userId}`, JSON.stringify(data));
                console.log('💾 Saved to localStorage backup');
            }
        } catch (error) {
            console.error('❌ Save failed:', error);
            this.showNotification('Failed to save changes', 'error');
        }
    }

    // Show notification to user
    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Try to show notification in the UI if available
        if (typeof showMessage === 'function') {
            showMessage(message, type);
        }
    }

    // Setup methods that are referenced but missing
    setupBlockPanel() {
        // Basic setup for blocks panel - keeping minimal since using luxury components
        console.log('📦 Block panel setup completed');
    }

    setupBackgroundControls() {
        // Background control setup with event listeners
        const bgColor = document.getElementById('bg-color');
        const bgImage = document.getElementById('bg-image');
        
        if (bgColor) {
            bgColor.addEventListener('change', (e) => {
                this.updateBackgroundColor(e.target.value);
            });
        }
        
        if (bgImage) {
            bgImage.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.updateBackgroundImage(e.target.files[0]);
                }
            });
        }
        
        console.log('🎨 Background controls setup completed');
    }

    setupFontControls() {
        // Font control setup with event listeners
        const headingFont = document.getElementById('heading-font');
        const bodyFont = document.getElementById('body-font');
        
        if (headingFont) {
            headingFont.addEventListener('change', (e) => {
                this.updateFont('heading', e.target.value);
            });
        }
        
        if (bodyFont) {
            bodyFont.addEventListener('change', (e) => {
                this.updateFont('body', e.target.value);
            });
        }
        
        console.log('🔤 Font controls setup completed');
    }

    setupDeviceControls() {
        // Device preview controls
        const deviceButtons = document.querySelectorAll('.device-btn');
        deviceButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                deviceButtons.forEach(b => b.classList.remove('active'));
                // Add active to clicked button
                e.target.classList.add('active');
                
                const device = e.target.dataset.device;
                console.log(`📱 Switched to ${device} preview`);
                this.showNotification(`Switched to ${device} preview`, 'info');
            });
        });
        console.log('📱 Device controls setup completed');
    }

    setupKeyboardShortcuts() {
        // Keyboard shortcuts setup
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveToStorage();
                        break;
                    case 'z':
                        e.preventDefault();
                        // Undo functionality could be added here
                        break;
                }
            }
        });
        console.log('⌨️ Keyboard shortcuts setup completed');
    }

    makePreviewEditable() {
        // Make preview content editable
        const previewFrame = document.getElementById('preview-frame');
        if (previewFrame) {
            previewFrame.addEventListener('click', (e) => {
                this.handleElementEdit(e);
            });
        }
        
        // Setup element editing controls
        this.setupElementControls();
        
        console.log('✏️ Preview editing setup completed');
    }

    // Switch between pages
    async switchPage(pageId) {
        console.log(`📄 Switching to page: ${pageId}`);
        
        // Find the page name for better feedback
        const page = this.pages.find(p => p.id === pageId);
        const pageName = page ? page.name : pageId;
        
        this.currentPage = pageId;
        
        // Update active page indicator with visual feedback
        document.querySelectorAll('.page-nav-item').forEach(item => {
            item.classList.remove('active');
            item.style.background = '';
            item.style.color = '';
        });
        
        const activeItem = document.querySelector(`[data-page="${pageId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.style.background = 'var(--sage)';
            activeItem.style.color = 'var(--warm-white)';
            activeItem.style.fontWeight = '600';
        }
        
        // Load the page content and update preview
        await this.loadCurrentPage();
        this.updateLivePreview();
        
        // Clear any selected element when switching pages
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected-element');
            this.selectedElement = null;
        }
        
        // Update page title in preview if needed
        const previewFrame = document.getElementById('preview-frame');
        if (previewFrame && previewFrame.querySelector('h1')) {
            const heading = previewFrame.querySelector('h1');
            if (heading.textContent.includes('Photography Studio')) {
                heading.textContent = `${pageName} - Photography Studio`;
            }
        }
        
        this.showNotification(`Switched to ${pageName} page`, 'success');
        
        // Save the current page state
        await this.saveToStorage();
    }

    // Handle element editing when clicked in preview
    handleElementEdit(event) {
        const target = event.target;
        
        // Check if clicked element is editable (text, image, etc.)
        if (target.tagName === 'H1' || target.tagName === 'H2' || target.tagName === 'H3' || 
            target.tagName === 'P' || target.tagName === 'SPAN' || target.tagName === 'A') {
            
            this.selectElement(target);
            console.log('🖱️ Text element selected for editing');
            this.showNotification('Text element selected - use controls to edit', 'info');
        } else if (target.tagName === 'IMG') {
            this.selectElement(target);
            console.log('🖼️ Image element selected for editing');
            this.showNotification('Image element selected - use controls to edit', 'info');
        } else {
            console.log('🖱️ Preview clicked - no editable element');
            this.showNotification('Click on text or images to edit them', 'info');
        }
    }

    // Select an element for editing
    selectElement(element) {
        // Remove previous selection
        const previousSelected = document.querySelector('.selected-element');
        if (previousSelected) {
            previousSelected.classList.remove('selected-element');
        }

        // Add selection class
        element.classList.add('selected-element');
        this.selectedElement = element;

        // Update controls with element's current properties
        this.updateControlsFromElement(element);
    }

    // Update control panels based on selected element
    updateControlsFromElement(element) {
        const computedStyle = window.getComputedStyle(element);
        
        // Update text controls
        const textColor = document.getElementById('text-color');
        const textSize = document.getElementById('text-size');
        const textSizeValue = document.querySelector('#text-size + .slider-value');
        
        if (textColor) {
            textColor.value = this.rgbToHex(computedStyle.color) || '#2C2C2C';
        }
        
        if (textSize && textSizeValue) {
            const fontSize = parseInt(computedStyle.fontSize) || 16;
            textSize.value = fontSize;
            textSizeValue.textContent = fontSize + 'px';
        }

        // Update layout controls
        const padding = document.getElementById('element-padding');
        const paddingValue = document.querySelector('#element-padding + .slider-value');
        
        if (padding && paddingValue) {
            const paddingVal = parseInt(computedStyle.padding) || 20;
            padding.value = paddingVal;
            paddingValue.textContent = paddingVal + 'px';
        }
    }

    // Setup element editing controls
    setupElementControls() {
        // Text styling controls
        const textColor = document.getElementById('text-color');
        const textSize = document.getElementById('text-size');
        const alignButtons = document.querySelectorAll('.align-btn');
        const styleButtons = document.querySelectorAll('.style-btn');
        
        // Layout controls
        const padding = document.getElementById('element-padding');
        const margin = document.getElementById('element-margin');
        const borderRadius = document.getElementById('border-radius');

        // Text color control
        if (textColor) {
            textColor.addEventListener('change', (e) => {
                this.applyTextColor(e.target.value);
            });
        }

        // Text size control
        if (textSize) {
            textSize.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueSpan = document.querySelector('#text-size + .slider-value');
                if (valueSpan) valueSpan.textContent = value + 'px';
                this.applyTextSize(value);
            });
        }

        // Text alignment controls
        alignButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                alignButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.applyTextAlign(e.target.dataset.align);
            });
        });

        // Text style controls
        styleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.classList.toggle('active');
                this.applyTextStyle(e.target.dataset.style, e.target.classList.contains('active'));
            });
        });

        // Layout controls
        if (padding) {
            padding.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueSpan = document.querySelector('#element-padding + .slider-value');
                if (valueSpan) valueSpan.textContent = value + 'px';
                this.applyPadding(value);
            });
        }

        if (margin) {
            margin.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueSpan = document.querySelector('#element-margin + .slider-value');
                if (valueSpan) valueSpan.textContent = value + 'px';
                this.applyMargin(value);
            });
        }

        if (borderRadius) {
            borderRadius.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueSpan = document.querySelector('#border-radius + .slider-value');
                if (valueSpan) valueSpan.textContent = value + 'px';
                this.applyBorderRadius(value);
            });
        }
    }

    // Apply font changes
    updateFont(type, fontFamily) {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;

        const selector = type === 'heading' ? 'h1, h2, h3' : 'p, span, div';
        const elements = previewFrame.querySelectorAll(selector);
        
        elements.forEach(el => {
            el.style.fontFamily = fontFamily;
        });

        console.log(`🔤 Updated ${type} font to: ${fontFamily}`);
        this.showNotification(`${type} font updated`, 'success');
        this.saveToStorage();
    }

    // Apply background color
    updateBackgroundColor(color) {
        const previewFrame = document.getElementById('preview-frame');
        if (previewFrame) {
            previewFrame.style.backgroundColor = color;
            console.log(`🎨 Background color updated to: ${color}`);
            this.showNotification('Background color updated', 'success');
            this.saveToStorage();
        }
    }

    // Apply background image
    updateBackgroundImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewFrame = document.getElementById('preview-frame');
            if (previewFrame) {
                previewFrame.style.backgroundImage = `url('${e.target.result}')`;
                previewFrame.style.backgroundSize = 'cover';
                previewFrame.style.backgroundPosition = 'center';
                console.log('🎨 Background image updated');
                this.showNotification('Background image updated', 'success');
                this.saveToStorage();
            }
        };
        reader.readAsDataURL(file);
    }

    // Apply text color to selected element
    applyTextColor(color) {
        if (this.selectedElement) {
            this.selectedElement.style.color = color;
            this.showNotification('Text color updated', 'success');
            this.saveToStorage();
        }
    }

    // Apply text size to selected element
    applyTextSize(size) {
        if (this.selectedElement) {
            this.selectedElement.style.fontSize = size + 'px';
            this.showNotification('Text size updated', 'success');
            this.saveToStorage();
        }
    }

    // Apply text alignment to selected element
    applyTextAlign(align) {
        if (this.selectedElement) {
            this.selectedElement.style.textAlign = align;
            this.showNotification('Text alignment updated', 'success');
            this.saveToStorage();
        }
    }

    // Apply text style to selected element
    applyTextStyle(style, active) {
        if (this.selectedElement) {
            switch(style) {
                case 'bold':
                    this.selectedElement.style.fontWeight = active ? 'bold' : 'normal';
                    break;
                case 'italic':
                    this.selectedElement.style.fontStyle = active ? 'italic' : 'normal';
                    break;
                case 'underline':
                    this.selectedElement.style.textDecoration = active ? 'underline' : 'none';
                    break;
            }
            this.showNotification(`Text ${style} ${active ? 'applied' : 'removed'}`, 'success');
            this.saveToStorage();
        }
    }

    // Apply padding to selected element
    applyPadding(padding) {
        if (this.selectedElement) {
            this.selectedElement.style.padding = padding + 'px';
            this.showNotification('Padding updated', 'success');
            this.saveToStorage();
        }
    }

    // Apply margin to selected element
    applyMargin(margin) {
        if (this.selectedElement) {
            this.selectedElement.style.margin = margin + 'px';
            this.showNotification('Margin updated', 'success');
            this.saveToStorage();
        }
    }

    // Apply border radius to selected element
    applyBorderRadius(radius) {
        if (this.selectedElement) {
            this.selectedElement.style.borderRadius = radius + 'px';
            this.showNotification('Border radius updated', 'success');
            this.saveToStorage();
        }
    }

    // Helper function to convert RGB to Hex
    rgbToHex(rgb) {
        if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
        
        const result = rgb.match(/\d+/g);
        if (!result || result.length < 3) return '#000000';
        
        const hex = '#' + result.slice(0, 3).map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
        
        return hex;
    }

    // Reset current page to empty state
    resetCurrentPage() {
        const previewFrame = document.getElementById('preview-frame');
        if (previewFrame) {
            previewFrame.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--soft-brown);"><h2>Page Reset</h2><p>Add luxury components to build your page</p></div>';
            
            // Clear page data
            if (this.pageLayouts[this.currentPage]) {
                this.pageLayouts[this.currentPage] = [];
            }
            
            // Clear selected element
            this.selectedElement = null;
            
            // Reset background
            previewFrame.style.backgroundColor = '';
            previewFrame.style.backgroundImage = '';
            
            console.log(`🔄 Reset page: ${this.currentPage}`);
        }
    }

    // Load a prebuilt template
    async loadPrebuiltTemplate(templateKey) {
        const template = this.prebuiltTemplates[templateKey];
        if (!template) {
            console.error(`❌ Template not found: ${templateKey}`);
            return;
        }

        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) {
            console.error('❌ Preview frame not found');
            return;
        }

        console.log(`🏗️ Loading template: ${template.name}`);
        
        // Generate HTML for the template
        let templateHTML = '';
        const homePage = template.pages.home;
        
        if (homePage && homePage.sections) {
            homePage.sections.forEach(section => {
                switch(section.type) {
                    case 'hero':
                        templateHTML += `
                            <div class="hero-section" style="
                                background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${section.content.backgroundImage}');
                                background-size: cover;
                                background-position: center;
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                text-align: center;
                                color: white;
                                padding: 40px 20px;
                            ">
                                <div class="hero-content">
                                    <h1 style="font-size: 3.5rem; font-weight: 300; margin-bottom: 1rem; font-family: 'Cormorant Garamond', serif;">${section.content.title}</h1>
                                    <p style="font-size: 1.3rem; margin-bottom: 2rem; font-family: 'Quicksand', sans-serif;">${section.content.subtitle}</p>
                                    <button style="
                                        background: rgba(196, 150, 45, 0.9);
                                        color: white;
                                        border: none;
                                        padding: 15px 30px;
                                        font-size: 1.1rem;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-family: 'Quicksand', sans-serif;
                                        font-weight: 600;
                                        letter-spacing: 1px;
                                        transition: all 0.3s ease;
                                    " onmouseover="this.style.background='rgba(196, 150, 45, 1)'" onmouseout="this.style.background='rgba(196, 150, 45, 0.9)'">${section.content.buttonText}</button>
                                </div>
                            </div>
                        `;
                        break;
                    case 'about':
                        templateHTML += `
                            <div class="about-section" style="
                                padding: 80px 20px;
                                background: #F7F3F0;
                                display: flex;
                                max-width: 1200px;
                                margin: 0 auto;
                                align-items: center;
                                gap: 40px;
                            ">
                                <div class="about-content" style="flex: 1;">
                                    <h2 style="font-size: 2.5rem; font-weight: 300; margin-bottom: 1.5rem; color: #2C2C2C; font-family: 'Cormorant Garamond', serif;">${section.content.title}</h2>
                                    <p style="font-size: 1.1rem; line-height: 1.8; color: #5D4E37; font-family: 'Quicksand', sans-serif;">${section.content.text}</p>
                                </div>
                                <div class="about-image" style="flex: 1;">
                                    <img src="${section.content.image}" alt="About" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px;">
                                </div>
                            </div>
                        `;
                        break;
                }
            });
        }

        // Apply the template HTML
        previewFrame.innerHTML = templateHTML;
        
        // Update page data
        this.pageLayouts[this.currentPage] = template.pages.home.sections || [];
        
        // Save changes
        await this.saveToStorage();
        
        this.showNotification(`Template "${template.name}" loaded successfully!`, 'success');
        console.log(`✅ Template loaded: ${template.name}`);
    }

    // Initialize with luxury component system
    async initializeSystem() {
        await this.init();
    }
}

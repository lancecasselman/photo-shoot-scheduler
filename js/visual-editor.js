class VisualEditor {
    constructor() {
        this.currentTheme = 'light-airy';
        this.currentPage = 'home';
        this.siteData = {
            title: 'Your Photography Studio',
            tagline: 'Capturing life\'s beautiful moments',
            email: 'hello@yoursite.com',
            phone: '(555) 123-4567'
        };
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
        this.defaultContent = {
            hero_title: 'Your Photography Studio',
            hero_subtitle: 'Capturing life\'s beautiful moments with artistic vision and professional excellence',
            hero_cta: 'View Portfolio',
            about_title: 'About',
            about_text: 'Welcome to our photography studio where we specialize in creating timeless memories. With years of experience and a passion for capturing authentic moments, we bring your vision to life through our lens.',
            gallery_title: 'Portfolio',
            portfolio_title: 'Our Work'
        };
        this.init();
    }

    init() {
        this.setupThemeGrid();
        this.setupPageNavigation();
        this.setupDeviceControls();
        this.setupFormInputs();
        this.loadTheme(this.currentTheme);
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

    setupPageNavigation() {
        const pageNav = document.getElementById('page-navigation');
        if (!pageNav) return;

        const pages = [
            { id: 'home', name: 'Home', icon: '🏠' },
            { id: 'about', name: 'About', icon: '👤' },
            { id: 'portfolio', name: 'Portfolio', icon: '📸' },
            { id: 'contact', name: 'Contact', icon: '📧' }
        ];

        pageNav.innerHTML = '';
        pages.forEach(page => {
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

    setupDeviceControls() {
        const deviceBtns = document.querySelectorAll('.device-btn');
        deviceBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                deviceBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.setDeviceView(e.target.dataset.device);
            });
        });
    }

    setupFormInputs() {
        const inputs = ['site-title', 'site-tagline', 'contact-email', 'contact-phone'];
        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => this.updateSiteData());
            }
        });
    }

    selectTheme(themeKey) {
        // Update active theme
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        // Find and activate the current theme
        const selectedTheme = document.querySelector(`[data-theme="${themeKey}"]`);
        if (selectedTheme) {
            selectedTheme.classList.add('active');
        }
        
        this.currentTheme = themeKey;
        this.loadTheme(themeKey);
        
        // Show celebration animation
        this.showCelebration('Theme Applied!');
    }

    selectPage(pageId) {
        document.querySelectorAll('.page-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Find and activate the current page
        const pageElement = document.querySelector(`[data-page="${pageId}"]`);
        if (pageElement) {
            pageElement.closest('.page-nav-item').classList.add('active');
        }
        
        this.currentPage = pageId;
        this.loadTheme(this.currentTheme);
    }

    async loadTheme(themeKey) {
        try {
            const response = await fetch(`/storefront-templates/${themeKey}/home.html`);
            if (!response.ok) throw new Error('Theme not found');
            
            let html = await response.text();
            
            // Replace template variables with actual content
            html = this.replaceTemplateVariables(html);
            
            // Load into preview frame
            const previewFrame = document.getElementById('preview-frame');
            
            if (previewFrame) {
                previewFrame.innerHTML = html;
                this.setupEditableElements(previewFrame);
            }
            
        } catch (error) {
            console.error('Error loading theme:', error);
            this.showError('Failed to load theme');
        }
    }

    replaceTemplateVariables(html) {
        // Replace template variables with current content
        Object.entries(this.defaultContent).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, value);
        });
        
        // Add hamburger menu to every template
        html = this.addHamburgerMenu(html);
        
        return html;
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
                <a href="#" class="hamburger-nav-item active" data-page="home">
                    <span class="nav-icon">🏠</span>
                    <span>Home</span>
                </a>
                <a href="#" class="hamburger-nav-item" data-page="about">
                    <span class="nav-icon">👤</span>
                    <span>About</span>
                </a>
                <a href="#" class="hamburger-nav-item" data-page="portfolio">
                    <span class="nav-icon">📸</span>
                    <span>Portfolio</span>
                </a>
                <a href="#" class="hamburger-nav-item" data-page="contact">
                    <span class="nav-icon">📧</span>
                    <span>Contact</span>
                </a>
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
            backdrop-filter: blur(10px);
        }
        
        .hamburger-btn:hover {
            background: rgba(196, 150, 45, 1);
            transform: scale(1.05);
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
        
        .hamburger-btn.active .hamburger-line:nth-child(1) {
            transform: rotate(45deg) translate(6px, 6px);
        }
        
        .hamburger-btn.active .hamburger-line:nth-child(2) {
            opacity: 0;
        }
        
        .hamburger-btn.active .hamburger-line:nth-child(3) {
            transform: rotate(-45deg) translate(6px, -6px);
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
        
        .hamburger-menu-overlay.active {
            opacity: 1;
            visibility: visible;
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
        
        .hamburger-menu.active {
            left: 0;
        }
        
        .hamburger-header {
            padding: 20px;
            border-bottom: 1px solid #e8ddd4;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #e8ddd4;
        }
        
        .hamburger-header h3 {
            margin: 0;
            color: #2c2c2c;
            font-family: 'Cormorant Garamond', serif;
            font-size: 1.2rem;
        }
        
        .hamburger-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #2c2c2c;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: background 0.2s ease;
        }
        
        .hamburger-close:hover {
            background: rgba(196, 150, 45, 0.1);
        }
        
        .hamburger-nav {
            padding: 20px 0;
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
        
        .nav-icon {
            font-size: 1.2rem;
        }
        
        @media (max-width: 768px) {
            .hamburger-menu {
                width: 250px;
                left: -250px;
            }
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
                hamburgerBtn.classList.add('active');
                hamburgerMenu.classList.add('active');
                hamburgerOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
            
            function closeMenu() {
                hamburgerBtn.classList.remove('active');
                hamburgerMenu.classList.remove('active');
                hamburgerOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
            
            hamburgerBtn.addEventListener('click', function() {
                if (hamburgerMenu.classList.contains('active')) {
                    closeMenu();
                } else {
                    openMenu();
                }
            });
            
            hamburgerClose.addEventListener('click', closeMenu);
            hamburgerOverlay.addEventListener('click', closeMenu);
            
            navItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Update active state
                    navItems.forEach(nav => nav.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Get target page
                    const targetPage = this.dataset.page;
                    
                    // Simulate page navigation (in real implementation, this would load different content)
                    console.log('Navigating to:', targetPage);
                    
                    // Close menu
                    closeMenu();
                    
                    // Show notification
                    showPageNotification(targetPage);
                });
            });
            
            function showPageNotification(page) {
                const notification = document.createElement('div');
                notification.style.cssText = \`
                    position: fixed;
                    top: 80px;
                    left: 20px;
                    background: #c4962d;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    z-index: 1003;
                    font-weight: 600;
                    animation: slideInLeft 0.3s ease, fadeOut 0.3s ease 2s forwards;
                \`;
                notification.textContent = \`Navigated to \${page.charAt(0).toUpperCase() + page.slice(1)} page\`;
                
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.remove();
                }, 2500);
            }
            
            // Add animations
            const style = document.createElement('style');
            style.textContent = \`
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            \`;
            document.head.appendChild(style);
        });
        </script>
        `;
        
        // Insert hamburger menu right after opening body tag
        const bodyIndex = html.indexOf('<body');
        if (bodyIndex !== -1) {
            const bodyCloseIndex = html.indexOf('>', bodyIndex) + 1;
            html = html.slice(0, bodyCloseIndex) + hamburgerMenuHTML + html.slice(bodyCloseIndex);
        }
        
        return html;
    }

    setupEditableElements(container) {
        const editables = container.querySelectorAll('[data-editable]');
        
        editables.forEach(element => {
            this.makeElementEditable(element);
        });
    }

    makeElementEditable(element) {
        const type = element.dataset.editable;
        const elementId = element.dataset.elementId;
        
        if (type === 'text') {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editText(element);
            });
            
            // Add visual indicator on hover
            element.style.cursor = 'pointer';
            element.addEventListener('mouseenter', () => {
                element.style.outline = '2px dashed var(--muted-gold, #c4962d)';
                element.style.outlineOffset = '4px';
                element.style.backgroundColor = 'rgba(196, 150, 45, 0.1)';
            });
            
            element.addEventListener('mouseleave', () => {
                if (!element.classList.contains('editing')) {
                    element.style.outline = 'none';
                    element.style.backgroundColor = '';
                }
            });
        }
        
        if (type === 'image') {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editImage(element);
            });
            
            element.style.cursor = 'pointer';
            element.addEventListener('mouseenter', () => {
                element.style.outline = '2px dashed var(--muted-gold, #c4962d)';
                element.style.outlineOffset = '4px';
                element.style.filter = 'brightness(1.1)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.outline = 'none';
                element.style.filter = '';
            });
        }
    }

    editText(element) {
        const originalText = element.textContent;
        element.classList.add('editing');
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.style.cssText = `
            font-family: inherit;
            font-size: inherit;
            font-weight: inherit;
            color: inherit;
            background: rgba(255, 255, 255, 0.9);
            border: 2px solid var(--muted-gold, #c4962d);
            border-radius: 4px;
            padding: 4px 8px;
            width: 100%;
            min-width: 200px;
        `;
        
        // Replace element with input
        element.style.display = 'none';
        element.parentNode.insertBefore(input, element.nextSibling);
        input.focus();
        input.select();
        
        const saveEdit = () => {
            const newText = input.value.trim();
            if (newText && newText !== originalText) {
                element.textContent = newText;
                this.saveContent(element.dataset.elementId, newText);
                this.showSuccess('Content updated!');
            }
            
            input.remove();
            element.style.display = '';
            element.classList.remove('editing');
            element.style.outline = 'none';
        };
        
        const cancelEdit = () => {
            input.remove();
            element.style.display = '';
            element.classList.remove('editing');
            element.style.outline = 'none';
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    }

    editImage(element) {
        const input = document.createElement('input');
        input.type = 'url';
        input.placeholder = 'Enter image URL';
        input.value = element.src || '';
        
        const modal = this.createModal('Edit Image', `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Image URL:</label>
                ${input.outerHTML}
            </div>
            <div style="margin-bottom: 1rem;">
                <img id="image-preview" src="${element.src}" alt="Preview" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;">
            </div>
        `, [
            {
                text: 'Update Image',
                primary: true,
                action: () => {
                    const newUrl = modal.querySelector('input').value.trim();
                    if (newUrl) {
                        element.src = newUrl;
                        this.saveContent(element.dataset.elementId, newUrl);
                        this.showSuccess('Image updated!');
                    }
                    this.closeModal(modal);
                }
            },
            {
                text: 'Cancel',
                action: () => this.closeModal(modal)
            }
        ]);
        
        // Update preview on URL change
        const urlInput = modal.querySelector('input');
        const preview = modal.querySelector('#image-preview');
        urlInput.addEventListener('input', () => {
            if (urlInput.value.trim()) {
                preview.src = urlInput.value;
            }
        });
    }

    createModal(title, content, buttons = []) {
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${buttons.map(btn => `
                        <button class="btn ${btn.primary ? 'btn-primary' : 'btn-secondary'}" data-action="${btn.text}">
                            ${btn.text}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Add modal styles
        const style = document.createElement('style');
        style.textContent = `
            .editor-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(5px);
            }
            
            .modal-content {
                position: relative;
                background: white;
                border-radius: 12px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
            }
            
            .modal-header {
                padding: 1.5rem;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 1.2rem;
                color: #2c2c2c;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-body {
                padding: 1.5rem;
            }
            
            .modal-footer {
                padding: 1.5rem;
                border-top: 1px solid #e0e0e0;
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
            }
            
            .modal-body input {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-size: 1rem;
            }
            
            .modal-body input:focus {
                outline: none;
                border-color: var(--muted-gold, #c4962d);
            }
        `;
        
        if (!document.querySelector('#editor-modal-styles')) {
            style.id = 'editor-modal-styles';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(modal);
        
        // Setup event handlers
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal(modal));
        modal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal(modal));
        
        buttons.forEach(btn => {
            const btnElement = modal.querySelector(`[data-action="${btn.text}"]`);
            if (btnElement) {
                btnElement.addEventListener('click', btn.action);
            }
        });
        
        return modal;
    }

    closeModal(modal) {
        modal.remove();
    }

    setDeviceView(device) {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame) return;
        
        previewFrame.classList.remove('desktop', 'tablet', 'mobile');
        previewFrame.classList.add(device);
        
        // Apply device-specific styling
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

    updateSiteData() {
        const titleInput = document.getElementById('site-title');
        const taglineInput = document.getElementById('site-tagline');
        const emailInput = document.getElementById('contact-email');
        const phoneInput = document.getElementById('contact-phone');
        
        if (titleInput) this.siteData.title = titleInput.value;
        if (taglineInput) this.siteData.tagline = taglineInput.value;
        if (emailInput) this.siteData.email = emailInput.value;
        if (phoneInput) this.siteData.phone = phoneInput.value;
        
        // Update default content
        this.defaultContent.hero_title = this.siteData.title;
        this.defaultContent.hero_subtitle = this.siteData.tagline;
        
        // Refresh preview
        this.loadTheme(this.currentTheme);
    }

    saveContent(elementId, content) {
        // Update default content
        this.defaultContent[elementId] = content;
        
        // In a real implementation, this would save to Firebase
        console.log('Saving content:', { elementId, content });
    }

    publishSite() {
        this.showSuccess('Site published successfully!');
        this.showCelebration('🚀 Site Published!');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add notification styles
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 2rem;
                right: 2rem;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10001;
                animation: slideIn 0.3s ease;
            }
            
            .notification-success {
                background: linear-gradient(135deg, #10b981, #059669);
            }
            
            .notification-error {
                background: linear-gradient(135deg, #ef4444, #dc2626);
            }
            
            .notification-info {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        if (!document.querySelector('#notification-styles')) {
            style.id = 'notification-styles';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showCelebration(message) {
        // Create confetti effect
        const colors = ['#c4962d', '#9cafa3', '#e8ddd4', '#f7f3f0'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                top: -10px;
                left: ${Math.random() * 100}%;
                z-index: 10002;
                pointer-events: none;
                animation: confetti-fall ${2 + Math.random() * 3}s linear forwards;
            `;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 5000);
        }
        
        // Add confetti animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes confetti-fall {
                0% {
                    transform: translateY(-100vh) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        
        if (!document.querySelector('#confetti-styles')) {
            style.id = 'confetti-styles';
            document.head.appendChild(style);
        }
        
        // Show celebration message
        this.showSuccess(message);
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new VisualEditor();
});

// Global functions for buttons
function publishSite() {
    if (window.editor) {
        window.editor.publishSite();
    }
}
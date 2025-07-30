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
            
            // Load into both preview frames
            const previewFrame1 = document.getElementById('preview-frame-1');
            const previewFrame2 = document.getElementById('preview-frame-2');
            
            if (previewFrame1) {
                previewFrame1.innerHTML = html;
                this.setupEditableElements(previewFrame1, 'frame1');
            }
            
            if (previewFrame2) {
                previewFrame2.innerHTML = html;
                this.setupEditableElements(previewFrame2, 'frame2');
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
        
        return html;
    }

    setupEditableElements(container, frameId) {
        const editables = container.querySelectorAll('[data-editable]');
        
        editables.forEach(element => {
            this.makeElementEditable(element, frameId);
        });
    }

    makeElementEditable(element, frameId) {
        const type = element.dataset.editable;
        const elementId = element.dataset.elementId;
        
        if (type === 'text') {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editText(element, frameId);
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
                this.editImage(element, frameId);
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

    editText(element, frameId) {
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
                this.syncBetweenFrames(element.dataset.elementId, newText, 'text');
                this.showSuccess('Content updated across both previews!');
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

    editImage(element, frameId) {
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
                        this.syncBetweenFrames(element.dataset.elementId, newUrl, 'image');
                        this.showSuccess('Image updated across both previews!');
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
        const previewFrame1 = document.getElementById('preview-frame-1');
        const previewFrame2 = document.getElementById('preview-frame-2');
        
        [previewFrame1, previewFrame2].forEach(frame => {
            if (!frame) return;
            
            frame.classList.remove('desktop', 'tablet', 'mobile');
            frame.classList.add(device);
            
            // Apply device-specific styling
            switch (device) {
                case 'desktop':
                    frame.style.maxWidth = '100%';
                    break;
                case 'tablet':
                    frame.style.maxWidth = '768px';
                    break;
                case 'mobile':
                    frame.style.maxWidth = '375px';
                    break;
            }
        });
    }

    syncBetweenFrames(elementId, content, type) {
        // Update both frames when content changes
        const frames = ['preview-frame-1', 'preview-frame-2'];
        
        frames.forEach(frameId => {
            const frame = document.getElementById(frameId);
            if (frame) {
                const element = frame.querySelector(`[data-element-id="${elementId}"]`);
                if (element) {
                    if (type === 'text') {
                        element.textContent = content;
                    } else if (type === 'image') {
                        element.src = content;
                    }
                }
            }
        });
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
// Editor UI Helper Functions

class EditorUI {
    constructor() {
        this.activePanel = 'site-info';
        this.currentDevice = 'desktop';
        this.unsavedChanges = false;
        
        this.initializeUI();
    }
    
    initializeUI() {
        this.setupResponsiveLayout();
        this.setupAutoSave();
        this.setupKeyboardShortcuts();
    }
    
    setupResponsiveLayout() {
        // Handle mobile responsive behavior
        if (window.innerWidth <= 768) {
            this.enableMobileMode();
        }
        
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                this.enableMobileMode();
            } else {
                this.disableMobileMode();
            }
        });
    }
    
    enableMobileMode() {
        // Add mobile menu toggles
        this.addMobileMenuButtons();
    }
    
    disableMobileMode() {
        // Remove mobile menu toggles
        this.removeMobileMenuButtons();
    }
    
    addMobileMenuButtons() {
        const previewHeader = document.querySelector('.preview-header');
        if (!previewHeader.querySelector('.mobile-menu-btn')) {
            const leftMenuBtn = document.createElement('button');
            leftMenuBtn.className = 'mobile-menu-btn';
            leftMenuBtn.innerHTML = '☰ Menu';
            leftMenuBtn.onclick = () => this.toggleMobileMenu('left');
            
            const rightMenuBtn = document.createElement('button');
            rightMenuBtn.className = 'mobile-menu-btn';
            rightMenuBtn.innerHTML = '⚙️ Settings';
            rightMenuBtn.onclick = () => this.toggleMobileMenu('right');
            
            previewHeader.prepend(leftMenuBtn);
            previewHeader.appendChild(rightMenuBtn);
        }
    }
    
    removeMobileMenuButtons() {
        document.querySelectorAll('.mobile-menu-btn').forEach(btn => btn.remove());
    }
    
    toggleMobileMenu(side) {
        const sidebar = document.querySelector(side === 'left' ? '.left-sidebar' : '.right-sidebar');
        sidebar.classList.toggle('open');
        
        // Close the other sidebar
        const otherSidebar = document.querySelector(side === 'left' ? '.right-sidebar' : '.left-sidebar');
        otherSidebar.classList.remove('open');
        
        // Add overlay
        this.toggleMobileOverlay(sidebar.classList.contains('open'));
    }
    
    toggleMobileOverlay(show) {
        let overlay = document.querySelector('.mobile-overlay');
        if (show && !overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 999;
            `;
            overlay.onclick = () => {
                this.closeMobileMenus();
            };
            document.body.appendChild(overlay);
        } else if (!show && overlay) {
            overlay.remove();
        }
    }
    
    closeMobileMenus() {
        document.querySelectorAll('.left-sidebar, .right-sidebar').forEach(sidebar => {
            sidebar.classList.remove('open');
        });
        this.toggleMobileOverlay(false);
    }
    
    setupAutoSave() {
        // Auto-save every 30 seconds if there are unsaved changes
        setInterval(() => {
            if (this.unsavedChanges) {
                this.autoSave();
            }
        }, 30000);
        
        // Save before page unload
        window.addEventListener('beforeunload', (e) => {
            if (this.unsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }
    
    async autoSave() {
        try {
            if (window.saveTemplate) {
                await window.saveTemplate();
                this.markSaved();
                this.showAutoSaveIndicator();
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }
    
    showAutoSaveIndicator() {
        const indicator = document.createElement('div');
        indicator.textContent = 'Auto-saved';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.8rem;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(indicator);
        
        // Fade in
        setTimeout(() => indicator.style.opacity = '1', 100);
        
        // Fade out and remove
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 2000);
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (window.saveTemplate) {
                    window.saveTemplate();
                }
            }
            
            // Ctrl/Cmd + P to publish
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                if (window.publishSite) {
                    window.publishSite();
                }
            }
            
            // Escape to close mobile menus
            if (e.key === 'Escape') {
                this.closeMobileMenus();
            }
            
            // Number keys to switch devices
            if (e.key >= '1' && e.key <= '3') {
                const devices = ['desktop', 'tablet', 'mobile'];
                const deviceIndex = parseInt(e.key) - 1;
                if (devices[deviceIndex]) {
                    this.switchDevice(devices[deviceIndex]);
                }
            }
        });
    }
    
    switchDevice(device) {
        // Remove active class from all device buttons
        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.device === device) {
                btn.classList.add('active');
            }
        });
        
        // Update iframe class
        const iframe = document.getElementById('preview-iframe');
        if (iframe) {
            iframe.className = `preview-iframe ${device}`;
        }
        
        this.currentDevice = device;
    }
    
    markUnsaved() {
        this.unsavedChanges = true;
        this.updateSaveButton();
    }
    
    markSaved() {
        this.unsavedChanges = false;
        this.updateSaveButton();
    }
    
    updateSaveButton() {
        const saveBtn = document.querySelector('.btn-save');
        if (saveBtn) {
            if (this.unsavedChanges) {
                saveBtn.textContent = 'Save*';
                saveBtn.style.background = '#ffc107';
                saveBtn.style.color = '#000';
            } else {
                saveBtn.textContent = 'Save';
                saveBtn.style.background = '#28a745';
                saveBtn.style.color = 'white';
            }
        }
    }
    
    showPanel(panelId) {
        // Hide all panels
        document.querySelectorAll('.controls-section').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // Show selected panel
        const panel = document.getElementById(`${panelId}-panel`);
        if (panel) {
            panel.style.display = 'block';
        }
        
        this.activePanel = panelId;
    }
    
    addValidation() {
        // Add real-time validation to form fields
        document.querySelectorAll('input[type="email"]').forEach(input => {
            input.addEventListener('blur', () => {
                this.validateEmail(input);
            });
        });
        
        document.querySelectorAll('input[type="url"]').forEach(input => {
            input.addEventListener('blur', () => {
                this.validateURL(input);
            });
        });
        
        document.querySelectorAll('input[type="tel"]').forEach(input => {
            input.addEventListener('blur', () => {
                this.validatePhone(input);
            });
        });
    }
    
    validateEmail(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.showValidation(input, emailRegex.test(input.value) || input.value === '', 'Please enter a valid email address');
    }
    
    validateURL(input) {
        if (input.value === '') {
            this.clearValidation(input);
            return;
        }
        
        try {
            new URL(input.value);
            this.showValidation(input, true);
        } catch {
            this.showValidation(input, false, 'Please enter a valid URL');
        }
    }
    
    validatePhone(input) {
        const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)]{7,20}$/;
        this.showValidation(input, phoneRegex.test(input.value) || input.value === '', 'Please enter a valid phone number');
    }
    
    showValidation(input, isValid, message = '') {
        this.clearValidation(input);
        
        if (!isValid) {
            input.style.borderColor = '#dc3545';
            
            const errorEl = document.createElement('div');
            errorEl.className = 'validation-error';
            errorEl.textContent = message;
            errorEl.style.cssText = `
                color: #dc3545;
                font-size: 0.75rem;
                margin-top: 4px;
            `;
            
            input.parentNode.appendChild(errorEl);
        } else {
            input.style.borderColor = '#28a745';
        }
    }
    
    clearValidation(input) {
        input.style.borderColor = '#555';
        const errorEl = input.parentNode.querySelector('.validation-error');
        if (errorEl) {
            errorEl.remove();
        }
    }
    
    // Template management helpers
    loadTemplate(templateData) {
        if (!templateData) return;
        
        // Populate form fields with template data
        Object.keys(templateData).forEach(key => {
            const input = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = templateData[key];
                } else {
                    input.value = templateData[key];
                }
            }
        });
        
        this.markSaved();
    }
    
    getFormData() {
        const formData = {};
        
        document.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.id) {
                const key = input.id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                
                if (input.type === 'checkbox') {
                    formData[key] = input.checked;
                } else if (input.type === 'number') {
                    formData[key] = parseFloat(input.value) || 0;
                } else {
                    formData[key] = input.value;
                }
            }
        });
        
        return formData;
    }
    
    // Animation helpers
    animatePreviewUpdate() {
        const iframe = document.getElementById('preview-iframe');
        if (iframe) {
            iframe.style.opacity = '0.7';
            iframe.style.transform = 'scale(0.98)';
            
            setTimeout(() => {
                iframe.style.opacity = '1';
                iframe.style.transform = 'scale(1)';
            }, 150);
        }
    }
    
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10001;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
        `;
        
        document.body.appendChild(toast);
        
        // Slide in
        setTimeout(() => toast.style.transform = 'translateX(0)', 100);
        
        // Slide out and remove
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Initialize editor UI when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.editorUI = new EditorUI();
    
    // Setup input change tracking
    document.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('input', () => {
            window.editorUI.markUnsaved();
        });
    });
    
    // Setup validation
    window.editorUI.addValidation();
});

// Export for use in other scripts
window.EditorUI = EditorUI;
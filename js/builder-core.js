// Advanced Website Builder - Core Functionality

class AdvancedBuilder {
    constructor() {
        this.currentSite = {
            id: null,
            title: 'Your Photography Studio',
            brandColor: '#d4af37',
            fontStyle: 'modern',
            theme: 'minimal',
            pages: {
                home: { name: 'Home', blocks: [], active: true },
                about: { name: 'About', blocks: [], active: true },
                gallery: { name: 'Gallery', blocks: [], active: true },
                contact: { name: 'Contact', blocks: [], active: true }
            },
            settings: {
                seo: {
                    title: '',
                    description: '',
                    keywords: ''
                },
                contact: {
                    email: '',
                    phone: '',
                    address: ''
                }
            }
        };
        
        this.currentPage = 'home';
        this.isDirty = false;
        this.autosaveInterval = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadThemes();
        this.loadBlocks();
        this.startAutosave();
        this.updatePreview();
        
        // Load user's existing site if available
        this.loadUserSite();
    }
    
    bindEvents() {
        // Header buttons
        document.getElementById('preview-btn').addEventListener('click', () => this.openPreview());
        document.getElementById('save-btn').addEventListener('click', () => this.saveSite());
        document.getElementById('publish-btn').addEventListener('click', () => this.publishSite());
        
        // Site settings
        document.getElementById('site-title').addEventListener('input', (e) => {
            this.currentSite.title = e.target.value;
            this.markDirty();
            this.updatePreview();
        });
        
        document.getElementById('brand-color').addEventListener('change', (e) => {
            this.currentSite.brandColor = e.target.value;
            this.markDirty();
            this.updatePreview();
        });
        
        document.getElementById('font-style').addEventListener('change', (e) => {
            this.currentSite.fontStyle = e.target.value;
            this.markDirty();
            this.updatePreview();
        });
        
        // Page management
        document.querySelectorAll('.page-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchPage(e.target.dataset.page);
            });
        });
        
        document.getElementById('add-page-btn').addEventListener('click', () => this.addNewPage());
        
        // Device toggles
        document.querySelectorAll('.device-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                this.switchDevice(e.target.dataset.device);
            });
        });
        
        // Block categories
        document.querySelectorAll('.block-category').forEach(category => {
            category.addEventListener('click', (e) => {
                this.switchBlockCategory(e.target.dataset.category);
            });
        });
        
        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeBlockEditor();
        });
        
        // Click outside modal to close
        document.getElementById('block-editor-modal').addEventListener('click', (e) => {
            if (e.target.id === 'block-editor-modal') {
                this.closeBlockEditor();
            }
        });
    }
    
    markDirty() {
        this.isDirty = true;
        document.getElementById('site-status-indicator').style.color = '#ffa500';
        document.getElementById('site-status-text').textContent = 'Modified';
    }
    
    markClean() {
        this.isDirty = false;
        document.getElementById('site-status-indicator').style.color = '#28a745';
        document.getElementById('site-status-text').textContent = 'Saved';
    }
    
    switchPage(pageId) {
        this.currentPage = pageId;
        
        // Update page navigation
        document.querySelectorAll('.page-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
        
        // Update preview
        this.updatePreview();
    }
    
    switchDevice(device) {
        document.querySelectorAll('.device-toggle').forEach(toggle => {
            toggle.classList.remove('active');
        });
        document.querySelector(`[data-device="${device}"]`).classList.add('active');
        
        // Update preview frame size
        const frame = document.querySelector('.preview-frame');
        frame.setAttribute('data-device', device);
    }
    
    switchBlockCategory(category) {
        document.querySelectorAll('.block-category').forEach(cat => {
            cat.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        this.loadBlocks(category);
    }
    
    loadThemes() {
        const themeSelector = document.getElementById('theme-selector');
        const themes = [
            { id: 'minimal', name: 'Minimal', preview: '/themes/minimal-preview.jpg' },
            { id: 'classic', name: 'Classic', preview: '/themes/classic-preview.jpg' },
            { id: 'modern', name: 'Modern', preview: '/themes/modern-preview.jpg' },
            { id: 'elegant', name: 'Elegant', preview: '/themes/elegant-preview.jpg' },
            { id: 'bold', name: 'Bold', preview: '/themes/bold-preview.jpg' },
            { id: 'creative', name: 'Creative', preview: '/themes/creative-preview.jpg' }
        ];
        
        themeSelector.innerHTML = themes.map(theme => `
            <div class="theme-card ${theme.id === this.currentSite.theme ? 'active' : ''}" 
                 data-theme="${theme.id}" onclick="builder.selectTheme('${theme.id}')">
                <div style="width: 100%; height: 80%; background: linear-gradient(135deg, #333, #666); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                    ${theme.name}
                </div>
                <div class="theme-name">${theme.name}</div>
            </div>
        `).join('');
    }
    
    selectTheme(themeId) {
        this.currentSite.theme = themeId;
        this.markDirty();
        
        // Update theme selection
        document.querySelectorAll('.theme-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-theme="${themeId}"]`).classList.add('active');
        
        this.updatePreview();
    }
    
    loadBlocks(category = 'layout') {
        const blockLibrary = document.getElementById('block-library');
        
        const blocks = {
            layout: [
                { id: 'hero', name: 'Hero Section', icon: '🎯', desc: 'Large header with image' },
                { id: 'two-column', name: 'Two Column', icon: '📰', desc: 'Side by side content' },
                { id: 'three-column', name: 'Three Column', icon: '📊', desc: 'Triple column layout' }
            ],
            content: [
                { id: 'heading', name: 'Heading', icon: '📝', desc: 'Large title text' },
                { id: 'paragraph', name: 'Paragraph', icon: '📄', desc: 'Body text content' },
                { id: 'quote', name: 'Quote', icon: '💬', desc: 'Highlighted quote' }
            ],
            media: [
                { id: 'image', name: 'Image', icon: '🖼️', desc: 'Single image block' },
                { id: 'gallery', name: 'Gallery', icon: '🖼️', desc: 'Image grid gallery' },
                { id: 'video', name: 'Video', icon: '🎥', desc: 'Embedded video' }
            ],
            forms: [
                { id: 'contact-form', name: 'Contact Form', icon: '📋', desc: 'Contact form with fields' },
                { id: 'newsletter', name: 'Newsletter', icon: '📧', desc: 'Email signup form' },
                { id: 'booking', name: 'Booking Form', icon: '📅', desc: 'Session booking form' }
            ]
        };
        
        const categoryBlocks = blocks[category] || blocks.layout;
        
        blockLibrary.innerHTML = categoryBlocks.map(block => `
            <div class="block-item" draggable="true" data-block-type="${block.id}" 
                 ondragstart="builder.handleBlockDragStart(event)" 
                 onclick="builder.addBlock('${block.id}')">
                <span class="block-icon">${block.icon}</span>
                <div class="block-name">${block.name}</div>
                <div class="block-desc">${block.desc}</div>
            </div>
        `).join('');
    }
    
    addBlock(blockType) {
        const newBlock = this.createBlock(blockType);
        this.currentSite.pages[this.currentPage].blocks.push(newBlock);
        this.markDirty();
        this.updatePreview();
    }
    
    createBlock(type) {
        const blockId = 'block_' + Date.now();
        
        const blockTemplates = {
            hero: {
                id: blockId,
                type: 'hero',
                content: {
                    title: 'Professional Photography',
                    subtitle: 'Capturing your most precious moments',
                    backgroundImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&h=600&fit=crop',
                    buttonText: 'View Portfolio',
                    buttonLink: '#portfolio'
                },
                styles: {
                    textAlign: 'center',
                    minHeight: '500px',
                    color: 'white'
                }
            },
            heading: {
                id: blockId,
                type: 'heading',
                content: {
                    text: 'Your Heading Here',
                    level: 'h2'
                },
                styles: {
                    fontSize: '32px',
                    fontWeight: 'bold',
                    margin: '20px 0'
                }
            },
            paragraph: {
                id: blockId,
                type: 'paragraph',
                content: {
                    text: 'Add your content here. This is a paragraph block where you can write about your photography services, experience, or any other information you want to share with visitors.'
                },
                styles: {
                    fontSize: '16px',
                    lineHeight: '1.6',
                    margin: '15px 0'
                }
            },
            image: {
                id: blockId,
                type: 'image',
                content: {
                    src: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=600&h=400&fit=crop',
                    alt: 'Photography sample',
                    caption: ''
                },
                styles: {
                    width: '100%',
                    borderRadius: '8px'
                }
            },
            gallery: {
                id: blockId,
                type: 'gallery',
                content: {
                    images: [
                        'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop',
                        'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                        'https://images.unsplash.com/photo-1465145498025-928c7a71cab9?w=400&h=300&fit=crop'
                    ],
                    columns: 3
                },
                styles: {
                    gap: '15px'
                }
            },
            'contact-form': {
                id: blockId,
                type: 'contact-form',
                content: {
                    title: 'Get In Touch',
                    fields: ['name', 'email', 'phone', 'message'],
                    submitText: 'Send Message'
                },
                styles: {
                    maxWidth: '500px',
                    margin: '0 auto'
                }
            }
        };
        
        return blockTemplates[type] || blockTemplates.paragraph;
    }
    
    updatePreview() {
        const iframe = document.getElementById('preview-iframe');
        const previewContent = this.renderPreview();
        
        iframe.srcdoc = previewContent;
    }
    
    renderPreview() {
        const page = this.currentSite.pages[this.currentPage];
        const blocks = page.blocks || [];
        
        const fontFamilies = {
            modern: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            classic: 'Georgia, "Times New Roman", serif',
            elegant: '"Playfair Display", serif',
            minimal: '"Helvetica Neue", Arial, sans-serif',
            bold: '"Oswald", "Arial Black", sans-serif'
        };
        
        const blocksHTML = blocks.map(block => this.renderBlock(block)).join('');
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.currentSite.title}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: ${fontFamilies[this.currentSite.fontStyle]};
                        line-height: 1.6;
                        color: #333;
                    }
                    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
                    .block { margin: 20px 0; }
                    .hero { 
                        background-size: cover; 
                        background-position: center; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        text-align: center;
                        position: relative;
                    }
                    .hero::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.4);
                    }
                    .hero-content { position: relative; z-index: 1; color: white; }
                    .gallery { display: grid; gap: 15px; }
                    .gallery[data-columns="2"] { grid-template-columns: repeat(2, 1fr); }
                    .gallery[data-columns="3"] { grid-template-columns: repeat(3, 1fr); }
                    .gallery[data-columns="4"] { grid-template-columns: repeat(4, 1fr); }
                    .gallery img { width: 100%; height: 250px; object-fit: cover; border-radius: 8px; }
                    .contact-form { max-width: 500px; margin: 0 auto; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
                    .form-group input, .form-group textarea { 
                        width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 4px;
                        font-size: 16px;
                    }
                    .form-group input:focus, .form-group textarea:focus {
                        outline: none; border-color: ${this.currentSite.brandColor};
                    }
                    .btn { 
                        background: ${this.currentSite.brandColor}; 
                        color: white; 
                        padding: 12px 24px; 
                        border: none; 
                        border-radius: 4px; 
                        font-size: 16px; 
                        cursor: pointer;
                    }
                    .btn:hover { opacity: 0.9; }
                </style>
            </head>
            <body>
                <div class="container">
                    ${blocksHTML}
                </div>
            </body>
            </html>
        `;
    }
    
    renderBlock(block) {
        switch (block.type) {
            case 'hero':
                return `
                    <div class="block hero" style="background-image: url('${block.content.backgroundImage}'); min-height: ${block.styles.minHeight};">
                        <div class="hero-content">
                            <h1 style="font-size: 48px; margin-bottom: 20px;">${block.content.title}</h1>
                            <p style="font-size: 20px; margin-bottom: 30px;">${block.content.subtitle}</p>
                            <a href="${block.content.buttonLink}" class="btn">${block.content.buttonText}</a>
                        </div>
                    </div>
                `;
            
            case 'heading':
                const level = block.content.level || 'h2';
                return `
                    <div class="block">
                        <${level} style="font-size: ${block.styles.fontSize}; font-weight: ${block.styles.fontWeight}; margin: ${block.styles.margin}; color: ${this.currentSite.brandColor};">
                            ${block.content.text}
                        </${level}>
                    </div>
                `;
            
            case 'paragraph':
                return `
                    <div class="block">
                        <p style="font-size: ${block.styles.fontSize}; line-height: ${block.styles.lineHeight}; margin: ${block.styles.margin};">
                            ${block.content.text}
                        </p>
                    </div>
                `;
            
            case 'image':
                return `
                    <div class="block">
                        <img src="${block.content.src}" alt="${block.content.alt}" style="width: ${block.styles.width}; border-radius: ${block.styles.borderRadius};">
                        ${block.content.caption ? `<p style="text-align: center; font-style: italic; margin-top: 10px;">${block.content.caption}</p>` : ''}
                    </div>
                `;
            
            case 'gallery':
                const images = block.content.images.map(img => `<img src="${img}" alt="Gallery image">`).join('');
                return `
                    <div class="block">
                        <div class="gallery" data-columns="${block.content.columns}">
                            ${images}
                        </div>
                    </div>
                `;
            
            case 'contact-form':
                return `
                    <div class="block">
                        <div class="contact-form">
                            <h3 style="text-align: center; margin-bottom: 30px; color: ${this.currentSite.brandColor};">${block.content.title}</h3>
                            <form>
                                <div class="form-group">
                                    <label>Name</label>
                                    <input type="text" placeholder="Your full name">
                                </div>
                                <div class="form-group">
                                    <label>Email</label>
                                    <input type="email" placeholder="your@email.com">
                                </div>
                                <div class="form-group">
                                    <label>Phone</label>
                                    <input type="tel" placeholder="Your phone number">
                                </div>
                                <div class="form-group">
                                    <label>Message</label>
                                    <textarea rows="5" placeholder="Tell me about your photography needs..."></textarea>
                                </div>
                                <button type="submit" class="btn">${block.content.submitText}</button>
                            </form>
                        </div>
                    </div>
                `;
            
            default:
                return `<div class="block"><p>Unknown block type: ${block.type}</p></div>`;
        }
    }
    
    openBlockEditor(blockId) {
        const block = this.findBlock(blockId);
        if (!block) return;
        
        const modal = document.getElementById('block-editor-modal');
        const content = document.getElementById('block-editor-content');
        
        content.innerHTML = this.generateBlockEditor(block);
        modal.style.display = 'block';
        
        this.currentEditingBlock = blockId;
    }
    
    closeBlockEditor() {
        document.getElementById('block-editor-modal').style.display = 'none';
        this.currentEditingBlock = null;
    }
    
    generateBlockEditor(block) {
        // Generate dynamic form based on block type
        switch (block.type) {
            case 'heading':
                return `
                    <div class="form-group">
                        <label>Text</label>
                        <input type="text" id="edit-text" value="${block.content.text}">
                    </div>
                    <div class="form-group">
                        <label>Heading Level</label>
                        <select id="edit-level">
                            <option value="h1" ${block.content.level === 'h1' ? 'selected' : ''}>H1</option>
                            <option value="h2" ${block.content.level === 'h2' ? 'selected' : ''}>H2</option>
                            <option value="h3" ${block.content.level === 'h3' ? 'selected' : ''}>H3</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Font Size</label>
                        <input type="text" id="edit-font-size" value="${block.styles.fontSize}">
                    </div>
                `;
            case 'paragraph':
                return `
                    <div class="form-group">
                        <label>Text</label>
                        <textarea id="edit-text" rows="5">${block.content.text}</textarea>
                    </div>
                `;
            default:
                return '<p>This block type is not yet editable.</p>';
        }
    }
    
    async saveSite() {
        try {
            // Here you would save to Firebase/backend
            console.log('Saving site:', this.currentSite);
            
            // Simulate save
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.markClean();
            this.showMessage('Site saved successfully', 'success');
        } catch (error) {
            console.error('Error saving site:', error);
            this.showMessage('Error saving site', 'error');
        }
    }
    
    async publishSite() {
        try {
            // Here you would publish to Firebase Hosting
            console.log('Publishing site:', this.currentSite);
            
            const publishedHTML = this.generateFullSite();
            
            // Simulate publish
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.showMessage('Site published successfully', 'success');
            document.getElementById('site-status-indicator').style.color = '#28a745';
            document.getElementById('site-status-text').textContent = 'Published';
        } catch (error) {
            console.error('Error publishing site:', error);
            this.showMessage('Error publishing site', 'error');
        }
    }
    
    generateFullSite() {
        // Generate complete multi-page site
        const pages = {};
        
        Object.keys(this.currentSite.pages).forEach(pageId => {
            const page = this.currentSite.pages[pageId];
            if (page.active) {
                pages[pageId] = this.renderFullPage(page, pageId);
            }
        });
        
        return pages;
    }
    
    renderFullPage(page, pageId) {
        // Render complete HTML page with navigation
        const blocks = page.blocks || [];
        const blocksHTML = blocks.map(block => this.renderBlock(block)).join('');
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${page.name} - ${this.currentSite.title}</title>
                <!-- Full site styles would be here -->
            </head>
            <body>
                <nav>
                    <!-- Navigation would be here -->
                </nav>
                <main>
                    ${blocksHTML}
                </main>
                <footer>
                    <!-- Footer would be here -->
                </footer>
            </body>
            </html>
        `;
    }
    
    showMessage(text, type = 'info') {
        // Show toast notification
        console.log(`${type.toUpperCase()}: ${text}`);
    }
    
    startAutosave() {
        this.autosaveInterval = setInterval(() => {
            if (this.isDirty) {
                this.saveSite();
            }
        }, 30000); // Auto-save every 30 seconds
    }
    
    async loadUserSite() {
        try {
            // Here you would load from Firebase/backend
            // For now, just populate with default content
            this.addBlock('hero');
            this.updatePreview();
        } catch (error) {
            console.error('Error loading user site:', error);
        }
    }
}

// Initialize builder when page loads
let builder;
document.addEventListener('DOMContentLoaded', () => {
    builder = new AdvancedBuilder();
});

// Global functions for inline event handlers
window.builder = {
    selectTheme: (themeId) => builder.selectTheme(themeId),
    addBlock: (blockType) => builder.addBlock(blockType),
    handleBlockDragStart: (event) => {
        // Handle drag start for blocks
        event.dataTransfer.setData('text/plain', event.target.dataset.blockType);
    }
};
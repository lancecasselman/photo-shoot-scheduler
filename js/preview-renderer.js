// Preview Renderer for Advanced Website Builder

class PreviewRenderer {
    constructor() {
        this.currentSite = null;
        this.currentPage = 'home';
        this.currentTheme = 'minimal';
        this.brandColor = '#d4af37';
        this.fontStyle = 'modern';
    }
    
    setSiteData(siteData) {
        this.currentSite = siteData;
        this.currentTheme = siteData.theme || 'minimal';
        this.brandColor = siteData.brandColor || '#d4af37';
        this.fontStyle = siteData.fontStyle || 'modern';
    }
    
    renderPage(pageId = null) {
        if (!this.currentSite) {
            return this.renderEmptyState();
        }
        
        const targetPage = pageId || this.currentPage;
        const page = this.currentSite.pages[targetPage];
        
        if (!page) {
            return this.renderPageNotFound(targetPage);
        }
        
        return this.generatePageHTML(page, targetPage);
    }
    
    generatePageHTML(page, pageId) {
        const blocks = page.blocks || [];
        const blocksHTML = blocks.map(block => {
            return `
                <div class="block-container" data-block-id="${block.id}">
                    ${blockLibrary.renderBlock(block, this.currentTheme, this.brandColor)}
                </div>
            `;
        }).join('');
        
        const themeCSS = themeEngine.generatePreviewCSS(this.currentTheme, this.brandColor);
        const customCSS = this.generateCustomCSS();
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${page.name} - ${this.currentSite.title}</title>
                <style>
                    ${themeCSS}
                    ${customCSS}
                    
                    /* Preview-specific styles */
                    .block-container {
                        position: relative;
                        margin: 20px 0;
                    }
                    
                    .block-container:hover {
                        outline: 2px dashed #007bff;
                        outline-offset: 4px;
                    }
                    
                    .block-container:hover::after {
                        content: 'Click to edit';
                        position: absolute;
                        top: -30px;
                        left: 0;
                        background: #007bff;
                        color: white;
                        padding: 4px 8px;
                        font-size: 12px;
                        border-radius: 4px;
                        z-index: 1000;
                    }
                    
                    .hero-overlay {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 1;
                    }
                    
                    .hero-content {
                        position: relative;
                        z-index: 2;
                    }
                    
                    /* Ensure forms are responsive */
                    @media (max-width: 768px) {
                        .two-column-block > div,
                        .three-column-block > div {
                            grid-template-columns: 1fr !important;
                        }
                        
                        .contact-form,
                        .booking-form {
                            padding: 20px !important;
                        }
                        
                        .newsletter-signup form {
                            flex-direction: column !important;
                        }
                    }
                </style>
            </head>
            <body>
                ${this.renderNavigation()}
                
                <main class="page-content">
                    ${blocksHTML || this.renderEmptyPageContent(pageId)}
                </main>
                
                ${this.renderFooter()}
                
                <script>
                    // Preview interaction handlers
                    document.addEventListener('click', function(e) {
                        const blockContainer = e.target.closest('.block-container');
                        if (blockContainer) {
                            e.preventDefault();
                            const blockId = blockContainer.dataset.blockId;
                            if (blockId && window.parent && window.parent.builder) {
                                window.parent.builder.openBlockEditor(blockId);
                            }
                        }
                    });
                    
                    // Prevent form submissions in preview
                    document.addEventListener('submit', function(e) {
                        e.preventDefault();
                        alert('Form submission is disabled in preview mode');
                    });
                </script>
            </body>
            </html>
        `;
    }
    
    renderNavigation() {
        if (!this.currentSite || !this.currentSite.pages) {
            return '';
        }
        
        const pages = Object.keys(this.currentSite.pages)
            .filter(pageId => this.currentSite.pages[pageId].active)
            .map(pageId => {
                const page = this.currentSite.pages[pageId];
                const isActive = pageId === this.currentPage;
                return `
                    <li>
                        <a href="#${pageId}" 
                           class="nav-link ${isActive ? 'active' : ''}"
                           onclick="switchPreviewPage('${pageId}')">
                            ${page.name}
                        </a>
                    </li>
                `;
            }).join('');
        
        return `
            <nav class="main-navigation" style="background: var(--background-color); border-bottom: 1px solid #e1e5e9; padding: 15px 0; position: sticky; top: 0; z-index: 100;">
                <div class="container">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="logo">
                            <h2 style="margin: 0; color: var(--primary-color);">${this.currentSite.title}</h2>
                        </div>
                        <ul style="display: flex; list-style: none; margin: 0; padding: 0; gap: 30px;">
                            ${pages}
                        </ul>
                    </div>
                </div>
            </nav>
            
            <style>
                .nav-link {
                    text-decoration: none;
                    color: var(--text-color);
                    font-weight: 500;
                    padding: 8px 0;
                    border-bottom: 2px solid transparent;
                    transition: all 0.3s ease;
                }
                
                .nav-link:hover,
                .nav-link.active {
                    color: var(--primary-color);
                    border-bottom-color: var(--primary-color);
                }
                
                @media (max-width: 768px) {
                    .main-navigation .container > div {
                        flex-direction: column;
                        gap: 15px;
                    }
                    
                    .main-navigation ul {
                        flex-wrap: wrap;
                        justify-content: center;
                        gap: 20px;
                    }
                }
            </style>
        `;
    }
    
    renderFooter() {
        const currentYear = new Date().getFullYear();
        const contactInfo = this.currentSite?.settings?.contact || {};
        
        return `
            <footer style="background: var(--secondary-color); padding: 50px 0 30px 0; margin-top: 80px; border-top: 1px solid #e1e5e9;">
                <div class="container">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 40px; margin-bottom: 30px;">
                        <div>
                            <h3 style="color: var(--primary-color); margin-bottom: 20px;">${this.currentSite?.title || 'Photography Studio'}</h3>
                            <p style="color: #666; line-height: 1.6;">
                                Professional photography services capturing life's most precious moments with artistic vision and technical excellence.
                            </p>
                        </div>
                        
                        <div>
                            <h4 style="color: var(--primary-color); margin-bottom: 15px;">Services</h4>
                            <ul style="list-style: none; padding: 0;">
                                <li style="margin-bottom: 8px;"><a href="#" style="color: #666; text-decoration: none;">Portrait Photography</a></li>
                                <li style="margin-bottom: 8px;"><a href="#" style="color: #666; text-decoration: none;">Wedding Photography</a></li>
                                <li style="margin-bottom: 8px;"><a href="#" style="color: #666; text-decoration: none;">Event Photography</a></li>
                                <li style="margin-bottom: 8px;"><a href="#" style="color: #666; text-decoration: none;">Commercial Work</a></li>
                            </ul>
                        </div>
                        
                        <div>
                            <h4 style="color: var(--primary-color); margin-bottom: 15px;">Contact Info</h4>
                            <div style="color: #666;">
                                ${contactInfo.email ? `<p style="margin-bottom: 8px;">Email: <a href="mailto:${contactInfo.email}" style="color: var(--primary-color);">${contactInfo.email}</a></p>` : ''}
                                ${contactInfo.phone ? `<p style="margin-bottom: 8px;">Phone: <a href="tel:${contactInfo.phone}" style="color: var(--primary-color);">${contactInfo.phone}</a></p>` : ''}
                                ${contactInfo.address ? `<p style="margin-bottom: 8px;">Address: ${contactInfo.address}</p>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div style="border-top: 1px solid #e1e5e9; padding-top: 20px; text-align: center; color: #666;">
                        <p>&copy; ${currentYear} ${this.currentSite?.title || 'Photography Studio'}. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        `;
    }
    
    renderEmptyState() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Website Builder Preview</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 80px 20px;
                        text-align: center;
                        background: #f8f9fa;
                        color: #333;
                    }
                    .empty-state {
                        max-width: 500px;
                        margin: 0 auto;
                    }
                    .empty-state h2 {
                        color: #666;
                        font-size: 24px;
                        margin-bottom: 15px;
                    }
                    .empty-state p {
                        color: #888;
                        font-size: 16px;
                        line-height: 1.6;
                    }
                </style>
            </head>
            <body>
                <div class="empty-state">
                    <h2>Start Building Your Website</h2>
                    <p>Add content blocks from the right panel to begin creating your professional photography website.</p>
                </div>
            </body>
            </html>
        `;
    }
    
    renderPageNotFound(pageId) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Page Not Found</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 80px 20px;
                        text-align: center;
                        background: #f8f9fa;
                        color: #333;
                    }
                    .error-state {
                        max-width: 500px;
                        margin: 0 auto;
                    }
                </style>
            </head>
            <body>
                <div class="error-state">
                    <h2>Page "${pageId}" not found</h2>
                    <p>This page doesn't exist or has been removed.</p>
                </div>
            </body>
            </html>
        `;
    }
    
    renderEmptyPageContent(pageId) {
        return `
            <div style="text-align: center; padding: 80px 20px; color: #666;">
                <h3>This page is empty</h3>
                <p>Add content blocks to start building your ${pageId} page.</p>
            </div>
        `;
    }
    
    generateCustomCSS() {
        // Generate custom CSS based on site settings
        const fontFamilies = {
            modern: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            classic: 'Georgia, "Times New Roman", serif',
            elegant: '"Playfair Display", Georgia, serif',
            minimal: '"Helvetica Neue", Arial, sans-serif',
            bold: '"Oswald", "Arial Black", sans-serif'
        };
        
        return `
            /* Custom site-specific styles */
            :root {
                --site-font: ${fontFamilies[this.fontStyle] || fontFamilies.modern};
            }
            
            body {
                font-family: var(--site-font) !important;
            }
            
            h1, h2, h3, h4, h5, h6 {
                font-family: var(--site-font) !important;
            }
            
            /* Custom animations */
            .block-container {
                animation: fadeInUp 0.6s ease-out;
            }
            
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Hover effects */
            .gallery img:hover,
            .card:hover {
                transform: translateY(-5px) scale(1.02);
                transition: transform 0.3s ease;
            }
            
            /* Button animations */
            .btn {
                position: relative;
                overflow: hidden;
            }
            
            .btn::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: rgba(255,255,255,0.3);
                border-radius: 50%;
                transition: all 0.3s ease;
                transform: translate(-50%, -50%);
            }
            
            .btn:hover::before {
                width: 100%;
                height: 100%;
            }
        `;
    }
    
    updatePreviewFrame(iframe) {
        if (!iframe) return;
        
        const content = this.renderPage();
        iframe.srcdoc = content;
    }
    
    switchPage(pageId) {
        this.currentPage = pageId;
        return this.renderPage(pageId);
    }
}

// Create global instance
const previewRenderer = new PreviewRenderer();

// Global function for page switching in preview
window.switchPreviewPage = function(pageId) {
    if (window.parent && window.parent.builder) {
        window.parent.builder.switchPage(pageId);
    }
};
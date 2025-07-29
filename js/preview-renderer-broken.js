// Preview Renderer with Click-to-Edit Functionality
class PreviewRenderer {
    constructor() {
        this.selectedElement = null;
        this.editingMode = true;
        this.currentTemplate = null;
        this.currentPage = 'home';
        this.editableElements = {};
        
        this.initializeRenderer();
    }
    
    initializeRenderer() {
        console.log('🎨 Initializing Preview Renderer with click-to-edit');
        this.setupClickHandlers();
    }
    
    setupClickHandlers() {
        // Listen for messages from iframe
        window.addEventListener('message', (event) => {
            if (event.data.type === 'elementClicked') {
                this.handleElementClick(event.data);
            }
        });
    }
    
    generateInteractiveHTML(template, page) {
        console.log('🏗️ Generating interactive HTML for page:', page);
        
        try {
            if (!template) {
                console.error('❌ No template provided');
                return this.generateErrorHTML(page);
            }
            
            if (!template.structure) {
                console.error('❌ Template has no structure');
                return this.generateErrorHTML(page);
            }
            
            if (!template.structure[page]) {
                console.log('🔄 Page not found in template structure, creating default page structure');
                // Create default page structure for new pages
                template.structure[page] = {
                    title: page.charAt(0).toUpperCase() + page.slice(1),
                    subtitle: 'New page content goes here',
                    content: {
                        title: 'Welcome to ' + page.charAt(0).toUpperCase() + page.slice(1),
                        text: 'This is your new page. Click on any text to edit it.'
                    }
                };
            }
            
            const pageData = template.structure[page];
            let html = this.generateBaseHTML(template, page);
            
            // Add click-to-edit functionality
            html = this.addInteractiveElements(html, page);
            
            return html;
        } catch (error) {
            console.error('❌ Error generating interactive HTML:', error);
            return this.generateErrorHTML(page);
        }
    }
    
    generateBaseHTML(template, page) {
        try {
            const pageData = template.structure[page] || {};
            const colors = template.colors || { primary: '#667eea', secondary: '#764ba2', accent: '#f8f9fa' };
            const fonts = template.fonts || { heading: 'Playfair Display', body: 'Open Sans' };
            const templateName = template.name || 'Photography Studio';
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${templateName} - ${page}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: '${fonts.body}', sans-serif;
                        line-height: 1.6;
                        color: #2c3e50;
                        background: ${colors.accent};
                        cursor: default;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        font-family: '${fonts.heading}', serif;
                        color: ${colors.primary};
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 0 20px;
                    }
                    
                    /* Interactive editing styles */
                    .editable {
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer !important;
                    }
                    .editable:hover {
                        outline: 2px dashed ${colors.primary};
                        outline-offset: 2px;
                        background: rgba(102, 126, 234, 0.1);
                    }
                    .editable.selected {
                        outline: 2px solid ${colors.primary};
                        outline-offset: 2px;
                        background: rgba(102, 126, 234, 0.2);
                    }
                    .edit-tooltip {
                        position: absolute;
                        top: -30px;
                        left: 0;
                        background: ${colors.primary};
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        pointer-events: none;
                        opacity: 0;
                        transition: opacity 0.2s;
                        z-index: 1000;
                    }
                    .editable:hover .edit-tooltip {
                        opacity: 1;
                    }
                    
                    /* Navigation */
                    .nav {
                        background: rgba(255, 255, 255, 0.95);
                        padding: 1rem 0;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        position: sticky;
                        top: 0;
                        z-index: 100;
                    }
                    .nav-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .nav-brand {
                        font-size: 1.5rem;
                        font-weight: bold;
                        color: ${colors.primary};
                        text-decoration: none;
                    }
                    .nav-links {
                        display: flex;
                        list-style: none;
                        gap: 2rem;
                    }
                    .nav-links a {
                        text-decoration: none;
                        color: #333;
                        font-weight: 500;
                        transition: color 0.3s;
                    }
                    .nav-links a:hover {
                        color: ${colors.primary};
                    }
                    
                    /* Hero Section */
                    .hero {
                        background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
                        color: white;
                        padding: 4rem 0;
                        text-align: center;
                        min-height: 60vh;
                        display: flex;
                        align-items: center;
                        background-size: cover;
                        background-position: center;
                        position: relative;
                    }
                    .hero::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.4);
                    }
                    .hero-content {
                        position: relative;
                        z-index: 2;
                    }
                    .hero h1 {
                        font-size: 3rem;
                        margin-bottom: 1rem;
                        color: white;
                    }
                    .hero p {
                        font-size: 1.3rem;
                        margin-bottom: 2rem;
                        opacity: 0.9;
                    }
                    .btn {
                        display: inline-block;
                        padding: 12px 30px;
                        background: ${colors.accent};
                        color: ${colors.primary};
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                        transition: all 0.3s;
                        border: none;
                        cursor: pointer;
                    }
                    .btn:hover {
                        background: white;
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    }
                    
                    /* Content Sections */
                    .section {
                        padding: 4rem 0;
                    }
                    .section h2 {
                        text-align: center;
                        margin-bottom: 3rem;
                        font-size: 2.5rem;
                    }
                    .section p {
                        text-align: center;
                        max-width: 800px;
                        margin: 0 auto 2rem;
                        font-size: 1.1rem;
                    }
                    
                    /* Gallery Grid */
                    .gallery-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 2rem;
                        margin-top: 3rem;
                    }
                    .gallery-item {
                        aspect-ratio: 4/3;
                        background: #ddd;
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                        transition: transform 0.3s;
                    }
                    .gallery-item:hover {
                        transform: translateY(-5px);
                    }
                    .gallery-item img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    
                    /* Contact Form */
                    .contact-form {
                        max-width: 600px;
                        margin: 0 auto;
                        background: white;
                        padding: 2rem;
                        border-radius: 10px;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    }
                    .form-group {
                        margin-bottom: 1.5rem;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: bold;
                        color: ${colors.primary};
                    }
                    .form-group input,
                    .form-group textarea {
                        width: 100%;
                        padding: 10px;
                        border: 2px solid #ddd;
                        border-radius: 5px;
                        font-size: 1rem;
                        transition: border-color 0.3s;
                    }
                    .form-group input:focus,
                    .form-group textarea:focus {
                        outline: none;
                        border-color: ${colors.primary};
                    }
                    
                    @media (max-width: 768px) {
                        .hero h1 { font-size: 2rem; }
                        .hero p { font-size: 1.1rem; }
                        .section h2 { font-size: 2rem; }
                        .nav-links { display: none; }
                    }
                </style>
            </head>
            <body>
                ${this.generatePageContent(pageData, page, template)}
            </body>
            </html>
        `;
        } catch (error) {
            console.error('❌ Error in generateBaseHTML:', error);
            return this.generateErrorHTML(page);
        }
                
                <script>
                    // Click-to-edit functionality
                    document.addEventListener('DOMContentLoaded', function() {
                        console.log('🎯 Setting up click-to-edit in preview');
                        
                        // Add click handlers to all editable elements
                        document.querySelectorAll('.editable').forEach(element => {
                            element.addEventListener('click', function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Remove previous selections
                                document.querySelectorAll('.editable.selected').forEach(el => {
                                    el.classList.remove('selected');
                                });
                                
                                // Select current element
                                this.classList.add('selected');
                                
                                // Send message to parent window
                                const elementData = {
                                    type: 'elementClicked',
                                    elementType: this.dataset.editType,
                                    elementId: this.dataset.editId,
                                    currentValue: this.textContent.trim(),
                                    currentSrc: this.src || this.style.backgroundImage,
                                    rect: this.getBoundingClientRect()
                                };
                                
                                console.log('📝 Element clicked:', elementData);
                                parent.postMessage(elementData, '*');
                            });
                        });
                        
                        // Add tooltips
                        document.querySelectorAll('.editable').forEach(element => {
                            const tooltip = document.createElement('div');
                            tooltip.className = 'edit-tooltip';
                            tooltip.textContent = 'Click to edit ' + (element.dataset.editType || 'element');
                            element.appendChild(tooltip);
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }
    
    generatePageContent(pageData, page, template) {
        try {
            switch(page) {
                case 'home':
                    return this.generateHomePage(pageData, template);
                case 'about':
                    return this.generateAboutPage(pageData, template);
                case 'portfolio':
                    return this.generatePortfolioPage(pageData, template);
                case 'contact':
                    return this.generateContactPage(pageData, template);
                default:
                    return this.generateCustomPage(pageData, template, page);
            }
        } catch (error) {
            console.error('❌ Error generating page content for', page, ':', error);
            return this.generateCustomPage(pageData || {}, template, page);
        }
    }
    
    generateHomePage(pageData, template) {
        try {
            const hero = pageData.hero || {};
            const about = pageData.about || {};
            const gallery = pageData.gallery || {};
            const templateName = template.name || 'Photography Studio';
        
            return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-container">
                        <a href="#home" class="nav-brand editable" data-edit-type="text" data-edit-id="site-title">${template.name}</a>
                        <ul class="nav-links">
                            <li><a href="#home">Home</a></li>
                            <li><a href="#about">About</a></li>
                            <li><a href="#portfolio">Portfolio</a></li>
                            <li><a href="#contact">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero" style="background-image: url('${hero.background || ''}')">
                <div class="container">
                    <div class="hero-content">
                        <h1 class="editable" data-edit-type="text" data-edit-id="hero-title">${hero.title || 'Your Photography Studio'}</h1>
                        <p class="editable" data-edit-type="text" data-edit-id="hero-subtitle">${hero.subtitle || 'Capturing life\'s precious moments'}</p>
                        <a href="#contact" class="btn editable" data-edit-type="button" data-edit-id="hero-cta">Get Started</a>
                    </div>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <h2 class="editable" data-edit-type="text" data-edit-id="about-title">${about.title || 'About Our Studio'}</h2>
                    <p class="editable" data-edit-type="text" data-edit-id="about-content">${about.content || 'We are passionate photographers dedicated to capturing your most important moments with artistry and care.'}</p>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <h2 class="editable" data-edit-type="text" data-edit-id="gallery-title">${gallery.title || 'Our Work'}</h2>
                    <div class="gallery-grid">
                        ${this.generateGalleryImages(gallery.images || [])}
                    </div>
                </div>
            </section>
        `;
    }
    
    generateAboutPage(pageData, template) {
        const hero = pageData.hero || {};
        const content = pageData.content || {};
        
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-container">
                        <a href="#home" class="nav-brand editable" data-edit-type="text" data-edit-id="site-title">${template.name}</a>
                        <ul class="nav-links">
                            <li><a href="#home">Home</a></li>
                            <li><a href="#about">About</a></li>
                            <li><a href="#portfolio">Portfolio</a></li>
                            <li><a href="#contact">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero" style="background-image: url('${hero.background || ''}')">
                <div class="container">
                    <div class="hero-content">
                        <h1 class="editable" data-edit-type="text" data-edit-id="about-hero-title">${hero.title || 'About Us'}</h1>
                        <p class="editable" data-edit-type="text" data-edit-id="about-hero-subtitle">${hero.subtitle || 'Our story and passion'}</p>
                    </div>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <h2 class="editable" data-edit-type="text" data-edit-id="about-content-title">${content.title || 'Our Story'}</h2>
                    <p class="editable" data-edit-type="text" data-edit-id="about-content-text">${content.text || 'We are passionate photographers with years of experience capturing life\'s most precious moments.'}</p>
                    <p class="editable" data-edit-type="text" data-edit-id="about-experience"><strong>Experience:</strong> ${content.experience || '10+ years in photography'}</p>
                    <p class="editable" data-edit-type="text" data-edit-id="about-specialty"><strong>Specialty:</strong> ${content.specialty || 'Wedding, portrait, and event photography'}</p>
                </div>
            </section>
        `;
    }
    
    generatePortfolioPage(pageData, template) {
        const hero = pageData.hero || {};
        const galleries = pageData.galleries || [];
        
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-container">
                        <a href="#home" class="nav-brand editable" data-edit-type="text" data-edit-id="site-title">${template.name}</a>
                        <ul class="nav-links">
                            <li><a href="#home">Home</a></li>
                            <li><a href="#about">About</a></li>
                            <li><a href="#portfolio">Portfolio</a></li>
                            <li><a href="#contact">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero" style="background-image: url('${hero.background || ''}')">
                <div class="container">
                    <div class="hero-content">
                        <h1 class="editable" data-edit-type="text" data-edit-id="portfolio-hero-title">${hero.title || 'Our Portfolio'}</h1>
                        <p class="editable" data-edit-type="text" data-edit-id="portfolio-hero-subtitle">${hero.subtitle || 'Showcasing our best work'}</p>
                    </div>
                </div>
            </section>
            
            ${galleries.map((gallery, index) => `
                <section class="section">
                    <div class="container">
                        <h2 class="editable" data-edit-type="text" data-edit-id="gallery-${index}-title">${gallery.title || 'Gallery'}</h2>
                        <div class="gallery-grid">
                            ${this.generateGalleryImages(gallery.images || [])}
                        </div>
                    </div>
                </section>
            `).join('')}
        `;
    }
    
    generateContactPage(pageData, template) {
        const hero = pageData.hero || {};
        const contact = pageData.contact || {};
        const form = pageData.form || {};
        
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-container">
                        <a href="#home" class="nav-brand editable" data-edit-type="text" data-edit-id="site-title">${template.name}</a>
                        <ul class="nav-links">
                            <li><a href="#home">Home</a></li>
                            <li><a href="#about">About</a></li>
                            <li><a href="#portfolio">Portfolio</a></li>
                            <li><a href="#contact">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero" style="background-image: url('${hero.background || ''}')">
                <div class="container">
                    <div class="hero-content">
                        <h1 class="editable" data-edit-type="text" data-edit-id="contact-hero-title">${hero.title || 'Contact Us'}</h1>
                        <p class="editable" data-edit-type="text" data-edit-id="contact-hero-subtitle">${hero.subtitle || 'Let\'s create something beautiful together'}</p>
                    </div>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <h2 class="editable" data-edit-type="text" data-edit-id="contact-info-title">${contact.title || 'Get In Touch'}</h2>
                    <p class="editable" data-edit-type="text" data-edit-id="contact-email"><strong>Email:</strong> ${contact.email || 'hello@studio.com'}</p>
                    <p class="editable" data-edit-type="text" data-edit-id="contact-phone"><strong>Phone:</strong> ${contact.phone || '+1 (555) 123-4567'}</p>
                    <p class="editable" data-edit-type="text" data-edit-id="contact-address"><strong>Address:</strong> ${contact.address || 'Studio Address'}</p>
                    
                    <div class="contact-form">
                        <h3 class="editable" data-edit-type="text" data-edit-id="form-title">${form.title || 'Send us a message'}</h3>
                        <form>
                            <div class="form-group">
                                <label for="name">Name</label>
                                <input type="text" id="name" name="name" required>
                            </div>
                            <div class="form-group">
                                <label for="email">Email</label>
                                <input type="email" id="email" name="email" required>
                            </div>
                            <div class="form-group">
                                <label for="message">Message</label>
                                <textarea id="message" name="message" rows="5" required></textarea>
                            </div>
                            <button type="submit" class="btn editable" data-edit-type="button" data-edit-id="form-submit">Send Message</button>
                        </form>
                    </div>
                </div>
            </section>
        `;
    }
    
    generateCustomPage(pageData, template, page) {
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-container">
                        <a href="#home" class="nav-brand editable" data-edit-type="text" data-edit-id="site-title">${template.name}</a>
                        <ul class="nav-links">
                            <li><a href="#home">Home</a></li>
                            <li><a href="#about">About</a></li>
                            <li><a href="#portfolio">Portfolio</a></li>
                            <li><a href="#contact">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero">
                <div class="container">
                    <div class="hero-content">
                        <h1 class="editable" data-edit-type="text" data-edit-id="${page}-title">${pageData.title || page.charAt(0).toUpperCase() + page.slice(1)}</h1>
                        <p class="editable" data-edit-type="text" data-edit-id="${page}-subtitle">Page content goes here</p>
                    </div>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <h2 class="editable" data-edit-type="text" data-edit-id="${page}-content-title">Content Title</h2>
                    <p class="editable" data-edit-type="text" data-edit-id="${page}-content-text">Add your content here by clicking on this text.</p>
                </div>
            </section>
        `;
    }
    
    generateGalleryImages(images) {
        return images.map((image, index) => `
            <div class="gallery-item">
                <img src="${image}" alt="Gallery Image ${index + 1}" class="editable" data-edit-type="image" data-edit-id="gallery-image-${index}">
            </div>
        `).join('');
    }
    
    generateErrorHTML(page) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Error Loading Page</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
                    .error { color: #dc3545; }
                </style>
            </head>
            <body>
                <h1 class="error">Error Loading ${page} Page</h1>
                <p>The template structure is missing or invalid for this page.</p>
            </body>
            </html>
        `;
    }
    
    addInteractiveElements(html, page) {
        // This method would enhance HTML with additional interactive elements
        // For now, the base HTML generation already includes interactive elements
        return html;
    }
    
    handleElementClick(data) {
        console.log('🎯 Element clicked in preview:', data);
        
        // Create edit dialog or update right panel
        this.showElementEditor(data);
    }
    
    showElementEditor(elementData) {
        // Show editing interface in the right panel
        const contentPanel = document.getElementById('content-panel');
        if (!contentPanel) return;
        
        // Switch to content panel if not active
        showPanel('content');
        
        // Update content panel with element-specific controls
        let editorHTML = `
            <h3>Edit ${elementData.elementType}</h3>
            <div class="form-group">
                <label for="element-editor-input">Current ${elementData.elementType}:</label>
        `;
        
        if (elementData.elementType === 'image') {
            editorHTML += `<input type="url" id="element-editor-input" value="${elementData.currentSrc}" placeholder="Image URL">`;
        } else if (elementData.elementType === 'button') {
            editorHTML += `<input type="text" id="element-editor-input" value="${elementData.currentValue}" placeholder="Button text">`;
        } else {
            editorHTML += `<textarea id="element-editor-input" rows="3" placeholder="Enter text">${elementData.currentValue}</textarea>`;
        }
        
        editorHTML += `
            </div>
            <button onclick="updateElement('${elementData.elementId}', '${elementData.elementType}')" class="btn">Update ${elementData.elementType}</button>
        `;
        
        contentPanel.innerHTML = editorHTML;
    }
}

// Create global instance
window.previewRenderer = new PreviewRenderer();

// Global function to update elements
function updateElement(elementId, elementType) {
    const input = document.getElementById('element-editor-input');
    const newValue = input.value;
    
    console.log('📝 Updating element:', elementId, 'with value:', newValue);
    
    // Update the preview
    const iframe = document.getElementById('preview-iframe');
    if (iframe && iframe.contentDocument) {
        const element = iframe.contentDocument.querySelector(`[data-edit-id="${elementId}"]`);
        if (element) {
            if (elementType === 'image') {
                element.src = newValue;
            } else {
                element.textContent = newValue;
            }
            
            // Update the template data
            updateTemplateData(elementId, newValue);
            
            // Show success message
            showMessage('Element updated successfully!', 'success');
        }
    }
}

function updateTemplateData(elementId, newValue) {
    // This would update the template structure data
    // Implementation depends on how template data is stored
    console.log('💾 Updating template data:', elementId, newValue);
}
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
                    .nav {
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(10px);
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        z-index: 1000;
                        box-shadow: 0 2px 20px rgba(0,0,0,0.1);
                    }
                    .nav-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1rem 0;
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
                        color: #333;
                        text-decoration: none;
                        font-weight: 500;
                        transition: color 0.3s;
                    }
                    .nav-links a:hover {
                        color: ${colors.primary};
                    }
                    .hero {
                        background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
                        color: white;
                        text-align: center;
                        padding: 120px 0 80px;
                        margin-top: 80px;
                    }
                    .hero h1 {
                        font-size: 3rem;
                        margin-bottom: 1rem;
                        color: white;
                    }
                    .hero p {
                        font-size: 1.3rem;
                        opacity: 0.9;
                    }
                    .section {
                        padding: 60px 0;
                    }
                    .section h2 {
                        font-size: 2.5rem;
                        text-align: center;
                        margin-bottom: 3rem;
                    }
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 2rem;
                        margin-top: 2rem;
                    }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 2rem;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        transition: transform 0.3s;
                    }
                    .card:hover {
                        transform: translateY(-5px);
                    }
                    .button {
                        display: inline-block;
                        background: ${colors.primary};
                        color: white;
                        padding: 12px 30px;
                        border-radius: 25px;
                        text-decoration: none;
                        font-weight: 500;
                        transition: all 0.3s;
                        border: none;
                        cursor: pointer;
                    }
                    .button:hover {
                        background: ${colors.secondary};
                        transform: translateY(-2px);
                    }
                    .gallery {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1rem;
                        margin-top: 2rem;
                    }
                    .gallery img {
                        width: 100%;
                        height: 200px;
                        object-fit: cover;
                        border-radius: 8px;
                        transition: transform 0.3s;
                    }
                    .gallery img:hover {
                        transform: scale(1.05);
                    }
                    .form-group {
                        margin-bottom: 1.5rem;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: 500;
                    }
                    .form-group input,
                    .form-group textarea {
                        width: 100%;
                        padding: 12px;
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
                    
                    /* Editable element styles */
                    .editable {
                        position: relative;
                        transition: all 0.2s ease;
                    }
                    .editable:hover {
                        outline: 2px solid ${colors.primary};
                        outline-offset: 2px;
                        cursor: pointer;
                    }
                    .editable.selected {
                        outline: 3px solid ${colors.secondary};
                        outline-offset: 3px;
                        background: rgba(102, 126, 234, 0.1);
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
                    });
                    
                    // Function to change pages within preview
                    function changePage(page) {
                        parent.postMessage({
                            type: 'pageChanged',
                            page: page
                        }, '*');
                </script>
            </body>
            </html>
        `;
        } catch (error) {
            console.error('❌ Error in generateBaseHTML:', error);
            return this.generateErrorHTML(page);
        }
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
                    <div class="nav-header">
                        <a href="#home" class="nav-brand editable" data-edit-type="text" data-edit-id="site-title">${templateName}</a>
                        <ul class="nav-links">
                            <li><a href="#home" onclick="changePage('home')">Home</a></li>
                            <li><a href="#about" onclick="changePage('about')">About</a></li>
                            <li><a href="#portfolio" onclick="changePage('portfolio')">Portfolio</a></li>
                            <li><a href="#contact" onclick="changePage('contact')">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero">
                <div class="container">
                    <h1 class="editable" data-edit-type="text" data-edit-id="hero-title">${hero.title || 'Capturing Love Stories'}</h1>
                    <p class="editable" data-edit-type="text" data-edit-id="hero-subtitle">${hero.subtitle || 'Professional photography that tells your unique story'}</p>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <h2 class="editable" data-edit-type="text" data-edit-id="about-title">${about.title || 'About Our Studio'}</h2>
                    <div class="grid">
                        <div class="card">
                            <h3 class="editable" data-edit-type="text" data-edit-id="about-card-1-title">Professional Excellence</h3>
                            <p class="editable" data-edit-type="text" data-edit-id="about-card-1-text">With years of experience, we deliver stunning photography that captures your most precious moments.</p>
                        </div>
                        <div class="card">
                            <h3 class="editable" data-edit-type="text" data-edit-id="about-card-2-title">Personal Touch</h3>
                            <p class="editable" data-edit-type="text" data-edit-id="about-card-2-text">Every session is tailored to your unique style and personality, ensuring authentic and beautiful results.</p>
                        </div>
                        <div class="card">
                            <h3 class="editable" data-edit-type="text" data-edit-id="about-card-3-title">Lasting Memories</h3>
                            <p class="editable" data-edit-type="text" data-edit-id="about-card-3-text">We create timeless images that you'll treasure for generations, preserving your most important moments.</p>
                        </div>
                    </div>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <h2 class="editable" data-edit-type="text" data-edit-id="gallery-title">${gallery.title || 'Featured Work'}</h2>
                    <div class="gallery">
                        <img class="editable" data-edit-type="image" data-edit-id="gallery-1" src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400" alt="Portfolio Image 1">
                        <img class="editable" data-edit-type="image" data-edit-id="gallery-2" src="https://images.unsplash.com/photo-1519741497674-611481863552?w=400" alt="Portfolio Image 2">
                        <img class="editable" data-edit-type="image" data-edit-id="gallery-3" src="https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400" alt="Portfolio Image 3">
                        <img class="editable" data-edit-type="image" data-edit-id="gallery-4" src="https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400" alt="Portfolio Image 4">
                    </div>
                    <div style="text-align: center; margin-top: 2rem;">
                        <a href="#portfolio" class="button editable" data-edit-type="text" data-edit-id="gallery-cta">View Full Portfolio</a>
                    </div>
                </div>
            </section>
        `;
        } catch (error) {
            console.error('❌ Error generating home page:', error);
            return this.generateCustomPage(pageData || {}, template, 'home');
        }
    }
    
    generateAboutPage(pageData, template) {
        const templateName = template.name || 'Photography Studio';
        const about = pageData.about || {};
        
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-header">
                        <a href="#home" class="nav-brand">${templateName}</a>
                        <ul class="nav-links">
                            <li><a href="#home" onclick="changePage('home')">Home</a></li>
                            <li><a href="#about" onclick="changePage('about')">About</a></li>
                            <li><a href="#portfolio" onclick="changePage('portfolio')">Portfolio</a></li>
                            <li><a href="#contact" onclick="changePage('contact')">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero">
                <div class="container">
                    <h1 class="editable" data-edit-type="text" data-edit-id="about-hero-title">${about.title || 'About Our Story'}</h1>
                    <p class="editable" data-edit-type="text" data-edit-id="about-hero-subtitle">${about.subtitle || 'Passionate photographers dedicated to capturing your special moments'}</p>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <div class="grid">
                        <div class="card">
                            <h3 class="editable" data-edit-type="text" data-edit-id="about-experience-title">Our Experience</h3>
                            <p class="editable" data-edit-type="text" data-edit-id="about-experience-text">With over 10 years in the photography industry, we've captured thousands of precious moments for families, couples, and businesses across the region.</p>
                        </div>
                        <div class="card">
                            <h3 class="editable" data-edit-type="text" data-edit-id="about-approach-title">Our Approach</h3>
                            <p class="editable" data-edit-type="text" data-edit-id="about-approach-text">We believe in creating a comfortable, relaxed environment where authentic emotions can shine through, resulting in natural and beautiful photographs.</p>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }
    
    generatePortfolioPage(pageData, template) {
        const templateName = template.name || 'Photography Studio';
        const portfolio = pageData.portfolio || {};
        
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-header">
                        <a href="#home" class="nav-brand">${templateName}</a>
                        <ul class="nav-links">
                            <li><a href="#home" onclick="changePage('home')">Home</a></li>
                            <li><a href="#about" onclick="changePage('about')">About</a></li>
                            <li><a href="#portfolio" onclick="changePage('portfolio')">Portfolio</a></li>
                            <li><a href="#contact" onclick="changePage('contact')">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero">
                <div class="container">
                    <h1 class="editable" data-edit-type="text" data-edit-id="portfolio-hero-title">${portfolio.title || 'Our Portfolio'}</h1>
                    <p class="editable" data-edit-type="text" data-edit-id="portfolio-hero-subtitle">${portfolio.subtitle || 'A collection of our finest work'}</p>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <div class="gallery">
                        <img class="editable" data-edit-type="image" data-edit-id="portfolio-1" src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400" alt="Portfolio Image 1">
                        <img class="editable" data-edit-type="image" data-edit-id="portfolio-2" src="https://images.unsplash.com/photo-1519741497674-611481863552?w=400" alt="Portfolio Image 2">
                        <img class="editable" data-edit-type="image" data-edit-id="portfolio-3" src="https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400" alt="Portfolio Image 3">
                        <img class="editable" data-edit-type="image" data-edit-id="portfolio-4" src="https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400" alt="Portfolio Image 4">
                        <img class="editable" data-edit-type="image" data-edit-id="portfolio-5" src="https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400" alt="Portfolio Image 5">
                        <img class="editable" data-edit-type="image" data-edit-id="portfolio-6" src="https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400" alt="Portfolio Image 6">
                    </div>
                </div>
            </section>
        `;
    }
    
    generateContactPage(pageData, template) {
        const templateName = template.name || 'Photography Studio';
        const contact = pageData.contact || {};
        
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-header">
                        <a href="#home" class="nav-brand">${templateName}</a>
                        <ul class="nav-links">
                            <li><a href="#home" onclick="changePage('home')">Home</a></li>
                            <li><a href="#about" onclick="changePage('about')">About</a></li>
                            <li><a href="#portfolio" onclick="changePage('portfolio')">Portfolio</a></li>
                            <li><a href="#contact" onclick="changePage('contact')">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero">
                <div class="container">
                    <h1 class="editable" data-edit-type="text" data-edit-id="contact-hero-title">${contact.title || 'Get In Touch'}</h1>
                    <p class="editable" data-edit-type="text" data-edit-id="contact-hero-subtitle">${contact.subtitle || 'Ready to capture your special moments? Let\'s talk!'}</p>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <div class="grid">
                        <div class="card">
                            <h3>Contact Form</h3>
                            <form>
                                <div class="form-group">
                                    <label>Name</label>
                                    <input type="text" placeholder="Your Name">
                                </div>
                                <div class="form-group">
                                    <label>Email</label>
                                    <input type="email" placeholder="your@email.com">
                                </div>
                                <div class="form-group">
                                    <label>Message</label>
                                    <textarea rows="5" placeholder="Tell us about your photography needs..."></textarea>
                                </div>
                                <button type="submit" class="button">Send Message</button>
                            </form>
                        </div>
                        <div class="card">
                            <h3>Contact Information</h3>
                            <p class="editable" data-edit-type="text" data-edit-id="contact-email">Email: hello@studio.com</p>
                            <p class="editable" data-edit-type="text" data-edit-id="contact-phone">Phone: (555) 123-4567</p>
                            <p class="editable" data-edit-type="text" data-edit-id="contact-address">Location: Your City, State</p>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }
    
    generateCustomPage(pageData, template, page) {
        const templateName = template.name || 'Photography Studio';
        const title = (pageData.title || page.charAt(0).toUpperCase() + page.slice(1));
        const content = pageData.content || {};
        
        return `
            <nav class="nav">
                <div class="container">
                    <div class="nav-header">
                        <a href="#home" class="nav-brand">${templateName}</a>
                        <ul class="nav-links">
                            <li><a href="#home" onclick="changePage('home')">Home</a></li>
                            <li><a href="#about" onclick="changePage('about')">About</a></li>
                            <li><a href="#portfolio" onclick="changePage('portfolio')">Portfolio</a></li>
                            <li><a href="#contact" onclick="changePage('contact')">Contact</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <section class="hero">
                <div class="container">
                    <h1 class="editable" data-edit-type="text" data-edit-id="${page}-hero-title">${title}</h1>
                    <p class="editable" data-edit-type="text" data-edit-id="${page}-hero-subtitle">${pageData.subtitle || 'Welcome to our ' + page + ' page'}</p>
                </div>
            </section>
            
            <section class="section">
                <div class="container">
                    <div class="card">
                        <h3 class="editable" data-edit-type="text" data-edit-id="${page}-content-title">${content.title || 'Page Content'}</h3>
                        <p class="editable" data-edit-type="text" data-edit-id="${page}-content-text">${content.text || 'This is a new page. Click on any text to edit it and customize your content.'}</p>
                    </div>
                </div>
            </section>
        `;
    }
    
    generateErrorHTML(page) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error - ${page}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
                    .error { color: #e74c3c; font-size: 1.2rem; }
                </style>
            </head>
            <body>
                <h1>Preview Error</h1>
                <p class="error">Unable to generate preview for page: ${page}</p>
                <p>Please try refreshing or check the template configuration.</p>
            </body>
            </html>
        `;
    }
    
    addInteractiveElements(html, page) {
        // Add any additional interactive elements if needed
        return html;
    }
    
    handleElementClick(data) {
        console.log('🎯 Element clicked in preview:', data);
        
        // Switch to content panel when an element is clicked
        if (window.showPanel) {
            window.showPanel('content');
        }
        
        // Update content editing form based on clicked element
        this.updateContentForm(data);
    }
    
    updateContentForm(data) {
        // Update the content editing form with the clicked element's data
        const elementIdField = document.getElementById('element-id');
        const elementTypeField = document.getElementById('element-type');
        const elementValueField = document.getElementById('element-value');
        const textEditor = document.getElementById('text-editor');
        const imageEditor = document.getElementById('image-editor');
        
        if (elementIdField) elementIdField.value = data.elementId || '';
        if (elementTypeField) elementTypeField.value = data.elementType || '';
        
        // Show appropriate editor based on element type
        if (data.elementType === 'text') {
            textEditor.style.display = 'block';
            imageEditor.style.display = 'none';
            if (elementValueField) {
                elementValueField.value = data.currentValue || '';
                elementValueField.focus();
            }
        } else if (data.elementType === 'image') {
            textEditor.style.display = 'none';
            imageEditor.style.display = 'block';
        } else {
            textEditor.style.display = 'none';
            imageEditor.style.display = 'none';
        }
    }
}

// Initialize preview renderer when script loads
if (typeof window !== 'undefined') {
    window.previewRenderer = new PreviewRenderer();
}
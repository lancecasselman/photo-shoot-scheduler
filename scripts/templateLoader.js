// Template Loader for Photography Website Builder

class TemplateLoader {
    constructor() {
        this.templates = new Map();
        this.initializeTemplates();
    }
    
    initializeTemplates() {
        // Define template structures with actual content
        const templateDefinitions = [
            {
                id: 'classic-elegance',
                name: 'Classic Elegance',
                category: 'wedding',
                description: 'Timeless wedding photography with elegant typography and soft colors',
                colors: {
                    primary: '#8B4513',
                    secondary: '#D2B48C',
                    accent: '#F5DEB3',
                    text: '#2C1810'
                },
                fonts: {
                    heading: 'Playfair Display',
                    body: 'Crimson Text'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Capturing Love Stories',
                            subtitle: 'Professional Wedding Photography',
                            background: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'About Our Work',
                            content: 'We specialize in capturing the most precious moments of your special day with timeless elegance and artistic vision.'
                        },
                        gallery: {
                            title: 'Recent Weddings',
                            images: [
                                'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            {
                id: 'modern-minimalist',
                name: 'Modern Minimalist',
                category: 'portrait',
                description: 'Clean, minimal design focusing on your photography work',
                colors: {
                    primary: '#667eea',
                    secondary: '#764ba2',
                    accent: '#f8f9fa',
                    text: '#2c3e50'
                },
                fonts: {
                    heading: 'Inter',
                    body: 'Inter'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Portrait Photography',
                            subtitle: 'Minimal. Modern. Meaningful.',
                            background: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=1200&h=600&fit=crop'
                        }
                    }
                }
            },
            {
                id: 'elegant-studio',
                name: 'Elegant Studio',
                category: 'portrait',
                description: 'Professional studio portrait showcase with sophisticated styling',
                colors: {
                    primary: '#2C3E50',
                    secondary: '#34495E',
                    accent: '#ecf0f1',
                    text: '#2c3e50'
                },
                fonts: {
                    heading: 'Lora',
                    body: 'Open Sans'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Professional Portraits',
                            subtitle: 'Elegant Studio Photography',
                            background: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&h=600&fit=crop'
                        }
                    }
                }
            },
            {
                id: 'creative-portfolio',
                name: 'Creative Portfolio',
                category: 'commercial',
                description: 'Bold, creative design for artistic and commercial photography',
                colors: {
                    primary: '#FF6B6B',
                    secondary: '#4ECDC4',
                    accent: '#FFE66D',
                    text: '#2c3e50'
                },
                fonts: {
                    heading: 'Montserrat',
                    body: 'Source Sans Pro'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Creative Vision',
                            subtitle: 'Commercial & Artistic Photography',
                            background: 'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1200&h=600&fit=crop'
                        }
                    }
                }
            },
            {
                id: 'vintage-charm',
                name: 'Vintage Charm',
                category: 'wedding',
                description: 'Nostalgic design with vintage elements and warm tones',
                colors: {
                    primary: '#8B7355',
                    secondary: '#D4AF37',
                    accent: '#F5E6D3',
                    text: '#3C2E26'
                },
                fonts: {
                    heading: 'Merriweather',
                    body: 'Libre Baskerville'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Vintage Romance',
                            subtitle: 'Timeless Wedding Photography',
                            background: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&h=600&fit=crop'
                        }
                    }
                }
            }
        ];
        
        // Store templates in Map for easy access
        templateDefinitions.forEach(template => {
            this.templates.set(template.id, template);
        });
    }
    
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    
    getAllTemplates() {
        return Array.from(this.templates.values());
    }
    
    getTemplatesByCategory(category) {
        return this.getAllTemplates().filter(template => template.category === category);
    }
    
    generateTemplateHTML(template, pageId = 'home') {
        if (!template || !template.structure[pageId]) {
            return '<div>Template not found</div>';
        }
        
        const page = template.structure[pageId];
        const colors = template.colors;
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${template.name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: '${template.fonts.body}', sans-serif;
                        line-height: 1.6;
                        color: ${colors.text};
                    }
                    h1, h2, h3, h4, h5, h6 {
                        font-family: '${template.fonts.heading}', serif;
                        color: ${colors.primary};
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 0 20px;
                    }
                    .hero {
                        background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${page.hero?.background}');
                        background-size: cover;
                        background-position: center;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        color: white;
                    }
                    .hero h1 {
                        font-size: 4rem;
                        margin-bottom: 20px;
                        color: white;
                    }
                    .hero p {
                        font-size: 1.5rem;
                        margin-bottom: 30px;
                    }
                    .btn {
                        display: inline-block;
                        padding: 15px 30px;
                        background: ${colors.primary};
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: 600;
                        transition: all 0.3s ease;
                    }
                    .btn:hover {
                        background: ${colors.secondary};
                        transform: translateY(-2px);
                    }
                    .section {
                        padding: 80px 0;
                    }
                    .section h2 {
                        font-size: 2.5rem;
                        text-align: center;
                        margin-bottom: 50px;
                    }
                    .gallery {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 20px;
                        margin-top: 40px;
                    }
                    .gallery img {
                        width: 100%;
                        height: 250px;
                        object-fit: cover;
                        border-radius: 8px;
                        transition: transform 0.3s ease;
                    }
                    .gallery img:hover {
                        transform: scale(1.05);
                    }
                    @media (max-width: 768px) {
                        .hero h1 { font-size: 2.5rem; }
                        .hero p { font-size: 1.2rem; }
                        .section { padding: 50px 0; }
                    }
                </style>
                <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(template.fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(template.fonts.body)}:wght@300;400;500&display=swap" rel="stylesheet">
            </head>
            <body>
                <section class="hero">
                    <div class="container">
                        <h1>${page.hero?.title || template.name}</h1>
                        <p>${page.hero?.subtitle || template.description}</p>
                        <a href="#portfolio" class="btn">View Portfolio</a>
                    </div>
                </section>
                
                ${page.about ? `
                    <section class="section">
                        <div class="container">
                            <h2>${page.about.title}</h2>
                            <p style="text-align: center; font-size: 1.2rem; max-width: 800px; margin: 0 auto;">${page.about.content}</p>
                        </div>
                    </section>
                ` : ''}
                
                ${page.gallery ? `
                    <section class="section" id="portfolio">
                        <div class="container">
                            <h2>${page.gallery.title}</h2>
                            <div class="gallery">
                                ${page.gallery.images.map(img => `<img src="${img}" alt="Portfolio image">`).join('')}
                            </div>
                        </div>
                    </section>
                ` : ''}
                
                <section class="section" style="background: ${colors.accent};">
                    <div class="container">
                        <h2>Get In Touch</h2>
                        <p style="text-align: center; font-size: 1.2rem; margin-bottom: 30px;">Ready to capture your special moments?</p>
                        <div style="text-align: center;">
                            <a href="mailto:info@example.com" class="btn">Contact Us</a>
                        </div>
                    </div>
                </section>
            </body>
            </html>
        `;
    }
    
    // Save template selection to Firebase/localStorage
    async saveTemplateSelection(templateId, customizations = {}) {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        
        const siteData = {
            templateId,
            templateName: template.name,
            customizations,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        try {
            // Try to save to Firebase if available
            if (window.firebaseService && window.firebaseService.firestore) {
                await window.firebaseService.saveSite(siteData);
            } else {
                // Fallback to localStorage
                localStorage.setItem('selected_template', JSON.stringify(siteData));
            }
            
            return siteData;
        } catch (error) {
            console.error('Error saving template selection:', error);
            throw error;
        }
    }
    
    // Load saved template data
    async loadSavedTemplate() {
        try {
            // Try Firebase first
            if (window.firebaseService && window.firebaseService.firestore) {
                return await window.firebaseService.loadSite();
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem('selected_template');
                return saved ? JSON.parse(saved) : null;
            }
        } catch (error) {
            console.error('Error loading saved template:', error);
            return null;
        }
    }
}

// Global template loader instance
window.templateLoader = new TemplateLoader();

// Global helper functions for backward compatibility
window.getTemplate = function(templateId) {
    return window.templateLoader.getTemplate(templateId);
};

window.getAllTemplates = function() {
    return window.templateLoader.getAllTemplates();
};

window.generateTemplateHTML = function(template, pageId) {
    return window.templateLoader.generateTemplateHTML(template, pageId);
};
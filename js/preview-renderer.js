// Template Preview Renderer

class PreviewRenderer {
    constructor() {
        this.currentTemplate = null;
        this.currentPage = 'home';
    }
    
    // Render a template preview directly in the preview iframe
    renderTemplate(templateId, pageId = 'home') {
        const template = this.getTemplateDefinition(templateId);
        if (!template) {
            console.error('Template not found:', templateId);
            return;
        }
        
        this.currentTemplate = template;
        this.currentPage = pageId;
        
        const html = this.generateHTML(template, pageId);
        
        // Find preview iframe or create one
        let iframe = document.getElementById('preview-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'preview-iframe';
            iframe.style.cssText = `
                width: 100%;
                height: 600px;
                border: 1px solid #ddd;
                border-radius: 8px;
                background: white;
            `;
            
            // Find a container or append to body
            const container = document.querySelector('.preview-container') || document.body;
            container.appendChild(iframe);
        }
        
        // Write HTML to iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        
        return iframe;
    }
    
    // Generate complete HTML for a template
    generateHTML(template, pageId = 'home') {
        const page = template.structure[pageId];
        if (!page) {
            return this.generateErrorHTML(`Page "${pageId}" not found`, template);
        }
        
        const colors = template.colors;
        const fonts = template.fonts;
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${template.name} - ${pageId}</title>
                <style>
                    ${this.generateCSS(template, pageId)}
                </style>
                <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(fonts.body)}:wght@300;400;500&display=swap" rel="stylesheet">
            </head>
            <body>
                ${this.generateNavigation(template)}
                ${this.generateHeroSection(page, template)}
                ${this.generateContentSections(page, template)}
                ${this.generateFooter(template)}
            </body>
            </html>
        `;
    }
    
    generateCSS(template, pageId) {
        const colors = template.colors;
        const fonts = template.fonts;
        
        return `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                font-family: '${fonts.body}', sans-serif;
                line-height: 1.6;
                color: ${colors.text};
                background: ${colors.accent || '#ffffff'};
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
            
            .navigation {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: rgba(0,0,0,0.9);
                backdrop-filter: blur(10px);
                padding: 15px 0;
                text-align: center;
                z-index: 1000;
            }
            
            .navigation a {
                color: white;
                text-decoration: none;
                margin: 0 20px;
                font-weight: 500;
                transition: color 0.3s ease;
            }
            
            .navigation a:hover {
                color: ${colors.primary};
            }
            
            .hero {
                background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('HERO_BACKGROUND');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                color: white;
                position: relative;
            }
            
            .hero h1 {
                font-size: 4rem;
                margin-bottom: 20px;
                color: white;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
            }
            
            .hero p {
                font-size: 1.5rem;
                margin-bottom: 30px;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
                max-width: 600px;
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
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            
            .btn:hover {
                background: ${colors.secondary};
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            
            .section {
                padding: 80px 0;
                margin-top: ${pageId === 'home' ? '0' : '60px'};
            }
            
            .section h2 {
                font-size: 2.5rem;
                text-align: center;
                margin-bottom: 50px;
                color: ${colors.primary};
            }
            
            .content-box {
                background: white;
                border-radius: 15px;
                padding: 50px;
                margin: 40px 0;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
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
                border-radius: 12px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            
            .gallery img:hover {
                transform: scale(1.05);
                box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            }
            
            .footer {
                background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
                color: white;
                padding: 60px 0;
                text-align: center;
            }
            
            .footer h2 {
                color: white;
                margin-bottom: 20px;
            }
            
            .contact-info {
                display: flex;
                justify-content: center;
                gap: 40px;
                margin-top: 30px;
                flex-wrap: wrap;
            }
            
            .contact-item {
                text-align: center;
            }
            
            .contact-item a {
                color: white;
                text-decoration: none;
                font-weight: 500;
            }
            
            .contact-item a:hover {
                text-decoration: underline;
            }
            
            @media (max-width: 768px) {
                .hero h1 { font-size: 2.5rem; }
                .hero p { font-size: 1.2rem; }
                .section { padding: 50px 0; }
                .content-box { padding: 30px 20px; margin: 20px 0; }
                .navigation { position: relative; }
                .contact-info { flex-direction: column; gap: 20px; }
            }
        `;
    }
    
    generateNavigation(template) {
        const pages = Object.keys(template.structure);
        if (pages.length <= 1) return '';
        
        const pageNames = {
            'home': 'Home',
            'about': 'About',
            'portfolio': 'Portfolio',
            'contact': 'Contact'
        };
        
        const navItems = pages.map(page => {
            const name = pageNames[page] || page.charAt(0).toUpperCase() + page.slice(1);
            return `<a href="#${page}">${name}</a>`;
        }).join('');
        
        return `
            <nav class="navigation">
                ${navItems}
            </nav>
        `;
    }
    
    generateHeroSection(page, template) {
        const hero = page.hero;
        if (!hero) return '';
        
        return `
            <section class="hero" style="background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${hero.background}');">
                <div class="container">
                    <h1>${hero.title}</h1>
                    <p>${hero.subtitle}</p>
                    <a href="#content" class="btn">Explore</a>
                </div>
            </section>
        `;
    }
    
    generateContentSections(page, template) {
        let content = '';
        
        // About section
        if (page.about) {
            content += `
                <section class="section" id="content">
                    <div class="container">
                        <div class="content-box">
                            <h2>${page.about.title}</h2>
                            <p style="text-align: center; font-size: 1.2rem; line-height: 1.8;">${page.about.content}</p>
                        </div>
                    </div>
                </section>
            `;
        }
        
        // Content sections (for about/contact pages)
        if (page.content) {
            content += `
                <section class="section">
                    <div class="container">
                        <div class="content-box">
                            ${page.content.story ? `
                                <h2>Our Story</h2>
                                <p style="font-size: 1.1rem; line-height: 1.8; margin-bottom: 30px;">${page.content.story}</p>
                            ` : ''}
                            ${page.content.mission ? `
                                <h2>Our Mission</h2>
                                <p style="font-size: 1.1rem; line-height: 1.8;">${page.content.mission}</p>
                            ` : ''}
                        </div>
                    </div>
                </section>
            `;
        }
        
        // Gallery section
        if (page.gallery) {
            content += `
                <section class="section" id="portfolio">
                    <div class="container">
                        <h2>${page.gallery.title}</h2>
                        <div class="gallery">
                            ${page.gallery.images.map(img => `<img src="${img}" alt="Portfolio image" loading="lazy">`).join('')}
                        </div>
                    </div>
                </section>
            `;
        }
        
        // Multiple galleries (for portfolio pages)
        if (page.galleries) {
            page.galleries.forEach(gallery => {
                content += `
                    <section class="section">
                        <div class="container">
                            <h2>${gallery.title}</h2>
                            <div class="gallery">
                                ${gallery.images.map(img => `<img src="${img}" alt="${gallery.title}" loading="lazy">`).join('')}
                            </div>
                        </div>
                    </section>
                `;
            });
        }
        
        // Contact info (for contact pages)
        if (page.info) {
            content += `
                <section class="section">
                    <div class="container">
                        <div class="content-box">
                            <h2>Contact Information</h2>
                            <div class="contact-info">
                                <div class="contact-item">
                                    <h3>Email</h3>
                                    <a href="mailto:${page.info.email}">${page.info.email}</a>
                                </div>
                                <div class="contact-item">
                                    <h3>Phone</h3>
                                    <a href="tel:${page.info.phone}">${page.info.phone}</a>
                                </div>
                                <div class="contact-item">
                                    <h3>Location</h3>
                                    <p>${page.info.location}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }
        
        return content;
    }
    
    generateFooter(template) {
        return `
            <footer class="footer">
                <div class="container">
                    <h2>Ready to Get Started?</h2>
                    <p>Contact us today to discuss your photography needs</p>
                    <a href="mailto:contact@example.com" class="btn" style="background: white; color: ${template.colors.primary}; margin-top: 20px;">Get In Touch</a>
                </div>
            </footer>
        `;
    }
    
    generateErrorHTML(message, template) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Preview Error</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .error-container {
                        text-align: center;
                        padding: 40px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h2>Preview Error</h2>
                    <p>${message}</p>
                    ${template ? `<p>Template: ${template.name}</p>` : ''}
                    <p>Available pages: ${template ? Object.keys(template.structure).join(', ') : 'None'}</p>
                </div>
            </body>
            </html>
        `;
    }
    
    // Get template definition with all content
    getTemplateDefinition(templateId) {
        // Complete template definitions with all 10 templates
        const templates = {
            'classic-elegance': {
                id: 'classic-elegance',
                name: 'Classic Elegance',
                category: 'wedding',
                colors: {
                    primary: '#d4af37',
                    secondary: '#f4e5c1',
                    accent: '#faf7f0',
                    text: '#2c2c2c'
                },
                fonts: {
                    heading: 'Playfair Display',
                    body: 'Crimson Text'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Classic Elegance',
                            subtitle: 'Timeless Wedding Photography',
                            background: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'Our Story',
                            content: 'With a passion for capturing timeless elegance and authentic moments, we create photographs that tell your unique love story with classic sophistication.'
                        },
                        gallery: {
                            title: 'Wedding Gallery',
                            images: [
                                'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'modern-minimalist': {
                id: 'modern-minimalist',
                name: 'Modern Minimalist',
                category: 'portrait',
                colors: {
                    primary: '#2c3e50',
                    secondary: '#34495e',
                    accent: '#ecf0f1',
                    text: '#2c3e50'
                },
                fonts: {
                    heading: 'Inter',
                    body: 'Inter'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Modern Minimalist',
                            subtitle: 'Clean. Contemporary. Timeless.',
                            background: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'Minimalist Approach',
                            content: 'Clean, contemporary portrait photography that focuses on authentic moments and genuine expressions with modern simplicity.'
                        },
                        gallery: {
                            title: 'Portrait Gallery',
                            images: [
                                'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'vintage-charm': {
                id: 'vintage-charm',
                name: 'Vintage Charm',
                category: 'wedding',
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
                        },
                        about: {
                            title: 'Our Story',
                            content: 'With a passion for capturing vintage elegance and timeless romance, we create heirloom-quality photographs that tell your unique love story.'
                        },
                        gallery: {
                            title: 'Wedding Gallery',
                            images: [
                                'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'romantic-moments': {
                id: 'romantic-moments',
                name: 'Romantic Moments',
                category: 'wedding',
                colors: {
                    primary: '#ffeaa7',
                    secondary: '#fab1a0',
                    accent: '#ffeaa7',
                    text: '#2d3436'
                },
                fonts: {
                    heading: 'Playfair Display',
                    body: 'Crimson Text'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Romantic Moments',
                            subtitle: 'Intimate Wedding Photography',
                            background: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'Love Stories',
                            content: 'Capturing the intimate, tender moments that make your love story unique with a soft, romantic touch.'
                        },
                        gallery: {
                            title: 'Romance Gallery',
                            images: [
                                'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'elegant-studio': {
                id: 'elegant-studio',
                name: 'Elegant Studio',
                category: 'portrait',
                colors: {
                    primary: '#8b4d8c',
                    secondary: '#c17cbd',
                    accent: '#f3e5f5',
                    text: '#2d2d2d'
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
                        },
                        about: {
                            title: 'Studio Excellence',
                            content: 'Professional studio portraits with sophisticated lighting and elegant styling for discerning clients.'
                        },
                        gallery: {
                            title: 'Studio Portfolio',
                            images: [
                                'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'creative-portfolio': {
                id: 'creative-portfolio',
                name: 'Creative Portfolio',
                category: 'commercial',
                colors: {
                    primary: '#e74c3c',
                    secondary: '#c0392b',
                    accent: '#fdedec',
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
                        },
                        about: {
                            title: 'Artistic Excellence',
                            content: 'Bold, creative commercial photography that pushes boundaries and delivers exceptional results for brands and agencies.'
                        },
                        gallery: {
                            title: 'Creative Work',
                            images: [
                                'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'bold-statement': {
                id: 'bold-statement',
                name: 'Bold Statement',
                category: 'commercial',
                colors: {
                    primary: '#000000',
                    secondary: '#434343',
                    accent: '#ffffff',
                    text: '#ffffff'
                },
                fonts: {
                    heading: 'Montserrat',
                    body: 'Source Sans Pro'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Bold Visual Stories',
                            subtitle: 'Commercial & Fashion Photography',
                            background: 'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'Our Vision',
                            content: 'Creating bold, impactful commercial photography that captures attention and drives results for your brand.'
                        },
                        gallery: {
                            title: 'Latest Work',
                            images: [
                                'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'event-showcase': {
                id: 'event-showcase',
                name: 'Event Showcase',
                category: 'event',
                colors: {
                    primary: '#667eea',
                    secondary: '#764ba2',
                    accent: '#f8f9fa',
                    text: '#2c3e50'
                },
                fonts: {
                    heading: 'Montserrat',
                    body: 'Source Sans Pro'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Event Photography',
                            subtitle: 'Capturing Every Moment',
                            background: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'Professional Events',
                            content: 'Specializing in corporate events, conferences, and special occasions with dynamic, engaging photography.'
                        },
                        gallery: {
                            title: 'Event Gallery',
                            images: [
                                'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'nature-inspired': {
                id: 'nature-inspired',
                name: 'Nature Inspired',
                category: 'lifestyle',
                colors: {
                    primary: '#1a5f3f',
                    secondary: '#2d8f57',
                    accent: '#f0f8f0',
                    text: '#2c3e50'
                },
                fonts: {
                    heading: 'Playfair Display',
                    body: 'Open Sans'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Nature\'s Beauty Captured',
                            subtitle: 'Outdoor & Lifestyle Photography',
                            background: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'Our Connection to Nature',
                            content: 'Specializing in outdoor portraits and lifestyle photography that celebrates the natural world and authentic human connections.'
                        },
                        gallery: {
                            title: 'Nature Portfolio',
                            images: [
                                'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            },
            'urban-edge': {
                id: 'urban-edge',
                name: 'Urban Edge',
                category: 'lifestyle',
                colors: {
                    primary: '#4a4a4a',
                    secondary: '#6a6a6a',
                    accent: '#f5f5f5',
                    text: '#2c3e50'
                },
                fonts: {
                    heading: 'Inter',
                    body: 'Inter'
                },
                structure: {
                    home: {
                        hero: {
                            title: 'Urban Stories',
                            subtitle: 'Street & City Photography',
                            background: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&h=600&fit=crop'
                        },
                        about: {
                            title: 'City Life Captured',
                            content: 'Documenting the energy, diversity, and raw beauty of urban environments through authentic street photography.'
                        },
                        gallery: {
                            title: 'Urban Gallery',
                            images: [
                                'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?w=400&h=300&fit=crop'
                            ]
                        }
                    }
                }
            }
        };
        
        return templates[templateId] || null;
    }
}

// Initialize the preview renderer
window.previewRenderer = new PreviewRenderer();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PreviewRenderer;
}
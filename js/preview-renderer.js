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
                    },
                    about: {
                        hero: {
                            title: 'About Our Photography',
                            subtitle: 'Capturing Classic Elegance Since 2015',
                            background: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'Our journey began with a love for timeless aesthetics and authentic moments. We specialize in creating photographs that feel like treasured family heirlooms, capturing the classic elegance of your special day.',
                            mission: 'To create timeless wedding photographs that capture authentic emotions and classic elegance with artistic vision and professional expertise.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Wedding Portfolio',
                            subtitle: 'Timeless Memories Captured',
                            background: 'https://images.unsplash.com/photo-1522413452208-996ff3f3e740?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Classic Ceremonies',
                                images: [
                                    'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop'
                                ]
                            },
                            {
                                title: 'Elegant Receptions',
                                images: [
                                    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1522413452208-996ff3f3e740?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Get In Touch',
                            subtitle: 'Let\'s Create Something Beautiful Together',
                            background: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@classicelegance.com',
                            phone: '+1 (555) 123-4567',
                            location: 'Available for destination weddings worldwide'
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
                    },
                    about: {
                        hero: {
                            title: 'About Our Photography',
                            subtitle: 'Capturing Vintage Elegance Since 2015',
                            background: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'Our journey began with a love for vintage aesthetics and timeless romance. We specialize in creating photographs that feel like treasured family heirlooms.',
                            mission: 'To capture the authentic emotions and vintage charm of your special day with artistic vision and professional expertise.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Wedding Portfolio',
                            subtitle: 'Timeless Memories Captured',
                            background: 'https://images.unsplash.com/photo-1522413452208-996ff3f3e740?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Vintage Ceremonies',
                                images: [
                                    'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Get In Touch',
                            subtitle: 'Let\'s Create Something Beautiful Together',
                            background: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@vintagecharm.com',
                            phone: '+1 (555) 123-4567',
                            location: 'Available for destination weddings worldwide'
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
                    },
                    about: {
                        hero: {
                            title: 'About Our Story',
                            subtitle: 'Intimate Wedding Photography',
                            background: 'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'We believe every love story deserves to be told with tenderness and authenticity. Our romantic approach captures the quiet moments, gentle touches, and heartfelt emotions.',
                            mission: 'To preserve the intimate beauty of your wedding day through soft, romantic photography that speaks to the heart.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Romantic Portfolio',
                            subtitle: 'Intimate Moments Captured',
                            background: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Intimate Ceremonies',
                                images: [
                                    'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Let\'s Connect',
                            subtitle: 'Share Your Love Story With Us',
                            background: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@romanticmoments.com',
                            phone: '+1 (555) 987-6543',
                            location: 'Intimate venues and destination weddings'
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
                    },
                    about: {
                        hero: {
                            title: 'About Our Studio',
                            subtitle: 'Professional Portrait Photography',
                            background: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'Our elegant studio provides a sophisticated environment for creating timeless portraits. With professional lighting and expert styling, we capture the essence of each individual.',
                            mission: 'To create sophisticated studio portraits that reflect the elegance and personality of our discerning clients.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Portrait Portfolio',
                            subtitle: 'Elegant Studio Work',
                            background: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Executive Portraits',
                                images: [
                                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Schedule Your Session',
                            subtitle: 'Professional Studio Portraits',
                            background: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'studio@elegantstudio.com',
                            phone: '+1 (555) 234-5678',
                            location: 'Professional studio downtown'
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
                    },
                    about: {
                        hero: {
                            title: 'Creative Excellence',
                            subtitle: 'Commercial Photography Redefined',
                            background: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'We push creative boundaries to deliver exceptional commercial photography that captures attention and drives results for brands and agencies worldwide.',
                            mission: 'To create bold, innovative commercial photography that breaks conventions and delivers measurable impact for our clients.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Commercial Portfolio',
                            subtitle: 'Creative Solutions for Brands',
                            background: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Brand Campaigns',
                                images: [
                                    'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Start Your Project',
                            subtitle: 'Creative Commercial Photography',
                            background: 'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@creativeportfolio.com',
                            phone: '+1 (555) 345-6789',
                            location: 'Serving brands worldwide'
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
                    },
                    about: {
                        hero: {
                            title: 'Bold Creativity',
                            subtitle: 'Disrupting Visual Narratives',
                            background: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'We create bold, high-contrast visuals that demand attention and leave lasting impressions. Our approach combines artistic vision with commercial effectiveness.',
                            mission: 'To produce striking commercial photography that breaks through the noise and delivers powerful brand messaging.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Bold Portfolio',
                            subtitle: 'High-Impact Commercial Work',
                            background: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Fashion & Commercial',
                                images: [
                                    'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Make a Statement',
                            subtitle: 'Bold Commercial Photography',
                            background: 'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@boldstatement.com',
                            phone: '+1 (555) 456-7890',
                            location: 'Global commercial projects'
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
                    },
                    about: {
                        hero: {
                            title: 'Professional Event Coverage',
                            subtitle: 'Dynamic Photography for Every Occasion',
                            background: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'We specialize in capturing the energy, connections, and memorable moments that make events successful, from corporate conferences to special celebrations.',
                            mission: 'To provide comprehensive event photography that tells the complete story of your occasion with professionalism and creativity.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Event Portfolio',
                            subtitle: 'Comprehensive Event Coverage',
                            background: 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Corporate Events',
                                images: [
                                    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Book Your Event',
                            subtitle: 'Professional Event Photography',
                            background: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'events@eventshowcase.com',
                            phone: '+1 (555) 567-8901',
                            location: 'Available for events nationwide'
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
                    },
                    about: {
                        hero: {
                            title: 'Nature Photography',
                            subtitle: 'Celebrating the Natural World',
                            background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'We find inspiration in the natural world, capturing the beauty of outdoor spaces and the authentic connections between people and nature.',
                            mission: 'To create stunning outdoor photography that celebrates the environment and promotes connection with the natural world.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Nature Portfolio',
                            subtitle: 'Outdoor Lifestyle Photography',
                            background: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Outdoor Adventures',
                                images: [
                                    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Nature Sessions',
                            subtitle: 'Outdoor Lifestyle Photography',
                            background: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@natureinspired.com',
                            phone: '+1 (555) 678-9012',
                            location: 'Beautiful outdoor locations'
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
                    },
                    about: {
                        hero: {
                            title: 'Urban Photography',
                            subtitle: 'Street Life & City Culture',
                            background: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'We document the raw energy and authentic moments of city life, capturing the diversity, culture, and stories that make urban environments unique.',
                            mission: 'To showcase the beauty and complexity of urban life through authentic street photography and lifestyle documentation.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Urban Portfolio',
                            subtitle: 'Street & Lifestyle Photography',
                            background: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'City Stories',
                                images: [
                                    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Urban Sessions',
                            subtitle: 'Street & City Photography',
                            background: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@urbanedge.com',
                            phone: '+1 (555) 789-0123',
                            location: 'Urban locations citywide'
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
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
                        },
                        about: {
                            title: 'Modern Approach',
                            content: 'Clean, contemporary portrait photography that focuses on authentic moments and genuine expressions.'
                        },
                        gallery: {
                            title: 'Portrait Gallery',
                            images: [
                                'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop'
                            ]
                        }
                    },
                    about: {
                        hero: {
                            title: 'About My Work',
                            subtitle: 'Minimalist Portrait Photography',
                            background: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&h=600&fit=crop'
                        },
                        content: {
                            story: 'I believe in the power of simplicity. My minimalist approach to portrait photography strips away distractions to focus on what matters most - authentic human connection.',
                            mission: 'To create timeless portraits that capture genuine moments with clean, modern aesthetics.'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Portfolio',
                            subtitle: 'Recent Portrait Work',
                            background: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Corporate Portraits',
                                images: [
                                    'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Let\'s Connect',
                            subtitle: 'Ready to create something beautiful?',
                            background: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=1200&h=600&fit=crop'
                        },
                        info: {
                            email: 'hello@modernminimalist.com',
                            phone: '+1 (555) 987-6543',
                            location: 'Available worldwide'
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
            {
                id: 'bold-statement',
                name: 'Bold Statement',
                category: 'commercial',
                description: 'High-contrast design for fashion and commercial photography',
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
                            title: 'About Our Studio',
                            subtitle: 'Bold Commercial Photography',
                            background: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&h=600&fit=crop'
                        },
                        content: {
                            title: 'Our Story',
                            text: 'We specialize in creating bold, high-impact commercial photography that makes your brand stand out. Our unique style combines dramatic lighting with striking compositions.',
                            experience: '8+ years of commercial photography experience',
                            specialty: 'Fashion, commercial, and editorial photography'
                        }
                    },
                    portfolio: {
                        hero: {
                            title: 'Portfolio',
                            subtitle: 'Bold Commercial Work',
                            background: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=1200&h=600&fit=crop'
                        },
                        galleries: [
                            {
                                title: 'Fashion Photography',
                                images: [
                                    'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop'
                                ]
                            },
                            {
                                title: 'Commercial Work',
                                images: [
                                    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400&h=300&fit=crop',
                                    'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=400&h=300&fit=crop'
                                ]
                            }
                        ]
                    },
                    contact: {
                        hero: {
                            title: 'Get In Touch',
                            subtitle: 'Ready For Bold Photography?',
                            background: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&h=600&fit=crop'
                        },
                        contact: {
                            title: 'Contact Information',
                            email: 'hello@boldphotography.com',
                            phone: '+1 (555) 123-4567',
                            address: '123 Studio Street, Creative District, NY 10001'
                        },
                        form: {
                            title: 'Project Inquiry',
                            fields: ['name', 'email', 'phone', 'project_type', 'message']
                        }
                    }
                }
            },
            {
                id: 'nature-inspired',
                name: 'Nature Inspired',
                category: 'lifestyle',
                description: 'Organic design perfect for outdoor and nature photography',
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
            {
                id: 'urban-edge',
                name: 'Urban Edge',
                category: 'lifestyle',
                description: 'Modern urban design for street and city photography',
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
            },
            {
                id: 'romantic-moments',
                name: 'Romantic Moments',
                category: 'wedding',
                description: 'Soft, romantic design for intimate wedding photography',
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
            {
                id: 'event-showcase',
                name: 'Event Showcase',
                category: 'event',
                description: 'Dynamic layout perfect for event and corporate photography',
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
            return `<div style="padding: 50px; text-align: center; font-family: Arial, sans-serif;">
                        <h2>Page "${pageId}" not found for template "${template?.name || 'Unknown'}"</h2>
                        <p>Available pages: ${template ? Object.keys(template.structure).join(', ') : 'None'}</p>
                    </div>`;
        }
        
        const page = template.structure[pageId];
        const colors = template.colors;
        
        // Generate navigation for multi-page templates
        const navItems = Object.keys(template.structure).map(key => {
            const pageNames = {
                'home': 'Home',
                'about': 'About', 
                'portfolio': 'Portfolio',
                'contact': 'Contact'
            };
            return `<a href="#${key}" style="color: white; text-decoration: none; margin: 0 20px; font-weight: 500;">${pageNames[key] || key}</a>`;
        }).join('');
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${template.name} - ${pageId}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: '${template.fonts.body}', sans-serif;
                        line-height: 1.6;
                        color: ${colors.text};
                        background: ${colors.accent || '#ffffff'};
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
                    .nav {
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
                    .hero {
                        background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${page.hero?.background}');
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
                    .content-section {
                        background: white;
                        border-radius: 15px;
                        padding: 50px;
                        margin: 40px 0;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    }
                    .page-indicator {
                        position: fixed;
                        top: 50%;
                        right: 30px;
                        transform: translateY(-50%);
                        background: ${colors.primary};
                        color: white;
                        padding: 10px 15px;
                        border-radius: 20px;
                        font-size: 0.9rem;
                        font-weight: 600;
                        z-index: 1000;
                        text-transform: capitalize;
                    }
                    @media (max-width: 768px) {
                        .hero h1 { font-size: 2.5rem; }
                        .hero p { font-size: 1.2rem; }
                        .section { padding: 50px 0; }
                        .content-section { padding: 30px 20px; margin: 20px 0; }
                        .nav { position: relative; }
                        .nav a { margin: 0 10px; font-size: 0.9rem; }
                        .page-indicator { display: none; }
                    }
                </style>
                <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(template.fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(template.fonts.body)}:wght@300;400;500&display=swap" rel="stylesheet">
            </head>
            <body>
                ${Object.keys(template.structure).length > 1 ? `
                    <nav class="nav">
                        ${navItems}
                    </nav>
                ` : ''}
                
                <div class="page-indicator">${pageId} Page</div>
                
                <section class="hero">
                    <div class="container">
                        <h1>${page.hero?.title || template.name}</h1>
                        <p>${page.hero?.subtitle || template.description}</p>
                        ${pageId === 'home' ? `<a href="#portfolio" class="btn">View Portfolio</a>` : ''}
                        ${pageId === 'contact' ? `<a href="mailto:${page.info?.email || 'hello@example.com'}" class="btn">Get In Touch</a>` : ''}
                    </div>
                </section>
                
                ${page.about ? `
                    <section class="section">
                        <div class="container">
                            <div class="content-section">
                                <h2>${page.about.title}</h2>
                                <p style="text-align: center; font-size: 1.2rem; max-width: 800px; margin: 0 auto; line-height: 1.8;">${page.about.content}</p>
                            </div>
                        </div>
                    </section>
                ` : ''}
                
                ${page.content ? `
                    <section class="section">
                        <div class="container">
                            <div class="content-section">
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
                ` : ''}
                
                ${page.gallery ? `
                    <section class="section" id="portfolio">
                        <div class="container">
                            <h2>${page.gallery.title}</h2>
                            <div class="gallery">
                                ${page.gallery.images.map(img => `<img src="${img}" alt="Portfolio image" loading="lazy">`).join('')}
                            </div>
                        </div>
                    </section>
                ` : ''}
                
                ${page.galleries ? `
                    <section class="section">
                        <div class="container">
                            ${page.galleries.map(gallery => `
                                <h2>${gallery.title}</h2>
                                <div class="gallery">
                                    ${gallery.images.map(img => `<img src="${img}" alt="${gallery.title}" loading="lazy">`).join('')}
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}
                
                ${page.info ? `
                    <section class="section">
                        <div class="container">
                            <div class="content-section">
                                <h2>Contact Information</h2>
                                <div style="text-align: center; font-size: 1.1rem; line-height: 2;">
                                    <p><strong>Email:</strong> <a href="mailto:${page.info.email}" style="color: ${colors.primary};">${page.info.email}</a></p>
                                    <p><strong>Phone:</strong> <a href="tel:${page.info.phone}" style="color: ${colors.primary};">${page.info.phone}</a></p>
                                    <p><strong>Location:</strong> ${page.info.location}</p>
                                </div>
                            </div>
                        </div>
                    </section>
                ` : ''}
                
                ${pageId === 'home' ? `
                    <section class="section" style="background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary}); color: white;">
                        <div class="container">
                            <h2 style="color: white;">Get In Touch</h2>
                            <p style="text-align: center; font-size: 1.2rem; margin-bottom: 30px;">Ready to capture your special moments?</p>
                            <div style="text-align: center;">
                                <a href="mailto:info@example.com" class="btn" style="background: white; color: ${colors.primary};">Contact Us</a>
                            </div>
                        </div>
                    </section>
                ` : ''}
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
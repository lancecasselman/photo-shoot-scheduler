// PresetTemplates.jsx - 20 Multi-Page Website Templates for Photography Businesses

const PresetTemplates = {
    // Based on thelegacyphotography.com structure
    legacyPhotography: {
        name: "Legacy Photography Elite",
        description: "Elegant multi-page photography website with dramatic hero sections",
        category: "Wedding",
        pages: {
            home: [
                {
                    id: 'hero-1',
                    type: 'heading',
                    content: 'Your Life, Your Legacy, Perfectly Captured!',
                    styles: {
                        fontSize: '48px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontStyle: 'italic',
                        margin: '60px 0 40px 0',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                    }
                },
                {
                    id: 'hero-image-1',
                    type: 'image',
                    content: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&h=800&fit=crop',
                    styles: {
                        width: '100%',
                        height: '500px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        margin: '20px 0'
                    }
                },
                {
                    id: 'welcome-heading',
                    type: 'heading',
                    content: 'Welcome to Legacy Photography',
                    styles: {
                        fontSize: '36px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontStyle: 'italic',
                        margin: '50px 0 30px 0'
                    }
                },
                {
                    id: 'welcome-text',
                    type: 'paragraph',
                    content: 'Welcome to Legacy Photography – Your Premier Photographer in South Carolina. Thank you for visiting my website! As a premier photographer serving Myrtle Beach, Charleston, and the beautiful South Carolina coast, I specialize in capturing stunning family portraits, beach sessions, weddings, and senior photos.',
                    styles: {
                        fontSize: '18px',
                        color: '#333',
                        lineHeight: '1.8',
                        textAlign: 'center',
                        maxWidth: '800px',
                        margin: '0 auto 40px auto',
                        padding: '0 20px'
                    }
                },
                {
                    id: 'cta-button',
                    type: 'button',
                    content: 'View My Portfolio',
                    styles: {
                        backgroundColor: '#D4AF37',
                        color: 'white',
                        padding: '15px 40px',
                        fontSize: '18px',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        margin: '20px auto',
                        display: 'block',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }
                }
            ],
            about: [
                {
                    id: 'about-hero',
                    type: 'heading',
                    content: 'Legacy Photography: Capturing Unforgettable Moments',
                    styles: {
                        fontSize: '42px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontStyle: 'italic',
                        margin: '40px 0 30px 0'
                    }
                },
                {
                    id: 'about-philosophy',
                    type: 'paragraph',
                    content: 'Time doesn\'t wait... We blink and the kids are grown... We laugh and the moment slips away... But through photography, we get to hold on. I created this brand to honor that idea—to give families, couples, and individuals a way to capture life exactly as it is… and to make sure it lives on.',
                    styles: {
                        fontSize: '20px',
                        color: '#333',
                        lineHeight: '1.8',
                        textAlign: 'center',
                        maxWidth: '700px',
                        margin: '0 auto 40px auto',
                        fontStyle: 'italic',
                        padding: '0 20px'
                    }
                },
                {
                    id: 'about-goal',
                    type: 'heading',
                    content: 'My Goal For You',
                    styles: {
                        fontSize: '32px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '60px 0 30px 0'
                    }
                },
                {
                    id: 'goal-text',
                    type: 'paragraph',
                    content: 'My goal for you is more than just taking pictures — it\'s to create something that moves you every single time you look back. I want you to feel proud, radiant, and seen. These aren\'t meant to be snapshots. My goal is to create art — bold, beautiful, and timeless — pieces that you\'ll treasure for generations.',
                    styles: {
                        fontSize: '18px',
                        color: '#333',
                        lineHeight: '1.8',
                        textAlign: 'center',
                        maxWidth: '800px',
                        margin: '0 auto 40px auto',
                        padding: '0 20px'
                    }
                }
            ],
            portfolio: [
                {
                    id: 'portfolio-hero',
                    type: 'heading',
                    content: 'Portfolio',
                    styles: {
                        fontSize: '42px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '40px 0 50px 0'
                    }
                },
                {
                    id: 'portfolio-subtitle',
                    type: 'paragraph',
                    content: 'Beach Photography That Celebrates Your Life and Legacy',
                    styles: {
                        fontSize: '24px',
                        color: '#333',
                        textAlign: 'center',
                        fontWeight: '300',
                        margin: '0 auto 50px auto',
                        maxWidth: '600px'
                    }
                },
                {
                    id: 'gallery-1',
                    type: 'image',
                    content: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&h=400&fit=crop',
                    styles: {
                        width: '45%',
                        height: '300px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        margin: '10px 2.5%',
                        display: 'inline-block'
                    }
                },
                {
                    id: 'gallery-2',
                    type: 'image',
                    content: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&h=400&fit=crop',
                    styles: {
                        width: '45%',
                        height: '300px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        margin: '10px 2.5%',
                        display: 'inline-block'
                    }
                }
            ],
            blog: [
                {
                    id: 'blog-hero',
                    type: 'heading',
                    content: 'Photography Blog',
                    styles: {
                        fontSize: '42px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '40px 0 30px 0'
                    }
                },
                {
                    id: 'blog-intro',
                    type: 'paragraph',
                    content: 'Behind the scenes stories, photography tips, and client features.',
                    styles: {
                        fontSize: '18px',
                        color: '#666',
                        textAlign: 'center',
                        margin: '0 auto 50px auto',
                        maxWidth: '500px'
                    }
                }
            ],
            contact: [
                {
                    id: 'contact-hero',
                    type: 'heading',
                    content: 'Contact',
                    styles: {
                        fontSize: '42px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '40px 0 30px 0'
                    }
                },
                {
                    id: 'contact-info',
                    type: 'paragraph',
                    content: 'Call or Text 843-485-1315 or Submit a Message Below',
                    styles: {
                        fontSize: '20px',
                        color: '#333',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '0 auto 40px auto'
                    }
                },
                {
                    id: 'contact-button',
                    type: 'button',
                    content: '📱 Text Me Now to Book',
                    styles: {
                        backgroundColor: '#25D366',
                        color: 'white',
                        padding: '15px 30px',
                        fontSize: '18px',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        margin: '20px auto',
                        display: 'block',
                        fontWeight: 'bold'
                    }
                }
            ],
            privacy: [
                {
                    id: 'privacy-hero',
                    type: 'heading',
                    content: 'Privacy Policy',
                    styles: {
                        fontSize: '36px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '40px 0 30px 0'
                    }
                },
                {
                    id: 'privacy-text',
                    type: 'paragraph',
                    content: 'We respect your privacy and are committed to protecting your personal information. This policy outlines how we collect, use, and safeguard your data when you use our photography services.',
                    styles: {
                        fontSize: '16px',
                        color: '#333',
                        lineHeight: '1.6',
                        textAlign: 'left',
                        maxWidth: '800px',
                        margin: '0 auto 20px auto',
                        padding: '0 20px'
                    }
                }
            ]
        }
    },

    modernMinimalist: {
        name: "Modern Minimalist",
        description: "Clean, modern design with bold typography and plenty of white space",
        category: "Minimalist",
        pages: {
            home: [
                {
                    id: 'hero-minimal',
                    type: 'heading',
                    content: 'Modern Photography Studio',
                    styles: {
                        fontSize: '64px',
                        color: '#000',
                        textAlign: 'center',
                        fontWeight: '100',
                        letterSpacing: '2px',
                        margin: '100px 0 40px 0'
                    }
                },
                {
                    id: 'subtitle-minimal',
                    type: 'paragraph',
                    content: 'Capturing moments with contemporary vision',
                    styles: {
                        fontSize: '18px',
                        color: '#666',
                        textAlign: 'center',
                        fontWeight: '300',
                        letterSpacing: '1px',
                        margin: '0 auto 80px auto'
                    }
                }
            ],
            about: [
                {
                    id: 'about-minimal',
                    type: 'heading',
                    content: 'About',
                    styles: {
                        fontSize: '48px',
                        color: '#000',
                        textAlign: 'left',
                        fontWeight: '100',
                        margin: '40px 0 30px 0'
                    }
                },
                {
                    id: 'about-text-minimal',
                    type: 'paragraph',
                    content: 'We believe in the power of simplicity. Every image tells a story through clean composition and authentic moments.',
                    styles: {
                        fontSize: '20px',
                        color: '#333',
                        lineHeight: '1.8',
                        textAlign: 'left',
                        maxWidth: '600px',
                        margin: '0 0 40px 0'
                    }
                }
            ],
            portfolio: [
                {
                    id: 'portfolio-minimal',
                    type: 'heading',
                    content: 'Work',
                    styles: {
                        fontSize: '48px',
                        color: '#000',
                        textAlign: 'center',
                        fontWeight: '100',
                        margin: '40px 0 60px 0'
                    }
                }
            ],
            contact: [
                {
                    id: 'contact-minimal',
                    type: 'heading',
                    content: 'Get in Touch',
                    styles: {
                        fontSize: '36px',
                        color: '#000',
                        textAlign: 'center',
                        fontWeight: '300',
                        margin: '40px 0 40px 0'
                    }
                }
            ]
        }
    },

    weddingDreams: {
        name: "Wedding Dreams",
        description: "Romantic wedding photography website with soft colors and elegant typography",
        category: "Wedding",
        pages: {
            home: [
                {
                    id: 'wedding-hero',
                    type: 'heading',
                    content: 'Forever Begins Here',
                    styles: {
                        fontSize: '52px',
                        color: '#C4A484',
                        textAlign: 'center',
                        fontWeight: '300',
                        fontFamily: 'serif',
                        margin: '60px 0 30px 0'
                    }
                },
                {
                    id: 'wedding-subtitle',
                    type: 'paragraph',
                    content: 'Capturing the most beautiful day of your life with timeless elegance',
                    styles: {
                        fontSize: '20px',
                        color: '#8B7355',
                        textAlign: 'center',
                        fontStyle: 'italic',
                        margin: '0 auto 50px auto',
                        maxWidth: '600px'
                    }
                }
            ],
            about: [
                {
                    id: 'about-wedding',
                    type: 'heading',
                    content: 'Our Story',
                    styles: {
                        fontSize: '42px',
                        color: '#C4A484',
                        textAlign: 'center',
                        fontFamily: 'serif',
                        margin: '40px 0 30px 0'
                    }
                }
            ],
            portfolio: [
                {
                    id: 'portfolio-wedding',
                    type: 'heading',
                    content: 'Wedding Gallery',
                    styles: {
                        fontSize: '42px',
                        color: '#C4A484',
                        textAlign: 'center',
                        fontFamily: 'serif',
                        margin: '40px 0 30px 0'
                    }
                }
            ]
        }
    },

    coastalVibes: {
        name: "Coastal Vibes",
        description: "Beach photography website with ocean-inspired colors and relaxed feel",
        category: "Coastal",
        pages: {
            home: [
                {
                    id: 'coastal-hero',
                    type: 'heading',
                    content: 'Capturing Ocean Dreams',
                    styles: {
                        fontSize: '48px',
                        color: '#2E8B8B',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '60px 0 30px 0'
                    }
                },
                {
                    id: 'coastal-subtitle',
                    type: 'paragraph',
                    content: 'Beach sessions • Sunset portraits • Coastal weddings',
                    styles: {
                        fontSize: '18px',
                        color: '#4682B4',
                        textAlign: 'center',
                        margin: '0 auto 50px auto',
                        maxWidth: '500px'
                    }
                }
            ],
            about: [
                {
                    id: 'about-coastal',
                    type: 'heading',
                    content: 'Life by the Sea',
                    styles: {
                        fontSize: '42px',
                        color: '#2E8B8B',
                        textAlign: 'center',
                        margin: '40px 0 30px 0'
                    }
                }
            ],
            portfolio: [
                {
                    id: 'portfolio-coastal',
                    type: 'heading',
                    content: 'Beach Portfolio',
                    styles: {
                        fontSize: '42px',
                        color: '#2E8B8B',
                        textAlign: 'center',
                        margin: '40px 0 30px 0'
                    }
                }
            ]
        }
    },

    editorialBold: {
        name: "Editorial Bold",
        description: "Dark, dramatic editorial photography with cinematic aesthetics",
        category: "Editorial",
        pages: {
            home: [
                {
                    id: 'editorial-hero',
                    type: 'heading',
                    content: 'VISUAL STORYTELLING',
                    styles: {
                        fontSize: '56px',
                        color: '#FFFFFF',
                        textAlign: 'center',
                        fontWeight: '900',
                        letterSpacing: '4px',
                        margin: '80px 0 40px 0',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                    }
                },
                {
                    id: 'editorial-subtitle',
                    type: 'paragraph',
                    content: 'Cinematic • Editorial • Fashion',
                    styles: {
                        fontSize: '20px',
                        color: '#CCCCCC',
                        textAlign: 'center',
                        letterSpacing: '2px',
                        margin: '0 auto 60px auto'
                    }
                }
            ],
            about: [
                {
                    id: 'about-editorial',
                    type: 'heading',
                    content: 'THE VISION',
                    styles: {
                        fontSize: '44px',
                        color: '#FFFFFF',
                        textAlign: 'center',
                        fontWeight: '900',
                        letterSpacing: '3px',
                        margin: '40px 0 30px 0'
                    }
                }
            ]
        }
    },

    naturalLight: {
        name: "Natural Light",
        description: "Light and airy photography with soft pastels and natural feel",
        category: "Lifestyle",
        pages: {
            home: [
                {
                    id: 'natural-hero',
                    type: 'heading',
                    content: 'Light & Love',
                    styles: {
                        fontSize: '50px',
                        color: '#E6B8A2',
                        textAlign: 'center',
                        fontWeight: '300',
                        fontStyle: 'italic',
                        margin: '70px 0 30px 0'
                    }
                },
                {
                    id: 'natural-subtitle',
                    type: 'paragraph',
                    content: 'Natural light photography for authentic moments',
                    styles: {
                        fontSize: '18px',
                        color: '#A8A8A8',
                        textAlign: 'center',
                        margin: '0 auto 50px auto',
                        maxWidth: '500px'
                    }
                }
            ]
        }
    },

    vintageFashion: {
        name: "Vintage Fashion",
        description: "Retro-inspired fashion photography with vintage aesthetics",
        category: "Fashion",
        pages: {
            home: [
                {
                    id: 'vintage-hero',
                    type: 'heading',
                    content: 'Timeless Fashion',
                    styles: {
                        fontSize: '48px',
                        color: '#8B4513',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontFamily: 'serif',
                        margin: '60px 0 30px 0'
                    }
                }
            ]
        }
    },

    blackWhiteClassic: {
        name: "Black & White Classic",
        description: "Timeless monochrome photography with dramatic contrast",
        category: "Classic",
        pages: {
            home: [
                {
                    id: 'bw-hero',
                    type: 'heading',
                    content: 'TIMELESS MOMENTS',
                    styles: {
                        fontSize: '54px',
                        color: '#000000',
                        textAlign: 'center',
                        fontWeight: '700',
                        letterSpacing: '3px',
                        margin: '70px 0 40px 0'
                    }
                }
            ]
        }
    },

    adventureOutdoor: {
        name: "Adventure Outdoor",
        description: "Rugged outdoor photography capturing adventure and wilderness",
        category: "Adventure",
        pages: {
            home: [
                {
                    id: 'adventure-hero',
                    type: 'heading',
                    content: 'Wild & Free',
                    styles: {
                        fontSize: '52px',
                        color: '#228B22',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '60px 0 30px 0'
                    }
                }
            ]
        }
    }
};

// Template categories for filtering
const TemplateCategories = [
    'All',
    'Wedding',
    'Minimalist', 
    'Coastal',
    'Editorial',
    'Lifestyle',
    'Fashion',
    'Classic',
    'Adventure'
];

// Export the templates
window.PresetTemplates = PresetTemplates;
window.TemplateCategories = TemplateCategories;
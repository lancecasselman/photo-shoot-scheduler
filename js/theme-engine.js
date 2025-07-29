// Theme Engine for Advanced Website Builder

class ThemeEngine {
    constructor() {
        this.themes = {
            minimal: {
                name: 'Minimal',
                description: 'Clean and simple design',
                colors: {
                    primary: '#2c3e50',
                    secondary: '#ecf0f1',
                    accent: '#3498db',
                    text: '#2c3e50',
                    background: '#ffffff'
                },
                fonts: {
                    heading: '"Helvetica Neue", Arial, sans-serif',
                    body: '"Helvetica Neue", Arial, sans-serif'
                },
                spacing: {
                    section: '60px',
                    element: '20px'
                },
                styles: {
                    borderRadius: '4px',
                    shadow: '0 2px 10px rgba(0,0,0,0.1)'
                }
            },
            classic: {
                name: 'Classic',
                description: 'Timeless and elegant',
                colors: {
                    primary: '#8b4513',
                    secondary: '#f5f5dc',
                    accent: '#cd853f',
                    text: '#2f2f2f',
                    background: '#fefefe'
                },
                fonts: {
                    heading: 'Georgia, "Times New Roman", serif',
                    body: 'Georgia, "Times New Roman", serif'
                },
                spacing: {
                    section: '80px',
                    element: '24px'
                },
                styles: {
                    borderRadius: '8px',
                    shadow: '0 4px 15px rgba(0,0,0,0.1)'
                }
            },
            modern: {
                name: 'Modern',
                description: 'Contemporary and sleek',
                colors: {
                    primary: '#1a1a1a',
                    secondary: '#f8f9fa',
                    accent: '#007bff',
                    text: '#333333',
                    background: '#ffffff'
                },
                fonts: {
                    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                spacing: {
                    section: '100px',
                    element: '30px'
                },
                styles: {
                    borderRadius: '12px',
                    shadow: '0 8px 25px rgba(0,0,0,0.15)'
                }
            },
            elegant: {
                name: 'Elegant',
                description: 'Sophisticated and refined',
                colors: {
                    primary: '#2c2c54',
                    secondary: '#f7f1e3',
                    accent: '#b8860b',
                    text: '#2c2c54',
                    background: '#fefefe'
                },
                fonts: {
                    heading: '"Playfair Display", Georgia, serif',
                    body: '"Source Sans Pro", Arial, sans-serif'
                },
                spacing: {
                    section: '90px',
                    element: '28px'
                },
                styles: {
                    borderRadius: '6px',
                    shadow: '0 6px 20px rgba(0,0,0,0.12)'
                }
            },
            bold: {
                name: 'Bold',
                description: 'Strong and impactful',
                colors: {
                    primary: '#e74c3c',
                    secondary: '#2c3e50',
                    accent: '#f39c12',
                    text: '#2c3e50',
                    background: '#ffffff'
                },
                fonts: {
                    heading: '"Oswald", "Arial Black", sans-serif',
                    body: '"Open Sans", Arial, sans-serif'
                },
                spacing: {
                    section: '70px',
                    element: '25px'
                },
                styles: {
                    borderRadius: '2px',
                    shadow: '0 3px 12px rgba(0,0,0,0.2)'
                }
            },
            creative: {
                name: 'Creative',
                description: 'Artistic and unique',
                colors: {
                    primary: '#9b59b6',
                    secondary: '#ecf0f1',
                    accent: '#e67e22',
                    text: '#2c3e50',
                    background: '#ffffff'
                },
                fonts: {
                    heading: '"Montserrat", sans-serif',
                    body: '"Lato", sans-serif'
                },
                spacing: {
                    section: '85px',
                    element: '22px'
                },
                styles: {
                    borderRadius: '15px',
                    shadow: '0 5px 18px rgba(0,0,0,0.14)'
                }
            }
        };
    }
    
    getTheme(themeId) {
        return this.themes[themeId] || this.themes.minimal;
    }
    
    getAllThemes() {
        return Object.keys(this.themes).map(id => ({
            id,
            ...this.themes[id]
        }));
    }
    
    generateCSS(themeId, brandColor = null) {
        const theme = this.getTheme(themeId);
        const primaryColor = brandColor || theme.colors.primary;
        
        return `
            :root {
                --primary-color: ${primaryColor};
                --secondary-color: ${theme.colors.secondary};
                --accent-color: ${theme.colors.accent};
                --text-color: ${theme.colors.text};
                --background-color: ${theme.colors.background};
                --heading-font: ${theme.fonts.heading};
                --body-font: ${theme.fonts.body};
                --section-spacing: ${theme.spacing.section};
                --element-spacing: ${theme.spacing.element};
                --border-radius: ${theme.styles.borderRadius};
                --box-shadow: ${theme.styles.shadow};
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: var(--body-font);
                line-height: 1.6;
                color: var(--text-color);
                background-color: var(--background-color);
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 20px;
            }
            
            .section {
                padding: var(--section-spacing) 0;
            }
            
            .section:nth-child(even) {
                background-color: var(--secondary-color);
            }
            
            h1, h2, h3, h4, h5, h6 {
                font-family: var(--heading-font);
                color: var(--primary-color);
                margin-bottom: var(--element-spacing);
                line-height: 1.2;
            }
            
            h1 { font-size: 3rem; }
            h2 { font-size: 2.5rem; }
            h3 { font-size: 2rem; }
            h4 { font-size: 1.5rem; }
            h5 { font-size: 1.25rem; }
            h6 { font-size: 1rem; }
            
            p {
                margin-bottom: var(--element-spacing);
                font-size: 1.1rem;
            }
            
            .btn {
                display: inline-block;
                padding: 12px 30px;
                background-color: var(--primary-color);
                color: white;
                text-decoration: none;
                border-radius: var(--border-radius);
                font-weight: 600;
                font-size: 1rem;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: var(--box-shadow);
            }
            
            .btn:hover {
                background-color: var(--accent-color);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.15);
            }
            
            .btn-secondary {
                background-color: transparent;
                color: var(--primary-color);
                border: 2px solid var(--primary-color);
            }
            
            .btn-secondary:hover {
                background-color: var(--primary-color);
                color: white;
            }
            
            .hero {
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                min-height: 70vh;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                position: relative;
                overflow: hidden;
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
                color: white;
                max-width: 800px;
                padding: 0 20px;
            }
            
            .hero h1 {
                color: white;
                font-size: 4rem;
                margin-bottom: 20px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }
            
            .hero p {
                font-size: 1.4rem;
                margin-bottom: 30px;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            }
            
            .gallery {
                display: grid;
                gap: 20px;
                margin: var(--element-spacing) 0;
            }
            
            .gallery-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
            .gallery-3 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
            .gallery-4 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
            
            .gallery img {
                width: 100%;
                height: 300px;
                object-fit: cover;
                border-radius: var(--border-radius);
                box-shadow: var(--box-shadow);
                transition: transform 0.3s ease;
            }
            
            .gallery img:hover {
                transform: scale(1.05);
            }
            
            .card {
                background: white;
                border-radius: var(--border-radius);
                box-shadow: var(--box-shadow);
                padding: 30px;
                margin-bottom: var(--element-spacing);
                transition: transform 0.3s ease;
            }
            
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: var(--text-color);
            }
            
            .form-group input,
            .form-group textarea,
            .form-group select {
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e1e5e9;
                border-radius: var(--border-radius);
                font-size: 1rem;
                font-family: var(--body-font);
                transition: border-color 0.3s ease;
            }
            
            .form-group input:focus,
            .form-group textarea:focus,
            .form-group select:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 3px rgba(var(--primary-color), 0.1);
            }
            
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            
            .mb-1 { margin-bottom: 10px; }
            .mb-2 { margin-bottom: 20px; }
            .mb-3 { margin-bottom: 30px; }
            .mb-4 { margin-bottom: 40px; }
            
            .mt-1 { margin-top: 10px; }
            .mt-2 { margin-top: 20px; }
            .mt-3 { margin-top: 30px; }
            .mt-4 { margin-top: 40px; }
            
            @media (max-width: 768px) {
                .container {
                    padding: 0 15px;
                }
                
                .hero h1 {
                    font-size: 2.5rem;
                }
                
                .hero p {
                    font-size: 1.1rem;
                }
                
                .section {
                    padding: 40px 0;
                }
                
                .gallery {
                    grid-template-columns: 1fr;
                }
                
                .gallery img {
                    height: 250px;
                }
            }
            
            @media (max-width: 480px) {
                .hero h1 {
                    font-size: 2rem;
                }
                
                .card {
                    padding: 20px;
                }
                
                .btn {
                    padding: 10px 20px;
                    font-size: 0.9rem;
                }
            }
        `;
    }
    
    applyTheme(themeId, brandColor = null) {
        const css = this.generateCSS(themeId, brandColor);
        
        // Remove existing theme styles
        const existingStyle = document.getElementById('theme-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Add new theme styles
        const style = document.createElement('style');
        style.id = 'theme-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }
    
    generatePreviewCSS(themeId, brandColor = null) {
        // Generate CSS specifically for iframe preview
        return this.generateCSS(themeId, brandColor);
    }
}

// Create global instance
const themeEngine = new ThemeEngine();
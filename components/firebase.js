// Firebase utility functions for the website builder

class FirebaseManager {
    constructor() {
        this.initialized = false;
        this.waitForInitialization();
    }

    waitForInitialization() {
        const checkFirebase = () => {
            if (window.firebaseReady && window.firebaseAuth && window.firebaseFirestore) {
                this.initialized = true;
                console.log('Firebase initialized for website builder');
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    }

    async getCurrentUser() {
        return new Promise((resolve) => {
            if (!this.initialized) {
                resolve(null);
                return;
            }

            const unsubscribe = window.onAuthStateChanged(window.firebaseAuth, (user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }

    async saveSiteConfig(userId, config) {
        if (!this.initialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const { doc, setDoc } = window.firebaseUtils;
            const docRef = doc(window.firebaseFirestore, 'users', userId, 'siteConfig', 'main');
            
            const configData = {
                blocks: config.blocks || [],
                username: config.username || 'photographer',
                brandColor: config.brandColor || '#D4AF37',
                theme: config.theme || 'classic',
                lastModified: new Date().toISOString(),
                version: '2.0',
                settings: {
                    seoTitle: config.seoTitle || 'Photography Portfolio',
                    seoDescription: config.seoDescription || 'Professional photography services',
                    socialMedia: config.socialMedia || {}
                }
            };
            
            await setDoc(docRef, configData);

            console.log('Site config saved successfully with enhanced data');
            return { success: true, data: configData };
        } catch (error) {
            console.error('Error saving site config:', error);
            throw error;
        }
    }

    async loadSiteConfig(userId) {
        if (!this.initialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const { doc, getDoc } = window.firebaseUtils;
            const docRef = doc(window.firebaseFirestore, 'users', userId, 'siteConfig', 'main');
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                console.log('Site config loaded successfully');
                return docSnap.data();
            } else {
                console.log('No site config found, returning defaults');
                return null;
            }
        } catch (error) {
            console.error('Error loading site config:', error);
            throw error;
        }
    }

    async publishSite(config) {
        try {
            // Enhanced config with additional metadata
            const publishConfig = {
                username: config.username,
                blocks: config.blocks,
                theme: config.theme || 'classic',
                brandColor: config.brandColor || '#D4AF37',
                userEmail: config.userEmail,
                settings: {
                    seoTitle: config.seoTitle || `${config.username} Photography`,
                    seoDescription: config.seoDescription || 'Professional photography portfolio',
                    analytics: config.analytics || false,
                    customDomain: config.customDomain || null
                },
                metadata: {
                    publishedAt: new Date().toISOString(),
                    version: '2.0',
                    builderType: 'advanced'
                }
            };

            const response = await fetch('/api/publish-site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(publishConfig)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Site published successfully with enhanced features:', result);
            
            return {
                success: true,
                url: result.url,
                fullUrl: `${window.location.origin}${result.url}`,
                publishedAt: publishConfig.metadata.publishedAt,
                ...result
            };
        } catch (error) {
            console.error('Error publishing site:', error);
            throw error;
        }
    }

    async generateStaticSite(config, username) {
        // This would be called by a Firebase Function in production
        // For now, we'll use the server endpoint
        try {
            const response = await fetch('/api/generate-static-site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    config,
                    username,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`Static site generation failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('Static site generated:', result);
            return result;
        } catch (error) {
            console.error('Error generating static site:', error);
            throw error;
        }
    }

    // Demo data for development/testing
    getDemoData() {
        return {
            blocks: [
                {
                    id: 'demo-1',
                    type: 'heading',
                    content: 'Welcome to My Photography Studio',
                    styles: {
                        fontSize: '48px',
                        color: '#D4AF37',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        margin: '40px 0'
                    }
                },
                {
                    id: 'demo-2',
                    type: 'paragraph',
                    content: 'Capturing life\'s most precious moments with artistic vision and professional excellence. Browse my portfolio to see how I can tell your story through photography.',
                    styles: {
                        fontSize: '18px',
                        color: '#333',
                        textAlign: 'center',
                        lineHeight: '1.6',
                        margin: '20px auto',
                        maxWidth: '600px'
                    }
                },
                {
                    id: 'demo-3',
                    type: 'image',
                    content: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&h=400&fit=crop',
                    styles: {
                        width: '100%',
                        maxWidth: '600px',
                        height: 'auto',
                        borderRadius: '12px',
                        margin: '30px auto',
                        display: 'block'
                    }
                },
                {
                    id: 'demo-4',
                    type: 'button',
                    content: 'Book Your Session',
                    styles: {
                        backgroundColor: '#D4AF37',
                        color: 'white',
                        padding: '15px 30px',
                        fontSize: '18px',
                        fontWeight: '600',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        margin: '30px auto',
                        display: 'block'
                    }
                }
            ],
            username: 'demo-photographer',
            brandColor: '#D4AF37',
            theme: 'classic'
        };
    }

    // Utility function to convert blocks to HTML
    blocksToHTML(blocks, theme = 'classic', brandColor = '#D4AF37') {
        const themeStyles = this.getThemeStyles(theme);
        
        const blocksHTML = blocks.map(block => {
            const styles = this.stylesToCSS(block.styles);
            
            switch (block.type) {
                case 'heading':
                    return `<h1 style="${styles}">${block.content}</h1>`;
                case 'paragraph':
                    return `<p style="${styles}">${block.content}</p>`;
                case 'image':
                    return `<img src="${block.content}" alt="Website image" style="${styles}" />`;
                case 'button':
                    return `<button style="${styles}">${block.content}</button>`;
                default:
                    return `<div style="${styles}">${block.content}</div>`;
            }
        }).join('\n');

        return `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: ${themeStyles.background};
                color: ${themeStyles.color};
                padding: 40px 20px;
                min-height: 100vh;
            ">
                <div style="max-width: 1200px; margin: 0 auto;">
                    ${blocksHTML}
                </div>
            </div>
        `;
    }

    stylesToCSS(styles) {
        return Object.entries(styles || {})
            .map(([key, value]) => {
                const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${value}`;
            })
            .join('; ');
    }

    getThemeStyles(theme) {
        const themes = {
            'classic': {
                background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                color: '#343a40'
            },
            'modern': {
                background: 'linear-gradient(135deg, #2563EB, #1e40af)',
                color: '#f8f9fa'
            },
            'dark': {
                background: 'linear-gradient(135deg, #1f2937, #111827)',
                color: '#f9fafb'
            },
            'bold': {
                background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                color: '#fef2f2'
            }
        };
        return themes[theme] || themes['classic'];
    }
}

// Create global instance
window.FirebaseManager = new FirebaseManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseManager;
}
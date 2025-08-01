// Brand Gallery Integration Service
// Links White House custom colors to client gallery interfaces

class BrandGalleryService {
    constructor() {
        this.defaultBrandSettings = {
            logo: '/attached_assets/logo_1753330290399.png',
            businessName: 'The Legacy Photography',
            primaryColor: '#d4af37',
            secondaryColor: '#8b7355',
            accentColor: '#f4e4bc',
            backgroundColor: '#1a1a1a',
            textColor: '#ffffff',
            fontStyle: 'playfair'
        };
    }

    // Get brand settings for a specific user/photographer
    async getBrandSettings(userId) {
        try {
            // First try to get from database
            const result = await pool.query(`
                SELECT brand_settings FROM user_brand_settings 
                WHERE user_id = $1
            `, [userId]);
            
            if (result.rows.length > 0 && result.rows[0].brand_settings) {
                return {
                    ...this.defaultBrandSettings,
                    ...result.rows[0].brand_settings
                };
            }
            
            // Fallback to localStorage-style saved settings
            return this.defaultBrandSettings;
            
        } catch (error) {
            console.error('Error fetching brand settings:', error);
            return this.defaultBrandSettings;
        }
    }

    // Save brand settings for a user
    async saveBrandSettings(userId, brandSettings) {
        try {
            await pool.query(`
                INSERT INTO user_brand_settings (user_id, brand_settings, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET 
                    brand_settings = $2,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, JSON.stringify(brandSettings)]);
            
            console.log(`✅ Brand settings saved for user ${userId}`);
            return true;
            
        } catch (error) {
            console.error('Error saving brand settings:', error);
            return false;
        }
    }

    // Generate CSS for gallery branding
    generateGalleryCSS(brandSettings) {
        const {
            primaryColor,
            secondaryColor,
            accentColor,
            backgroundColor,
            textColor,
            fontStyle
        } = brandSettings;

        const fontFamily = this.getFontFamily(fontStyle);

        return `
            <style>
                :root {
                    --brand-primary: ${primaryColor};
                    --brand-secondary: ${secondaryColor};
                    --brand-accent: ${accentColor};
                    --brand-bg: ${backgroundColor};
                    --brand-text: ${textColor};
                    --brand-font: ${fontFamily};
                }

                body {
                    background: linear-gradient(135deg, var(--brand-bg) 0%, color-mix(in srgb, var(--brand-bg), var(--brand-primary) 20%) 100%);
                    font-family: var(--brand-font) !important;
                    color: var(--brand-text);
                }

                .header {
                    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
                    color: var(--brand-text);
                    border: 2px solid var(--brand-accent);
                }

                .header h1 {
                    color: var(--brand-text);
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }

                .session-info {
                    background: rgba(255,255,255,0.95);
                    border-left: 4px solid var(--brand-primary);
                    backdrop-filter: blur(10px);
                }

                .gallery-container {
                    background: rgba(255,255,255,0.95);
                    border-top: 3px solid var(--brand-primary);
                    backdrop-filter: blur(10px);
                }

                .photo-count {
                    background: var(--brand-primary);
                    color: var(--brand-text);
                    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
                }

                .photo-item {
                    border: 2px solid transparent;
                    transition: all 0.3s ease;
                }

                .photo-item:hover {
                    border-color: var(--brand-primary);
                    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.3);
                    transform: scale(1.02);
                }

                .download-btn {
                    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
                    color: var(--brand-text);
                    border: none;
                    padding: 12px 25px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-family: var(--brand-font);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
                }

                .download-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
                }

                .lightbox {
                    background: rgba(26, 26, 26, 0.95);
                }

                .lightbox-nav {
                    color: var(--brand-primary);
                    background: rgba(212, 175, 55, 0.2);
                    border-radius: 50%;
                    backdrop-filter: blur(10px);
                }

                .business-branding {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(212, 175, 55, 0.9);
                    color: var(--brand-text);
                    padding: 8px 15px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    backdrop-filter: blur(10px);
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
                }

                .brand-watermark {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    opacity: 0.7;
                    font-size: 11px;
                    color: var(--brand-primary);
                    font-family: var(--brand-font);
                    z-index: 1000;
                }

                /* Mobile optimizations */
                @media (max-width: 768px) {
                    .header {
                        padding: 20px;
                    }
                    
                    .business-branding {
                        position: relative;
                        top: 0;
                        right: 0;
                        margin-bottom: 15px;
                        display: inline-block;
                    }
                }
            </style>
        `;
    }

    // Get font family CSS
    getFontFamily(fontStyle) {
        const fontMap = {
            'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            'serif': 'Georgia, "Times New Roman", serif',
            'playfair': '"Playfair Display", Georgia, serif',
            'lora': '"Lora", Georgia, serif',
            'crimson': '"Crimson Text", Georgia, serif',
            'modern': '"Helvetica Neue", Helvetica, Arial, sans-serif',
            'montserrat': '"Montserrat", Arial, sans-serif',
            'opensans': '"Open Sans", Arial, sans-serif',
            'roboto': '"Roboto", Arial, sans-serif'
        };
        return fontMap[fontStyle] || fontMap.playfair;
    }

    // Generate branded gallery HTML elements
    generateBrandedElements(brandSettings) {
        return {
            businessBranding: `
                <div class="business-branding">
                    ${brandSettings.businessName || 'The Legacy Photography'}
                </div>
            `,
            brandWatermark: `
                <div class="brand-watermark">
                    Powered by ${brandSettings.businessName || 'The Legacy Photography'}
                </div>
            `,
            logoHeader: brandSettings.logo ? `
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${brandSettings.logo}" alt="${brandSettings.businessName}" 
                         style="max-height: 80px; width: auto; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));">
                </div>
            ` : ''
        };
    }

    // Create gallery access token with brand settings
    async createBrandedGalleryToken(sessionId, userId) {
        try {
            const brandSettings = await this.getBrandSettings(userId);
            const token = require('crypto').randomBytes(32).toString('hex');
            
            // Store token with brand settings
            await pool.query(`
                INSERT INTO gallery_access_tokens (
                    token, session_id, user_id, brand_settings, 
                    expires_at, created_at
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [
                token,
                sessionId,
                userId,
                JSON.stringify(brandSettings),
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            ]);
            
            return token;
            
        } catch (error) {
            console.error('Error creating branded gallery token:', error);
            throw error;
        }
    }

    // Get brand settings from gallery token
    async getBrandSettingsFromToken(token) {
        try {
            const result = await pool.query(`
                SELECT brand_settings FROM gallery_access_tokens 
                WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP
            `, [token]);
            
            if (result.rows.length > 0) {
                return JSON.parse(result.rows[0].brand_settings);
            }
            
            return this.defaultBrandSettings;
            
        } catch (error) {
            console.error('Error getting brand settings from token:', error);
            return this.defaultBrandSettings;
        }
    }
}

module.exports = { BrandGalleryService };
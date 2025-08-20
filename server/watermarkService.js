const sharp = require('sharp');
const { pool } = require('./db');

class WatermarkService {
    constructor() {
        this.watermarkSettings = new Map(); // Cache for watermark settings
    }

    /**
     * Get watermark settings for a user
     */
    async getWatermarkSettings(userId) {
        // Check cache first
        if (this.watermarkSettings.has(userId)) {
            return this.watermarkSettings.get(userId);
        }

        try {
            const result = await pool.query(
                'SELECT * FROM watermark_settings WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length > 0) {
                const settings = result.rows[0];
                this.watermarkSettings.set(userId, settings);
                return settings;
            }

            return null;
        } catch (error) {
            console.error('Error fetching watermark settings:', error);
            return null;
        }
    }

    /**
     * Clear cached settings for a user
     */
    clearCache(userId) {
        this.watermarkSettings.delete(userId);
    }

    /**
     * Apply watermark to an image buffer
     */
    async applyWatermark(imageBuffer, userId, context = 'galleries') {
        try {
            const settings = await this.getWatermarkSettings(userId);
            
            // If no settings or watermarking is disabled, return original image
            if (!settings || !settings.enabled) {
                return imageBuffer;
            }

            // Check if watermark should be applied based on context
            const contextMap = {
                'galleries': settings.apply_to_galleries,
                'downloads': settings.apply_to_downloads,
                'social': settings.apply_to_social,
                'proofs': settings.apply_to_proofs
            };

            if (!contextMap[context]) {
                return imageBuffer;
            }

            // Process image with Sharp
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();

            if (settings.type === 'text') {
                return await this.applyTextWatermark(image, metadata, settings);
            } else if (settings.type === 'logo' && settings.logo_url) {
                return await this.applyLogoWatermark(image, metadata, settings);
            }

            return imageBuffer;
        } catch (error) {
            console.error('Error applying watermark:', error);
            return imageBuffer; // Return original on error
        }
    }

    /**
     * Apply text watermark to image
     */
    async applyTextWatermark(image, metadata, settings) {
        const { width, height } = metadata;
        
        // Calculate font size based on image dimensions and setting
        const fontSizeMap = {
            'small': Math.max(12, Math.floor(width * 0.015)),
            'medium': Math.max(16, Math.floor(width * 0.02)),
            'large': Math.max(20, Math.floor(width * 0.025)),
            'extra-large': Math.max(24, Math.floor(width * 0.03))
        };
        
        const fontSize = fontSizeMap[settings.font_size] || fontSizeMap['medium'];
        
        // Create text SVG
        const textContent = settings.text_content || '© 2025 Photography';
        const svgText = this.createTextSVG(
            textContent,
            fontSize,
            settings.font_family || 'Arial',
            settings.color || '#FFFFFF',
            settings.opacity || 50
        );
        
        // Calculate position
        const position = this.calculatePosition(
            width,
            height,
            textContent.length * fontSize * 0.6, // Approximate text width
            fontSize * 1.5, // Approximate text height
            settings.position || 'bottom-right'
        );
        
        // Apply watermark
        return await image
            .composite([{
                input: Buffer.from(svgText),
                top: position.top,
                left: position.left
            }])
            .toBuffer();
    }

    /**
     * Apply logo watermark to image
     */
    async applyLogoWatermark(image, metadata, settings) {
        try {
            const { width, height } = metadata;
            
            // Fetch logo from URL (in production, this would be from R2 storage)
            const logoResponse = await fetch(settings.logo_url);
            const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
            
            // Process logo with Sharp
            const logo = sharp(logoBuffer);
            const logoMetadata = await logo.metadata();
            
            // Calculate logo size (max 15% of image width or 200px)
            const maxLogoWidth = Math.min(width * 0.15, 200);
            const scale = maxLogoWidth / logoMetadata.width;
            const logoWidth = Math.floor(logoMetadata.width * scale);
            const logoHeight = Math.floor(logoMetadata.height * scale);
            
            // Resize logo
            const resizedLogo = await logo
                .resize(logoWidth, logoHeight)
                .toBuffer();
            
            // Calculate position
            const position = this.calculatePosition(
                width,
                height,
                logoWidth,
                logoHeight,
                settings.position || 'bottom-right'
            );
            
            // Apply watermark with opacity
            const opacity = Math.round((settings.opacity || 50) * 2.55); // Convert percentage to 0-255
            
            return await image
                .composite([{
                    input: resizedLogo,
                    top: position.top,
                    left: position.left,
                    blend: 'over'
                }])
                .toBuffer();
        } catch (error) {
            console.error('Error applying logo watermark:', error);
            // Return with text watermark as fallback
            return await this.applyTextWatermark(image, metadata, {
                ...settings,
                type: 'text',
                text_content: '© 2025 Photography'
            });
        }
    }

    /**
     * Create SVG text for watermark
     */
    createTextSVG(text, fontSize, fontFamily, color, opacity) {
        const textWidth = text.length * fontSize * 0.6;
        const textHeight = fontSize * 1.5;
        const opacityValue = opacity / 100;
        
        return `
            <svg width="${textWidth}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">
                <style>
                    .watermark-text { 
                        fill: ${color}; 
                        font-size: ${fontSize}px; 
                        font-family: ${fontFamily}, sans-serif;
                        opacity: ${opacityValue};
                    }
                </style>
                <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="watermark-text">
                    ${text}
                </text>
            </svg>
        `;
    }

    /**
     * Calculate watermark position
     */
    calculatePosition(imageWidth, imageHeight, watermarkWidth, watermarkHeight, position) {
        const padding = 20;
        const positions = {
            'top-left': {
                top: padding,
                left: padding
            },
            'top-center': {
                top: padding,
                left: Math.floor((imageWidth - watermarkWidth) / 2)
            },
            'top-right': {
                top: padding,
                left: imageWidth - watermarkWidth - padding
            },
            'center-left': {
                top: Math.floor((imageHeight - watermarkHeight) / 2),
                left: padding
            },
            'center': {
                top: Math.floor((imageHeight - watermarkHeight) / 2),
                left: Math.floor((imageWidth - watermarkWidth) / 2)
            },
            'center-right': {
                top: Math.floor((imageHeight - watermarkHeight) / 2),
                left: imageWidth - watermarkWidth - padding
            },
            'bottom-left': {
                top: imageHeight - watermarkHeight - padding,
                left: padding
            },
            'bottom-center': {
                top: imageHeight - watermarkHeight - padding,
                left: Math.floor((imageWidth - watermarkWidth) / 2)
            },
            'bottom-right': {
                top: imageHeight - watermarkHeight - padding,
                left: imageWidth - watermarkWidth - padding
            }
        };
        
        return positions[position] || positions['bottom-right'];
    }

    /**
     * Apply watermark to multiple images in batch
     */
    async applyWatermarkBatch(imageBuffers, userId, context = 'galleries') {
        const settings = await this.getWatermarkSettings(userId);
        
        // If no settings or watermarking is disabled, return original images
        if (!settings || !settings.enabled) {
            return imageBuffers;
        }

        // Process images in parallel
        const promises = imageBuffers.map(buffer => 
            this.applyWatermark(buffer, userId, context)
        );
        
        return await Promise.all(promises);
    }

    /**
     * Generate watermarked preview for gallery images
     */
    async generateWatermarkedPreview(imageBuffer, userId, maxWidth = 1200) {
        try {
            // First resize the image for preview
            const resized = await sharp(imageBuffer)
                .resize(maxWidth, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .jpeg({ quality: 85 })
                .toBuffer();
            
            // Then apply watermark
            return await this.applyWatermark(resized, userId, 'proofs');
        } catch (error) {
            console.error('Error generating watermarked preview:', error);
            return imageBuffer;
        }
    }
}

// Export singleton instance
module.exports = new WatermarkService();
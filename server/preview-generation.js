/**
 * Preview Generation System
 * Creates watermarked, resolution-capped preview images for client gallery viewing
 * while protecting original files behind tokenized download URLs
 */

const sharp = require('sharp');
const { Pool } = require('pg');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and } = require('drizzle-orm');
const { photographySessions } = require('../shared/schema');
const path = require('path');
const crypto = require('crypto');

class PreviewGenerationService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.db = drizzle(this.pool);
        
        // R2 Configuration
        this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        this.accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
        this.secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
        
        if (this.bucketName && this.accountId && this.accessKeyId && this.secretAccessKey) {
            this.s3Client = new S3Client({
                region: 'auto',
                endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: this.accessKeyId,
                    secretAccessKey: this.secretAccessKey,
                },
                forcePathStyle: true,
            });
            
            this.r2Available = true;
            console.log('✅ Preview Generation Service initialized with R2');
        } else {
            console.warn('⚠️ R2 credentials missing - preview generation will use fallback');
            this.r2Available = false;
        }
        
        // Preview configuration
        this.previewConfig = {
            maxWidth: 1600,
            maxHeight: 1280,
            quality: 82, // High quality for purchase decisions
            format: 'jpeg',
            watermarkOpacity: 0.24, // 24% opacity (18-28% range)
            diagonalTileCount: 12, // Number of diagonal watermark tiles
            cornerWatermarkSize: 120 // Size for corner watermarks in free mode
        };
        
        console.log('📸 Preview Generation Service ready');
    }
    
    /**
     * Generate a watermarked preview for an image file
     */
    async generateWatermarkedPreview(originalBuffer, filename, sessionId, userId, pricingMode = 'freemium') {
        try {
            console.log(`🎨 Generating watermarked preview for: ${filename} (mode: ${pricingMode})`);
            
            // Get session watermark settings
            const sessionSettings = await this.getSessionWatermarkSettings(sessionId);
            
            // Get image metadata
            const image = sharp(originalBuffer);
            const metadata = await image.metadata();
            
            // Calculate preview dimensions (respect aspect ratio, cap at max resolution)
            const { width: previewWidth, height: previewHeight } = this.calculatePreviewDimensions(
                metadata.width,
                metadata.height
            );
            
            // Create base preview image
            let preview = image
                .resize(previewWidth, previewHeight, {
                    fit: 'inside',
                    withoutEnlargement: false,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .jpeg({ quality: this.previewConfig.quality, progressive: true });
            
            // Apply watermarking based on pricing mode and session settings
            if (pricingMode === 'free') {
                // Free mode: Subtle corner watermark
                preview = await this.applyCornerWatermark(preview, sessionSettings, previewWidth, previewHeight);
            } else {
                // Paid/Freemium modes: Diagonal tiled watermark for protection
                preview = await this.applyDiagonalTiledWatermark(preview, sessionSettings, previewWidth, previewHeight);
            }
            
            const previewBuffer = await preview.toBuffer();
            
            console.log(`✅ Generated ${previewWidth}x${previewHeight} watermarked preview for ${filename}`);
            
            return {
                success: true,
                buffer: previewBuffer,
                width: previewWidth,
                height: previewHeight,
                size: previewBuffer.length,
                contentType: 'image/jpeg'
            };
            
        } catch (error) {
            console.error('❌ Error generating watermarked preview:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Calculate optimal preview dimensions respecting max resolution limits
     */
    calculatePreviewDimensions(originalWidth, originalHeight) {
        const maxWidth = this.previewConfig.maxWidth;
        const maxHeight = this.previewConfig.maxHeight;
        
        // Determine the long edge
        const isLandscape = originalWidth >= originalHeight;
        const longEdge = isLandscape ? originalWidth : originalHeight;
        const shortEdge = isLandscape ? originalHeight : originalWidth;
        
        // Cap the long edge at maxWidth (1600px)
        let newLongEdge = Math.min(longEdge, maxWidth);
        let newShortEdge = Math.round((shortEdge / longEdge) * newLongEdge);
        
        // Ensure short edge doesn't exceed maxHeight (1280px)
        if (newShortEdge > maxHeight) {
            const ratio = maxHeight / newShortEdge;
            newShortEdge = maxHeight;
            newLongEdge = Math.round(newLongEdge * ratio);
        }
        
        return isLandscape 
            ? { width: newLongEdge, height: newShortEdge }
            : { width: newShortEdge, height: newLongEdge };
    }
    
    /**
     * Apply subtle corner watermark for free mode
     */
    async applyCornerWatermark(sharpInstance, sessionSettings, width, height) {
        try {
            if (!sessionSettings.watermarkEnabled) {
                return sharpInstance;
            }
            
            if (sessionSettings.watermarkType === 'text') {
                // Create subtle text watermark in corner
                const watermarkText = sessionSettings.watermarkText || 'Preview';
                const fontSize = Math.max(16, Math.min(24, width / 50)); // Responsive font size
                
                const textSvg = Buffer.from(`
                    <svg width="${width}" height="${height}">
                        <defs>
                            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.3"/>
                            </filter>
                        </defs>
                        <text x="${width - 20}" y="${height - 20}" 
                              font-family="Arial, sans-serif" 
                              font-size="${fontSize}" 
                              fill="white" 
                              text-anchor="end" 
                              dominant-baseline="bottom"
                              filter="url(#shadow)"
                              opacity="0.18">
                            ${watermarkText}
                        </text>
                    </svg>
                `);
                
                return sharpInstance.composite([{
                    input: textSvg,
                    blend: 'over'
                }]);
            } else if (sessionSettings.watermarkType === 'logo' && sessionSettings.watermarkLogoUrl) {
                // Apply logo watermark in corner
                const logoSize = this.previewConfig.cornerWatermarkSize;
                const logoBuffer = await this.fetchWatermarkLogo(sessionSettings.watermarkLogoUrl);
                
                if (logoBuffer) {
                    const processedLogo = await sharp(logoBuffer)
                        .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
                        .png({ compressionLevel: 9 })
                        .toBuffer();
                    
                    const position = this.getWatermarkPosition(sessionSettings.watermarkPosition, width, height, logoSize, logoSize);
                    
                    return sharpInstance.composite([{
                        input: processedLogo,
                        left: position.left,
                        top: position.top,
                        blend: 'over'
                    }]);
                }
            }
            
            return sharpInstance;
        } catch (error) {
            console.warn('⚠️ Corner watermark failed, continuing without:', error.message);
            return sharpInstance;
        }
    }
    
    /**
     * Apply diagonal tiled watermark for paid/freemium modes
     */
    async applyDiagonalTiledWatermark(sharpInstance, sessionSettings, width, height) {
        try {
            if (!sessionSettings.watermarkEnabled) {
                return sharpInstance;
            }
            
            const tileCount = this.previewConfig.diagonalTileCount;
            const opacity = this.previewConfig.watermarkOpacity;
            
            if (sessionSettings.watermarkType === 'text') {
                // Create diagonal tiled text watermark
                const watermarkText = sessionSettings.watermarkText || 'PREVIEW';
                return await this.createDiagonalTextWatermark(sharpInstance, watermarkText, width, height, tileCount, opacity);
            } else if (sessionSettings.watermarkType === 'logo' && sessionSettings.watermarkLogoUrl) {
                // Create diagonal tiled logo watermark
                const logoBuffer = await this.fetchWatermarkLogo(sessionSettings.watermarkLogoUrl);
                if (logoBuffer) {
                    return await this.createDiagonalLogoWatermark(sharpInstance, logoBuffer, width, height, tileCount, opacity);
                }
            }
            
            // Fallback to default text watermark if no settings
            return await this.createDiagonalTextWatermark(sharpInstance, 'PREVIEW', width, height, tileCount, opacity);
            
        } catch (error) {
            console.warn('⚠️ Diagonal watermark failed, continuing without:', error.message);
            return sharpInstance;
        }
    }
    
    /**
     * Create diagonal tiled text watermark
     */
    async createDiagonalTextWatermark(sharpInstance, text, width, height, tileCount, opacity) {
        // Calculate tile dimensions
        const diagonal = Math.sqrt(width * width + height * height);
        const tileSpacing = diagonal / tileCount;
        const fontSize = Math.max(18, Math.min(32, tileSpacing / 6)); // Responsive font size
        
        // Create SVG with diagonal pattern
        const tiles = [];
        for (let i = 0; i < tileCount * 2; i++) {
            const x = (i * tileSpacing) - diagonal;
            const y = height / 2;
            
            tiles.push(`
                <text x="${x}" y="${y}" 
                      font-family="Arial, sans-serif" 
                      font-size="${fontSize}" 
                      font-weight="bold"
                      fill="white" 
                      text-anchor="middle" 
                      dominant-baseline="central"
                      transform="rotate(-45 ${x} ${y})"
                      opacity="${opacity}">
                    ${text}
                </text>
            `);
        }
        
        const textSvg = Buffer.from(`
            <svg width="${width}" height="${height}">
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/>
                    </filter>
                </defs>
                <g filter="url(#shadow)">
                    ${tiles.join('')}
                </g>
            </svg>
        `);
        
        return sharpInstance.composite([{
            input: textSvg,
            blend: 'over'
        }]);
    }
    
    /**
     * Create diagonal tiled logo watermark
     */
    async createDiagonalLogoWatermark(sharpInstance, logoBuffer, width, height, tileCount, opacity) {
        // Calculate tile dimensions
        const diagonal = Math.sqrt(width * width + height * height);
        const tileSpacing = diagonal / tileCount;
        const logoSize = Math.max(20, Math.min(60, tileSpacing / 4)); // Responsive logo size
        
        // Process logo
        const processedLogo = await sharp(logoBuffer)
            .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
            .png({ compressionLevel: 9 })
            .toBuffer();
        
        // Apply opacity to logo
        const transparentLogo = await sharp(processedLogo)
            .composite([{
                input: Buffer.from(`<svg width="${logoSize}" height="${logoSize}"><rect width="100%" height="100%" fill="black" opacity="${opacity}"/></svg>`),
                blend: 'dest-in'
            }])
            .png()
            .toBuffer();
        
        // Create composite array with positioned logos
        const composites = [];
        const angle = -45; // Diagonal angle
        
        for (let i = 0; i < tileCount; i++) {
            for (let j = 0; j < tileCount; j++) {
                const x = (i * tileSpacing) - logoSize / 2;
                const y = (j * tileSpacing) - logoSize / 2;
                
                // Skip if outside image bounds
                if (x + logoSize > 0 && x < width && y + logoSize > 0 && y < height) {
                    composites.push({
                        input: transparentLogo,
                        left: Math.round(x),
                        top: Math.round(y),
                        blend: 'over'
                    });
                }
            }
        }
        
        return sharpInstance.composite(composites);
    }
    
    /**
     * Get session watermark settings from database
     */
    async getSessionWatermarkSettings(sessionId) {
        try {
            const session = await this.db
                .select({
                    watermarkEnabled: photographySessions.watermarkEnabled,
                    watermarkType: photographySessions.watermarkType,
                    watermarkText: photographySessions.watermarkText,
                    watermarkLogoUrl: photographySessions.watermarkLogoUrl,
                    watermarkPosition: photographySessions.watermarkPosition,
                    watermarkOpacity: photographySessions.watermarkOpacity,
                    watermarkScale: photographySessions.watermarkScale
                })
                .from(photographySessions)
                .where(eq(photographySessions.id, sessionId))
                .limit(1);
            
            if (session.length > 0) {
                return session[0];
            }
            
            // Return default settings if no session found
            return {
                watermarkEnabled: true,
                watermarkType: 'text',
                watermarkText: 'PREVIEW',
                watermarkLogoUrl: null,
                watermarkPosition: 'center',
                watermarkOpacity: 0.24,
                watermarkScale: 1.0
            };
            
        } catch (error) {
            console.warn('⚠️ Failed to fetch watermark settings, using defaults:', error.message);
            return {
                watermarkEnabled: true,
                watermarkType: 'text',
                watermarkText: 'PREVIEW',
                watermarkLogoUrl: null,
                watermarkPosition: 'center',
                watermarkOpacity: 0.24,
                watermarkScale: 1.0
            };
        }
    }
    
    /**
     * Fetch watermark logo from R2 storage
     */
    async fetchWatermarkLogo(logoUrl) {
        try {
            if (!logoUrl || !this.r2Available) return null;
            
            // Extract R2 key from URL
            const r2Key = logoUrl.includes('/') ? logoUrl.split('/').pop() : logoUrl;
            
            const getCommand = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: `watermarks/${r2Key}`
            });
            
            const response = await this.s3Client.send(getCommand);
            const chunks = [];
            
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            
            return Buffer.concat(chunks);
            
        } catch (error) {
            console.warn(`⚠️ Failed to fetch watermark logo: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Calculate watermark position
     */
    getWatermarkPosition(position, imageWidth, imageHeight, watermarkWidth, watermarkHeight) {
        const margin = 20; // Margin from edges
        
        switch (position) {
            case 'top-left':
                return { left: margin, top: margin };
            case 'top-right':
                return { left: imageWidth - watermarkWidth - margin, top: margin };
            case 'bottom-left':
                return { left: margin, top: imageHeight - watermarkHeight - margin };
            case 'bottom-right':
                return { left: imageWidth - watermarkWidth - margin, top: imageHeight - watermarkHeight - margin };
            case 'center':
            default:
                return { 
                    left: Math.round((imageWidth - watermarkWidth) / 2), 
                    top: Math.round((imageHeight - watermarkHeight) / 2) 
                };
        }
    }
    
    /**
     * Store preview in R2 cache
     */
    async storePreviewInCache(buffer, userId, sessionId, filename, pricingMode) {
        try {
            if (!this.r2Available) return null;
            
            const previewKey = `previews/photographer-${userId}/session-${sessionId}/${pricingMode}/${filename}`;
            
            const putCommand = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: previewKey,
                Body: buffer,
                ContentType: 'image/jpeg',
                Metadata: {
                    'original-filename': filename,
                    'pricing-mode': pricingMode,
                    'generated-at': new Date().toISOString(),
                    'service': 'preview-generation'
                }
            });
            
            await this.s3Client.send(putCommand);
            console.log(`📦 Cached preview: ${previewKey}`);
            return previewKey;
            
        } catch (error) {
            console.warn('⚠️ Failed to cache preview:', error.message);
            return null;
        }
    }
    
    /**
     * Check if preview exists in cache
     */
    async getPreviewFromCache(userId, sessionId, filename, pricingMode) {
        try {
            if (!this.r2Available) return null;
            
            const previewKey = `previews/photographer-${userId}/session-${sessionId}/${pricingMode}/${filename}`;
            
            const headCommand = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: previewKey
            });
            
            await this.s3Client.send(headCommand);
            
            // If we get here, the preview exists - fetch it
            const getCommand = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: previewKey
            });
            
            const response = await this.s3Client.send(getCommand);
            const chunks = [];
            
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            
            const buffer = Buffer.concat(chunks);
            console.log(`🎯 Retrieved cached preview: ${previewKey}`);
            
            return {
                buffer,
                contentType: 'image/jpeg',
                cached: true
            };
            
        } catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                console.log(`📭 No cached preview found: ${filename}`);
            } else {
                console.warn('⚠️ Cache check failed:', error.message);
            }
            return null;
        }
    }
}

module.exports = PreviewGenerationService;
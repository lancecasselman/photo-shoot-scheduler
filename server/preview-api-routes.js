/**
 * Preview API Routes
 * Serves watermarked preview images for client gallery viewing
 */

const express = require('express');
const PreviewGenerationService = require('./preview-generation');
const { Pool } = require('pg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const rateLimit = require('express-rate-limit');

// Rate limiting for preview requests
const previewRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 preview requests per windowMs
    message: 'Too many preview requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

function createPreviewApiRoutes() {
    const router = express.Router();
    
    // Initialize services
    const previewService = new PreviewGenerationService();
    
    // Database connection
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // R2 Configuration for original file access
    const r2Config = {
        bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    };
    
    let s3Client = null;
    if (r2Config.bucketName && r2Config.accountId && r2Config.accessKeyId && r2Config.secretAccessKey) {
        s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: r2Config.accessKeyId,
                secretAccessKey: r2Config.secretAccessKey,
            },
            forcePathStyle: true,
        });
    }
    
    /**
     * GET /api/preview/:sessionId/:filename
     * Serve watermarked preview images for gallery viewing
     * Public endpoint (protected by gallery token validation)
     */
    router.get('/:sessionId/:filename', previewRateLimit, async (req, res) => {
        try {
            const { sessionId, filename } = req.params;
            const { token, mode = 'freemium', size = 'preview' } = req.query;
            
            console.log('📸 Preview request:', { 
                sessionId: sessionId.substring(0, 8) + '...', 
                filename: filename.substring(0, 20) + '...', 
                mode, 
                size 
            });
            
            // Validate gallery access token
            if (!token) {
                return res.status(403).json({ error: 'Gallery access token required' });
            }
            
            // Verify token and session access
            const tokenValidation = await validateGalleryToken(pool, token, sessionId);
            if (!tokenValidation.valid) {
                return res.status(403).json({ error: 'Invalid or expired gallery token' });
            }
            
            const { userId, pricingMode } = tokenValidation;
            const effectiveMode = mode || pricingMode || 'freemium';
            
            // Check cache first
            const cachedPreview = await previewService.getPreviewFromCache(userId, sessionId, filename, effectiveMode);
            if (cachedPreview) {
                res.set({
                    'Content-Type': cachedPreview.contentType,
                    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                    'X-Preview-Mode': effectiveMode,
                    'X-Cached': 'true'
                });
                return res.send(cachedPreview.buffer);
            }
            
            // Fetch original file from R2
            const originalFile = await fetchOriginalFile(s3Client, r2Config.bucketName, userId, sessionId, filename);
            if (!originalFile.success) {
                return res.status(404).json({ error: 'Original image not found' });
            }
            
            // Generate watermarked preview
            const preview = await previewService.generateWatermarkedPreview(
                originalFile.buffer,
                filename,
                sessionId,
                userId,
                effectiveMode
            );
            
            if (!preview.success) {
                return res.status(500).json({ error: 'Failed to generate preview' });
            }
            
            // Cache the preview
            await previewService.storePreviewInCache(
                preview.buffer,
                userId,
                sessionId,
                filename,
                effectiveMode
            );
            
            // Serve the preview
            res.set({
                'Content-Type': preview.contentType,
                'Content-Length': preview.buffer.length,
                'Cache-Control': 'public, max-age=3600',
                'X-Preview-Mode': effectiveMode,
                'X-Image-Width': preview.width,
                'X-Image-Height': preview.height,
                'X-Cached': 'false'
            });
            
            res.send(preview.buffer);
            
            console.log('✅ Preview served:', { 
                sessionId: sessionId.substring(0, 8) + '...', 
                filename: filename.substring(0, 20) + '...', 
                size: `${preview.width}x${preview.height}`,
                mode: effectiveMode
            });
            
        } catch (error) {
            console.error('❌ Preview API error:', error);
            res.status(500).json({ error: 'Preview generation failed' });
        }
    });
    
    /**
     * GET /api/preview/:sessionId/:filename/info
     * Get preview information without serving the image
     */
    router.get('/:sessionId/:filename/info', previewRateLimit, async (req, res) => {
        try {
            const { sessionId, filename } = req.params;
            const { token, mode = 'freemium' } = req.query;
            
            if (!token) {
                return res.status(403).json({ error: 'Gallery access token required' });
            }
            
            // Validate token
            const tokenValidation = await validateGalleryToken(pool, token, sessionId);
            if (!tokenValidation.valid) {
                return res.status(403).json({ error: 'Invalid or expired gallery token' });
            }
            
            const { userId, pricingMode, clientName } = tokenValidation;
            const effectiveMode = mode || pricingMode || 'freemium';
            
            // Get pricing information
            const pricingInfo = await getPricingInfo(pool, sessionId, effectiveMode);
            
            res.json({
                success: true,
                sessionId,
                filename,
                pricingMode: effectiveMode,
                clientName,
                pricing: pricingInfo,
                watermarked: effectiveMode !== 'free',
                previewUrl: `/api/preview/${sessionId}/${filename}?token=${token}&mode=${effectiveMode}`
            });
            
        } catch (error) {
            console.error('❌ Preview info error:', error);
            res.status(500).json({ error: 'Failed to get preview information' });
        }
    });
    
    return router;
}

/**
 * Validate gallery access token
 */
async function validateGalleryToken(pool, token, sessionId) {
    try {
        // Query photography_sessions table directly using gallery_access_token field
        const query = `
            SELECT 
                id as session_id,
                user_id,
                client_name,
                pricing_model,
                gallery_expires_at as expires_at,
                gallery_access_token
            FROM photography_sessions
            WHERE gallery_access_token = $1 
            AND id = $2 
            AND (gallery_expires_at IS NULL OR gallery_expires_at > NOW())
        `;
        
        const result = await pool.query(query, [token, sessionId]);
        
        if (result.rows.length === 0) {
            // Fallback: check if it's a valid session without token validation (for legacy support)
            const sessionQuery = `
                SELECT 
                    id as session_id,
                    user_id,
                    client_name,
                    pricing_model
                FROM photography_sessions
                WHERE id = $1
            `;
            
            const sessionResult = await pool.query(sessionQuery, [sessionId]);
            
            if (sessionResult.rows.length === 0) {
                return { valid: false };
            }
            
            const session = sessionResult.rows[0];
            return {
                valid: true,
                userId: session.user_id,
                clientName: session.client_name,
                pricingMode: session.pricing_model || 'freemium'
            };
        }
        
        const tokenData = result.rows[0];
        return {
            valid: true,
            userId: tokenData.user_id,
            clientName: tokenData.client_name,
            pricingMode: tokenData.pricing_model || 'freemium',
            sessionId: tokenData.session_id
        };
        
    } catch (error) {
        console.error('Token validation error:', error);
        return { valid: false };
    }
}

/**
 * Fetch original file from R2
 */
async function fetchOriginalFile(s3Client, bucketName, userId, sessionId, filename) {
    try {
        if (!s3Client) {
            throw new Error('R2 client not configured');
        }
        
        // Try different possible R2 key formats
        const possibleKeys = [
            `photographer-${userId}/session-${sessionId}/gallery/${filename}`,
            `photographer-${userId}/session-${sessionId}/raw/${filename}`,
            `photographer-${userId}/session-${sessionId}/${filename}`
        ];
        
        for (const key of possibleKeys) {
            try {
                const getCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key
                });
                
                const response = await s3Client.send(getCommand);
                const chunks = [];
                
                for await (const chunk of response.Body) {
                    chunks.push(chunk);
                }
                
                const buffer = Buffer.concat(chunks);
                console.log(`📥 Retrieved original file: ${key}`);
                
                return {
                    success: true,
                    buffer,
                    key,
                    contentType: response.ContentType
                };
                
            } catch (keyError) {
                if (keyError.name === 'NoSuchKey' || keyError.$metadata?.httpStatusCode === 404) {
                    continue; // Try next key
                }
                throw keyError; // Re-throw other errors
            }
        }
        
        throw new Error('File not found in any expected location');
        
    } catch (error) {
        console.error('Failed to fetch original file:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get pricing information for session
 */
async function getPricingInfo(pool, sessionId, mode) {
    try {
        const query = `
            SELECT 
                pricing_model,
                price_per_download,
                free_downloads_remaining,
                watermark_enabled
            FROM photography_sessions
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [sessionId]);
        
        if (result.rows.length === 0) {
            return {
                mode: 'free',
                price: 0,
                freeRemaining: null,
                watermarked: false
            };
        }
        
        const session = result.rows[0];
        return {
            mode: session.pricing_model || mode,
            price: parseFloat(session.price_per_download || '0'),
            freeRemaining: session.free_downloads_remaining,
            watermarked: session.watermark_enabled || false
        };
        
    } catch (error) {
        console.error('Failed to get pricing info:', error);
        return {
            mode: 'free',
            price: 0,
            freeRemaining: null,
            watermarked: false
        };
    }
}

module.exports = createPreviewApiRoutes;
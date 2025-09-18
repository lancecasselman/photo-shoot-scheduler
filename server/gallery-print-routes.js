const express = require('express');
const router = express.Router();
const { eq } = require('drizzle-orm');
const { Pool } = require('pg');

// Use existing database pool (same as main server)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Gallery access middleware for client print ordering (no user account needed)
const requireGalleryAccess = async (req, res, next) => {
    try {
        // Check for gallery access token in header, query, or body
        const accessToken = req.headers['x-gallery-token'] || 
                          req.query.gallery_token || 
                          req.body.gallery_token;
        
        if (!accessToken) {
            return res.status(401).json({ 
                error: 'Gallery access required',
                message: 'Please provide a valid gallery access token to place orders'
            });
        }
        
        // Validate gallery access token and get session info using direct SQL
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM photography_sessions WHERE gallery_access_token = $1 LIMIT 1',
                [accessToken]
            );
            
            if (result.rows.length === 0) {
                client.release();
                return res.status(401).json({ 
                    error: 'Invalid gallery access',
                    message: 'Gallery access token is invalid or expired'
                });
            }
            
            const session = result.rows[0];
            
            // Release client back to pool
            client.release();
            
            // Check if gallery access has expired
            if (session.gallery_expires_at && new Date() > new Date(session.gallery_expires_at)) {
                return res.status(401).json({ 
                    error: 'Gallery access expired',
                    message: 'This gallery link has expired. Please contact the photographer for a new link.'
                });
            }
            
            // Add session and user info to request for downstream use
            req.gallerySession = session;
            req.galleryUserId = session.user_id;
            req.accessToken = accessToken;
            
            console.log('✅ Gallery access validated for session:', session.id);
            next();
            
        } catch (dbError) {
            client.release();
            throw dbError;
        }
        
    } catch (error) {
        console.error('❌ Gallery access validation error:', error);
        return res.status(500).json({ 
            error: 'Gallery access validation failed',
            message: 'Unable to validate gallery access. Please try again.'
        });
    }
};

// Test endpoint for client print ordering with gallery access
router.post('/test-order', requireGalleryAccess, async (req, res) => {
    try {
        console.log('🧪 GALLERY PRINT: Testing client print order with gallery access...');
        console.log('📋 Gallery session info:', {
            sessionId: req.gallerySession.id,
            userId: req.galleryUserId,
            clientName: req.gallerySession.clientName,
            tokenValid: !!req.accessToken
        });
        
        // Test successful response
        res.json({
            success: true,
            message: 'Gallery print order test successful!',
            data: {
                sessionId: req.gallerySession.id,
                clientName: req.gallerySession.clientName,
                galleryAccessValidated: true,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Gallery print order test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Gallery print order test failed',
            message: error.message
        });
    }
});

// Get WHCC products for gallery clients
router.get('/products', async (req, res) => {
    try {
        console.log('🛍️ GALLERY PRINT: Fetching WHCC products for clients...');
        
        // Import WHCC service
        const WHCCService = require('./whcc-rebuilt');
        const printService = new WHCCService();
        
        // Get products from WHCC
        const products = await printService.getProducts();
        
        if (!products || products.length === 0) {
            return res.status(404).json({
                error: 'No products available',
                message: 'No print products are currently available. Please try again later.'
            });
        }
        
        console.log(`✅ GALLERY PRINT: Successfully loaded ${products.length} products`);
        
        return res.json({
            products: products,
            success: true,
            count: products.length
        });
        
    } catch (error) {
        console.error('❌ GALLERY PRINT: Failed to fetch WHCC products:', error);
        return res.status(500).json({
            error: 'Failed to load print products',
            message: 'Unable to load available print products. Please try again later.'
        });
    }
});

module.exports = router;
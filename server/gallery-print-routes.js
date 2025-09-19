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

// WHCC print service removed - products endpoint disabled
router.get('/products', (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'Print product functionality is no longer available'
    });
});

// Live pricing validation endpoint - no auth required for public pricing
router.post('/validate-price', async (req, res) => {
  const { productUID, configuration } = req.body;
  
  try {
    console.log('💰 Live pricing validation request:', { productUID, configuration });
    
    if (!productUID) {
      return res.status(400).json({
        success: false,
        error: 'Product UID is required'
      });
    }
    
    // WHCC service removed - return 410 for print pricing
    return res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'Print pricing validation is no longer available'
    });
    const product = products.find(p => p.productUID === productUID || p.id === productUID);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Calculate price based on configuration
    let basePrice = 0;
    let priceBreakdown = [];
    
    // Size pricing (required)
    if (configuration.size && product.sizes) {
      const sizeOption = product.sizes.find(s => 
        s.uid === configuration.size.uid || 
        s.label === configuration.size.label
      );
      
      if (sizeOption) {
        basePrice += sizeOption.price || 0;
        priceBreakdown.push({
          item: `${sizeOption.width}" x ${sizeOption.height}"`,
          price: sizeOption.price || 0
        });
      }
    }
    
    // Paper type pricing (optional)
    if (configuration.paperType) {
      const paperUpcharge = {
        'lustre': 0,
        'matte': 0,
        'glossy': 2.00,
        'metallic': 5.00
      }[configuration.paperType] || 0;
      
      basePrice += paperUpcharge;
      if (paperUpcharge > 0) {
        priceBreakdown.push({
          item: `${configuration.paperType} paper`,
          price: paperUpcharge
        });
      }
    }
    
    // Finish pricing (optional)
    if (configuration.finish) {
      const finishUpcharge = {
        'standard': 0,
        'premium': 10.00
      }[configuration.finish] || 0;
      
      basePrice += finishUpcharge;
      if (finishUpcharge > 0) {
        priceBreakdown.push({
          item: `${configuration.finish} finish`,
          price: finishUpcharge
        });
      }
    }
    
    res.json({
      success: true,
      price: Math.round(basePrice * 100) / 100,
      configuration: configuration,
      priceBreakdown: priceBreakdown,
      validationErrors: [],
      isValid: true
    });
    
  } catch (error) {
    console.error('❌ Price validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate pricing'
    });
  }
});

// Product configuration details endpoint - no auth required for public access
router.get('/product/:productUID/config', async (req, res) => {
  const { productUID } = req.params;
  
  try {
    console.log('🔧 Product configuration request for:', productUID);
    
    // WHCC service removed - return 410 for product configuration  
    return res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'Product configuration is no longer available'
    });
    const product = products.find(p => p.productUID === productUID || p.id === productUID);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Extract available attributes from WHCC data
    const attributeConfiguration = {
      required: ['size'], // Size is always required
      optional: [],
      attributes: {
        size: {
          type: 'select',
          label: 'Size',
          required: true,
          options: product.sizes?.map(size => ({
            id: size.uid || `${size.width}x${size.height}`,
            label: `${size.width}" x ${size.height}"`,
            basePrice: size.price || 0,
            width: size.width,
            height: size.height,
            uid: size.uid,
            productNodeUID: size.productNodeUID
          })) || []
        }
      },
      dependencies: {
        // Dependencies will be added based on product type
      }
    };
    
    // Add paper type if this product supports it (photo prints, fine art, etc.)
    const category = product.category?.toLowerCase() || '';
    if (['photo_prints', 'photographic', 'fineart', 'partner_photo_fulfillment'].includes(category)) {
      attributeConfiguration.optional.push('paperType');
      attributeConfiguration.attributes.paperType = {
        type: 'select',
        label: 'Paper Type',
        required: false,
        options: [
          { id: 'lustre', label: 'Lustre', upcharge: 0, description: 'Smooth finish with subtle texture' },
          { id: 'matte', label: 'Matte', upcharge: 0, description: 'Non-reflective smooth finish' },
          { id: 'glossy', label: 'Glossy', upcharge: 2.00, description: 'High-gloss reflective finish' },
          { id: 'metallic', label: 'Metallic', upcharge: 5.00, description: 'Premium metallic finish' }
        ]
      };
    }
    
    // Add finish options for premium products (canvas, metal, acrylic)
    if (['canvas', 'canvas_prints', 'metal', 'metal_prints', 'acrylic', 'acrylic_prints'].includes(category)) {
      attributeConfiguration.optional.push('finish');
      attributeConfiguration.attributes.finish = {
        type: 'select',
        label: 'Finish',
        required: false,
        options: [
          { id: 'standard', label: 'Standard', upcharge: 0, description: 'Standard quality finish' },
          { id: 'premium', label: 'Premium', upcharge: 10.00, description: 'Enhanced quality finish' }
        ]
      };
    }
    
    // Add dependencies for complex products
    if (category === 'canvas_prints' || category === 'canvas') {
      // Canvas products might have size-dependent finish options
      attributeConfiguration.dependencies.finish = {
        dependsOn: 'size',
        rules: [
          {
            condition: { size: { width: { min: 24 } } },
            action: { show: ['premium'] }
          }
        ]
      };
    }
    
    res.json({
      success: true,
      product: product,
      configuration: attributeConfiguration
    });
    
  } catch (error) {
    console.error('❌ Product configuration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product configuration'
    });
  }
});

module.exports = router;
const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const WHCCCoreService = require('./whcc-core-service');
const WHCCProductService = require('./whcc-product-service');

const router = express.Router();

// Rate limiting for order endpoint
const orderRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 orders per 15 minutes per IP
  message: {
    success: false,
    error: 'Too many order requests',
    details: 'Please wait before submitting another order'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * WHCC API Routes - Editor Integration
 * Provides endpoints for editor-driven WHCC ordering
 */

// Initialize services
let whccCore = null;
let whccProducts = null;

function initializeServices() {
  if (!whccCore) {
    whccCore = new WHCCCoreService();
  }
  if (!whccProducts) {
    whccProducts = new WHCCProductService();
  }
}

// Middleware to ensure services are initialized
router.use((req, res, next) => {
  initializeServices();
  next();
});

// Authentication middleware (will be passed from server.js)
let isAuthenticated = null;

// Set authentication middleware
router.setAuth = (authMiddleware) => {
  isAuthenticated = authMiddleware;
};

/**
 * GET /api/whcc/products
 * Get curated WHCC product catalog for editor
 * Public endpoint - no authentication required for browsing
 */
router.get('/products', async (req, res) => {
  try {
    console.log('📦 WHCC API: Getting products for editor...');
    
    const products = await whccProducts.getProducts();
    
    console.log(`✅ WHCC API: Returning ${products.length} products to editor`);
    
    res.json({
      success: true,
      products,
      count: products.length,
      categories: [...new Set(products.map(p => p.category))].sort()
    });
    
  } catch (error) {
    console.error('❌ WHCC API: Products error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load WHCC products',
      details: error.message
    });
  }
});

/**
 * POST /api/whcc/orders
 * Create and submit WHCC order from editor
 * Requires authentication and rate limiting
 */
router.post('/orders', orderRateLimit, (req, res, next) => {
  if (isAuthenticated) {
    return isAuthenticated(req, res, next);
  } else {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
}, async (req, res) => {
  try {
    console.log('🛒 WHCC API: Processing editor order...');
    
    // Validate request body
    const orderData = req.body;
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order data',
        details: 'Order must include items'
      });
    }
    
    // Validate required fields
    if (!orderData.customer || !orderData.customer.email) {
      return res.status(400).json({
        success: false,
        error: 'Customer information required',
        details: 'Customer email is required for order processing'
      });
    }
    
    if (!orderData.shipping || !orderData.shipping.address1) {
      return res.status(400).json({
        success: false,
        error: 'Shipping address required',
        details: 'Valid shipping address is required'
      });
    }
    
    // Add order metadata
    const editorOrderData = {
      ...orderData,
      orderId: orderData.orderId || `editor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      source: 'editor'
    };
    
    console.log(`📋 WHCC API: Processing order ${editorOrderData.orderId} with ${editorOrderData.items.length} items`);
    
    // Process order through WHCC
    const result = await whccCore.processEditorOrder(editorOrderData);
    
    if (result.success) {
      console.log(`✅ WHCC API: Order ${editorOrderData.orderId} processed successfully`);
      
      // TODO: Save order to database for tracking
      // await saveOrderToDatabase(editorOrderData, result);
      
      res.json({
        success: true,
        orderId: editorOrderData.orderId,
        confirmationId: result.confirmationId,
        whccOrderId: result.whccOrderId,
        status: result.status,
        trackingNumber: result.trackingNumber,
        reference: result.orderReference,
        message: 'Order submitted to WHCC successfully'
      });
    } else {
      console.error(`❌ WHCC API: Order ${editorOrderData.orderId} failed:`, result.error);
      
      res.status(422).json({
        success: false,
        error: 'WHCC order processing failed',
        details: result.details || result.error,
        orderId: editorOrderData.orderId
      });
    }
    
  } catch (error) {
    console.error('❌ WHCC API: Order processing error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal order processing error',
      details: error.message
    });
  }
});

/**
 * GET /api/whcc/orders/:id
 * Get WHCC order status
 * Requires authentication
 */
router.get('/orders/:id', (req, res, next) => {
  if (isAuthenticated) {
    return isAuthenticated(req, res, next);
  } else {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
}, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 WHCC API: Getting status for order ${id}...`);
    
    // TODO: Get order from database first to get ConfirmationID
    // const dbOrder = await getOrderFromDatabase(id);
    // if (!dbOrder) {
    //   return res.status(404).json({ success: false, error: 'Order not found' });
    // }
    
    // For now, assume id is the ConfirmationID
    // In production, we'll look up the ConfirmationID from our database
    const confirmationId = id;
    
    const token = await whccCore.getAccessToken();
    const orderStatus = await whccCore.getOrder(token, confirmationId);
    
    console.log(`✅ WHCC API: Retrieved status for order ${id}`);
    
    res.json({
      success: true,
      orderId: id,
      confirmationId,
      status: orderStatus.Status || 'Unknown',
      trackingNumber: orderStatus.TrackingNumber || null,
      orderDetails: orderStatus,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ WHCC API: Order status error for ${req.params.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get order status',
      details: error.message
    });
  }
});

// NOTE: Webhook route is handled directly in server.js BEFORE body parsing middleware

/**
 * POST /api/whcc/signed-urls
 * Generate R2 signed URLs for WHCC-accessible image assets
 * Converts gallery URLs to R2 signed URLs that WHCC can access
 * Requires authentication and rate limiting for security
 */
router.post('/signed-urls', orderRateLimit, (req, res, next) => {
  if (isAuthenticated) {
    return isAuthenticated(req, res, next);
  } else {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
}, async (req, res) => {
  try {
    console.log('🔗 WHCC API: Generating signed URLs for image assets...');
    
    const { imageUrls } = req.body;
    
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: 'imageUrls array is required'
      });
    }
    
    const signedUrls = [];
    
    for (const imageUrl of imageUrls) {
      try {
        // Extract proper R2 key from gallery URL pattern
        let r2Key = null;
        
        // Parse different gallery URL patterns to preserve folder structure
        if (imageUrl.includes('/r2/file/')) {
          // Pattern: /r2/file/photographer-gallery/subfolder/image.jpg
          const r2FileIndex = imageUrl.indexOf('/r2/file/');
          r2Key = imageUrl.substring(r2FileIndex + '/r2/file/'.length);
        } else if (imageUrl.includes('/file/')) {
          // Pattern: /file/photographer-gallery/subfolder/image.jpg  
          const fileIndex = imageUrl.indexOf('/file/');
          r2Key = imageUrl.substring(fileIndex + '/file/'.length);
        } else if (imageUrl.includes('/')) {
          // Fallback: assume it's already an R2 key with folders
          r2Key = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
        } else {
          // Direct filename - assume root level
          r2Key = imageUrl;
        }
        
        // Remove query parameters if present
        if (r2Key && r2Key.includes('?')) {
          r2Key = r2Key.split('?')[0];
        }
        
        // Validate R2 key
        if (!r2Key || r2Key.trim() === '') {
          throw new Error('Could not extract valid R2 key from URL');
        }
        
        // Reject unsupported URL schemes
        if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
          throw new Error('Blob and data URLs are not supported');
        }
        
        // Generate 24-hour signed URL for WHCC access
        const signedUrl = await whccCore.createSignedImageURL(r2Key, 24 * 60 * 60);
        
        signedUrls.push({
          originalUrl: imageUrl,
          signedUrl: signedUrl,
          r2Key: r2Key,
          expiresIn: 24 * 60 * 60
        });
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate signed URL for ${imageUrl}:`, error.message);
        signedUrls.push({
          originalUrl: imageUrl,
          signedUrl: null,
          error: error.message
        });
      }
    }
    
    console.log(`✅ WHCC API: Generated ${signedUrls.filter(u => u.signedUrl).length}/${imageUrls.length} signed URLs`);
    
    res.json({
      success: true,
      signedUrls,
      count: signedUrls.length,
      validCount: signedUrls.filter(u => u.signedUrl).length
    });
    
  } catch (error) {
    console.error('❌ WHCC API: Signed URL generation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate signed URLs',
      details: error.message
    });
  }
});

/**
 * GET /api/whcc/status
 * Health check for WHCC integration
 */
router.get('/status', async (req, res) => {
  try {
    console.log('🔍 WHCC API: Checking integration status...');
    
    // Test WHCC connectivity
    const token = await whccCore.getAccessToken();
    const hasToken = !!token;
    
    // Test product service
    const products = await whccProducts.getProducts();
    const productCount = products.length;
    
    console.log('✅ WHCC API: Status check complete');
    
    res.json({
      success: true,
      status: 'operational',
      whcc: {
        connected: hasToken,
        environment: whccCore.isSandbox ? 'sandbox' : 'production',
        baseUrl: whccCore.baseUrl
      },
      products: {
        available: productCount > 0,
        count: productCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ WHCC API: Status check failed:', error.message);
    
    res.status(503).json({
      success: false,
      status: 'degraded',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('❌ WHCC API Error:', error);
  res.status(500).json({
    success: false,
    error: 'WHCC API error',
    details: error.message
  });
});

module.exports = router;
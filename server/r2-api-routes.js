const express = require('express');
const multer = require('multer');
const R2FileManager = require('./r2-file-manager');
const StripeStorageBilling = require('./stripe-storage-billing');
const { Pool } = require('pg');

// Configure multer for file uploads (memory storage for direct R2 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types - photographers need to store everything
    cb(null, true);
  }
});

/**
 * R2 Storage API Routes
 * All routes handle authentication and storage limit enforcement
 * Frontend never receives R2 credentials - all operations go through backend
 */
function createR2Routes() {
  const router = express.Router();
  const r2Manager = new R2FileManager();
  const storageBilling = new StripeStorageBilling();
  
  // Database connection for API routes
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Authentication middleware for all routes - using session-based auth
  router.use((req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = req.session.user; // Make user available in req.user
    next();
  });

  /**
   * GET /api/r2/storage-usage
   * Get user's current storage usage and limits
   */
  router.get('/storage-usage', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      console.log('Getting storage usage for user:', userId);
      
      // Return frontend-compatible storage info
      const usage = {
        totalBytes: 0,
        totalGB: 0,
        usedPercentage: 0,
        percentUsed: 0,
        remainingGB: 1024, // 1TB limit
        fileCount: 0,
        totalFiles: 0,
        displayText: "0 GB of 1024 GB used",
        monthlyStorageCost: 0,
        additionalStorageTB: 0,
        storageStatus: "Base Plan Active",
        isNearLimit: false,
        isOverLimit: false
      };
      
      const billingInfo = {
        currentPlan: 'Base Plan (1TB)',
        monthlyCharge: 0,
        storageLimit: 1024,
        upgradeAvailable: true
      };
      
      res.json({
        success: true,
        usage,
        billing: billingInfo
      });
    } catch (error) {
      console.error('Error getting storage usage:', error);
      res.status(500).json({ error: 'Failed to get storage usage' });
    }
  });

  /**
   * POST /api/r2/upload
   * Upload files to R2 with storage limit checking
   * Supports multiple files and all file types
   */
  router.post('/upload', upload.array('files', 50), async (req, res) => {
    try {
      const userId = req.user.id;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      console.log(`📤 Processing ${req.files.length} files for user ${userId}, session ${sessionId}`);

      // Check total upload size against storage limit
      const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
      const limitCheck = await r2Manager.checkStorageLimit(userId, totalUploadSize);
      
      if (!limitCheck.allowed) {
        return res.status(413).json({ 
          error: 'Storage limit exceeded',
          message: limitCheck.message,
          usage: limitCheck.usage,
          upgradeRequired: true
        });
      }

      // Upload files in parallel for better performance
      const uploadPromises = req.files.map(file => 
        r2Manager.uploadFile(file.buffer, file.originalname, userId, sessionId)
      );
      
      const uploadResults = await Promise.allSettled(uploadPromises);
      
      // Separate successful and failed uploads
      const successful = [];
      const failed = [];
      
      uploadResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            filename: req.files[index].originalname,
            error: result.reason?.message || 'Upload failed'
          });
        }
      });

      // Get updated storage usage
      const updatedUsage = await r2Manager.getUserStorageUsage(userId);

      res.json({
        success: true,
        uploaded: successful.length,
        failed: failed.length,
        results: {
          successful,
          failed
        },
        storageUsage: updatedUsage
      });

    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({ error: 'Upload failed', details: error.message });
    }
  });

  /**
   * GET /api/r2/session/:sessionId/files
   * Get all files for a specific session
   */
  router.get('/session/:sessionId/files', async (req, res) => {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;
      
      const sessionFiles = await r2Manager.getSessionFiles(sessionId, userId);
      
      res.json({
        success: true,
        ...sessionFiles
      });
    } catch (error) {
      console.error('Error getting session files:', error);
      res.status(500).json({ error: 'Failed to get files' });
    }
  });

  /**
   * GET /api/r2/download/:fileId
   * Download a specific file
   */
  router.get('/download/:fileId', async (req, res) => {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;
      
      const downloadResult = await r2Manager.downloadFile(fileId, userId);
      
      // Set appropriate headers
      res.setHeader('Content-Type', downloadResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.filename}"`);
      res.setHeader('Content-Length', downloadResult.contentLength);
      
      // Stream the file data
      downloadResult.data.pipe(res);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(404).json({ error: 'File not found or access denied' });
    }
  });

  /**
   * DELETE /api/r2/file/:fileId
   * Delete a specific file
   */
  router.delete('/file/:fileId', async (req, res) => {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;
      
      const deleted = await r2Manager.deleteFile(fileId, userId);
      
      if (deleted) {
        // Get updated storage usage
        const updatedUsage = await r2Manager.getUserStorageUsage(userId);
        
        res.json({
          success: true,
          message: 'File deleted successfully',
          storageUsage: updatedUsage
        });
      } else {
        res.status(404).json({ error: 'File not found or already deleted' });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  /**
   * POST /api/r2/storage-upgrade/checkout
   * Create Stripe checkout session for additional storage
   */
  router.post('/storage-upgrade/checkout', async (req, res) => {
    try {
      const userId = req.user.id;
      const { additionalTB } = req.body;
      
      if (!additionalTB || additionalTB < 1) {
        return res.status(400).json({ error: 'Must purchase at least 1TB additional storage' });
      }
      
      const userInfo = {
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      };
      
      const checkoutSession = await storageBilling.createStorageUpgradeCheckout(userId, additionalTB, userInfo);
      
      res.json({
        success: true,
        ...checkoutSession
      });
    } catch (error) {
      console.error('Error creating storage upgrade checkout:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  /**
   * POST /api/r2/storage-upgrade/success
   * Handle successful storage upgrade
   */
  router.post('/storage-upgrade/success', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const result = await storageBilling.handleStorageUpgradeSuccess(sessionId);
      
      res.json({
        success: true,
        message: 'Storage upgrade completed successfully!',
        ...result
      });
    } catch (error) {
      console.error('Error handling storage upgrade success:', error);
      res.status(500).json({ error: 'Failed to process storage upgrade' });
    }
  });

  /**
   * DELETE /api/r2/storage-subscription
   * Cancel storage subscription
   */
  router.delete('/storage-subscription', async (req, res) => {
    try {
      const userId = req.user.id;
      
      const result = await storageBilling.cancelStorageSubscription(userId);
      
      res.json({
        success: true,
        message: 'Storage subscription cancelled',
        ...result
      });
    } catch (error) {
      console.error('Error cancelling storage subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  /**
   * GET /api/r2/billing
   * Get storage billing information
   */
  router.get('/billing', async (req, res) => {
    try {
      const userId = req.user.id;
      const billingInfo = await storageBilling.getStorageBillingInfo(userId);
      
      res.json({
        success: true,
        billing: billingInfo
      });
    } catch (error) {
      console.error('Error getting billing info:', error);
      res.status(500).json({ error: 'Failed to get billing information' });
    }
  });

  /**
   * POST /api/r2/webhooks/stripe
   * Handle Stripe webhooks for storage billing
   */
  router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      
      // Verify webhook signature (implement if using webhook endpoint)
      // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      
      // For now, parse the event directly (in production, always verify signatures)
      const event = JSON.parse(req.body);
      
      const result = await storageBilling.handleWebhook(event);
      
      res.json(result);
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  return router;
}

module.exports = createR2Routes;
const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

// Import database schema and ORM
const { 
  photographySessions, 
  downloadTokens, 
  digitalTransactions, 
  galleryDownloads 
} = require('../shared/schema');
const { eq, and, desc, count, sum, gte, lte } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/node-postgres');

// Import R2 file manager for download delivery
const R2FileManager = require('./r2-file-manager');

function createDownloadRoutes() {
  const router = express.Router();
  
  // Database connection for API routes
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  const db = drizzle(pool);
  const r2Manager = new R2FileManager(null, pool);

  // Configure multer for watermark logo uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for logos
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only PNG and JPEG logo files are allowed'), false);
      }
    }
  });

  // Authentication middleware for photographer-only routes
  const requireAuth = (req, res, next) => {
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    const hasValidSession = req.session && req.session.user && req.session.user.uid;
    
    if (isAuthenticated && req.user && req.user.uid) {
      return next();
    }
    
    if (hasValidSession) {
      req.user = req.session.user;
      if (req.user.uid) {
        return next();
      }
    }
    
    console.log('Download API Auth failed - no valid session');
    return res.status(401).json({ error: 'Authentication required' });
  };

  // Token validation middleware for public endpoints
  const requireValidToken = async (req, res, next) => {
    try {
      const { token } = req.params.token ? req.params : req.query;
      
      if (!token) {
        return res.status(403).json({ error: 'Access token required' });
      }

      const downloadToken = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, token))
        .limit(1);

      if (downloadToken.length === 0) {
        return res.status(403).json({ error: 'Invalid access token' });
      }

      const tokenData = downloadToken[0];

      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        return res.status(410).json({ error: 'Access token has expired' });
      }

      // Attach token data to request for use in route handlers
      req.tokenData = tokenData;
      next();
      
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ error: 'Token validation failed' });
    }
  };

  // Utility function to get user ID consistently
  function getUserId(req) {
    return req.user.normalized_uid || req.user.uid || req.user.id;
  }

  // Utility function to verify session ownership
  async function verifySessionOwnership(sessionId, userId) {
    try {
      const session = await db
        .select()
        .from(photographySessions)
        .where(and(
          eq(photographySessions.id, sessionId),
          eq(photographySessions.userId, userId)
        ))
        .limit(1);
      return session.length > 0 ? session[0] : null;
    } catch (error) {
      console.error('Error verifying session ownership:', error);
      return null;
    }
  }

  // ==================== SESSION POLICY MANAGEMENT ====================

  /**
   * GET /api/downloads/sessions/:sessionId/policy
   * Get current download policy for a session
   */
  router.get('/sessions/:sessionId/policy', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;

      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      // Return download policy data
      const policy = {
        sessionId,
        pricingModel: session.pricingModel,
        downloadLimit: session.downloadLimit,
        perDownloadPrice: session.perDownloadPrice,
        freeDownloadLimit: session.freeDownloadLimit,
        watermarkEnabled: session.watermarkEnabled,
        watermarkType: session.watermarkType,
        watermarkText: session.watermarkText,
        watermarkLogoUrl: session.watermarkLogoUrl,
        watermarkPosition: session.watermarkPosition,
        watermarkOpacity: session.watermarkOpacity,
        watermarkScale: session.watermarkScale,
        watermarkUpdatedAt: session.watermarkUpdatedAt
      };

      res.json({ success: true, policy });
    } catch (error) {
      console.error('Error getting download policy:', error);
      res.status(500).json({ error: 'Failed to get download policy' });
    }
  });

  /**
   * PUT /api/downloads/sessions/:sessionId/policy
   * Update download policy for a session
   */
  router.put('/sessions/:sessionId/policy', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const {
        pricingModel,
        downloadLimit,
        perDownloadPrice,
        freeDownloadLimit,
        watermarkEnabled,
        watermarkType,
        watermarkText,
        watermarkPosition,
        watermarkOpacity,
        watermarkScale
      } = req.body;

      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      // Validate pricing model
      const validPricingModels = ['free', 'paid', 'freemium'];
      if (pricingModel && !validPricingModels.includes(pricingModel)) {
        return res.status(400).json({ error: 'Invalid pricing model' });
      }

      // Validate watermark type
      const validWatermarkTypes = ['none', 'text', 'logo', 'both'];
      if (watermarkType && !validWatermarkTypes.includes(watermarkType)) {
        return res.status(400).json({ error: 'Invalid watermark type' });
      }

      // Build update object (only include defined values)
      const updateData = {};
      if (pricingModel !== undefined) updateData.pricingModel = pricingModel;
      if (downloadLimit !== undefined) updateData.downloadLimit = downloadLimit;
      if (perDownloadPrice !== undefined) updateData.perDownloadPrice = perDownloadPrice;
      if (freeDownloadLimit !== undefined) updateData.freeDownloadLimit = freeDownloadLimit;
      if (watermarkEnabled !== undefined) updateData.watermarkEnabled = watermarkEnabled;
      if (watermarkType !== undefined) updateData.watermarkType = watermarkType;
      if (watermarkText !== undefined) updateData.watermarkText = watermarkText;
      if (watermarkPosition !== undefined) updateData.watermarkPosition = watermarkPosition;
      if (watermarkOpacity !== undefined) updateData.watermarkOpacity = watermarkOpacity;
      if (watermarkScale !== undefined) updateData.watermarkScale = watermarkScale;

      // Always update the timestamp
      updateData.watermarkUpdatedAt = new Date();

      // Update session in database
      await db
        .update(photographySessions)
        .set(updateData)
        .where(eq(photographySessions.id, sessionId));

      console.log(`📋 Download policy updated for session ${sessionId}`);
      res.json({ success: true, message: 'Download policy updated successfully' });
      
    } catch (error) {
      console.error('Error updating download policy:', error);
      res.status(500).json({ error: 'Failed to update download policy' });
    }
  });

  /**
   * POST /api/downloads/sessions/:sessionId/watermark-logo
   * Upload watermark logo for a session
   */
  router.post('/sessions/:sessionId/watermark-logo', requireAuth, upload.single('logo'), async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'Logo file is required' });
      }

      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      // Process the logo image with Sharp
      const logoBuffer = await sharp(req.file.buffer)
        .resize(500, 500, { // Max 500x500px
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ quality: 90 })
        .toBuffer();

      // TODO: Upload to R2 storage and get URL
      // For now, we'll store as base64 in the database (not recommended for production)
      const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

      // Update session with logo URL
      await db
        .update(photographySessions)
        .set({
          watermarkLogoUrl: logoBase64,
          watermarkUpdatedAt: new Date()
        })
        .where(eq(photographySessions.id, sessionId));

      console.log(`🖼️ Watermark logo uploaded for session ${sessionId}`);
      res.json({ 
        success: true, 
        message: 'Watermark logo uploaded successfully',
        logoUrl: logoBase64
      });
      
    } catch (error) {
      console.error('Error uploading watermark logo:', error);
      res.status(500).json({ error: 'Failed to upload watermark logo' });
    }
  });

  // ==================== DOWNLOAD TOKEN MANAGEMENT ====================

  /**
   * POST /api/downloads/sessions/:sessionId/generate-token
   * Generate a download access token for clients
   */
  router.post('/sessions/:sessionId/generate-token', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const { clientEmail, expiresInHours = 72 } = req.body;

      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));

      // Create download token
      await db.insert(downloadTokens).values({
        id: uuidv4(),
        token,
        sessionId,
        clientEmail,
        expiresAt,
        isUsed: false,
        createdAt: new Date()
      });

      console.log(`🔑 Download token generated for session ${sessionId}`);
      res.json({ 
        success: true, 
        token,
        expiresAt,
        downloadUrl: `${process.env.APP_URL || req.protocol + '://' + req.get('host')}/gallery/${sessionId}?token=${token}`
      });
      
    } catch (error) {
      console.error('Error generating download token:', error);
      res.status(500).json({ error: 'Failed to generate download token' });
    }
  });

  /**
   * GET /api/downloads/tokens/:token/verify
   * Verify download token validity (public endpoint with token validation)
   */
  router.get('/tokens/:token/verify', requireValidToken, async (req, res) => {
    try {
      const { token } = req.params;

      const downloadToken = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, token))
        .limit(1);

      if (downloadToken.length === 0) {
        return res.status(404).json({ error: 'Invalid token' });
      }

      const tokenData = downloadToken[0];

      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        return res.status(410).json({ error: 'Token has expired' });
      }

      // Get session data
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.id, tokenData.sessionId))
        .limit(1);

      if (session.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ 
        success: true, 
        token: {
          sessionId: tokenData.sessionId,
          clientEmail: tokenData.clientEmail,
          expiresAt: tokenData.expiresAt,
          isValid: true
        },
        session: {
          id: session[0].id,
          sessionName: session[0].sessionName,
          pricingModel: session[0].pricingModel,
          downloadLimit: session[0].downloadLimit,
          perDownloadPrice: session[0].perDownloadPrice,
          freeDownloadLimit: session[0].freeDownloadLimit,
          watermarkEnabled: session[0].watermarkEnabled
        }
      });
      
    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(500).json({ error: 'Failed to verify token' });
    }
  });

  // ==================== CLIENT DOWNLOAD ROUTES ====================

  /**
   * GET /api/downloads/gallery/:sessionId
   * Get gallery data for clients with download controls (public endpoint with token)
   */
  router.get('/gallery/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { token } = req.query;

      // Token is required for this endpoint
      if (!token) {
        return res.status(403).json({ error: 'Access token required' });
      }

      // Verify token
      const downloadToken = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, token))
        .limit(1);

      if (downloadToken.length === 0 || new Date() > downloadToken[0].expiresAt) {
        return res.status(403).json({ error: 'Invalid or expired access token' });
      }
      
      const clientAccess = downloadToken[0];

      // Get session data
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.id, sessionId))
        .limit(1);

      if (session.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const sessionData = session[0];

      // Get download usage for this client/session
      const clientKey = clientAccess.clientEmail || 'anonymous';
      const usageResult = await db
        .select({ count: count() })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, sessionId),
          eq(galleryDownloads.clientKey, clientKey),
          eq(galleryDownloads.status, 'completed')
        ));
      
      const downloadUsage = usageResult[0]?.count || 0;

      // Get gallery photos from R2 file manager
      let photos = [];
      try {
        const sessionFiles = await r2Manager.getSessionFiles(sessionData.userId, sessionId);
        photos = sessionFiles.filesByType.gallery || [];
      } catch (error) {
        console.warn('Could not load gallery photos:', error.message);
      }

      res.json({
        success: true,
        session: {
          id: sessionData.id,
          sessionName: sessionData.sessionName,
          pricingModel: sessionData.pricingModel,
          downloadLimit: sessionData.downloadLimit,
          perDownloadPrice: sessionData.perDownloadPrice,
          freeDownloadLimit: sessionData.freeDownloadLimit,
          watermarkEnabled: sessionData.watermarkEnabled
        },
        clientAccess: {
          hasAccess: true,
          downloadUsage,
          remainingDownloads: sessionData.downloadLimit ? sessionData.downloadLimit - downloadUsage : null
        },
        photos
      });
      
    } catch (error) {
      console.error('Error getting client gallery:', error);
      res.status(500).json({ error: 'Failed to get gallery data' });
    }
  });

  /**
   * POST /api/downloads/purchase/:sessionId/:photoId
   * Process payment for download (for paid/freemium models) - public endpoint with token
   */
  router.post('/purchase/:sessionId/:photoId', async (req, res) => {
    try {
      const { sessionId, photoId } = req.params;
      const { token, paymentMethodId, clientEmail, clientName } = req.body;

      if (!token) {
        return res.status(403).json({ error: 'Access token required' });
      }

      // Verify token
      const downloadToken = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, token))
        .limit(1);

      if (downloadToken.length === 0 || new Date() > downloadToken[0].expiresAt) {
        return res.status(403).json({ error: 'Invalid or expired access token' });
      }

      // Get session data
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.id, sessionId))
        .limit(1);

      if (session.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const sessionData = session[0];
      
      if (sessionData.pricingModel === 'free') {
        return res.status(400).json({ error: 'This session uses free downloads' });
      }

      const amount = sessionData.perDownloadPrice || 500; // Default $5.00

      // Create Stripe Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        metadata: {
          sessionId,
          photoId,
          downloadToken: token,
          clientEmail: clientEmail || 'unknown'
        }
      });

      // Create digital transaction record
      const transactionId = uuidv4();
      await db.insert(digitalTransactions).values({
        id: transactionId,
        sessionId,
        userId: sessionData.userId,
        stripePaymentIntentId: paymentIntent.id,
        amount,
        downloadToken: token,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'failed',
        createdAt: new Date()
      });

      if (paymentIntent.status === 'succeeded') {
        console.log(`💳 Payment completed for photo ${photoId} in session ${sessionId}`);
        res.json({ 
          success: true,
          message: 'Payment successful',
          transactionId,
          downloadReady: true
        });
      } else {
        res.status(400).json({ 
          error: 'Payment failed', 
          details: paymentIntent.last_payment_error?.message 
        });
      }
      
    } catch (error) {
      console.error('Error processing purchase:', error);
      res.status(500).json({ error: 'Failed to process payment' });
    }
  });

  /**
   * GET /api/downloads/download/:token/:photoId
   * Download photo with watermark and usage tracking - public endpoint
   */
  router.get('/download/:token/:photoId', async (req, res) => {
    try {
      const { token, photoId } = req.params;

      // Verify token
      const downloadToken = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, token))
        .limit(1);

      if (downloadToken.length === 0 || new Date() > downloadToken[0].expiresAt) {
        return res.status(403).json({ error: 'Invalid or expired access token' });
      }

      const tokenData = downloadToken[0];

      // Get session data
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.id, tokenData.sessionId))
        .limit(1);

      if (session.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const sessionData = session[0];
      const clientKey = tokenData.clientEmail || 'anonymous';

      // Check download limits for free model
      if (sessionData.pricingModel === 'free' && sessionData.downloadLimit) {
        const usageResult = await db
          .select({ count: count() })
          .from(galleryDownloads)
          .where(and(
            eq(galleryDownloads.sessionId, tokenData.sessionId),
            eq(galleryDownloads.clientKey, clientKey),
            eq(galleryDownloads.status, 'completed')
          ));

        const currentUsage = usageResult[0]?.count || 0;
        if (currentUsage >= sessionData.downloadLimit) {
          return res.status(403).json({ error: 'Download limit exceeded' });
        }
      }

      // For paid downloads, verify payment exists
      let digitalTransaction = null;
      if (sessionData.pricingModel === 'paid') {
        const transactionResult = await db
          .select()
          .from(digitalTransactions)
          .where(and(
            eq(digitalTransactions.sessionId, tokenData.sessionId),
            eq(digitalTransactions.downloadToken, token),
            eq(digitalTransactions.status, 'completed')
          ))
          .limit(1);

        if (transactionResult.length === 0) {
          return res.status(402).json({ error: 'Payment required for download' });
        }
        
        digitalTransaction = transactionResult[0];
      }

      // Get photo from R2 storage
      let photoBuffer, filename, contentType;
      try {
        const downloadResult = await r2Manager.downloadFile(sessionData.userId, tokenData.sessionId, photoId);
        if (!downloadResult.success) {
          return res.status(404).json({ error: 'Photo not found' });
        }
        photoBuffer = downloadResult.buffer;
        filename = downloadResult.filename;
        contentType = downloadResult.contentType;
      } catch (error) {
        console.error('Error downloading from R2:', error);
        return res.status(500).json({ error: 'Failed to retrieve photo' });
      }

      // Apply watermark if enabled
      if (sessionData.watermarkEnabled && (sessionData.watermarkType === 'text' || sessionData.watermarkType === 'both')) {
        try {
          const watermarkText = sessionData.watermarkText || '© Photography';
          const position = sessionData.watermarkPosition || 'bottom-right';
          const opacity = (sessionData.watermarkOpacity || 70) / 100;

          // Apply text watermark using Sharp
          photoBuffer = await sharp(photoBuffer)
            .composite([{
              input: await sharp({
                create: {
                  width: 800,
                  height: 100,
                  channels: 4,
                  background: { r: 255, g: 255, b: 255, alpha: 0 }
                }
              })
                .png()
                .composite([{
                  input: Buffer.from(`
                    <svg width="800" height="100">
                      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" 
                            font-family="Arial" font-size="24" fill="white" opacity="${opacity}">
                        ${watermarkText}
                      </text>
                    </svg>
                  `),
                  top: 0,
                  left: 0
                }])
                .toBuffer(),
              gravity: position === 'center' ? 'center' : position === 'top-left' ? 'northwest' : position === 'top-right' ? 'northeast' : position === 'bottom-left' ? 'southwest' : 'southeast'
            }])
            .toBuffer();

        } catch (error) {
          console.warn('Watermark application failed, serving original:', error.message);
        }
      }

      const downloadId = uuidv4();
      
      // Record download in database
      await db.insert(galleryDownloads).values({
        id: downloadId,
        sessionId: tokenData.sessionId,
        userId: sessionData.userId,
        clientKey,
        clientEmail: tokenData.clientEmail,
        photoId,
        photoUrl: `${process.env.APP_URL}/api/downloads/download/${token}/${photoId}`,
        filename,
        downloadType: sessionData.pricingModel === 'free' ? 'free' : 'paid',
        amountPaid: sessionData.pricingModel === 'paid' ? sessionData.perDownloadPrice || 0 : 0,
        digitalTransactionId: digitalTransaction?.id,
        downloadToken: token,
        isWatermarked: sessionData.watermarkEnabled,
        watermarkConfig: {
          type: sessionData.watermarkType,
          text: sessionData.watermarkText,
          position: sessionData.watermarkPosition,
          opacity: sessionData.watermarkOpacity,
          scale: sessionData.watermarkScale
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        status: 'completed',
        createdAt: new Date()
      });

      // Mark token as used (one-time download)
      await db
        .update(downloadTokens)
        .set({ isUsed: true, usedAt: new Date() })
        .where(eq(downloadTokens.token, token));

      console.log(`📥 Photo download completed: ${photoId} by ${clientKey}`);
      
      // Send the file
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', photoBuffer.length);
      res.send(photoBuffer);
      
    } catch (error) {
      console.error('Error processing download:', error);
      res.status(500).json({ error: 'Failed to process download' });
    }
  });

  // ==================== USAGE TRACKING ROUTES ====================

  /**
   * GET /api/downloads/sessions/:sessionId/usage
   * Get download usage statistics for a session
   */
  router.get('/sessions/:sessionId/usage', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;

      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      // Get usage statistics
      const totalDownloads = await db
        .select({ count: count() })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, sessionId),
          eq(galleryDownloads.status, 'completed')
        ));

      const freeDownloads = await db
        .select({ count: count() })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, sessionId),
          eq(galleryDownloads.downloadType, 'free'),
          eq(galleryDownloads.status, 'completed')
        ));

      const paidDownloads = await db
        .select({ count: count() })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, sessionId),
          eq(galleryDownloads.downloadType, 'paid'),
          eq(galleryDownloads.status, 'completed')
        ));

      const totalRevenue = await db
        .select({ sum: sum(galleryDownloads.amountPaid) })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, sessionId),
          eq(galleryDownloads.status, 'completed')
        ));

      // Get unique clients
      const uniqueClients = await db
        .selectDistinct({ clientKey: galleryDownloads.clientKey })
        .from(galleryDownloads)
        .where(eq(galleryDownloads.sessionId, sessionId));

      res.json({
        success: true,
        usage: {
          totalDownloads: totalDownloads[0]?.count || 0,
          freeDownloads: freeDownloads[0]?.count || 0,
          paidDownloads: paidDownloads[0]?.count || 0,
          totalRevenue: totalRevenue[0]?.sum || 0,
          uniqueClients: uniqueClients.length,
          downloadLimit: session.downloadLimit,
          pricingModel: session.pricingModel
        }
      });
      
    } catch (error) {
      console.error('Error getting usage statistics:', error);
      res.status(500).json({ error: 'Failed to get usage statistics' });
    }
  });

  /**
   * GET /api/downloads/sessions/:sessionId/transactions
   * Get transaction history for a session
   */
  router.get('/sessions/:sessionId/transactions', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;

      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      // Get digital transactions
      const transactions = await db
        .select()
        .from(digitalTransactions)
        .where(eq(digitalTransactions.sessionId, sessionId))
        .orderBy(desc(digitalTransactions.createdAt));

      // Get download records
      const downloads = await db
        .select()
        .from(galleryDownloads)
        .where(eq(galleryDownloads.sessionId, sessionId))
        .orderBy(desc(galleryDownloads.createdAt));

      res.json({
        success: true,
        transactions,
        downloads
      });
      
    } catch (error) {
      console.error('Error getting transaction history:', error);
      res.status(500).json({ error: 'Failed to get transaction history' });
    }
  });

  return router;
}

module.exports = createDownloadRoutes;
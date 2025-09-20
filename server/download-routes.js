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

function createDownloadRoutes(isAuthenticated) {
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

  // Use the same authentication middleware as the main server
  const requireAuth = isAuthenticated;

  // Token validation middleware for public endpoints
  const requireValidToken = async (req, res, next) => {
    try {
      const { token } = req.params.token ? req.params : req.query;
      const sessionId = req.params.sessionId; // For session-bound routes
      
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

      // Check if token has already been used (for one-time tokens)
      if (tokenData.isUsed) {
        return res.status(403).json({ error: 'Access token has already been used' });
      }

      // Enforce session binding if sessionId is provided in route
      if (sessionId && tokenData.sessionId !== sessionId) {
        return res.status(403).json({ error: 'Access token is not valid for this session' });
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
        downloadMax: session.downloadMax,
        pricePerDownload: session.pricePerDownload,
        freeDownloads: session.freeDownloads,
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
  router.put('/sessions/:sessionId/policy', requireAuth, upload.single('logo'), async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const {
        pricingModel,
        downloadMax,
        pricePerDownload,
        freeDownloads,
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

      // Validate watermark type to match schema
      const validWatermarkTypes = ['text', 'logo'];
      if (watermarkType && !validWatermarkTypes.includes(watermarkType)) {
        return res.status(400).json({ error: 'Invalid watermark type. Must be "text" or "logo"' });
      }

      // Build update object (only include defined values)
      const updateData = {};
      if (pricingModel !== undefined) updateData.pricingModel = pricingModel;
      if (downloadMax !== undefined) updateData.downloadMax = downloadMax;
      if (pricePerDownload !== undefined) updateData.pricePerDownload = pricePerDownload;
      if (freeDownloads !== undefined) updateData.freeDownloads = freeDownloads;
      if (watermarkEnabled !== undefined) updateData.watermarkEnabled = watermarkEnabled;
      if (watermarkType !== undefined) updateData.watermarkType = watermarkType;
      if (watermarkText !== undefined) updateData.watermarkText = watermarkText;
      if (watermarkPosition !== undefined) updateData.watermarkPosition = watermarkPosition;
      if (watermarkOpacity !== undefined) updateData.watermarkOpacity = watermarkOpacity;
      if (watermarkScale !== undefined) updateData.watermarkScale = watermarkScale;

      // Handle logo file upload if provided
      if (req.file && watermarkType === 'logo') {
        try {
          // Process the logo image with Sharp
          const logoBuffer = await sharp(req.file.buffer)
            .resize(500, 500, { // Max 500x500px
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ quality: 90 })
            .toBuffer();

          // Upload logo to R2 storage
          const logoFilename = `watermark-logo-${sessionId}-${Date.now()}.png`;
          const r2Key = `photographer-${userId}/session-${sessionId}/watermarks/${logoFilename}`;
          
          const uploadResult = await r2Manager.uploadFile(
            logoBuffer,
            r2Key,
            'image/png',
            logoFilename
          );

          if (uploadResult.success) {
            // Get URL for the uploaded logo
            const logoUrl = await r2Manager.getSignedUrl(r2Key, 31536000); // 1 year expiry for logos
            updateData.watermarkLogoUrl = logoUrl;
            console.log(`🖼️ Watermark logo uploaded to R2 for session ${sessionId}`);
          } else {
            console.error('Failed to upload watermark logo to R2:', uploadResult.error);
          }
        } catch (logoError) {
          console.error('Error processing watermark logo:', logoError);
          // Don't fail the entire update if logo upload fails
        }
      }

      // Always update the timestamp
      updateData.watermarkUpdatedAt = new Date();

      console.log(`🔍 Updating session ${sessionId} with data:`, updateData);

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

      // Upload logo to R2 storage
      const logoFilename = `watermark-logo-${sessionId}-${Date.now()}.png`;
      const r2Key = `photographer-${userId}/session-${sessionId}/watermarks/${logoFilename}`;
      
      const uploadResult = await r2Manager.uploadFile(
        logoBuffer,
        r2Key,
        'image/png',
        logoFilename
      );

      if (!uploadResult.success) {
        console.error('Failed to upload watermark logo to R2:', uploadResult.error);
        return res.status(500).json({ error: 'Failed to save watermark logo' });
      }

      // Get URL for the uploaded logo
      const logoUrl = await r2Manager.getSignedUrl(r2Key, 31536000); // 1 year expiry for logos

      // Update session with logo URL
      await db
        .update(photographySessions)
        .set({
          watermarkLogoUrl: logoUrl,
          watermarkUpdatedAt: new Date()
        })
        .where(eq(photographySessions.id, sessionId));

      console.log(`🖼️ Watermark logo uploaded to R2 for session ${sessionId}`);
      res.json({ 
        success: true, 
        message: 'Watermark logo uploaded successfully',
        logoUrl
      });
      
    } catch (error) {
      console.error('Error uploading watermark logo:', error);
      res.status(500).json({ error: 'Failed to upload watermark logo' });
    }
  });

  // ==================== GALLERY ACCESS TOKEN MIDDLEWARE ====================

  /**
   * Middleware to validate gallery access tokens (for public gallery access)
   * Accepts gallery_access_token for browsing, different from downloadTokens for fulfillment
   */
  const requireGalleryToken = async (req, res, next) => {
    try {
      const { token } = req.params.token ? req.params : req.query;
      const sessionId = req.params.sessionId; // For session-bound routes
      
      if (!token) {
        return res.status(403).json({ error: 'Gallery access token required' });
      }

      // Look for session with matching gallery_access_token
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.galleryAccessToken, token))
        .limit(1);

      if (session.length === 0) {
        return res.status(403).json({ error: 'Invalid gallery access token' });
      }

      const sessionData = session[0];

      // Check if gallery is expired
      if (sessionData.galleryExpiresAt && new Date() > sessionData.galleryExpiresAt) {
        return res.status(410).json({ error: 'Gallery access has expired' });
      }

      // Verify session binding if sessionId is provided in route
      if (sessionId && sessionData.id !== sessionId) {
        return res.status(403).json({ error: 'Gallery access token is not valid for this session' });
      }

      // Attach session data to request for use in route handlers
      req.sessionData = sessionData;
      req.clientAccess = true; // Flag for client-level access
      next();
      
    } catch (error) {
      console.error('Gallery token validation error:', error);
      res.status(500).json({ error: 'Gallery token validation failed' });
    }
  };

  // ==================== TOKEN BRIDGE SYSTEM ====================

  /**
   * POST /api/downloads/sessions/:sessionId/assets/:assetId/request
   * Bridge endpoint: Accepts gallery_access_token, returns downloadToken or checkout URL
   * This is the critical bridge between gallery browsing and download fulfillment
   */
  router.post('/sessions/:sessionId/assets/:assetId/request', async (req, res) => {
    try {
      console.log('🔍 Token bridge request:', req.params, req.body);
      const { sessionId, assetId } = req.params;
      const { token: galleryToken } = req.body;

      // Validate gallery access token
      if (!galleryToken) {
        return res.status(400).json({ error: 'Gallery access token required' });
      }

      // Use raw SQL query like getAllSessions function in server.js
      const sessionQuery = 'SELECT * FROM photography_sessions WHERE id = $1 AND gallery_access_token = $2 LIMIT 1';
      console.log('🔍 Raw SQL query:', { sessionQuery, params: [sessionId, galleryToken] });
      
      let session;
      try {
        const result = await pool.query(sessionQuery, [sessionId, galleryToken]);
        session = result.rows;
        console.log('🔍 SQL query result:', { 
          rowCount: result.rows.length,
          firstRow: result.rows[0] ? {
            id: result.rows[0].id,
            download_enabled: result.rows[0].download_enabled,
            pricing_model: result.rows[0].pricing_model
          } : null
        });
      } catch (sqlError) {
        console.error('❌ SQL query error:', sqlError);
        return res.status(500).json({ error: 'Database query failed' });
      }

      if (session.length === 0) {
        return res.status(403).json({ error: 'Invalid gallery access or session not found' });
      }

      const sessionData = session[0];
      
      // Normalize session data: Raw SQL returns snake_case, handle both naming conventions with robust boolean coercion
      const rawDE = sessionData.download_enabled ?? sessionData.downloadEnabled ?? sessionData.downloads_enabled ?? sessionData.downloadsEnabled;
      const downloadsEnabled = rawDE === true || rawDE === 'true' || rawDE === 1;
      const pricingModel = sessionData.pricing_model ?? sessionData.pricingModel;
      const galleryExpiresAt = sessionData.gallery_expires_at ?? sessionData.galleryExpiresAt;
      
      console.log('🔍 Session data normalized fields:', {
        rawDE,
        downloadsEnabled,
        pricingModel,
        galleryExpiresAt
      });

      // Check if gallery is expired
      if (galleryExpiresAt && new Date() > new Date(galleryExpiresAt)) {
        return res.status(410).json({ error: 'Gallery access has expired' });
      }

      // Check if downloads are enabled
      if (!downloadsEnabled) {
        console.log('❌ Downloads disabled check failed:', downloadsEnabled);
        return res.status(403).json({ error: 'Downloads are not enabled for this gallery' });
      }

      // Find the requested asset in session photos
      const photos = sessionData.photos || [];
      const requestedPhoto = photos.find(photo => 
        photo.filename === assetId || photo.originalName === assetId
      );

      if (!requestedPhoto) {
        return res.status(404).json({ error: 'Asset not found in gallery' });
      }

      // Apply pricing logic based on session policy (using normalized pricingModel)
      // pricingModel already normalized above

      if (pricingModel === 'free') {
        // Free download - generate immediate download token
        const downloadToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

        await db.insert(downloadTokens).values({
          id: uuidv4(),
          token: downloadToken,
          photoUrl: requestedPhoto.url,
          filename: requestedPhoto.filename,
          sessionId,
          expiresAt,
          isUsed: false,
          createdAt: new Date()
        });

        console.log(`🆓 Free download token generated for asset ${assetId}`);
        return res.json({ 
          status: 'granted', 
          downloadToken,
          expiresAt,
          downloadUrl: `/api/downloads/${downloadToken}`
        });

      } else if (pricingModel === 'freemium') {
        // Check if user has free downloads remaining
        const freeDownloads = sessionData.free_downloads || 0;
        
        // Count previous free downloads for this gallery
        const existingDownloads = await db
          .select({ count: count() })
          .from(galleryDownloads)
          .where(and(
            eq(galleryDownloads.sessionId, sessionId),
            eq(galleryDownloads.downloadType, 'free')
          ));

        const usedFreeDownloads = existingDownloads[0]?.count || 0;

        if (usedFreeDownloads < freeDownloads) {
          // Free download available - generate immediate download token
          const downloadToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

          await db.insert(downloadTokens).values({
            id: uuidv4(),
            token: downloadToken,
            photoUrl: requestedPhoto.url,
            filename: requestedPhoto.filename,
            sessionId,
            expiresAt,
            isUsed: false,
            createdAt: new Date()
          });

          console.log(`🆓 Freemium free download token generated for asset ${assetId} (${usedFreeDownloads + 1}/${freeDownloads})`);
          return res.json({ 
            status: 'granted', 
            downloadToken,
            expiresAt,
            downloadUrl: `/api/downloads/${downloadToken}`,
            freeDownloadsRemaining: freeDownloads - usedFreeDownloads - 1
          });
        } else {
          // No free downloads left - require payment
          const pricePerDownload = parseFloat(sessionData.price_per_download || '0');
          return res.json({
            status: 'pay',
            price: pricePerDownload,
            currency: 'usd',
            checkoutUrl: `/api/payments/digital/checkout?sessionId=${sessionId}&assetId=${assetId}&token=${galleryToken}`
          });
        }

      } else if (pricingModel === 'paid') {
        // Paid download - redirect to checkout
        const pricePerDownload = parseFloat(sessionData.price_per_download || '0');
        return res.json({
          status: 'pay',
          price: pricePerDownload,
          currency: 'usd',
          checkoutUrl: `/api/payments/digital/checkout?sessionId=${sessionId}&assetId=${assetId}&token=${galleryToken}`
        });
      }

    } catch (error) {
      console.error('Error processing download request:', error);
      res.status(500).json({ error: 'Failed to process download request' });
    }
  });

  /**
   * GET /api/downloads/:downloadToken
   * Serve actual file downloads with watermark enforcement and policy validation
   * This is the fulfillment endpoint that delivers files using downloadTokens
   */
  router.get('/:downloadToken', async (req, res) => {
    try {
      const { downloadToken } = req.params;

      // Validate download token
      const tokenResult = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, downloadToken))
        .limit(1);

      if (tokenResult.length === 0) {
        return res.status(404).json({ error: 'Invalid download token' });
      }

      const tokenData = tokenResult[0];

      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        return res.status(410).json({ error: 'Download token has expired' });
      }

      // Check if token has already been used (for one-time tokens)
      if (tokenData.isUsed) {
        return res.status(403).json({ error: 'Download token has already been used' });
      }

      // Get session and policy data
      const sessionResult = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.id, tokenData.sessionId))
        .limit(1);

      if (sessionResult.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const sessionData = sessionResult[0];

      // Get the actual file from R2 storage
      const fileUrl = tokenData.photoUrl;
      const filename = tokenData.filename;
      
      // Apply watermark if enabled
      let finalImage;
      if (sessionData.watermarkEnabled) {
        // Get original file from R2
        const originalFile = await r2Manager.downloadFile(fileUrl.replace('/r2/file/', ''));
        
        if (!originalFile.success) {
          return res.status(404).json({ error: 'Original file not found' });
        }

        // Apply watermark based on session settings
        let watermarkConfig = {
          type: sessionData.watermarkType || 'text',
          text: sessionData.watermarkText || '© Photography',
          opacity: sessionData.watermarkOpacity || 60,
          position: sessionData.watermarkPosition || 'bottom-right',
          scale: sessionData.watermarkScale || 20
        };

        if (sessionData.watermarkType === 'logo' && sessionData.watermarkLogoUrl) {
          // Get logo file for watermarking
          const logoFile = await r2Manager.downloadFile(sessionData.watermarkLogoUrl.replace('/r2/file/', ''));
          if (logoFile.success) {
            watermarkConfig.logoBuffer = logoFile.data;
          }
        }

        // Apply watermark using Sharp
        finalImage = await sharp(originalFile.data)
          .composite([{
            input: await sharp({
              create: {
                width: 200,
                height: 50,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
              }
            })
            .png()
            .toBuffer(),
            gravity: watermarkConfig.position === 'bottom-right' ? 'southeast' : 'southwest'
          }])
          .jpeg({ quality: 90 })
          .toBuffer();

        console.log(`🖼️ Watermark applied to download for session ${tokenData.sessionId}`);
      } else {
        // No watermark - serve original file
        const originalFile = await r2Manager.downloadFile(fileUrl.replace('/r2/file/', ''));
        
        if (!originalFile.success) {
          return res.status(404).json({ error: 'File not found' });
        }

        finalImage = originalFile.data;
      }

      // Mark token as used if it's a one-time token
      await db
        .update(downloadTokens)
        .set({ 
          isUsed: true, 
          usedAt: new Date() 
        })
        .where(eq(downloadTokens.token, downloadToken));

      // Record download in analytics
      await db.insert(galleryDownloads).values({
        id: uuidv4(),
        sessionId: tokenData.sessionId,
        userId: sessionData.userId,
        clientKey: 'gallery-access', // Since this is via gallery access token
        photoId: filename,
        photoUrl: fileUrl,
        filename,
        downloadType: 'free', // Paid downloads would be handled via webhook
        downloadToken: downloadToken,
        isWatermarked: sessionData.watermarkEnabled,
        watermarkConfig: sessionData.watermarkEnabled ? {
          type: sessionData.watermarkType,
          position: sessionData.watermarkPosition,
          opacity: sessionData.watermarkOpacity
        } : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });

      // Serve the file
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      console.log(`📥 Download delivered via token for session ${tokenData.sessionId}, asset: ${filename}`);
      res.send(finalImage);

    } catch (error) {
      console.error('Error serving download:', error);
      res.status(500).json({ error: 'Failed to serve download' });
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
          downloadMax: sessionData.downloadMax,
          pricePerDownload: sessionData.pricePerDownload,
          freeDownloads: sessionData.freeDownloads,
          watermarkEnabled: sessionData.watermarkEnabled
        },
        clientAccess: {
          hasAccess: true,
          downloadUsage,
          remainingDownloads: sessionData.downloadMax ? sessionData.downloadMax - downloadUsage : null
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
      const { token, clientEmail, clientName } = req.body;

      if (!token) {
        return res.status(403).json({ error: 'Access token required' });
      }

      // Verify token with proper session binding
      const downloadToken = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, token))
        .limit(1);

      if (downloadToken.length === 0 || new Date() > downloadToken[0].expiresAt) {
        return res.status(403).json({ error: 'Invalid or expired access token' });
      }

      const tokenData = downloadToken[0];

      // Enforce session binding - token must belong to this session
      if (tokenData.sessionId !== sessionId) {
        return res.status(403).json({ error: 'Access token is not valid for this session' });
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

      // Verify photo exists in this session
      const sessionFiles = await r2Manager.getSessionFiles(sessionData.userId, sessionId);
      const photoExists = sessionFiles.filesByType.gallery?.some(photo => 
        photo.filename === photoId || photo.key.includes(photoId)
      );

      if (!photoExists) {
        return res.status(404).json({ error: 'Photo not found in this session' });
      }
      
      // Handle freemium model - check if free downloads are exhausted
      if (sessionData.pricingModel === 'freemium') {
        const clientKey = tokenData.clientEmail || 'anonymous';
        const usageResult = await db
          .select({ count: count() })
          .from(galleryDownloads)
          .where(and(
            eq(galleryDownloads.sessionId, sessionId),
            eq(galleryDownloads.clientKey, clientKey),
            eq(galleryDownloads.status, 'completed')
          ));

        const currentUsage = usageResult[0]?.count || 0;
        const freeLimit = sessionData.freeDownloads || 0;

        if (currentUsage < freeLimit) {
          return res.status(400).json({ 
            error: 'Free downloads still available',
            message: `You have ${freeLimit - currentUsage} free downloads remaining` 
          });
        }
      }

      if (sessionData.pricingModel === 'free') {
        return res.status(400).json({ error: 'This session uses free downloads' });
      }

      // Validate required information for checkout
      if (!clientEmail || !clientName) {
        return res.status(400).json({ error: 'Client email and name required for receipt' });
      }

      // Get the photo filename for display
      let photoFilename = photoId;
      try {
        const sessionFiles = await r2Manager.getSessionFiles(sessionData.userId, sessionId);
        const photo = sessionFiles.filesByType.gallery?.find(p => 
          p.filename === photoId || p.key.includes(photoId)
        );
        if (photo) {
          photoFilename = photo.filename || photoId;
        }
      } catch (err) {
        console.warn('Could not determine photo filename, using photoId:', photoId);
      }

      const amount = Math.max(50, Math.round(Number(sessionData.pricePerDownload) * 100)) || 500; // Convert to cents with proper rounding, minimum 50 cents

      // Create success and cancel URLs
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/api/downloads/purchase-success?session_id={CHECKOUT_SESSION_ID}&token=${token}&sessionId=${sessionId}&photoId=${photoId}`;
      const cancelUrl = `${baseUrl}/gallery/${sessionId}?token=${token}`;

      // Create Stripe Checkout Session
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Photo Download - ${photoFilename}`,
              description: `High-resolution download from ${sessionData.sessionName || 'Photo Session'}`,
            },
            unit_amount: amount
          },
          quantity: 1
        }],
        customer_email: clientEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          sessionId,
          photoId,
          token,
          clientEmail,
          clientName,
          photographerId: sessionData.userId,
          sessionName: sessionData.sessionName || 'Photo Session',
          type: 'photo_download'
        }
      });

      console.log(`💳 Created Stripe checkout session for photo ${photoId} in session ${sessionId}`);
      
      res.json({
        success: true,
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        message: 'Checkout session created successfully'
      });
      
    } catch (error) {
      console.error('Error processing purchase:', error);
      res.status(500).json({ error: 'Failed to process payment' });
    }
  });

  /**
   * GET /api/downloads/purchase-success
   * Handle successful Stripe checkout and record transaction
   */
  router.get('/purchase-success', async (req, res) => {
    try {
      const { session_id, token, sessionId, photoId } = req.query;

      if (!session_id || !token || !sessionId || !photoId) {
        return res.status(400).send(`
          <html>
            <head><title>Payment Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>❌ Payment Error</h1>
              <p>Missing required parameters. Please contact support.</p>
            </body>
          </html>
        `);
      }

      // Retrieve the Stripe session
      const stripeSession = await stripe.checkout.sessions.retrieve(session_id);
      
      if (stripeSession.payment_status !== 'paid') {
        return res.status(400).send(`
          <html>
            <head><title>Payment Not Completed</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>⏳ Payment Pending</h1>
              <p>Your payment has not been completed yet. Please wait or try again.</p>
            </body>
          </html>
        `);
      }

      // Validate metadata matches query parameters for security
      if (stripeSession.metadata.sessionId !== sessionId || 
          stripeSession.metadata.photoId !== photoId || 
          stripeSession.metadata.token !== token) {
        console.error('Metadata mismatch in payment success:', {
          expected: { sessionId, photoId, token },
          received: stripeSession.metadata
        });
        return res.status(400).send(`
          <html>
            <head><title>Payment Validation Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>❌ Payment Validation Error</h1>
              <p>Payment metadata does not match. Please contact support.</p>
            </body>
          </html>
        `);
      }

      // Re-validate token for security
      const downloadToken = await db
        .select()
        .from(downloadTokens)
        .where(eq(downloadTokens.token, token))
        .limit(1);

      if (downloadToken.length === 0 || new Date() > downloadToken[0].expiresAt || downloadToken[0].sessionId !== sessionId) {
        return res.status(403).send(`
          <html>
            <head><title>Token Validation Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>❌ Token Validation Error</h1>
              <p>Access token is invalid or expired. Please contact support.</p>
            </body>
          </html>
        `);
      }

      // Check for existing transaction to prevent duplicates (webhook may have already recorded it)
      const existingTransaction = await db
        .select()
        .from(digitalTransactions)
        .where(eq(digitalTransactions.stripeSessionId, session_id))
        .limit(1);
        
      if (existingTransaction.length === 0) {
        // Record the transaction only if webhook hasn't already done it
        const transactionId = uuidv4();
        await db.insert(digitalTransactions).values({
          id: transactionId,
          sessionId,
          userId: stripeSession.metadata.photographerId,
          photoId,
          stripeSessionId: session_id,
          amount: stripeSession.amount_total / 100, // Convert from cents
          downloadToken: token,
          status: 'completed',
          clientEmail: stripeSession.customer_email,
          clientName: stripeSession.metadata.clientName,
          createdAt: new Date()
        });

        console.log(`✅ Redirect: Payment recorded for photo ${photoId} in session ${sessionId}, transaction: ${transactionId}`);
      } else {
        console.log(`✅ Redirect: Transaction already recorded by webhook for session ${session_id}`);
      }

      // Redirect back to gallery with success message
      const redirectUrl = `/gallery/${sessionId}?token=${token}&purchase=success&photo=${photoId}`;
      
      res.send(`
        <html>
          <head>
            <title>Payment Successful</title>
            <meta http-equiv="refresh" content="3;url=${redirectUrl}">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>✅ Payment Successful!</h1>
            <p>Your photo download has been purchased successfully.</p>
            <p>You will be redirected to the gallery in 3 seconds...</p>
            <a href="${redirectUrl}">Click here if you are not redirected automatically</a>
          </body>
        </html>
      `);

    } catch (error) {
      console.error('Error handling purchase success:', error);
      res.status(500).send(`
        <html>
          <head><title>Payment Processing Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Payment Processing Error</h1>
            <p>There was an error processing your payment. Please contact support.</p>
          </body>
        </html>
      `);
    }
  });


  /**
   * GET /api/downloads/download/:token/:photoId
   * Download photo with watermark and usage tracking - public endpoint
   */
  router.get('/download/:token/:photoId', requireValidToken, async (req, res) => {
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

      // Check download limits and payment requirements based on pricing model
      const usageResult = await db
        .select({ count: count() })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, tokenData.sessionId),
          eq(galleryDownloads.clientKey, clientKey),
          eq(galleryDownloads.status, 'completed')
        ));

      const currentUsage = usageResult[0]?.count || 0;

      // Handle different pricing models
      if (sessionData.pricingModel === 'free') {
        // Free model - check download limits
        if (sessionData.downloadMax && currentUsage >= sessionData.downloadMax) {
          return res.status(403).json({ error: 'Download limit exceeded' });
        }
      } else if (sessionData.pricingModel === 'freemium') {
        // Freemium model - check if within free limit or payment required
        const freeLimit = sessionData.freeDownloads || 0;
        
        if (currentUsage < freeLimit) {
          // Still within free downloads - allow download
          console.log(`📥 Freemium free download: ${currentUsage + 1}/${freeLimit} for ${clientKey}`);
        } else {
          // Free downloads exhausted - verify payment for this photo
          const transactionResult = await db
            .select()
            .from(digitalTransactions)
            .where(and(
              eq(digitalTransactions.sessionId, tokenData.sessionId),
              eq(digitalTransactions.photoId, photoId),
              eq(digitalTransactions.downloadToken, token),
              eq(digitalTransactions.status, 'completed')
            ))
            .limit(1);

          if (transactionResult.length === 0) {
            return res.status(402).json({ 
              error: 'Payment required for download',
              message: `Free download limit (${freeLimit}) exceeded. Payment required for additional downloads.`
            });
          }
        }
      }

      // For paid downloads, verify payment exists for this specific photo
      let digitalTransaction = null;
      if (sessionData.pricingModel === 'paid') {
        const transactionResult = await db
          .select()
          .from(digitalTransactions)
          .where(and(
            eq(digitalTransactions.sessionId, tokenData.sessionId),
            eq(digitalTransactions.photoId, photoId),
            eq(digitalTransactions.downloadToken, token),
            eq(digitalTransactions.status, 'completed')
          ))
          .limit(1);

        if (transactionResult.length === 0) {
          return res.status(402).json({ error: 'Payment required for this specific photo download' });
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
      if (sessionData.watermarkEnabled && sessionData.watermarkType) {
        try {
          const position = sessionData.watermarkPosition || 'bottom-right';
          const opacity = (sessionData.watermarkOpacity || 70) / 100;
          const scale = (sessionData.watermarkScale || 20) / 100; // Scale as percentage of image width
          
          const sharpImage = sharp(photoBuffer);
          const { width: imageWidth, height: imageHeight } = await sharpImage.metadata();
          const composites = [];

          // Apply logo watermark for 'logo' type
          if (sessionData.watermarkType === 'logo' && sessionData.watermarkLogoUrl) {
            try {
              // Download logo from R2 or use signed URL
              let logoBuffer;
              if (sessionData.watermarkLogoUrl.startsWith('http')) {
                const response = await fetch(sessionData.watermarkLogoUrl);
                logoBuffer = Buffer.from(await response.arrayBuffer());
              } else {
                // Fallback for base64 stored logos
                logoBuffer = Buffer.from(sessionData.watermarkLogoUrl.split(',')[1], 'base64');
              }

              // Resize logo based on image scale
              const logoWidth = Math.floor(imageWidth * scale);
              const logoProcessed = await sharp(logoBuffer)
                .resize(logoWidth, null, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer();

              composites.push({
                input: logoProcessed,
                gravity: position === 'center' ? 'center' : 
                        position === 'top-left' ? 'northwest' : 
                        position === 'top-right' ? 'northeast' : 
                        position === 'bottom-left' ? 'southwest' : 'southeast',
                blend: 'over',
                opacity: opacity // Apply the configured opacity to logo watermarks
              });

            } catch (logoError) {
              console.warn('Logo watermark failed, skipping:', logoError.message);
            }
          }

          // Apply text watermark for 'text' type
          if (sessionData.watermarkType === 'text' && sessionData.watermarkText) {
            const watermarkText = sessionData.watermarkText;
            const fontSize = Math.max(16, Math.floor(imageWidth * 0.02)); // Responsive font size

            const textOverlay = await sharp({
              create: {
                width: Math.floor(imageWidth * 0.8),
                height: Math.floor(fontSize * 2),
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
              }
            })
            .png()
            .composite([{
              input: Buffer.from(`
                <svg width="${Math.floor(imageWidth * 0.8)}" height="${Math.floor(fontSize * 2)}">
                  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" 
                        font-family="Arial, sans-serif" font-size="${fontSize}" 
                        fill="white" opacity="${opacity}"
                        stroke="black" stroke-width="1" stroke-opacity="0.3">
                    ${watermarkText}
                  </text>
                </svg>
              `),
              top: 0,
              left: 0
            }])
            .toBuffer();

            composites.push({
              input: textOverlay,
              gravity: position === 'center' ? 'center' : 
                      position === 'top-left' ? 'northwest' : 
                      position === 'top-right' ? 'northeast' : 
                      position === 'bottom-left' ? 'southwest' : 'southeast',
              blend: 'over'
            });
          }

          // Apply all composites if any exist
          if (composites.length > 0) {
            photoBuffer = await sharpImage
              .composite(composites)
              .toBuffer();
          }

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
          downloadMax: session.downloadMax,
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
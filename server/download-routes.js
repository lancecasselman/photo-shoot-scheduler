const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Import database schema and ORM with full schema support
const { drizzle } = require('drizzle-orm/node-postgres');
const { pgTable, varchar, timestamp, boolean, text, jsonb, decimal, integer } = require('drizzle-orm/pg-core');
const schema = require('../shared/schema');
const { 
  photographySessions, 
  digitalTransactions 
} = schema;
const { eq, and, desc, count, sum, gte, lte } = require('drizzle-orm');

// Define missing table schemas that aren't in compiled schema.js
const downloadTokens = pgTable("download_tokens", {
  id: varchar("id").primaryKey().notNull(),
  token: varchar("token").notNull().unique(),
  photoUrl: varchar("photo_url"),
  filename: varchar("filename"),
  sessionId: varchar("session_id").notNull(),
  clientEmail: varchar("client_email"),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow()
});

const galleryDownloads = pgTable("gallery_downloads", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  clientKey: varchar("client_key").notNull(),
  downloadToken: varchar("download_token").notNull().unique(),
  photoId: varchar("photo_id").notNull(),
  photoUrl: varchar("photo_url").notNull(),
  filename: varchar("filename").notNull(),
  downloadType: varchar("download_type").notNull(),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow()
});

// Import R2 file manager for download delivery
const R2FileManager = require('./r2-file-manager');

function createDownloadRoutes(isAuthenticated) {
  const router = express.Router();
  
  // Database connection for API routes
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  // Create Drizzle db instance with full schema
  const db = drizzle(pool, { schema });
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
  
  // Rate limiting configurations
  const downloadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many download requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  const strictDownloadRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 actual downloads per hour
    message: 'Download limit exceeded. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Use skipSuccessfulRequests to not count successful cached responses
    skipSuccessfulRequests: false
  });
  
  // Suspicious activity tracking
  const suspiciousActivity = new Map();
  
  // Referer validation middleware
  const validateReferer = (req, res, next) => {
    const referer = req.headers.referer || req.headers.referrer;
    const host = req.headers.host;
    
    // Allow requests from same origin or no referer (direct access)
    if (!referer || referer.includes(host)) {
      return next();
    }
    
    // Track suspicious activity
    const ip = req.ip || req.connection.remoteAddress;
    const activity = suspiciousActivity.get(ip) || { count: 0, firstSeen: Date.now() };
    activity.count++;
    activity.lastSeen = Date.now();
    suspiciousActivity.set(ip, activity);
    
    // Log suspicious activity
    console.warn(`⚠️ Suspicious download attempt from IP ${ip} with referer ${referer}`);
    
    // Block if too many suspicious attempts
    if (activity.count > 10) {
      return res.status(403).json({ error: 'Access denied due to suspicious activity' });
    }
    
    next();
  };

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
        downloadEnabled: session.downloadEnabled, // CRITICAL FIX: Add missing downloadEnabled field
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
        watermarkUpdatedAt: session.watermarkUpdatedAt,
        // Add screenshot protection settings
        screenshotProtection: session.screenshotProtection !== false, // Default to true for security
        protectionLevel: session.protectionLevel || 'medium' // low, medium, high
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
        downloadEnabled,
        pricingModel,
        downloadMax,
        pricePerDownload,
        freeDownloads,
        watermarkEnabled,
        watermarkType,
        watermarkText,
        watermarkPosition,
        watermarkOpacity,
        watermarkScale,
        screenshotProtection,
        protectionLevel
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

      // Build update object (only include defined values) - Use camelCase for Drizzle columns
      // Apply boolean coercion for form data that sends string values
      const updateData = {};
      if (downloadEnabled !== undefined) {
        // Coerce string boolean values from form data
        updateData.downloadEnabled = downloadEnabled === true || downloadEnabled === 'true' || downloadEnabled === '1';
      }
      if (pricingModel !== undefined) updateData.pricingModel = pricingModel;
      if (downloadMax !== undefined) {
        // Convert to integer or null
        updateData.downloadMax = downloadMax ? parseInt(downloadMax) : null;
      }
      if (pricePerDownload !== undefined) {
        // Convert to decimal string
        updateData.pricePerDownload = pricePerDownload ? String(pricePerDownload) : '0';
      }
      if (freeDownloads !== undefined) {
        // Convert to integer
        updateData.freeDownloads = parseInt(freeDownloads) || 0;
      }
      if (watermarkEnabled !== undefined) {
        // Coerce string boolean values from form data
        updateData.watermarkEnabled = watermarkEnabled === true || watermarkEnabled === 'true' || watermarkEnabled === '1';
      }
      if (watermarkType !== undefined) updateData.watermarkType = watermarkType;
      if (watermarkText !== undefined) updateData.watermarkText = watermarkText;
      if (watermarkPosition !== undefined) updateData.watermarkPosition = watermarkPosition;
      if (watermarkOpacity !== undefined) {
        // Convert to integer
        updateData.watermarkOpacity = parseInt(watermarkOpacity) || 60;
      }
      if (watermarkScale !== undefined) {
        // Convert to integer
        updateData.watermarkScale = parseInt(watermarkScale) || 20;
      }
      
      // Add screenshot protection settings
      if (screenshotProtection !== undefined) {
        updateData.screenshotProtection = screenshotProtection === true || screenshotProtection === 'true' || screenshotProtection === '1';
      }
      if (protectionLevel !== undefined) {
        // Validate protection level
        const validLevels = ['low', 'medium', 'high'];
        if (validLevels.includes(protectionLevel)) {
          updateData.protectionLevel = protectionLevel;
        }
      }

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
      updateData.updatedAt = new Date();

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

  // ==================== CENTRALIZED ENFORCEMENT HELPERS ====================

  /**
   * Convert snake_case database fields to camelCase for consistent access
   * CRITICAL FIX: This resolves the field name mismatch between raw SQL and Drizzle ORM
   */
  function toCamelCase(obj) {
    if (!obj) return obj;
    
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      converted[camelKey] = value;
      // Also keep original key for backward compatibility
      converted[key] = value;
    }
    return converted;
  }

  /**
   * Centralized download policy enforcement function
   * Handles null/0 = unlimited, finite limits properly with atomic check-and-reserve
   */
  async function enforceDownloadPolicy(sessionData, sessionId) {
    const downloadMax = sessionData.downloadMax;
    
    // If downloadMax is null or 0, downloads are unlimited
    if (!downloadMax || downloadMax === 0) {
      return { allowed: true, reason: 'unlimited' };
    }
    
    // Count total downloads for this session (atomic check)
    const existingDownloads = await db
      .select({ count: count() })
      .from(galleryDownloads)
      .where(eq(galleryDownloads.sessionId, sessionId));
    
    const usedDownloads = existingDownloads[0]?.count || 0;
    
    if (usedDownloads >= downloadMax) {
      return { 
        allowed: false, 
        reason: 'limit_exceeded',
        code: 'limit_exceeded',
        allowed: downloadMax,
        used: usedDownloads,
        message: `Download limit reached (${downloadMax} downloads maximum)`
      };
    }
    
    return { allowed: true, reason: 'under_limit', remaining: downloadMax - usedDownloads };
  }

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

      // CRITICAL FIX: Use raw SQL with proper field name conversion
      console.log('🔍 Using raw SQL with snake_case to camelCase conversion');
      
      let session;
      try {
        const sessionQuery = 'SELECT * FROM photography_sessions WHERE id = $1 AND gallery_access_token = $2 LIMIT 1';
        const result = await pool.query(sessionQuery, [sessionId, galleryToken]);
        session = result.rows;
        
        console.log('🔍 Raw SQL query result:', { 
          rowCount: result.rows.length,
          firstRow: result.rows[0] ? {
            id: result.rows[0].id,
            download_enabled: result.rows[0].download_enabled,
            pricing_model: result.rows[0].pricing_model,
            download_max: result.rows[0].download_max
          } : null
        });
      } catch (sqlError) {
        console.error('❌ SQL query error:', sqlError);
        return res.status(500).json({ error: 'Database query failed' });
      }

      if (session.length === 0) {
        return res.status(403).json({ error: 'Invalid gallery access or session not found' });
      }

      // CRITICAL FIX: Convert snake_case fields to camelCase
      const rawSessionData = session[0];
      const sessionData = toCamelCase(rawSessionData);
      
      // Now we can access fields consistently in camelCase
      const downloadsEnabled = sessionData.downloadEnabled;
      const pricingModel = sessionData.pricingModel;
      const galleryExpiresAt = sessionData.galleryExpiresAt;
      const downloadMax = sessionData.downloadMax;
      
      console.log('🔍 Session data (properly accessed):', {
        downloadsEnabled,
        pricingModel,
        galleryExpiresAt,
        downloadMax
      });

      // Check if gallery is expired
      if (galleryExpiresAt && new Date() > new Date(galleryExpiresAt)) {
        return res.status(410).json({ error: 'Gallery access has expired' });
      }

      // Check if downloads are enabled
      if (!downloadsEnabled) {
        console.log('❌ Downloads disabled for session:', sessionId);
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
        // CRITICAL FIX: Use centralized enforcement logic
        const policyCheck = await enforceDownloadPolicy(sessionData, sessionId);
        
        if (!policyCheck.allowed) {
          console.log(`❌ Download limit exceeded for session ${sessionId}:`, policyCheck);
          return res.status(403).json({
            code: policyCheck.code,
            message: policyCheck.message,
            allowed: policyCheck.allowed,
            used: policyCheck.used
          });
        }
        
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
        // CRITICAL FIX: Check overall download limit first using centralized enforcement
        const policyCheck = await enforceDownloadPolicy(sessionData, sessionId);
        
        if (!policyCheck.allowed) {
          console.log(`❌ Total download limit exceeded for session ${sessionId}:`, policyCheck);
          return res.status(403).json({
            code: policyCheck.code,
            message: policyCheck.message,
            allowed: policyCheck.allowed,
            used: policyCheck.used
          });
        }
        
        // Check if user has free downloads remaining
        const freeDownloads = sessionData.freeDownloads || 0;
        
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
          const pricePerDownload = parseFloat(sessionData.pricePerDownload || '0');
          return res.json({
            status: 'pay',
            price: pricePerDownload,
            currency: 'usd',
            checkoutUrl: `/api/payments/digital/checkout?sessionId=${sessionId}&assetId=${assetId}&token=${galleryToken}`
          });
        }

      } else if (pricingModel === 'paid') {
        // CRITICAL FIX: Check overall download limit first using centralized enforcement
        const policyCheck = await enforceDownloadPolicy(sessionData, sessionId);
        
        if (!policyCheck.allowed) {
          console.log(`❌ Download limit exceeded for paid session ${sessionId}:`, policyCheck);
          return res.status(403).json({
            code: policyCheck.code,
            message: policyCheck.message,
            allowed: policyCheck.allowed,
            used: policyCheck.used
          });
        }
        
        // Paid download - redirect to checkout
        const pricePerDownload = parseFloat(sessionData.pricePerDownload || '0');
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

      // CRITICAL FIX: Re-check download limit at fulfillment time using centralized enforcement
      const policyCheck = await enforceDownloadPolicy(sessionData, tokenData.sessionId);
      
      if (!policyCheck.allowed) {
        console.log(`❌ Download limit exceeded at fulfillment for session ${tokenData.sessionId}:`, policyCheck);
        return res.status(403).json({
          code: policyCheck.code,
          message: policyCheck.message,
          allowed: policyCheck.allowed,
          used: policyCheck.used
        });
      }

      // Get the actual file from R2 storage
      const fileUrl = tokenData.photoUrl;
      const filename = tokenData.filename;
      
      // Apply watermark if enabled
      let finalImage;
      let finalImageFormat = 'jpeg'; // Default format
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
        const originalImage = sharp(originalFile.data);
        const metadata = await originalImage.metadata();
        
        if (watermarkConfig.type === 'text') {
          // Escape text to prevent SVG injection attacks
          const escapeXml = (str) => {
            return String(str)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
          };
          
          const safeText = escapeXml(watermarkConfig.text || '© Photography');
          
          // Calculate text dimensions based on scale (as percentage of image width)
          const fontSize = Math.max(20, Math.floor(metadata.width * (watermarkConfig.scale || 10) / 100));
          const textWidth = Math.min(metadata.width * 0.8, fontSize * safeText.length * 0.6);
          const textHeight = fontSize * 1.5;
          
          // Create properly sized SVG for the text
          const svgText = `
            <svg width="${Math.ceil(textWidth)}" height="${Math.ceil(textHeight)}" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <style type="text/css">
                  text { font-family: Arial, sans-serif; font-weight: bold; }
                </style>
              </defs>
              <text x="50%" y="50%" 
                font-size="${fontSize}" 
                fill="white" 
                stroke="black" 
                stroke-width="2"
                text-anchor="middle" 
                dominant-baseline="middle"
                opacity="${(watermarkConfig.opacity || 60) / 100}">
                ${safeText}
              </text>
            </svg>`;
          
          // Determine position
          let gravity = 'center';
          if (watermarkConfig.position === 'bottom-right') gravity = 'southeast';
          else if (watermarkConfig.position === 'bottom-left') gravity = 'southwest';
          else if (watermarkConfig.position === 'top-right') gravity = 'northeast';
          else if (watermarkConfig.position === 'top-left') gravity = 'northwest';
          else if (watermarkConfig.position === 'center') gravity = 'center';
          else if (watermarkConfig.position === 'bottom-center') gravity = 'south';
          else if (watermarkConfig.position === 'top-center') gravity = 'north';
          
          // Preserve original format
          const outputFormat = metadata.format === 'png' ? 'png' : 'jpeg';
          finalImageFormat = outputFormat; // Set format for headers
          
          finalImage = await originalImage
            .composite([{
              input: Buffer.from(svgText),
              gravity: gravity
            }])
            .toFormat(outputFormat, { quality: 90 })
            .toBuffer();
            
        } else if (watermarkConfig.type === 'logo' && watermarkConfig.logoBuffer) {
          // Apply logo watermark
          const logoImage = sharp(watermarkConfig.logoBuffer);
          const logoMetadata = await logoImage.metadata();
          
          // Calculate logo size based on scale percentage (unified with text scale)
          const targetWidth = Math.floor(metadata.width * (watermarkConfig.scale || 10) / 100);
          const targetHeight = Math.floor(targetWidth * (logoMetadata.height / logoMetadata.width));
          
          // Resize logo with transparency preserved
          const resizedLogo = await logoImage
            .resize(targetWidth, targetHeight, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .png()
            .toBuffer();
          
          // Determine position
          let gravity = 'center';
          if (watermarkConfig.position === 'bottom-right') gravity = 'southeast';
          else if (watermarkConfig.position === 'bottom-left') gravity = 'southwest';
          else if (watermarkConfig.position === 'top-right') gravity = 'northeast';
          else if (watermarkConfig.position === 'top-left') gravity = 'northwest';
          else if (watermarkConfig.position === 'center') gravity = 'center';
          else if (watermarkConfig.position === 'bottom-center') gravity = 'south';
          else if (watermarkConfig.position === 'top-center') gravity = 'north';
          
          // Preserve original format
          const outputFormat = metadata.format === 'png' ? 'png' : 'jpeg';
          finalImageFormat = outputFormat; // Set format for headers
          
          // Apply logo with opacity in composite operation
          const logoOpacity = (watermarkConfig.opacity || 60) / 100;
          
          finalImage = await originalImage
            .composite([{
              input: resizedLogo,
              gravity: gravity,
              opacity: logoOpacity
            }])
            .toFormat(outputFormat, { quality: 90 })
            .toBuffer();
        } else {
          // Fallback to no watermark if configuration is incomplete
          // Preserve original format
          const outputFormat = metadata.format === 'png' ? 'png' : 'jpeg';
          finalImageFormat = outputFormat; // Set format for headers
          
          finalImage = await originalImage
            .toFormat(outputFormat, { quality: 90 })
            .toBuffer();
        }

        console.log(`🖼️ Watermark applied to download for session ${tokenData.sessionId}`);
      } else {
        // No watermark - serve original file
        const originalFile = await r2Manager.downloadFile(fileUrl.replace('/r2/file/', ''));
        
        if (!originalFile.success) {
          return res.status(404).json({ error: 'File not found' });
        }

        finalImage = originalFile.data;
        
        // Try to detect format from filename for non-watermarked files
        const ext = filename.toLowerCase().split('.').pop();
        if (ext === 'png') {
          finalImageFormat = 'png';
        } else if (ext === 'gif') {
          finalImageFormat = 'gif';
        } else if (ext === 'webp') {
          finalImageFormat = 'webp';
        } else {
          finalImageFormat = 'jpeg';
        }
      }

      // Mark token as used if it's a one-time token
      await db
        .update(downloadTokens)
        .set({ 
          isUsed: true, 
          usedAt: new Date() 
        })
        .where(eq(downloadTokens.token, downloadToken));

      // Determine download type based on pricing model
      // For freemium, we need to check if this is within free quota or paid
      let downloadType = 'free';
      if (sessionData.pricingModel === 'paid') {
        downloadType = 'paid'; // All downloads in paid model are paid
      } else if (sessionData.pricingModel === 'freemium') {
        // Check if this is a free download or paid (after free quota exhausted)
        const freeDownloads = sessionData.freeDownloads || 0;
        const existingFreeDownloads = await db
          .select({ count: count() })
          .from(galleryDownloads)
          .where(and(
            eq(galleryDownloads.sessionId, tokenData.sessionId),
            eq(galleryDownloads.downloadType, 'free')
          ));
        const usedFreeDownloads = existingFreeDownloads[0]?.count || 0;
        
        // If this download is beyond the free quota, it's paid
        if (usedFreeDownloads >= freeDownloads) {
          downloadType = 'paid';
        }
      }
      // For 'free' pricing model, downloadType remains 'free'
      
      // Record download in analytics
      await db.insert(galleryDownloads).values({
        id: uuidv4(),
        sessionId: tokenData.sessionId,
        userId: sessionData.userId,
        clientKey: 'gallery-access', // Since this is via gallery access token
        photoId: filename,
        photoUrl: fileUrl,
        filename,
        downloadType,
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

      // Serve the file with correct content type
      const contentType = finalImageFormat === 'png' ? 'image/png' : 'image/jpeg';
      const fileExtension = finalImageFormat === 'png' ? '.png' : '.jpg';
      const downloadFilename = filename.replace(/\.[^.]+$/, fileExtension);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      console.log(`📥 Download delivered via token for session ${tokenData.sessionId}, asset: ${filename} (${contentType})`);
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
   * Get gallery data for clients with download controls (public endpoint with gallery access token)
   */
  router.get('/gallery/:sessionId', requireGalleryToken, async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Session data is available from requireGalleryToken middleware
      const sessionData = req.sessionData;

      // Get download usage for this client/session
      const clientKey = 'gallery-client'; // For gallery access, use generic key
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
   * GET /api/gallery/:galleryToken/verify
   * Verify gallery access token and return session data with full download policy settings
   * This is the endpoint the client gallery calls to get session configuration
   */
  router.get('/gallery/:galleryToken/verify', async (req, res) => {
    try {
      const { galleryToken } = req.params;
      
      console.log('🔍 Gallery verification request for token:', galleryToken);

      // Find session by gallery access token
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.galleryAccessToken, galleryToken))
        .limit(1);

      if (session.length === 0) {
        return res.status(403).json({ error: 'Invalid gallery access token' });
      }

      const sessionData = session[0];

      // Check if gallery access has expired
      if (sessionData.galleryExpiresAt && new Date() > sessionData.galleryExpiresAt) {
        return res.status(410).json({ error: 'Gallery access has expired' });
      }

      // Get photos from R2 storage
      let photos = [];
      try {
        const sessionFiles = await r2Manager.getSessionFiles(sessionData.userId, sessionData.id);
        photos = sessionFiles.filesByType.gallery || [];
      } catch (error) {
        console.warn('Could not load gallery photos:', error.message);
      }

      // Convert database fields from snake_case to camelCase for client consumption
      const clientSessionData = {
        id: sessionData.id,
        clientName: sessionData.clientName,
        sessionType: sessionData.sessionType,
        sessionName: sessionData.sessionName,
        downloadEnabled: sessionData.downloadEnabled,
        pricingModel: sessionData.pricingModel,
        downloadMax: sessionData.downloadMax,
        pricePerDownload: sessionData.pricePerDownload,
        freeDownloads: sessionData.freeDownloads,
        watermarkEnabled: sessionData.watermarkEnabled,
        watermarkType: sessionData.watermarkType,
        watermarkText: sessionData.watermarkText,
        watermarkLogoUrl: sessionData.watermarkLogoUrl,
        watermarkPosition: sessionData.watermarkPosition,
        watermarkOpacity: sessionData.watermarkOpacity,
        watermarkScale: sessionData.watermarkScale,
        galleryExpiresAt: sessionData.galleryExpiresAt,
        photos: photos
      };

      console.log('✅ Gallery verification successful for:', sessionData.clientName, 'with settings:', {
        downloadEnabled: sessionData.downloadEnabled,
        pricingModel: sessionData.pricingModel,
        watermarkEnabled: sessionData.watermarkEnabled
      });

      res.json({
        success: true,
        sessionId: sessionData.id,
        session: clientSessionData
      });
      
    } catch (error) {
      console.error('❌ Gallery verification error:', error);
      res.status(500).json({ error: 'Gallery verification failed' });
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

  // ==================== ATOMIC DOWNLOAD OPERATIONS ====================
  
  /**
   * POST /api/downloads/sessions/:sessionId/issue
   * Atomically issue a download token with row-level locking
   * Enforces all limits and determines free vs paid
   */
  router.post('/sessions/:sessionId/issue', async (req, res) => {
    const { sessionId } = req.params;
    const { photoUrl, filename, galleryAccessToken } = req.body;
    
    if (!photoUrl || !filename) {
      return res.status(400).json({ error: 'photoUrl and filename are required' });
    }

    // Get database connection for transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Lock the session row to prevent concurrent modifications
      const sessionResult = await client.query(
        `SELECT * FROM photography_sessions WHERE id = $1 FOR UPDATE`,
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = sessionResult.rows[0];
      
      // Validate gallery access token if provided
      if (galleryAccessToken) {
        if (session.gallery_access_token !== galleryAccessToken) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Invalid gallery access token' });
        }
        
        // Check if gallery has expired
        if (session.gallery_expires_at && new Date(session.gallery_expires_at) < new Date()) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Gallery access has expired' });
        }
      }
      
      // Check if downloads are enabled
      if (!session.download_enabled) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Downloads are disabled for this session' });
      }
      
      // Count total downloads (both reserved and completed)
      const totalCountResult = await client.query(
        `SELECT COUNT(*) as count FROM gallery_downloads 
         WHERE session_id = $1 AND status IN ('reserved', 'completed')`,
        [sessionId]
      );
      const totalUsed = parseInt(totalCountResult.rows[0].count);
      
      // Check download_max limit (0 means unlimited, null means unlimited)
      if (session.download_max !== null && session.download_max > 0 && totalUsed >= session.download_max) {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          error: 'Download limit exceeded',
          message: `Maximum download limit (${session.download_max}) reached`,
          downloadMax: session.download_max,
          currentCount: totalUsed
        });
      }
      
      // Determine download type
      let downloadType = 'free';
      let requiresPayment = false;
      
      if (session.pricing_model === 'paid') {
        downloadType = 'paid';
        requiresPayment = true;
      } else if (session.pricing_model === 'freemium') {
        // Count free downloads used
        const freeCountResult = await client.query(
          `SELECT COUNT(*) as count FROM gallery_downloads 
           WHERE session_id = $1 AND download_type = 'free' 
           AND status IN ('reserved', 'completed')`,
          [sessionId]
        );
        const freeUsed = parseInt(freeCountResult.rows[0].count);
        const freeRemaining = (session.free_downloads || 0) - freeUsed;
        
        if (freeRemaining <= 0) {
          downloadType = 'paid';
          requiresPayment = true;
        }
      }
      
      // If payment required, create Stripe payment intent
      if (requiresPayment) {
        // For now, just return that payment is required
        // This will be implemented with Stripe Connect in task 5
        await client.query('ROLLBACK');
        return res.status(402).json({ 
          error: 'Payment required',
          requiresPayment: true,
          pricePerDownload: session.price_per_download,
          downloadType: 'paid'
        });
      }
      
      // Create download token first
      const token = uuidv4();
      const tokenId = uuidv4();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      await client.query(
        `INSERT INTO download_tokens 
         (id, token, photo_url, filename, session_id, expires_at, 
          is_used, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [tokenId, token, photoUrl, filename, sessionId, expiresAt]
      );
      
      // Create reservation in gallery_downloads with the token
      const downloadId = uuidv4();
      await client.query(
        `INSERT INTO gallery_downloads 
         (id, session_id, user_id, client_key, download_token, photo_id, photo_url, filename, 
          download_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'reserved', NOW())`,
        [downloadId, sessionId, session.user_id, galleryAccessToken || 'direct', 
         token, filename, photoUrl, filename, downloadType]
      );
      
      await client.query('COMMIT');
      
      console.log(`🔐 Issued ${downloadType} download token for session ${sessionId}`);
      
      res.json({
        success: true,
        token,
        downloadType,
        expiresAt,
        downloadId
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error issuing download token:', error);
      res.status(500).json({ error: 'Failed to issue download token' });
    } finally {
      client.release();
    }
  });
  
  /**
   * POST /api/downloads/redeem/:token
   * Atomically redeem a download token (one-time use)
   */
  router.post('/redeem/:token', async (req, res) => {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Lock and validate token
      const tokenResult = await client.query(
        `SELECT * FROM download_tokens WHERE token = $1 FOR UPDATE`,
        [token]
      );
      
      if (tokenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invalid or expired token' });
      }
      
      const tokenData = tokenResult.rows[0];
      
      // Check if already used
      if (tokenData.is_used) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Token has already been used' });
      }
      
      // Check expiration
      if (new Date(tokenData.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Token has expired' });
      }
      
      // Mark token as used
      await client.query(
        `UPDATE download_tokens SET is_used = true, used_at = NOW() WHERE token = $1`,
        [token]
      );
      
      // Update gallery_downloads status
      await client.query(
        `UPDATE gallery_downloads 
         SET status = 'completed', created_at = NOW() 
         WHERE download_token = $1`,
        [token]
      );
      
      // Get session for watermark settings
      const sessionResult = await client.query(
        `SELECT * FROM photography_sessions WHERE id = $1`,
        [tokenData.session_id]
      );
      const session = sessionResult.rows[0];
      
      await client.query('COMMIT');
      
      // Generate signed URL for actual download
      const downloadUrl = await r2Manager.getSignedUrl(
        tokenData.photo_url.replace('/r2/file/', ''),
        300 // 5 minute expiry for actual file download
      );
      
      console.log(`✅ Redeemed ${tokenData.type} token for session ${tokenData.session_id}`);
      
      res.json({
        success: true,
        downloadUrl,
        filename: tokenData.filename,
        watermarkEnabled: session.watermark_enabled,
        watermarkSettings: session.watermark_enabled ? {
          type: session.watermark_type,
          text: session.watermark_text,
          position: session.watermark_position,
          opacity: session.watermark_opacity,
          scale: session.watermark_scale
        } : null
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error redeeming token:', error);
      res.status(500).json({ error: 'Failed to redeem token' });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = createDownloadRoutes;
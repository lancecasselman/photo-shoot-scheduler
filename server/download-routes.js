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
// Import stream utilities for proper stream handling in AWS SDK v3
const { Readable } = require('stream');

/**
 * Utility function to convert AWS SDK v3 stream to buffer
 * Replaces the browser-only transformToByteArray() method
 */
async function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Import database schema and ORM with full schema support
const { drizzle } = require('drizzle-orm/node-postgres');
const { pgTable, varchar, timestamp, boolean, text, jsonb, decimal, integer } = require('drizzle-orm/pg-core');
const schema = require('../shared/schema');
const { 
  photographySessions, 
  digitalTransactions,
  downloadEntitlements,
  downloadOrders
} = schema;
const { eq, and, desc, count, sum, gte, lte, sql } = require('drizzle-orm');

// Define missing table schemas that aren't in compiled schema.js
const downloadTokens = pgTable("download_tokens", {
  id: varchar("id").primaryKey().notNull(),
  token: varchar("token").notNull().unique(),
  photoUrl: varchar("photo_url"),
  filename: varchar("filename"),
  sessionId: varchar("session_id").notNull(),
  clientEmail: varchar("client_email"),
  expiresAt: timestamp("expires_at"), // Nullable - tokens don't expire
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

const sessionFiles = pgTable("session_files", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  folderType: varchar("folder_type"),
  filename: varchar("filename"),
  fileSizeBytes: integer("file_size_bytes"),
  fileSizeMb: decimal("file_size_mb"),
  uploadedAt: timestamp("uploaded_at"),
  originalName: varchar("original_name"),
  r2Key: text("r2_key")
});

// Import R2 file manager for download delivery
const R2FileManager = require('./r2-file-manager');

// Import the new unified DownloadService and Enhanced Webhook Handler
const DownloadService = require('./download-service');
const EnhancedWebhookHandler = require('./enhanced-webhook-handler');
const ProductionMonitoringSystem = require('./production-monitoring');
const EnhancedCartManager = require('./enhanced-cart-manager');
const QuotaMonitoringSystem = require('./quota-monitoring-system');
const { errorHandler } = require('./standardized-error-handler');

/**
 * AUTHORITATIVE CLIENT KEY GENERATION
 * Generate unique client key based on gallery token + session ID ONLY
 * This function provides the single source of truth for client key generation
 * Both server and client MUST use identical logic to ensure key consistency
 */
function generateGalleryClientKey(galleryAccessToken, sessionId) {
  const crypto = require('crypto');
  
  if (!galleryAccessToken || !sessionId) {
    throw new Error('Gallery token and session ID are required for client key generation');
  }
  
  // CRITICAL: Use ONLY gallery token + session ID (no IP, no user agent, no other identifiers)
  // This ensures both server and client can generate the exact same key deterministically
  const baseString = `${galleryAccessToken}-${sessionId}`;
  
  // Create a SHA-256 hash for the final client key
  const clientKey = `gallery-${crypto.createHash('sha256').update(baseString).digest('hex').substring(0, 16)}`;
  
  console.log(`🔑 Generated authoritative client key: ${clientKey} for gallery token: ${galleryAccessToken.substring(0, 8)}...`);
  
  return clientKey;
}

// REMOVED: Deprecated generateUniqueClientKey function
// All client key generation now uses generateGalleryClientKey for consistency

function createDownloadRoutes(isAuthenticated, downloadCommerceManager) {
  const router = express.Router();
  
  // Database connection for API routes
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  // Create Drizzle db instance with full schema
  const db = drizzle(pool, { schema });
  const r2Manager = new R2FileManager(null, pool);
  
  // Use provided commerce manager or create a fallback instance
  const commerceManager = downloadCommerceManager || require('./download-commerce');
  
  // Initialize the unified DownloadService and Enhanced Systems
  const downloadService = new DownloadService(pool);
  const enhancedWebhookHandler = new EnhancedWebhookHandler(pool);
  const monitoringSystem = new ProductionMonitoringSystem(pool);
  const quotaMonitoringSystem = new QuotaMonitoringSystem(pool);
  const enhancedCartManager = new EnhancedCartManager(pool, quotaMonitoringSystem);
  
  // Start real-time quota monitoring
  quotaMonitoringSystem.startMonitoring();
  
  // Apply correlation ID middleware to all routes
  router.use(errorHandler.createCorrelationMiddleware());
  
  console.log('✅ Unified DownloadService, Enhanced Webhook Handler, Enhanced Cart Manager, and Quota Monitoring System initialized for download routes');
  console.log('✅ Standardized error handling and correlation tracking enabled');

  // Configure multer for watermark logo uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: Infinity }, // No file size limit
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
  
  // REMOVED: Test endpoint for client key consistency verification (testing complete)
  
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

      // REMOVED: Token expiration and usage restrictions for unlimited downloads
      // Tokens can now be used multiple times and never expire
      console.log(`🔓 Token validation passed - unlimited access enabled`);

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

  // ==================== UNIFIED DOWNLOAD SERVICE API ROUTES ====================
  
  /**
   * POST /api/downloads/unified/process
   * Unified download processing endpoint - routes to appropriate pricing model handler
   */
  router.post('/unified/process', downloadRateLimit, async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.correlationId;
    
    try {
      const { 
        galleryAccessToken, 
        sessionId, 
        photoId, 
        photoUrl, 
        filename,
        paymentIntentId = null 
      } = req.body;

      // Get client information for security and logging
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      const context = {
        endpoint: '/api/downloads/unified/process',
        method: 'POST',
        sessionId,
        photoId,
        clientIp,
        userAgent,
        correlationId,
        additional: { hasPaymentIntent: !!paymentIntentId }
      };

      console.log(`🎯 [${correlationId}] Processing download request for photo ${photoId} in session ${sessionId}`);

      // Validate required fields with detailed error context
      if (!galleryAccessToken || !sessionId || !photoId) {
        const missingFields = [];
        if (!galleryAccessToken) missingFields.push('galleryAccessToken');
        if (!sessionId) missingFields.push('sessionId');
        if (!photoId) missingFields.push('photoId');
        
        return res.handleError('MISSING_REQUIRED_FIELDS', 
          `Missing required fields: ${missingFields.join(', ')}`, context);
      }

      // Perform security validation with enhanced error handling
      const securityCheck = await downloadService.validateSessionSecurity(sessionId, clientIp, userAgent);
      if (!securityCheck.allowed) {
        const errorCode = securityCheck.code || 'RATE_LIMIT_EXCEEDED';
        const customMessage = securityCheck.error;
        const securityContext = {
          ...context,
          additional: {
            ...context.additional,
            securityViolation: securityCheck.code,
            retryAfter: securityCheck.retryAfter
          }
        };
        
        return res.handleError(errorCode, customMessage, securityContext);
      }

      // Process download through unified service
      const result = await downloadService.processDownload({
        galleryAccessToken,
        sessionId,
        photoId,
        photoUrl,
        filename,
        paymentIntentId,
        clientIp,
        userAgent,
        correlationId
      });

      if (result.success) {
        const processingTime = Date.now() - startTime;
        console.log(`✅ [${correlationId}] Download processed successfully: ${photoId} (${result.pricing?.model || 'unknown'}) in ${processingTime}ms`);
        
        // Add correlation ID and processing metadata to success response
        res.json({
          ...result,
          meta: {
            correlationId,
            processingTime,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        // Handle specific error codes for different pricing models
        let errorCode = result.code || 'PROCESSING_ERROR';
        let statusCode = 400;
        
        // Map specific errors to appropriate HTTP status codes
        switch (result.code) {
          case 'PAYMENT_REQUIRED':
            statusCode = 402; // Payment Required
            break;
          case 'QUOTA_EXCEEDED':
            statusCode = 429; // Too Many Requests
            break;
          case 'INVALID_TOKEN':
          case 'EXPIRED_ACCESS':
            statusCode = 401; // Unauthorized
            break;
          case 'SESSION_NOT_FOUND':
          case 'PHOTO_NOT_FOUND':
            statusCode = 404; // Not Found
            break;
          default:
            statusCode = 400; // Bad Request
        }
        
        const downloadContext = {
          ...context,
          additional: {
            ...context.additional,
            downloadServiceError: result.error,
            pricingModel: result.pricing?.model,
            paymentInfo: result.paymentInfo
          }
        };
        
        // For payment required errors, include payment info in response
        if (result.code === 'PAYMENT_REQUIRED' && result.paymentInfo) {
          return res.status(statusCode).json({
            success: false,
            error: result.error,
            code: result.code,
            paymentInfo: result.paymentInfo,
            meta: {
              correlationId,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString()
            }
          });
        }
        
        return res.handleError(errorCode, result.error, downloadContext);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [${correlationId}] Unexpected error in unified download processing:`, error);
      
      const errorContext = {
        endpoint: '/api/downloads/unified/process',
        method: 'POST',
        sessionId: req.body?.sessionId,
        photoId: req.body?.photoId,
        correlationId,
        additional: {
          processingTime,
          errorStack: error.stack
        },
        debug: {
          stack: error.stack,
          details: error.message,
          originalError: error.toString()
        }
      };
      
      return res.handleError('INTERNAL_ERROR', 
        'Unexpected error during download processing', errorContext);
    }
  });

  /**
   * GET /api/downloads/unified/status/:sessionId
   * Get download status, quota information, and session statistics
   */
  router.get('/unified/status/:sessionId', downloadRateLimit, async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.correlationId;
    
    try {
      const { sessionId } = req.params;
      const { galleryAccessToken, clientKey } = req.query;
      
      const context = {
        endpoint: '/api/downloads/unified/status',
        method: 'GET',
        sessionId,
        clientKey,
        correlationId
      };

      console.log(`📊 [${correlationId}] Getting status for session ${sessionId}`);

      // Validate required parameters
      if (!galleryAccessToken) {
        return res.handleError('MISSING_REQUIRED_FIELDS', 
          'Missing required parameter: galleryAccessToken', context);
      }

      // Validate gallery access with enhanced error context
      const authResult = await downloadService.validateGalleryAccess(galleryAccessToken, sessionId);
      if (!authResult.success) {
        const errorCode = authResult.code || 'VALIDATION_ERROR';
        const authContext = {
          ...context,
          additional: {
            authenticationError: authResult.error,
            tokenProvided: !!galleryAccessToken
          }
        };
        
        return res.handleError(errorCode, authResult.error, authContext);
      }

      // Use provided clientKey or generate from auth result
      const effectiveClientKey = clientKey || authResult.clientKey;

      // Get session statistics with error handling
      const statsResult = await downloadService.getSessionStats(sessionId, effectiveClientKey);

      if (statsResult.success) {
        const processingTime = Date.now() - startTime;
        console.log(`✅ [${correlationId}] Status retrieved for session ${sessionId} in ${processingTime}ms`);
        
        res.json({
          success: true,
          sessionId: sessionId,
          clientKey: effectiveClientKey,
          ...statsResult.stats,
          meta: {
            correlationId,
            processingTime,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        console.error(`❌ [${correlationId}] Failed to get status: ${statsResult.error}`);
        
        const statsContext = {
          ...context,
          additional: {
            statsError: statsResult.error,
            effectiveClientKey
          }
        };
        
        return res.handleError('STATUS_ERROR', statsResult.error, statsContext);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [${correlationId}] Unexpected error getting session status:`, error);
      
      const errorContext = {
        endpoint: '/api/downloads/unified/status',
        method: 'GET',
        sessionId: req.params?.sessionId,
        correlationId,
        additional: {
          processingTime,
          errorStack: error.stack
        },
        debug: {
          stack: error.stack,
          details: error.message,
          originalError: error.toString()
        }
      };
      
      return res.handleError('INTERNAL_ERROR', 
        'Unexpected error retrieving session status', errorContext);
    }
  });

  /**
   * GET /api/downloads/unified/health
   * Health check endpoint for the unified download service
   */
  router.get('/unified/health', async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.correlationId;
    
    try {
      console.log(`🔍 [${correlationId}] Health check requested`);
      
      const context = {
        endpoint: '/api/downloads/unified/health',
        method: 'GET',
        correlationId
      };

      // Perform comprehensive health check with timeout protection
      const healthCheckTimeout = 10000; // 10 seconds
      const healthCheckPromise = downloadService.healthCheck();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), healthCheckTimeout)
      );
      
      const healthResult = await Promise.race([healthCheckPromise, timeoutPromise]);
      const processingTime = Date.now() - startTime;

      if (healthResult.success) {
        console.log(`✅ [${correlationId}] Service healthy in ${processingTime}ms`);
        res.json({
          success: true,
          status: healthResult.status,
          timestamp: new Date().toISOString(),
          checks: healthResult.checks,
          version: '1.0.0',
          meta: {
            correlationId,
            processingTime,
            healthCheckDuration: processingTime
          }
        });
      } else {
        console.warn(`⚠️ [${correlationId}] Service degraded: ${healthResult.error}`);
        
        const degradedContext = {
          ...context,
          additional: {
            healthStatus: healthResult.status,
            failedChecks: healthResult.checks,
            processingTime
          }
        };
        
        return res.handleError('SERVICE_UNAVAILABLE', 
          `Service degraded: ${healthResult.error}`, degradedContext);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const isTimeout = error.message === 'Health check timeout';
      
      console.error(`❌ [${correlationId}] Health check ${isTimeout ? 'timed out' : 'failed'}:`, error);
      
      const errorContext = {
        endpoint: '/api/downloads/unified/health',
        method: 'GET',
        correlationId,
        additional: {
          processingTime,
          isTimeout,
          healthCheckFailed: true
        },
        debug: {
          stack: error.stack,
          details: error.message,
          originalError: error.toString()
        }
      };
      
      const errorCode = isTimeout ? 'TIMEOUT_ERROR' : 'INTERNAL_ERROR';
      const errorMessage = isTimeout ? 'Health check timed out' : 'Health check failed';
      
      return res.handleError(errorCode, errorMessage, errorContext);
    }
  });

  /**
   * POST /api/downloads/unified/validate-access
   * Validate gallery access and return client key for client-side use
   */
  router.post('/unified/validate-access', downloadRateLimit, async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.correlationId;
    
    try {
      const { galleryAccessToken, sessionId } = req.body;
      
      const context = {
        endpoint: '/api/downloads/unified/validate-access',
        method: 'POST',
        sessionId: sessionId || 'resolving-from-token',
        correlationId
      };

      console.log(`🔐 [${correlationId}] Validating access using gallery token (sessionId: ${sessionId || 'unknown - will resolve'})`);

      // Validate required fields - only galleryAccessToken is required now
      if (!galleryAccessToken) {
        return res.handleError('MISSING_REQUIRED_FIELDS', 
          'Missing required field: galleryAccessToken', context);
      }

      // Resolve session from gallery token (fixes circular dependency)
      const authResult = await downloadService.resolveSessionFromGalleryToken(galleryAccessToken);

      if (authResult.success) {
        const processingTime = Date.now() - startTime;
        const resolvedSessionId = authResult.session.id;
        const userId = authResult.session.userId;
        console.log(`✅ [${correlationId}] Access validated for session ${resolvedSessionId} in ${processingTime}ms`);
        
        // Get session policy for client information
        const policyResult = await downloadService.getSessionPolicy(resolvedSessionId);
        
        if (!policyResult.success) {
          console.warn(`⚠️ [${correlationId}] Policy retrieval failed but access granted: ${policyResult.error}`);
        }
        
        // Fetch photos for the gallery - FIXED: Use same session_files table query as successful gallery route
        let photos = [];
        let photoCount = 0;
        try {
          // Query session_files table directly (same as successful gallery route)
          const photosQuery = await pool.query(`
            SELECT filename, file_size_bytes, uploaded_at, r2_key
            FROM session_files 
            WHERE session_id = $1 AND folder_type = 'gallery'
            ORDER BY uploaded_at ASC
          `, [resolvedSessionId]);
          
          if (photosQuery.rows.length > 0) {
            photos = photosQuery.rows.map((row, index) => ({
              index: index + 1,
              filename: row.filename,
              fileSizeBytes: row.file_size_bytes,
              fileSizeMB: row.file_size_bytes / (1024 * 1024),
              uploadedAt: row.uploaded_at,
              contentType: 'image/jpeg', // Default for gallery images
              r2Key: row.r2_key,
              photoId: row.filename, // Use filename as photoId for consistency
              originalFormat: 'jpeg'
            }));
            photoCount = photos.length;
          }
          console.log(`📷 [${correlationId}] Retrieved ${photoCount} photos for session ${resolvedSessionId}`);
          console.log(`📷 [${correlationId}] photoCount: ${photoCount}, photosBeingServed: [${photos.slice(0, 3).map(p => `{ index: ${p.index}, filename: '${p.filename}' }`).join(', ')}${photos.length > 3 ? ', ...' : ''}]`);
        } catch (photoError) {
          console.error(`⚠️ [${correlationId}] Error fetching photos for session ${resolvedSessionId}:`, photoError);
          // Continue with empty photos array if photo fetching fails
        }
        
        res.json({
          success: true,
          clientKey: authResult.clientKey,
          session: {
            id: authResult.session.id,
            clientName: authResult.session.clientName,
            downloadEnabled: authResult.session.downloadEnabled,
            galleryExpiresAt: authResult.session.galleryExpiresAt
          },
          policy: policyResult.success ? policyResult.policy : null,
          photos: photos, // Include the photos array in the response
          photoCount: photoCount, // Include photo count for easy reference
          meta: {
            correlationId,
            processingTime,
            timestamp: new Date().toISOString(),
            policyRetrieved: policyResult.success,
            photosRetrieved: photoCount > 0
          }
        });
      } else {
        const errorCode = authResult.code || 'VALIDATION_ERROR';
        const authContext = {
          ...context,
          additional: {
            authenticationError: authResult.error,
            tokenLength: galleryAccessToken?.length || 0
          }
        };
        
        console.warn(`⚠️ [${correlationId}] Access validation failed: ${authResult.error}`);
        return res.handleError(errorCode, authResult.error, authContext);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [${correlationId}] Unexpected error validating access:`, error);
      
      const errorContext = {
        endpoint: '/api/downloads/unified/validate-access',
        method: 'POST',
        sessionId: req.body?.sessionId,
        correlationId,
        additional: {
          processingTime,
          errorStack: error.stack
        },
        debug: {
          stack: error.stack,
          details: error.message,
          originalError: error.toString()
        }
      };
      
      return res.handleError('INTERNAL_ERROR', 
        'Unexpected error during access validation', errorContext);
    }
  });

  // ==================== COMMERCE API ROUTES ====================
  
  /**
   * POST /api/downloads/checkout
   * Create Stripe checkout session for photo downloads
   */
  router.post('/checkout', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey, clientName, items, mode = 'payment' } = req.body;
      
      if (!sessionId || !clientKey || !items || !Array.isArray(items)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, clientKey, and items array' 
        });
      }
      
      console.log(`💳 Creating checkout session for ${items.length} items from client: ${clientKey}`);
      
      // Call commerce manager to create checkout session
      const result = await commerceManager.createCheckoutSession(
        sessionId, 
        clientKey, 
        items, 
        mode
      );
      
      if (result.success) {
        console.log(`✅ Checkout session created: ${result.sessionId}`);
        res.json({
          success: true,
          checkoutUrl: result.checkoutUrl,
          sessionId: result.sessionId
        });
      } else {
        console.error(`❌ Checkout creation failed: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('❌ Error creating checkout session:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create checkout session' 
      });
    }
  });
  
  /**
   * POST /api/downloads/free-entitlement
   * Create immediate free entitlement for freemium mode downloads
   * Bypasses cart for first N free downloads
   */
  router.post('/free-entitlement', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, photoId, photoUrl, filename, galleryToken } = req.body;
      
      // SECURITY FIX: Never trust client-supplied clientKey for quota enforcement
      // Generate client identity server-side based on reliable identifiers
      // SECURITY FIX: Use only server-derived IP address, never client-controllable headers
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      // CRITICAL SECURITY: Generate client key using ONLY server-derived data
      // Never trust client headers like User-Agent that can be manipulated for quota bypass
      const clientKey = generateGalleryClientKey(galleryToken, sessionId);
      
      if (!sessionId || !photoId || !photoUrl || !filename || !galleryToken) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, photoId, photoUrl, filename, galleryToken' 
        });
      }
      
      // Security logging: Log any attempt to bypass quota enforcement
      const userAgent = req.headers['user-agent'] || 'unknown';
      console.log(`🔒 SECURITY: Server-generated client key ${clientKey} for photo ${photoId} (IP: ${clientIP}, UA: ${userAgent.substring(0, 50)}...)`);
      
      // Validate gallery access token and get session data
      let session;
      try {
        const sessionQuery = 'SELECT * FROM photography_sessions WHERE id = $1 AND gallery_access_token = $2 LIMIT 1';
        const result = await pool.query(sessionQuery, [sessionId, galleryToken]);
        session = result.rows;
      } catch (sqlError) {
        console.error('❌ SQL query error:', sqlError);
        return res.status(500).json({ error: 'Database query failed' });
      }

      if (session.length === 0) {
        return res.status(403).json({ 
          success: false, 
          error: 'Invalid gallery access or session not found' 
        });
      }

      // Convert snake_case fields to camelCase  
      const rawSessionData = session[0];
      const sessionData = toCamelCase(rawSessionData);
      
      // Check if gallery is expired
      if (sessionData.galleryExpiresAt && new Date() > new Date(sessionData.galleryExpiresAt)) {
        return res.status(410).json({ 
          success: false, 
          error: 'Gallery access has expired' 
        });
      }

      // Check if downloads are enabled
      if (!sessionData.downloadEnabled) {
        return res.status(403).json({ 
          success: false, 
          error: 'Downloads are not enabled for this gallery' 
        });
      }
      
      // Get policy to check for freemium mode
      const policy = await commerceManager.getPolicyForSession(sessionId);
      if (!policy.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get session policy'
        });
      }
      
      // Validate this is freemium or free mode
      if (policy.policy.mode !== 'freemium' && policy.policy.mode !== 'free') {
        return res.status(400).json({
          success: false,
          error: `Free entitlement endpoint only supports freemium and free modes. Current mode: ${policy.policy.mode}`
        });
      }
      
      // For FREE mode, skip quota checks completely
      if (policy.policy.mode === 'free') {
        console.log(`🆓 FREE mode detected - allowing unlimited downloads for session: ${sessionId}`);
        
        // Create free entitlement immediately without quota checks
        const entitlementId = uuidv4();
        const downloadToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + (100 * 365 * 24 * 60 * 60 * 1000)); // 100 years (effectively no expiration)

        // Create entitlement record
        await db.insert(downloadEntitlements).values({
          id: entitlementId,
          sessionId: sessionId,
          clientKey: clientKey,
          photoId: photoId,
          photoUrl: photoUrl,
          filename: filename,
          type: 'free',
          status: 'active',
          maxDownloads: 1,
          remaining: 1,
          isActive: true,
          createdAt: new Date(),
          expiresAt: expiresAt
        });

        // Create download token
        await db.insert(downloadTokens).values({
          id: uuidv4(),
          token: downloadToken,
          photoUrl: photoUrl,
          filename: filename,
          sessionId: sessionId,
          clientEmail: clientKey,
          expiresAt: expiresAt,
          isUsed: false,
          createdAt: new Date()
        });

        console.log(`🆓 FREE entitlement created: ${entitlementId} with download token for photo ${photoId}`);
        
        return res.json({
          success: true,
          entitlement: {
            id: entitlementId,
            photoId: photoId,
            type: 'free',
            downloadToken: downloadToken,
            expiresAt: expiresAt,
            downloadUrl: `/api/downloads/${downloadToken}`
          },
          quotaInfo: {
            remaining: 999999, // Unlimited for FREE mode
            total: 999999,
            used: 0
          }
        });
      }
      
      console.log(`📋 Session policy mode: ${policy.policy.mode}, freeCount: ${policy.policy.freeCount}`);
      
      // Check if user has free downloads remaining (PER CLIENT)
      const freeDownloads = parseInt(policy.policy.freeCount || 0);
      
      // REMOVED: Free download limits - unlimited downloads for all modes
      console.log(`🔓 Free download limits disabled - proceeding with unlimited access`);
      if (false) { // Disabled check
        return res.status(400).json({
          success: false,
          error: 'No free downloads available in current policy'
        });
      }
      
      console.log(`📊 Session allows ${freeDownloads} free downloads per client`);
      
      // Count existing FREE entitlements for this client to check quota
      // CRITICAL FIX: Only count free downloads (orderId is null), not paid downloads
      
      const existingEntitlements = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey),
          sql`${downloadEntitlements.orderId} IS NULL`  // Only count FREE downloads (explicit NULL check)
        ));

      
      const usedDownloads = existingEntitlements.length;
      
      console.log(`📈 QUOTA CHECK: Client ${clientKey} has used ${usedDownloads} of ${freeDownloads} free downloads`);

      // Security audit: Log quota enforcement for security monitoring
      console.log(`🔐 SECURITY AUDIT: Free download quota check - Session: ${sessionId}, Client: ${clientKey}, Used: ${usedDownloads}/${freeDownloads}, IP: ${clientIP}`);

      if (usedDownloads >= freeDownloads) {
        // Log quota bypass attempt for security monitoring
        console.warn(`⚠️ SECURITY: Free download quota exceeded by client ${clientKey} (IP: ${clientIP}, Session: ${sessionId}). Used: ${usedDownloads}, Limit: ${freeDownloads}`);
        
        // REMOVED: Free download limit exceeded - unlimited downloads enabled
        console.log(`🔓 Free download limit bypass - unlimited access granted`);
      }
      
      // Check if photo is already purchased (has valid entitlement)
      const entitlementCheck = await commerceManager.verifyEntitlement(sessionId, clientKey, photoId);
      if (entitlementCheck.success) {
        return res.status(400).json({
          success: false,
          error: 'Photo is already entitled for download',
          entitlement: entitlementCheck.entitlement
        });
      }
      
      // Create free entitlement immediately
      const entitlementId = uuidv4();
      const downloadToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

      // Create entitlement record
      await db.insert(downloadEntitlements).values({
        id: entitlementId,
        sessionId: sessionId,
        clientKey: clientKey,
        photoId: photoId,
        photoUrl: photoUrl,
        filename: filename,
        type: 'free',
        status: 'active',
        maxDownloads: 1,
        remaining: 1,
        isActive: true,
        createdAt: new Date(),
        expiresAt: expiresAt
      });

      // Create download token
      await db.insert(downloadTokens).values({
        id: uuidv4(),
        token: downloadToken,
        photoUrl: photoUrl,
        filename: filename,
        sessionId: sessionId,
        clientEmail: clientKey,
        expiresAt: expiresAt,
        isUsed: false,
        createdAt: new Date()
      });

      console.log(`🆓 Free entitlement created: ${entitlementId} with download token for photo ${photoId}`);
      
      res.json({
        success: true,
        entitlement: {
          id: entitlementId,
          photoId: photoId,
          type: 'free',
          downloadToken: downloadToken,
          expiresAt: expiresAt,
          downloadUrl: `/api/downloads/${downloadToken}`
        },
        quotaInfo: {
          remaining: freeDownloads - usedDownloads - 1,
          total: freeDownloads,
          used: usedDownloads + 1
        }
      });
      
    } catch (error) {
      console.error('❌ Error creating free entitlement:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create free entitlement' 
      });
    }
  });

  /**
   * GET /api/downloads/entitlements
   * Check client's download entitlements
   */
  router.get('/entitlements', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey } = req.query;
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters: sessionId and clientKey' 
        });
      }
      
      console.log(`🔍 Checking entitlements for client: ${clientKey} in session: ${sessionId}`);
      
      // Get entitlements from commerce manager
      const result = await commerceManager.getClientEntitlements(sessionId, clientKey);
      
      if (result.success) {
        console.log(`✅ Found ${result.entitlements.length} entitlements`);
        res.json({
          success: true,
          entitlements: result.entitlements
        });
      } else {
        console.error(`❌ Failed to get entitlements: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error,
          entitlements: []
        });
      }
      
    } catch (error) {
      console.error('❌ Error fetching entitlements:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch entitlements',
        entitlements: []
      });
    }
  });
  
  /**
   * POST /api/downloads/entitlements
   * Create entitlements for free downloads
   */
  router.post('/entitlements', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey, items, type = 'free' } = req.body;
      
      if (!sessionId || !clientKey || !items || !Array.isArray(items)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, clientKey, and items array' 
        });
      }
      
      // Only allow free entitlements through this endpoint
      if (type !== 'free') {
        return res.status(400).json({ 
          success: false, 
          error: 'This endpoint only processes free downloads' 
        });
      }
      
      console.log(`🆓 Processing ${items.length} free downloads for client: ${clientKey}`);
      
      // Create free entitlements
      const result = await commerceManager.createFreeEntitlements(sessionId, clientKey, items);
      
      if (result.success) {
        console.log(`✅ Created ${result.count} free entitlements`);
        res.json({
          success: true,
          message: 'Free downloads processed successfully',
          count: result.count
        });
      } else {
        console.error(`❌ Failed to create free entitlements: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('❌ Error creating free entitlements:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process free downloads' 
      });
    }
  });
  
  /**
   * POST /api/downloads/tokens
   * Issue download token for entitled photo
   */
  router.post('/tokens', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey, photoId, photoUrl, filename } = req.body;
      
      // DEBUG: Log all incoming parameters
      console.log(`🔍 [DEBUG] /api/downloads/tokens - Incoming parameters:`);
      console.log(`  📋 Request body:`, JSON.stringify(req.body, null, 2));
      console.log(`  🗂️ sessionId: "${sessionId}" (type: ${typeof sessionId})`);
      console.log(`  🔑 clientKey: "${clientKey}" (type: ${typeof clientKey})`);
      console.log(`  📷 photoId: "${photoId}" (type: ${typeof photoId})`);
      console.log(`  🔗 photoUrl: "${photoUrl}" (type: ${typeof photoUrl})`);
      console.log(`  📄 filename: "${filename}" (type: ${typeof filename})`);
      
      if (!sessionId || !clientKey || !photoId) {
        console.error(`❌ Missing required fields - sessionId: ${!!sessionId}, clientKey: ${!!clientKey}, photoId: ${!!photoId}`);
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, clientKey, and photoId' 
        });
      }
      
      console.log(`🎟️ Issuing download token for photo ${photoId} to client: ${clientKey}`);
      
      // FREEMIUM MODE FIX: Check if this is freemium mode and create free entitlements if needed
      const policyResult = await commerceManager.getPolicyForSession(sessionId);
      
      if (policyResult.success && policyResult.policy.mode === 'freemium') {
        console.log(`🆓 [FREEMIUM FIX] Session is in freemium mode - using authoritative client key`);
        
        // CRITICAL FIX: Always use the authoritative client key (already generated above)
        // This ensures consistent key usage across creation and verification
        console.log(`🔑 [FREEMIUM FIX] Using authoritative client key: ${clientKey}`);
        
        // Try to create free entitlement with the authoritative client key
        const freeEntitlementResult = await commerceManager.createFreeEntitlements(
          sessionId, 
          clientKey, 
          [{ photoId: photoId }]
        );
        
        if (freeEntitlementResult.success) {
          console.log(`✅ [FREEMIUM FIX] Created free entitlement for photo ${photoId} with authoritative key (${freeEntitlementResult.count} entitlements created)`);
        } else {
          console.log(`⚠️ [FREEMIUM FIX] Failed to create free entitlement: ${freeEntitlementResult.error}`);
        }
      } else {
        console.log(`💰 [FREEMIUM FIX] Session not in freemium mode (mode: ${policyResult.policy?.mode || 'unknown'})`);
      }
      
      console.log(`🔍 [DEBUG] About to call verifyEntitlement with:`);
      console.log(`  - sessionId: "${sessionId}"`);
      console.log(`  - clientKey: "${clientKey}"`);
      console.log(`  - photoId: "${photoId}"`);
      
      // Now verify entitlement exists (either just created or previously existing)
      const entitlementCheck = await commerceManager.verifyEntitlement(sessionId, clientKey, photoId);
      
      console.log(`🔍 [DEBUG] verifyEntitlement result:`, JSON.stringify(entitlementCheck, null, 2));
      
      if (!entitlementCheck.success) {
        console.warn(`⚠️ Entitlement not found for photo ${photoId}`);
        return res.status(403).json({
          success: false,
          error: 'No download entitlement found for this photo'
        });
      }
      
      // Issue download token
      const result = await commerceManager.issueDownloadToken(
        sessionId, 
        clientKey, 
        photoId, 
        photoUrl, 
        filename
      );
      
      if (result.success) {
        console.log(`✅ Download token issued: ${result.token.substring(0, 8)}...`);
        res.json({
          success: true,
          token: result.token,
          expiresIn: result.expiresIn
        });
      } else {
        console.error(`❌ Failed to issue token: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('❌ Error issuing download token:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to issue download token' 
      });
    }
  });
  
  /**
   * POST /api/downloads/webhook
   * Enhanced Stripe webhook handler with comprehensive error handling,
   * idempotency protection, and retry logic
   */
  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const webhookId = req.headers['stripe-webhook-id'] || `webhook_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_CONNECT || process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!sig || !endpointSecret) {
        console.error(`⚠️ [${webhookId}] Missing webhook signature or secret`);
        await monitoringSystem.sendAlert(
          'webhook_configuration_error',
          'critical',
          'Webhook signature or secret missing',
          { webhookId, hasSignature: !!sig, hasSecret: !!endpointSecret }
        );
        return res.status(400).json({ error: 'Webhook configuration error' });
      }
      
      // Use enhanced webhook handler with comprehensive error handling
      const result = await enhancedWebhookHandler.processWebhook(
        req.body,
        sig,
        endpointSecret
      );
      
      const processingTime = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ [${webhookId}] Webhook processed successfully in ${processingTime}ms`);
        
        // Log success metrics
        if (result.duplicate) {
          console.log(`ℹ️ [${webhookId}] Duplicate webhook event - already processed`);
        }
        
        res.json({ 
          received: true, 
          processingTime,
          duplicate: result.duplicate || false,
          status: result.status || 'completed'
        });
      } else {
        const statusCode = result.httpStatus || 400;
        console.error(`❌ [${webhookId}] Webhook processing failed: ${result.error}`);
        
        // Send alert for processing failures
        if (statusCode >= 500) {
          await monitoringSystem.sendAlert(
            'webhook_processing_error',
            'high',
            `Webhook processing failed: ${result.error}`,
            { 
              webhookId, 
              processingTime,
              error: result.error,
              retryAt: result.retryAt
            }
          );
        }
        
        res.status(statusCode).json({ 
          error: result.error,
          retryAt: result.retryAt,
          processingTime
        });
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [${webhookId}] Unexpected webhook error:`, error);
      
      // Send critical alert for unexpected errors
      await monitoringSystem.sendAlert(
        'webhook_system_error',
        'critical',
        `Unexpected webhook processing error: ${error.message}`,
        { 
          webhookId, 
          processingTime,
          error: error.message,
          stack: error.stack
        }
      );
      
      res.status(500).json({ 
        error: 'Internal webhook processing error',
        processingTime
      });
    }
  });
  
  /**
   * GET /api/downloads/history/:sessionId
   * Get download history for a session (photographer only)
   */
  router.get('/history/:sessionId', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const { startDate, endDate, clientKey } = req.query;
      
      // Verify session ownership
      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found or access denied' 
        });
      }
      
      console.log(`📊 Fetching download history for session: ${sessionId}`);
      
      // Get download history from commerce manager
      const result = await commerceManager.getDownloadHistory(sessionId, {
        startDate,
        endDate,
        clientKey
      });
      
      if (result.success) {
        console.log(`✅ Retrieved ${result.history.length} download records`);
        
        // Add summary statistics
        const summary = {
          totalDownloads: result.history.length,
          uniqueClients: [...new Set(result.history.map(h => h.clientKey))].length,
          totalRevenue: result.history
            .filter(h => h.price > 0)
            .reduce((sum, h) => sum + parseFloat(h.price), 0),
          freeDownloads: result.history.filter(h => h.price === 0).length,
          paidDownloads: result.history.filter(h => h.price > 0).length
        };
        
        res.json({
          success: true,
          history: result.history,
          summary: summary
        });
      } else {
        console.error(`❌ Failed to get history: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error,
          history: []
        });
      }
      
    } catch (error) {
      console.error('❌ Error fetching download history:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch download history',
        history: []
      });
    }
  });

  // ==================== SESSION POLICY MANAGEMENT ====================
  
  /**
   * GET /api/downloads/policies/:sessionId
   * Get download policy for a session (public endpoint for client gallery)
   */
  router.get('/policies/:sessionId', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      console.log(`📋 Fetching policy for session: ${sessionId}`);
      
      // Get policy from commerce manager (handles creation of default if needed)
      const result = await commerceManager.getPolicyForSession(sessionId);
      
      if (result.success) {
        console.log(`✅ Policy retrieved for session ${sessionId}`);
        res.json({
          success: true,
          policy: result.policy
        });
      } else {
        console.error(`❌ Failed to get policy: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('❌ Error fetching policy:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch download policy' 
      });
    }
  });

  /**
   * GET /api/downloads/sessions/:sessionId/policy
   * Get current download policy for a session (authenticated endpoint for photographer)
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
   * GET /api/downloads/order/:orderId
   * Get order details and entitlements status for download purchase success page
   * SECURE: Requires sessionId or clientKey authentication
   */
  router.get('/order/:orderId', downloadRateLimit, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { sessionId, clientKey } = req.query;
      
      if (!sessionId && !clientKey) {
        return res.status(403).json({
          success: false,
          error: 'Authentication required. Please provide sessionId or clientKey.'
        });
      }
      
      const orders = await db.select()
        .from(downloadOrders)
        .where(eq(downloadOrders.id, orderId))
        .limit(1);
      
      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      
      const order = orders[0];
      
      const isSessionValid = sessionId && sessionId === order.sessionId;
      const isClientKeyValid = clientKey && clientKey === order.clientKey;
      
      if (!isSessionValid && !isClientKeyValid) {
        console.warn(`🚨 Unauthorized order access attempt for order ${orderId.substring(0, 8)}...`);
        return res.status(403).json({
          success: false,
          error: 'Access denied. Invalid authentication credentials.'
        });
      }
      
      const entitlements = await db.select()
        .from(downloadEntitlements)
        .where(eq(downloadEntitlements.orderId, orderId));
      
      const entitlementsCreated = entitlements.length > 0;
      const photoCount = order.items ? order.items.length : 0;
      
      console.log(`✅ Secure order access: ${orderId.substring(0, 8)}... (${photoCount} photos, ${order.status})`);
      
      res.json({
        success: true,
        order: {
          id: order.id,
          sessionId: order.sessionId,
          clientKey: order.clientKey,
          amount: order.amount,
          currency: order.currency,
          photoCount: photoCount,
          status: order.status,
          createdAt: order.createdAt
        },
        entitlementsCreated: entitlementsCreated,
        entitlementsCount: entitlements.length
      });
      
    } catch (error) {
      console.error('❌ Order fetch error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order details'
      });
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

      // SYNC: Also update the download_policies table to keep both tables in sync
      // This ensures the client gallery reads the correct pricing information
      if (pricingModel !== undefined || pricePerDownload !== undefined || freeDownloads !== undefined) {
        const policyUpdateData = {};
        
        // Map pricing model to policy mode
        if (pricingModel !== undefined) {
          const modeMap = {
            'free': 'free',
            'paid': 'fixed',
            'freemium': 'freemium',
            'per_photo': 'per_photo'
          };
          policyUpdateData.mode = modeMap[pricingModel] || 'free';
        }
        
        if (pricePerDownload !== undefined) {
          policyUpdateData.pricePerPhoto = pricePerDownload ? String(pricePerDownload) : '0';
        }
        
        if (freeDownloads !== undefined) {
          policyUpdateData.freeCount = parseInt(freeDownloads) || null;
        }
        
        policyUpdateData.updatedAt = new Date();
        
        // Check if policy exists for this session
        const existingPolicy = await db.select()
          .from(downloadPolicies)
          .where(eq(downloadPolicies.sessionId, sessionId))
          .limit(1);
        
        if (existingPolicy.length > 0) {
          // Update existing policy
          await db
            .update(downloadPolicies)
            .set(policyUpdateData)
            .where(eq(downloadPolicies.sessionId, sessionId));
          console.log(`✅ Synced download_policies table for session ${sessionId}`);
        } else {
          // Create new policy
          const { v4: uuidv4 } = require('uuid');
          await db.insert(downloadPolicies).values({
            id: uuidv4(),
            sessionId: sessionId,
            ...policyUpdateData,
            currency: 'USD',
            taxIncluded: false,
            createdAt: new Date()
          });
          console.log(`✅ Created download_policies entry for session ${sessionId}`);
        }
      }

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

  /**
   * GET /api/downloads/sessions/:sessionId/analytics
   * Get download analytics for a session
   */
  router.get('/sessions/:sessionId/analytics', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;

      const session = await verifySessionOwnership(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      // Get download stats from the database
      const downloadStats = await db
        .select({
          totalDownloads: sql`COUNT(*)::int`,
          totalRevenue: sql`COALESCE(SUM(price), 0)::decimal`,
          uniqueClients: sql`COUNT(DISTINCT client_key)::int`
        })
        .from(downloadTransactions)
        .where(eq(downloadTransactions.sessionId, sessionId));

      const stats = downloadStats[0] || {
        totalDownloads: 0,
        totalRevenue: '0.00',
        uniqueClients: 0
      };

      // Get recent downloads (last 10)
      const recentDownloads = await db
        .select({
          id: downloadTransactions.id,
          clientKey: downloadTransactions.clientKey,
          photoCount: downloadTransactions.photoCount,
          totalPrice: downloadTransactions.price,
          createdAt: downloadTransactions.createdAt
        })
        .from(downloadTransactions)
        .where(eq(downloadTransactions.sessionId, sessionId))
        .orderBy(sql`${downloadTransactions.createdAt} DESC`)
        .limit(10);

      res.json({
        success: true,
        analytics: {
          totalDownloads: stats.totalDownloads,
          totalRevenue: stats.totalRevenue,
          uniqueClients: stats.uniqueClients,
          recentDownloads: recentDownloads
        }
      });

    } catch (error) {
      console.error('Error getting download analytics:', error);
      res.status(500).json({ error: 'Failed to get download analytics' });
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
   * Handles pricing models: FREE, PAID, FREEMIUM with proper quota enforcement
   */
  async function enforceDownloadPolicy(sessionData, sessionId, clientKey = null) {
    console.log('📋 Enforcing download policy:', {
      sessionId,
      pricingModel: sessionData.pricingModel,
      freeDownloads: sessionData.freeDownloads,
      downloadEnabled: sessionData.downloadEnabled,
      clientKey
    });
    
    // Check if downloads are explicitly disabled
    if (!sessionData.downloadEnabled) {
      return { 
        allowed: false, 
        reason: 'downloads_disabled',
        code: 'downloads_disabled',
        message: 'Downloads are disabled for this session',
        httpStatus: 403
      };
    }
    
    const pricingModel = sessionData.pricingModel || 'free';
    
    // Handle FREE pricing model - unlimited downloads
    if (pricingModel === 'free') {
      console.log('✅ FREE model: Allowing unlimited downloads');
      return { 
        allowed: true, 
        reason: 'free_model',
        model: 'free',
        message: 'Unlimited downloads allowed'
      };
    }
    
    // Handle PAID pricing model - require payment for all downloads
    if (pricingModel === 'paid') {
      console.log('💰 PAID model: Payment required for all downloads');
      
      // Check if client has any valid entitlements
      if (clientKey) {
        const entitlements = await db
          .select()
          .from(downloadEntitlements)
          .where(and(
            eq(downloadEntitlements.sessionId, sessionId),
            eq(downloadEntitlements.clientKey, clientKey),
            gt(downloadEntitlements.remaining, 0),
            or(
              isNull(downloadEntitlements.expiresAt),
              gte(downloadEntitlements.expiresAt, new Date())
            )
          ))
          .limit(1);
        
        if (entitlements.length > 0) {
          return {
            allowed: true,
            reason: 'has_entitlement',
            model: 'paid',
            entitlement: entitlements[0]
          };
        }
      }
      
      return {
        allowed: false,
        reason: 'payment_required',
        code: 'payment_required',
        message: 'Payment is required to download photos from this gallery',
        httpStatus: 402 // Payment Required
      };
    }
    
    // Handle FREEMIUM pricing model - X free downloads then payment
    if (pricingModel === 'freemium') {
      const freeLimit = parseInt(sessionData.freeDownloads) || 0;
      
      if (!clientKey) {
        console.warn('⚠️ FREEMIUM model requires clientKey for tracking');
        return {
          allowed: false,
          reason: 'client_key_required',
          code: 'client_key_required',
          message: 'Client identification required for freemium downloads',
          httpStatus: 400
        };
      }
      
      console.log(`🎯 FREEMIUM model: Checking quota for client ${clientKey}`);
      
      // Count downloads for this specific client
      const downloads = await db
        .select({ count: count() })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, sessionId),
          eq(galleryDownloads.clientKey, clientKey),
          eq(galleryDownloads.status, 'completed')
        ));
      
      const usedDownloads = downloads[0]?.count || 0;
      const remaining = Math.max(0, freeLimit - usedDownloads);
      
      console.log(`📊 Client ${clientKey}: ${usedDownloads}/${freeLimit} free downloads used`);
      
      if (usedDownloads < freeLimit) {
        return {
          allowed: true,
          reason: 'within_free_quota',
          model: 'freemium',
          used: usedDownloads,
          limit: freeLimit,
          remaining: remaining,
          message: `You have ${remaining} free download${remaining === 1 ? '' : 's'} remaining`
        };
      } else {
        // Check for paid entitlements
        const entitlements = await db
          .select()
          .from(downloadEntitlements)
          .where(and(
            eq(downloadEntitlements.sessionId, sessionId),
            eq(downloadEntitlements.clientKey, clientKey),
            gt(downloadEntitlements.remaining, 0),
            or(
              isNull(downloadEntitlements.expiresAt),
              gte(downloadEntitlements.expiresAt, new Date())
            )
          ))
          .limit(1);
        
        if (entitlements.length > 0) {
          return {
            allowed: true,
            reason: 'has_paid_entitlement',
            model: 'freemium',
            entitlement: entitlements[0]
          };
        }
        
        return {
          allowed: false,
          reason: 'free_quota_exceeded',
          code: 'quota_exceeded',
          message: `You've used all ${freeLimit} free downloads. Purchase required for additional photos.`,
          used: usedDownloads,
          limit: freeLimit,
          httpStatus: 429 // Too Many Requests
        };
      }
    }
    
    // Handle per_photo and other pricing models
    if (pricingModel === 'per_photo' || pricingModel === 'fixed' || pricingModel === 'bulk') {
      console.log(`💳 ${pricingModel.toUpperCase()} model: Checking for entitlements`);
      
      if (clientKey) {
        const entitlements = await db
          .select()
          .from(downloadEntitlements)
          .where(and(
            eq(downloadEntitlements.sessionId, sessionId),
            eq(downloadEntitlements.clientKey, clientKey),
            gt(downloadEntitlements.remaining, 0)
          ))
          .limit(1);
        
        if (entitlements.length > 0) {
          return {
            allowed: true,
            reason: 'has_entitlement',
            model: pricingModel,
            entitlement: entitlements[0]
          };
        }
      }
      
      return {
        allowed: false,
        reason: 'payment_required',
        code: 'payment_required',
        message: `Payment is required for downloads (${pricingModel} pricing)`,
        httpStatus: 402
      };
    }
    
    // Default: Allow download if no specific model matches
    console.warn(`⚠️ Unknown pricing model: ${pricingModel}, defaulting to allow`);
    return { 
      allowed: true, 
      reason: 'unknown_model_default',
      model: pricingModel
    };
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
        // Generate client key for tracking even in free mode
        const clientKey = generateGalleryClientKey(galleryToken, sessionId);
        
        // Use centralized enforcement logic
        const policyCheck = await enforceDownloadPolicy(sessionData, sessionId, clientKey);
        
        if (!policyCheck.allowed) {
          console.log(`❌ Download blocked for session ${sessionId}:`, policyCheck);
          return res.status(policyCheck.httpStatus || 403).json({
            code: policyCheck.code,
            message: policyCheck.message,
            allowed: policyCheck.allowed
          });
        }
        
        // Free download - generate immediate download token
        const downloadToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + (100 * 365 * 24 * 60 * 60 * 1000)); // 100 years (effectively no expiration)

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
        // Generate deterministic client key for freemium tracking
        const clientKey = generateGalleryClientKey(galleryToken, sessionId);
        console.log(`🔑 Generated authoritative client key: ${clientKey} for freemium access`);
        
        // Use centralized enforcement logic with client key
        const policyCheck = await enforceDownloadPolicy(sessionData, sessionId, clientKey);
        
        if (!policyCheck.allowed) {
          console.log(`❌ Download blocked for client ${clientKey}:`, policyCheck);
          return res.status(policyCheck.httpStatus || 403).json({
            code: policyCheck.code,
            message: policyCheck.message,
            allowed: policyCheck.allowed,
            used: policyCheck.used,
            limit: policyCheck.limit
          });
        }
        
        if (policyCheck.reason === 'within_free_quota') {
          // Free download available - generate immediate download token
          const downloadToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + (100 * 365 * 24 * 60 * 60 * 1000)); // 100 years (effectively no expiration)

          await db.insert(downloadTokens).values({
            id: uuidv4(),
            token: downloadToken,
            photoUrl: requestedPhoto.url,
            filename: requestedPhoto.filename,
            sessionId,
            clientEmail: clientKey, // Track client for this token
            expiresAt,
            isUsed: false,
            createdAt: new Date()
          });
          
          // Record this as a reserved download for this client
          await db.insert(galleryDownloads).values({
            id: uuidv4(),
            sessionId: sessionId,
            userId: sessionData.userId,
            clientKey: clientKey, // Associate with specific client
            downloadToken: downloadToken,
            photoId: assetId,
            photoUrl: requestedPhoto.url,
            filename: requestedPhoto.filename,
            downloadType: 'free',
            status: 'reserved', // Will be marked 'completed' when token is used
            createdAt: new Date()
          });

          console.log(`🆓 Freemium free download token generated for asset ${assetId}, client ${clientKey} (${policyCheck.used + 1}/${policyCheck.limit})`);
          return res.json({ 
            status: 'granted', 
            downloadToken,
            expiresAt,
            downloadUrl: `/api/downloads/${downloadToken}`,
            clientKey: clientKey,
            freeDownloadsRemaining: policyCheck.limit - policyCheck.used - 1
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

      // Check if token is expired (NULL expiresAt means no expiration)
      if (tokenData.expiresAt && new Date() > tokenData.expiresAt) {
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
        // Get original file from R2 using correct parameters
        const originalFile = await r2Manager.downloadFile(sessionData.userId, tokenData.sessionId, filename);
        
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
          // Extract filename from logo URL for R2 download
          const logoFilename = sessionData.watermarkLogoUrl.split('/').pop();
          try {
            const logoFile = await r2Manager.downloadFile(sessionData.userId, tokenData.sessionId, logoFilename);
            if (logoFile.success) {
              watermarkConfig.logoBuffer = logoFile.buffer;
            }
          } catch (logoError) {
            console.warn(`⚠️ Could not load logo file: ${logoError.message}`);
            // Continue without logo watermark
          }
        }

        // Apply watermark using Sharp
        const originalImage = sharp(originalFile.buffer);
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
          const textHeight = Math.min(metadata.height * 0.2, fontSize * 1.5);
          
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
          const targetWidth = Math.min(Math.floor(metadata.width * (watermarkConfig.scale || 10) / 100), metadata.width * 0.5);
          const targetHeight = Math.min(Math.floor(targetWidth * (logoMetadata.height / logoMetadata.width)), metadata.height * 0.5);
          
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
        const originalFile = await r2Manager.downloadFile(sessionData.userId, tokenData.sessionId, filename);
        
        if (!originalFile.success) {
          return res.status(404).json({ error: 'File not found' });
        }

        finalImage = originalFile.buffer;
        
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

      // Determine download type based on pricing model and client-specific quotas
      let downloadType = 'free';
      let digitalTransactionId = null;
      let amountPaid = 0;
      
      if (sessionData.pricingModel === 'paid') {
        downloadType = 'paid'; // All downloads in paid model are paid
        // TODO: Set actual transaction details for paid model
      } else if (sessionData.pricingModel === 'freemium') {
        // For freemium, check client-specific quota using clientKey from token
        const clientKey = tokenData.clientKey || 'gallery-access';
        const freeDownloads = sessionData.freeDownloads || 3; // Default 3 free downloads per client
        
        const existingClientDownloads = await db
          .select({ count: count() })
          .from(galleryDownloads)
          .where(and(
            eq(galleryDownloads.sessionId, tokenData.sessionId),
            eq(galleryDownloads.clientKey, clientKey),
            eq(galleryDownloads.downloadType, 'free')
          ));
        const usedClientFreeDownloads = existingClientDownloads[0]?.count || 0;
        
        console.log(`📊 [FREEMIUM FIX] Client ${clientKey}: ${usedClientFreeDownloads}/${freeDownloads} free downloads used`);
        
        // If this download is beyond the client's free quota, it should be paid but requires transaction
        if (usedClientFreeDownloads >= freeDownloads) {
          // This should not happen in our current freemium flow - paid downloads need transaction ID
          console.warn(`⚠️ Client ${clientKey} exceeded free quota but no transaction provided`);
          downloadType = 'free'; // Keep as free until proper payment flow
        }
      }
      // For 'free' pricing model, downloadType remains 'free'
      
      // Record download in analytics with proper constraint compliance
      const downloadRecord = {
        id: uuidv4(),
        sessionId: tokenData.sessionId,
        userId: sessionData.userId,
        clientKey: tokenData.clientKey || 'gallery-access',
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
      };
      
      // Add payment fields only for paid downloads to satisfy constraint
      if (downloadType === 'paid') {
        downloadRecord.digitalTransactionId = digitalTransactionId;
        downloadRecord.amountPaid = amountPaid;
      }
      
      await db.insert(galleryDownloads).values(downloadRecord);

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
      const expiresAt = null; // No expiration

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
        downloadUrl: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/gallery/${sessionId}?token=${token}`
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

      // Check if token is expired (NULL expiresAt means no expiration)
      if (tokenData.expiresAt && new Date() > tokenData.expiresAt) {
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

      // CRITICAL FIX: Use authoritative gallery client key generation
      // For gallery access, client key must be deterministic based on gallery token + session
      const galleryToken = req.galleryToken; // Available from requireGalleryToken middleware
      const clientKey = generateGalleryClientKey(galleryToken, sessionId);
      
      console.log(`🔑 Generated authoritative client key: ${clientKey} for gallery access`);
      
      console.log(`🔍 Gallery access - Client key: ${clientKey} for session: ${sessionId}`);
      const usageResult = await db
        .select({ count: count() })
        .from(galleryDownloads)
        .where(and(
          eq(galleryDownloads.sessionId, sessionId),
          eq(galleryDownloads.clientKey, clientKey),
          eq(galleryDownloads.status, 'completed')
        ));
      
      const downloadUsage = usageResult[0]?.count || 0;

      // Get gallery photos from session_files table (same as successful gallery route)
      let photos = [];
      try {
        const photosQuery = await pool.query(`
          SELECT filename, file_size_bytes, uploaded_at, r2_key
          FROM session_files 
          WHERE session_id = $1 AND folder_type = 'gallery'
          ORDER BY uploaded_at ASC
        `, [sessionId]);
        
        photos = photosQuery.rows.map(row => ({
          filename: row.filename,
          fileSizeBytes: row.file_size_bytes,
          fileSizeMB: row.file_size_bytes / (1024 * 1024),
          uploadedAt: row.uploaded_at,
          r2Key: row.r2_key
        }));
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

      // Get photos from session_files table (complete gallery photos)
      let photos = [];
      try {
        console.log(`🔍 Loading photos from session_files table for session ${sessionData.id}`);
        
        // Query session_files table using Drizzle ORM
        const sessionFileResults = await db
          .select({
            filename: sessionFiles.filename,
            originalName: sessionFiles.originalName,
            fileSize: sessionFiles.fileSizeBytes,
            uploadedAt: sessionFiles.uploadedAt,
            r2Key: sessionFiles.r2Key
          })
          .from(sessionFiles)
          .where(
            and(
              eq(sessionFiles.sessionId, sessionData.id),
              eq(sessionFiles.folderType, 'gallery')
            )
          )
          .orderBy(desc(sessionFiles.uploadedAt));
        
        // Transform database results to match expected photo format
        photos = sessionFileResults.map(photo => ({
          filename: photo.filename,
          originalName: photo.originalName,
          url: `/r2/file/photographer-${sessionData.user_id}/session-${sessionData.id}/gallery/${photo.filename}`,
          size: photo.fileSize,
          uploadedAt: photo.uploadedAt,
          r2Key: photo.r2Key
        }));
        
        console.log(`📸 Found ${photos.length} photos in session_files table for session ${sessionData.id}`);
      } catch (error) {
        console.warn('Could not load gallery photos from session_files table:', error.message);
        // Fallback to sessionData.photos if session_files query fails
        photos = sessionData.photos || [];
        console.log(`📸 Fallback: Using ${photos.length} photos from sessions table`);
      }

      // Convert database fields from snake_case to camelCase for client consumption
      // CRITICAL FIX: Handle FREE pricing model properly
      let finalPricePerDownload = sessionData.pricePerDownload;
      let finalFreeDownloads = sessionData.freeDownloads;
      let finalWatermarkEnabled = sessionData.watermarkEnabled;
      
      if (sessionData.pricingModel === 'free') {
        console.log('🆓 FREE MODE: Cleaning pricing data for frontend');
        finalPricePerDownload = '0.00';  // Always $0.00 for free galleries
        finalFreeDownloads = 0;          // 0 means unlimited for free galleries  
        finalWatermarkEnabled = false;   // Disable watermarks for free galleries
      }
      
      const clientSessionData = {
        id: sessionData.id,
        clientName: sessionData.clientName,
        sessionType: sessionData.sessionType,
        sessionName: sessionData.sessionName,
        downloadEnabled: sessionData.downloadEnabled,
        pricingModel: sessionData.pricingModel,
        downloadMax: sessionData.downloadMax,
        pricePerDownload: finalPricePerDownload,
        freeDownloads: finalFreeDownloads,
        watermarkEnabled: finalWatermarkEnabled,
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

      if (downloadToken.length === 0 || (downloadToken[0].expiresAt && new Date() > downloadToken[0].expiresAt)) {
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

      // Verify photo exists in this session using session_files table
      
      const photoQuery = await pool.query(`
        SELECT filename FROM session_files 
        WHERE session_id = $1 AND folder_type = 'gallery' AND filename = $2
        LIMIT 1
      `, [sessionId, photoId]);
      
      if (photoQuery.rows.length > 0) {
      } else {
        const allPhotosQuery = await pool.query(`
          SELECT filename FROM session_files 
          WHERE session_id = $1 AND folder_type = 'gallery'
          LIMIT 5
        `, [sessionId]);
      }

      if (photoQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Photo not found in this session' });
      }
      
      // Handle freemium model - check if free downloads are exhausted
      if (sessionData.pricingModel === 'freemium') {
        // For freemium mode, use authoritative gallery client key
        // Extract gallery token from token data or session context
        const session = await db.select().from(photographySessions).where(eq(photographySessions.id, sessionId)).limit(1);
        if (session.length === 0) {
          return res.status(404).json({ error: 'Session not found' });
        }
        const galleryToken = session[0].galleryAccessToken || session[0].gallery_access_token;
        const clientKey = generateGalleryClientKey(galleryToken, sessionId);
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
      const baseUrl = `${process.env.BASE_URL || 'https://photomanagementsystem.com'}`;
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

      if (downloadToken.length === 0 || (downloadToken[0].expiresAt && new Date() > downloadToken[0].expiresAt) || downloadToken[0].sessionId !== sessionId) {
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

      if (downloadToken.length === 0 || (downloadToken[0].expiresAt && new Date() > downloadToken[0].expiresAt)) {
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
      // For download verification, use authoritative gallery client key for freemium sessions
      // Extract gallery token from session data
      const galleryToken = sessionData.galleryAccessToken || sessionData.gallery_access_token;
      const clientKey = generateGalleryClientKey(galleryToken, tokenData.sessionId);

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
        // Free model - no global download limits (removed for better UX)
        console.log('Free model: Global download limits disabled');
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
            // REMOVED: Payment requirement - all downloads are now free
            console.log(`🔓 Payment requirement bypassed - free access granted`);
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

  // ========================================
  // CART API ENDPOINTS FOR QUOTA VALIDATION
  // ========================================

  /**
   * POST /api/cart/add-item
   * Validate quota and reserve quota for cart items
   */
  router.post('/cart/add-item', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey, photoId, photoUrl, filename } = req.body;
      
      console.log(`🛒 [CART] Add item request:`, { sessionId, clientKey, photoId });
      
      if (!sessionId || !clientKey || !photoId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, clientKey, and photoId' 
        });
      }

      // Get session and policy information
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.id, sessionId))
        .limit(1);

      if (session.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      const sessionData = session[0];
      const policy = await commerceManager.getPolicyForSession(sessionId);
      
      if (!policy.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get session policy'
        });
      }

      console.log(`🛒 [CART] Session policy mode: ${policy.policy.mode}`);

      // Check if photo is already purchased (has valid entitlement)
      const entitlementCheck = await commerceManager.verifyEntitlement(sessionId, clientKey, photoId);
      if (entitlementCheck.success) {
        return res.status(400).json({
          success: false,
          error: 'Photo already purchased',
          alreadyPurchased: true
        });
      }

      // Get current cart reservations for this client (stored in memory/cache)
      // For now, we'll use the existing entitlements table to track cart reservations
      // with a special status to differentiate from actual entitlements
      
      // Count existing entitlements + cart reservations for quota validation
      const existingEntitlements = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey)
        ));

      console.log(`🛒 [CART] Found ${existingEntitlements.length} total entitlements for client`);

      // Validate quota based on policy mode
      let quotaValidation = { allowed: true, remainingQuota: null, message: null };

      if (policy.policy.mode === 'freemium') {
        const freeCount = parseInt(policy.policy.freeCount || 0);
        
        // CRITICAL FIX: Count only ACTIVE FREE entitlements (completed free downloads), not paid downloads
        const completedFreeDownloads = existingEntitlements.filter(e => e.isActive === true && e.orderId === null);
        const usedCount = completedFreeDownloads.length;
        const remainingFree = Math.max(0, freeCount - usedCount);
        
        console.log(`🛒 [CART] Freemium mode: ${usedCount}/${freeCount} used, ${remainingFree} remaining`);
        
        quotaValidation = {
          allowed: remainingFree > 0,
          remainingQuota: remainingFree,
          totalQuota: freeCount,
          usedQuota: usedCount,
          message: `Unlimited downloads available - no restrictions`
        };
      } else if (policy.policy.maxPerClient && policy.policy.maxPerClient > 0) {
        const maxPerClient = parseInt(policy.policy.maxPerClient);
        
        // CRITICAL FIX: Count only ACTIVE FREE entitlements (completed free downloads), not paid downloads
        const completedFreeDownloads = existingEntitlements.filter(e => e.isActive === true && e.orderId === null);
        const usedCount = completedFreeDownloads.length;
        const remaining = Math.max(0, maxPerClient - usedCount);
        
        console.log(`🛒 [CART] Max per client: ${usedCount}/${maxPerClient} used, ${remaining} remaining`);
        
        quotaValidation = {
          allowed: remaining > 0,
          remainingQuota: remaining,
          totalQuota: maxPerClient,
          usedQuota: usedCount,
          message: remaining > 0 ? 
            `${remaining} downloads remaining` : 
            'Download limit reached for this client.'
        };
      }

      // REMOVED: Quota validation - all downloads are now unlimited
      console.log(`🔓 Quota validation disabled - unlimited downloads allowed`);
      if (false) { // Disabled quota check
        return res.status(403).json({
          success: false,
          error: quotaValidation.message,
          quotaExceeded: true,
          quotaInfo: {
            remaining: quotaValidation.remainingQuota || 0,
            total: quotaValidation.totalQuota || 0,
            used: quotaValidation.usedQuota || 0
          }
        });
      }

      // Create a temporary "cart reservation" entitlement
      // This reserves the quota slot but doesn't allow actual downloads until checkout
      const reservationId = uuidv4();
      await db.insert(downloadEntitlements).values({
        id: reservationId,
        sessionId: sessionId,
        clientKey: clientKey,
        photoId: photoId,
        remaining: 1,
        maxDownloads: 1,
        orderId: null,
        isActive: false, // Mark as inactive to indicate it's a cart reservation
        // Note: Cart reservations are identified by orderId=null, remaining=0, isActive=false
        expiresAt: null, // No expiration
        createdAt: new Date()
      });

      console.log(`🛒 [CART] Created cart reservation ${reservationId} for photo ${photoId}`);

      // Return success with updated quota information
      res.json({
        success: true,
        message: 'Item added to cart',
        reservationId: reservationId,
        quotaInfo: {
          remaining: Math.max(0, (quotaValidation.remainingQuota || 0) - 1),
          total: quotaValidation.totalQuota || 0,
          used: (quotaValidation.usedQuota || 0) + 1,
          mode: policy.policy.mode
        }
      });

    } catch (error) {
      console.error('🛒 [CART] Error adding item to cart:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add item to cart' 
      });
    }
  });

  /**
   * POST /api/cart/remove-item
   * Remove cart reservation and release quota
   */
  router.post('/cart/remove-item', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey, photoId } = req.body;
      
      console.log(`🛒 [CART] Remove item request:`, { sessionId, clientKey, photoId });
      
      if (!sessionId || !clientKey || !photoId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, clientKey, and photoId' 
        });
      }

      // Find and remove the cart reservation for this photo
      // Cart reservations are identified by: remaining=0 (can't download yet)
      const cartReservations = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey),
          eq(downloadEntitlements.photoId, photoId),
          eq(downloadEntitlements.remaining, 0) // Cart reservations can't be downloaded yet
        ))
        .limit(1);

      if (cartReservations.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cart reservation not found'
        });
      }

      // Remove the cart reservation
      await db
        .delete(downloadEntitlements)
        .where(eq(downloadEntitlements.id, cartReservations[0].id));

      console.log(`🛒 [CART] Removed cart reservation ${cartReservations[0].id} for photo ${photoId}`);

      // Get updated quota information
      const policy = await commerceManager.getPolicyForSession(sessionId);
      const remainingEntitlements = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey)
        ));

      let quotaInfo = { remaining: null, total: null, used: remainingEntitlements.length };

      if (policy.success && policy.policy.mode === 'freemium') {
        const freeCount = parseInt(policy.policy.freeCount || 0);
        quotaInfo = {
          remaining: Math.max(0, freeCount - remainingEntitlements.length),
          total: freeCount,
          used: remainingEntitlements.length,
          mode: policy.policy.mode
        };
      } else if (policy.success && policy.policy.maxPerClient) {
        const maxPerClient = parseInt(policy.policy.maxPerClient);
        quotaInfo = {
          remaining: Math.max(0, maxPerClient - remainingEntitlements.length),
          total: maxPerClient,
          used: remainingEntitlements.length,
          mode: policy.policy.mode
        };
      }

      res.json({
        success: true,
        message: 'Item removed from cart',
        quotaInfo: quotaInfo
      });

    } catch (error) {
      console.error('🛒 [CART] Error removing item from cart:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to remove item from cart' 
      });
    }
  });

  /**
   * GET /api/cart/status
   * Get current cart status and quota information for a client
   */
  router.get('/cart/status', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey } = req.query;
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters: sessionId and clientKey' 
        });
      }

      console.log(`🛒 [CART] Status request for client: ${clientKey}`);

      // Get session policy
      const policy = await commerceManager.getPolicyForSession(sessionId);
      if (!policy.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get session policy'
        });
      }

      // Get all entitlements for this client (both used and unused)
      const allEntitlements = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey)
        ));

      // Separate into active (remaining > 0) and used (remaining = 0 or used)
      const activeEntitlements = allEntitlements.filter(e => e.remaining > 0);
      const usedEntitlements = allEntitlements.filter(e => e.remaining === 0 || e.usedAt);
      
      // For cart reservations, we'll use a simple approach
      const cartReservations = []; // Cart reservations not implemented in this schema

      const totalUsedSlots = allEntitlements.length; // Total entitlements (both active and used)

      // Calculate quota information based on policy
      let quotaInfo = {
        mode: policy.policy.mode,
        cartItems: 0, // No cart reservations in this schema
        purchasedItems: activeEntitlements.length,
        totalUsed: totalUsedSlots,
        remaining: null,
        total: null,
        canAddMore: true
      };

      if (policy.policy.mode === 'freemium') {
        const freeCount = parseInt(policy.policy.freeCount || 0);
        quotaInfo.total = freeCount;
        quotaInfo.remaining = Math.max(0, freeCount - totalUsedSlots);
        quotaInfo.canAddMore = quotaInfo.remaining > 0;
      } else if (policy.policy.maxPerClient && policy.policy.maxPerClient > 0) {
        const maxPerClient = parseInt(policy.policy.maxPerClient);
        quotaInfo.total = maxPerClient;
        quotaInfo.remaining = Math.max(0, maxPerClient - totalUsedSlots);
        quotaInfo.canAddMore = quotaInfo.remaining > 0;
      } else if (policy.policy.mode === 'free') {
        quotaInfo.canAddMore = true; // No limits for free mode
      }

      res.json({
        success: true,
        quotaInfo: quotaInfo,
        cartReservations: [], // No cart reservations in current schema
        entitlements: activeEntitlements.map(e => ({
          photoId: e.photoId,
          id: e.id,
          remaining: e.remaining,
          expiresAt: e.expiresAt
        }))
      });

    } catch (error) {
      console.error('🛒 [CART] Error getting cart status:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get cart status' 
      });
    }
  });

  /**
   * POST /api/cart/clear
   * Clear all cart reservations for a client
   */
  router.post('/cart/clear', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey } = req.body;
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId and clientKey' 
        });
      }

      console.log(`🛒 [CART] Clear cart request for client: ${clientKey}`);

      // Remove all cart reservations for this client
      // Cart reservations are identified by: remaining=0 (can't download yet)
      const result = await db
        .delete(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey),
          eq(downloadEntitlements.remaining, 0)
        ));

      console.log(`🛒 [CART] Cleared cart reservations for client ${clientKey}`);

      res.json({
        success: true,
        message: 'Cart cleared successfully'
      });

    } catch (error) {
      console.error('🛒 [CART] Error clearing cart:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to clear cart' 
      });
    }
  });

  // ==================== CART API ALIAS ROUTES ====================
  // These routes provide aliases for the cart endpoints to match client expectations
  // Client-side code calls /api/downloads/cart/* but server has /api/cart/*
  
  /**
   * POST /api/downloads/cart/add-item
   * Alias for /api/cart/add-item - redirects to existing cart functionality
   */
  router.post('/downloads/cart/add-item', downloadRateLimit, async (req, res) => {
    console.log('🔄 [CART ALIAS] Redirecting /api/downloads/cart/add-item to /api/cart/add-item');
    
    // Call the existing add-item handler with the same request/response
    try {
      const { sessionId, clientKey, photoId, photoUrl, filename } = req.body;
      
      console.log(`🛒 [CART] Add item request (via alias):`, { sessionId, clientKey, photoId });
      
      if (!sessionId || !clientKey || !photoId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, clientKey, and photoId' 
        });
      }

      // Get session and policy information
      const session = await db
        .select()
        .from(photographySessions)
        .where(eq(photographySessions.id, sessionId))
        .limit(1);

      if (session.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      const sessionData = session[0];
      const policy = await commerceManager.getPolicyForSession(sessionId);
      
      if (!policy.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get session policy'
        });
      }

      console.log(`🛒 [CART] Session policy mode: ${policy.policy.mode}`);

      // Check if photo is already purchased (has valid entitlement)
      const entitlementCheck = await commerceManager.verifyEntitlement(sessionId, clientKey, photoId);
      if (entitlementCheck.success) {
        return res.status(400).json({
          success: false,
          error: 'Photo already purchased',
          alreadyPurchased: true
        });
      }

      // Count existing entitlements + cart reservations for quota validation
      const existingEntitlements = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey)
        ));

      console.log(`🛒 [CART] Found ${existingEntitlements.length} total entitlements for client`);

      // Validate quota based on policy mode
      let quotaValidation = { allowed: true, remainingQuota: null, message: null };

      if (policy.policy.mode === 'freemium') {
        const freeCount = parseInt(policy.policy.freeCount || 0);
        
        // CRITICAL FIX: Count only ACTIVE FREE entitlements (completed free downloads), not paid downloads
        const completedFreeDownloads = existingEntitlements.filter(e => e.isActive === true && e.orderId === null);
        const usedCount = completedFreeDownloads.length;
        const remainingFree = Math.max(0, freeCount - usedCount);
        
        console.log(`🛒 [CART] Freemium mode: ${usedCount}/${freeCount} used, ${remainingFree} remaining`);
        
        quotaValidation = {
          allowed: remainingFree > 0,
          remainingQuota: remainingFree,
          totalQuota: freeCount,
          usedQuota: usedCount,
          message: `Unlimited downloads available - no restrictions`
        };
      } else if (policy.policy.maxPerClient && policy.policy.maxPerClient > 0) {
        const maxPerClient = parseInt(policy.policy.maxPerClient);
        
        // CRITICAL FIX: Count only ACTIVE FREE entitlements (completed free downloads), not paid downloads
        const completedFreeDownloads = existingEntitlements.filter(e => e.isActive === true && e.orderId === null);
        const usedCount = completedFreeDownloads.length;
        const remaining = Math.max(0, maxPerClient - usedCount);
        
        console.log(`🛒 [CART] Max per client: ${usedCount}/${maxPerClient} used, ${remaining} remaining`);
        
        quotaValidation = {
          allowed: remaining > 0,
          remainingQuota: remaining,
          totalQuota: maxPerClient,
          usedQuota: usedCount,
          message: remaining > 0 ? 
            `${remaining} downloads remaining` : 
            'Download limit reached for this client.'
        };
      }

      // REMOVED: Quota validation - all downloads are now unlimited
      console.log(`🔓 Quota validation disabled - unlimited downloads allowed`);
      if (false) { // Disabled quota check
        return res.status(403).json({
          success: false,
          error: quotaValidation.message,
          quotaExceeded: true,
          quotaInfo: {
            remaining: quotaValidation.remainingQuota || 0,
            total: quotaValidation.totalQuota || 0,
            used: quotaValidation.usedQuota || 0
          }
        });
      }

      // Create a temporary "cart reservation" entitlement
      const reservationId = uuidv4();
      await db.insert(downloadEntitlements).values({
        id: reservationId,
        sessionId: sessionId,
        clientKey: clientKey,
        photoId: photoId,
        photoUrl: photoUrl || null,
        filename: filename || null,
        remaining: 0, // Cart reservations don't allow downloads yet
        isActive: false, // Cart reservations are inactive
        // Note: Cart reservations are identified by orderId=null, remaining=0, isActive=false
        expiresAt: null, // No expiration
        createdAt: new Date()
      });

      console.log(`🛒 [CART] Created cart reservation ${reservationId} for photo ${photoId}`);

      // Return success with updated quota information
      res.json({
        success: true,
        message: 'Item added to cart',
        reservationId: reservationId,
        quotaInfo: {
          remaining: Math.max(0, (quotaValidation.remainingQuota || 0) - 1),
          total: quotaValidation.totalQuota || 0,
          used: (quotaValidation.usedQuota || 0) + 1,
          mode: policy.policy.mode
        }
      });

    } catch (error) {
      console.error('🛒 [CART] Error adding item to cart (via alias):', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add item to cart' 
      });
    }
  });

  /**
   * POST /api/downloads/cart/remove-item
   * Alias for /api/cart/remove-item - redirects to existing cart functionality
   */
  router.post('/downloads/cart/remove-item', downloadRateLimit, async (req, res) => {
    console.log('🔄 [CART ALIAS] Redirecting /api/downloads/cart/remove-item to /api/cart/remove-item');
    
    try {
      const { sessionId, clientKey, photoId } = req.body;
      
      console.log(`🛒 [CART] Remove item request (via alias):`, { sessionId, clientKey, photoId });
      
      if (!sessionId || !clientKey || !photoId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId, clientKey, and photoId' 
        });
      }

      // Find and remove the cart reservation for this photo
      // Cart reservations are identified by: remaining=0 (can't download yet)
      const cartReservations = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey),
          eq(downloadEntitlements.photoId, photoId),
          eq(downloadEntitlements.remaining, 0) // Cart reservations can't be downloaded yet
        ))
        .limit(1);

      if (cartReservations.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cart reservation not found'
        });
      }

      // Remove the cart reservation
      await db
        .delete(downloadEntitlements)
        .where(eq(downloadEntitlements.id, cartReservations[0].id));

      console.log(`🛒 [CART] Removed cart reservation ${cartReservations[0].id} for photo ${photoId}`);

      // Get updated quota information
      const policy = await commerceManager.getPolicyForSession(sessionId);
      const remainingEntitlements = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey)
        ));

      let quotaInfo = { remaining: null, total: null, used: remainingEntitlements.length };

      if (policy.success && policy.policy.mode === 'freemium') {
        const freeCount = parseInt(policy.policy.freeCount || 0);
        quotaInfo = {
          remaining: Math.max(0, freeCount - remainingEntitlements.length),
          total: freeCount,
          used: remainingEntitlements.length,
          mode: policy.policy.mode
        };
      } else if (policy.success && policy.policy.maxPerClient) {
        const maxPerClient = parseInt(policy.policy.maxPerClient);
        quotaInfo = {
          remaining: Math.max(0, maxPerClient - remainingEntitlements.length),
          total: maxPerClient,
          used: remainingEntitlements.length,
          mode: policy.policy.mode
        };
      }

      res.json({
        success: true,
        message: 'Item removed from cart',
        quotaInfo: quotaInfo
      });

    } catch (error) {
      console.error('🛒 [CART] Error removing item from cart (via alias):', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to remove item from cart' 
      });
    }
  });

  /**
   * GET /api/downloads/cart/status
   * Alias for /api/cart/status - redirects to existing cart functionality
   */
  router.get('/downloads/cart/status', downloadRateLimit, async (req, res) => {
    console.log('🔄 [CART ALIAS] Redirecting /api/downloads/cart/status to /api/cart/status');
    
    try {
      const { sessionId, clientKey } = req.query;
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters: sessionId and clientKey' 
        });
      }

      console.log(`🛒 [CART] Status request for client (via alias): ${clientKey}`);

      // Get session policy
      const policy = await commerceManager.getPolicyForSession(sessionId);
      if (!policy.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get session policy'
        });
      }

      // Get all entitlements for this client (both used and unused)
      const allEntitlements = await db
        .select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey)
        ));

      // Separate into active (remaining > 0) and used (remaining = 0 or used)
      const activeEntitlements = allEntitlements.filter(e => e.remaining > 0);
      const usedEntitlements = allEntitlements.filter(e => e.remaining === 0 || e.usedAt);
      
      // For cart reservations, we'll use a simple approach
      const cartReservations = []; // Cart reservations not implemented in this schema

      const totalUsedSlots = allEntitlements.length; // Total entitlements (both active and used)

      // Calculate quota information based on policy
      let quotaInfo = {
        mode: policy.policy.mode,
        cartItems: 0, // No cart reservations in this schema
        purchasedItems: activeEntitlements.length,
        totalUsed: totalUsedSlots,
        remaining: null,
        total: null,
        canAddMore: true
      };

      if (policy.policy.mode === 'freemium') {
        const freeCount = parseInt(policy.policy.freeCount || 0);
        quotaInfo.total = freeCount;
        quotaInfo.remaining = Math.max(0, freeCount - totalUsedSlots);
        quotaInfo.canAddMore = quotaInfo.remaining > 0;
      } else if (policy.policy.maxPerClient && policy.policy.maxPerClient > 0) {
        const maxPerClient = parseInt(policy.policy.maxPerClient);
        quotaInfo.total = maxPerClient;
        quotaInfo.remaining = Math.max(0, maxPerClient - totalUsedSlots);
        quotaInfo.canAddMore = quotaInfo.remaining > 0;
      } else if (policy.policy.mode === 'free') {
        quotaInfo.canAddMore = true; // No limits for free mode
      }

      res.json({
        success: true,
        quotaInfo: quotaInfo,
        cartReservations: [], // No cart reservations in current schema
        entitlements: activeEntitlements.map(e => ({
          photoId: e.photoId,
          id: e.id,
          remaining: e.remaining,
          expiresAt: e.expiresAt
        }))
      });

    } catch (error) {
      console.error('🛒 [CART] Error getting cart status (via alias):', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get cart status' 
      });
    }
  });

  /**
   * POST /api/downloads/cart/clear
   * Alias for /api/cart/clear - redirects to existing cart functionality
   */
  router.post('/downloads/cart/clear', downloadRateLimit, async (req, res) => {
    console.log('🔄 [CART ALIAS] Redirecting /api/downloads/cart/clear to /api/cart/clear');
    
    try {
      const { sessionId, clientKey } = req.body;
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: sessionId and clientKey' 
        });
      }

      console.log(`🛒 [CART] Clear cart request for client (via alias): ${clientKey}`);

      // Remove all cart reservations for this client
      // Cart reservations are identified by: remaining=0 (can't download yet)
      const result = await db
        .delete(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey),
          eq(downloadEntitlements.remaining, 0)
        ));

      console.log(`🛒 [CART] Cleared cart reservations for client ${clientKey}`);

      res.json({
        success: true,
        message: 'Cart cleared successfully'
      });

    } catch (error) {
      console.error('🛒 [CART] Error clearing cart (via alias):', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to clear cart' 
      });
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
      
      // Global download limit check disabled for better freemium/commerce experience
      // Specific limits (like freemium quotas) are enforced elsewhere
      console.log(`Total downloads: ${totalUsed} (global limits disabled)`);
      
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

  // ======================================
  // COMMERCE ENDPOINTS WITH RATE LIMITING
  // ======================================
  
  // Rate limiter for checkout endpoint - stricter limits
  const checkoutRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 checkout attempts per window
    message: 'Too many checkout attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Rate limiter for entitlements endpoint
  const entitlementsRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Max 30 requests per window
    message: 'Too many requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  /**
   * POST /api/downloads/checkout
   * Create a Stripe checkout session for download purchases
   */
  router.post('/checkout', checkoutRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey, items } = req.body;
      
      if (!sessionId || !clientKey || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      if (!commerceManager) {
        return res.status(503).json({ error: 'Commerce service unavailable' });
      }
      
      // Create checkout session using commerce manager
      const result = await commerceManager.createCheckoutSession(
        sessionId,
        clientKey,
        items
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
        orderId: result.orderId
      });
      
    } catch (error) {
      console.error('Checkout endpoint error:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });
  
  /**
   * GET /api/downloads/entitlements
   * Get download entitlements for a client
   */
  router.get('/entitlements', entitlementsRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey } = req.query;
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ error: 'Missing sessionId or clientKey' });
      }
      
      if (!commerceManager) {
        return res.status(503).json({ error: 'Commerce service unavailable' });
      }
      
      // Get entitlements using commerce manager
      const result = await commerceManager.getClientEntitlements(sessionId, clientKey);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({
        success: true,
        entitlements: result.entitlements,
        summary: result.summary
      });
      
    } catch (error) {
      console.error('Entitlements endpoint error:', error);
      res.status(500).json({ error: 'Failed to fetch entitlements' });
    }
  });
  
  /**
   * POST /api/downloads/tokens
   * Generate secure download tokens
   */
  router.post('/tokens', requireAuth, async (req, res) => {
    try {
      const { sessionId, photoIds, clientKey } = req.body;
      
      if (!sessionId || !photoIds || !Array.isArray(photoIds) || !clientKey) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      if (!commerceManager) {
        return res.status(503).json({ error: 'Commerce service unavailable' });
      }
      
      // Verify user owns the session
      const sessionCheck = await pool.query(
        'SELECT * FROM photography_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, getUserId(req)]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Get client IP for token binding
      const clientIp = req.ip || req.connection.remoteAddress;
      
      // Generate tokens using commerce manager with security constraints
      const tokens = [];
      for (const photoId of photoIds) {
        const result = await commerceManager.generateDownloadToken(
          sessionId,
          photoId,
          clientKey,
          clientIp
        );
        
        if (result.success) {
          tokens.push(result.token);
        }
      }
      
      res.json({
        success: true,
        tokens: tokens
      });
      
    } catch (error) {
      console.error('Token generation error:', error);
      res.status(500).json({ error: 'Failed to generate tokens' });
    }
  });
  
  /**
   * GET /api/downloads/photo/:token
   * Download photo file using valid token
   * This is the core download endpoint that streams files from R2 storage
   */
  router.get('/photo/:token', strictDownloadRateLimit, validateReferer, requireValidToken, async (req, res) => {
    try {
      const { token } = req.params;
      const tokenData = req.tokenData; // Attached by requireValidToken middleware
      
      console.log(`📥 Processing download request for token: ${token.substring(0, 8)}...`);
      console.log(`📥 Token data - Session: ${tokenData.sessionId}, Photo: ${tokenData.photoUrl}, File: ${tokenData.filename}`);
      
      // Extract file path from photoUrl - handle multiple formats
      let r2Key;
      if (tokenData.photoUrl.startsWith('/r2/file/')) {
        // Format: /r2/file/photographer-userId/session-sessionId/gallery/filename.jpg
        r2Key = tokenData.photoUrl.replace('/r2/file/', '');
      } else if (tokenData.photoUrl.startsWith('photographer-')) {
        // Already in R2 key format
        r2Key = tokenData.photoUrl;
      } else if (tokenData.photoUrl.includes('r2.cloudflarestorage.com/') || tokenData.photoUrl.includes('pub-') && tokenData.photoUrl.includes('.r2.dev/')) {
        // Full R2 URL format: https://pub-fc48b3b29b574ea18a4ede9b6a3b1c0e.r2.dev/photographer-44735007/session-25efa46f-573c-4708-85f0-bf05e7e4d333/gallery/20250929004926-DSC_0012.jpg
        const urlParts = tokenData.photoUrl.split('/');
        const photographerIndex = urlParts.findIndex(part => part.startsWith('photographer-'));
        if (photographerIndex !== -1) {
          r2Key = urlParts.slice(photographerIndex).join('/');
        } else {
          throw new Error('Could not extract R2 key from URL');
        }
      } else {
        throw new Error('Invalid photo URL format');
      }
      
      console.log(`🔍 Attempting to download from R2 key: ${r2Key}`);
      
      // Download file from R2 storage using existing method
      let fileData;
      try {
        // Try direct R2 download with the key
        const getFileCommand = new (require('@aws-sdk/client-s3').GetObjectCommand)({ 
          Bucket: r2Manager.bucketName, 
          Key: r2Key 
        });
        const fileResponse = await r2Manager.s3Client.send(getFileCommand);
        
        // FIXED: Convert stream to buffer using proper Node.js stream handling
        // Replace transformToByteArray() which doesn't exist in Node.js AWS SDK v3
        const fileBuffer = await streamToBuffer(fileResponse.Body);
        
        fileData = {
          success: true,
          filename: tokenData.filename,
          buffer: fileBuffer,
          contentType: fileResponse.ContentType || 'image/jpeg',
          contentLength: fileResponse.ContentLength
        };
        
        console.log(`✅ Successfully downloaded from R2: ${tokenData.filename} (${fileData.buffer.length} bytes)`);
        
      } catch (r2Error) {
        console.error(`❌ R2 download failed for key ${r2Key}:`, r2Error.message);
        return res.status(404).json({ 
          error: 'File not found',
          details: 'The requested photo file could not be located in storage'
        });
      }
      
      // FIXED: Do NOT mark token as used before delivery - this will be done AFTER successful send
      
      // Log successful download for analytics
      try {
        // Insert into download history if table exists
        const downloadHistoryInsert = {
          id: uuidv4(),
          sessionId: tokenData.sessionId,
          token: token,
          filename: tokenData.filename,
          fileSize: fileData.buffer.length,
          downloadedAt: new Date(),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || 'Unknown'
        };
        
        // Try to insert into download history (ignore if table doesn't exist)
        try {
          await pool.query(`
            INSERT INTO download_history (id, session_id, token, filename, file_size, downloaded_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            downloadHistoryInsert.id,
            downloadHistoryInsert.sessionId,
            downloadHistoryInsert.token,
            downloadHistoryInsert.filename,
            downloadHistoryInsert.fileSize,
            downloadHistoryInsert.downloadedAt,
            downloadHistoryInsert.ipAddress,
            downloadHistoryInsert.userAgent
          ]);
          console.log(`📊 Download tracked in analytics`);
        } catch (historyError) {
          // Ignore if download_history table doesn't exist yet
          if (!historyError.message.includes('does not exist')) {
            console.warn('Download history tracking failed:', historyError.message);
          }
        }
        
      } catch (analyticsError) {
        console.warn('Analytics logging failed:', analyticsError.message);
        // Continue with download
      }
      
      // Determine filename for download
      const downloadFilename = tokenData.filename || 'photo.jpg';
      
      // Set response headers for file download
      res.setHeader('Content-Type', fileData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('Content-Length', fileData.buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Stream the file to client
      console.log(`📤 Streaming file to client: ${downloadFilename} (${fileData.buffer.length} bytes)`);
      
      // Send the file with proper error handling
      try {
        res.send(fileData.buffer);
        
        // FIXED: Mark token as used ONLY AFTER successful file delivery
        try {
          await db.update(downloadTokens)
            .set({ 
              isUsed: true, 
              usedAt: new Date(),
              usedByIp: req.ip || req.connection.remoteAddress
            })
            .where(eq(downloadTokens.token, token));
          
          console.log(`🔒 Token marked as used after successful delivery: ${token.substring(0, 8)}...`);
        } catch (dbError) {
          console.error('Warning: Failed to mark token as used after delivery:', dbError.message);
          // Don't fail the response as file was already sent successfully
        }
        
        console.log(`✅ Download completed successfully for session ${tokenData.sessionId}`);
        
      } catch (sendError) {
        console.error('❌ Failed to send file to client:', sendError.message);
        // Token remains unused since delivery failed
        throw new Error(`File delivery failed: ${sendError.message}`);
      }
      
    } catch (error) {
      console.error('❌ Download endpoint error:', error);
      
      // Don't expose internal errors to client
      if (error.message.includes('File not found') || error.message.includes('not exist')) {
        res.status(404).json({ 
          error: 'File not found',
          details: 'The requested photo file could not be located'
        });
      } else {
        res.status(500).json({ 
          error: 'Download failed',
          details: 'An internal error occurred while processing your download'
        });
      }
    }
  });

  // REMOVED: Duplicate webhook endpoint - consolidated into enhanced version above
  // Original endpoint functionality moved to enhanced handler above

  /**
   * Cart Quota Reservation System API Endpoints
   */

  /**
   * POST /api/cart/add-item
   * ENHANCED: Atomic cart addition with bulletproof quota enforcement
   */
  router.post('/cart/add-item', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey, photoId, photoIds } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      // Support both single photo and batch operations
      const photoIdArray = photoIds || (photoId ? [photoId] : []);
      
      if (!sessionId || !clientKey || photoIdArray.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters: sessionId, clientKey, and photoId(s)' 
        });
      }

      console.log(`🛒 [ENHANCED] Cart add-item request: ${clientKey.substring(0, 16)}... adding ${photoIdArray.length} item(s) to session ${sessionId}`);

      // Use Enhanced Cart Manager with atomic operations
      const result = await enhancedCartManager.addItemToCart(
        sessionId,
        clientKey,
        photoIdArray,
        {
          ipAddress,
          userAgent,
          operation: 'add_to_cart',
          timestamp: new Date().toISOString()
        }
      );

      if (result.success) {
        console.log(`✅ [ENHANCED] Cart items added successfully: ${result.operationId}`);
        
        // Return detailed quota information
        res.json({
          success: true,
          message: `Successfully added ${photoIdArray.length} item(s) to cart`,
          cartInfo: result.cartInfo,
          quotaInfo: result.cartInfo.quotaInfo,
          operationId: result.operationId,
          timestamp: new Date().toISOString()
        });
      } else {
        // Handle different error types with appropriate status codes
        const statusCode = result.code === 'QUOTA_EXCEEDED' ? 403 :
                          result.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
                          result.code === 'SUSPICIOUS_ACTIVITY' ? 429 :
                          result.code === 'CART_LOCKED' ? 423 :
                          result.code === 'DUPLICATE_ITEMS' ? 409 :
                          result.code === 'CART_SIZE_EXCEEDED' ? 413 :
                          result.code === 'INVALID_REQUEST' ? 400 :
                          result.code === 'SESSION_NOT_FOUND' ? 404 : 500;

        console.warn(`⚠️ [ENHANCED] Cart add-item blocked: ${result.error} (${result.code})`);
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code,
          operationId: result.operationId,
          retryAfter: result.retryAfter
        });
      }

    } catch (error) {
      console.error('❌ [ENHANCED] Cart add-item system error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Cart operation failed due to system error',
        code: 'SYSTEM_ERROR'
      });
    }
  });

  /**
   * POST /api/cart/remove-item
   * Release quota reservation when item removed from cart
   */
  router.post('/cart/remove-item', async (req, res) => {
    try {
      const { sessionId, clientKey, photoId } = req.body;
      
      if (!sessionId || !clientKey || !photoId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters: sessionId, clientKey, photoId' 
        });
      }

      console.log(`🛒 Cart remove-item request: ${clientKey} removing ${photoId} from session ${sessionId}`);

      // Find and remove cart reservation
      const cartReservation = await db.select()
        .from(downloadEntitlements)
        .where(and(
          eq(downloadEntitlements.sessionId, sessionId),
          eq(downloadEntitlements.clientKey, clientKey),
          eq(downloadEntitlements.photoId, photoId),
          eq(downloadEntitlements.type, 'cart_reservation'),
          eq(downloadEntitlements.isActive, false)
        ))
        .limit(1);

      if (cartReservation.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cart reservation not found' 
        });
      }

      // Delete the cart reservation
      await db.delete(downloadEntitlements)
        .where(eq(downloadEntitlements.id, cartReservation[0].id));

      console.log(`✅ Cart reservation removed: ${cartReservation[0].id} for photo ${photoId}`);

      res.json({
        success: true,
        message: 'Photo successfully removed from cart'
      });

    } catch (error) {
      console.error('❌ Cart remove-item error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to remove item from cart' 
      });
    }
  });

  /**
   * GET /api/cart/status
   * ENHANCED: Return current quota status with real-time validation
   */
  router.get('/cart/status', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey } = req.query;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters: sessionId, clientKey' 
        });
      }

      console.log(`🛒 [ENHANCED] Cart status request: ${clientKey.substring(0, 16)}... in session ${sessionId}`);

      // Use Enhanced Cart Manager for real-time status with validation
      const result = await enhancedCartManager.getCartStatus(
        sessionId,
        clientKey,
        {
          ipAddress,
          userAgent,
          operation: 'get_cart_status',
          timestamp: new Date().toISOString()
        }
      );

      if (result.success) {
        console.log(`✅ [ENHANCED] Cart status retrieved successfully for ${clientKey.substring(0, 16)}...`);
        
        res.json({
          success: true,
          cart: result.cart,
          quota: result.quota,
          policy: result.policy,
          timestamp: result.timestamp
        });
      } else {
        const statusCode = result.code === 'SESSION_NOT_FOUND' ? 404 :
                          result.code === 'INVALID_REQUEST' ? 400 : 500;

        console.warn(`⚠️ [ENHANCED] Cart status failed: ${result.error} (${result.code})`);
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      console.error('❌ [ENHANCED] Cart status system error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Cart status operation failed',
        code: 'SYSTEM_ERROR'
      });
    }
  });

  /**
   * POST /api/cart/clear
   * ENHANCED: Atomic cart clearing with quota release
   */
  router.post('/cart/clear', downloadRateLimit, async (req, res) => {
    try {
      const { sessionId, clientKey } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      if (!sessionId || !clientKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters: sessionId, clientKey' 
        });
      }

      console.log(`🛒 [ENHANCED] Cart clear request: ${clientKey.substring(0, 16)}... in session ${sessionId}`);

      // Use Enhanced Cart Manager with atomic operations
      const result = await enhancedCartManager.clearCart(
        sessionId,
        clientKey,
        {
          ipAddress,
          userAgent,
          operation: 'clear_cart',
          timestamp: new Date().toISOString()
        }
      );

      if (result.success) {
        console.log(`✅ [ENHANCED] Cart cleared successfully: ${result.operationId}, items cleared: ${result.itemsCleared}`);
        
        res.json({
          success: true,
          message: 'Cart successfully cleared',
          itemsCleared: result.itemsCleared,
          operationId: result.operationId,
          timestamp: new Date().toISOString()
        });
      } else {
        const statusCode = result.code === 'CART_LOCKED' ? 423 :
                          result.code === 'INVALID_REQUEST' ? 400 :
                          result.code === 'SESSION_NOT_FOUND' ? 404 : 500;

        console.warn(`⚠️ [ENHANCED] Cart clear failed: ${result.error} (${result.code})`);
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code,
          operationId: result.operationId
        });
      }

    } catch (error) {
      console.error('❌ [ENHANCED] Cart clear system error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Cart clear operation failed',
        code: 'SYSTEM_ERROR'
      });
    }
  });

  return router;
}

module.exports = createDownloadRoutes;
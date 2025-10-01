/**
 * Unified Download Service API
 * 
 * Provides a clean separation of concerns for handling three distinct pricing models:
 * - FREE: Unlimited downloads at no cost
 * - FREEMIUM: Limited free downloads, then paid
 * - PAID: All downloads require payment
 * 
 * Integrates with existing R2 storage, Stripe payments, and watermarking systems
 * while maintaining backward compatibility with the gallery_access_token system.
 */

const crypto = require('crypto');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, count, sum, gte, lte, sql } = require('drizzle-orm');
const { 
  photographySessions, 
  downloadPolicies,
  downloadEntitlements,
  downloadHistory,
  downloadTokens,
  users 
} = require('../shared/schema');

// Import existing managers
const R2FileManager = require('./r2-file-manager');
const DownloadCommerceManager = require('./download-commerce');
const PreviewGenerationService = require('./preview-generation');

class DownloadService {
  constructor(pool = null) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.db = drizzle(this.pool);
    this.r2Manager = new R2FileManager(null, this.pool);
    this.commerceManager = new DownloadCommerceManager();
    this.previewService = new PreviewGenerationService(this.pool);
    
    // Service configuration
    this.config = {
      // tokenExpirationTime: null, // DISABLED - tokens do not expire
      maxDownloadsPerHour: 50,
      maxBulkDownloadSize: 100,
      supportedImageFormats: ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'],
      defaultWatermarkSettings: {
        opacity: 60,
        position: 'bottom-right',
        scale: 20
      },
      security: {
        maxRequestsPerMinute: 10,
        suspiciousActivityThreshold: 5,
        ipWhitelist: [],
        rateLimitWindow: 60 * 1000 // 1 minute
      }
    };
    
    // Security tracking
    this.requestTracking = new Map();
    this.suspiciousActivity = new Map();
    
    console.log('✅ DownloadService initialized with existing infrastructure integration');
  }

  /**
   * AUTHORITATIVE CLIENT KEY GENERATION
   * Maintains compatibility with existing gallery access system
   */
  generateGalleryClientKey(galleryAccessToken, sessionId) {
    if (!galleryAccessToken || !sessionId) {
      throw new Error('Gallery token and session ID are required for client key generation');
    }
    
    const baseString = `${galleryAccessToken}-${sessionId}`;
    const clientKey = `gallery-${crypto.createHash('sha256').update(baseString).digest('hex').substring(0, 16)}`;
    
    console.log(`🔑 Generated client key: ${clientKey} for gallery token: ${galleryAccessToken.substring(0, 8)}...`);
    return clientKey;
  }

  /**
   * SECURITY AND RATE LIMITING
   */
  
  async checkRateLimit(clientIp, sessionId) {
    try {
      const currentTime = Date.now();
      const windowStart = currentTime - this.config.security.rateLimitWindow;
      
      // Clean old entries
      for (const [key, data] of this.requestTracking.entries()) {
        if (data.firstRequest < windowStart) {
          this.requestTracking.delete(key);
        }
      }
      
      const trackingKey = `${clientIp}_${sessionId}`;
      const existingTracking = this.requestTracking.get(trackingKey);
      
      if (existingTracking) {
        if (existingTracking.count >= this.config.security.maxRequestsPerMinute) {
          // Record suspicious activity
          this.recordSuspiciousActivity(clientIp, 'rate_limit_exceeded', { sessionId });
          
          return {
            allowed: false,
            error: 'Rate limit exceeded. Please slow down your requests.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((existingTracking.firstRequest + this.config.security.rateLimitWindow - currentTime) / 1000)
          };
        }
        
        existingTracking.count++;
        existingTracking.lastRequest = currentTime;
      } else {
        this.requestTracking.set(trackingKey, {
          count: 1,
          firstRequest: currentTime,
          lastRequest: currentTime
        });
      }
      
      return { allowed: true };
      
    } catch (error) {
      console.error('❌ Rate limit check failed:', error);
      // Fail open for availability, but log the issue
      return { allowed: true };
    }
  }
  
  recordSuspiciousActivity(clientIp, type, details = {}) {
    try {
      const currentTime = Date.now();
      const activity = this.suspiciousActivity.get(clientIp) || {
        count: 0,
        firstSeen: currentTime,
        events: []
      };
      
      activity.count++;
      activity.lastSeen = currentTime;
      activity.events.push({
        type,
        timestamp: currentTime,
        details
      });
      
      // Keep only last 10 events
      if (activity.events.length > 10) {
        activity.events = activity.events.slice(-10);
      }
      
      this.suspiciousActivity.set(clientIp, activity);
      
      // Log high-frequency suspicious activity
      if (activity.count >= this.config.security.suspiciousActivityThreshold) {
        console.warn(`🚨 Suspicious activity detected from IP ${clientIp}: ${activity.count} events since ${new Date(activity.firstSeen).toISOString()}`);
        console.warn(`   Recent events:`, activity.events.slice(-3));
      }
      
    } catch (error) {
      console.error('❌ Failed to record suspicious activity:', error);
    }
  }
  
  async validateSessionSecurity(sessionId, clientIp, userAgent) {
    try {
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /bot|crawler|spider|scraper/i,
        /automated|script|curl|wget/i,
        /test|probe|scan/i
      ];
      
      const isSuspiciousUserAgent = suspiciousPatterns.some(pattern => 
        pattern.test(userAgent || '')
      );
      
      if (isSuspiciousUserAgent) {
        this.recordSuspiciousActivity(clientIp, 'suspicious_user_agent', { userAgent });
        console.warn(`⚠️ Suspicious user agent detected: ${userAgent}`);
      }
      
      // Check rate limiting
      const rateLimitResult = await this.checkRateLimit(clientIp, sessionId);
      if (!rateLimitResult.allowed) {
        return rateLimitResult;
      }
      
      return { allowed: true, warnings: isSuspiciousUserAgent ? ['suspicious_user_agent'] : [] };
      
    } catch (error) {
      console.error('❌ Session security validation failed:', error);
      return { allowed: true }; // Fail open for availability
    }
  }

  /**
   * WATERMARKING LOGIC BASED ON PRICING MODEL RULES
   */
  
  determineWatermarkPolicy(pricingModel, isFreeTier = false) {
    const policies = {
      free: {
        shouldWatermark: true,
        watermarkType: 'standard',
        reason: 'Free downloads typically include watermarks for brand protection'
      },
      freemium: {
        shouldWatermark: isFreeTier,
        watermarkType: isFreeTier ? 'standard' : 'none',
        reason: isFreeTier 
          ? 'Free tier downloads include watermarks' 
          : 'Paid downloads after free limit have no watermarks'
      },
      paid: {
        shouldWatermark: false,
        watermarkType: 'none',
        reason: 'Paid downloads do not include watermarks'
      }
    };

    return policies[pricingModel] || policies.free;
  }
  
  async applyDownloadWatermark(photoBuffer, sessionId, pricingModel, isFreeTier = false) {
    try {
      const watermarkPolicy = this.determineWatermarkPolicy(pricingModel, isFreeTier);
      
      if (!watermarkPolicy.shouldWatermark) {
        console.log(`🚫 No watermark needed for ${pricingModel} download (paid tier)`);
        return {
          success: true,
          processedBuffer: photoBuffer,
          watermarkApplied: false,
          reason: watermarkPolicy.reason
        };
      }
      
      // Get session watermark settings
      const watermarkSettings = await this.previewService.getSessionWatermarkSettings(sessionId);
      
      if (!watermarkSettings.watermarkEnabled) {
        console.log(`🚫 Watermarks disabled for session ${sessionId}`);
        return {
          success: true,
          processedBuffer: photoBuffer,
          watermarkApplied: false,
          reason: 'Watermarks disabled for this session'
        };
      }
      
      // Apply watermark using preview service
      const watermarkResult = await this.previewService.generateWatermarkedPreview(
        photoBuffer, 
        'download_image.jpg', // filename for processing
        sessionId,
        null, // userId not needed for watermarking
        pricingModel
      );
      
      if (!watermarkResult.success) {
        throw new Error(`Watermark processing failed: ${watermarkResult.error}`);
      }
      
      const processedImage = watermarkResult.buffer;
      
      console.log(`💧 Applied ${watermarkSettings.watermarkType} watermark for ${pricingModel} download`);
      
      return {
        success: true,
        processedBuffer: processedImage,
        watermarkApplied: true,
        watermarkType: watermarkSettings.watermarkType,
        settings: watermarkSettings,
        reason: watermarkPolicy.reason
      };
      
    } catch (error) {
      console.error('❌ Watermark application failed:', error);
      
      // Return original buffer if watermarking fails (graceful degradation)
      return {
        success: false,
        processedBuffer: photoBuffer,
        watermarkApplied: false,
        error: error.message,
        reason: 'Watermark processing failed, returned original image'
      };
    }
  }

  /**
   * VALIDATION AND AUTHENTICATION
   */
  async validateGalleryAccess(galleryAccessToken, sessionId) {
    try {
      if (!galleryAccessToken || !sessionId) {
        return {
          success: false,
          error: 'Missing gallery access token or session ID',
          code: 'MISSING_CREDENTIALS'
        };
      }

      // Verify session exists and gallery access is valid
      const session = await this.db.select()
        .from(photographySessions)
        .where(eq(photographySessions.id, sessionId))
        .limit(1);

      if (session.length === 0) {
        return {
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        };
      }

      const sessionData = session[0];

      // Verify gallery access token matches
      if (sessionData.galleryAccessToken !== galleryAccessToken) {
        return {
          success: false,
          error: 'Invalid gallery access token',
          code: 'INVALID_TOKEN'
        };
      }

      // Check if gallery access has expired
      if (sessionData.galleryExpiresAt && new Date() > sessionData.galleryExpiresAt) {
        return {
          success: false,
          error: 'Gallery access has expired',
          code: 'EXPIRED_ACCESS'
        };
      }

      // Generate client key for this session
      const clientKey = this.generateGalleryClientKey(galleryAccessToken, sessionId);

      return {
        success: true,
        session: sessionData,
        clientKey: clientKey
      };

    } catch (error) {
      console.error('❌ Error validating gallery access:', error);
      return {
        success: false,
        error: 'Authentication validation failed',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * RESOLVE SESSION FROM GALLERY TOKEN ONLY
   * This method resolves the session ID and data from just the galleryAccessToken
   * Solves circular dependency where client needs session ID to validate access
   */
  async resolveSessionFromGalleryToken(galleryAccessToken) {
    try {
      if (!galleryAccessToken) {
        return {
          success: false,
          error: 'Missing gallery access token',
          code: 'MISSING_CREDENTIALS'
        };
      }

      // Find session by gallery access token
      const session = await this.db.select()
        .from(photographySessions)
        .where(eq(photographySessions.galleryAccessToken, galleryAccessToken))
        .limit(1);

      if (session.length === 0) {
        return {
          success: false,
          error: 'Gallery access token not found',
          code: 'INVALID_TOKEN'
        };
      }

      const sessionData = session[0];

      // Check if gallery access has expired
      if (sessionData.galleryExpiresAt && new Date() > sessionData.galleryExpiresAt) {
        return {
          success: false,
          error: 'Gallery access has expired',
          code: 'EXPIRED_ACCESS'
        };
      }

      // Generate client key for this session
      const clientKey = this.generateGalleryClientKey(galleryAccessToken, sessionData.id);

      return {
        success: true,
        session: sessionData,
        clientKey: clientKey
      };

    } catch (error) {
      console.error('❌ Error resolving session from gallery token:', error);
      return {
        success: false,
        error: 'Session resolution failed',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * GET DOWNLOAD POLICY FOR SESSION
   */
  async getSessionPolicy(sessionId) {
    try {
      const policyResult = await this.commerceManager.getPolicyForSession(sessionId);
      
      if (!policyResult.success) {
        return {
          success: false,
          error: 'Failed to retrieve session policy',
          code: 'POLICY_ERROR'
        };
      }

      return {
        success: true,
        policy: policyResult.policy
      };

    } catch (error) {
      console.error('❌ Error getting session policy:', error);
      return {
        success: false,
        error: 'Policy retrieval failed',
        code: 'POLICY_ERROR'
      };
    }
  }

  /**
   * FREE DOWNLOAD HANDLER
   * Handles unlimited free downloads with optional watermarking
   */
  async handleFreeDownload(params) {
    const { 
      galleryAccessToken, 
      sessionId, 
      photoId, 
      photoUrl, 
      filename,
      clientIp = null,
      userAgent = null
    } = params;

    try {
      console.log(`🆓 Processing FREE download for photo: ${photoId}`);

      // Step 1: Validate gallery access
      const authResult = await this.validateGalleryAccess(galleryAccessToken, sessionId);
      if (!authResult.success) {
        return authResult;
      }

      const { session, clientKey } = authResult;

      // Step 2: Verify this is a free session
      const policyResult = await this.getSessionPolicy(sessionId);
      if (!policyResult.success) {
        return policyResult;
      }

      if (policyResult.policy.mode !== 'free') {
        return {
          success: false,
          error: 'Session is not configured for free downloads',
          code: 'INVALID_PRICING_MODEL'
        };
      }

      // Step 3: Create entitlement for free download
      const entitlementResult = await this.commerceManager.createFreeEntitlements(
        sessionId, 
        clientKey, 
        [{ photoId }]
      );

      if (!entitlementResult.success) {
        return {
          success: false,
          error: entitlementResult.error,
          code: 'ENTITLEMENT_ERROR'
        };
      }

      // Step 4: Issue download token
      const tokenResult = await this.commerceManager.issueDownloadToken(
        sessionId,
        clientKey,
        photoId,
        photoUrl,
        filename
      );

      if (!tokenResult.success) {
        return {
          success: false,
          error: tokenResult.error,
          code: 'TOKEN_ERROR'
        };
      }

      // Step 5: Log the download activity
      await this.logDownloadActivity({
        sessionId,
        clientKey,
        photoId,
        pricing: 'free',
        amount: 0,
        clientIp,
        userAgent,
        status: 'completed'
      });

      console.log(`✅ FREE download processed successfully: ${photoId}`);

      return {
        success: true,
        downloadToken: tokenResult.token,
        expiresIn: tokenResult.expiresIn,
        pricing: {
          model: 'free',
          cost: 0,
          currency: 'USD'
        },
        watermark: session.watermarkEnabled ? {
          enabled: true,
          type: session.watermarkType,
          settings: {
            opacity: session.watermarkOpacity,
            position: session.watermarkPosition,
            scale: session.watermarkScale,
            text: session.watermarkText,
            logoUrl: session.watermarkLogoUrl
          }
        } : { enabled: false }
      };

    } catch (error) {
      console.error('❌ Error in handleFreeDownload:', error);
      
      // Log failed attempt
      await this.logDownloadActivity({
        sessionId,
        clientKey: null,
        photoId,
        pricing: 'free',
        amount: 0,
        clientIp,
        userAgent,
        status: 'failed',
        error: error.message
      });

      return {
        success: false,
        error: 'Free download processing failed',
        code: 'PROCESSING_ERROR'
      };
    }
  }

  /**
   * FREEMIUM DOWNLOAD HANDLER
   * Handles limited free downloads, then requires payment
   */
  async handleFreemiumDownload(params) {
    const { 
      galleryAccessToken, 
      sessionId, 
      photoId, 
      photoUrl, 
      filename,
      clientIp = null,
      userAgent = null
    } = params;

    try {
      console.log(`🎁 Processing FREEMIUM download for photo: ${photoId}`);

      // Step 1: Validate gallery access
      const authResult = await this.validateGalleryAccess(galleryAccessToken, sessionId);
      if (!authResult.success) {
        return authResult;
      }

      const { session, clientKey } = authResult;

      // Step 2: Verify this is a freemium or free session
      const policyResult = await this.getSessionPolicy(sessionId);
      if (!policyResult.success) {
        return policyResult;
      }

      const policy = policyResult.policy;
      if (policy.mode !== 'freemium' && policy.mode !== 'free') {
        return {
          success: false,
          error: 'Session is not configured for freemium or free downloads',
          code: 'INVALID_PRICING_MODEL'
        };
      }

      // For FREE mode, skip quota checks and create unlimited free entitlements
      if (policy.mode === 'free') {
        console.log(`🆓 Processing FREE mode download - unlimited downloads allowed`);
        
        // Create free entitlement immediately without quota checks
        const entitlementResult = await this.commerceManager.createFreeEntitlements(
          sessionId, 
          clientKey, 
          [{ photoId }]
        );

        if (!entitlementResult.success) {
          return {
            success: false,
            error: entitlementResult.error,
            code: 'ENTITLEMENT_ERROR'
          };
        }

        // Issue download token
        const tokenResult = await this.commerceManager.issueDownloadToken(
          sessionId,
          clientKey,
          photoId,
          photoUrl,
          filename
        );

        if (!tokenResult.success) {
          return {
            success: false,
            error: tokenResult.error,
            code: 'TOKEN_ERROR'
          };
        }

        // Log the free download
        await this.logDownloadActivity({
          sessionId,
          clientKey,
          photoId,
          pricing: 'free_unlimited',
          amount: 0,
          clientIp,
          userAgent,
          status: 'completed'
        });

        console.log(`✅ FREE unlimited download processed: ${photoId}`);

        return {
          success: true,
          downloadToken: tokenResult.token,
          expiresIn: tokenResult.expiresIn,
          pricing: {
            model: 'free',
            tier: 'unlimited',
            cost: 0,
            currency: 'USD',
            quota: {
              used: 0,
              limit: 999999,
              remaining: 999999
            }
          },
          watermark: session.watermarkEnabled ? {
            enabled: true,
            type: session.watermarkType,
            settings: {
              opacity: session.watermarkOpacity,
              position: session.watermarkPosition,
              scale: session.watermarkScale,
              text: session.watermarkText,
              logoUrl: session.watermarkLogoUrl
            }
          } : { enabled: false }
        };
      }

      // Step 3: Check current download count for this client
      const entitlementsResult = await this.commerceManager.getClientEntitlements(sessionId, clientKey);
      if (!entitlementsResult.success) {
        return {
          success: false,
          error: 'Failed to check download quota',
          code: 'QUOTA_CHECK_ERROR'
        };
      }

      const currentDownloads = entitlementsResult.entitlements.length;
      const freeLimit = parseInt(policy.freeCount) || 0;
      const remainingFree = Math.max(0, freeLimit - currentDownloads);

      console.log(`📊 Freemium quota check: ${currentDownloads}/${freeLimit} used, ${remainingFree} remaining`);

      // Step 4: Handle free or paid download based on quota
      if (remainingFree > 0) {
        // Still within free limit - create free entitlement
        const entitlementResult = await this.commerceManager.createFreeEntitlements(
          sessionId, 
          clientKey, 
          [{ photoId }]
        );

        if (!entitlementResult.success) {
          return {
            success: false,
            error: entitlementResult.error,
            code: 'ENTITLEMENT_ERROR'
          };
        }

        // Issue download token
        const tokenResult = await this.commerceManager.issueDownloadToken(
          sessionId,
          clientKey,
          photoId,
          photoUrl,
          filename
        );

        if (!tokenResult.success) {
          return {
            success: false,
            error: tokenResult.error,
            code: 'TOKEN_ERROR'
          };
        }

        // Log the free download
        await this.logDownloadActivity({
          sessionId,
          clientKey,
          photoId,
          pricing: 'freemium_free',
          amount: 0,
          clientIp,
          userAgent,
          status: 'completed'
        });

        console.log(`✅ FREEMIUM free download processed: ${photoId} (${remainingFree - 1} free remaining)`);

        return {
          success: true,
          downloadToken: tokenResult.token,
          expiresIn: tokenResult.expiresIn,
          pricing: {
            model: 'freemium',
            tier: 'free',
            cost: 0,
            currency: 'USD',
            quota: {
              used: currentDownloads + 1,
              limit: freeLimit,
              remaining: remainingFree - 1
            }
          },
          watermark: session.watermarkEnabled ? {
            enabled: true,
            type: session.watermarkType,
            settings: {
              opacity: session.watermarkOpacity,
              position: session.watermarkPosition,
              scale: session.watermarkScale,
              text: session.watermarkText,
              logoUrl: session.watermarkLogoUrl
            }
          } : { enabled: false }
        };

      } else {
        // Free limit exceeded - require payment
        const pricePerPhoto = parseFloat(policy.pricePerPhoto) || 0;
        
        console.log(`💰 Free limit exceeded, payment required: $${pricePerPhoto}`);

        return {
          success: false,
          error: 'Free download limit exceeded. Payment required.',
          code: 'PAYMENT_REQUIRED',
          paymentInfo: {
            required: true,
            amount: pricePerPhoto,
            currency: policy.currency || 'USD',
            photoId: photoId,
            quota: {
              used: currentDownloads,
              limit: freeLimit,
              remaining: 0
            }
          }
        };
      }

    } catch (error) {
      console.error('❌ Error in handleFreemiumDownload:', error);
      
      // Log failed attempt
      await this.logDownloadActivity({
        sessionId,
        clientKey: null,
        photoId,
        pricing: 'freemium',
        amount: 0,
        clientIp,
        userAgent,
        status: 'failed',
        error: error.message
      });

      return {
        success: false,
        error: 'Freemium download processing failed',
        code: 'PROCESSING_ERROR'
      };
    }
  }

  /**
   * PAID DOWNLOAD HANDLER
   * Handles downloads that require payment for each photo
   */
  async handlePaidDownload(params) {
    const { 
      galleryAccessToken, 
      sessionId, 
      photoId, 
      photoUrl, 
      filename,
      paymentIntentId = null,
      clientIp = null,
      userAgent = null
    } = params;

    try {
      console.log(`💰 Processing PAID download for photo: ${photoId}`);

      // Step 1: Validate gallery access
      const authResult = await this.validateGalleryAccess(galleryAccessToken, sessionId);
      if (!authResult.success) {
        return authResult;
      }

      const { session, clientKey } = authResult;

      // Step 2: Verify this is a paid session
      const policyResult = await this.getSessionPolicy(sessionId);
      if (!policyResult.success) {
        return policyResult;
      }

      const policy = policyResult.policy;
      if (!['per_photo', 'fixed'].includes(policy.mode)) {
        return {
          success: false,
          error: 'Session is not configured for paid downloads',
          code: 'INVALID_PRICING_MODEL'
        };
      }

      const pricePerPhoto = parseFloat(policy.pricePerPhoto) || 0;
      if (pricePerPhoto <= 0) {
        return {
          success: false,
          error: 'Invalid pricing configuration',
          code: 'INVALID_PRICE'
        };
      }

      // Step 3: If paymentIntentId provided, verify payment
      if (paymentIntentId) {
        const paymentResult = await this.commerceManager.verifyPayment(paymentIntentId, {
          sessionId,
          photoId,
          expectedAmount: pricePerPhoto,
          currency: policy.currency || 'USD'
        });

        if (!paymentResult.success) {
          return {
            success: false,
            error: paymentResult.error,
            code: 'PAYMENT_VERIFICATION_FAILED'
          };
        }

        // Create paid entitlement
        const entitlementResult = await this.commerceManager.createPaidEntitlement({
          sessionId,
          clientKey,
          photoId,
          amount: pricePerPhoto,
          currency: policy.currency || 'USD',
          paymentIntentId,
          orderId: paymentResult.orderId
        });

        if (!entitlementResult.success) {
          return {
            success: false,
            error: entitlementResult.error,
            code: 'ENTITLEMENT_ERROR'
          };
        }

        // Issue download token
        const tokenResult = await this.commerceManager.issueDownloadToken(
          sessionId,
          clientKey,
          photoId,
          photoUrl,
          filename
        );

        if (!tokenResult.success) {
          return {
            success: false,
            error: tokenResult.error,
            code: 'TOKEN_ERROR'
          };
        }

        // Log the paid download
        await this.logDownloadActivity({
          sessionId,
          clientKey,
          photoId,
          pricing: 'paid',
          amount: pricePerPhoto,
          currency: policy.currency || 'USD',
          paymentIntentId,
          clientIp,
          userAgent,
          status: 'completed'
        });

        console.log(`✅ PAID download processed: ${photoId} ($${pricePerPhoto})`);

        return {
          success: true,
          downloadToken: tokenResult.token,
          expiresIn: tokenResult.expiresIn,
          pricing: {
            model: 'paid',
            cost: pricePerPhoto,
            currency: policy.currency || 'USD',
            paymentIntentId: paymentIntentId
          },
          watermark: { enabled: false } // Paid downloads typically don't have watermarks
        };

      } else {
        // No payment provided - return payment requirement
        console.log(`💳 Payment required for download: $${pricePerPhoto}`);

        return {
          success: false,
          error: 'Payment required for download',
          code: 'PAYMENT_REQUIRED',
          paymentInfo: {
            required: true,
            amount: pricePerPhoto,
            currency: policy.currency || 'USD',
            photoId: photoId,
            sessionId: sessionId
          }
        };
      }

    } catch (error) {
      console.error('❌ Error in handlePaidDownload:', error);
      
      // Log failed attempt
      await this.logDownloadActivity({
        sessionId,
        clientKey: null,
        photoId,
        pricing: 'paid',
        amount: 0,
        clientIp,
        userAgent,
        status: 'failed',
        error: error.message
      });

      return {
        success: false,
        error: 'Paid download processing failed',
        code: 'PROCESSING_ERROR'
      };
    }
  }

  /**
   * UNIFIED DOWNLOAD PROCESSOR
   * Routes to appropriate handler based on session policy
   */
  async processDownload(params) {
    try {
      const { galleryAccessToken, sessionId, photoId, clientIp, userAgent, paymentIntentId } = params;
      
      console.log(`🎯 Processing download for photo ${photoId} in session ${sessionId}`);

      // Get session policy to determine pricing model
      const authResult = await this.validateGalleryAccess(galleryAccessToken, sessionId);
      if (!authResult.success) {
        return authResult;
      }

      const policyResult = await this.getSessionPolicy(sessionId);
      if (!policyResult.success) {
        return policyResult;
      }

      const policy = policyResult.policy;
      const { session, clientKey } = authResult;

      console.log(`📋 Session policy mode: ${policy.mode} for session ${sessionId}`);

      // Check if photo already has entitlement
      const entitlementCheck = await this.commerceManager.verifyEntitlement(sessionId, clientKey, photoId);
      if (entitlementCheck.success) {
        console.log(`✅ Existing entitlement found for photo ${photoId}`);
        
        // Issue download token for existing entitlement
        const tokenResult = await this.commerceManager.issueDownloadToken(
          sessionId,
          clientKey,
          photoId,
          params.photoUrl,
          params.filename
        );

        if (tokenResult.success) {
          return {
            success: true,
            downloadToken: tokenResult.token,
            expiresIn: tokenResult.expiresIn,
            pricing: {
              model: policy.mode,
              cost: 0, // Already paid
              currency: policy.currency || 'USD',
              reason: 'existing_entitlement'
            }
          };
        }
      }

      // Route to appropriate handler based on pricing model
      switch (policy.mode) {
        case 'free':
          console.log(`🆓 Processing as FREE download`);
          return await this.handleFreeDownload(params);
        
        case 'freemium':
          console.log(`🎁 Processing as FREEMIUM download`);
          return await this.handleFreemiumDownload(params);
        
        case 'per_photo':
        case 'fixed':
        case 'paid':
          console.log(`💰 Processing as PAID download`);
          return await this.handlePaidDownload(params);
        
        default:
          console.warn(`⚠️ Unsupported pricing model: ${policy.mode}`);
          return {
            success: false,
            error: `Unsupported pricing model: ${policy.mode}`,
            code: 'UNSUPPORTED_PRICING_MODEL'
          };
      }

    } catch (error) {
      console.error('❌ Error in processDownload:', error);
      return {
        success: false,
        error: 'Download processing failed',
        code: 'PROCESSING_ERROR'
      };
    }
  }

  /**
   * LOGGING AND AUDIT TRAIL
   */
  async logDownloadActivity(activity) {
    try {
      const logEntry = {
        sessionId: activity.sessionId,
        clientKey: activity.clientKey,
        photoId: activity.photoId,
        pricing: activity.pricing,
        amount: activity.amount || 0,
        currency: activity.currency || 'USD',
        paymentIntentId: activity.paymentIntentId || null,
        clientIp: activity.clientIp,
        userAgent: activity.userAgent,
        status: activity.status,
        error: activity.error || null,
        timestamp: new Date(),
        metadata: {
          serviceVersion: '1.0.0',
          processingTime: activity.processingTime || null
        }
      };

      console.log(`📝 Logging download activity: ${activity.status} - ${activity.pricing} - ${activity.photoId}`);

      // Store in download history (handled by commerce manager)
      await this.commerceManager.logDownloadHistory(logEntry);

    } catch (error) {
      console.error('❌ Error logging download activity:', error);
      // Don't throw - logging failures shouldn't break downloads
    }
  }

  /**
   * UTILITY METHODS
   */
  
  async getSessionStats(sessionId, clientKey = null) {
    try {
      const entitlementsResult = await this.commerceManager.getClientEntitlements(sessionId, clientKey);
      const policyResult = await this.getSessionPolicy(sessionId);

      if (!entitlementsResult.success || !policyResult.success) {
        return {
          success: false,
          error: 'Failed to retrieve session statistics'
        };
      }

      const policy = policyResult.policy;
      const entitlements = entitlementsResult.entitlements;

      return {
        success: true,
        stats: {
          policy: {
            mode: policy.mode,
            pricePerPhoto: policy.pricePerPhoto,
            freeCount: policy.freeCount,
            currency: policy.currency
          },
          downloads: {
            total: entitlements.length,
            free: entitlements.filter(e => e.amount === 0).length,
            paid: entitlements.filter(e => e.amount > 0).length,
            totalSpent: entitlements.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
          },
          quota: policy.mode === 'freemium' ? {
            used: entitlements.length,
            limit: parseInt(policy.freeCount) || 0,
            remaining: Math.max(0, (parseInt(policy.freeCount) || 0) - entitlements.length)
          } : null
        }
      };

    } catch (error) {
      console.error('❌ Error getting session stats:', error);
      return {
        success: false,
        error: 'Failed to retrieve session statistics'
      };
    }
  }

  /**
   * HEALTH CHECK AND DIAGNOSTICS
   */
  async healthCheck() {
    try {
      const checks = {
        database: false,
        r2Storage: false,
        commerceManager: false,
        timestamp: new Date()
      };

      // Test database connection
      try {
        await this.pool.query('SELECT 1');
        checks.database = true;
      } catch (error) {
        console.warn('Database health check failed:', error.message);
      }

      // Test R2 connection
      try {
        await this.r2Manager.testConnection();
        checks.r2Storage = this.r2Manager.r2Available;
      } catch (error) {
        console.warn('R2 health check failed:', error.message);
      }

      // Test commerce manager
      try {
        // Simple test to verify commerce manager is functional
        checks.commerceManager = this.commerceManager && this.commerceManager.stripeEnabled;
      } catch (error) {
        console.warn('Commerce manager health check failed:', error.message);
      }

      const allHealthy = Object.values(checks).every(check => check === true || check instanceof Date);

      return {
        success: allHealthy,
        status: allHealthy ? 'healthy' : 'degraded',
        checks: checks
      };

    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = DownloadService;
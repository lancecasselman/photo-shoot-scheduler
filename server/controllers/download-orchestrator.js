/**
 * Unified Download Orchestrator Controller
 * 
 * Replaces the broken multi-service routing with a single explicit pipeline
 * that handles the entire download flow with proper observability.
 * 
 * Pipeline Stages:
 * 1. Authenticate → Validate access tokens and session ownership
 * 2. Policy Resolve → Determine pricing model and constraints  
 * 3. Entitlement → Verify download permissions and quotas
 * 4. File Lookup → Locate file in sessionFiles table
 * 5. Delivery → Stream file with appropriate processing
 */

const crypto = require('crypto');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, sql } = require('drizzle-orm');
const DownloadError = require('./DownloadError');

// Import schema from the shared schema file - fixes schema conflicts
const schema = require('../../shared/schema');
const { 
  photographySessions, 
  downloadPolicies,
  downloadEntitlements, 
  downloadHistory,
  sessionFiles,
  users 
} = schema;

class DownloadOrchestrator {
  constructor(dependencies = {}) {
    // Dependency injection for testability and flexibility
    this.pool = dependencies.pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.db = dependencies.db || drizzle(this.pool, { schema });
    this.r2Manager = dependencies.r2Manager || require('../r2-file-manager');
    this.commerceManager = dependencies.commerceManager || require('../download-commerce');
    this.logger = dependencies.logger || this.createStructuredLogger();
    
    // Expose schema tables for external access (e.g., tests)
    this.schema = {
      photographySessions,
      downloadPolicies,
      downloadEntitlements,
      downloadHistory,
      sessionFiles,
      users
    };
    
    // Initialize R2 manager with pool if not provided
    if (!dependencies.r2Manager) {
      this.r2Manager = new (require('../r2-file-manager'))(null, this.pool);
    }
    
    console.log('✅ Download Orchestrator initialized with explicit pipeline stages');
  }

  /**
   * Create structured logger with immediate (non-buffered) output
   */
  createStructuredLogger() {
    return {
      info: (message, context = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message,
          context,
          service: 'download-orchestrator'
        };
        // Immediate output - no buffering
        console.log(`[ORCHESTRATOR] ${JSON.stringify(logEntry)}`);
      },
      
      error: (message, error = null, context = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'ERROR', 
          message,
          error: error ? {
            message: error.message,
            stack: error.stack,
            code: error.code
          } : null,
          context,
          service: 'download-orchestrator'
        };
        // Immediate error output - no buffering
        console.error(`[ORCHESTRATOR] ${JSON.stringify(logEntry)}`);
      },
      
      warn: (message, context = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'WARN',
          message,
          context,
          service: 'download-orchestrator'
        };
        // Immediate output - no buffering
        console.warn(`[ORCHESTRATOR] ${JSON.stringify(logEntry)}`);
      },

      debug: (message, context = {}) => {
        if (process.env.NODE_ENV === 'development') {
          const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'DEBUG',
            message,
            context,
            service: 'download-orchestrator'
          };
          console.debug(`[ORCHESTRATOR] ${JSON.stringify(logEntry)}`);
        }
      }
    };
  }

  /**
   * Generate and track correlation ID for request tracing
   */
  createCorrelationContext(req) {
    const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
    const context = {
      correlationId,
      requestId: req.id || crypto.randomUUID().substring(0, 8),
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.connection.remoteAddress,
      method: req.method,
      url: req.url,
      sessionId: req.params.sessionId || null,
      photoId: req.params.photoId || req.query.photoId || null
    };
    
    // Immediate logging of request start
    this.logger.info('Download request initiated', context);
    
    return context;
  }

  /**
   * STAGE 1: AUTHENTICATE
   * Pure function - validates access tokens and session ownership
   */
  async authenticate(params, context) {
    const { token, sessionId, userId } = params;
    
    this.logger.info('Starting authentication stage', { 
      ...context, 
      stage: 'authenticate',
      sessionId,
      hasToken: !!token,
      hasUserId: !!userId
    });

    try {
      // Validate required parameters
      if (!sessionId) {
        throw DownloadError.processingError('authenticate', 
          { reason: 'missing_session_id' }, context.correlationId);
      }

      // Fetch session with ownership validation
      const sessionQuery = this.db.select()
        .from(photographySessions)
        .where(eq(photographySessions.id, sessionId))
        .limit(1);

      this.logger.debug('Executing session query', { 
        ...context, 
        stage: 'authenticate',
        query: 'photographySessions' 
      });

      const sessions = await sessionQuery;
      
      if (!sessions || sessions.length === 0) {
        throw DownloadError.sessionNotFound(sessionId, context.correlationId);
      }

      const session = sessions[0];
      
      // Validate access based on authentication type
      let authResult = {};
      
      if (userId) {
        // Owner access - direct user authentication
        if (session.userId !== userId) {
          throw new DownloadError('UNAUTHORIZED', 
            'User does not own this session', {
              sessionId,
              userId,
              expectedUserId: session.userId,
              correlationId: context.correlationId,
              stage: 'authenticate'
            });
        }
        
        authResult = {
          type: 'owner',
          userId: userId,
          sessionOwnerId: session.userId
        };
        
      } else if (token) {
        // Gallery access - token-based authentication
        if (!session.galleryAccessToken || session.galleryAccessToken !== token) {
          throw DownloadError.invalidToken(token, context.correlationId);
        }
        
        // Check token expiration
        if (session.galleryExpiresAt && new Date(session.galleryExpiresAt) < new Date()) {
          throw new DownloadError('EXPIRED_ACCESS', 
            'Gallery access token has expired', {
              sessionId,
              expiresAt: session.galleryExpiresAt,
              correlationId: context.correlationId,
              stage: 'authenticate'
            });
        }
        
        authResult = {
          type: 'gallery',
          token: token,
          expiresAt: session.galleryExpiresAt
        };
        
      } else {
        throw new DownloadError('MISSING_CREDENTIALS', 
          'Either userId or gallery token is required', {
            sessionId,
            correlationId: context.correlationId,
            stage: 'authenticate'
          });
      }

      const result = {
        session,
        authResult,
        sessionId: session.id,
        userId: session.userId,
        clientName: session.clientName,
        pricingModel: session.pricingModel || 'free'
      };

      this.logger.info('Authentication completed successfully', { 
        ...context,
        stage: 'authenticate',
        authType: authResult.type,
        pricingModel: result.pricingModel,
        sessionOwnerId: result.userId
      });

      return result;

    } catch (error) {
      this.logger.error('Authentication failed', error, { 
        ...context, 
        stage: 'authenticate',
        sessionId,
        hasToken: !!token,
        hasUserId: !!userId
      });
      
      if (error instanceof DownloadError) {
        throw error;
      }
      
      throw DownloadError.databaseError('authentication', error, context.correlationId);
    }
  }

  /**
   * STAGE 2: POLICY RESOLVE  
   * Pure function - determines pricing model and download constraints
   */
  async policyResolve(authData, context) {
    const { session, sessionId } = authData;
    
    this.logger.info('Starting policy resolution stage', { 
      ...context,
      stage: 'policy_resolve',
      sessionId,
      pricingModel: session.pricingModel
    });

    try {
      let policy = null;
      
      // Try to fetch explicit download policy first
      if (session.downloadPolicyId) {
        const policyQuery = await this.db.select()
          .from(downloadPolicies)
          .where(eq(downloadPolicies.id, session.downloadPolicyId))
          .limit(1);
          
        if (policyQuery.length > 0) {
          policy = policyQuery[0];
        }
      }
      
      // Fall back to session-level pricing settings
      if (!policy) {
        policy = {
          id: null,
          sessionId: sessionId,
          mode: session.pricingModel || 'free',
          pricePerPhoto: session.pricePerDownload || '0.00',
          freeCount: session.freeDownloads || null,
          maxPerClient: session.downloadMax || null,
          watermarkPreset: session.watermarkEnabled ? {
            type: session.watermarkType || 'text',
            text: session.watermarkText || '© Photography',
            logoUrl: session.watermarkLogoUrl || null,
            opacity: session.watermarkOpacity || 60,
            position: session.watermarkPosition || 'bottom-right',
            scale: session.watermarkScale || 20
          } : null
        };
      }

      const result = {
        ...authData,
        policy,
        requiresPayment: policy.mode === 'paid' || 
          (policy.mode === 'freemium' && policy.freeCount !== null),
        watermarkSettings: policy.watermarkPreset,
        quotaSettings: {
          maxPerClient: policy.maxPerClient,
          maxGlobal: policy.maxGlobal,
          freeCount: policy.freeCount
        }
      };

      this.logger.info('Policy resolution completed', { 
        ...context,
        stage: 'policy_resolve',
        policyMode: policy.mode,
        requiresPayment: result.requiresPayment,
        hasWatermark: !!policy.watermarkPreset,
        quotaLimits: result.quotaSettings
      });

      return result;

    } catch (error) {
      this.logger.error('Policy resolution failed', error, { 
        ...context,
        stage: 'policy_resolve',
        sessionId
      });
      
      if (error instanceof DownloadError) {
        throw error;
      }
      
      throw DownloadError.databaseError('policy resolution', error, context.correlationId);
    }
  }

  /**
   * STAGE 3: ENTITLEMENT
   * Pure function - verifies download permissions and quotas
   */
  async entitlement(policyData, context) {
    const { session, policy, authResult, sessionId } = policyData;
    
    this.logger.info('Starting entitlement verification stage', { 
      ...context,
      stage: 'entitlement',
      sessionId,
      policyMode: policy.mode,
      authType: authResult.type
    });

    try {
      const clientKey = authResult.type === 'gallery' ? 
        this.generateGalleryClientKey(authResult.token, sessionId) : 
        `owner-${session.userId}`;

      // Check existing download history for quota enforcement
      let downloadCount = 0;
      let hasExistingEntitlement = false;
      
      if (policy.mode !== 'free') {
        const historyQuery = await this.db.select()
          .from(downloadHistory)
          .where(and(
            eq(downloadHistory.sessionId, sessionId),
            eq(downloadHistory.clientKey, clientKey)
          ));

        downloadCount = historyQuery.length;

        // Check for existing entitlements (active = remaining > 0 and not expired)
        const entitlementQuery = await this.db.select()
          .from(downloadEntitlements)
          .where(and(
            eq(downloadEntitlements.sessionId, sessionId),
            eq(downloadEntitlements.clientKey, clientKey),
            sql`${downloadEntitlements.remaining} > 0`,
            sql`(${downloadEntitlements.expiresAt} IS NULL OR ${downloadEntitlements.expiresAt} > NOW())`
          ));

        hasExistingEntitlement = entitlementQuery.length > 0;
      }

      // Apply entitlement rules based on pricing model
      let entitlementResult = {};

      switch (policy.mode) {
        case 'free':
          // Free model - unlimited downloads, no payment required
          entitlementResult = {
            granted: true,
            reason: 'free_model',
            requiresPayment: false,
            watermarked: !!policy.watermarkPreset
          };
          break;

        case 'freemium':
          // Freemium model - free count, then payment required
          const freeLimit = policy.freeCount || 0;
          
          if (downloadCount < freeLimit) {
            entitlementResult = {
              granted: true,
              reason: 'within_free_limit',
              requiresPayment: false,
              watermarked: !!policy.watermarkPreset,
              remainingFreeDownloads: freeLimit - downloadCount
            };
          } else if (hasExistingEntitlement) {
            entitlementResult = {
              granted: true,
              reason: 'paid_entitlement',
              requiresPayment: false,
              watermarked: false // Paid downloads typically unwatermarked
            };
          } else {
            throw DownloadError.paymentRequired(sessionId, null, context.correlationId);
          }
          break;

        case 'paid':
          // Paid model - all downloads require payment
          if (hasExistingEntitlement || authResult.type === 'owner') {
            entitlementResult = {
              granted: true,
              reason: authResult.type === 'owner' ? 'session_owner' : 'paid_entitlement',
              requiresPayment: false,
              watermarked: false
            };
          } else {
            throw DownloadError.paymentRequired(sessionId, null, context.correlationId);
          }
          break;

        default:
          throw new DownloadError('INVALID_PRICING_MODEL', 
            `Unknown pricing model: ${policy.mode}`, {
              pricingModel: policy.mode,
              sessionId,
              correlationId: context.correlationId,
              stage: 'entitlement'
            });
      }

      // Check quota limits
      if (policy.maxPerClient && downloadCount >= policy.maxPerClient) {
        throw DownloadError.quotaExceeded(sessionId, session.userId, context.correlationId);
      }

      const result = {
        ...policyData,
        entitlement: entitlementResult,
        clientKey,
        downloadCount,
        quotaStatus: {
          current: downloadCount,
          maxPerClient: policy.maxPerClient,
          withinLimits: !policy.maxPerClient || downloadCount < policy.maxPerClient
        }
      };

      this.logger.info('Entitlement verification completed', { 
        ...context,
        stage: 'entitlement',
        granted: entitlementResult.granted,
        reason: entitlementResult.reason,
        watermarked: entitlementResult.watermarked,
        downloadCount,
        clientKey: clientKey.substring(0, 12) + '...'
      });

      return result;

    } catch (error) {
      this.logger.error('Entitlement verification failed', error, { 
        ...context,
        stage: 'entitlement',
        sessionId
      });
      
      if (error instanceof DownloadError) {
        throw error;
      }
      
      throw DownloadError.processingError('entitlement', 
        { originalError: error.message }, context.correlationId);
    }
  }

  /**
   * STAGE 4: FILE LOOKUP
   * Pure function - locates file in sessionFiles table with proper error handling
   */
  async fileLookup(entitlementData, params, context) {
    const { sessionId } = entitlementData;
    const { filename, photoId } = params;
    
    this.logger.info('Starting file lookup stage', { 
      ...context,
      stage: 'file_lookup',
      sessionId,
      filename,
      photoId
    });

    try {
      if (!filename && !photoId) {
        throw new DownloadError('MISSING_REQUIRED_FIELDS', 
          'Either filename or photoId is required', {
            sessionId,
            correlationId: context.correlationId,
            stage: 'file_lookup'
          });
      }

      let fileRecord = null;
      let lookupField = null;
      let lookupValue = null;

      // Query sessionFiles table - using the fixed schema
      if (filename) {
        this.logger.debug('Looking up file by filename', { 
          ...context,
          stage: 'file_lookup',
          filename 
        });
        
        const fileQuery = await this.db.select()
          .from(sessionFiles)
          .where(and(
            eq(sessionFiles.sessionId, sessionId),
            eq(sessionFiles.filename, filename)
          ))
          .limit(1);

        if (fileQuery.length > 0) {
          fileRecord = fileQuery[0];
          lookupField = 'filename';
          lookupValue = filename;
        }
      } 
      
      // If not found by filename, try photoId lookup in session photos
      if (!fileRecord && photoId) {
        this.logger.debug('Looking up file by photoId in session photos', { 
          ...context,
          stage: 'file_lookup',
          photoId 
        });

        const sessionQuery = await this.db.select()
          .from(photographySessions)
          .where(eq(photographySessions.id, sessionId))
          .limit(1);

        if (sessionQuery.length > 0) {
          const session = sessionQuery[0];
          const photos = session.photos || [];
          
          // Find photo by ID in the photos array
          const photo = photos.find(p => p.id === photoId);
          
          if (photo && photo.filename) {
            // Now look up by the resolved filename
            const fileQuery = await this.db.select()
              .from(sessionFiles)
              .where(and(
                eq(sessionFiles.sessionId, sessionId),
                eq(sessionFiles.filename, photo.filename)
              ))
              .limit(1);

            if (fileQuery.length > 0) {
              fileRecord = fileQuery[0];
              lookupField = 'photoId->filename';
              lookupValue = photoId;
            }
          }
        }
      }

      // Final validation - ensure we found a valid file record
      if (!fileRecord) {
        const errorMsg = filename ? 
          `File '${filename}' not found in session ${sessionId}` :
          `Photo '${photoId}' not found in session ${sessionId}`;
          
        if (filename) {
          throw DownloadError.fileNotFound(filename, sessionId, context.correlationId);
        } else {
          throw DownloadError.photoNotFound(photoId, sessionId, context.correlationId);
        }
      }

      // Validate file record has required properties
      if (!fileRecord.filename) {
        throw new DownloadError('FILE_NOT_FOUND', 
          'File record exists but missing filename property', {
            fileRecordId: fileRecord.id,
            sessionId,
            correlationId: context.correlationId,
            stage: 'file_lookup'
          });
      }

      if (!fileRecord.r2Key) {
        throw new DownloadError('FILE_NOT_FOUND', 
          'File record missing R2 storage key', {
            filename: fileRecord.filename,
            sessionId,
            correlationId: context.correlationId,
            stage: 'file_lookup'
          });
      }

      const result = {
        ...entitlementData,
        fileRecord: {
          id: fileRecord.id,
          filename: fileRecord.filename,
          originalName: fileRecord.originalName || fileRecord.filename,
          r2Key: fileRecord.r2Key,
          fileSizeBytes: fileRecord.fileSizeBytes,
          fileSizeMb: fileRecord.fileSizeMb,
          folderType: fileRecord.folderType,
          uploadedAt: fileRecord.uploadedAt
        },
        lookupMethod: lookupField,
        resolvedFilename: fileRecord.filename
      };

      this.logger.info('File lookup completed successfully', { 
        ...context,
        stage: 'file_lookup',
        lookupMethod: lookupField,
        lookupValue,
        resolvedFilename: fileRecord.filename,
        r2Key: fileRecord.r2Key,
        fileSizeMb: fileRecord.fileSizeMb
      });

      return result;

    } catch (error) {
      this.logger.error('File lookup failed', error, { 
        ...context,
        stage: 'file_lookup',
        sessionId,
        filename,
        photoId
      });
      
      if (error instanceof DownloadError) {
        throw error;
      }
      
      throw DownloadError.databaseError('file lookup', error, context.correlationId);
    }
  }

  /**
   * STAGE 5: DELIVERY
   * Pure function - streams file with appropriate processing (watermarking, etc.)
   */
  async delivery(fileData, context, res) {
    const { fileRecord, entitlement, sessionId, clientKey } = fileData;
    
    this.logger.info('Starting file delivery stage', { 
      ...context,
      stage: 'delivery',
      filename: fileRecord.filename,
      watermarked: entitlement.watermarked,
      fileSizeMb: fileRecord.fileSizeMb
    });

    try {
      // Record download attempt in history
      const downloadId = crypto.randomUUID();
      
      const historyRecord = {
        id: downloadId,
        sessionId: sessionId,
        clientKey: clientKey,
        photoId: fileRecord.filename, // Use filename as photoId for tracking
        status: 'success',
        createdAt: new Date()
      };

      // Insert download history record immediately
      await this.db.insert(downloadHistory).values(historyRecord);

      // Get file from R2 storage
      this.logger.debug('Fetching file from R2 storage', {
        ...context,
        stage: 'delivery',
        r2Key: fileRecord.r2Key
      });

      const fileStream = await this.r2Manager.getFileStream(fileRecord.r2Key);
      
      if (!fileStream) {
        throw DownloadError.storageError('file_retrieval', 
          fileRecord.filename, context.correlationId);
      }

      // Set response headers
      const contentType = this.getContentType(fileRecord.filename);
      const downloadFilename = fileRecord.originalName || fileRecord.filename;
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('X-Download-ID', downloadId);
      res.setHeader('X-Correlation-ID', context.correlationId);
      
      if (fileRecord.fileSizeBytes) {
        res.setHeader('Content-Length', fileRecord.fileSizeBytes);
      }

      // Apply watermarking if required
      if (entitlement.watermarked && fileData.watermarkSettings) {
        this.logger.debug('Applying watermark to file', {
          ...context,
          stage: 'delivery',
          watermarkType: fileData.watermarkSettings.type
        });

        // Stream through watermarking process
        const watermarkedStream = await this.applyWatermark(
          fileStream, 
          fileData.watermarkSettings,
          context
        );
        
        watermarkedStream.pipe(res);
      } else {
        // Stream file directly
        fileStream.pipe(res);
      }

      this.logger.info('File delivery completed successfully', { 
        ...context,
        stage: 'delivery',
        downloadId,
        filename: fileRecord.filename,
        watermarked: entitlement.watermarked,
        clientKey: clientKey.substring(0, 12) + '...'
      });

      return { 
        success: true, 
        downloadId,
        filename: downloadFilename,
        watermarked: entitlement.watermarked
      };

    } catch (error) {
      this.logger.error('File delivery failed', error, { 
        ...context,
        stage: 'delivery',
        filename: fileRecord.filename,
        sessionId
      });
      
      if (error instanceof DownloadError) {
        throw error;
      }
      
      throw DownloadError.storageError('file_delivery', 
        fileRecord.filename, context.correlationId);
    }
  }

  /**
   * ORCHESTRATOR MAIN METHOD
   * Executes the complete pipeline: authenticate → policy resolve → entitlement → file lookup → delivery
   */
  async processDownload(req, res) {
    const context = this.createCorrelationContext(req);
    
    try {
      this.logger.info('Starting download orchestration pipeline', {
        ...context,
        pipeline: ['authenticate', 'policy_resolve', 'entitlement', 'file_lookup', 'delivery']
      });

      // Extract parameters from request
      const params = {
        sessionId: req.params.sessionId,
        filename: req.params.filename || req.query.filename,
        photoId: req.params.photoId || req.query.photoId,
        token: req.params.token || req.query.token || req.headers.authorization?.replace('Bearer ', ''),
        userId: req.user?.id // From authentication middleware
      };

      // STAGE 1: AUTHENTICATE
      const authData = await this.authenticate(params, context);
      
      // STAGE 2: POLICY RESOLVE
      const policyData = await this.policyResolve(authData, context);
      
      // STAGE 3: ENTITLEMENT
      const entitlementData = await this.entitlement(policyData, context);
      
      // STAGE 4: FILE LOOKUP
      const fileData = await this.fileLookup(entitlementData, params, context);
      
      // STAGE 5: DELIVERY
      const deliveryResult = await this.delivery(fileData, context, res);
      
      this.logger.info('Download orchestration completed successfully', {
        ...context,
        result: deliveryResult,
        totalStages: 5,
        finalStage: 'delivery'
      });

    } catch (error) {
      this.logger.error('Download orchestration failed', error, {
        ...context,
        stage: error.context?.stage || 'unknown'
      });

      // Handle DownloadError with proper HTTP response
      if (error instanceof DownloadError) {
        const statusCode = error.getStatusCode();
        const response = error.toResponse();
        
        res.status(statusCode).json(response);
      } else {
        // Unexpected error - wrap in DownloadError  
        const wrappedError = DownloadError.processingError('orchestration', 
          { originalError: error.message }, context.correlationId);
        
        const statusCode = wrappedError.getStatusCode();
        const response = wrappedError.toResponse();
        
        res.status(statusCode).json(response);
      }
    }
  }

  /**
   * UTILITY METHODS
   */

  generateGalleryClientKey(galleryAccessToken, sessionId) {
    if (!galleryAccessToken || !sessionId) {
      throw new Error('Gallery token and session ID are required for client key generation');
    }
    
    const baseString = `${galleryAccessToken}-${sessionId}`;
    const clientKey = `gallery-${crypto.createHash('sha256').update(baseString).digest('hex').substring(0, 16)}`;
    
    return clientKey;
  }

  getContentType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg', 
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'tiff': 'image/tiff',
      'tif': 'image/tiff'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async applyWatermark(fileStream, watermarkSettings, context) {
    try {
      // This would integrate with your existing watermarking system
      // For now, return the original stream
      this.logger.debug('Watermarking integration needed', {
        ...context,
        watermarkSettings
      });
      
      return fileStream;
    } catch (error) {
      this.logger.warn('Watermarking failed, returning original file', {
        ...context,
        error: error.message
      });
      
      return fileStream;
    }
  }
}

module.exports = DownloadOrchestrator;
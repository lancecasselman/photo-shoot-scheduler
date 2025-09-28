/**
 * Download Orchestrator Routes
 * 
 * Express router that integrates the unified download orchestrator
 * with the existing server infrastructure. This replaces the problematic
 * middleware layers in download-routes.js with clean, explicit routing.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const DownloadOrchestrator = require('./download-orchestrator');
const DownloadError = require('./DownloadError');

function createDownloadOrchestratorRoutes(dependencies = {}) {
  const router = express.Router();
  
  // Initialize orchestrator with dependency injection
  const orchestrator = new DownloadOrchestrator(dependencies);
  
  // Rate limiting for download endpoints
  const downloadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many download requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Strict rate limiting for actual file downloads
  const fileDownloadRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 downloads per hour per session
    message: 'Download limit exceeded. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
  
  /**
   * Download photo by filename with gallery token
   * GET /api/download/session/:sessionId/file/:filename?token=<gallery_token>
   */
  router.get('/session/:sessionId/file/:filename', 
    downloadRateLimit,
    fileDownloadRateLimit,
    async (req, res) => {
      await orchestrator.processDownload(req, res);
    }
  );
  
  /**
   * Download photo by photoId with gallery token
   * GET /api/download/session/:sessionId/photo/:photoId?token=<gallery_token>
   */
  router.get('/session/:sessionId/photo/:photoId', 
    downloadRateLimit,
    fileDownloadRateLimit,
    async (req, res) => {
      await orchestrator.processDownload(req, res);
    }
  );
  
  /**
   * Download photo with authenticated user access (owner)
   * GET /api/download/session/:sessionId/file/:filename
   * Requires authentication middleware to set req.user
   */
  router.get('/auth/session/:sessionId/file/:filename',
    downloadRateLimit,
    fileDownloadRateLimit,
    async (req, res) => {
      await orchestrator.processDownload(req, res);
    }
  );
  
  /**
   * Download photo by photoId with authenticated user access (owner)
   * GET /api/download/auth/session/:sessionId/photo/:photoId
   * Requires authentication middleware to set req.user
   */
  router.get('/auth/session/:sessionId/photo/:photoId',
    downloadRateLimit,
    fileDownloadRateLimit,
    async (req, res) => {
      await orchestrator.processDownload(req, res);
    }
  );
  
  /**
   * Generic process endpoint that handles downloads with flexible parameter passing
   * POST /api/downloads/orchestrator/process
   */
  router.post('/process', 
    downloadRateLimit,
    fileDownloadRateLimit,
    async (req, res) => {
      await orchestrator.processDownload(req, res);
    }
  );
  
  /**
   * Health check endpoint to verify orchestrator status
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'download-orchestrator',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });
  
  /**
   * Debug endpoint to check session and file availability (development only)
   */
  if (process.env.NODE_ENV === 'development') {
    router.get('/debug/session/:sessionId', async (req, res) => {
      try {
        const context = orchestrator.createCorrelationContext(req);
        
        // Test authentication stage
        const params = {
          sessionId: req.params.sessionId,
          token: req.query.token,
          userId: req.user?.id
        };
        
        const authData = await orchestrator.authenticate(params, context);
        const policyData = await orchestrator.policyResolve(authData, context);
        
        // List files in session
        const files = await orchestrator.db.select()
          .from(orchestrator.db.schema.sessionFiles)
          .where(orchestrator.db.eq(orchestrator.db.schema.sessionFiles.sessionId, req.params.sessionId));
        
        res.json({
          success: true,
          debug: {
            session: {
              id: authData.sessionId,
              clientName: authData.clientName,
              pricingModel: authData.pricingModel,
              userId: authData.userId
            },
            policy: {
              mode: policyData.policy.mode,
              requiresPayment: policyData.requiresPayment,
              watermarkSettings: !!policyData.watermarkSettings
            },
            files: files.map(f => ({
              id: f.id,
              filename: f.filename,
              originalName: f.originalName,
              folderType: f.folderType,
              fileSizeMb: f.fileSizeMb,
              hasR2Key: !!f.r2Key
            }))
          },
          correlationId: context.correlationId
        });
        
      } catch (error) {
        if (error instanceof DownloadError) {
          res.status(error.getStatusCode()).json(error.toResponse());
        } else {
          res.status(500).json({
            success: false,
            error: {
              message: error.message,
              code: 'DEBUG_ERROR'
            }
          });
        }
      }
    });
  }
  
  // Global error handler for orchestrator routes
  router.use((error, req, res, next) => {
    console.error('Unhandled error in download orchestrator routes:', error);
    
    const correlationId = req.headers['x-correlation-id'] || 'unknown';
    
    if (error instanceof DownloadError) {
      const statusCode = error.getStatusCode();
      const response = error.toResponse();
      res.status(statusCode).json(response);
    } else {
      // Wrap unexpected errors
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          correlationId
        }
      });
    }
  });
  
  return router;
}

module.exports = createDownloadOrchestratorRoutes;
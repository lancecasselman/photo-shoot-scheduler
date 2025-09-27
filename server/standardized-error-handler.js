/**
 * Standardized Error Handler for Download Service
 * 
 * Provides consistent error response structure, HTTP status code mapping,
 * correlation ID tracking, and comprehensive error context for all endpoints.
 * This ensures production-ready error handling with proper logging and monitoring.
 */

const crypto = require('crypto');

// Error code to HTTP status code mapping
const ERROR_STATUS_CODES = {
  // Authentication & Authorization (4xx)
  'MISSING_CREDENTIALS': 400,
  'MISSING_REQUIRED_FIELDS': 400,
  'INVALID_TOKEN': 401,
  'EXPIRED_ACCESS': 401,
  'UNAUTHORIZED': 401,
  'FORBIDDEN': 403,
  'SESSION_NOT_FOUND': 404,
  'RESOURCE_NOT_FOUND': 404,
  'PHOTO_NOT_FOUND': 404,
  'FILE_NOT_FOUND': 404,
  'POLICY_NOT_FOUND': 404,
  'CONFLICT': 409,
  'PAYMENT_REQUIRED': 402,
  'QUOTA_EXCEEDED': 402,
  'RATE_LIMIT_EXCEEDED': 429,
  
  // Validation Errors (4xx)
  'VALIDATION_ERROR': 400,
  'INVALID_PRICING_MODEL': 400,
  'INVALID_FILE_FORMAT': 400,
  'INVALID_FILE_SIZE': 400,
  'INVALID_PARAMETERS': 400,
  'MALFORMED_REQUEST': 400,
  'UNSUPPORTED_OPERATION': 400,
  
  // Business Logic Errors (4xx)
  'ENTITLEMENT_ERROR': 400,
  'TOKEN_ERROR': 400,
  'QUOTA_CHECK_ERROR': 400,
  'POLICY_ERROR': 400,
  'STATUS_ERROR': 400,
  'CART_ERROR': 400,
  'CHECKOUT_ERROR': 400,
  'WATERMARK_ERROR': 400,
  'PREVIEW_ERROR': 400,
  
  // Payment Errors (4xx)
  'PAYMENT_FAILED': 402,
  'CARD_DECLINED': 402,
  'INSUFFICIENT_FUNDS': 402,
  'PAYMENT_CANCELLED': 402,
  'STRIPE_ERROR': 402,
  'WEBHOOK_VERIFICATION_FAILED': 400,
  
  // Server Errors (5xx)
  'INTERNAL_ERROR': 500,
  'PROCESSING_ERROR': 500,
  'DATABASE_ERROR': 500,
  'STORAGE_ERROR': 500,
  'EXTERNAL_SERVICE_ERROR': 502,
  'SERVICE_UNAVAILABLE': 503,
  'TIMEOUT_ERROR': 504,
  'CIRCUIT_BREAKER_OPEN': 503,
  'RESOURCE_EXHAUSTED': 503,
  'CONFIGURATION_ERROR': 500
};

// User-friendly error messages
const USER_FRIENDLY_MESSAGES = {
  'MISSING_CREDENTIALS': 'Authentication required. Please provide valid credentials.',
  'MISSING_REQUIRED_FIELDS': 'Missing required information. Please check your request.',
  'INVALID_TOKEN': 'Invalid or expired access token. Please refresh and try again.',
  'EXPIRED_ACCESS': 'Your access has expired. Please refresh and try again.',
  'UNAUTHORIZED': 'You are not authorized to perform this action.',
  'FORBIDDEN': 'Access denied. You do not have permission to access this resource.',
  'SESSION_NOT_FOUND': 'Session not found. Please check your session ID.',
  'RESOURCE_NOT_FOUND': 'The requested resource was not found.',
  'PHOTO_NOT_FOUND': 'Photo not found. Please check the photo ID.',
  'FILE_NOT_FOUND': 'File not found. The requested file may have been removed.',
  'CONFLICT': 'A conflict occurred. Please try again.',
  'PAYMENT_REQUIRED': 'Payment is required to access this content.',
  'QUOTA_EXCEEDED': 'Download quota exceeded. Payment required for additional downloads.',
  'RATE_LIMIT_EXCEEDED': 'Too many requests. Please slow down and try again.',
  
  'VALIDATION_ERROR': 'Invalid request data. Please check your input.',
  'INVALID_PRICING_MODEL': 'Invalid pricing configuration. Please contact support.',
  'INVALID_FILE_FORMAT': 'Unsupported file format. Please use a supported format.',
  'INVALID_FILE_SIZE': 'File size exceeds the allowed limit.',
  'INVALID_PARAMETERS': 'Invalid parameters provided.',
  'MALFORMED_REQUEST': 'The request format is incorrect.',
  'UNSUPPORTED_OPERATION': 'This operation is not supported.',
  
  'ENTITLEMENT_ERROR': 'Unable to verify download permissions.',
  'TOKEN_ERROR': 'Token generation or validation failed.',
  'QUOTA_CHECK_ERROR': 'Unable to verify download quota.',
  'POLICY_ERROR': 'Unable to retrieve pricing policy.',
  'STATUS_ERROR': 'Unable to retrieve status information.',
  'CART_ERROR': 'Shopping cart error occurred.',
  'CHECKOUT_ERROR': 'Checkout process failed. Please try again.',
  'WATERMARK_ERROR': 'Watermark processing failed.',
  'PREVIEW_ERROR': 'Preview generation failed.',
  
  'PAYMENT_FAILED': 'Payment processing failed. Please try a different payment method.',
  'CARD_DECLINED': 'Your card was declined. Please try a different payment method.',
  'INSUFFICIENT_FUNDS': 'Insufficient funds. Please check your account or try a different card.',
  'PAYMENT_CANCELLED': 'Payment was cancelled.',
  'STRIPE_ERROR': 'Payment processing error. Please try again.',
  'WEBHOOK_VERIFICATION_FAILED': 'Webhook verification failed.',
  
  'INTERNAL_ERROR': 'An internal error occurred. Please try again or contact support.',
  'PROCESSING_ERROR': 'Processing failed. Please try again.',
  'DATABASE_ERROR': 'Database error occurred. Please try again.',
  'STORAGE_ERROR': 'File storage error. Please try again.',
  'EXTERNAL_SERVICE_ERROR': 'External service temporarily unavailable. Please try again.',
  'SERVICE_UNAVAILABLE': 'Service temporarily unavailable. Please try again later.',
  'TIMEOUT_ERROR': 'Request timed out. Please try again.',
  'CIRCUIT_BREAKER_OPEN': 'Service is temporarily unavailable due to high error rates.',
  'RESOURCE_EXHAUSTED': 'System resources temporarily unavailable. Please try again.',
  'CONFIGURATION_ERROR': 'System configuration error. Please contact support.'
};

// Error severity levels
const ERROR_SEVERITY = {
  'LOW': ['MISSING_REQUIRED_FIELDS', 'VALIDATION_ERROR', 'RATE_LIMIT_EXCEEDED', 'QUOTA_EXCEEDED'],
  'MEDIUM': ['INVALID_TOKEN', 'EXPIRED_ACCESS', 'PAYMENT_REQUIRED', 'PAYMENT_FAILED'],
  'HIGH': ['DATABASE_ERROR', 'STORAGE_ERROR', 'EXTERNAL_SERVICE_ERROR', 'TIMEOUT_ERROR'],
  'CRITICAL': ['INTERNAL_ERROR', 'CONFIGURATION_ERROR', 'RESOURCE_EXHAUSTED', 'SERVICE_UNAVAILABLE']
};

// Recovery suggestions for different error types
const RECOVERY_SUGGESTIONS = {
  'MISSING_CREDENTIALS': ['provide_credentials', 'refresh_token'],
  'INVALID_TOKEN': ['refresh_token', 'reauthenticate'],
  'EXPIRED_ACCESS': ['refresh_token', 'renew_access'],
  'PAYMENT_REQUIRED': ['make_payment', 'upgrade_plan'],
  'QUOTA_EXCEEDED': ['make_payment', 'wait_for_reset'],
  'RATE_LIMIT_EXCEEDED': ['wait_and_retry', 'reduce_frequency'],
  'PAYMENT_FAILED': ['try_different_card', 'check_card_details', 'contact_bank'],
  'CARD_DECLINED': ['try_different_card', 'contact_bank'],
  'INSUFFICIENT_FUNDS': ['add_funds', 'try_different_card'],
  'SERVICE_UNAVAILABLE': ['retry_later', 'contact_support'],
  'TIMEOUT_ERROR': ['retry_request', 'check_connection'],
  'EXTERNAL_SERVICE_ERROR': ['retry_later', 'contact_support']
};

class StandardizedErrorHandler {
  constructor() {
    this.correlationIds = new Map(); // Track correlation IDs across requests
    this.errorStats = new Map(); // Track error frequency and patterns
    this.alertThresholds = {
      criticalErrorCount: 10, // per 5 minutes
      highErrorRate: 0.25, // 25% error rate
      timeWindow: 5 * 60 * 1000 // 5 minutes
    };
    
    console.log('✅ Standardized Error Handler initialized with production features');
  }

  /**
   * Generate unique correlation ID for request tracking
   */
  generateCorrelationId() {
    return crypto.randomUUID();
  }

  /**
   * Get or create correlation ID from request
   */
  getCorrelationId(req) {
    // Check if correlation ID already exists in headers
    if (req.headers['x-correlation-id']) {
      return req.headers['x-correlation-id'];
    }
    
    // Generate new correlation ID
    const correlationId = this.generateCorrelationId();
    req.correlationId = correlationId;
    return correlationId;
  }

  /**
   * Determine error severity based on error code
   */
  getErrorSeverity(errorCode) {
    for (const [severity, codes] of Object.entries(ERROR_SEVERITY)) {
      if (codes.includes(errorCode)) {
        return severity;
      }
    }
    return 'MEDIUM'; // Default severity
  }

  /**
   * Build standardized error response with full context
   */
  buildErrorResponse(errorCode, customMessage = null, context = {}, correlationId = null) {
    const timestamp = new Date().toISOString();
    const httpStatus = ERROR_STATUS_CODES[errorCode] || 500;
    const userMessage = customMessage || USER_FRIENDLY_MESSAGES[errorCode] || 'An error occurred';
    const severity = this.getErrorSeverity(errorCode);
    const suggestions = RECOVERY_SUGGESTIONS[errorCode] || [];

    // Build comprehensive error object
    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: userMessage,
        severity: severity,
        timestamp: timestamp,
        correlationId: correlationId || this.generateCorrelationId(),
        httpStatus: httpStatus,
        context: {
          endpoint: context.endpoint || 'unknown',
          method: context.method || 'unknown',
          sessionId: context.sessionId,
          userId: context.userId,
          clientKey: context.clientKey,
          photoId: context.photoId,
          ...(context.additional || {})
        },
        suggestions: suggestions,
        retryable: this.isRetryableError(errorCode),
        retryAfter: this.getRetryDelay(errorCode)
      }
    };

    // Add debug information in development
    if (process.env.NODE_ENV !== 'production' && context.debug) {
      errorResponse.error.debug = {
        stack: context.debug.stack,
        details: context.debug.details,
        originalError: context.debug.originalError
      };
    }

    return errorResponse;
  }

  /**
   * Handle error response with logging and monitoring
   */
  handleErrorResponse(res, errorCode, customMessage = null, context = {}) {
    try {
      // Get correlation ID from request
      const correlationId = res.req ? this.getCorrelationId(res.req) : this.generateCorrelationId();
      
      // Build error response
      const errorResponse = this.buildErrorResponse(errorCode, customMessage, context, correlationId);
      const httpStatus = errorResponse.error.httpStatus;

      // Add correlation ID to response headers
      res.set('X-Correlation-ID', correlationId);
      
      // Log error with structured data
      this.logError(errorResponse.error, context);
      
      // Track error statistics
      this.trackErrorStats(errorCode, httpStatus, correlationId);
      
      // Send monitoring alerts if needed
      this.checkAlertThresholds(errorCode, httpStatus);
      
      // Send response
      res.status(httpStatus).json(errorResponse);
      
    } catch (handlingError) {
      console.error('❌ Error in error handling:', handlingError);
      
      // Fallback error response
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred',
          severity: 'CRITICAL',
          timestamp: new Date().toISOString(),
          correlationId: this.generateCorrelationId()
        }
      });
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(errorCode) {
    const retryableErrors = [
      'RATE_LIMIT_EXCEEDED',
      'TIMEOUT_ERROR',
      'SERVICE_UNAVAILABLE',
      'EXTERNAL_SERVICE_ERROR',
      'CIRCUIT_BREAKER_OPEN',
      'RESOURCE_EXHAUSTED'
    ];
    return retryableErrors.includes(errorCode);
  }

  /**
   * Get retry delay in seconds
   */
  getRetryDelay(errorCode) {
    const retryDelays = {
      'RATE_LIMIT_EXCEEDED': 60, // 1 minute
      'TIMEOUT_ERROR': 30, // 30 seconds
      'SERVICE_UNAVAILABLE': 300, // 5 minutes
      'EXTERNAL_SERVICE_ERROR': 60, // 1 minute
      'CIRCUIT_BREAKER_OPEN': 300, // 5 minutes
      'RESOURCE_EXHAUSTED': 120 // 2 minutes
    };
    return retryDelays[errorCode] || null;
  }

  /**
   * Structured error logging with context
   */
  logError(error, context) {
    const logLevel = this.getLogLevel(error.severity);
    const logData = {
      level: logLevel,
      correlationId: error.correlationId,
      errorCode: error.code,
      message: error.message,
      severity: error.severity,
      timestamp: error.timestamp,
      httpStatus: error.httpStatus,
      context: error.context,
      retryable: error.retryable
    };

    // Log with appropriate level
    switch (logLevel) {
      case 'ERROR':
        console.error(`❌ [${error.correlationId}] ${error.code}: ${error.message}`, logData);
        break;
      case 'WARN':
        console.warn(`⚠️ [${error.correlationId}] ${error.code}: ${error.message}`, logData);
        break;
      case 'INFO':
        console.info(`ℹ️ [${error.correlationId}] ${error.code}: ${error.message}`, logData);
        break;
      default:
        console.log(`📝 [${error.correlationId}] ${error.code}: ${error.message}`, logData);
    }

    // Send to external logging service if configured
    if (process.env.EXTERNAL_LOGGING_URL) {
      this.sendToExternalLogger(logData).catch(err => {
        console.error('Failed to send log to external service:', err);
      });
    }
  }

  /**
   * Get log level based on error severity
   */
  getLogLevel(severity) {
    const levels = {
      'LOW': 'INFO',
      'MEDIUM': 'WARN',
      'HIGH': 'ERROR',
      'CRITICAL': 'ERROR'
    };
    return levels[severity] || 'WARN';
  }

  /**
   * Track error statistics for monitoring
   */
  trackErrorStats(errorCode, httpStatus, correlationId) {
    const currentTime = Date.now();
    const windowStart = currentTime - this.alertThresholds.timeWindow;

    // Clean old entries
    for (const [key, data] of this.errorStats.entries()) {
      if (data.firstOccurrence < windowStart) {
        this.errorStats.delete(key);
      }
    }

    // Track error
    const errorKey = `${errorCode}_${httpStatus}`;
    const errorData = this.errorStats.get(errorKey) || {
      count: 0,
      firstOccurrence: currentTime,
      lastOccurrence: currentTime,
      correlationIds: []
    };

    errorData.count++;
    errorData.lastOccurrence = currentTime;
    errorData.correlationIds.push(correlationId);

    // Keep only recent correlation IDs
    if (errorData.correlationIds.length > 100) {
      errorData.correlationIds = errorData.correlationIds.slice(-50);
    }

    this.errorStats.set(errorKey, errorData);
  }

  /**
   * Check alert thresholds and send alerts if needed
   */
  checkAlertThresholds(errorCode, httpStatus) {
    const severity = this.getErrorSeverity(errorCode);
    
    // Check critical error threshold
    if (severity === 'CRITICAL') {
      const criticalErrors = Array.from(this.errorStats.entries())
        .filter(([key]) => {
          const code = key.split('_')[0];
          return this.getErrorSeverity(code) === 'CRITICAL';
        })
        .reduce((total, [, data]) => total + data.count, 0);

      if (criticalErrors >= this.alertThresholds.criticalErrorCount) {
        this.sendAlert('CRITICAL_ERROR_THRESHOLD', {
          errorCode,
          httpStatus,
          criticalErrorCount: criticalErrors,
          timeWindow: this.alertThresholds.timeWindow / 60000 // minutes
        });
      }
    }

    // Check error rate threshold
    const totalErrors = Array.from(this.errorStats.values())
      .reduce((total, data) => total + data.count, 0);
    const totalRequests = totalErrors * 4; // Estimate total requests (rough approximation)
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    if (errorRate > this.alertThresholds.highErrorRate) {
      this.sendAlert('HIGH_ERROR_RATE', {
        errorCode,
        errorRate: Math.round(errorRate * 100),
        threshold: Math.round(this.alertThresholds.highErrorRate * 100)
      });
    }
  }

  /**
   * Send monitoring alert
   */
  sendAlert(alertType, data) {
    console.error(`🚨 ALERT: ${alertType}`, data);
    
    // TODO: Integrate with alerting system (email, Slack, PagerDuty, etc.)
    // This could send to external monitoring services like Datadog, New Relic, etc.
  }

  /**
   * Send log data to external logging service
   */
  async sendToExternalLogger(logData) {
    // TODO: Implement external logging integration
    // This could send to services like LogDNA, Splunk, ELK stack, etc.
  }

  /**
   * Get error statistics for monitoring dashboard
   */
  getErrorStatistics() {
    const stats = {
      timeWindow: this.alertThresholds.timeWindow / 60000, // minutes
      totalErrors: 0,
      errorsByCode: {},
      errorsBySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      recentCorrelationIds: []
    };

    for (const [errorKey, data] of this.errorStats.entries()) {
      const [errorCode] = errorKey.split('_');
      const severity = this.getErrorSeverity(errorCode);
      
      stats.totalErrors += data.count;
      stats.errorsByCode[errorCode] = (stats.errorsByCode[errorCode] || 0) + data.count;
      stats.errorsBySeverity[severity] += data.count;
      stats.recentCorrelationIds.push(...data.correlationIds.slice(-5));
    }

    // Keep only recent correlation IDs and deduplicate
    stats.recentCorrelationIds = [...new Set(stats.recentCorrelationIds.slice(-50))];

    return stats;
  }

  /**
   * Create middleware for Express to add correlation ID to all requests
   */
  createCorrelationMiddleware() {
    return (req, res, next) => {
      // Add correlation ID to request
      const correlationId = this.getCorrelationId(req);
      
      // Add to response headers
      res.set('X-Correlation-ID', correlationId);
      
      // Add error handler method to response
      res.handleError = (errorCode, customMessage = null, context = {}) => {
        this.handleErrorResponse(res, errorCode, customMessage, {
          ...context,
          endpoint: req.route?.path || req.path,
          method: req.method,
          correlationId
        });
      };
      
      next();
    };
  }
}

// Export singleton instance
const errorHandler = new StandardizedErrorHandler();

module.exports = {
  StandardizedErrorHandler,
  errorHandler,
  ERROR_STATUS_CODES,
  USER_FRIENDLY_MESSAGES,
  ERROR_SEVERITY,
  RECOVERY_SUGGESTIONS
};
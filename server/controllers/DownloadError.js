/**
 * Unified DownloadError Class
 * 
 * Provides consistent error handling across the entire download orchestrator system.
 * This replaces the fragmented error handling that was causing "Photo not found"
 * and undefined property access errors throughout the codebase.
 */

class DownloadError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.correlationId = details.correlationId || null;
    
    // Error context for debugging
    this.context = {
      stage: details.stage || 'unknown',
      sessionId: details.sessionId || null,
      userId: details.userId || null,
      photoId: details.photoId || null,
      filename: details.filename || null,
      clientKey: details.clientKey || null
    };
    
    // Capture stack trace
    Error.captureStackTrace(this, DownloadError);
  }

  /**
   * Convert error to standardized response format
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        stage: this.context.stage
      },
      // Include context only in development for debugging
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          context: this.context,
          details: this.details
        }
      })
    };
  }

  /**
   * Get HTTP status code based on error code
   */
  getStatusCode() {
    const statusMap = {
      // Authentication & Authorization
      'MISSING_CREDENTIALS': 400,
      'INVALID_TOKEN': 401,
      'EXPIRED_ACCESS': 401,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      
      // Resource Not Found
      'SESSION_NOT_FOUND': 404,
      'PHOTO_NOT_FOUND': 404,
      'FILE_NOT_FOUND': 404,
      'POLICY_NOT_FOUND': 404,
      
      // Business Logic
      'PAYMENT_REQUIRED': 402,
      'QUOTA_EXCEEDED': 402,
      'ENTITLEMENT_DENIED': 403,
      'INVALID_PRICING_MODEL': 400,
      'INVALID_FILE_FORMAT': 400,
      
      // Rate Limiting
      'RATE_LIMIT_EXCEEDED': 429,
      
      // Server Errors
      'DATABASE_ERROR': 500,
      'STORAGE_ERROR': 500,
      'PROCESSING_ERROR': 500,
      'EXTERNAL_SERVICE_ERROR': 502,
      'TIMEOUT_ERROR': 504
    };
    
    return statusMap[this.code] || 500;
  }

  /**
   * Get user-friendly message
   */
  getUserFriendlyMessage() {
    const friendlyMessages = {
      'MISSING_CREDENTIALS': 'Authentication required. Please provide valid credentials.',
      'INVALID_TOKEN': 'Your access token is invalid or expired. Please refresh and try again.',
      'UNAUTHORIZED': 'You are not authorized to access this resource.',
      'SESSION_NOT_FOUND': 'The requested session could not be found.',
      'PHOTO_NOT_FOUND': 'The requested photo could not be found in this session.',
      'FILE_NOT_FOUND': 'The requested file is not available. It may have been removed or moved.',
      'PAYMENT_REQUIRED': 'Payment is required to download this photo.',
      'QUOTA_EXCEEDED': 'Download quota exceeded. Payment required for additional downloads.',
      'ENTITLEMENT_DENIED': 'You do not have permission to download this photo.',
      'RATE_LIMIT_EXCEEDED': 'Too many requests. Please slow down and try again.',
      'DATABASE_ERROR': 'A database error occurred. Please try again.',
      'STORAGE_ERROR': 'File storage error. Please try again later.',
      'PROCESSING_ERROR': 'An error occurred while processing your request.',
      'TIMEOUT_ERROR': 'Request timed out. Please try again.'
    };
    
    return friendlyMessages[this.code] || this.message;
  }

  /**
   * Static factory methods for common error types
   */
  
  static sessionNotFound(sessionId, correlationId = null) {
    return new DownloadError('SESSION_NOT_FOUND', `Session ${sessionId} not found`, {
      sessionId,
      correlationId,
      stage: 'authentication'
    });
  }
  
  static photoNotFound(photoId, sessionId = null, correlationId = null) {
    return new DownloadError('PHOTO_NOT_FOUND', `Photo ${photoId} not found`, {
      photoId,
      sessionId,
      correlationId,
      stage: 'file_lookup'
    });
  }
  
  static fileNotFound(filename, sessionId = null, correlationId = null) {
    return new DownloadError('FILE_NOT_FOUND', `File ${filename} not found in session`, {
      filename,
      sessionId,
      correlationId,
      stage: 'file_lookup'
    });
  }
  
  static invalidToken(token, correlationId = null) {
    return new DownloadError('INVALID_TOKEN', 'Invalid or expired access token', {
      token: token ? token.substring(0, 8) + '...' : null,
      correlationId,
      stage: 'authentication'
    });
  }
  
  static paymentRequired(sessionId, photoId = null, correlationId = null) {
    return new DownloadError('PAYMENT_REQUIRED', 'Payment required to download this photo', {
      sessionId,
      photoId,
      correlationId,
      stage: 'entitlement'
    });
  }
  
  static quotaExceeded(sessionId, userId = null, correlationId = null) {
    return new DownloadError('QUOTA_EXCEEDED', 'Download quota exceeded', {
      sessionId,
      userId,
      correlationId,
      stage: 'entitlement'
    });
  }
  
  static databaseError(operation, error, correlationId = null) {
    return new DownloadError('DATABASE_ERROR', `Database error during ${operation}`, {
      operation,
      originalError: error.message,
      correlationId,
      stage: 'database'
    });
  }
  
  static storageError(operation, filename = null, correlationId = null) {
    return new DownloadError('STORAGE_ERROR', `Storage error during ${operation}`, {
      operation,
      filename,
      correlationId,
      stage: 'delivery'
    });
  }
  
  static processingError(stage, details, correlationId = null) {
    return new DownloadError('PROCESSING_ERROR', `Processing error in ${stage}`, {
      stage,
      ...details,
      correlationId
    });
  }

  /**
   * Check if error is retryable
   */
  isRetryable() {
    const retryableCodes = [
      'DATABASE_ERROR',
      'STORAGE_ERROR', 
      'EXTERNAL_SERVICE_ERROR',
      'TIMEOUT_ERROR'
    ];
    return retryableCodes.includes(this.code);
  }

  /**
   * Check if error should trigger alert
   */
  shouldAlert() {
    const alertCodes = [
      'DATABASE_ERROR',
      'STORAGE_ERROR',
      'EXTERNAL_SERVICE_ERROR',
      'PROCESSING_ERROR'
    ];
    return alertCodes.includes(this.code);
  }

  /**
   * Get recovery suggestions for the client
   */
  getRecoverySuggestions() {
    const suggestions = {
      'INVALID_TOKEN': ['refresh_token', 'reauthenticate'],
      'EXPIRED_ACCESS': ['refresh_token', 'renew_access'],
      'PAYMENT_REQUIRED': ['make_payment', 'upgrade_plan'],
      'QUOTA_EXCEEDED': ['make_payment', 'wait_for_reset'],
      'RATE_LIMIT_EXCEEDED': ['wait_and_retry', 'reduce_frequency'],
      'DATABASE_ERROR': ['retry_request', 'contact_support'],
      'STORAGE_ERROR': ['retry_request', 'contact_support'],
      'TIMEOUT_ERROR': ['retry_request', 'check_connection']
    };
    
    return suggestions[this.code] || ['contact_support'];
  }
}

module.exports = DownloadError;
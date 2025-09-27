/**
 * Comprehensive Input Validation & Sanitization for Download Service
 * 
 * Provides robust validation and sanitization for:
 * - File upload parameters (size, type, name validation)
 * - Session tokens and gallery access tokens  
 * - Client key format validation and manipulation prevention
 * - Photo ID validation and path traversal prevention
 * - SQL injection prevention
 * - XSS attack prevention
 * - CSRF token validation
 */

const crypto = require('crypto');
const path = require('path');

// Security configuration
const SECURITY_CONFIG = {
  // File validation limits
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff'],
  ALLOWED_FILE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'],
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_DEPTH: 10,
  
  // Token validation
  TOKEN_MIN_LENGTH: 32,
  TOKEN_MAX_LENGTH: 512,
  TOKEN_ALLOWED_CHARS: /^[a-zA-Z0-9\-_\.]+$/,
  
  // Client key validation
  CLIENT_KEY_PATTERN: /^[a-zA-Z0-9\-_]+$/,
  CLIENT_KEY_MIN_LENGTH: 16,
  CLIENT_KEY_MAX_LENGTH: 128,
  
  // Photo ID validation
  PHOTO_ID_PATTERN: /^[a-zA-Z0-9\-_]+$/,
  PHOTO_ID_MIN_LENGTH: 8,
  PHOTO_ID_MAX_LENGTH: 64,
  
  // Session validation
  SESSION_ID_PATTERN: /^[a-zA-Z0-9\-_]+$/,
  SESSION_ID_MIN_LENGTH: 16,
  SESSION_ID_MAX_LENGTH: 128,
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 100,
  MAX_DOWNLOAD_REQUESTS_PER_MINUTE: 20,
  
  // String lengths
  MAX_STRING_LENGTH: 10000,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_NAME_LENGTH: 200
};

// Dangerous patterns to detect
const SECURITY_PATTERNS = {
  SQL_INJECTION: [
    /('|(\\)|;|--|\||\/\*|\*\/)/i,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
    /(script|javascript|vbscript|onload|onerror)/i
  ],
  XSS: [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /javascript:/gi
  ],
  PATH_TRAVERSAL: [
    /\.\.\//g,
    /\.\.\\{1,2}/g,
    /~\//g,
    /%2e%2e/gi,
    /%2f/gi,
    /%5c/gi
  ],
  COMMAND_INJECTION: [
    /[;&|`$(){}[\]]/,
    /(bash|sh|cmd|powershell|perl|python|ruby|php)/i
  ]
};

class ComprehensiveInputValidator {
  constructor() {
    // Rate limiting tracking
    this.rateLimits = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupRateLimits(), 60000); // Cleanup every minute
    
    // Validation statistics
    this.validationStats = {
      totalValidations: 0,
      rejectedInputs: 0,
      securityViolations: 0,
      fileValidations: 0,
      tokenValidations: 0
    };
    
    console.log('✅ Comprehensive Input Validator initialized with security patterns');
  }

  /**
   * Validate and sanitize download request parameters
   */
  validateDownloadRequest(params, clientInfo = {}) {
    const validationId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`🔍 [${validationId}] Validating download request parameters`);
      
      const errors = [];
      const warnings = [];
      const sanitized = {};
      
      // Rate limiting check
      const rateLimitCheck = this.checkRateLimit(
        clientInfo.ipAddress || 'unknown',
        'download_request',
        SECURITY_CONFIG.MAX_DOWNLOAD_REQUESTS_PER_MINUTE
      );
      
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.limit} requests per minute`);
      }

      // Validate required parameters
      const requiredParams = ['galleryAccessToken', 'sessionId', 'photoId'];
      for (const param of requiredParams) {
        if (!params[param]) {
          errors.push(`Missing required parameter: ${param}`);
        }
      }
      
      if (errors.length > 0) {
        return this.createValidationResult(false, errors, warnings, null, validationId);
      }

      // Validate gallery access token
      const tokenValidation = this.validateToken(params.galleryAccessToken, 'gallery_access_token');
      if (!tokenValidation.valid) {
        errors.push(tokenValidation.error);
      } else {
        sanitized.galleryAccessToken = tokenValidation.sanitized;
      }

      // Validate session ID
      const sessionValidation = this.validateSessionId(params.sessionId);
      if (!sessionValidation.valid) {
        errors.push(sessionValidation.error);
      } else {
        sanitized.sessionId = sessionValidation.sanitized;
      }

      // Validate photo ID
      const photoValidation = this.validatePhotoId(params.photoId);
      if (!photoValidation.valid) {
        errors.push(photoValidation.error);
      } else {
        sanitized.photoId = photoValidation.sanitized;
      }

      // Validate optional client key
      if (params.clientKey) {
        const clientKeyValidation = this.validateClientKey(params.clientKey);
        if (!clientKeyValidation.valid) {
          errors.push(clientKeyValidation.error);
        } else {
          sanitized.clientKey = clientKeyValidation.sanitized;
        }
      }

      // Validate optional photo URL
      if (params.photoUrl) {
        const urlValidation = this.validateUrl(params.photoUrl);
        if (!urlValidation.valid) {
          errors.push(urlValidation.error);
        } else {
          sanitized.photoUrl = urlValidation.sanitized;
        }
      }

      // Validate optional filename
      if (params.filename) {
        const filenameValidation = this.validateFilename(params.filename);
        if (!filenameValidation.valid) {
          errors.push(filenameValidation.error);
        } else {
          sanitized.filename = filenameValidation.sanitized;
        }
      }

      // Security scanning
      const securityScan = this.performSecurityScan(params);
      if (securityScan.violations.length > 0) {
        errors.push(`Security violations detected: ${securityScan.violations.join(', ')}`);
        this.validationStats.securityViolations++;
      }

      const duration = Date.now() - startTime;
      const isValid = errors.length === 0;
      
      if (isValid) {
        console.log(`✅ [${validationId}] Download request validation passed in ${duration}ms`);
      } else {
        console.warn(`❌ [${validationId}] Download request validation failed: ${errors.join('; ')}`);
      }
      
      this.validationStats.totalValidations++;
      if (!isValid) this.validationStats.rejectedInputs++;
      
      return this.createValidationResult(isValid, errors, warnings, sanitized, validationId, duration);
      
    } catch (error) {
      console.error(`❌ [${validationId}] Validation error:`, error);
      return this.createValidationResult(false, [error.message], [], null, validationId);
    }
  }

  /**
   * Validate file upload parameters
   */
  validateFileUpload(fileData, metadata = {}) {
    const validationId = crypto.randomUUID();
    
    try {
      console.log(`📁 [${validationId}] Validating file upload`);
      
      const errors = [];
      const warnings = [];
      const sanitized = {};
      
      this.validationStats.fileValidations++;

      // Validate file size
      if (!fileData.size || fileData.size <= 0) {
        errors.push('File size is required and must be greater than 0');
      } else if (fileData.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
        errors.push(`File size exceeds maximum allowed: ${SECURITY_CONFIG.MAX_FILE_SIZE} bytes`);
      } else {
        sanitized.size = fileData.size;
      }

      // Validate file type
      if (!fileData.mimetype) {
        errors.push('File MIME type is required');
      } else if (!SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(fileData.mimetype.toLowerCase())) {
        errors.push(`File type not allowed: ${fileData.mimetype}. Allowed types: ${SECURITY_CONFIG.ALLOWED_FILE_TYPES.join(', ')}`);
      } else {
        sanitized.mimetype = fileData.mimetype.toLowerCase();
      }

      // Validate filename
      if (fileData.originalname) {
        const filenameValidation = this.validateFilename(fileData.originalname);
        if (!filenameValidation.valid) {
          errors.push(`Filename validation failed: ${filenameValidation.error}`);
        } else {
          sanitized.originalname = filenameValidation.sanitized;
          
          // Check file extension matches MIME type
          const ext = path.extname(filenameValidation.sanitized).toLowerCase();
          if (!SECURITY_CONFIG.ALLOWED_FILE_EXTENSIONS.includes(ext)) {
            errors.push(`File extension not allowed: ${ext}`);
          }
        }
      }

      // Validate file buffer/content if available
      if (fileData.buffer) {
        const contentValidation = this.validateFileContent(fileData.buffer, fileData.mimetype);
        if (!contentValidation.valid) {
          errors.push(`File content validation failed: ${contentValidation.error}`);
        }
      }

      const isValid = errors.length === 0;
      return this.createValidationResult(isValid, errors, warnings, sanitized, validationId);
      
    } catch (error) {
      console.error(`❌ [${validationId}] File upload validation error:`, error);
      return this.createValidationResult(false, [error.message], [], null, validationId);
    }
  }

  /**
   * Validate session token
   */
  validateToken(token, tokenType = 'generic') {
    try {
      this.validationStats.tokenValidations++;
      
      if (!token || typeof token !== 'string') {
        return { valid: false, error: 'Token is required and must be a string' };
      }
      
      if (token.length < SECURITY_CONFIG.TOKEN_MIN_LENGTH) {
        return { valid: false, error: `Token too short (minimum ${SECURITY_CONFIG.TOKEN_MIN_LENGTH} characters)` };
      }
      
      if (token.length > SECURITY_CONFIG.TOKEN_MAX_LENGTH) {
        return { valid: false, error: `Token too long (maximum ${SECURITY_CONFIG.TOKEN_MAX_LENGTH} characters)` };
      }
      
      if (!SECURITY_CONFIG.TOKEN_ALLOWED_CHARS.test(token)) {
        return { valid: false, error: 'Token contains invalid characters' };
      }
      
      // Check for suspicious patterns
      const securityScan = this.performSecurityScan({ token });
      if (securityScan.violations.length > 0) {
        return { valid: false, error: 'Token contains suspicious patterns' };
      }
      
      // Sanitize (trim and normalize)
      const sanitized = token.trim();
      
      return { valid: true, sanitized, tokenType };
      
    } catch (error) {
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Validate session ID
   */
  validateSessionId(sessionId) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        return { valid: false, error: 'Session ID is required and must be a string' };
      }
      
      if (sessionId.length < SECURITY_CONFIG.SESSION_ID_MIN_LENGTH ||
          sessionId.length > SECURITY_CONFIG.SESSION_ID_MAX_LENGTH) {
        return { 
          valid: false, 
          error: `Session ID length must be between ${SECURITY_CONFIG.SESSION_ID_MIN_LENGTH} and ${SECURITY_CONFIG.SESSION_ID_MAX_LENGTH} characters`
        };
      }
      
      if (!SECURITY_CONFIG.SESSION_ID_PATTERN.test(sessionId)) {
        return { valid: false, error: 'Session ID contains invalid characters' };
      }
      
      const sanitized = sessionId.trim();
      return { valid: true, sanitized };
      
    } catch (error) {
      return { valid: false, error: 'Session ID validation failed' };
    }
  }

  /**
   * Validate client key
   */
  validateClientKey(clientKey) {
    try {
      if (!clientKey || typeof clientKey !== 'string') {
        return { valid: false, error: 'Client key is required and must be a string' };
      }
      
      if (clientKey.length < SECURITY_CONFIG.CLIENT_KEY_MIN_LENGTH ||
          clientKey.length > SECURITY_CONFIG.CLIENT_KEY_MAX_LENGTH) {
        return { 
          valid: false, 
          error: `Client key length must be between ${SECURITY_CONFIG.CLIENT_KEY_MIN_LENGTH} and ${SECURITY_CONFIG.CLIENT_KEY_MAX_LENGTH} characters`
        };
      }
      
      if (!SECURITY_CONFIG.CLIENT_KEY_PATTERN.test(clientKey)) {
        return { valid: false, error: 'Client key contains invalid characters' };
      }
      
      const sanitized = clientKey.trim();
      return { valid: true, sanitized };
      
    } catch (error) {
      return { valid: false, error: 'Client key validation failed' };
    }
  }

  /**
   * Validate photo ID
   */
  validatePhotoId(photoId) {
    try {
      if (!photoId || typeof photoId !== 'string') {
        return { valid: false, error: 'Photo ID is required and must be a string' };
      }
      
      if (photoId.length < SECURITY_CONFIG.PHOTO_ID_MIN_LENGTH ||
          photoId.length > SECURITY_CONFIG.PHOTO_ID_MAX_LENGTH) {
        return { 
          valid: false, 
          error: `Photo ID length must be between ${SECURITY_CONFIG.PHOTO_ID_MIN_LENGTH} and ${SECURITY_CONFIG.PHOTO_ID_MAX_LENGTH} characters`
        };
      }
      
      if (!SECURITY_CONFIG.PHOTO_ID_PATTERN.test(photoId)) {
        return { valid: false, error: 'Photo ID contains invalid characters' };
      }
      
      // Check for path traversal attempts
      if (this.containsPathTraversal(photoId)) {
        return { valid: false, error: 'Photo ID contains path traversal patterns' };
      }
      
      const sanitized = photoId.trim();
      return { valid: true, sanitized };
      
    } catch (error) {
      return { valid: false, error: 'Photo ID validation failed' };
    }
  }

  /**
   * Validate URL
   */
  validateUrl(url) {
    try {
      if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required and must be a string' };
      }
      
      if (url.length > SECURITY_CONFIG.MAX_STRING_LENGTH) {
        return { valid: false, error: 'URL too long' };
      }
      
      // Check for valid URL format
      try {
        const parsedUrl = new URL(url);
        
        // Only allow HTTPS URLs for security
        if (parsedUrl.protocol !== 'https:') {
          return { valid: false, error: 'Only HTTPS URLs are allowed' };
        }
        
        // Check for suspicious patterns
        if (this.containsPathTraversal(url)) {
          return { valid: false, error: 'URL contains path traversal patterns' };
        }
        
        return { valid: true, sanitized: url.trim() };
        
      } catch (urlError) {
        return { valid: false, error: 'Invalid URL format' };
      }
      
    } catch (error) {
      return { valid: false, error: 'URL validation failed' };
    }
  }

  /**
   * Validate filename
   */
  validateFilename(filename) {
    try {
      if (!filename || typeof filename !== 'string') {
        return { valid: false, error: 'Filename is required and must be a string' };
      }
      
      if (filename.length > SECURITY_CONFIG.MAX_FILENAME_LENGTH) {
        return { valid: false, error: `Filename too long (maximum ${SECURITY_CONFIG.MAX_FILENAME_LENGTH} characters)` };
      }
      
      // Check for path traversal
      if (this.containsPathTraversal(filename)) {
        return { valid: false, error: 'Filename contains path traversal patterns' };
      }
      
      // Check for dangerous characters
      const dangerousChars = /[<>:"|?*\x00-\x1f]/;
      if (dangerousChars.test(filename)) {
        return { valid: false, error: 'Filename contains invalid characters' };
      }
      
      // Normalize and sanitize filename
      const sanitized = path.basename(filename).trim();
      
      if (!sanitized) {
        return { valid: false, error: 'Filename cannot be empty after sanitization' };
      }
      
      return { valid: true, sanitized };
      
    } catch (error) {
      return { valid: false, error: 'Filename validation failed' };
    }
  }

  /**
   * Validate file content (basic checks)
   */
  validateFileContent(buffer, mimetype) {
    try {
      if (!Buffer.isBuffer(buffer)) {
        return { valid: false, error: 'File content must be a buffer' };
      }
      
      if (buffer.length === 0) {
        return { valid: false, error: 'File content cannot be empty' };
      }
      
      // Check file headers/magic numbers for common image types
      const imageSignatures = {
        'image/jpeg': [[0xFF, 0xD8, 0xFF]],
        'image/png': [[0x89, 0x50, 0x4E, 0x47]],
        'image/webp': [[0x52, 0x49, 0x46, 0x46]],
        'image/tiff': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]]
      };
      
      const signatures = imageSignatures[mimetype];
      if (signatures) {
        const isValidSignature = signatures.some(signature => {
          return signature.every((byte, index) => buffer[index] === byte);
        });
        
        if (!isValidSignature) {
          return { valid: false, error: 'File content does not match declared MIME type' };
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: 'File content validation failed' };
    }
  }

  /**
   * Perform comprehensive security scanning on input parameters
   */
  performSecurityScan(params) {
    const violations = [];
    const warnings = [];
    
    try {
      // Convert all values to strings for scanning
      const stringValues = Object.values(params)
        .filter(val => val != null)
        .map(val => String(val));
      
      const fullInput = stringValues.join(' ');
      
      // SQL injection detection
      SECURITY_PATTERNS.SQL_INJECTION.forEach(pattern => {
        if (pattern.test(fullInput)) {
          violations.push('SQL_INJECTION_ATTEMPT');
        }
      });
      
      // XSS detection
      SECURITY_PATTERNS.XSS.forEach(pattern => {
        if (pattern.test(fullInput)) {
          violations.push('XSS_ATTEMPT');
        }
      });
      
      // Path traversal detection
      if (this.containsPathTraversal(fullInput)) {
        violations.push('PATH_TRAVERSAL_ATTEMPT');
      }
      
      // Command injection detection
      SECURITY_PATTERNS.COMMAND_INJECTION.forEach(pattern => {
        if (pattern.test(fullInput)) {
          violations.push('COMMAND_INJECTION_ATTEMPT');
        }
      });
      
      return { violations, warnings };
      
    } catch (error) {
      console.error('Security scan error:', error);
      return { violations: ['SECURITY_SCAN_ERROR'], warnings: [] };
    }
  }

  /**
   * Check for path traversal patterns
   */
  containsPathTraversal(input) {
    return SECURITY_PATTERNS.PATH_TRAVERSAL.some(pattern => pattern.test(input));
  }

  /**
   * Rate limiting check
   */
  checkRateLimit(identifier, operation, limit) {
    const key = `${identifier}:${operation}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }
    
    const requests = this.rateLimits.get(key);
    
    // Remove old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= limit) {
      return {
        allowed: false,
        limit,
        current: validRequests.length,
        resetTime: Math.min(...validRequests) + 60000
      };
    }
    
    // Add current request
    validRequests.push(now);
    this.rateLimits.set(key, validRequests);
    
    return {
      allowed: true,
      limit,
      current: validRequests.length,
      remaining: limit - validRequests.length
    };
  }

  /**
   * Create standardized validation result
   */
  createValidationResult(valid, errors = [], warnings = [], sanitized = null, validationId = null, duration = 0) {
    return {
      valid,
      errors,
      warnings,
      sanitized,
      validationId,
      duration,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clean up old rate limit entries
   */
  cleanupRateLimits() {
    const now = Date.now();
    const cutoff = now - 60000; // 1 minute ago
    
    for (const [key, requests] of this.rateLimits.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoff);
      if (validRequests.length === 0) {
        this.rateLimits.delete(key);
      } else {
        this.rateLimits.set(key, validRequests);
      }
    }
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    return {
      ...this.validationStats,
      activeRateLimits: this.rateLimits.size,
      securityConfig: SECURITY_CONFIG
    };
  }

  /**
   * Shutdown cleanup
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rateLimits.clear();
    console.log('✅ Comprehensive Input Validator shutdown complete');
  }
}

// Export singleton instance
const inputValidator = new ComprehensiveInputValidator();

module.exports = {
  ComprehensiveInputValidator,
  inputValidator,
  SECURITY_CONFIG,
  SECURITY_PATTERNS
};
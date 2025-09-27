/**
 * External Service Integration Handler
 * 
 * Provides robust error handling for external services including:
 * - Stripe API failures (rate limits, network timeouts, invalid keys)
 * - R2 storage failures (network issues, bucket access, quota exceeded)
 * - Firebase authentication failures
 * - Circuit breaker patterns for failing services
 * - Automatic retry with exponential backoff
 * - Service health monitoring and degraded mode operation
 */

const crypto = require('crypto');

// Service-specific error patterns
const SERVICE_ERROR_PATTERNS = {
  STRIPE: {
    RATE_LIMIT: /rate_limit|too many requests/i,
    INVALID_API_KEY: /invalid api key|authentication failed/i,
    CARD_ERROR: /card_error|card declined/i,
    NETWORK_ERROR: /network error|connection|timeout/i,
    WEBHOOK_ERROR: /webhook|signature/i,
    PAYMENT_FAILED: /payment_intent.*failed|charge.*failed/i
  },
  R2: {
    ACCESS_DENIED: /access denied|forbidden|unauthorized/i,
    BUCKET_ERROR: /bucket.*not found|bucket.*error/i,
    QUOTA_EXCEEDED: /quota.*exceeded|storage.*limit/i,
    NETWORK_ERROR: /network|connection|timeout|socket/i,
    INVALID_KEY: /invalid.*key|key.*not found/i,
    MULTIPART_ERROR: /multipart.*upload|upload.*id/i
  },
  FIREBASE: {
    AUTH_ERROR: /authentication.*failed|invalid.*token/i,
    PERMISSION_DENIED: /permission.*denied|insufficient.*permissions/i,
    NETWORK_ERROR: /network|connection|timeout/i,
    QUOTA_EXCEEDED: /quota.*exceeded|usage.*limit/i,
    SERVICE_UNAVAILABLE: /service.*unavailable|temporarily.*unavailable/i
  }
};

// Circuit breaker states
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN: 'HALF_OPEN' // Testing if service is back
};

class ExternalServiceHandler {
  constructor() {
    // Circuit breaker configuration for each service
    this.circuits = {
      stripe: {
        state: CIRCUIT_STATES.CLOSED,
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0,
        nextAttempt: null,
        config: {
          failureThreshold: 5,
          recoveryTimeout: 60000, // 60 seconds
          halfOpenMaxCalls: 3,
          timeout: 30000 // 30 seconds
        }
      },
      r2: {
        state: CIRCUIT_STATES.CLOSED,
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0,
        nextAttempt: null,
        config: {
          failureThreshold: 10, // R2 can be more resilient
          recoveryTimeout: 30000, // 30 seconds
          halfOpenMaxCalls: 5,
          timeout: 60000 // 60 seconds for file operations
        }
      },
      firebase: {
        state: CIRCUIT_STATES.CLOSED,
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0,
        nextAttempt: null,
        config: {
          failureThreshold: 3, // Auth failures should be fast
          recoveryTimeout: 120000, // 2 minutes
          halfOpenMaxCalls: 2,
          timeout: 15000 // 15 seconds
        }
      }
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitterRange: 0.1 // 10% jitter
    };

    // Service health metrics
    this.healthMetrics = {
      stripe: { totalCalls: 0, failures: 0, lastError: null, lastSuccess: null },
      r2: { totalCalls: 0, failures: 0, lastError: null, lastSuccess: null },
      firebase: { totalCalls: 0, failures: 0, lastError: null, lastSuccess: null }
    };

    console.log('✅ External Service Handler initialized with circuit breaker patterns');
  }

  /**
   * Execute operation with circuit breaker protection and retry logic
   */
  async executeWithProtection(service, operation, options = {}) {
    const {
      operationName = 'unknown',
      timeout = this.circuits[service].config.timeout,
      retryableErrors = null,
      context = {},
      fallback = null
    } = options;

    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    console.log(`🔄 [${operationId}] Executing ${service.toUpperCase()} operation: ${operationName}`);

    try {
      // Check circuit breaker state
      const circuitCheck = this.checkCircuitBreaker(service);
      if (!circuitCheck.allowed) {
        console.warn(`⚡ [${operationId}] Circuit breaker OPEN for ${service}: ${circuitCheck.reason}`);
        
        if (fallback) {
          return await this.executeFallback(fallback, context, operationId);
        }
        
        throw new Error(`Service ${service} is currently unavailable: ${circuitCheck.reason}`);
      }

      // Execute with retry logic
      const result = await this.executeWithRetry(
        service,
        operation,
        operationId,
        timeout,
        retryableErrors,
        context
      );

      // Record success
      this.recordSuccess(service, Date.now() - startTime);
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${operationId}] ${service.toUpperCase()} operation completed in ${duration}ms`);
      
      return {
        success: true,
        result,
        operationId,
        service,
        duration,
        circuitState: this.circuits[service].state
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failure and check circuit breaker
      this.recordFailure(service, error, duration);
      
      console.error(`❌ [${operationId}] ${service.toUpperCase()} operation failed after ${duration}ms:`, error.message);
      
      // Try fallback if available
      if (fallback) {
        try {
          console.log(`🔄 [${operationId}] Attempting fallback for ${service}`);
          const fallbackResult = await this.executeFallback(fallback, context, operationId);
          
          return {
            success: true,
            result: fallbackResult,
            operationId,
            service,
            duration,
            usedFallback: true,
            originalError: error.message,
            circuitState: this.circuits[service].state
          };
        } catch (fallbackError) {
          console.error(`❌ [${operationId}] Fallback also failed:`, fallbackError.message);
          error.fallbackError = fallbackError.message;
        }
      }
      
      // Enhance error with service context
      throw this.enhanceServiceError(error, service, operationId, duration, context);
    }
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry(service, operation, operationId, timeout, retryableErrors, context) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        console.log(`🎯 [${operationId}] ${service.toUpperCase()} attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}`);
        
        // Execute with timeout protection
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise(timeout, `${service} operation timeout after ${timeout}ms`)
        ]);
        
        if (attempt > 0) {
          console.log(`✅ [${operationId}] ${service.toUpperCase()} succeeded on retry ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        const errorType = this.classifyServiceError(service, error);
        const shouldRetry = attempt < this.retryConfig.maxRetries && 
                           this.isRetryableError(service, error, retryableErrors);
        
        console.error(`❌ [${operationId}] ${service.toUpperCase()} attempt ${attempt + 1} failed:`, {
          errorType,
          message: error.message,
          shouldRetry
        });
        
        if (shouldRetry) {
          const delay = this.calculateRetryDelay(attempt);
          console.log(`⏳ [${operationId}] Retrying ${service.toUpperCase()} in ${delay}ms`);
          await this.delay(delay);
        } else {
          break;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check circuit breaker state and decide if operation should proceed
   */
  checkCircuitBreaker(service) {
    const circuit = this.circuits[service];
    const now = Date.now();
    
    switch (circuit.state) {
      case CIRCUIT_STATES.CLOSED:
        return { allowed: true };
        
      case CIRCUIT_STATES.OPEN:
        if (now >= circuit.nextAttempt) {
          // Transition to half-open
          circuit.state = CIRCUIT_STATES.HALF_OPEN;
          circuit.successCount = 0;
          console.log(`🔄 Circuit breaker for ${service} transitioning to HALF-OPEN`);
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: `Circuit breaker open until ${new Date(circuit.nextAttempt).toISOString()}`
        };
        
      case CIRCUIT_STATES.HALF_OPEN:
        if (circuit.successCount < circuit.config.halfOpenMaxCalls) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: `Half-open circuit breaker limit reached`
        };
        
      default:
        return { allowed: true };
    }
  }

  /**
   * Record successful operation and update circuit breaker
   */
  recordSuccess(service, duration) {
    const circuit = this.circuits[service];
    const metrics = this.healthMetrics[service];
    
    // Update metrics
    metrics.totalCalls++;
    metrics.lastSuccess = new Date().toISOString();
    
    // Update circuit breaker
    if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
      circuit.successCount++;
      if (circuit.successCount >= circuit.config.halfOpenMaxCalls) {
        // Transition back to closed
        circuit.state = CIRCUIT_STATES.CLOSED;
        circuit.failureCount = 0;
        circuit.lastFailureTime = null;
        circuit.nextAttempt = null;
        console.log(`✅ Circuit breaker for ${service} CLOSED - service recovered`);
      }
    } else if (circuit.state === CIRCUIT_STATES.CLOSED && circuit.failureCount > 0) {
      // Reset failure count on successful operation
      circuit.failureCount = Math.max(0, circuit.failureCount - 1);
    }
  }

  /**
   * Record failed operation and update circuit breaker
   */
  recordFailure(service, error, duration) {
    const circuit = this.circuits[service];
    const metrics = this.healthMetrics[service];
    
    // Update metrics
    metrics.totalCalls++;
    metrics.failures++;
    metrics.lastError = {
      message: error.message,
      type: this.classifyServiceError(service, error),
      timestamp: new Date().toISOString(),
      duration
    };
    
    // Update circuit breaker
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();
    
    if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
      // Transition back to open
      circuit.state = CIRCUIT_STATES.OPEN;
      circuit.nextAttempt = Date.now() + circuit.config.recoveryTimeout;
      console.warn(`⚡ Circuit breaker for ${service} reopened due to failure`);
    } else if (circuit.state === CIRCUIT_STATES.CLOSED && 
               circuit.failureCount >= circuit.config.failureThreshold) {
      // Transition to open
      circuit.state = CIRCUIT_STATES.OPEN;
      circuit.nextAttempt = Date.now() + circuit.config.recoveryTimeout;
      console.warn(`⚡ Circuit breaker for ${service} OPENED after ${circuit.failureCount} failures`);
    }
  }

  /**
   * Classify service-specific errors
   */
  classifyServiceError(service, error) {
    const message = error.message || error.toString();
    const patterns = SERVICE_ERROR_PATTERNS[service.toUpperCase()] || {};
    
    for (const [errorType, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        return errorType;
      }
    }
    
    // Check for common HTTP status codes
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      if (status === 429) return 'RATE_LIMIT';
      if (status === 401 || status === 403) return 'AUTH_ERROR';
      if (status >= 500) return 'SERVER_ERROR';
      if (status === 408 || status === 504) return 'TIMEOUT_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(service, error, customRetryableErrors = null) {
    if (customRetryableErrors) {
      return customRetryableErrors.includes(this.classifyServiceError(service, error));
    }
    
    const errorType = this.classifyServiceError(service, error);
    
    // Service-specific retryable errors
    const retryableByService = {
      stripe: ['RATE_LIMIT', 'NETWORK_ERROR', 'TIMEOUT_ERROR'],
      r2: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'QUOTA_EXCEEDED'],
      firebase: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVICE_UNAVAILABLE']
    };
    
    const retryableErrors = retryableByService[service] || [];
    return retryableErrors.includes(errorType);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(attempt) {
    const exponentialDelay = this.retryConfig.baseDelay * 
      Math.pow(this.retryConfig.backoffMultiplier, attempt);
    
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.retryConfig.jitterRange * (Math.random() - 0.5) * 2;
    
    return Math.max(1000, Math.round(cappedDelay + jitter)); // Minimum 1 second
  }

  /**
   * Execute fallback operation
   */
  async executeFallback(fallback, context, operationId) {
    console.log(`🛡️ [${operationId}] Executing fallback operation`);
    
    try {
      const result = await fallback(context);
      console.log(`✅ [${operationId}] Fallback operation succeeded`);
      return result;
    } catch (error) {
      console.error(`❌ [${operationId}] Fallback operation failed:`, error);
      throw error;
    }
  }

  /**
   * Enhance error with service-specific context
   */
  enhanceServiceError(error, service, operationId, duration, context) {
    const errorType = this.classifyServiceError(service, error);
    const circuit = this.circuits[service];
    
    const enhancedError = new Error(`${service.toUpperCase()} service error: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.service = service;
    enhancedError.errorType = errorType;
    enhancedError.operationId = operationId;
    enhancedError.duration = duration;
    enhancedError.context = context;
    enhancedError.circuitState = circuit.state;
    enhancedError.retryable = this.isRetryableError(service, error);
    enhancedError.timestamp = new Date().toISOString();
    
    // Add service-specific user-friendly messages
    enhancedError.userMessage = this.getUserFriendlyMessage(service, errorType);
    
    return enhancedError;
  }

  /**
   * Get user-friendly error messages for different service errors
   */
  getUserFriendlyMessage(service, errorType) {
    const messages = {
      stripe: {
        RATE_LIMIT: 'Payment processing is temporarily busy. Please try again shortly.',
        CARD_ERROR: 'There was an issue with your payment method. Please check and try again.',
        NETWORK_ERROR: 'Payment service is temporarily unavailable. Please try again.',
        PAYMENT_FAILED: 'Payment could not be processed. Please check your payment details.'
      },
      r2: {
        NETWORK_ERROR: 'File storage is temporarily unavailable. Please try again.',
        QUOTA_EXCEEDED: 'Storage capacity temporarily exceeded. Please try again later.',
        ACCESS_DENIED: 'File access is currently restricted. Please contact support.'
      },
      firebase: {
        AUTH_ERROR: 'Authentication service is temporarily unavailable. Please try again.',
        PERMISSION_DENIED: 'Access permissions are being verified. Please try again.',
        SERVICE_UNAVAILABLE: 'Authentication service is temporarily down. Please try again.'
      }
    };
    
    return messages[service]?.[errorType] || 
           `${service} service is temporarily unavailable. Please try again.`;
  }

  /**
   * Get health status of all services
   */
  getHealthStatus() {
    const now = Date.now();
    const healthStatus = {};
    
    Object.entries(this.circuits).forEach(([service, circuit]) => {
      const metrics = this.healthMetrics[service];
      const failureRate = metrics.totalCalls > 0 ? 
        (metrics.failures / metrics.totalCalls * 100) : 0;
      
      healthStatus[service] = {
        circuitState: circuit.state,
        healthy: circuit.state === CIRCUIT_STATES.CLOSED,
        failureCount: circuit.failureCount,
        failureRate: Math.round(failureRate * 100) / 100,
        totalCalls: metrics.totalCalls,
        lastError: metrics.lastError,
        lastSuccess: metrics.lastSuccess,
        nextAttempt: circuit.nextAttempt ? new Date(circuit.nextAttempt).toISOString() : null
      };
    });
    
    return healthStatus;
  }

  /**
   * Reset circuit breaker for a service (for testing/maintenance)
   */
  resetCircuitBreaker(service) {
    const circuit = this.circuits[service];
    if (circuit) {
      circuit.state = CIRCUIT_STATES.CLOSED;
      circuit.failureCount = 0;
      circuit.lastFailureTime = null;
      circuit.successCount = 0;
      circuit.nextAttempt = null;
      console.log(`🔄 Circuit breaker for ${service} manually reset`);
      return true;
    }
    return false;
  }

  /**
   * Create timeout promise for race conditions
   */
  createTimeoutPromise(timeout, message) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, timeout);
    });
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get comprehensive service statistics
   */
  getStatistics() {
    return {
      circuits: Object.fromEntries(
        Object.entries(this.circuits).map(([service, circuit]) => [
          service,
          {
            state: circuit.state,
            failureCount: circuit.failureCount,
            successCount: circuit.successCount,
            config: circuit.config
          }
        ])
      ),
      health: this.healthMetrics,
      config: this.retryConfig
    };
  }
}

// Export singleton instance
const externalServiceHandler = new ExternalServiceHandler();

module.exports = {
  ExternalServiceHandler,
  externalServiceHandler,
  CIRCUIT_STATES,
  SERVICE_ERROR_PATTERNS
};
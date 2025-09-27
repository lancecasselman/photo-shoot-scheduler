/**
 * Comprehensive Error Handling System for Payment Processing
 * 
 * Provides detailed error categorization, handling strategies,
 * and recovery mechanisms for all payment failure scenarios.
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, gte, sql } = require('drizzle-orm');
const { 
  downloadOrders,
  webhookEvents,
  photographySessions,
  users 
} = require('../shared/schema');

class ComprehensiveErrorHandler {
  constructor(pool = null) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.db = drizzle(this.pool);
    
    // Error classification and handling strategies
    this.errorCategories = {
      // User-fixable errors
      user_errors: {
        card_declined: {
          category: 'user_error',
          severity: 'low',
          retryable: true,
          userMessage: 'Your card was declined. Please try a different payment method.',
          merchantMessage: 'Card declined - customer should try different payment method',
          suggestedActions: ['try_different_card', 'contact_bank']
        },
        insufficient_funds: {
          category: 'user_error',
          severity: 'low',
          retryable: true,
          userMessage: 'Insufficient funds. Please check your account balance or try a different card.',
          merchantMessage: 'Insufficient funds - customer needs to add funds or use different card',
          suggestedActions: ['add_funds', 'try_different_card']
        },
        expired_card: {
          category: 'user_error',
          severity: 'low',
          retryable: true,
          userMessage: 'Your card has expired. Please update your payment information.',
          merchantMessage: 'Expired card - customer needs to update payment method',
          suggestedActions: ['update_card_info']
        },
        incorrect_cvc: {
          category: 'user_error',
          severity: 'low',
          retryable: true,
          userMessage: 'The security code (CVC) is incorrect. Please check and try again.',
          merchantMessage: 'Incorrect CVC - customer should verify security code',
          suggestedActions: ['verify_cvc']
        },
        authentication_required: {
          category: 'user_error',
          severity: 'medium',
          retryable: true,
          userMessage: 'Additional authentication required. Please complete the verification with your bank.',
          merchantMessage: 'Customer needs to complete 3D Secure authentication',
          suggestedActions: ['complete_3ds']
        }
      },
      
      // Temporary system errors
      temporary_errors: {
        processing_error: {
          category: 'temporary',
          severity: 'medium',
          retryable: true,
          retryDelay: 30000, // 30 seconds
          userMessage: 'Payment processing temporarily unavailable. Please try again in a moment.',
          merchantMessage: 'Temporary processing error - safe to retry',
          suggestedActions: ['retry_payment', 'wait_and_retry']
        },
        rate_limit: {
          category: 'temporary',
          severity: 'medium',
          retryable: true,
          retryDelay: 60000, // 1 minute
          userMessage: 'Too many requests. Please wait a moment and try again.',
          merchantMessage: 'Rate limited - retry after delay',
          suggestedActions: ['wait_and_retry']
        },
        api_connection_error: {
          category: 'temporary',
          severity: 'high',
          retryable: true,
          retryDelay: 10000, // 10 seconds
          userMessage: 'Connection error. Please try again.',
          merchantMessage: 'API connection failed - network issue',
          suggestedActions: ['retry_payment', 'check_network']
        }
      },
      
      // System configuration errors
      system_errors: {
        api_error: {
          category: 'system_error',
          severity: 'critical',
          retryable: false,
          userMessage: 'Payment system error. Please contact support.',
          merchantMessage: 'Stripe API error - requires investigation',
          suggestedActions: ['contact_support', 'investigate_logs']
        },
        authentication_error: {
          category: 'system_error',
          severity: 'critical',
          retryable: false,
          userMessage: 'Payment system authentication error. Please contact support.',
          merchantMessage: 'API authentication failed - check credentials',
          suggestedActions: ['check_api_keys', 'contact_support']
        },
        invalid_request_error: {
          category: 'system_error',
          severity: 'high',
          retryable: false,
          userMessage: 'Payment configuration error. Please contact support.',
          merchantMessage: 'Invalid API request - check implementation',
          suggestedActions: ['review_implementation', 'contact_support']
        }
      },
      
      // Stripe Connect specific errors
      connect_errors: {
        account_inactive: {
          category: 'connect_error',
          severity: 'critical',
          retryable: false,
          userMessage: 'Payment processing is temporarily unavailable for this merchant.',
          merchantMessage: 'Stripe Connect account is inactive or restricted',
          suggestedActions: ['reactivate_account', 'contact_stripe']
        },
        insufficient_permissions: {
          category: 'connect_error',
          severity: 'high',
          retryable: false,
          userMessage: 'Payment processing configuration issue. Please contact the merchant.',
          merchantMessage: 'Insufficient Connect account permissions',
          suggestedActions: ['update_permissions', 'complete_onboarding']
        },
        unsupported_currency: {
          category: 'connect_error',
          severity: 'medium',
          retryable: false,
          userMessage: 'This currency is not supported for payments.',
          merchantMessage: 'Currency not supported by Connect account',
          suggestedActions: ['enable_currency', 'use_supported_currency']
        }
      }
    };
    
    console.log('✅ Comprehensive Error Handler initialized');
  }

  /**
   * MAIN ERROR PROCESSING METHOD
   */
  
  async handlePaymentError(error, context = {}) {
    try {
      const errorAnalysis = this.analyzeError(error);
      const errorData = this.errorCategories[errorAnalysis.category]?.[errorAnalysis.type] || this.getDefaultErrorHandling(error);
      
      // Log the error with full context
      console.error(`💥 [${context.orderId || 'UNKNOWN'}] Payment error: ${errorAnalysis.type}`, {
        category: errorAnalysis.category,
        severity: errorData.severity,
        retryable: errorData.retryable,
        context
      });
      
      // Record error in database
      await this.recordPaymentError(error, errorAnalysis, context);
      
      // Determine response strategy
      const response = await this.buildErrorResponse(errorData, errorAnalysis, context);
      
      // Send monitoring alerts if necessary
      await this.sendErrorAlerts(errorData, errorAnalysis, context);
      
      // Execute recovery actions
      await this.executeRecoveryActions(errorData, context);
      
      return response;
      
    } catch (handlingError) {
      console.error('❌ Error in error handler:', handlingError);
      return this.getFallbackErrorResponse(error);
    }
  }

  /**
   * ERROR ANALYSIS AND CATEGORIZATION
   */
  
  analyzeError(error) {
    // Extract error information from various sources
    let errorCode, errorType, errorMessage, stripeErrorType;
    
    if (error.type && error.code) {
      // Stripe error object
      errorCode = error.code;
      errorType = error.type;
      errorMessage = error.message;
      stripeErrorType = error.type;
    } else if (error.last_payment_error) {
      // From payment intent
      errorCode = error.last_payment_error.code;
      errorType = error.last_payment_error.type;
      errorMessage = error.last_payment_error.message;
    } else if (typeof error === 'string') {
      // String error message
      errorMessage = error;
      errorCode = this.inferErrorCodeFromMessage(error);
    } else {
      // Generic error object
      errorMessage = error.message || 'Unknown error';
      errorCode = 'unknown_error';
    }
    
    // Categorize the error
    const category = this.categorizeError(errorCode, errorType);
    
    return {
      code: errorCode,
      type: errorType || errorCode,
      message: errorMessage,
      category,
      stripeErrorType,
      timestamp: new Date().toISOString()
    };
  }

  categorizeError(errorCode, errorType) {
    // Check each category for the error code
    for (const [categoryName, errors] of Object.entries(this.errorCategories)) {
      if (errors[errorCode]) {
        return categoryName;
      }
    }
    
    // Fallback categorization based on error type
    if (errorType === 'card_error') {
      return 'user_errors';
    } else if (errorType === 'idempotency_error' || errorType === 'rate_limit_error') {
      return 'temporary_errors';
    } else if (errorType === 'invalid_request_error' || errorType === 'api_error') {
      return 'system_errors';
    }
    
    return 'system_errors'; // Default to system error
  }

  inferErrorCodeFromMessage(message) {
    const patterns = {
      'card.*declined': 'card_declined',
      'insufficient.*funds': 'insufficient_funds',
      'expired.*card': 'expired_card',
      'incorrect.*cvc': 'incorrect_cvc',
      'rate.*limit': 'rate_limit',
      'authentication.*required': 'authentication_required',
      'processing.*error': 'processing_error',
      'connection.*error': 'api_connection_error'
    };
    
    const lowerMessage = message.toLowerCase();
    
    for (const [pattern, code] of Object.entries(patterns)) {
      if (new RegExp(pattern).test(lowerMessage)) {
        return code;
      }
    }
    
    return 'unknown_error';
  }

  getDefaultErrorHandling(error) {
    return {
      category: 'system_error',
      severity: 'high',
      retryable: false,
      userMessage: 'Payment processing error. Please try again or contact support.',
      merchantMessage: `Unhandled error: ${error.message || error}`,
      suggestedActions: ['retry_payment', 'contact_support']
    };
  }

  /**
   * ERROR RESPONSE BUILDING
   */
  
  async buildErrorResponse(errorData, errorAnalysis, context) {
    const response = {
      success: false,
      error: {
        code: errorAnalysis.code,
        type: errorAnalysis.type,
        category: errorData.category,
        severity: errorData.severity,
        message: errorData.userMessage,
        merchantMessage: errorData.merchantMessage,
        retryable: errorData.retryable,
        suggestedActions: errorData.suggestedActions,
        timestamp: new Date().toISOString()
      }
    };
    
    // Add retry information if applicable
    if (errorData.retryable && errorData.retryDelay) {
      response.error.retryAfter = errorData.retryDelay;
      response.error.retryAt = new Date(Date.now() + errorData.retryDelay).toISOString();
    }
    
    // Add context-specific information
    if (context.orderId) {
      response.error.orderId = context.orderId;
    }
    
    if (context.sessionId) {
      response.error.sessionId = context.sessionId;
    }
    
    // Add recovery suggestions based on error category
    response.error.recoveryOptions = await this.getRecoveryOptions(errorData, context);
    
    return response;
  }

  async getRecoveryOptions(errorData, context) {
    const options = [];
    
    // User error recovery options
    if (errorData.category === 'user_error') {
      options.push({
        action: 'retry_payment',
        label: 'Try Again',
        description: 'Retry the payment with the same or different payment method'
      });
      
      if (errorData.suggestedActions.includes('try_different_card')) {
        options.push({
          action: 'change_payment_method',
          label: 'Use Different Card',
          description: 'Try a different credit card or payment method'
        });
      }
    }
    
    // Temporary error recovery options
    if (errorData.category === 'temporary') {
      options.push({
        action: 'retry_after_delay',
        label: 'Retry Later',
        description: 'Wait a moment and try the payment again',
        delayMs: errorData.retryDelay || 30000
      });
    }
    
    // System error recovery options
    if (errorData.category === 'system_error') {
      options.push({
        action: 'contact_support',
        label: 'Contact Support',
        description: 'Get help from customer support'
      });
    }
    
    return options;
  }

  getFallbackErrorResponse(error) {
    return {
      success: false,
      error: {
        code: 'system_error',
        category: 'system_error',
        severity: 'critical',
        message: 'An unexpected error occurred. Please contact support.',
        merchantMessage: `Fallback error handling: ${error.message || error}`,
        retryable: false,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * ERROR RECORDING AND TRACKING
   */
  
  async recordPaymentError(error, errorAnalysis, context) {
    try {
      // Update order with error information if orderId is available
      if (context.orderId) {
        await this.db.update(downloadOrders)
          .set({
            status: 'failed',
            failureReason: errorAnalysis.code,
            failureMessage: errorAnalysis.message,
            failureCategory: errorAnalysis.category,
            updatedAt: new Date()
          })
          .where(eq(downloadOrders.id, context.orderId));
      }
      
      // Log error for analytics
      console.log(`📊 Error recorded: ${errorAnalysis.category}/${errorAnalysis.code}`, {
        context,
        severity: this.errorCategories[errorAnalysis.category]?.[errorAnalysis.code]?.severity
      });
      
    } catch (recordingError) {
      console.error('❌ Error recording payment error:', recordingError);
    }
  }

  /**
   * MONITORING AND ALERTING
   */
  
  async sendErrorAlerts(errorData, errorAnalysis, context) {
    try {
      // Send alerts for critical and high severity errors
      if (errorData.severity === 'critical') {
        console.error(`🚨 CRITICAL ERROR: ${errorAnalysis.code} - ${errorData.merchantMessage}`);
        // TODO: Implement immediate alerting (email, SMS, Slack)
      } else if (errorData.severity === 'high') {
        console.warn(`⚠️ HIGH SEVERITY ERROR: ${errorAnalysis.code} - ${errorData.merchantMessage}`);
        // TODO: Implement high priority alerting
      }
      
      // Track error patterns for trending analysis
      await this.trackErrorPattern(errorAnalysis, context);
      
    } catch (alertError) {
      console.error('❌ Error sending error alerts:', alertError);
    }
  }

  async trackErrorPattern(errorAnalysis, context) {
    // This could be enhanced to detect error spikes, patterns, etc.
    console.log(`📈 Error pattern tracked: ${errorAnalysis.category}/${errorAnalysis.code}`);
  }

  /**
   * RECOVERY ACTIONS
   */
  
  async executeRecoveryActions(errorData, context) {
    try {
      for (const action of errorData.suggestedActions) {
        switch (action) {
          case 'retry_payment':
            await this.schedulePaymentRetry(context);
            break;
          case 'contact_support':
            await this.notifySupport(errorData, context);
            break;
          case 'investigate_logs':
            await this.flagForInvestigation(errorData, context);
            break;
          // Add more recovery actions as needed
        }
      }
    } catch (recoveryError) {
      console.error('❌ Error executing recovery actions:', recoveryError);
    }
  }

  async schedulePaymentRetry(context) {
    if (context.orderId) {
      console.log(`🔄 Scheduling retry for order: ${context.orderId}`);
      // TODO: Implement retry scheduling logic
    }
  }

  async notifySupport(errorData, context) {
    console.log(`📞 Support notification triggered for ${errorData.category} error`);
    // TODO: Implement support notification system
  }

  async flagForInvestigation(errorData, context) {
    console.log(`🔍 Flagged for investigation: ${errorData.category}/${context.orderId}`);
    // TODO: Implement investigation flagging system
  }

  /**
   * ERROR STATISTICS AND REPORTING
   */
  
  async getErrorStatistics(timeRangeHours = 24) {
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      
      const errorStats = await this.db.select({
        failureReason: downloadOrders.failureReason,
        failureCategory: downloadOrders.failureCategory,
        count: sql`COUNT(*)`.as('count'),
        totalAmount: sql`SUM(amount)`.as('totalAmount')
      })
      .from(downloadOrders)
      .where(and(
        eq(downloadOrders.status, 'failed'),
        gte(downloadOrders.createdAt, since)
      ))
      .groupBy(downloadOrders.failureReason, downloadOrders.failureCategory);
      
      return {
        timeRange: `${timeRangeHours} hours`,
        errorBreakdown: errorStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error getting error statistics:', error);
      return null;
    }
  }
}

module.exports = ComprehensiveErrorHandler;
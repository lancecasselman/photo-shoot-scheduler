/**
 * Enhanced Webhook Handler for Download Commerce
 * 
 * Provides production-ready webhook processing with:
 * - Comprehensive idempotency protection
 * - Exponential backoff retry logic
 * - Atomic database transactions
 * - Production monitoring and alerting
 * - Integration with DownloadService API
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, or, gte, lte, sql } = require('drizzle-orm');
const { 
  webhookEvents,
  downloadOrders,
  downloadEntitlements,
  downloadHistory,
  photographySessions,
  users 
} = require('../shared/schema');

// Import existing services
const DownloadService = require('./download-service');
const DownloadCommerceManager = require('./download-commerce');

class EnhancedWebhookHandler {
  constructor(pool = null) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.db = drizzle(this.pool);
    this.downloadService = new DownloadService(this.pool);
    this.commerceManager = new DownloadCommerceManager();
    
    // Retry configuration with exponential backoff
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000, // 1 second
      maxDelayMs: 60000, // 60 seconds
      backoffMultiplier: 2,
      jitterFactor: 0.1
    };
    
    // Monitoring thresholds
    this.monitoring = {
      maxProcessingTimeMs: 30000, // 30 seconds
      failureRateThreshold: 0.1, // 10% failure rate triggers alert
      retryQueueSizeThreshold: 50 // Alert if retry queue gets large
    };
    
    console.log('✅ Enhanced Webhook Handler initialized with production features');
  }

  /**
   * Main webhook processing entry point with comprehensive error handling
   */
  async processWebhook(rawBody, signature, webhookSecret) {
    const startTime = Date.now();
    let eventRecord = null;
    let event = null;
    
    try {
      // Verify webhook signature first
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        console.log(`🪝 [${event.id}] Received webhook: ${event.type}`);
      } catch (sigError) {
        console.error(`❌ [WEBHOOK] Signature verification failed: ${sigError.message}`);
        return {
          success: false,
          error: 'Invalid signature',
          httpStatus: 400
        };
      }
      
      // Check if event already exists (idempotency protection)
      const existingEvent = await this.db.select()
        .from(webhookEvents)
        .where(eq(webhookEvents.stripeEventId, event.id))
        .limit(1);
      
      if (existingEvent.length > 0) {
        const existing = existingEvent[0];
        console.log(`ℹ️ [${event.id}] Event already processed with status: ${existing.status}`);
        
        if (existing.status === 'completed') {
          return { success: true, duplicate: true, status: 'completed' };
        } else if (existing.status === 'failed' && existing.processingAttempts >= existing.maxRetries) {
          return { success: false, error: 'Event permanently failed', status: 'failed' };
        } else if (existing.status === 'retrying') {
          // Check if it's time for retry
          if (existing.nextRetryAt && new Date() < existing.nextRetryAt) {
            return { success: false, error: 'Event scheduled for retry', status: 'retrying' };
          }
        }
        
        // Update existing record for retry
        eventRecord = existing;
        await this.updateEventStatus(event.id, 'processing', {
          processingAttempts: existing.processingAttempts + 1,
          lastRetryAt: new Date()
        });
      } else {
        // Create new event record
        eventRecord = await this.createEventRecord(event);
      }
      
      // Process the event based on type
      const result = await this.processEventByType(event, eventRecord);
      const processingTime = Date.now() - startTime;
      
      if (result.success) {
        await this.updateEventStatus(event.id, 'completed', {
          processingDurationMs: processingTime
        });
        
        console.log(`✅ [${event.id}] Webhook processed successfully in ${processingTime}ms`);
        
        // Monitor processing time
        if (processingTime > this.monitoring.maxProcessingTimeMs) {
          await this.alertSlowProcessing(event, processingTime);
        }
        
        return { success: true, processingTime };
      } else {
        // Handle failure with retry logic
        return await this.handleProcessingFailure(event, eventRecord, result.error, processingTime);
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const eventId = event?.id || 'unknown';
      console.error(`❌ [WEBHOOK] Unexpected error processing ${eventId}:`, error);
      
      if (eventRecord && event) {
        try {
          await this.handleProcessingFailure(event, eventRecord, error.message, processingTime);
        } catch (failureHandlingError) {
          console.error(`❌ [WEBHOOK] Error handling failure for ${eventId}:`, failureHandlingError);
        }
      } else {
        console.error(`❌ [WEBHOOK] Cannot handle processing failure - missing event or eventRecord for ${eventId}`);
      }
      
      return {
        success: false,
        error: 'Internal processing error',
        httpStatus: 500
      };
    }
  }

  /**
   * Create webhook event record for tracking
   */
  async createEventRecord(event) {
    const record = {
      id: uuidv4(),
      stripeEventId: event.id,
      eventType: event.type,
      status: 'processing',
      processingAttempts: 1,
      maxRetries: this.retryConfig.maxRetries,
      eventData: event.data,
      sessionId: this.extractSessionId(event),
      orderId: this.extractOrderId(event),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.db.insert(webhookEvents).values(record);
    console.log(`📝 [${event.id}] Created webhook event record`);
    
    return record;
  }

  /**
   * Update webhook event status
   */
  async updateEventStatus(eventId, status, additionalFields = {}) {
    const updateData = {
      status,
      updatedAt: new Date(),
      ...additionalFields
    };
    
    await this.db.update(webhookEvents)
      .set(updateData)
      .where(eq(webhookEvents.stripeEventId, eventId));
    
    console.log(`📝 [${eventId}] Updated status to: ${status}`);
  }

  /**
   * Process webhook event by type with comprehensive handling
   */
  async processEventByType(event, eventRecord) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          return await this.handleCheckoutCompleted(event);
        
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event);
        
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event);
        
        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(event);
        
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(event);
        
        case 'account.updated':
          return await this.handleStripeConnectAccountUpdated(event);
        
        case 'capability.updated':
          return await this.handleCapabilityUpdated(event);
        
        default:
          console.log(`ℹ️ [${event.id}] Ignoring unhandled event type: ${event.type}`);
          return { success: true, message: 'Event type not handled' };
      }
    } catch (error) {
      console.error(`❌ [${event.id}] Error processing ${event.type}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle checkout.session.completed with atomic transactions
   */
  async handleCheckoutCompleted(event) {
    const session = event.data.object;
    
    // Check if this is a gallery download payment
    if (session.metadata?.type === 'gallery_download') {
      return await this.handleGalleryDownloadPayment(session, event);
    }
    
    // Start atomic transaction
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const transactionDb = drizzle(client);
      
      // Find the order
      const orders = await transactionDb.select()
        .from(downloadOrders)
        .where(eq(downloadOrders.stripeCheckoutSessionId, session.id))
        .limit(1);
      
      if (orders.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Order not found for checkout session' };
      }
      
      const order = orders[0];
      
      // Update order status
      await transactionDb.update(downloadOrders)
        .set({
          status: 'completed',
          completedAt: new Date(),
          receiptUrl: session.receipt_url || null,
          webhookEventId: event.id,
          webhookProcessedAt: new Date()
        })
        .where(eq(downloadOrders.id, order.id));
      
      // Create entitlements using commerce manager
      await this.commerceManager.createEntitlements(
        order.id,
        order.sessionId,
        order.clientKey,
        order.items,
        order.mode
      );
      
      // Update session revenue tracking
      await this.updateSessionRevenue(transactionDb, order.sessionId, order.amount);
      
      // Send receipt email if available
      if (session.customer_details?.email) {
        await this.commerceManager.sendDownloadReceipt(order, session.customer_details.email);
      }
      
      await client.query('COMMIT');
      console.log(`✅ [${event.id}] Checkout completed for order ${order.id}`);
      
      return { success: true, orderId: order.id };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle payment_intent.succeeded with direct processing
   */
  async handlePaymentSucceeded(event) {
    const paymentIntent = event.data.object;
    
    // Find associated order by payment intent ID
    const orders = await this.db.select()
      .from(downloadOrders)
      .where(eq(downloadOrders.stripePaymentIntentId, paymentIntent.id))
      .limit(1);
    
    if (orders.length === 0) {
      return { success: false, error: 'Order not found for payment intent' };
    }
    
    const order = orders[0];
    
    // Start atomic transaction for direct processing
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const transactionDb = drizzle(client);
      
      // Update order status to completed
      await transactionDb.update(downloadOrders)
        .set({
          status: 'completed',
          completedAt: new Date(),
          receiptUrl: paymentIntent.receipt_url || null,
          webhookEventId: event.id,
          webhookProcessedAt: new Date()
        })
        .where(eq(downloadOrders.id, order.id));
      
      // Create entitlements using commerce manager
      await this.commerceManager.createEntitlements(
        order.id,
        order.sessionId,
        order.clientKey,
        order.items,
        order.mode
      );
      
      // Update session revenue tracking
      await this.updateSessionRevenue(transactionDb, order.sessionId, order.amount);
      
      // Send receipt email if available
      if (paymentIntent.receipt_email) {
        await this.commerceManager.sendDownloadReceipt(order, paymentIntent.receipt_email);
      }
      
      await client.query('COMMIT');
      console.log(`✅ [${event.id}] Payment intent succeeded for order ${order.id}`);
      
      return { success: true, orderId: order.id };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle gallery download payment completion
   */
  async handleGalleryDownloadPayment(session, event) {
    const crypto = require('crypto');
    const { v4: uuidv4 } = require('uuid');
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Extract metadata
      const { sessionId, photoId, photoUrl, filename, clientKey, photographerId, amount } = session.metadata;
      const amountPaid = parseInt(amount * 100) || 0; // Convert to cents
      
      console.log(`📥 Processing gallery download payment for photo ${photoId}`);
      
      // 1. Create download token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenId = uuidv4();
      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
      
      await client.query(`
        INSERT INTO download_tokens (id, token, photo_url, filename, session_id, expires_at, is_used, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
      `, [tokenId, token, photoUrl, filename, sessionId, expiresAt]);
      
      // 2. Create digital transaction record
      const transactionId = uuidv4();
      const paymentIntentId = session.payment_intent || `pi_${Date.now()}`;
      
      await client.query(`
        INSERT INTO digital_transactions (
          id, session_id, user_id, photo_id, stripe_payment_intent_id, 
          amount, download_token, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
      `, [transactionId, sessionId, photographerId, photoId, paymentIntentId, amountPaid, token]);
      
      // 3. Create gallery_downloads record with digital_transaction_id
      const downloadId = uuidv4();
      await client.query(`
        INSERT INTO gallery_downloads (
          id, session_id, user_id, client_key, photo_id, photo_url, filename,
          download_type, amount_paid, download_token, digital_transaction_id,
          stripe_payment_id, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', $8, $9, $10, $11, 'completed', NOW())
      `, [downloadId, sessionId, photographerId, clientKey, photoId, photoUrl, filename, 
          amountPaid, token, transactionId, paymentIntentId]);
      
      // 4. Update session revenue tracking (optional)
      await client.query(`
        UPDATE photography_sessions 
        SET total_download_revenue = COALESCE(total_download_revenue, 0) + $1,
            last_download_activity = NOW()
        WHERE id = $2
      `, [amountPaid / 100, sessionId]);
      
      await client.query('COMMIT');
      
      console.log(`✅ [${event.id}] Gallery download payment processed: ${photoId}`);
      
      return { 
        success: true, 
        downloadId,
        transactionId,
        token
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error processing gallery download payment:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle payment failures with comprehensive error categorization
   */
  async handlePaymentFailed(event) {
    const paymentIntent = event.data.object;
    const failureCode = paymentIntent.last_payment_error?.code;
    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
    
    // Find associated order
    const orders = await this.db.select()
      .from(downloadOrders)
      .where(eq(downloadOrders.stripePaymentIntentId, paymentIntent.id))
      .limit(1);
    
    if (orders.length === 0) {
      return { success: false, error: 'Order not found for failed payment' };
    }
    
    const order = orders[0];
    
    // Categorize failure reason
    const failureCategory = this.categorizePaymentFailure(failureCode);
    
    // Update order with failure information
    await this.db.update(downloadOrders)
      .set({
        status: 'failed',
        failureReason: failureCode,
        failureMessage: failureMessage,
        failureCategory: failureCategory,
        webhookEventId: event.id,
        webhookProcessedAt: new Date()
      })
      .where(eq(downloadOrders.id, order.id));
    
    // Send failure notification if configured
    await this.notifyPaymentFailure(order, failureCode, failureMessage);
    
    console.log(`❌ [${event.id}] Payment failed for order ${order.id}: ${failureMessage}`);
    
    return { success: true, failureCategory };
  }

  /**
   * Handle processing failures with exponential backoff retry
   */
  async handleProcessingFailure(event, eventRecord, errorMessage, processingTime) {
    const attempts = eventRecord.processingAttempts || 0;
    
    if (attempts >= this.retryConfig.maxRetries) {
      // Mark as permanently failed
      await this.updateEventStatus(event.id, 'failed', {
        errorMessage,
        processingDurationMs: processingTime
      });
      
      // Alert on permanent failure
      await this.alertPermanentFailure(event, errorMessage);
      
      console.error(`❌ [${event.id}] Permanently failed after ${attempts} attempts`);
      
      return {
        success: false,
        error: 'Event permanently failed',
        httpStatus: 500
      };
    }
    
    // Calculate next retry time with exponential backoff and jitter
    const delay = this.calculateRetryDelay(attempts);
    const nextRetryAt = new Date(Date.now() + delay);
    
    await this.updateEventStatus(event.id, 'retrying', {
      errorMessage,
      nextRetryAt,
      processingDurationMs: processingTime
    });
    
    console.warn(`⚠️ [${event.id}] Scheduled for retry in ${delay}ms (attempt ${attempts + 1}/${this.retryConfig.maxRetries})`);
    
    return {
      success: false,
      error: 'Event scheduled for retry',
      retryAt: nextRetryAt,
      httpStatus: 500
    };
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(attemptNumber) {
    const baseDelay = this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attemptNumber);
    const jitter = baseDelay * this.retryConfig.jitterFactor * Math.random();
    const totalDelay = baseDelay + jitter;
    
    return Math.min(totalDelay, this.retryConfig.maxDelayMs);
  }

  /**
   * Categorize payment failure for analytics and handling
   */
  categorizePaymentFailure(code) {
    const categories = {
      'card_declined': 'user_error',
      'insufficient_funds': 'user_error',
      'expired_card': 'user_error',
      'incorrect_cvc': 'user_error',
      'processing_error': 'temporary',
      'rate_limit': 'temporary',
      'api_connection_error': 'temporary',
      'api_error': 'system_error',
      'authentication_error': 'configuration_error',
      'invalid_request_error': 'configuration_error'
    };
    
    return categories[code] || 'unknown';
  }

  /**
   * Update session revenue tracking
   */
  async updateSessionRevenue(db, sessionId, amount) {
    await db.update(photographySessions)
      .set({
        totalDownloadRevenue: sql`COALESCE(total_download_revenue, 0) + ${amount}`,
        lastDownloadActivity: new Date()
      })
      .where(eq(photographySessions.id, sessionId));
  }

  /**
   * Extract session ID from webhook event
   */
  extractSessionId(event) {
    const metadata = event.data.object.metadata;
    return metadata?.sessionId || null;
  }

  /**
   * Extract order ID from webhook event
   */
  extractOrderId(event) {
    const metadata = event.data.object.metadata;
    return metadata?.orderId || null;
  }

  /**
   * Monitoring and alerting methods
   */
  
  async alertSlowProcessing(event, processingTime) {
    console.warn(`🐌 [ALERT] Slow webhook processing: ${event.id} took ${processingTime}ms`);
    // TODO: Implement alerting system (email, Slack, etc.)
  }

  async alertPermanentFailure(event, error) {
    console.error(`🚨 [ALERT] Permanent webhook failure: ${event.id} - ${error}`);
    // TODO: Implement alerting system
  }

  async notifyPaymentFailure(order, failureCode, failureMessage) {
    console.log(`📧 [NOTIFY] Payment failure for order ${order.id}: ${failureCode}`);
    // TODO: Implement customer notification system
  }

  /**
   * Process retry queue (called by scheduled job)
   */
  async processRetryQueue() {
    try {
      const retryableEvents = await this.db.select()
        .from(webhookEvents)
        .where(and(
          eq(webhookEvents.status, 'retrying'),
          lte(webhookEvents.nextRetryAt, new Date())
        ))
        .limit(10); // Process up to 10 retries at once
      
      console.log(`🔄 Processing ${retryableEvents.length} webhook retries`);
      
      for (const eventRecord of retryableEvents) {
        try {
          // Reconstruct the event for retry processing
          const event = {
            id: eventRecord.stripeEventId,
            type: eventRecord.eventType,
            data: eventRecord.eventData
          };
          
          const result = await this.processEventByType(event, eventRecord);
          
          if (result.success) {
            await this.updateEventStatus(event.id, 'completed');
            console.log(`✅ Retry successful for ${event.id}`);
          } else {
            await this.handleProcessingFailure(event, eventRecord, result.error, 0);
          }
          
        } catch (error) {
          console.error(`❌ Retry failed for ${eventRecord.stripeEventId}:`, error);
          await this.handleProcessingFailure(
            { id: eventRecord.stripeEventId },
            eventRecord,
            error.message,
            0
          );
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing retry queue:', error);
    }
  }

  /**
   * Get webhook processing metrics for monitoring
   */
  async getProcessingMetrics(timeRangeHours = 24) {
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      
      const metrics = await this.db.select({
        status: webhookEvents.status,
        eventType: webhookEvents.eventType,
        count: sql`COUNT(*)`.as('count'),
        avgProcessingTime: sql`AVG(processing_duration_ms)`.as('avgProcessingTime')
      })
      .from(webhookEvents)
      .where(gte(webhookEvents.createdAt, since))
      .groupBy(webhookEvents.status, webhookEvents.eventType);
      
      return {
        timeRange: `${timeRangeHours} hours`,
        metrics: metrics,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error getting webhook metrics:', error);
      return null;
    }
  }
}

module.exports = EnhancedWebhookHandler;
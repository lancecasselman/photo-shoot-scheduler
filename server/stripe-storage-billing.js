const Stripe = require('stripe');
const { Pool } = require('pg');

/**
 * Stripe Storage Billing Manager
 * Handles additional storage tier purchases at $35/month per TB
 * Integrates with R2 storage usage tracking system
 */
class StripeStorageBilling {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',  
    });
    
    // Database connection for billing operations
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Storage pricing configuration
    this.STORAGE_PRICE_PER_TB = 35.00; // $35/month per additional TB
    this.BASE_STORAGE_TB = 1.0; // 1TB included in base plan
    
    console.log('💳 Stripe Storage Billing initialized');
  }

  /**
   * Create or retrieve Stripe customer for user
   * @param {string} userId - User ID
   * @param {object} userInfo - User information (email, name)
   * @returns {Promise<string>} Stripe customer ID
   */
  async getOrCreateCustomer(userId, userInfo) {
    try {
      // Check if user already has a Stripe customer ID  
      const result = await this.pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId]);
      const user = result.rows[0];
      if (user.stripeCustomerId) {
        return user.stripeCustomerId;
      }

      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email: userInfo.email,
        name: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
        metadata: {
          userId: userId,
          product: 'photography-platform-storage'
        }
      });

      // Update user record with Stripe customer ID
      await storage.upsertUser({
        id: userId,
        stripeCustomerId: customer.id,
      });

      console.log(`✅ Created Stripe customer for user ${userId}: ${customer.id}`);
      return customer.id;
    } catch (error) {
      console.error('Error creating/retrieving Stripe customer:', error);
      throw new Error(`Failed to setup billing: ${error.message}`);
    }
  }

  /**
   * Create Stripe Checkout Session for additional storage purchase
   * @param {string} userId - User ID
   * @param {number} additionalTB - Number of additional TB to purchase
   * @param {object} userInfo - User information
   * @returns {Promise<object>} Checkout session details
   */
  async createStorageUpgradeCheckout(userId, additionalTB, userInfo) {
    try {
      // Get or create Stripe customer
      const customerId = await this.getOrCreateCustomer(userId, userInfo);
      
      // Calculate pricing
      const totalPrice = additionalTB * this.STORAGE_PRICE_PER_TB;
      const priceInCents = Math.round(totalPrice * 100);

      console.log(`💰 Creating checkout for ${additionalTB}TB additional storage at $${totalPrice}/month`);

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Additional Storage - ${additionalTB}TB`,
                description: `Extra ${additionalTB}TB of cloud storage for RAW files and galleries`,
                images: [], // Add product images if available
              },
              unit_amount: priceInCents,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.BASE_URL || 'http://localhost:5000'}/storage-upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL || 'http://localhost:5000'}/storage-upgrade-cancelled`,
        metadata: {
          userId: userId,
          additionalTB: additionalTB.toString(),
          upgrade_type: 'storage'
        },
        subscription_data: {
          metadata: {
            userId: userId,
            additionalTB: additionalTB.toString(),
            product_type: 'storage_upgrade'
          }
        }
      });

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
        customerId,
        additionalTB,
        monthlyPrice: totalPrice
      };
    } catch (error) {
      console.error('Error creating storage upgrade checkout:', error);
      throw new Error(`Failed to create checkout: ${error.message}`);
    }
  }

  /**
   * Handle successful storage upgrade payment
   * Called from webhook or success page
   * @param {string} sessionId - Stripe session ID
   * @returns {Promise<object>} Updated storage info
   */
  async handleStorageUpgradeSuccess(sessionId) {
    try {
      // Retrieve checkout session
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription']
      });

      if (!session.subscription) {
        throw new Error('No subscription found in session');
      }

      const userId = session.metadata.userId;
      const additionalTB = parseInt(session.metadata.additionalTB);
      const subscriptionId = session.subscription.id;

      console.log(`✅ Processing storage upgrade success for user ${userId}: +${additionalTB}TB`);

      // Get current storage usage
      let storageUsage = await storage.getUserR2StorageUsage(userId);
      
      if (!storageUsage) {
        // Create initial storage usage record
        storageUsage = await storage.createR2StorageUsage({
          id: crypto.randomUUID(),
          userId,
          totalFiles: 0,
          totalSizeBytes: '0',
          totalSizeGB: '0.000',
          totalSizeTB: '0.000000',
          baseStorageTB: '1.00',
          additionalStorageTB: additionalTB,
          maxAllowedTB: (1 + additionalTB).toFixed(2),
          storageStatus: 'active',
          monthlyStorageCost: (additionalTB * this.STORAGE_PRICE_PER_TB).toFixed(2),
          stripeStorageSubscriptionId: subscriptionId,
        });
      } else {
        // Update existing storage usage
        const newAdditionalTB = storageUsage.additionalStorageTB + additionalTB;
        const newMaxAllowedTB = Number(storageUsage.baseStorageTB) + newAdditionalTB;
        const newMonthlyCost = newAdditionalTB * this.STORAGE_PRICE_PER_TB;
        
        storageUsage = await storage.updateR2StorageUsage(userId, {
          additionalStorageTB: newAdditionalTB,
          maxAllowedTB: newMaxAllowedTB.toFixed(2),
          monthlyStorageCost: newMonthlyCost.toFixed(2),
          stripeStorageSubscriptionId: subscriptionId,
          storageStatus: 'active', // Reset to active if was overlimit
        });
      }

      console.log(`🎉 Storage upgrade completed! User ${userId} now has ${storageUsage.maxAllowedTB}TB total storage`);

      return {
        success: true,
        userId,
        additionalTB,
        totalStorageTB: Number(storageUsage.maxAllowedTB),
        monthlyStorageCost: Number(storageUsage.monthlyStorageCost),
        subscriptionId,
        storageStatus: storageUsage.storageStatus
      };
    } catch (error) {
      console.error('Error handling storage upgrade success:', error);
      throw new Error(`Failed to process upgrade: ${error.message}`);
    }
  }

  /**
   * Cancel storage subscription and downgrade user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Updated storage info
   */
  async cancelStorageSubscription(userId) {
    try {
      const storageUsage = await storage.getUserR2StorageUsage(userId);
      
      if (!storageUsage || !storageUsage.stripeStorageSubscriptionId) {
        throw new Error('No active storage subscription found');
      }

      // Cancel Stripe subscription
      await this.stripe.subscriptions.cancel(storageUsage.stripeStorageSubscriptionId);

      // Reset storage to base plan
      const updatedUsage = await storage.updateR2StorageUsage(userId, {
        additionalStorageTB: 0,
        maxAllowedTB: storageUsage.baseStorageTB,
        monthlyStorageCost: '0.00',
        stripeStorageSubscriptionId: null,
        storageStatus: Number(storageUsage.totalSizeTB) > Number(storageUsage.baseStorageTB) ? 'overlimit' : 'active'
      });

      console.log(`❌ Storage subscription cancelled for user ${userId}`);

      return {
        success: true,
        userId,
        totalStorageTB: Number(updatedUsage.maxAllowedTB),
        monthlyStorageCost: 0,
        storageStatus: updatedUsage.storageStatus
      };
    } catch (error) {
      console.error('Error cancelling storage subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Get user's current storage billing information
   * @param {string} userId - User ID
   * @returns {Promise<object>} Storage billing details
   */
  async getStorageBillingInfo(userId) {
    try {
      const storageUsage = await storage.getUserR2StorageUsage(userId);
      
      if (!storageUsage) {
        return {
          hasSubscription: false,
          totalStorageTB: 1.0,
          additionalStorageTB: 0,
          monthlyStorageCost: 0,
          storageStatus: 'active'
        };
      }

      let subscriptionInfo = null;
      if (storageUsage.stripeStorageSubscriptionId) {
        try {
          subscriptionInfo = await this.stripe.subscriptions.retrieve(storageUsage.stripeStorageSubscriptionId);
        } catch (stripeError) {
          console.warn('Could not retrieve Stripe subscription:', stripeError.message);
        }
      }

      return {
        hasSubscription: !!storageUsage.stripeStorageSubscriptionId,
        totalStorageTB: Number(storageUsage.maxAllowedTB),
        baseStorageTB: Number(storageUsage.baseStorageTB),
        additionalStorageTB: storageUsage.additionalStorageTB,
        monthlyStorageCost: Number(storageUsage.monthlyStorageCost),
        storageStatus: storageUsage.storageStatus,
        subscriptionId: storageUsage.stripeStorageSubscriptionId,
        subscriptionStatus: subscriptionInfo?.status || 'unknown',
        currentPeriodEnd: subscriptionInfo?.current_period_end ? new Date(subscriptionInfo.current_period_end * 1000) : null
      };
    } catch (error) {
      console.error('Error getting storage billing info:', error);
      throw new Error(`Failed to get billing info: ${error.message}`);
    }
  }

  /**
   * Handle Stripe webhooks for storage subscriptions
   * @param {object} event - Stripe webhook event
   * @returns {Promise<object>} Processing result
   */
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          if (event.data.object.metadata?.upgrade_type === 'storage') {
            return await this.handleStorageUpgradeSuccess(event.data.object.id);
          }
          break;

        case 'invoice.payment_succeeded':
          // Handle successful monthly payment
          if (event.data.object.subscription) {
            const subscription = await this.stripe.subscriptions.retrieve(event.data.object.subscription);
            if (subscription.metadata?.product_type === 'storage_upgrade') {
              console.log(`✅ Storage subscription payment succeeded for subscription ${subscription.id}`);
              // Could update billing records here if needed
            }
          }
          break;

        case 'invoice.payment_failed':
          // Handle failed payment - could suspend storage or send notifications
          console.warn('Storage subscription payment failed:', event.data.object.id);
          break;

        case 'customer.subscription.deleted':
          // Handle subscription cancellation
          const subscription = event.data.object;
          if (subscription.metadata?.product_type === 'storage_upgrade') {
            const userId = subscription.metadata?.userId;
            if (userId) {
              await this.cancelStorageSubscription(userId);
            }
          }
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      return { success: true, processed: true };
    } catch (error) {
      console.error('Error handling storage billing webhook:', error);
      throw new Error(`Webhook processing failed: ${error.message}`);
    }
  }
}

module.exports = StripeStorageBilling;
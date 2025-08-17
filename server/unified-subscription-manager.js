const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

/**
 * Unified Subscription Management System
 * Handles subscriptions across web (Stripe), iOS (Apple IAP), and Android (Google Play)
 */
class UnifiedSubscriptionManager {
    constructor(pool) {
        this.pool = pool;
        this.PROFESSIONAL_PLAN_PRICE = 39; // $39/month
        this.STORAGE_ADD_ON_PRICE = 25; // $25/month per TB
        this.BASE_STORAGE_GB = 100; // 100GB included with Professional plan
    }

    /**
     * Initialize subscription tables
     */
    async initializeTables() {
        const client = await this.pool.connect();
        try {
            // Main subscriptions table
            await client.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    subscription_type VARCHAR(50) NOT NULL, -- 'professional' or 'storage_addon'
                    platform VARCHAR(20) NOT NULL, -- 'stripe', 'apple_iap', 'google_play'
                    external_subscription_id VARCHAR(255) NOT NULL,
                    external_customer_id VARCHAR(255),
                    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'paused'
                    price_amount DECIMAL(10,2) NOT NULL,
                    currency VARCHAR(3) DEFAULT 'USD',
                    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly'
                    storage_tb INTEGER DEFAULT 0, -- For storage add-ons only
                    platform_commission DECIMAL(5,4) DEFAULT 0.00, -- 0.00 for Stripe, 0.15-0.30 for app stores
                    current_period_start TIMESTAMP,
                    current_period_end TIMESTAMP,
                    trial_end TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'::jsonb
                );
            `);

            // Subscription events log
            await client.query(`
                CREATE TABLE IF NOT EXISTS subscription_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    subscription_id UUID REFERENCES subscriptions(id),
                    event_type VARCHAR(50) NOT NULL, -- 'created', 'renewed', 'failed', 'canceled', 'paused', 'resumed'
                    platform VARCHAR(20) NOT NULL,
                    external_event_id VARCHAR(255),
                    event_data JSONB DEFAULT '{}'::jsonb,
                    processed_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // User subscription summary (for quick queries)
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_subscription_summary (
                    user_id VARCHAR(255) PRIMARY KEY,
                    has_professional_plan BOOLEAN DEFAULT FALSE,
                    professional_platform VARCHAR(20),
                    professional_status VARCHAR(20),
                    total_storage_tb INTEGER DEFAULT 0,
                    base_storage_gb INTEGER DEFAULT 0,
                    total_storage_gb INTEGER DEFAULT 0,
                    active_subscriptions INTEGER DEFAULT 0,
                    monthly_total DECIMAL(10,2) DEFAULT 0.00,
                    next_billing_date TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // Create indexes
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
                CREATE INDEX IF NOT EXISTS idx_subscriptions_platform ON subscriptions(platform);
                CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
                CREATE INDEX IF NOT EXISTS idx_subscriptions_external_id ON subscriptions(external_subscription_id);
                CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON subscription_events(subscription_id);
                CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
            `);

            console.log('✅ Unified subscription tables initialized');
        } catch (error) {
            console.error('❌ Error initializing subscription tables:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Create Professional Plan Subscription (Stripe)
     */
    async createProfessionalPlanStripe(userId, email, paymentMethodId = null) {
        try {
            // Create or get Stripe customer
            let customer = await this.getOrCreateStripeCustomer(userId, email);

            // Attach payment method if provided
            if (paymentMethodId) {
                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: customer.id,
                });
                await stripe.customers.update(customer.id, {
                    invoice_settings: {
                        default_payment_method: paymentMethodId,
                    },
                });
            }

            // Create subscription
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Professional Photography Plan',
                            description: `Professional plan with ${this.BASE_STORAGE_GB}GB storage`
                        },
                        unit_amount: this.PROFESSIONAL_PLAN_PRICE * 100,
                        recurring: { interval: 'month' }
                    }
                }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    userId: userId,
                    planType: 'professional',
                    storageGb: this.BASE_STORAGE_GB.toString()
                }
            });

            // Save to database
            await this.saveSubscription({
                userId: userId,
                subscriptionType: 'professional',
                platform: 'stripe',
                externalSubscriptionId: subscription.id,
                externalCustomerId: customer.id,
                status: subscription.status,
                priceAmount: this.PROFESSIONAL_PLAN_PRICE,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                metadata: subscription.metadata
            });

            await this.updateUserSummary(userId);

            console.log(`✅ Professional plan created: ${subscription.id}`);
            return {
                success: true,
                subscription: subscription,
                clientSecret: subscription.latest_invoice?.payment_intent?.client_secret
            };

        } catch (error) {
            console.error('❌ Error creating professional plan:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add Storage Add-on (Stripe)
     */
    async addStorageAddonStripe(userId, tbCount) {
        try {
            // Get user's Stripe customer
            const customer = await this.getStripeCustomerByUserId(userId);
            if (!customer) {
                throw new Error('User must have Professional plan first');
            }

            // Create storage subscription
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Storage Add-on - ${tbCount}TB`,
                            description: `${tbCount}TB additional cloud storage`
                        },
                        unit_amount: this.STORAGE_ADD_ON_PRICE * 100,
                        recurring: { interval: 'month' }
                    },
                    quantity: tbCount
                }],
                metadata: {
                    userId: userId,
                    planType: 'storage_addon',
                    storageTb: tbCount.toString()
                }
            });

            // Save to database
            await this.saveSubscription({
                userId: userId,
                subscriptionType: 'storage_addon',
                platform: 'stripe',
                externalSubscriptionId: subscription.id,
                externalCustomerId: customer.id,
                status: subscription.status,
                priceAmount: this.STORAGE_ADD_ON_PRICE * tbCount,
                storageTb: tbCount,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                metadata: subscription.metadata
            });

            await this.updateUserSummary(userId);

            console.log(`✅ Storage add-on created: ${tbCount}TB for $${this.STORAGE_ADD_ON_PRICE * tbCount}/month`);
            return { success: true, subscription: subscription };

        } catch (error) {
            console.error('❌ Error creating storage add-on:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle Apple IAP subscription
     */
    async processiOSSubscription(userId, receiptData, productId) {
        try {
            // Validate receipt with Apple
            const validation = await this.validateAppleReceipt(receiptData);
            if (!validation.valid) {
                throw new Error('Invalid Apple receipt');
            }

            const receipt = validation.receipt;
            const latestReceipt = receipt.in_app[receipt.in_app.length - 1];

            // Determine subscription type from product ID
            const subscriptionType = productId.includes('professional') ? 'professional' : 'storage_addon';
            const priceAmount = subscriptionType === 'professional' ? this.PROFESSIONAL_PLAN_PRICE : this.STORAGE_ADD_ON_PRICE;
            const storageTb = subscriptionType === 'storage_addon' ? this.extractStorageFromProductId(productId) : 0;

            // Save subscription
            await this.saveSubscription({
                userId: userId,
                subscriptionType: subscriptionType,
                platform: 'apple_iap',
                externalSubscriptionId: latestReceipt.transaction_id,
                status: 'active',
                priceAmount: priceAmount,
                storageTb: storageTb,
                platformCommission: 0.30, // Apple takes 30% (15% after first year)
                currentPeriodStart: new Date(parseInt(latestReceipt.purchase_date_ms)),
                currentPeriodEnd: new Date(parseInt(latestReceipt.expires_date_ms)),
                metadata: { productId: productId, originalTransactionId: latestReceipt.original_transaction_id }
            });

            await this.updateUserSummary(userId);

            console.log(`✅ iOS subscription processed: ${productId}`);
            return { success: true, transactionId: latestReceipt.transaction_id };

        } catch (error) {
            console.error('❌ Error processing iOS subscription:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle Google Play subscription
     */
    async processAndroidSubscription(userId, purchaseToken, productId, packageName) {
        try {
            // Validate with Google Play
            const validation = await this.validateGooglePlayPurchase(purchaseToken, productId, packageName);
            if (!validation.valid) {
                throw new Error('Invalid Google Play purchase');
            }

            const purchase = validation.purchase;
            const subscriptionType = productId.includes('professional') ? 'professional' : 'storage_addon';
            const priceAmount = subscriptionType === 'professional' ? this.PROFESSIONAL_PLAN_PRICE : this.STORAGE_ADD_ON_PRICE;
            const storageTb = subscriptionType === 'storage_addon' ? this.extractStorageFromProductId(productId) : 0;

            // Save subscription
            await this.saveSubscription({
                userId: userId,
                subscriptionType: subscriptionType,
                platform: 'google_play',
                externalSubscriptionId: purchase.orderId,
                status: 'active',
                priceAmount: priceAmount,
                storageTb: storageTb,
                platformCommission: 0.30, // Google takes 30% (15% after first year)
                currentPeriodStart: new Date(parseInt(purchase.startTimeMillis)),
                currentPeriodEnd: new Date(parseInt(purchase.expiryTimeMillis)),
                metadata: { productId: productId, purchaseToken: purchaseToken }
            });

            await this.updateUserSummary(userId);

            console.log(`✅ Android subscription processed: ${productId}`);
            return { success: true, orderId: purchase.orderId };

        } catch (error) {
            console.error('❌ Error processing Android subscription:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's subscription status
     */
    async getUserSubscriptionStatus(userId) {
        const client = await this.pool.connect();
        try {
            const summaryResult = await client.query(
                'SELECT * FROM user_subscription_summary WHERE user_id = $1',
                [userId]
            );

            const subscriptionsResult = await client.query(
                'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
                [userId, 'active']
            );

            return {
                summary: summaryResult.rows[0] || null,
                subscriptions: subscriptionsResult.rows,
                totalStorageGB: summaryResult.rows[0]?.total_storage_gb || 0,
                hasActivePlan: summaryResult.rows[0]?.has_professional_plan || false
            };

        } catch (error) {
            console.error('❌ Error getting subscription status:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Process Stripe webhook
     */
    async processStripeWebhook(event) {
        try {
            switch (event.type) {
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    await this.handleStripeSubscriptionChange(event.data.object);
                    break;
                
                case 'customer.subscription.deleted':
                    await this.handleStripeSubscriptionCanceled(event.data.object);
                    break;
                
                case 'invoice.payment_failed':
                    await this.handleStripePaymentFailed(event.data.object);
                    break;
                
                case 'invoice.payment_succeeded':
                    await this.handleStripePaymentSucceeded(event.data.object);
                    break;
            }

            // Log event
            await this.logSubscriptionEvent({
                subscriptionId: null, // Will be filled by handlers
                eventType: event.type,
                platform: 'stripe',
                externalEventId: event.id,
                eventData: event.data.object
            });

        } catch (error) {
            console.error('❌ Error processing Stripe webhook:', error);
            throw error;
        }
    }

    // Helper methods
    async getOrCreateStripeCustomer(userId, email) {
        // Check if customer exists
        const customers = await stripe.customers.list({ email: email, limit: 1 });
        if (customers.data.length > 0) {
            return customers.data[0];
        }

        // Create new customer
        return await stripe.customers.create({
            email: email,
            metadata: { userId: userId }
        });
    }

    async getStripeCustomerByUserId(userId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT external_customer_id FROM subscriptions WHERE user_id = $1 AND platform = $2 LIMIT 1',
                [userId, 'stripe']
            );
            
            if (result.rows.length === 0) return null;
            
            return await stripe.customers.retrieve(result.rows[0].external_customer_id);
        } finally {
            client.release();
        }
    }

    async saveSubscription(data) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO subscriptions (
                    user_id, subscription_type, platform, external_subscription_id,
                    external_customer_id, status, price_amount, storage_tb,
                    platform_commission, current_period_start, current_period_end, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                data.userId, data.subscriptionType, data.platform, data.externalSubscriptionId,
                data.externalCustomerId, data.status, data.priceAmount, data.storageTb || 0,
                data.platformCommission || 0.00, data.currentPeriodStart, data.currentPeriodEnd,
                JSON.stringify(data.metadata || {})
            ]);
            
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    async updateUserSummary(userId) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO user_subscription_summary (
                    user_id, has_professional_plan, professional_platform, professional_status,
                    total_storage_tb, base_storage_gb, total_storage_gb, active_subscriptions,
                    monthly_total, next_billing_date, updated_at
                )
                SELECT 
                    $1 as user_id,
                    BOOL_OR(subscription_type = 'professional' AND status = 'active') as has_professional_plan,
                    (SELECT platform FROM subscriptions WHERE user_id = $1 AND subscription_type = 'professional' AND status = 'active' LIMIT 1) as professional_platform,
                    (SELECT status FROM subscriptions WHERE user_id = $1 AND subscription_type = 'professional' AND status = 'active' LIMIT 1) as professional_status,
                    COALESCE(SUM(CASE WHEN subscription_type = 'storage_addon' AND status = 'active' THEN storage_tb ELSE 0 END), 0) as total_storage_tb,
                    CASE WHEN BOOL_OR(subscription_type = 'professional' AND status = 'active') THEN $2 ELSE 0 END as base_storage_gb,
                    CASE WHEN BOOL_OR(subscription_type = 'professional' AND status = 'active') THEN $2 ELSE 0 END + 
                    COALESCE(SUM(CASE WHEN subscription_type = 'storage_addon' AND status = 'active' THEN storage_tb * 1000 ELSE 0 END), 0) as total_storage_gb,
                    COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
                    COALESCE(SUM(CASE WHEN status = 'active' THEN price_amount ELSE 0 END), 0) as monthly_total,
                    MIN(current_period_end) FILTER (WHERE status = 'active') as next_billing_date,
                    NOW() as updated_at
                FROM subscriptions 
                WHERE user_id = $1
                ON CONFLICT (user_id) DO UPDATE SET
                    has_professional_plan = EXCLUDED.has_professional_plan,
                    professional_platform = EXCLUDED.professional_platform,
                    professional_status = EXCLUDED.professional_status,
                    total_storage_tb = EXCLUDED.total_storage_tb,
                    base_storage_gb = EXCLUDED.base_storage_gb,
                    total_storage_gb = EXCLUDED.total_storage_gb,
                    active_subscriptions = EXCLUDED.active_subscriptions,
                    monthly_total = EXCLUDED.monthly_total,
                    next_billing_date = EXCLUDED.next_billing_date,
                    updated_at = EXCLUDED.updated_at
            `, [userId, this.BASE_STORAGE_GB]);

        } finally {
            client.release();
        }
    }

    // Placeholder methods for mobile app store validation
    async validateAppleReceipt(receiptData) {
        // TODO: Implement Apple receipt validation
        console.log('🍎 Validating Apple receipt...');
        return { valid: false, receipt: null };
    }

    async validateGooglePlayPurchase(purchaseToken, productId, packageName) {
        // TODO: Implement Google Play validation
        console.log('🤖 Validating Google Play purchase...');
        return { valid: false, purchase: null };
    }

    extractStorageFromProductId(productId) {
        // Extract TB count from product ID like "storage_1tb" or "storage_5tb"
        const match = productId.match(/storage_(\d+)tb/);
        return match ? parseInt(match[1]) : 1;
    }

    async handleStripeSubscriptionChange(subscription) {
        // Update subscription in database
        console.log(`🔄 Handling Stripe subscription change: ${subscription.id}`);
        // Implementation here
    }

    async handleStripeSubscriptionCanceled(subscription) {
        console.log(`❌ Handling Stripe subscription cancellation: ${subscription.id}`);
        // Implementation here
    }

    async handleStripePaymentFailed(invoice) {
        console.log(`💳 Handling failed payment for invoice: ${invoice.id}`);
        // Implementation here
    }

    async handleStripePaymentSucceeded(invoice) {
        console.log(`✅ Handling successful payment for invoice: ${invoice.id}`);
        // Implementation here
    }

    async logSubscriptionEvent(data) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO subscription_events (
                    subscription_id, event_type, platform, external_event_id, event_data
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                data.subscriptionId, data.eventType, data.platform, 
                data.externalEventId, JSON.stringify(data.eventData)
            ]);
        } finally {
            client.release();
        }
    }
}

module.exports = UnifiedSubscriptionManager;
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
            console.log('🔧 Creating subscription tables...');
            
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

            // Test table creation
            const testResult = await client.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('subscriptions', 'subscription_events', 'user_subscription_summary')
                ORDER BY table_name
            `);
            
            console.log('✅ Unified subscription tables initialized');
            console.log(`📊 Created tables: ${testResult.rows.map(r => r.table_name).join(', ')}`);
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

            // Create or get existing product
            const product = await stripe.products.create({
                name: 'Professional Photography Plan',
                description: `Professional plan with ${this.BASE_STORAGE_GB}GB storage`,
                metadata: {
                    plan_type: 'professional',
                    storage_gb: this.BASE_STORAGE_GB.toString()
                }
            });

            // Create subscription using your Stripe Price ID
            if (!process.env.STRIPE_PRICE_ID) {
                throw new Error('STRIPE_PRICE_ID environment variable is required');
            }

            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{
                    price: process.env.STRIPE_PRICE_ID // Use your actual Stripe Price ID
                }],
                // For test mode, create as active without payment requirement
                collection_method: 'charge_automatically',
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    userId: userId,
                    planType: 'professional',
                    storageGb: this.BASE_STORAGE_GB.toString()
                }
            });

            // Save to database
            const currentPeriodStart = subscription.current_period_start ? 
                new Date(subscription.current_period_start * 1000) : new Date();
            const currentPeriodEnd = subscription.current_period_end ? 
                new Date(subscription.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await this.saveSubscription({
                userId: userId,
                subscriptionType: 'professional',
                platform: 'stripe',
                externalSubscriptionId: subscription.id,
                externalCustomerId: customer.id,
                status: subscription.status,
                priceAmount: this.PROFESSIONAL_PLAN_PRICE,
                currentPeriodStart: currentPeriodStart,
                currentPeriodEnd: currentPeriodEnd,
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
     * Create Professional Plan Subscription via Stripe Checkout Session
     */
    async createProfessionalPlanCheckout(userId, email, name) {
        try {
            // Create or get Stripe customer
            let customer = await this.getOrCreateStripeCustomer(userId, email);
            
            // Create checkout session for Professional Plan using your Stripe Price ID
            if (!process.env.STRIPE_PRICE_ID) {
                throw new Error('STRIPE_PRICE_ID environment variable is required');
            }

            const session = await stripe.checkout.sessions.create({
                customer: customer.id,
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [{
                    price: process.env.STRIPE_PRICE_ID, // Use your actual Stripe Price ID
                    quantity: 1
                }],
                metadata: {
                    userId: userId,
                    type: 'subscription',
                    planType: 'professional',
                    storageGb: this.BASE_STORAGE_GB.toString()
                },
                // Use proper domain from REPLIT_DOMAINS environment variable
                success_url: `https://${process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(',')[0] : 'localhost:5000'}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `https://${process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(',')[0] : 'localhost:5000'}/subscription-checkout.html`,
                allow_promotion_codes: true,
                billing_address_collection: 'required'
            });

            console.log(`✅ Professional plan checkout session created: ${session.id}`);
            return {
                success: true,
                clientSecret: session.id,
                sessionUrl: session.url
            };

        } catch (error) {
            console.error('❌ Error creating professional plan checkout:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add Storage Add-on via Stripe Checkout Session
     */
    async addStorageAddonCheckout(userId, tbCount) {
        try {
            // Get user's Stripe customer
            const customer = await this.getStripeCustomerByUserId(userId);
            if (!customer) {
                throw new Error('User must have Professional plan first');
            }

            // Create checkout session for Storage Add-on using Stripe Price ID
            if (!process.env.STRIPE_STORAGE_ADDON_PRICE_ID) {
                throw new Error('STRIPE_STORAGE_ADDON_PRICE_ID environment variable is required');
            }

            const session = await stripe.checkout.sessions.create({
                customer: customer.id,
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [{
                    price: process.env.STRIPE_STORAGE_ADDON_PRICE_ID, // Use your actual Stripe Price ID
                    quantity: tbCount
                }],
                metadata: {
                    userId: userId,
                    type: 'subscription',
                    planType: 'storage',
                    tbCount: tbCount.toString()
                },
                // Use proper domain from REPLIT_DOMAINS environment variable
                success_url: `https://${process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(',')[0] : 'localhost:5000'}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `https://${process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(',')[0] : 'localhost:5000'}/subscription-checkout.html`,
                allow_promotion_codes: true
            });

            console.log(`✅ Storage add-on checkout session created: ${session.id} for ${tbCount}TB`);
            return {
                success: true,
                clientSecret: session.id,
                sessionUrl: session.url
            };

        } catch (error) {
            console.error('❌ Error creating storage add-on checkout:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add Storage Add-on (Stripe) - Direct subscription creation
     */
    async addStorageAddonStripe(userId, tbCount) {
        try {
            // Get user's Stripe customer
            const customer = await this.getStripeCustomerByUserId(userId);
            if (!customer) {
                throw new Error('User must have Professional plan first');
            }

            // Create storage product
            const product = await stripe.products.create({
                name: `Storage Add-on - ${tbCount}TB`,
                description: `${tbCount}TB additional cloud storage`,
                metadata: {
                    plan_type: 'storage_addon',
                    storage_tb: tbCount.toString()
                }
            });

            // Create storage subscription using Stripe Price ID
            if (!process.env.STRIPE_STORAGE_ADDON_PRICE_ID) {
                throw new Error('STRIPE_STORAGE_ADDON_PRICE_ID environment variable is required');
            }

            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{
                    price: process.env.STRIPE_STORAGE_ADDON_PRICE_ID, // Use your actual Stripe Price ID
                    quantity: tbCount
                }],
                metadata: {
                    userId: userId,
                    planType: 'storage_addon',
                    storageTb: tbCount.toString()
                }
            });

            // Save to database
            const currentPeriodStart = subscription.current_period_start ? 
                new Date(subscription.current_period_start * 1000) : new Date();
            const currentPeriodEnd = subscription.current_period_end ? 
                new Date(subscription.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await this.saveSubscription({
                userId: userId,
                subscriptionType: 'storage_addon',
                platform: 'stripe',
                externalSubscriptionId: subscription.id,
                externalCustomerId: customer.id,
                status: subscription.status,
                priceAmount: this.STORAGE_ADD_ON_PRICE * tbCount,
                storageTb: tbCount,
                currentPeriodStart: currentPeriodStart,
                currentPeriodEnd: currentPeriodEnd,
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
            console.log(`🔍 Getting subscription status for user: ${userId}`);
            
            const summaryResult = await client.query(
                'SELECT * FROM user_subscription_summary WHERE user_id = $1',
                [userId]
            );
            
            console.log(`📊 User subscription summary found: ${summaryResult.rows.length > 0}`);
            if (summaryResult.rows.length > 0) {
                console.log(`📊 Summary details:`, {
                    hasProfessionalPlan: summaryResult.rows[0].has_professional_plan,
                    professionalStatus: summaryResult.rows[0].professional_status,
                    totalStorageGb: summaryResult.rows[0].total_storage_gb
                });
            }

            const subscriptionsResult = await client.query(
                'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
                [userId, 'active']
            );
            
            console.log(`📋 Active subscriptions found: ${subscriptionsResult.rows.length}`);

            return {
                summary: summaryResult.rows[0] || null,
                subscriptions: subscriptionsResult.rows,
                totalStorageGB: summaryResult.rows[0]?.total_storage_gb || 0,
                hasActivePlan: summaryResult.rows[0]?.has_professional_plan || false,
                // Add properties expected by subscription middleware
                hasProfessionalPlan: summaryResult.rows[0]?.has_professional_plan || false,
                professionalStatus: summaryResult.rows[0]?.professional_status || 'inactive',
                totalStorageGb: summaryResult.rows[0]?.total_storage_gb || 0
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
        console.log(`📨 Processing Stripe webhook: ${event.type} (ID: ${event.id})`);
        
        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    console.log('💳 Checkout session completed event received');
                    await this.handleCheckoutSessionCompleted(event.data.object);
                    break;
                    
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    console.log(`📝 Subscription ${event.type.split('.')[2]} event received`);
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
            
            console.log(`✅ Successfully processed webhook: ${event.type}`);

        } catch (error) {
            console.error('❌ Error processing Stripe webhook:', error);
            console.error('Stack trace:', error.stack);
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
                    $1::text as user_id,
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
                WHERE user_id = $1::text
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

    /**
     * Cancel user's subscription - All platforms
     */
    async cancelUserSubscription(userId, subscriptionId, cancellationReason = 'user_requested') {
        const client = await this.pool.connect();
        try {
            // Get subscription details
            const subResult = await client.query(
                'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
                [subscriptionId, userId]
            );

            if (subResult.rows.length === 0) {
                throw new Error('Subscription not found');
            }

            const subscription = subResult.rows[0];

            // Handle platform-specific cancellation
            if (subscription.platform === 'stripe') {
                return await this.cancelStripeSubscription(userId, subscription, cancellationReason);
            } else if (subscription.platform === 'apple_iap') {
                return await this.cancelAppleSubscription(userId, subscription, cancellationReason);
            } else if (subscription.platform === 'google_play') {
                return await this.cancelGooglePlaySubscription(userId, subscription, cancellationReason);
            }

            throw new Error(`Unsupported platform: ${subscription.platform}`);
        } finally {
            client.release();
        }
    }

    /**
     * Cancel all user subscriptions (Professional + Storage add-ons)
     */
    async cancelAllUserSubscriptions(userId, cancellationReason = 'user_requested') {
        const client = await this.pool.connect();
        try {
            // Get all active subscriptions
            const result = await client.query(
                'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2',
                [userId, 'active']
            );

            const cancellationResults = [];

            for (const subscription of result.rows) {
                try {
                    const cancelResult = await this.cancelUserSubscription(userId, subscription.id, cancellationReason);
                    cancellationResults.push({
                        subscriptionId: subscription.id,
                        subscriptionType: subscription.subscription_type,
                        success: true,
                        result: cancelResult
                    });
                } catch (error) {
                    console.error(`❌ Failed to cancel subscription ${subscription.id}:`, error);
                    cancellationResults.push({
                        subscriptionId: subscription.id,
                        subscriptionType: subscription.subscription_type,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Update user summary
            await this.updateUserSummary(userId);

            return {
                success: true,
                totalSubscriptions: result.rows.length,
                cancelledCount: cancellationResults.filter(r => r.success).length,
                failedCount: cancellationResults.filter(r => !r.success).length,
                results: cancellationResults
            };

        } finally {
            client.release();
        }
    }

    /**
     * Cancel Stripe subscription
     */
    async cancelStripeSubscription(userId, subscription, cancellationReason) {
        try {
            // Cancel subscription in Stripe
            const cancelledSubscription = await stripe.subscriptions.cancel(subscription.external_subscription_id, {
                prorate: false // No refunds
            });

            console.log(`✅ Stripe subscription cancelled: ${subscription.external_subscription_id}`);

            // Update database
            const client = await this.pool.connect();
            try {
                await client.query(
                    'UPDATE subscriptions SET status = $1, cancellation_reason = $2, cancelled_at = NOW() WHERE id = $3',
                    ['cancelled', cancellationReason, subscription.id]
                );

                // Log cancellation event
                await this.logSubscriptionEvent({
                    subscriptionId: subscription.id,
                    eventType: 'subscription_cancelled',
                    platform: 'stripe',
                    externalEventId: null,
                    eventData: {
                        reason: cancellationReason,
                        cancelled_by: 'user',
                        stripe_subscription_id: subscription.external_subscription_id
                    }
                });

            } finally {
                client.release();
            }

            return {
                success: true,
                platform: 'stripe',
                subscriptionType: subscription.subscription_type,
                effectiveDate: cancelledSubscription.canceled_at ? new Date(cancelledSubscription.canceled_at * 1000) : new Date(),
                proratedRefund: cancelledSubscription.latest_invoice?.amount_paid || 0
            };

        } catch (error) {
            console.error('❌ Error cancelling Stripe subscription:', error);
            throw new Error(`Failed to cancel Stripe subscription: ${error.message}`);
        }
    }

    /**
     * Cancel Apple IAP subscription
     */
    async cancelAppleSubscription(userId, subscription, cancellationReason) {
        // For Apple IAP, we can't cancel from server - user must cancel via App Store
        // We just mark it for cancellation and it will expire at period end
        
        const client = await this.pool.connect();
        try {
            await client.query(
                'UPDATE subscriptions SET status = $1, cancellation_reason = $2, cancelled_at = NOW() WHERE id = $3',
                ['pending_cancellation', cancellationReason, subscription.id]
            );

            await this.logSubscriptionEvent({
                subscriptionId: subscription.id,
                eventType: 'subscription_cancellation_requested',
                platform: 'apple_iap',
                externalEventId: null,
                eventData: {
                    reason: cancellationReason,
                    cancelled_by: 'user',
                    note: 'User must complete cancellation in App Store'
                }
            });

            return {
                success: true,
                platform: 'apple_iap',
                subscriptionType: subscription.subscription_type,
                status: 'pending_cancellation',
                message: 'Subscription marked for cancellation. Please cancel in the App Store to complete.',
                expiresAt: subscription.current_period_end
            };

        } finally {
            client.release();
        }
    }

    /**
     * Cancel Google Play subscription
     */
    async cancelGooglePlaySubscription(userId, subscription, cancellationReason) {
        // For Google Play, we can't cancel from server - user must cancel via Play Store
        // We just mark it for cancellation and it will expire at period end
        
        const client = await this.pool.connect();
        try {
            await client.query(
                'UPDATE subscriptions SET status = $1, cancellation_reason = $2, cancelled_at = NOW() WHERE id = $3',
                ['pending_cancellation', cancellationReason, subscription.id]
            );

            await this.logSubscriptionEvent({
                subscriptionId: subscription.id,
                eventType: 'subscription_cancellation_requested',
                platform: 'google_play',
                externalEventId: null,
                eventData: {
                    reason: cancellationReason,
                    cancelled_by: 'user',
                    note: 'User must complete cancellation in Play Store'
                }
            });

            return {
                success: true,
                platform: 'google_play',
                subscriptionType: subscription.subscription_type,
                status: 'pending_cancellation',
                message: 'Subscription marked for cancellation. Please cancel in the Play Store to complete.',
                expiresAt: subscription.current_period_end
            };

        } finally {
            client.release();
        }
    }

    extractStorageFromProductId(productId) {
        // Extract TB count from product ID like "storage_1tb" or "storage_5tb"
        const match = productId.match(/storage_(\d+)tb/);
        return match ? parseInt(match[1]) : 1;
    }

    /**
     * Record a Stripe subscription in the database
     */
    async recordStripeSubscription(userId, subscriptionId, planType, amount) {
        const client = await this.pool.connect();
        try {
            console.log(`📝 Recording subscription: User ${userId}, Plan ${planType}, Amount $${amount}`);
            
            // Get the Stripe customer ID for this user
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            let customerId = null;
            try {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                customerId = subscription.customer;
            } catch (err) {
                console.log('Could not retrieve customer ID from subscription');
            }
            
            // Insert or update subscription record with correct column names
            // First check if the subscription exists
            const existing = await client.query(`
                SELECT id FROM subscriptions WHERE external_subscription_id = $1
            `, [subscriptionId]);
            
            if (existing.rows.length > 0) {
                // Update existing subscription
                await client.query(`
                    UPDATE subscriptions SET
                        status = $1,
                        subscription_type = $2,
                        price_amount = $3,
                        updated_at = NOW()
                    WHERE external_subscription_id = $4
                `, ['active', planType, amount, subscriptionId]);
            } else {
                // Insert new subscription
                await client.query(`
                    INSERT INTO subscriptions (
                        user_id, subscription_type, platform, 
                        external_subscription_id, external_customer_id, 
                        status, price_amount, current_period_start, 
                        current_period_end, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() + INTERVAL '1 month', NOW())
                `, [userId, planType, 'stripe', subscriptionId, customerId, 'active', amount]);
            }
            
            console.log(`✅ Subscription recorded successfully for user: ${userId}`);
        } catch (error) {
            console.error('❌ Error recording subscription:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Update user subscription summary table
     */
    async updateUserSubscriptionSummary(userId) {
        const client = await this.pool.connect();
        try {
            console.log(`📊 Updating subscription summary for user: ${userId}`);
            
            // Get all active subscriptions for the user
            const subscriptionsResult = await client.query(`
                SELECT * FROM subscriptions 
                WHERE user_id = $1 AND status = 'active'
                ORDER BY created_at DESC
            `, [userId]);
            
            const subscriptions = subscriptionsResult.rows;
            let hasProfessionalPlan = false;
            let totalStorageGb = 0;
            let baseStorageGb = 0;
            let professionalStatus = 'inactive';
            let totalStorageTb = 0;
            let monthlyTotal = 0;
            let activeSubscriptionCount = 0;
            let nextBillingDate = null;
            
            // Calculate totals from active subscriptions
            for (const sub of subscriptions) {
                activeSubscriptionCount++;
                monthlyTotal += parseFloat(sub.price_amount || 0);
                
                if (!nextBillingDate || (sub.current_period_end && sub.current_period_end < nextBillingDate)) {
                    nextBillingDate = sub.current_period_end;
                }
                
                if (sub.subscription_type === 'professional') {
                    hasProfessionalPlan = true;
                    professionalStatus = 'active';
                    baseStorageGb = 100; // Professional plan includes 100GB
                    totalStorageGb = 100;
                } else if (sub.subscription_type && sub.subscription_type.includes('storage_')) {
                    // Storage addon
                    const tbMatch = sub.subscription_type.match(/storage_(\d+)tb/);
                    if (tbMatch) {
                        const tb = parseInt(tbMatch[1]);
                        totalStorageTb += tb;
                        totalStorageGb += tb * 1024; // Convert TB to GB
                    }
                }
            }
            
            // Update or insert summary with correct column names
            await client.query(`
                INSERT INTO user_subscription_summary (
                    user_id, has_professional_plan, professional_platform,
                    professional_status, total_storage_tb, base_storage_gb,
                    total_storage_gb, active_subscriptions, monthly_total,
                    next_billing_date, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
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
                    updated_at = NOW()
            `, [
                userId, 
                hasProfessionalPlan, 
                hasProfessionalPlan ? 'stripe' : null,
                professionalStatus, 
                totalStorageTb,
                baseStorageGb,
                totalStorageGb, 
                activeSubscriptionCount,
                monthlyTotal,
                nextBillingDate
            ]);
            
            // Also update the users table subscription_status
            await client.query(`
                UPDATE users 
                SET subscription_status = $2, updated_at = NOW()
                WHERE id = $1
            `, [userId, professionalStatus]);
            
            console.log(`✅ Subscription summary updated: Professional=${hasProfessionalPlan}, Storage=${totalStorageGb}GB, Monthly=$${monthlyTotal}`);
        } catch (error) {
            console.error('❌ Error updating subscription summary:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async handleCheckoutSessionCompleted(session) {
        console.log(`✅ Processing checkout session: ${session.id}`);
        
        try {
            // Get the full session details with line items expanded
            const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
                expand: ['customer', 'subscription', 'line_items']
            });
            
            // Extract metadata from the session
            const { userId, type, planType } = fullSession.metadata || {};
            const customerEmail = fullSession.customer_email || fullSession.customer?.email;
            const customerId = fullSession.customer?.id || fullSession.customer;
            
            // Check if we have a userId from the checkout (user was created before payment)
            const hasUserId = !!userId;
            
            if (hasUserId) {
                // User was already created during checkout (new flow)
                console.log(`📈 Updating subscription for user created during checkout: ${userId}`);
                
                // Update subscription status in database
                const client = await this.pool.connect();
                try {
                    // Update user subscription status and plan
                    await client.query(`
                        UPDATE users SET
                            subscription_status = 'active',
                            subscription_plan = $2,
                            stripe_customer_id = $3,
                            stripe_subscription_id = $4,
                            subscription_expires_at = NOW() + INTERVAL '1 month',
                            updated_at = NOW()
                        WHERE id = $1
                    `, [userId, planType || 'professional', customerId, fullSession.subscription?.id || fullSession.subscription]);
                    
                    // Record the subscription details
                    if (fullSession.subscription) {
                        const subscriptionId = typeof fullSession.subscription === 'string' 
                            ? fullSession.subscription 
                            : fullSession.subscription.id;
                        
                        await this.recordStripeSubscription(
                            userId,
                            subscriptionId,
                            planType || 'professional',
                            39.00
                        );
                        
                        // Update user subscription summary
                        await this.updateUserSubscriptionSummary(userId);
                    }
                    
                    console.log(`✅ Subscription activated for user: ${userId}`);
                } finally {
                    client.release();
                }
                
            } else if (customerEmail && !userId) {
                // Edge case: No userId in metadata but we have email (fallback for old flow)
                console.log(`⚠️ Fallback: Processing subscription for email without userId: ${customerEmail}`);
                
                const firebase = require('firebase-admin');
                
                try {
                    // Try to find existing user by email
                    let userRecord;
                    try {
                        userRecord = await firebase.auth().getUserByEmail(customerEmail);
                        console.log(`📧 Found existing Firebase user: ${userRecord.uid}`);
                    } catch (error) {
                        if (error.code === 'auth/user-not-found') {
                            // Create user as fallback (shouldn't happen in new flow)
                            console.log(`⚠️ Creating user in webhook (should have been created during checkout)`);
                            userRecord = await firebase.auth().createUser({
                                email: customerEmail,
                                emailVerified: false,
                                displayName: fullSession.customer_details?.name || customerEmail.split('@')[0]
                            });
                            console.log(`✅ Created fallback Firebase user: ${userRecord.uid}`);
                        } else {
                            throw error;
                        }
                    }
                    
                    // Update database
                    const client = await this.pool.connect();
                    try {
                        await client.query(`
                            INSERT INTO users (
                                id, email, username, display_name, 
                                subscription_status, subscription_plan, stripe_customer_id, 
                                stripe_subscription_id, subscription_expires_at,
                                created_at, onboarding_completed
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '1 month', NOW(), false)
                            ON CONFLICT (id) DO UPDATE SET
                                subscription_status = EXCLUDED.subscription_status,
                                subscription_plan = EXCLUDED.subscription_plan,
                                stripe_customer_id = EXCLUDED.stripe_customer_id,
                                stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                                subscription_expires_at = EXCLUDED.subscription_expires_at,
                                updated_at = NOW()
                        `, [
                            userRecord.uid,
                            customerEmail,
                            customerEmail.split('@')[0],
                            fullSession.customer_details?.name || customerEmail.split('@')[0],
                            'active',
                            'professional',
                            customerId,
                            fullSession.subscription?.id || fullSession.subscription
                        ]);
                        
                        // Record subscription
                        if (fullSession.subscription) {
                            const subscriptionId = typeof fullSession.subscription === 'string' 
                                ? fullSession.subscription 
                                : fullSession.subscription.id;
                            
                            await this.recordStripeSubscription(
                                userRecord.uid,
                                subscriptionId,
                                'professional',
                                39.00
                            );
                            
                            // Update user subscription summary
                            await this.updateUserSubscriptionSummary(userRecord.uid);
                        }
                    } finally {
                        client.release();
                    }
                } catch (error) {
                    console.error('❌ Error in fallback user creation:', error);
                    throw error;
                }
            } else {
                console.log(`⚠️ Unexpected state in checkout session - no userId or email found`);
            }
            
            console.log(`✅ Checkout session processing complete for: ${customerEmail || userId}`);
            
        } catch (error) {
            console.error('❌ Error handling checkout session:', error);
            throw error;
        }
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
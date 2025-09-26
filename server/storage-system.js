/**
 * Photography Management System Storage Quota and Billing System
 * Built from scratch with proper Stripe integration and quota enforcement
 */

const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StorageSystem {
    constructor(pool, r2FileManager) {
        this.pool = pool;
        this.r2Manager = r2FileManager;
        this.BASE_STORAGE_GB = 100; // 100GB included with $39/month Professional plan
        this.PACKAGE_SIZE_TB = 1;
        this.PACKAGE_PRICE_MONTHLY = 25; // $25/month per TB storage add-on
        this.WARNING_THRESHOLD = 0.9; // 90% usage warning
    }

    /**
     * Initialize storage system database tables
     */
    async initializeTables() {
        try {
            // User storage quotas table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_storage_quotas (
                    user_id VARCHAR(255) PRIMARY KEY,
                    base_storage_gb DECIMAL(10,3) DEFAULT 100.0,
                    purchased_tb INTEGER DEFAULT 0,
                    total_quota_gb DECIMAL(10,3) DEFAULT 100.0,
                    used_storage_bytes BIGINT DEFAULT 0,
                    last_calculated_at TIMESTAMP DEFAULT NOW(),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Active storage subscriptions table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS storage_subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
                    tb_count INTEGER NOT NULL,
                    monthly_price_usd DECIMAL(10,2) NOT NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    current_period_start TIMESTAMP NOT NULL,
                    current_period_end TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    FOREIGN KEY (user_id) REFERENCES user_storage_quotas(user_id) ON DELETE CASCADE
                )
            `);

            // Storage usage tracking table (for detailed analytics)
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS storage_usage_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    session_id UUID,
                    action VARCHAR(50) NOT NULL, -- 'upload', 'delete'
                    file_size_bytes BIGINT NOT NULL,
                    folder_type VARCHAR(20) NOT NULL, -- 'gallery', 'raw'
                    filename VARCHAR(500),
                    timestamp TIMESTAMP DEFAULT NOW(),
                    FOREIGN KEY (user_id) REFERENCES user_storage_quotas(user_id) ON DELETE CASCADE
                )
            `);

            // Billing history table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS storage_billing_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    stripe_payment_intent_id VARCHAR(255),
                    amount_usd DECIMAL(10,2) NOT NULL,
                    tb_purchased INTEGER NOT NULL,
                    billing_period_start TIMESTAMP NOT NULL,
                    billing_period_end TIMESTAMP NOT NULL,
                    status VARCHAR(50) DEFAULT 'succeeded',
                    created_at TIMESTAMP DEFAULT NOW(),
                    FOREIGN KEY (user_id) REFERENCES user_storage_quotas(user_id) ON DELETE CASCADE
                )
            `);

            console.log(' Storage system tables initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize storage tables:', error);
            throw error;
        }
    }

    /**
     * Get or create user storage quota record
     */
    async getUserQuota(userId) {
        try {
            // Try to get existing quota
            let result = await this.pool.query(
                'SELECT * FROM user_storage_quotas WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                // Create new quota record with 100GB base storage  
                await this.pool.query(`
                    INSERT INTO user_storage_quotas (user_id, base_storage_gb, total_quota_gb)
                    VALUES ($1, $2, $3)
                `, [userId, this.BASE_STORAGE_GB, this.BASE_STORAGE_GB]);

                result = await this.pool.query(
                    'SELECT * FROM user_storage_quotas WHERE user_id = $1',
                    [userId]
                );
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error getting user quota:', error);
            throw error;
        }
    }

    /**
     * Calculate actual storage usage from session storage endpoints (gallery manager)
     */
    async calculateStorageUsage(userId) {
        try {
            // Get all user sessions first
            const sessionsResult = await this.pool.query(`
                SELECT id FROM photography_sessions WHERE user_id = $1
            `, [userId]);

            let totalBytes = 0;
            let totalFiles = 0;
            let galleryBytes = 0;
            let rawBytes = 0;

            console.log(` Calculating storage for user ${userId} across ${sessionsResult.rows.length} sessions`);

            // For each session, get storage data from the actual storage endpoints
            for (const session of sessionsResult.rows) {
                try {
                    // Use the R2 object storage service directly (same as session storage endpoint)
                    const galleryFiles = await this.r2Manager.listObjects(`photographer-${userId}/session-${session.id}/gallery/`);
                    const rawFiles = await this.r2Manager.listObjects(`photographer-${userId}/session-${session.id}/raw/`);

                    // Calculate gallery storage
                    for (const file of galleryFiles) {
                        if (file.Size) {
                            galleryBytes += file.Size;
                            totalFiles++;
                        }
                    }

                    // Calculate raw storage
                    for (const file of rawFiles) {
                        if (file.Size) {
                            rawBytes += file.Size;
                            totalFiles++;
                        }
                    }
                } catch (sessionError) {
                    console.error(`Error getting storage for session ${session.id}:`, sessionError);
                    // Continue with other sessions
                }
            }

            totalBytes = galleryBytes + rawBytes;
            const totalGB = parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(3));

            console.log(` Storage calculation complete: ${totalGB}GB total (${(galleryBytes / 1024 / 1024).toFixed(2)}MB gallery, ${(rawBytes / 1024 / 1024).toFixed(2)}MB raw)`);

            // Update cached usage in user_storage_quotas
            await this.pool.query(`
                UPDATE user_storage_quotas 
                SET used_storage_bytes = $1, last_calculated_at = NOW()
                WHERE user_id = $2
            `, [totalBytes, userId]);

            return {
                totalBytes: totalBytes,
                totalGB: totalGB,
                totalFiles: totalFiles,
                galleryBytes: galleryBytes,
                rawBytes: rawBytes
            };
        } catch (error) {
            console.error('Error calculating storage usage:', error);
            throw error;
        }
    }

    /**
     * Check if user can upload a file of given size
     */
    async canUpload(userId, fileSizeBytes, userEmail = null) {
        try {
            // Admin bypass for specific email addresses
            const adminEmails = [
                'lancecasselman@icloud.com',
                'lancecasselman2011@gmail.com', 
                'lance@thelegacyphotography.com'
            ];

            if (userEmail && adminEmails.includes(userEmail.toLowerCase())) {
                console.log(`✅ Admin bypass: ${userEmail} has unlimited storage`);
                return {
                    canUpload: true,
                    currentUsageGB: 0,
                    newTotalGB: 0,
                    quotaGB: Number.MAX_SAFE_INTEGER,
                    remainingGB: Number.MAX_SAFE_INTEGER,
                    isNearLimit: false,
                    isAdmin: true
                };
            }

            const quota = await this.getUserQuota(userId);
            const usage = await this.calculateStorageUsage(userId);
            
            const newTotalGB = (usage.totalBytes + fileSizeBytes) / (1024 * 1024 * 1024);
            const quotaGB = parseFloat(quota.total_quota_gb);

            return {
                canUpload: newTotalGB <= quotaGB,
                currentUsageGB: usage.totalGB,
                newTotalGB: parseFloat(newTotalGB.toFixed(3)),
                quotaGB: quotaGB,
                remainingGB: parseFloat((quotaGB - usage.totalGB).toFixed(3)),
                isNearLimit: (usage.totalGB / quotaGB) >= this.WARNING_THRESHOLD
            };
        } catch (error) {
            console.error('Error checking upload permission:', error);
            throw error;
        }
    }

    /**
     * Log storage usage change (upload/delete)
     */
    async logStorageChange(userId, sessionId, action, fileSizeBytes, folderType, filename) {
        try {
            await this.pool.query(`
                INSERT INTO storage_usage_logs (user_id, session_id, action, file_size_bytes, folder_type, filename)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, sessionId, action, fileSizeBytes, folderType, filename]);

            console.log(` Logged ${action}: ${filename} (${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB)`);
        } catch (error) {
            console.error('Error logging storage change:', error);
            // Don't throw - logging failure shouldn't block operations
        }
    }

    /**
     * Purchase storage package via Stripe
     */
    async purchaseStoragePackage(userId, tbCount = 1, customerEmail) {
        try {
            // Create Stripe customer if needed
            let customer;
            try {
                const customers = await stripe.customers.list({
                    email: customerEmail,
                    limit: 1
                });
                
                customer = customers.data[0] || await stripe.customers.create({
                    email: customerEmail,
                    metadata: { userId: userId }
                });
            } catch (customerError) {
                console.error('Error with customer:', customerError);
                throw new Error('Failed to create/find customer');
            }

            // Create a one-time payment intent instead of subscription
            // This avoids the need for product creation permissions
            const paymentIntent = await stripe.paymentIntents.create({
                customer: customer.id,
                amount: this.PACKAGE_PRICE_MONTHLY * 100 * tbCount, // Amount in cents
                currency: 'usd',
                description: `Storage Add-on: ${tbCount}TB at $${this.PACKAGE_PRICE_MONTHLY}/TB per month`,
                metadata: { 
                    userId: userId, 
                    tbCount: tbCount.toString(),
                    type: 'storage_addon',
                    recurring: 'monthly'
                }
            });

            // For now, we'll track this as a manual subscription in our database
            // You can set up webhooks to handle recurring billing
            const subscriptionId = `sub_storage_${Date.now()}_${userId}`;
            
            // Create subscription-like object for compatibility
            const subscription = {
                id: subscriptionId,
                customer: customer.id,
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
                latest_invoice: {
                    payment_intent: {
                        client_secret: paymentIntent.client_secret
                    }
                },
                metadata: { userId: userId, tbCount: tbCount.toString() }
            };

            // Store subscription in database
            await this.pool.query(`
                INSERT INTO storage_subscriptions (
                    user_id, stripe_subscription_id, tb_count, monthly_price_usd,
                    current_period_start, current_period_end
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                userId,
                subscription.id,
                tbCount,
                this.PACKAGE_PRICE_MONTHLY * tbCount,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000)
            ]);

            // Update user's total quota
            await this.pool.query(`
                UPDATE user_storage_quotas 
                SET purchased_tb = purchased_tb + $1,
                    total_quota_gb = base_storage_gb + (purchased_tb + $1) * 1024,
                    updated_at = NOW()
                WHERE user_id = $2
            `, [tbCount, userId]);

            console.log(`💳 Storage package created: ${tbCount}TB for user ${userId}`);

            return {
                subscriptionId: subscription.id,
                clientSecret: subscription.latest_invoice.payment_intent.client_secret,
                monthlyPrice: this.PACKAGE_PRICE_MONTHLY * tbCount,
                storageAmountTB: tbCount
            };
        } catch (error) {
            console.error('Error purchasing storage package:', error);
            throw error;
        }
    }

    /**
     * Get user's complete storage summary
     */
    async getStorageSummary(userId) {
        try {
            const quota = await this.getUserQuota(userId);
            const usage = await this.calculateStorageUsage(userId);
            const subscriptions = await this.getActiveSubscriptions(userId);

            const usagePercentage = parseFloat(((usage.totalGB / parseFloat(quota.total_quota_gb)) * 100).toFixed(1));
            const isNearLimit = usagePercentage >= (this.WARNING_THRESHOLD * 100);

            return {
                userId,
                freeStorageGB: parseFloat(quota.base_storage_gb),
                purchasedTB: quota.purchased_tb,
                totalQuotaGB: parseFloat(quota.total_quota_gb),
                usedStorageGB: usage.totalGB,
                usedStorageBytes: usage.totalBytes,
                remainingGB: parseFloat((parseFloat(quota.total_quota_gb) - usage.totalGB).toFixed(3)),
                usagePercentage: usagePercentage,
                isNearLimit,
                breakdown: {
                    galleryGB: parseFloat((usage.galleryBytes / (1024 * 1024 * 1024)).toFixed(3)),
                    rawStorageGB: parseFloat(((usage.rawBytes || 0) / (1024 * 1024 * 1024)).toFixed(3))
                },
                activeSubscriptions: subscriptions,
                monthlyCost: subscriptions.reduce((sum, sub) => sum + parseFloat(sub.monthly_price_usd), 0),
                lastUpdated: quota.last_calculated_at
            };
        } catch (error) {
            console.error('Error getting storage summary:', error);
            throw error;
        }
    }

    /**
     * Get user's active storage subscriptions
     */
    async getActiveSubscriptions(userId) {
        try {
            const result = await this.pool.query(`
                SELECT * FROM storage_subscriptions 
                WHERE user_id = $1 AND status = 'active'
                ORDER BY created_at DESC
            `, [userId]);

            return result.rows;
        } catch (error) {
            console.error('Error getting active subscriptions:', error);
            return [];
        }
    }

    /**
     * Handle Stripe webhook events
     */
    async handleStripeWebhook(event) {
        try {
            switch (event.type) {
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                    
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                    
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionCancelled(event.data.object);
                    break;
                    
                case 'payment_intent.succeeded':
                    // Handle photography session payments (not subscription payments)
                    await this.handleSessionPaymentSuccess(event.data.object);
                    break;
                    
                case 'payment_intent.payment_failed':
                    // Handle photography session payment failures
                    await this.handleSessionPaymentFailure(event.data.object);
                    break;
                    
                default:
                    console.log('Unhandled webhook event:', event.type);
            }
        } catch (error) {
            console.error('Error handling Stripe webhook:', error);
            throw error;
        }
    }

    /**
     * Handle successful session payments (deposits and invoices)
     */
    async handleSessionPaymentSuccess(paymentIntent) {
        console.log(' Session payment successful:', paymentIntent.id);
        
        try {
            // Import payment notification manager here to avoid circular deps
            const PaymentNotificationManager = require('./payment-notifications');
            const paymentNotifier = new PaymentNotificationManager();
            
            await paymentNotifier.handlePaymentSuccess(paymentIntent);
        } catch (error) {
            console.error('Error handling session payment success:', error);
        }
    }

    /**
     * Handle failed session payments
     */
    async handleSessionPaymentFailure(paymentIntent) {
        console.log('❌ Session payment failed:', paymentIntent.id);
        
        try {
            const PaymentNotificationManager = require('./payment-notifications');
            const paymentNotifier = new PaymentNotificationManager();
            
            await paymentNotifier.handlePaymentFailure(paymentIntent);
        } catch (error) {
            console.error('Error handling session payment failure:', error);
        }
    }

    async handlePaymentSucceeded(invoice) {
        try {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const userId = subscription.metadata.userId;
            const tbCount = parseInt(subscription.metadata.tbCount);

            // Record billing history
            await this.pool.query(`
                INSERT INTO storage_billing_history (
                    user_id, stripe_payment_intent_id, amount_usd, tb_purchased,
                    billing_period_start, billing_period_end, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userId,
                invoice.payment_intent,
                invoice.amount_paid / 100, // Convert from cents
                tbCount,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000),
                'succeeded'
            ]);

            console.log(` Storage payment succeeded for user ${userId}: ${tbCount}TB`);
        } catch (error) {
            console.error('Error handling payment success:', error);
        }
    }

    async handlePaymentFailed(invoice) {
        try {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const userId = subscription.metadata.userId;

            // Mark subscription as payment_failed
            await this.pool.query(`
                UPDATE storage_subscriptions 
                SET status = 'payment_failed', updated_at = NOW()
                WHERE stripe_subscription_id = $1
            `, [subscription.id]);

            console.log(`❌ Storage payment failed for user ${userId}`);
        } catch (error) {
            console.error('Error handling payment failure:', error);
        }
    }

    async handleSubscriptionCancelled(subscription) {
        try {
            const userId = subscription.metadata.userId;
            const tbCount = parseInt(subscription.metadata.tbCount);

            // Mark subscription as cancelled
            await this.pool.query(`
                UPDATE storage_subscriptions 
                SET status = 'cancelled', updated_at = NOW()
                WHERE stripe_subscription_id = $1
            `, [subscription.id]);

            // Reduce user's quota
            await this.pool.query(`
                UPDATE user_storage_quotas 
                SET purchased_tb = GREATEST(0, purchased_tb - $1),
                    total_quota_gb = free_storage_gb + GREATEST(0, purchased_tb - $1) * 1024,
                    updated_at = NOW()
                WHERE user_id = $2
            `, [tbCount, userId]);

            console.log(`❌ Storage subscription cancelled for user ${userId}: ${tbCount}TB removed`);
        } catch (error) {
            console.error('Error handling subscription cancellation:', error);
        }
    }
}

module.exports = StorageSystem;
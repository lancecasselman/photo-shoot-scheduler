/**
 * Storage Billing Integration with Stripe
 * Handles subscription management and payment processing
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StorageBilling {
    constructor(storageSystem) {
        this.storageSystem = storageSystem;
        this.PACKAGE_PRICE = 25; // $25/month per TB
    }

    /**
     * Create Stripe customer for user
     */
    async createCustomer(email, userId) {
        try {
            const customer = await stripe.customers.create({
                email: email,
                metadata: {
                    userId: userId,
                    service: 'storage'
                }
            });

            console.log(`✅ Created Stripe customer for ${email}: ${customer.id}`);
            return customer;
        } catch (error) {
            console.error('Error creating Stripe customer:', error);
            throw error;
        }
    }

    /**
     * Create storage subscription
     */
    async createStorageSubscription(customerId, userId, tbCount) {
        try {
            const subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Storage Package - ${tbCount}TB`,
                            description: `${tbCount}TB cloud storage for photography sessions`
                        },
                        unit_amount: this.PACKAGE_PRICE * 100, // Convert to cents
                        recurring: { interval: 'month' }
                    },
                    quantity: tbCount
                }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    userId: userId,
                    tbCount: tbCount.toString(),
                    service: 'storage'
                }
            });

            console.log(`✅ Created storage subscription: ${subscription.id} for ${tbCount}TB`);
            return subscription;
        } catch (error) {
            console.error('Error creating storage subscription:', error);
            throw error;
        }
    }

    /**
     * Get customer's payment methods
     */
    async getPaymentMethods(customerId) {
        try {
            const paymentMethods = await stripe.paymentMethods.list({
                customer: customerId,
                type: 'card',
            });

            return paymentMethods.data;
        } catch (error) {
            console.error('Error getting payment methods:', error);
            return [];
        }
    }

    /**
     * Update subscription quantity (change TB count)
     */
    async updateSubscription(subscriptionId, newTbCount) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            const updated = await stripe.subscriptions.update(subscriptionId, {
                items: [{
                    id: subscription.items.data[0].id,
                    quantity: newTbCount,
                }],
                metadata: {
                    ...subscription.metadata,
                    tbCount: newTbCount.toString()
                }
            });

            console.log(`✅ Updated subscription ${subscriptionId} to ${newTbCount}TB`);
            return updated;
        } catch (error) {
            console.error('Error updating subscription:', error);
            throw error;
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId) {
        try {
            const cancelled = await stripe.subscriptions.del(subscriptionId);
            console.log(`✅ Cancelled subscription: ${subscriptionId}`);
            return cancelled;
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            throw error;
        }
    }

    /**
     * Get subscription details
     */
    async getSubscription(subscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
                expand: ['latest_invoice', 'customer']
            });
            return subscription;
        } catch (error) {
            console.error('Error getting subscription:', error);
            throw error;
        }
    }

    /**
     * Process webhook event
     */
    async processWebhook(event) {
        try {
            console.log(`📧 Processing webhook: ${event.type}`);

            switch (event.type) {
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSuccess(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    await this.handlePaymentFailure(event.data.object);
                    break;

                case 'customer.subscription.created':
                    await this.handleSubscriptionCreated(event.data.object);
                    break;

                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;

                default:
                    console.log(`Unhandled webhook event: ${event.type}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error processing webhook:', error);
            throw error;
        }
    }

    async handlePaymentSuccess(invoice) {
        try {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const userId = subscription.metadata.userId;
            const tbCount = parseInt(subscription.metadata.tbCount);

            console.log(`💳 Payment succeeded for user ${userId}: ${tbCount}TB`);

            // Record in billing history via storage system
            await this.storageSystem.handleStripeWebhook({
                type: 'invoice.payment_succeeded',
                data: { object: invoice }
            });

        } catch (error) {
            console.error('Error handling payment success:', error);
        }
    }

    async handlePaymentFailure(invoice) {
        try {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const userId = subscription.metadata.userId;

            console.log(`❌ Payment failed for user ${userId}`);

            // Update storage system
            await this.storageSystem.handleStripeWebhook({
                type: 'invoice.payment_failed',
                data: { object: invoice }
            });

        } catch (error) {
            console.error('Error handling payment failure:', error);
        }
    }

    async handleSubscriptionCreated(subscription) {
        try {
            const userId = subscription.metadata.userId;
            const tbCount = parseInt(subscription.metadata.tbCount);

            console.log(`✅ Subscription created for user ${userId}: ${tbCount}TB`);

            // Storage system will handle this via other webhooks
        } catch (error) {
            console.error('Error handling subscription creation:', error);
        }
    }

    async handleSubscriptionUpdated(subscription) {
        try {
            const userId = subscription.metadata.userId;
            const tbCount = parseInt(subscription.metadata.tbCount);

            console.log(`🔄 Subscription updated for user ${userId}: ${tbCount}TB`);

            // Update storage system quotas
            // This should trigger recalculation of user's total quota
        } catch (error) {
            console.error('Error handling subscription update:', error);
        }
    }

    async handleSubscriptionDeleted(subscription) {
        try {
            const userId = subscription.metadata.userId;

            console.log(`❌ Subscription deleted for user ${userId}`);

            // Handle via storage system
            await this.storageSystem.handleStripeWebhook({
                type: 'customer.subscription.deleted',
                data: { object: subscription }
            });

        } catch (error) {
            console.error('Error handling subscription deletion:', error);
        }
    }

    /**
     * Get billing summary for user
     */
    async getBillingSummary(userId) {
        try {
            // Get from storage system
            const summary = await this.storageSystem.getStorageSummary(userId);
            
            // Add Stripe-specific data
            const subscriptions = [];
            for (const sub of summary.activeSubscriptions) {
                try {
                    const stripeSub = await this.getSubscription(sub.stripe_subscription_id);
                    subscriptions.push({
                        ...sub,
                        stripeData: {
                            status: stripeSub.status,
                            current_period_end: stripeSub.current_period_end,
                            cancel_at_period_end: stripeSub.cancel_at_period_end
                        }
                    });
                } catch (error) {
                    console.error(`Error getting Stripe data for subscription ${sub.stripe_subscription_id}:`, error);
                    subscriptions.push(sub);
                }
            }

            return {
                ...summary,
                activeSubscriptions: subscriptions
            };
        } catch (error) {
            console.error('Error getting billing summary:', error);
            throw error;
        }
    }
}

module.exports = StorageBilling;
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { users, creditPackages, creditPurchases, platformCreditUsage } = require('../../shared/schema');
const { eq, desc, sum, and, gte } = require('drizzle-orm');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Credit-based billing system for photography platform
 * Replaces monthly subscriptions with pay-as-you-go credit packages
 */
class CreditBillingService {
    constructor() {
        this.CREDIT_COSTS = {
            AI_GENERATION: 1,      // 1 credit per AI generation
            STORAGE_UPGRADE: 50,    // 50 credits per 1TB storage upgrade  
            PREMIUM_FEATURES: 5,    // 5 credits for premium features
            WEBSITE_BUILDER: 2      // 2 credits per website operation
        };
    }

    /**
     * Initialize default credit packages
     */
    async initializePackages() {
        try {
            // Check if packages already exist
            const existingPackages = await db.select().from(creditPackages).limit(1);
            if (existingPackages.length > 0) {
                console.log('✓ Credit packages already initialized');
                return;
            }

            const packages = [
                {
                    id: uuidv4(),
                    name: 'Starter Pack',
                    description: 'Perfect for small photography businesses',
                    creditAmount: 100,
                    price: '19.99',
                    stripePriceId: 'price_starter_100', // To be replaced with actual Stripe price IDs
                    isActive: true,
                    sortOrder: 1
                },
                {
                    id: uuidv4(),
                    name: 'Professional Pack',
                    description: 'Best value for active photographers',
                    creditAmount: 500,
                    price: '79.99',
                    stripePriceId: 'price_professional_500',
                    isActive: true,
                    isPopular: true,
                    sortOrder: 2
                },
                {
                    id: uuidv4(),
                    name: 'Studio Pack',
                    description: 'For high-volume photography studios',
                    creditAmount: 1000,
                    price: '149.99',
                    stripePriceId: 'price_studio_1000',
                    isActive: true,
                    sortOrder: 3
                },
                {
                    id: uuidv4(),
                    name: 'Enterprise Pack',
                    description: 'Maximum credits for large operations',
                    creditAmount: 2500,
                    price: '349.99',
                    stripePriceId: 'price_enterprise_2500',
                    isActive: true,
                    sortOrder: 4
                }
            ];

            await db.insert(creditPackages).values(packages);
            console.log('✓ Credit packages initialized successfully');
        } catch (error) {
            console.error('Error initializing credit packages:', error);
        }
    }

    /**
     * Get all active credit packages
     */
    async getPackages() {
        try {
            return await db.select()
                .from(creditPackages)
                .where(eq(creditPackages.isActive, true))
                .orderBy(creditPackages.sortOrder);
        } catch (error) {
            console.error('Error getting credit packages:', error);
            return [];
        }
    }

    /**
     * Get user's current credit balance
     */
    async getUserCredits(userId) {
        try {
            const [user] = await db.select({ credits: users.credits })
                .from(users)
                .where(eq(users.id, userId));
            
            return user?.credits || 0;
        } catch (error) {
            console.error('Error getting user credits:', error);
            return 0;
        }
    }

    /**
     * Create Stripe checkout session for credit purchase
     */
    async createCreditCheckout(userId, packageId, successUrl, cancelUrl) {
        try {
            // Get package details
            const [pkg] = await db.select()
                .from(creditPackages)
                .where(and(
                    eq(creditPackages.id, packageId),
                    eq(creditPackages.isActive, true)
                ));

            if (!pkg) {
                throw new Error('Credit package not found');
            }

            // Get or create Stripe customer
            let [user] = await db.select({ stripeCustomerId: users.stripeCustomerId, email: users.email })
                .from(users)
                .where(eq(users.id, userId));

            if (!user.stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    metadata: { userId }
                });
                
                await db.update(users)
                    .set({ stripeCustomerId: customer.id })
                    .where(eq(users.id, userId));
                
                user.stripeCustomerId = customer.id;
            }

            // Create checkout session
            const session = await stripe.checkout.sessions.create({
                customer: user.stripeCustomerId,
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: pkg.name,
                            description: `${pkg.creditAmount} credits - ${pkg.description}`
                        },
                        unit_amount: Math.round(parseFloat(pkg.price) * 100)
                    },
                    quantity: 1
                }],
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    userId,
                    packageId: pkg.id,
                    creditAmount: pkg.creditAmount.toString(),
                    type: 'credit_purchase'
                }
            });

            // Record pending purchase
            await db.insert(creditPurchases).values({
                id: uuidv4(),
                userId,
                packageId: pkg.id,
                creditAmount: pkg.creditAmount,
                amountPaid: pkg.price,
                stripePaymentIntentId: session.payment_intent,
                status: 'pending'
            });

            return session;
        } catch (error) {
            console.error('Error creating credit checkout:', error);
            throw error;
        }
    }

    /**
     * Process successful credit purchase
     */
    async processCreditPurchase(stripePaymentIntentId) {
        try {
            // Find the purchase record
            const [purchase] = await db.select()
                .from(creditPurchases)
                .where(eq(creditPurchases.stripePaymentIntentId, stripePaymentIntentId));

            if (!purchase || purchase.status === 'completed') {
                return { success: false, message: 'Purchase not found or already processed' };
            }

            // Update user's credit balance
            await db.update(users)
                .set({ 
                    credits: purchase.creditAmount,
                    totalCreditsPurchased: purchase.creditAmount,
                    lastCreditPurchase: new Date()
                })
                .where(eq(users.id, purchase.userId));

            // Mark purchase as completed
            await db.update(creditPurchases)
                .set({ status: 'completed' })
                .where(eq(creditPurchases.id, purchase.id));

            console.log(`✓ Credit purchase completed: ${purchase.creditAmount} credits for user ${purchase.userId}`);
            
            return { 
                success: true, 
                creditAmount: purchase.creditAmount,
                userId: purchase.userId 
            };
        } catch (error) {
            console.error('Error processing credit purchase:', error);
            throw error;
        }
    }

    /**
     * Use credits for a specific feature
     */
    async useCredits(userId, featureType, creditsToUse, description = '', metadata = {}) {
        try {
            // Check if user has enough credits
            const currentCredits = await this.getUserCredits(userId);
            if (currentCredits < creditsToUse) {
                return { 
                    success: false, 
                    message: 'Insufficient credits',
                    currentCredits,
                    requiredCredits: creditsToUse
                };
            }

            // Deduct credits from user balance
            await db.update(users)
                .set({ 
                    credits: currentCredits - creditsToUse,
                    totalCreditsUsed: creditsToUse
                })
                .where(eq(users.id, userId));

            // Record credit usage
            await db.insert(platformCreditUsage).values({
                id: uuidv4(),
                userId,
                featureType,
                creditsUsed: creditsToUse,
                description,
                metadata
            });

            console.log(`✓ Credits used: ${creditsToUse} for ${featureType} by user ${userId}`);
            
            return { 
                success: true, 
                creditsUsed: creditsToUse,
                remainingCredits: currentCredits - creditsToUse
            };
        } catch (error) {
            console.error('Error using credits:', error);
            throw error;
        }
    }

    /**
     * Get user's credit usage history
     */
    async getCreditHistory(userId, limit = 50) {
        try {
            const purchases = await db.select()
                .from(creditPurchases)
                .where(eq(creditPurchases.userId, userId))
                .orderBy(desc(creditPurchases.createdAt))
                .limit(limit);

            const usage = await db.select()
                .from(platformCreditUsage)
                .where(eq(platformCreditUsage.userId, userId))
                .orderBy(desc(platformCreditUsage.createdAt))
                .limit(limit);

            return { purchases, usage };
        } catch (error) {
            console.error('Error getting credit history:', error);
            return { purchases: [], usage: [] };
        }
    }

    /**
     * Get credit usage summary for analytics
     */
    async getCreditAnalytics(userId) {
        try {
            // Total credits purchased
            const [totalPurchased] = await db.select({
                total: sum(creditPurchases.creditAmount)
            })
            .from(creditPurchases)
            .where(and(
                eq(creditPurchases.userId, userId),
                eq(creditPurchases.status, 'completed')
            ));

            // Total credits used
            const [totalUsed] = await db.select({
                total: sum(platformCreditUsage.creditsUsed)
            })
            .from(platformCreditUsage)
            .where(eq(platformCreditUsage.userId, userId));

            // Usage by feature type
            const usageByFeature = await db.select({
                featureType: platformCreditUsage.featureType,
                total: sum(platformCreditUsage.creditsUsed)
            })
            .from(platformCreditUsage)
            .where(eq(platformCreditUsage.userId, userId))
            .groupBy(platformCreditUsage.featureType);

            const currentCredits = await this.getUserCredits(userId);

            return {
                currentCredits,
                totalPurchased: totalPurchased?.total || 0,
                totalUsed: totalUsed?.total || 0,
                usageByFeature
            };
        } catch (error) {
            console.error('Error getting credit analytics:', error);
            return {
                currentCredits: 0,
                totalPurchased: 0,
                totalUsed: 0,
                usageByFeature: []
            };
        }
    }

    /**
     * Process Stripe webhook for credit purchases
     */
    async processWebhook(event) {
        try {
            console.log(`Processing credit webhook: ${event.type}`);

            switch (event.type) {
                case 'checkout.session.completed':
                    if (event.data.object.metadata?.type === 'credit_purchase') {
                        await this.processCreditPurchase(event.data.object.payment_intent);
                    }
                    break;

                case 'payment_intent.succeeded':
                    await this.processCreditPurchase(event.data.object.id);
                    break;

                default:
                    console.log(`Unhandled credit webhook event: ${event.type}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error processing credit webhook:', error);
            throw error;
        }
    }
}

module.exports = CreditBillingService;
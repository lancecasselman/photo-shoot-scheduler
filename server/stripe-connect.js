// Stripe Connect Express Account Management
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeConnectManager {
    constructor() {
        if (!process.env.STRIPE_SECRET_KEY) {
            console.warn('Stripe Connect: No secret key provided');
        }
    }

    // Create Express Account for photographer
    async createExpressAccount(email, businessName, country = 'US') {
        try {
            const account = await stripe.accounts.create({
                type: 'express',
                country: country,
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                },
                business_type: 'individual',
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'daily'
                        }
                    }
                }
            });

            console.log(' Express account created:', account.id, 'for:', email);
            return {
                success: true,
                accountId: account.id,
                account: account
            };

        } catch (error) {
            console.error('❌ Error creating Express account:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create account link for onboarding
    async createAccountLink(accountId, refreshUrl, returnUrl) {
        try {
            const accountLink = await stripe.accountLinks.create({
                account: accountId,
                refresh_url: refreshUrl,
                return_url: returnUrl,
                type: 'account_onboarding'
            });

            return {
                success: true,
                onboardingUrl: accountLink.url
            };

        } catch (error) {
            console.error('❌ Error creating account link:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Check account onboarding status
    async getAccountStatus(accountId) {
        try {
            const account = await stripe.accounts.retrieve(accountId);
            
            const isOnboardingComplete = account.details_submitted && 
                                       account.charges_enabled && 
                                       account.payouts_enabled;

            return {
                success: true,
                account: account,
                onboardingComplete: isOnboardingComplete,
                canReceivePayments: account.charges_enabled,
                canReceivePayouts: account.payouts_enabled,
                requiresInfo: account.requirements?.currently_due?.length > 0
            };

        } catch (error) {
            console.error('❌ Error checking account status:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create payment intent for connected account
    async createPaymentIntent(amount, connectedAccountId, metadata = {}) {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true,
                },
                metadata: metadata,
                // Route payment to connected account
                transfer_data: {
                    destination: connectedAccountId,
                },
                // Optional: Take application fee (platform fee)
                // application_fee_amount: Math.round(amount * 0.02 * 100), // 2% fee
            });

            return {
                success: true,
                paymentIntent: paymentIntent,
                clientSecret: paymentIntent.client_secret
            };

        } catch (error) {
            console.error('❌ Error creating payment intent for connected account:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create checkout session for connected account
    async createCheckoutSession(sessionData, connectedAccountId, successUrl, cancelUrl) {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: sessionData.name || 'Photography Session Payment',
                                description: sessionData.description || 'Payment for photography services'
                            },
                            unit_amount: Math.round(sessionData.amount * 100)
                        },
                        quantity: 1
                    }
                ],
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: sessionData.metadata || {},
                // Route payment to connected account
                payment_intent_data: {
                    transfer_data: {
                        destination: connectedAccountId,
                    },
                    // Optional: Application fee
                    // application_fee_amount: Math.round(sessionData.amount * 0.02 * 100),
                }
            });

            return {
                success: true,
                session: session,
                checkoutUrl: session.url
            };

        } catch (error) {
            console.error('❌ Error creating checkout session for connected account:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delete/deactivate account (for testing)
    async deleteAccount(accountId) {
        try {
            await stripe.accounts.del(accountId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting account:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = StripeConnectManager;
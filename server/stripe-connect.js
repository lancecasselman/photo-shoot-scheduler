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
            console.log('🔧 STRIPE: Creating new Express account for email:', email);
            console.log('🔧 STRIPE: Business name:', businessName, 'Country:', country);
            
            // Create unique Express account - each photographer gets their own
            // Add unique identifier to prevent any account cross-contamination
            const uniqueId = Math.random().toString(36).substring(2, 15);
            
            const account = await stripe.accounts.create({
                type: 'express', // Express is the simplest - Stripe handles all compliance
                country: country,
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                },
                business_type: 'individual', // Simplest for sole proprietors
                // Prefill as much as possible to reduce onboarding steps
                business_profile: {
                    mcc: '7333', // Photography studios MCC code
                    name: businessName || 'Photography Business',
                    product_description: 'Professional photography services including portraits, weddings, and events',
                    support_email: email,
                    url: 'https://photomanagementsystem.com' // Generic URL to skip this step
                },
                metadata: {
                    photographer_email: email,
                    platform: 'photography_management_system',
                    unique_id: uniqueId,
                    business_name: businessName || 'Photography Business',
                    created_at: new Date().toISOString()
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'daily', // Fastest payout schedule
                            delay_days: 2 // Minimum delay for daily payouts
                        },
                        statement_descriptor: 'PHOTO' // Short descriptor for bank statements
                    },
                    payments: {
                        statement_descriptor: 'PHOTOGRAPHY', // What appears on customer statements
                        statement_descriptor_prefix: 'PHOTO' // Prefix for dynamic descriptors
                    },
                    card_payments: {
                        decline_on: {
                            avs_failure: false, // Don't decline on address mismatch (easier for clients)
                            cvc_failure: true // Still check CVV for security
                        }
                    }
                }
            });

            console.log('✅ STRIPE: Express account created successfully!');
            console.log('✅ STRIPE: Account ID:', account.id);
            console.log('✅ STRIPE: Account email:', account.email);
            console.log('✅ STRIPE: Account status:', account.details_submitted ? 'Details submitted' : 'Needs onboarding');
            
            return {
                success: true,
                accountId: account.id,
                account: account
            };

        } catch (error) {
            console.error('❌ STRIPE: Error creating Express account for:', email);
            console.error('❌ STRIPE: Error details:', error.message);
            console.error('❌ STRIPE: Error type:', error.type);
            console.error('❌ STRIPE: Error code:', error.code);
            
            // Log the full error for debugging
            if (error.raw) {
                console.error('❌ STRIPE: Raw error:', JSON.stringify(error.raw, null, 2));
            }
            
            return {
                success: false,
                error: error.message,
                errorType: error.type,
                errorCode: error.code
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

    // Create onboarding link for Express account
    async createAccountLink(accountId, refreshUrl, returnUrl) {
        try {
            console.log('🔗 STRIPE: Creating onboarding link for account:', accountId);
            
            const accountLink = await stripe.accountLinks.create({
                account: accountId,
                refresh_url: refreshUrl,
                return_url: returnUrl,
                type: 'account_onboarding',
            });

            console.log('✅ STRIPE: Onboarding link created');
            return {
                success: true,
                onboardingUrl: accountLink.url,
                expiresAt: accountLink.expires_at
            };

        } catch (error) {
            console.error('❌ STRIPE: Failed to create onboarding link:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create login link for photographer to access Stripe dashboard
    async createLoginLink(accountId) {
        try {
            console.log('🔗 STRIPE: Creating login link for account:', accountId);
            
            const loginLink = await stripe.accounts.createLoginLink(accountId);

            console.log('✅ STRIPE: Login link created');
            return {
                success: true,
                url: loginLink.url
            };

        } catch (error) {
            console.error('❌ STRIPE: Failed to create login link:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create customer on photographer's connected account
    async createCustomer(email, name, photographerAccountId) {
        try {
            console.log('👤 STRIPE CONNECT: Creating customer on photographer account:', photographerAccountId);
            
            const customer = await stripe.customers.create({
                email: email,
                name: name,
                metadata: {
                    platform: 'photography_management_system',
                    photographer_account: photographerAccountId
                }
            }, {
                stripeAccount: photographerAccountId
            });

            console.log('✅ STRIPE CONNECT: Customer created:', customer.id);
            return {
                success: true,
                customer: customer
            };

        } catch (error) {
            console.error('❌ STRIPE CONNECT: Failed to create customer:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create invoice on photographer's connected account
    async createInvoice(customerId, items, photographerAccountId, metadata = {}, options = {}) {
        try {
            console.log('📋 STRIPE CONNECT: Creating invoice on photographer account:', photographerAccountId);
            
            // Create invoice
            const invoice = await stripe.invoices.create({
                customer: customerId,
                collection_method: 'send_invoice',
                days_until_due: options.daysUntilDue || 7,
                description: options.description || 'Photography Services Invoice',
                footer: options.footer || '',
                custom_fields: options.customFields || [],
                metadata: {
                    ...metadata,
                    photographer_account: photographerAccountId,
                    platform: 'photography_management_system'
                }
            }, {
                stripeAccount: photographerAccountId
            });

            // Add invoice items
            for (const item of items) {
                await stripe.invoiceItems.create({
                    customer: customerId,
                    invoice: invoice.id,
                    amount: Math.round(item.amount * 100), // Convert to cents
                    currency: 'usd',
                    description: item.description,
                    metadata: item.metadata || {}
                }, {
                    stripeAccount: photographerAccountId
                });
            }

            // Finalize and send invoice
            const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {}, {
                stripeAccount: photographerAccountId
            });

            const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id, {}, {
                stripeAccount: photographerAccountId
            });

            console.log('✅ STRIPE CONNECT: Invoice created and sent:', sentInvoice.id);
            return {
                success: true,
                invoice: sentInvoice
            };

        } catch (error) {
            console.error('❌ STRIPE CONNECT: Failed to create invoice:', error.message);
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
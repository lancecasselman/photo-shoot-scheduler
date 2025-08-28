const express = require('express');
const router = express.Router();
const UnifiedSubscriptionManager = require('./unified-subscription-manager');

/**
 * Subscription API Routes
 * Handles all subscription operations across platforms
 */
function createSubscriptionRoutes(pool) {
    const subscriptionManager = new UnifiedSubscriptionManager(pool);

    // Initialize subscription system
    router.post('/init', async (req, res) => {
        try {
            await subscriptionManager.initializeTables();
            res.json({ success: true, message: 'Subscription system initialized' });
        } catch (error) {
            console.error('Error initializing subscription system:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Create Professional Plan (Stripe) - Web only (handles both existing users and new account creation)
    router.post('/professional/stripe', async (req, res) => {
        try {
            const { email, password, name, createAccount = false } = req.body;
            let userId;

            // If creating account with subscription, handle account creation
            if (createAccount && email && name) {
                console.log('🔔 Creating/getting account with Professional Plan subscription');
                
                // Validate password if provided (for new accounts)
                if (password && password.length < 8) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Password must be at least 8 characters long' 
                    });
                }
                
                // Create user account first
                const firebase = require('firebase-admin');
                
                try {
                    let userRecord;
                    try {
                        // Try to create new user with password
                        const userCreationData = {
                            email: email,
                            displayName: name,
                            emailVerified: false // Will be verified after payment
                        };
                        
                        // Add password if provided (for new accounts)
                        if (password) {
                            userCreationData.password = password;
                        } else {
                            // Generate a secure temporary password if none provided
                            userCreationData.password = require('crypto').randomBytes(16).toString('hex');
                        }
                        
                        userRecord = await firebase.auth().createUser(userCreationData);
                        console.log(`✅ Created new Firebase user: ${userRecord.uid} with password`);
                    } catch (createError) {
                        if (createError.code === 'auth/email-already-exists') {
                            // Email exists, get the existing user
                            userRecord = await firebase.auth().getUserByEmail(email);
                            console.log(`✅ Using existing Firebase user: ${userRecord.uid}`);
                            
                            // Update password if provided for existing user
                            if (password) {
                                try {
                                    await firebase.auth().updateUser(userRecord.uid, { password });
                                    console.log(`🔐 Updated password for existing user: ${userRecord.uid}`);
                                } catch (pwError) {
                                    console.log(`⚠️ Could not update password: ${pwError.message}`);
                                }
                            }
                        } else {
                            throw createError;
                        }
                    }
                    
                    userId = userRecord.uid;
                    
                    // Create or update user in database
                    const client = await pool.connect();
                    try {
                        await client.query(`
                            INSERT INTO users (id, email, username, display_name, created_at, subscription_status)
                            VALUES ($1, $2, $3, $4, NOW(), 'pending')
                            ON CONFLICT (id) DO UPDATE SET
                                email = EXCLUDED.email,
                                display_name = EXCLUDED.display_name,
                                subscription_status = 'pending',
                                updated_at = NOW()
                        `, [userId, email, email.split('@')[0], name]);
                    } finally {
                        client.release();
                    }
                    
                    console.log(`✅ Created user account ${userId} for subscription`);
                } catch (createError) {
                    console.error('❌ Error creating user account:', createError);
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Failed to create account: ' + createError.message 
                    });
                }
            } else {
                // Check authentication for existing users
                if (!req.session?.user?.uid) {
                    console.log('❌ No authenticated user found in session:', req.session);
                    return res.status(401).json({ success: false, error: 'Authentication required' });
                }
                userId = req.session.user.uid;
            }

            // Create subscription with Stripe checkout session
            const result = await subscriptionManager.createProfessionalPlanCheckout(
                userId, 
                email || req.session?.user?.email, 
                name || req.session?.user?.displayName
            );

            res.json(result);
        } catch (error) {
            console.error('Error creating professional plan:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Add Storage Add-on (Stripe) - Web only
    router.post('/storage/stripe', async (req, res) => {
        try {
            if (!req.session?.user?.uid) {
                console.log('❌ No authenticated user found in session:', req.session);
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const { tbCount } = req.body;
            const userId = req.session.user.uid;

            if (!tbCount || tbCount < 1 || tbCount > 50) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid TB count. Must be between 1 and 50.' 
                });
            }

            const result = await subscriptionManager.addStorageAddonCheckout(userId, parseInt(tbCount));
            res.json(result);
        } catch (error) {
            console.error('Error adding storage add-on:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Process iOS subscription - Mobile app only
    router.post('/ios/verify', async (req, res) => {
        try {
            const { userId, receiptData, productId } = req.body;

            if (!userId || !receiptData || !productId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Missing required fields: userId, receiptData, productId' 
                });
            }

            const result = await subscriptionManager.processiOSSubscription(userId, receiptData, productId);
            res.json(result);
        } catch (error) {
            console.error('Error processing iOS subscription:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Process Android subscription - Mobile app only
    router.post('/android/verify', async (req, res) => {
        try {
            const { userId, purchaseToken, productId, packageName } = req.body;

            if (!userId || !purchaseToken || !productId || !packageName) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Missing required fields: userId, purchaseToken, productId, packageName' 
                });
            }

            const result = await subscriptionManager.processAndroidSubscription(
                userId, purchaseToken, productId, packageName
            );
            res.json(result);
        } catch (error) {
            console.error('Error processing Android subscription:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get user's subscription status - All platforms
    router.get('/status', async (req, res) => {
        try {
            if (!req.session?.user?.uid) {
                console.log('❌ No authenticated user found in session:', req.session);
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const userId = req.session.user.uid;
            const status = await subscriptionManager.getUserSubscriptionStatus(userId);
            
            res.json({ success: true, status });
        } catch (error) {
            console.error('Error getting subscription status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get user's subscription status by userId - Mobile app endpoint
    router.get('/status/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const status = await subscriptionManager.getUserSubscriptionStatus(userId);
            
            res.json({ success: true, status });
        } catch (error) {
            console.error('Error getting subscription status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Stripe webhook handler
    router.post('/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
        console.log('🔔 Stripe webhook received at /api/subscriptions/webhook/stripe');
        
        try {
            const sig = req.headers['stripe-signature'];
            console.log('📝 Webhook signature present:', !!sig);
            let event;

            try {
                event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
                console.log(`✅ Webhook event verified: ${event.type}, ID: ${event.id}`);
            } catch (err) {
                console.error('❌ Webhook signature verification failed:', err.message);
                console.error('Make sure STRIPE_WEBHOOK_SECRET is correctly configured');
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }

            console.log(`🎯 Processing webhook event: ${event.type}`);
            await subscriptionManager.processStripeWebhook(event);
            console.log(`✅ Webhook processed successfully: ${event.type}`);
            res.json({ received: true });
        } catch (error) {
            console.error('❌ Error processing Stripe webhook:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Test endpoints for development
    if (process.env.NODE_ENV !== 'production') {
        router.post('/test/create-subscription', async (req, res) => {
            try {
                const { userId, email, type } = req.body;
                
                if (type === 'professional') {
                    const result = await subscriptionManager.createProfessionalPlanStripe(userId, email);
                    res.json(result);
                } else if (type === 'storage') {
                    const { tbCount } = req.body;
                    const result = await subscriptionManager.addStorageAddonStripe(userId, tbCount || 1);
                    res.json(result);
                } else {
                    res.status(400).json({ success: false, error: 'Invalid subscription type' });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // Manual subscription recording for testing
        router.post('/test/record-subscription', async (req, res) => {
            try {
                const { userId, subscriptionId } = req.body;
                
                console.log(`🧪 TEST: Manually recording subscription for user ${userId}`);
                
                // Record the subscription
                await subscriptionManager.recordStripeSubscription(
                    userId,
                    subscriptionId || 'test_sub_' + Date.now(),
                    'professional',
                    39.00
                );
                
                // Update the summary
                await subscriptionManager.updateUserSubscriptionSummary(userId);
                
                console.log(`✅ TEST: Subscription recorded successfully`);
                res.json({ 
                    success: true, 
                    message: 'Subscription recorded successfully',
                    userId,
                    subscriptionId: subscriptionId || 'test_sub_' + Date.now()
                });
            } catch (error) {
                console.error('❌ TEST: Error recording subscription:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    // Cancel specific subscription
    router.post('/cancel/:subscriptionId', async (req, res) => {
        try {
            if (!req.session?.user?.uid) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const { subscriptionId } = req.params;
            const { reason } = req.body;
            const userId = req.session.user.uid;

            const result = await subscriptionManager.cancelUserSubscription(
                userId, 
                subscriptionId, 
                reason || 'user_requested'
            );
            
            res.json({ success: true, result });
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Cancel all user subscriptions
    router.post('/cancel-all', async (req, res) => {
        try {
            if (!req.session?.user?.uid) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const { reason } = req.body;
            const userId = req.session.user.uid;

            const result = await subscriptionManager.cancelAllUserSubscriptions(
                userId, 
                reason || 'user_requested'
            );
            
            res.json({ success: true, result });
        } catch (error) {
            console.error('Error cancelling all subscriptions:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get Stripe public key for frontend
    router.get('/stripe-public-key', (req, res) => {
        try {
            const publicKey = process.env.VITE_STRIPE_PUBLIC_KEY;
            if (!publicKey) {
                return res.status(500).json({ error: 'Stripe public key not configured' });
            }
            res.json({ publicKey });
        } catch (error) {
            console.error('Error getting Stripe public key:', error);
            res.status(500).json({ error: 'Failed to get public key' });
        }
    });

    // Verify Stripe checkout session after successful payment
    router.post('/verify-session', async (req, res) => {
        try {
            const { sessionId } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Session ID is required' 
                });
            }

            // Retrieve the session from Stripe
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['customer', 'subscription']
            });

            if (!session) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Session not found' 
                });
            }

            // Check if payment was successful
            if (session.payment_status !== 'paid') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Payment not completed' 
                });
            }

            // Get user info from session metadata or customer
            const userId = session.metadata?.userId;
            const email = session.customer_email || session.customer?.email;
            
            // Check if user needs onboarding
            let needsOnboarding = false;
            if (userId) {
                const client = await pool.connect();
                try {
                    const result = await client.query(
                        'SELECT onboarding_completed FROM users WHERE id = $1',
                        [userId]
                    );
                    needsOnboarding = !result.rows[0]?.onboarding_completed;
                } finally {
                    client.release();
                }
            } else {
                // New user created during checkout
                needsOnboarding = true;
            }

            console.log(`✅ Session verified: ${sessionId}, User: ${userId || email}, Needs onboarding: ${needsOnboarding}`);

            res.json({
                success: true,
                sessionId: session.id,
                userId,
                email,
                needsOnboarding,
                subscriptionId: session.subscription?.id || session.subscription
            });
        } catch (error) {
            console.error('Error verifying session:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    return router;
}

module.exports = createSubscriptionRoutes;
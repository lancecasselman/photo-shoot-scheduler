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

    // Create Professional Plan (Stripe) - Web only
    router.post('/professional/stripe', async (req, res) => {
        try {
            // Check authentication
            if (!req.session?.user?.uid) {
                console.log('❌ No authenticated user found in session:', req.session);
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const { email, paymentMethodId } = req.body;
            const userId = req.session.user.uid;

            const result = await subscriptionManager.createProfessionalPlanStripe(
                userId, 
                email || req.session.user.email, 
                paymentMethodId
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

            const result = await subscriptionManager.addStorageAddonStripe(userId, parseInt(tbCount));
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
        try {
            const sig = req.headers['stripe-signature'];
            let event;

            try {
                event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }

            await subscriptionManager.processStripeWebhook(event);
            res.json({ received: true });
        } catch (error) {
            console.error('Error processing Stripe webhook:', error);
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

    return router;
}

module.exports = createSubscriptionRoutes;
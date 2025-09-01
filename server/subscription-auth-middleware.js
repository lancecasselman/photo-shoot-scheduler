/**
 * Subscription-aware authentication middleware
 * Blocks access for users without active subscriptions
 */

const UnifiedSubscriptionManager = require('./unified-subscription-manager');

class SubscriptionAuthMiddleware {
    constructor(pool) {
        this.subscriptionManager = new UnifiedSubscriptionManager(pool);
    }

    /**
     * Middleware to check if user has active subscription
     * Blocks access for cancelled/expired subscriptions
     */
    requireActiveSubscription = async (req, res, next) => {
        try {
            // Check if user is authenticated first - try multiple authentication methods
            let userId = null;
            let userEmail = null;

            // Method 1: Check session user data
            if (req.session?.user?.uid) {
                userId = req.session.user.uid;
                userEmail = req.session.user.email;
            }
            // Method 2: Check if user was set by previous middleware
            else if (req.user?.uid) {
                userId = req.user.uid;
                userEmail = req.user.email;
            }
            // Method 3: Check Firebase auth header (for API calls)
            else if (req.headers.authorization) {
                try {
                    const token = req.headers.authorization.split('Bearer ')[1];
                    if (token) {
                        const { admin } = require('./firebase-admin');
                        const decodedToken = await admin.auth().verifyIdToken(token);
                        userId = decodedToken.uid;
                        userEmail = decodedToken.email;
                        console.log('🔥 Firebase token verified for user:', userEmail);
                    }
                } catch (firebaseError) {
                    console.log('🔥 Firebase token verification failed:', firebaseError.message);
                }
            }

            if (!userId) {
                console.log('🚫 Authentication failed - no valid user ID found');
                return res.status(401).json({ 
                    error: 'Authentication required',
                    redirectTo: '/secure-login.html',
                    debug: {
                        hasSession: !!req.session,
                        hasSessionUser: !!req.session?.user,
                        hasReqUser: !!req.user,
                        hasAuthHeader: !!req.headers.authorization
                    }
                });
            }

            // ADMIN BYPASS: Skip subscription check for admin emails
            const adminEmails = [
                'lancecasselman@icloud.com',
                'lancecasselman2011@gmail.com', 
                'lance@thelegacyphotography.com'
            ];

            if (adminEmails.includes(userEmail?.toLowerCase())) {
                console.log(`✅ Admin bypass: ${userEmail} granted access without subscription check`);
                req.subscriptionStatus = { 
                    hasProfessionalPlan: true, 
                    professionalStatus: 'active',
                    isAdmin: true 
                };
                return next();
            }

            // Get user's subscription status
            const subscriptionStatus = await this.subscriptionManager.getUserSubscriptionStatus(userId);

            // Check if user has active professional plan
            if (!subscriptionStatus.hasProfessionalPlan) {
                return res.status(402).json({
                    error: 'Active subscription required',
                    message: 'You need an active Professional Plan to access this feature.',
                    subscriptionRequired: true,
                    redirectTo: '/subscription-checkout.html',
                    currentStatus: subscriptionStatus
                });
            }

            // Check if subscription is actually active (not cancelled/expired)
            if (subscriptionStatus.professionalStatus !== 'active') {
                return res.status(402).json({
                    error: 'Subscription inactive',
                    message: `Your subscription is ${subscriptionStatus.professionalStatus}. Please reactivate to continue.`,
                    subscriptionRequired: true,
                    redirectTo: '/subscription-checkout.html',
                    currentStatus: subscriptionStatus
                });
            }

            // Add subscription info to request for later use
            req.subscriptionStatus = subscriptionStatus;
            next();

        } catch (error) {
            console.error('❌ Error checking subscription status:', error);
            res.status(500).json({ 
                error: 'Failed to verify subscription status',
                message: 'Please try again later or contact support.'
            });
        }
    };

    /**
     * Middleware for routes that should work for both subscribed and non-subscribed users
     * but with different feature access (like limited storage for free users)
     */
    optionalSubscriptionCheck = async (req, res, next) => {
        try {
            if (!req.session?.user?.uid) {
                req.subscriptionStatus = null;
                return next();
            }

            const userId = req.session.user.uid;
            const subscriptionStatus = await this.subscriptionManager.getUserSubscriptionStatus(userId);
            req.subscriptionStatus = subscriptionStatus;
            next();

        } catch (error) {
            console.error('❌ Error in optional subscription check:', error);
            req.subscriptionStatus = null;
            next(); // Continue without subscription info
        }
    };

    /**
     * Check storage quota before allowing uploads
     */
    requireStorageQuota = async (req, res, next) => {
        try {
            if (!req.session?.user?.uid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const userId = req.session.user.uid;
            const subscriptionStatus = await this.subscriptionManager.getUserSubscriptionStatus(userId);

            // Check if user has any storage quota
            if (subscriptionStatus.totalStorageGb <= 0) {
                return res.status(402).json({
                    error: 'No storage quota',
                    message: 'You need an active subscription to upload files.',
                    subscriptionRequired: true,
                    redirectTo: '/subscription-checkout.html'
                });
            }

            // TODO: Check current usage vs quota
            // This would require integration with the storage system
            // For now, we just check they have a subscription

            req.subscriptionStatus = subscriptionStatus;
            next();

        } catch (error) {
            console.error('❌ Error checking storage quota:', error);
            res.status(500).json({ error: 'Failed to verify storage quota' });
        }
    };

    /**
     * Admin-only routes (for admin website builder, etc.)
     */
    requireAdmin = async (req, res, next) => {
        try {
            if (!req.session?.user?.uid || !req.session?.user?.email) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const adminEmails = [
                'lancecasselman2011@gmail.com',
                'lancecasselman@icloud.com', 
                'lance@thelegacyphotography.com'
            ];

            if (!adminEmails.includes(req.session.user.email?.toLowerCase())) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            next();

        } catch (error) {
            console.error('❌ Error checking admin status:', error);
            res.status(500).json({ error: 'Failed to verify admin status' });
        }
    };

    /**
     * Get subscription status for frontend (doesn't block access)
     */
    getSubscriptionStatus = async (req, res) => {
        try {
            if (!req.session?.user?.uid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const userId = req.session.user.uid;
            const subscriptionStatus = await this.subscriptionManager.getUserSubscriptionStatus(userId);

            res.json({
                success: true,
                status: subscriptionStatus,
                hasAccess: subscriptionStatus.hasProfessionalPlan && subscriptionStatus.professionalStatus === 'active'
            });

        } catch (error) {
            console.error('❌ Error getting subscription status:', error);
            res.status(500).json({ error: 'Failed to get subscription status' });
        }
    };
}

module.exports = SubscriptionAuthMiddleware;
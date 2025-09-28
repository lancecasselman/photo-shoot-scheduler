/**
 * Enhanced Subscription & Trial Authentication Middleware
 * Implements 3-day free trial with guaranteed access termination
 * Blocks access for expired trials and inactive subscriptions
 */

const UnifiedSubscriptionManager = require('./unified-subscription-manager');
const { Pool } = require('pg');
const { isAdminEmail, getAdminEmails } = require('../shared/admin-config');

class SubscriptionAuthMiddleware {
    constructor(pool) {
        this.subscriptionManager = new UnifiedSubscriptionManager(pool);
        this.pool = pool;
        this.TRIAL_DURATION_DAYS = 3;
    }

    /**
     * Initialize trial for new user
     */
    async initializeTrial(userId, userEmail) {
        const client = await this.pool.connect();
        try {
            const trialStart = new Date();
            const trialEnd = new Date(trialStart.getTime() + (this.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000));
            
            await client.query(
                `UPDATE users SET 
                 trial_start_date = $1, 
                 trial_end_date = $2, 
                 trial_used = TRUE,
                 subscription_status = 'trial',
                 access_restricted = FALSE
                 WHERE id = $3`,
                [trialStart, trialEnd, userId]
            );
            
            console.log(`🆓 Trial initialized for ${userEmail}: ${this.TRIAL_DURATION_DAYS} days until ${trialEnd.toISOString()}`);
            return { trialStart, trialEnd, isActive: true };
        } finally {
            client.release();
        }
    }

    /**
     * Check trial status with guaranteed access termination
     */
    async checkTrialStatus(userId, userEmail) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                `SELECT trial_start_date, trial_end_date, trial_used, 
                        subscription_status, access_restricted,
                        trial_expired_notification_sent
                 FROM users WHERE id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return { hasValidAccess: false, reason: 'user_not_found' };
            }

            const user = result.rows[0];
            const now = new Date();
            
            // If user has never started a trial, initialize it
            if (!user.trial_used) {
                await this.initializeTrial(userId, userEmail);
                return { 
                    hasValidAccess: true, 
                    status: 'trial_active',
                    trialEnd: new Date(now.getTime() + (this.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000))
                };
            }

            // Check if trial has expired
            const trialEnd = new Date(user.trial_end_date);
            const isTrialExpired = now > trialEnd;

            if (isTrialExpired) {
                // GUARANTEED ACCESS TERMINATION: Mark as restricted immediately
                await client.query(
                    `UPDATE users SET 
                     access_restricted = TRUE,
                     subscription_status = 'trial_expired'
                     WHERE id = $1`,
                    [userId]
                );

                console.log(`🚫 TRIAL EXPIRED: Access terminated for ${userEmail} (expired: ${trialEnd.toISOString()})`);
                return { 
                    hasValidAccess: false, 
                    reason: 'trial_expired',
                    trialEnd: trialEnd,
                    expiredHours: Math.round((now - trialEnd) / (1000 * 60 * 60))
                };
            }

            // Trial is still active
            const hoursRemaining = Math.round((trialEnd - now) / (1000 * 60 * 60));
            console.log(`⏰ Trial active for ${userEmail}: ${hoursRemaining} hours remaining`);
            
            return { 
                hasValidAccess: true, 
                status: 'trial_active',
                trialEnd: trialEnd,
                hoursRemaining: hoursRemaining
            };
            
        } finally {
            client.release();
        }
    }

    /**
     * Enhanced middleware with trial support and guaranteed access termination
     * MULTIPLE LAYERS OF PROTECTION:
     * 1. Real-time trial expiration checking
     * 2. Database-level access restriction flags  
     * 3. Subscription status verification
     * 4. Admin bypass system
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

            // ADMIN BYPASS: Skip all checks for admin emails using shared config
            if (isAdminEmail(userEmail)) {
                console.log(`✅ Admin bypass: ${userEmail} granted access without trial/subscription check`);
                req.subscriptionStatus = { 
                    hasProfessionalPlan: true, 
                    professionalStatus: 'active',
                    isAdmin: true,
                    trialStatus: 'admin_bypass'
                };
                return next();
            }

            // STEP 1: Check trial status first (guaranteed access termination)
            const trialStatus = await this.checkTrialStatus(userId, userEmail);
            
            if (!trialStatus.hasValidAccess) {
                console.log(`🚫 ACCESS DENIED: ${trialStatus.reason} for ${userEmail}`);
                
                if (trialStatus.reason === 'trial_expired') {
                    return res.status(402).json({
                        error: 'Trial period expired',
                        message: `Your 3-day free trial expired ${trialStatus.expiredHours} hours ago. Subscribe now to restore access.`,
                        trialExpired: true,
                        subscriptionRequired: true,
                        redirectTo: '/subscription-checkout.html',
                        trialEndDate: trialStatus.trialEnd,
                        expiredHours: trialStatus.expiredHours
                    });
                }
                
                return res.status(401).json({
                    error: 'Access denied',
                    message: 'Unable to verify access permissions.',
                    redirectTo: '/secure-login.html'
                });
            }

            // STEP 2: Check if user has upgraded to paid subscription
            const subscriptionStatus = await this.subscriptionManager.getUserSubscriptionStatus(userId);
            
            // If user has active paid subscription, grant full access
            if (subscriptionStatus.hasProfessionalPlan && subscriptionStatus.professionalStatus === 'active') {
                console.log(`✅ PAID SUBSCRIPTION: Full access granted to ${userEmail}`);
                req.subscriptionStatus = {
                    ...subscriptionStatus,
                    trialStatus: 'upgraded_to_paid'
                };
                return next();
            }

            // STEP 3: User is on active trial - grant temporary access
            console.log(`⏰ TRIAL ACCESS: ${trialStatus.hoursRemaining} hours remaining for ${userEmail}`);
            req.subscriptionStatus = {
                hasProfessionalPlan: false,
                professionalStatus: 'trial',
                totalStorageGb: 100, // Trial includes 100GB
                trialStatus: trialStatus.status,
                trialEnd: trialStatus.trialEnd,
                hoursRemaining: trialStatus.hoursRemaining,
                isTrial: true
            };
            
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

            if (!isAdminEmail(req.session.user.email)) {
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
            const userEmail = req.session.user.email;
            
            // Check trial status first
            const trialStatus = await this.checkTrialStatus(userId, userEmail);
            const subscriptionStatus = await this.subscriptionManager.getUserSubscriptionStatus(userId);

            res.json({
                success: true,
                status: subscriptionStatus,
                trialStatus: trialStatus,
                hasAccess: trialStatus.hasValidAccess || (subscriptionStatus.hasProfessionalPlan && subscriptionStatus.professionalStatus === 'active'),
                isTrial: trialStatus.hasValidAccess && trialStatus.status === 'trial_active'
            });

        } catch (error) {
            console.error('❌ Error getting subscription status:', error);
            res.status(500).json({ error: 'Failed to get subscription status' });
        }
    };

    /**
     * Background job to check and terminate expired trials
     * Run this every hour to guarantee access termination
     */
    async checkExpiredTrials() {
        const client = await this.pool.connect();
        try {
            console.log('🔍 BACKGROUND JOB: Checking for expired trials...');
            
            const now = new Date();
            
            // Find all users with expired trials that haven't been restricted yet
            const expiredTrials = await client.query(`
                SELECT id, email, display_name, trial_end_date, subscription_status
                FROM users 
                WHERE trial_used = TRUE 
                AND trial_end_date < $1 
                AND access_restricted = FALSE
                AND subscription_status != 'active'
            `, [now]);

            if (expiredTrials.rows.length === 0) {
                console.log('✅ No expired trials found');
                return { expiredCount: 0, terminatedCount: 0 };
            }

            console.log(`🚫 Found ${expiredTrials.rows.length} expired trials to terminate`);
            
            let terminatedCount = 0;
            
            for (const user of expiredTrials.rows) {
                try {
                    // GUARANTEED ACCESS TERMINATION: Mark as restricted
                    await client.query(`
                        UPDATE users SET 
                        access_restricted = TRUE,
                        subscription_status = 'trial_expired'
                        WHERE id = $1
                    `, [user.id]);

                    const expiredHours = Math.round((now - new Date(user.trial_end_date)) / (1000 * 60 * 60));
                    console.log(`🔒 TERMINATED: ${user.email} (expired ${expiredHours} hours ago)`);
                    terminatedCount++;
                    
                    // TODO: Send expiration notification email
                    // await this.sendTrialExpiredNotification(user.email, user.display_name);
                    
                } catch (error) {
                    console.error(`❌ Failed to terminate trial for ${user.email}:`, error);
                }
            }

            console.log(`✅ BACKGROUND JOB COMPLETE: Terminated ${terminatedCount}/${expiredTrials.rows.length} expired trials`);
            return { expiredCount: expiredTrials.rows.length, terminatedCount };
            
        } catch (error) {
            console.error('❌ Error in expired trials background job:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Initialize trial system background jobs
     */
    initializeTrialJobs() {
        const cron = require('node-cron');
        
        // Run every hour to check for expired trials
        cron.schedule('0 * * * *', async () => {
            try {
                await this.checkExpiredTrials();
            } catch (error) {
                console.error('❌ Trial expiration background job failed:', error);
            }
        });

        console.log('⏰ Trial system background jobs initialized (runs hourly)');
    }
}

module.exports = SubscriptionAuthMiddleware;
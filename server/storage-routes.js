/**
 * Photography Management System Storage API Routes
 * Complete quota enforcement and billing endpoints
 */

const express = require('express');

function registerStorageRoutes(app, isAuthenticated, normalizeUser, storageSystem) {
    
    // Get user's storage summary
    app.get('/api/storage/summary', isAuthenticated, async (req, res) => {
        try {
            const normalizedUser = normalizeUser(req.user);
            const userId = normalizedUser.uid;
            const summary = await storageSystem.getStorageSummary(userId);
            res.json(summary);
        } catch (error) {
            console.error('Error getting storage summary:', error);
            res.status(500).json({ error: 'Failed to get storage summary' });
        }
    });

    // Check if user can upload a file
    app.post('/api/storage/check-upload', isAuthenticated, async (req, res) => {
        try {
            const normalizedUser = normalizeUser(req.user);
            const userId = normalizedUser.uid;
            const { fileSizeBytes } = req.body;

            if (!fileSizeBytes || fileSizeBytes <= 0) {
                return res.status(400).json({ error: 'Valid file size required' });
            }

            const result = await storageSystem.canUpload(userId, fileSizeBytes);
            res.json(result);
        } catch (error) {
            console.error('Error checking upload permission:', error);
            res.status(500).json({ error: 'Failed to check upload permission' });
        }
    });

    // Purchase storage package
    app.post('/api/storage/purchase', isAuthenticated, async (req, res) => {
        try {
            const normalizedUser = normalizeUser(req.user);
            const userId = normalizedUser.uid;
            const { tbCount = 1 } = req.body;
            const customerEmail = req.user.email;

            if (!customerEmail) {
                return res.status(400).json({ error: 'User email required for billing' });
            }

            if (tbCount < 1 || tbCount > 10) {
                return res.status(400).json({ error: 'TB count must be between 1 and 10' });
            }

            const result = await storageSystem.purchaseStoragePackage(userId, tbCount, customerEmail);
            res.json(result);
        } catch (error) {
            console.error('Error purchasing storage:', error);
            res.status(500).json({ error: 'Failed to purchase storage package' });
        }
    });

    // Get active subscriptions
    app.get('/api/storage/subscriptions', isAuthenticated, async (req, res) => {
        try {
            const normalizedUser = normalizeUser(req.user);
            const userId = normalizedUser.uid;
            const subscriptions = await storageSystem.getActiveSubscriptions(userId);
            res.json(subscriptions);
        } catch (error) {
            console.error('Error getting subscriptions:', error);
            res.status(500).json({ error: 'Failed to get subscriptions' });
        }
    });

    // Cancel storage subscription
    app.delete('/api/storage/subscription/:subscriptionId', isAuthenticated, async (req, res) => {
        try {
            const normalizedUser = normalizeUser(req.user);
            const userId = normalizedUser.uid;
            const { subscriptionId } = req.params;

            // Verify subscription belongs to user
            const result = await storageSystem.pool.query(`
                SELECT * FROM storage_subscriptions 
                WHERE stripe_subscription_id = $1 AND user_id = $2
            `, [subscriptionId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Subscription not found' });
            }

            // Cancel in Stripe
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            await stripe.subscriptions.del(subscriptionId);

            res.json({ message: 'Subscription cancelled successfully' });
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            res.status(500).json({ error: 'Failed to cancel subscription' });
        }
    });

    // Log storage usage (for uploads/deletes)
    app.post('/api/storage/log-usage', isAuthenticated, async (req, res) => {
        try {
            const normalizedUser = normalizeUser(req.user);
            const userId = normalizedUser.uid;
            const { sessionId, action, fileSizeBytes, folderType, filename } = req.body;

            if (!['upload', 'delete'].includes(action)) {
                return res.status(400).json({ error: 'Invalid action' });
            }

            if (!['gallery', 'raw'].includes(folderType)) {
                return res.status(400).json({ error: 'Invalid folder type' });
            }

            await storageSystem.logStorageChange(userId, sessionId, action, fileSizeBytes, folderType, filename);
            res.json({ message: 'Usage logged successfully' });
        } catch (error) {
            console.error('Error logging usage:', error);
            res.status(500).json({ error: 'Failed to log usage' });
        }
    });

    // Get storage usage analytics
    app.get('/api/storage/analytics', isAuthenticated, async (req, res) => {
        try {
            const userId = normalizeUser(req.user.uid);
            const { days = 30 } = req.query;

            const result = await storageSystem.pool.query(`
                SELECT 
                    DATE(timestamp) as date,
                    action,
                    folder_type,
                    COUNT(*) as file_count,
                    SUM(file_size_bytes) as total_bytes
                FROM storage_usage_logs 
                WHERE user_id = $1 
                AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
                GROUP BY DATE(timestamp), action, folder_type
                ORDER BY date DESC
            `, [userId]);

            res.json(result.rows);
        } catch (error) {
            console.error('Error getting analytics:', error);
            res.status(500).json({ error: 'Failed to get analytics' });
        }
    });

    // Stripe webhook endpoint
    app.post('/api/storage/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
        try {
            const sig = req.headers['stripe-signature'];
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            
            let event;
            try {
                event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }

            await storageSystem.handleStripeWebhook(event);
            res.json({ received: true });
        } catch (error) {
            console.error('Error handling webhook:', error);
            res.status(500).json({ error: 'Webhook handling failed' });
        }
    });

    // Recalculate storage usage (admin/debug endpoint)
    app.post('/api/storage/recalculate/:userId', isAuthenticated, async (req, res) => {
        try {
            const { userId } = req.params;
            const requestingUser = normalizeUser(req.user.uid);
            
            // Only allow users to recalculate their own storage or admin access
            if (userId !== requestingUser && requestingUser !== '44735007') {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const usage = await storageSystem.calculateStorageUsage(userId);
            res.json({
                message: 'Storage usage recalculated',
                usage: usage
            });
        } catch (error) {
            console.error('Error recalculating storage:', error);
            res.status(500).json({ error: 'Failed to recalculate storage' });
        }
    });
}

module.exports = { registerStorageRoutes };
// Platform Analytics System for Photography SaaS

class AnalyticsSystem {
    constructor(pool) {
        this.pool = pool;
    }

    // Get comprehensive platform analytics
    async getPlatformAnalytics(timeframe = 30) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - timeframe);

            const analytics = {
                revenue: await this.getRevenueMetrics(startDate, endDate),
                users: await this.getUserMetrics(startDate, endDate),
                sessions: await this.getSessionMetrics(startDate, endDate),
                storage: await this.getStorageMetrics(),
                support: await this.getSupportMetrics(startDate, endDate),
                metrics: await this.getBusinessMetrics(startDate, endDate),
                photographers: await this.getTopPhotographers(10),
                content: await this.getContentMetrics(startDate, endDate)
            };

            return analytics;

        } catch (error) {
            console.error('Error generating platform analytics:', error);
            throw error;
        }
    }

    // Revenue analytics
    async getRevenueMetrics(startDate, endDate) {
        try {
            // Current period revenue
            const currentRevenue = await this.pool.query(`
                SELECT 
                    COUNT(DISTINCT us.user_id) as active_subscribers,
                    COALESCE(SUM(CASE WHEN us.plan_type = 'professional' THEN 39 ELSE 0 END), 0) as base_revenue,
                    COALESCE(SUM(us.storage_add_ons * 25), 0) as addon_revenue,
                    COALESCE(SUM(CASE WHEN us.plan_type = 'professional' THEN 39 ELSE 0 END) + SUM(us.storage_add_ons * 25), 0) as total_revenue
                FROM user_subscriptions us
                WHERE us.status = 'active'
                AND us.created_at <= $1
            `, [endDate]);

            // Previous period for comparison
            const prevEndDate = new Date(startDate);
            const prevStartDate = new Date(startDate);
            prevStartDate.setDate(prevStartDate.getDate() - (endDate - startDate) / (1000 * 60 * 60 * 24));

            const previousRevenue = await this.pool.query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN us.plan_type = 'professional' THEN 39 ELSE 0 END) + SUM(us.storage_add_ons * 25), 0) as total_revenue
                FROM user_subscriptions us
                WHERE us.status = 'active'
                AND us.created_at <= $1
                AND us.created_at >= $2
            `, [prevEndDate, prevStartDate]);

            const current = currentRevenue.rows[0] || {};
            const previous = previousRevenue.rows[0] || {};
            
            const change = previous.total_revenue > 0 
                ? ((current.total_revenue - previous.total_revenue) / previous.total_revenue) * 100
                : 0;

            return {
                total: parseFloat(current.total_revenue || 0),
                base: parseFloat(current.base_revenue || 0),
                addons: parseFloat(current.addon_revenue || 0),
                change: change,
                subscribers: parseInt(current.active_subscribers || 0)
            };

        } catch (error) {
            console.error('Error calculating revenue metrics:', error);
            return { total: 0, base: 0, addons: 0, change: 0, subscribers: 0 };
        }
    }

    // User growth and engagement metrics
    async getUserMetrics(startDate, endDate) {
        try {
            // Active users (logged in within timeframe)
            const activeUsers = await this.pool.query(`
                SELECT COUNT(DISTINCT user_id) as active_count
                FROM user_sessions
                WHERE last_activity >= $1
            `, [startDate]);

            // New signups in period
            const newSignups = await this.pool.query(`
                SELECT COUNT(*) as signup_count
                FROM users
                WHERE created_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            // Trial to paid conversions
            const conversions = await this.pool.query(`
                SELECT 
                    COUNT(CASE WHEN us.plan_type = 'professional' AND u.created_at BETWEEN $1 AND $2 THEN 1 END) as converted,
                    COUNT(CASE WHEN u.created_at BETWEEN $1 AND $2 THEN 1 END) as total_signups
                FROM users u
                LEFT JOIN user_subscriptions us ON u.uid = us.user_id AND us.status = 'active'
                WHERE u.created_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            const conversionData = conversions.rows[0] || {};
            const conversionRate = conversionData.total_signups > 0 
                ? (conversionData.converted / conversionData.total_signups) * 100 
                : 0;

            return {
                active: parseInt(activeUsers.rows[0]?.active_count || 0),
                new: parseInt(newSignups.rows[0]?.signup_count || 0),
                signups: parseInt(newSignups.rows[0]?.signup_count || 0),
                conversionRate: conversionRate
            };

        } catch (error) {
            console.error('Error calculating user metrics:', error);
            return { active: 0, new: 0, signups: 0, conversionRate: 0 };
        }
    }

    // Session and content metrics
    async getSessionMetrics(startDate, endDate) {
        try {
            // Sessions created in period
            const sessions = await this.pool.query(`
                SELECT 
                    COUNT(*) as total_sessions,
                    AVG(
                        COALESCE(
                            (SELECT SUM(sf.file_size) FROM session_files sf WHERE sf.session_id = s.id), 
                            0
                        )
                    ) as avg_session_size
                FROM sessions s
                WHERE s.created_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            // Previous period comparison
            const prevStartDate = new Date(startDate);
            prevStartDate.setDate(prevStartDate.getDate() - (endDate - startDate) / (1000 * 60 * 60 * 24));

            const prevSessions = await this.pool.query(`
                SELECT COUNT(*) as total_sessions
                FROM sessions s
                WHERE s.created_at BETWEEN $1 AND $2
            `, [prevStartDate, startDate]);

            const current = sessions.rows[0] || {};
            const previous = prevSessions.rows[0] || {};

            const change = previous.total_sessions > 0 
                ? ((current.total_sessions - previous.total_sessions) / previous.total_sessions) * 100
                : 0;

            return {
                total: parseInt(current.total_sessions || 0),
                change: change,
                avgSize: parseInt(current.avg_session_size || 0)
            };

        } catch (error) {
            console.error('Error calculating session metrics:', error);
            return { total: 0, change: 0, avgSize: 0 };
        }
    }

    // Storage usage across platform
    async getStorageMetrics() {
        try {
            const storage = await this.pool.query(`
                SELECT 
                    COALESCE(SUM(ss.storage_used), 0) as total_used,
                    COALESCE(SUM(ss.storage_quota), 0) as total_quota,
                    COUNT(DISTINCT ss.user_id) as users_with_storage
                FROM storage_summary ss
                WHERE ss.storage_used > 0
            `);

            const result = storage.rows[0] || {};

            return {
                used: parseInt(result.total_used || 0),
                total: parseInt(result.total_quota || 0),
                users: parseInt(result.users_with_storage || 0),
                utilization: result.total_quota > 0 ? (result.total_used / result.total_quota) * 100 : 0
            };

        } catch (error) {
            console.error('Error calculating storage metrics:', error);
            return { used: 0, total: 0, users: 0, utilization: 0 };
        }
    }

    // Support ticket metrics
    async getSupportMetrics(startDate, endDate) {
        try {
            const support = await this.pool.query(`
                SELECT 
                    COUNT(*) as total_tickets,
                    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
                    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
                    AVG(
                        CASE WHEN resolved_at IS NOT NULL 
                        THEN EXTRACT(HOURS FROM (resolved_at - created_at))
                        END
                    ) as avg_resolution_hours
                FROM support_tickets
                WHERE created_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            const result = support.rows[0] || {};
            const resolutionRate = result.total_tickets > 0 
                ? (result.resolved_tickets / result.total_tickets) * 100 
                : 0;

            return {
                total: parseInt(result.total_tickets || 0),
                open: parseInt(result.open_tickets || 0),
                resolved: parseInt(result.resolved_tickets || 0),
                resolutionRate: resolutionRate,
                avgResolutionTime: parseFloat(result.avg_resolution_hours || 0)
            };

        } catch (error) {
            console.error('Error calculating support metrics:', error);
            return { total: 0, open: 0, resolved: 0, resolutionRate: 0, avgResolutionTime: 0 };
        }
    }

    // Business health metrics
    async getBusinessMetrics(startDate, endDate) {
        try {
            // Churn rate calculation
            const churn = await this.pool.query(`
                SELECT 
                    COUNT(CASE WHEN status = 'cancelled' AND updated_at BETWEEN $1 AND $2 THEN 1 END) as cancelled,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_start
                FROM user_subscriptions
            `, [startDate, endDate]);

            const churnData = churn.rows[0] || {};
            const churnRate = churnData.active_start > 0 
                ? (churnData.cancelled / churnData.active_start) * 100 
                : 0;

            // Customer Lifetime Value (simplified)
            const ltv = await this.pool.query(`
                SELECT 
                    AVG(total_revenue) as avg_ltv
                FROM (
                    SELECT 
                        us.user_id,
                        SUM(CASE WHEN us.plan_type = 'professional' THEN 39 ELSE 0 END) + 
                        SUM(us.storage_add_ons * 25) as total_revenue
                    FROM user_subscriptions us
                    WHERE us.status IN ('active', 'cancelled')
                    GROUP BY us.user_id
                ) as user_revenue
            `);

            return {
                churnRate: churnRate,
                cancelled: parseInt(churnData.cancelled || 0),
                avgLTV: parseFloat(ltv.rows[0]?.avg_ltv || 0)
            };

        } catch (error) {
            console.error('Error calculating business metrics:', error);
            return { churnRate: 0, cancelled: 0, avgLTV: 0 };
        }
    }

    // Top performing photographers
    async getTopPhotographers(limit = 10) {
        try {
            const photographers = await this.pool.query(`
                SELECT 
                    u.email,
                    u.display_name,
                    us.plan_type as plan,
                    us.status,
                    u.created_at as joinedAt,
                    COALESCE(
                        CASE WHEN us.plan_type = 'professional' THEN 39 ELSE 0 END + 
                        (us.storage_add_ons * 25), 0
                    ) as revenue,
                    COALESCE(session_count.count, 0) as sessions,
                    COALESCE(ss.storage_used, 0) as storage
                FROM users u
                LEFT JOIN user_subscriptions us ON u.uid = us.user_id AND us.status = 'active'
                LEFT JOIN storage_summary ss ON u.uid = ss.user_id
                LEFT JOIN (
                    SELECT user_id, COUNT(*) as count
                    FROM sessions
                    GROUP BY user_id
                ) session_count ON u.uid = session_count.user_id
                ORDER BY revenue DESC, sessions DESC
                LIMIT $1
            `, [limit]);

            return photographers.rows.map(row => ({
                email: row.email,
                displayName: row.display_name,
                plan: row.plan || 'Free',
                status: row.status || 'active',
                joinedAt: row.joinedat,
                revenue: parseFloat(row.revenue || 0),
                sessions: parseInt(row.sessions || 0),
                storage: parseInt(row.storage || 0)
            }));

        } catch (error) {
            console.error('Error fetching top photographers:', error);
            return [];
        }
    }

    // Content metrics
    async getContentMetrics(startDate, endDate) {
        try {
            const content = await this.pool.query(`
                SELECT 
                    COUNT(*) as total_photos,
                    SUM(file_size) as total_size,
                    COUNT(DISTINCT session_id) as sessions_with_content
                FROM session_files
                WHERE uploaded_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            const result = content.rows[0] || {};

            return {
                photos: parseInt(result.total_photos || 0),
                totalSize: parseInt(result.total_size || 0),
                sessionsWithContent: parseInt(result.sessions_with_content || 0)
            };

        } catch (error) {
            console.error('Error calculating content metrics:', error);
            return { photos: 0, totalSize: 0, sessionsWithContent: 0 };
        }
    }

    // Get revenue trend data for charts
    async getRevenueTrend(days = 30) {
        try {
            const trend = await this.pool.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_subscriptions,
                    SUM(CASE WHEN plan_type = 'professional' THEN 39 ELSE 0 END) as daily_revenue
                FROM user_subscriptions
                WHERE created_at >= NOW() - INTERVAL '${days} days'
                AND status = 'active'
                GROUP BY DATE(created_at)
                ORDER BY date
            `);

            return trend.rows.map(row => ({
                date: row.date,
                subscriptions: parseInt(row.new_subscriptions),
                revenue: parseFloat(row.daily_revenue)
            }));

        } catch (error) {
            console.error('Error calculating revenue trend:', error);
            return [];
        }
    }

    // Initialize analytics tables
    async initializeTables() {
        try {
            // Create analytics summary table for caching
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS analytics_cache (
                    id SERIAL PRIMARY KEY,
                    metric_type VARCHAR(100) NOT NULL,
                    time_period VARCHAR(50) NOT NULL,
                    data JSONB NOT NULL,
                    calculated_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP NOT NULL,
                    UNIQUE(metric_type, time_period)
                )
            `);

            // Create user activity tracking
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_activity_log (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    activity_type VARCHAR(100) NOT NULL,
                    activity_data JSONB,
                    ip_address INET,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            console.log(' Analytics system tables initialized');

        } catch (error) {
            console.error('Error initializing analytics tables:', error);
        }
    }

    // Log user activity for analytics
    async logUserActivity(userId, activityType, data = {}, req = null) {
        try {
            await this.pool.query(`
                INSERT INTO user_activity_log (user_id, activity_type, activity_data, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                userId,
                activityType,
                JSON.stringify(data),
                req?.ip || null,
                req?.get('User-Agent') || null
            ]);

        } catch (error) {
            console.error('Error logging user activity:', error);
        }
    }
}

module.exports = AnalyticsSystem;
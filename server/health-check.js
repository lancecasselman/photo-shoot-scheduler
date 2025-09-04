// Production Health Check System
const { Pool } = require('pg');

class HealthCheck {
    constructor(pool) {
        this.pool = pool;
        this.services = {
            database: 'PostgreSQL',
            storage: 'Cloudflare R2',
            auth: 'Firebase Auth',
            payments: 'Stripe'
        };
    }

    async checkDatabase() {
        let client;
        try {
            client = await this.pool.connect();
            await client.query('SELECT 1');
            return { status: 'healthy', message: 'Database connection successful' };
        } catch (error) {
            return { status: 'unhealthy', message: `Database error: ${error.message}` };
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async checkStorage() {
        try {
            // Basic check - this would ideally test R2 connectivity
            const hasR2Config = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY;
            return hasR2Config 
                ? { status: 'healthy', message: 'Storage configuration present' }
                : { status: 'warning', message: 'Storage configuration incomplete' };
        } catch (error) {
            return { status: 'unhealthy', message: `Storage error: ${error.message}` };
        }
    }

    async checkAuth() {
        try {
            const hasFirebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT;
            return hasFirebaseConfig
                ? { status: 'healthy', message: 'Auth configuration present' }
                : { status: 'warning', message: 'Auth configuration incomplete' };
        } catch (error) {
            return { status: 'unhealthy', message: `Auth error: ${error.message}` };
        }
    }

    async checkPayments() {
        try {
            const hasStripeConfig = process.env.STRIPE_SECRET_KEY;
            return hasStripeConfig
                ? { status: 'healthy', message: 'Payment configuration present' }
                : { status: 'warning', message: 'Payment configuration incomplete' };
        } catch (error) {
            return { status: 'unhealthy', message: `Payment error: ${error.message}` };
        }
    }

    async getSystemHealth() {
        const checks = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            services: {}
        };

        // Run all health checks
        const [database, storage, auth, payments] = await Promise.all([
            this.checkDatabase(),
            this.checkStorage(),
            this.checkAuth(),
            this.checkPayments()
        ]);

        checks.services = { database, storage, auth, payments };
        
        // Overall system status
        const hasUnhealthy = Object.values(checks.services).some(service => service.status === 'unhealthy');
        checks.overall = hasUnhealthy ? 'unhealthy' : 'healthy';

        return checks;
    }

    // Express middleware for health endpoint
    async healthEndpoint(req, res) {
        try {
            const health = await this.getSystemHealth();
            const statusCode = health.overall === 'healthy' ? 200 : 503;
            
            // Log health check results for monitoring
            if (health.overall === 'unhealthy') {
                console.warn('Health check failed:', JSON.stringify(health, null, 2));
            }
            
            res.status(statusCode).json(health);
        } catch (error) {
            console.error('Health check endpoint error:', error);
            res.status(500).json({
                overall: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString(),
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
}

module.exports = HealthCheck;
// Production Monitoring Routes
const express = require('express');
const router = express.Router();

module.exports = (healthCheck, logger) => {
    // Health check endpoint
    router.get('/health', async (req, res) => {
        try {
            await healthCheck.healthEndpoint(req, res);
        } catch (error) {
            logger.error('Health check failed', { error: error.message });
            res.status(500).json({ error: 'Health check failed' });
        }
    });

    // Basic metrics endpoint
    router.get('/metrics', (req, res) => {
        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0',
            platform: process.platform,
            nodeVersion: process.version
        };
        
        res.json(metrics);
    });

    // Ready check for container orchestration
    router.get('/ready', async (req, res) => {
        try {
            const health = await healthCheck.getSystemHealth();
            if (health.overall === 'healthy') {
                res.status(200).json({ status: 'ready' });
            } else {
                res.status(503).json({ status: 'not ready', health });
            }
        } catch (error) {
            res.status(503).json({ status: 'not ready', error: error.message });
        }
    });

    // Live check for basic server functionality
    router.get('/live', (req, res) => {
        res.status(200).json({ 
            status: 'alive',
            timestamp: new Date().toISOString()
        });
    });

    return router;
};
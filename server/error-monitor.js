
const logger = require('./production-logger');

class ErrorMonitor {
    constructor() {
        this.errors = [];
        this.maxErrors = 100; // Keep last 100 errors
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Capture uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.logError('uncaught_exception', error);
        });

        // Capture unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.logError('unhandled_rejection', reason);
        });
    }

    async logError(type, error, metadata = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            type,
            message: error.message || error,
            stack: error.stack,
            metadata,
            pid: process.pid
        };

        this.errors.push(errorEntry);
        
        // Keep only last N errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        await logger.error(`${type}: ${error.message || error}`, metadata);
    }

    getRecentErrors(count = 10) {
        return this.errors.slice(-count);
    }

    async healthCheck() {
        const recentErrors = this.getRecentErrors(5);
        const criticalErrors = recentErrors.filter(e => 
            e.type === 'uncaught_exception' || e.type === 'database_error'
        );

        return {
            status: criticalErrors.length > 0 ? 'warning' : 'healthy',
            recentErrorCount: recentErrors.length,
            criticalErrorCount: criticalErrors.length,
            lastError: recentErrors.length > 0 ? recentErrors[recentErrors.length - 1] : null
        };
    }
}

module.exports = new ErrorMonitor();

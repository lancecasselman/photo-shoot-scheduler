// Production Logging System
const fs = require('fs');
const path = require('path');

class ProductionLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatLogEntry(level, message, meta = {}) {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            meta,
            pid: process.pid,
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV
        }) + '\n';
    }

    async writeToFile(filename, entry) {
        const filePath = path.join(this.logDir, filename);
        try {
            await fs.promises.appendFile(filePath, entry);
        } catch (error) {
            console.error('Log file write error:', error);
        }
    }

    async info(message, meta = {}) {
        const entry = this.formatLogEntry('info', message, meta);
        console.log(message, meta);
        if (process.env.NODE_ENV === 'production') {
            await this.writeToFile('app.log', entry);
        }
    }

    async warn(message, meta = {}) {
        const entry = this.formatLogEntry('warn', message, meta);
        console.warn(message, meta);
        if (process.env.NODE_ENV === 'production') {
            await this.writeToFile('app.log', entry);
        }
    }

    async error(message, meta = {}) {
        const entry = this.formatLogEntry('error', message, meta);
        console.error(message, meta);
        if (process.env.NODE_ENV === 'production') {
            await this.writeToFile('error.log', entry);
            await this.writeToFile('app.log', entry);
        }
    }

    // Request logging middleware
    requestLogger(req, res, next) {
        const start = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData = {
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
                userAgent: req.get('User-Agent'),
                ip: req.ip || req.connection.remoteAddress
            };
            
            if (res.statusCode >= 400) {
                this.warn(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, logData);
            } else {
                this.info(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, logData);
            }
        });
        
        next();
    }

    // Database query logger
    logDatabaseQuery(query, duration, error = null) {
        const logData = {
            query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
            duration: `${duration}ms`
        };

        if (error) {
            this.error('Database query failed', { ...logData, error: error.message });
        } else if (duration > 1000) {
            this.warn('Slow database query detected', logData);
        } else {
            this.info('Database query executed', logData);
        }
    }

    // Performance monitoring
    logPerformance(operation, duration, metadata = {}) {
        const logData = {
            operation,
            duration: `${duration}ms`,
            ...metadata
        };

        if (duration > 5000) {
            this.warn('Slow operation detected', logData);
        } else {
            this.info('Operation completed', logData);
        }
    }
}

module.exports = new ProductionLogger();
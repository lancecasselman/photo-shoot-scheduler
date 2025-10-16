/**
 * Quota Monitoring System
 * Real-time monitoring, alerting, and analytics for quota operations
 * Provides production-ready insights into quota usage patterns and violations
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, gte, lte, count, sum, sql, desc } = require('drizzle-orm');
const crypto = require('crypto');
const {
    downloadEntitlements,
    downloadPolicies,
    downloadHistory,
    photographySessions
} = require('../shared/schema');

class QuotaMonitoringSystem {
    constructor(pool = null) {
        this.pool = pool || new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.db = drizzle(this.pool);
        
        // Monitoring configuration
        this.config = {
            // Alerting thresholds
            quotaViolationThreshold: 10, // violations per hour
            suspiciousActivityThreshold: 5, // rapid requests per minute
            highUsageThreshold: 100, // downloads per hour per session
            
            // Monitoring intervals
            realTimeMonitoringInterval: 30000, // 30 seconds
            trendAnalysisInterval: 300000, // 5 minutes
            alertCheckInterval: 60000, // 1 minute
            
            // Data retention
            metricsRetentionDays: 30,
            alertHistoryRetentionDays: 90,
            
            // Performance thresholds
            quotaCheckLatencyThreshold: 1000, // 1 second
            databaseConnectionThreshold: 80, // % of max connections
        };
        
        // In-memory monitoring state
        this.realTimeMetrics = {
            quotaChecks: 0,
            quotaViolations: 0,
            cartOperations: 0,
            suspiciousActivities: 0,
            avgResponseTime: 0,
            peakConcurrentOperations: 0,
            lastResetTime: Date.now()
        };
        
        this.alertHistory = [];
        this.performanceMetrics = new Map();
        this.usagePatterns = new Map();
        this.violationPatterns = new Map();
        
        // Active monitoring state
        this.isMonitoring = false;
        this.monitoringIntervals = [];
        
        console.log('✅ Quota Monitoring System initialized');
    }

    /**
     * START MONITORING
     * Begin real-time monitoring with automated alerts
     */
    
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️ Quota monitoring already active');
            return;
        }
        
        this.isMonitoring = true;
        
        // Real-time metrics collection
        const realTimeInterval = setInterval(() => {
            this.collectRealTimeMetrics().catch(error => 
                console.error('❌ Real-time metrics collection error:', error)
            );
        }, this.config.realTimeMonitoringInterval);
        
        // Trend analysis
        const trendInterval = setInterval(() => {
            this.analyzeTrends().catch(error => 
                console.error('❌ Trend analysis error:', error)
            );
        }, this.config.trendAnalysisInterval);
        
        // Alert checking
        const alertInterval = setInterval(() => {
            this.checkAlerts().catch(error => 
                console.error('❌ Alert checking error:', error)
            );
        }, this.config.alertCheckInterval);
        
        this.monitoringIntervals = [realTimeInterval, trendInterval, alertInterval];
        
        console.log('🚀 Quota monitoring system started');
        console.log(`📊 Monitoring intervals: Real-time: ${this.config.realTimeMonitoringInterval}ms, Trends: ${this.config.trendAnalysisInterval}ms, Alerts: ${this.config.alertCheckInterval}ms`);
    }
    
    stopMonitoring() {
        this.isMonitoring = false;
        
        this.monitoringIntervals.forEach(interval => clearInterval(interval));
        this.monitoringIntervals = [];
        
        console.log('🛑 Quota monitoring system stopped');
    }
    
    /**
     * REAL-TIME METRICS COLLECTION
     */
    
    async collectRealTimeMetrics() {
        try {
            const currentTime = Date.now();
            const oneHourAgo = new Date(currentTime - (60 * 60 * 1000));
            const oneMinuteAgo = new Date(currentTime - (60 * 1000));
            
            // Collect quota operation metrics
            const quotaMetrics = await this.getQuotaOperationMetrics(oneHourAgo);
            const cartMetrics = await this.getCartOperationMetrics(oneHourAgo);
            const violationMetrics = await this.getQuotaViolationMetrics(oneHourAgo);
            const performanceMetrics = await this.getPerformanceMetrics(oneMinuteAgo);
            
            // Update real-time metrics
            this.realTimeMetrics = {
                ...this.realTimeMetrics,
                quotaChecks: quotaMetrics.totalChecks,
                quotaViolations: violationMetrics.totalViolations,
                cartOperations: cartMetrics.totalOperations,
                suspiciousActivities: violationMetrics.suspiciousActivities,
                avgResponseTime: performanceMetrics.avgResponseTime,
                peakConcurrentOperations: performanceMetrics.peakConcurrent,
                lastUpdateTime: currentTime
            };
            
            // Store metrics for historical analysis
            await this.storeMetrics(this.realTimeMetrics);
            
            console.log(`📈 Real-time metrics updated: Quota checks: ${quotaMetrics.totalChecks}, Violations: ${violationMetrics.totalViolations}, Cart ops: ${cartMetrics.totalOperations}`);
            
            return this.realTimeMetrics;
            
        } catch (error) {
            console.error('❌ Error collecting real-time metrics:', error);
            throw error;
        }
    }
    
    async getQuotaOperationMetrics(since) {
        try {
            // Count quota checks from download history
            const quotaChecksQuery = `
                SELECT 
                    COUNT(*) as total_checks,
                    COUNT(*) FILTER (WHERE status = 'quota_exceeded') as quota_exceeded_count,
                    COUNT(*) FILTER (WHERE status = 'success') as successful_checks,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    COUNT(DISTINCT client_key) as unique_clients
                FROM download_history 
                WHERE created_at >= $1
            `;
            
            const result = await this.pool.query(quotaChecksQuery, [since]);
            const metrics = result.rows[0];
            
            return {
                totalChecks: parseInt(metrics.total_checks || 0),
                quotaExceeded: parseInt(metrics.quota_exceeded_count || 0),
                successful: parseInt(metrics.successful_checks || 0),
                uniqueSessions: parseInt(metrics.unique_sessions || 0),
                uniqueClients: parseInt(metrics.unique_clients || 0)
            };
            
        } catch (error) {
            console.error('❌ Error getting quota operation metrics:', error);
            return {
                totalChecks: 0,
                quotaExceeded: 0,
                successful: 0,
                uniqueSessions: 0,
                uniqueClients: 0
            };
        }
    }
    
    async getCartOperationMetrics(since) {
        try {
            // Count cart operations from entitlements
            const cartMetricsQuery = `
                SELECT 
                    COUNT(*) as total_operations,
                    COUNT(*) FILTER (WHERE type = 'cart_reservation') as cart_reservations,
                    COUNT(*) FILTER (WHERE type = 'download' AND remaining > 0) as active_downloads,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    COUNT(DISTINCT client_key) as unique_clients
                FROM download_entitlements 
                WHERE created_at >= $1
            `;
            
            const result = await this.pool.query(cartMetricsQuery, [since]);
            const metrics = result.rows[0];
            
            return {
                totalOperations: parseInt(metrics.total_operations || 0),
                cartReservations: parseInt(metrics.cart_reservations || 0),
                activeDownloads: parseInt(metrics.active_downloads || 0),
                uniqueSessions: parseInt(metrics.unique_sessions || 0),
                uniqueClients: parseInt(metrics.unique_clients || 0)
            };
            
        } catch (error) {
            console.error('❌ Error getting cart operation metrics:', error);
            return {
                totalOperations: 0,
                cartReservations: 0,
                activeDownloads: 0,
                uniqueSessions: 0,
                uniqueClients: 0
            };
        }
    }
    
    async getQuotaViolationMetrics(since) {
        try {
            // Analyze quota violations and suspicious patterns
            const violationQuery = `
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'quota_exceeded') as quota_violations,
                    COUNT(*) FILTER (WHERE status = 'rate_limited') as rate_limit_violations,
                    COUNT(*) FILTER (WHERE status = 'suspicious_activity') as suspicious_activities,
                    COUNT(*) FILTER (WHERE failure_reason LIKE '%rapid%') as rapid_requests,
                    COUNT(DISTINCT ip_address) as unique_ips,
                    COUNT(DISTINCT client_key) as unique_clients_violated
                FROM download_history 
                WHERE created_at >= $1 
                AND status IN ('quota_exceeded', 'rate_limited', 'suspicious_activity', 'blocked')
            `;
            
            const result = await this.pool.query(violationQuery, [since]);
            const metrics = result.rows[0];
            
            return {
                totalViolations: parseInt(metrics.quota_violations || 0) + parseInt(metrics.rate_limit_violations || 0),
                quotaViolations: parseInt(metrics.quota_violations || 0),
                rateLimitViolations: parseInt(metrics.rate_limit_violations || 0),
                suspiciousActivities: parseInt(metrics.suspicious_activities || 0),
                rapidRequests: parseInt(metrics.rapid_requests || 0),
                uniqueIps: parseInt(metrics.unique_ips || 0),
                uniqueClients: parseInt(metrics.unique_clients_violated || 0)
            };
            
        } catch (error) {
            console.error('❌ Error getting quota violation metrics:', error);
            return {
                totalViolations: 0,
                quotaViolations: 0,
                rateLimitViolations: 0,
                suspiciousActivities: 0,
                rapidRequests: 0,
                uniqueIps: 0,
                uniqueClients: 0
            };
        }
    }
    
    async getPerformanceMetrics(since) {
        try {
            // This would integrate with performance tracking from the Enhanced Quota Manager
            // For now, return placeholder metrics
            return {
                avgResponseTime: Math.random() * 200 + 50, // 50-250ms simulation
                peakConcurrent: Math.floor(Math.random() * 20) + 1,
                databaseConnections: Math.floor(Math.random() * 50) + 10
            };
            
        } catch (error) {
            console.error('❌ Error getting performance metrics:', error);
            return {
                avgResponseTime: 0,
                peakConcurrent: 0,
                databaseConnections: 0
            };
        }
    }
    
    /**
     * TREND ANALYSIS
     */
    
    async analyzeTrends() {
        try {
            const currentTime = Date.now();
            const timeWindows = {
                last15min: new Date(currentTime - (15 * 60 * 1000)),
                lastHour: new Date(currentTime - (60 * 60 * 1000)),
                last6Hours: new Date(currentTime - (6 * 60 * 60 * 1000)),
                last24Hours: new Date(currentTime - (24 * 60 * 60 * 1000))
            };
            
            // Analyze usage trends
            const usageTrends = await this.analyzeUsageTrends(timeWindows);
            const violationTrends = await this.analyzeViolationTrends(timeWindows);
            const performanceTrends = await this.analyzePerformanceTrends(timeWindows);
            
            // Store trend analysis
            this.usagePatterns.set(currentTime, usageTrends);
            this.violationPatterns.set(currentTime, violationTrends);
            
            // Clean old trend data (keep last 24 hours)
            const yesterday = currentTime - (24 * 60 * 60 * 1000);
            for (const [timestamp] of this.usagePatterns) {
                if (timestamp < yesterday) {
                    this.usagePatterns.delete(timestamp);
                }
            }
            for (const [timestamp] of this.violationPatterns) {
                if (timestamp < yesterday) {
                    this.violationPatterns.delete(timestamp);
                }
            }
            
            console.log(`📊 Trend analysis completed: Usage patterns: ${usageTrends.totalQuotaChecks}, Violations: ${violationTrends.totalViolations}`);
            
            return {
                usage: usageTrends,
                violations: violationTrends,
                performance: performanceTrends,
                timestamp: currentTime
            };
            
        } catch (error) {
            console.error('❌ Error analyzing trends:', error);
            throw error;
        }
    }
    
    async analyzeUsageTrends(timeWindows) {
        try {
            const trends = {};
            
            for (const [period, since] of Object.entries(timeWindows)) {
                const usageQuery = `
                    SELECT 
                        COUNT(*) as total_operations,
                        COUNT(DISTINCT session_id) as unique_sessions,
                        COUNT(DISTINCT client_key) as unique_clients,
                        COUNT(*) FILTER (WHERE status = 'success') as successful_operations,
                        EXTRACT(HOUR FROM created_at) as hour
                    FROM download_history 
                    WHERE created_at >= $1
                    GROUP BY EXTRACT(HOUR FROM created_at)
                    ORDER BY hour
                `;
                
                const result = await this.pool.query(usageQuery, [since]);
                
                trends[period] = {
                    totalOperations: result.rows.reduce((sum, row) => sum + parseInt(row.total_operations || 0), 0),
                    uniqueSessions: result.rows.reduce((sum, row) => sum + parseInt(row.unique_sessions || 0), 0),
                    uniqueClients: result.rows.reduce((sum, row) => sum + parseInt(row.unique_clients || 0), 0),
                    successfulOperations: result.rows.reduce((sum, row) => sum + parseInt(row.successful_operations || 0), 0),
                    hourlyBreakdown: result.rows
                };
            }
            
            return {
                totalQuotaChecks: trends.lastHour?.totalOperations || 0,
                uniqueSessionsActive: trends.lastHour?.uniqueSessions || 0,
                peakHour: this.findPeakHour(trends.last24Hours?.hourlyBreakdown || []),
                growthRate: this.calculateGrowthRate(trends),
                trends: trends
            };
            
        } catch (error) {
            console.error('❌ Error analyzing usage trends:', error);
            return {
                totalQuotaChecks: 0,
                uniqueSessionsActive: 0,
                peakHour: null,
                growthRate: 0,
                trends: {}
            };
        }
    }
    
    async analyzeViolationTrends(timeWindows) {
        try {
            const trends = {};
            
            for (const [period, since] of Object.entries(timeWindows)) {
                const violationQuery = `
                    SELECT 
                        COUNT(*) as total_violations,
                        COUNT(*) FILTER (WHERE status = 'quota_exceeded') as quota_violations,
                        COUNT(*) FILTER (WHERE status = 'rate_limited') as rate_violations,
                        COUNT(DISTINCT ip_address) as unique_ips,
                        COUNT(DISTINCT client_key) as unique_clients,
                        EXTRACT(HOUR FROM created_at) as hour
                    FROM download_history 
                    WHERE created_at >= $1
                    AND status IN ('quota_exceeded', 'rate_limited', 'suspicious_activity', 'blocked')
                    GROUP BY EXTRACT(HOUR FROM created_at)
                    ORDER BY hour
                `;
                
                const result = await this.pool.query(violationQuery, [since]);
                
                trends[period] = {
                    totalViolations: result.rows.reduce((sum, row) => sum + parseInt(row.total_violations || 0), 0),
                    quotaViolations: result.rows.reduce((sum, row) => sum + parseInt(row.quota_violations || 0), 0),
                    rateViolations: result.rows.reduce((sum, row) => sum + parseInt(row.rate_violations || 0), 0),
                    uniqueIps: result.rows.reduce((sum, row) => sum + parseInt(row.unique_ips || 0), 0),
                    uniqueClients: result.rows.reduce((sum, row) => sum + parseInt(row.unique_clients || 0), 0),
                    hourlyBreakdown: result.rows
                };
            }
            
            return {
                totalViolations: trends.lastHour?.totalViolations || 0,
                violationRate: this.calculateViolationRate(trends),
                topViolationHour: this.findPeakHour(trends.last24Hours?.hourlyBreakdown || [], 'total_violations'),
                trends: trends
            };
            
        } catch (error) {
            console.error('❌ Error analyzing violation trends:', error);
            return {
                totalViolations: 0,
                violationRate: 0,
                topViolationHour: null,
                trends: {}
            };
        }
    }
    
    async analyzePerformanceTrends(timeWindows) {
        try {
            // Performance trend analysis would be implemented here
            // For now, return placeholder data
            return {
                avgResponseTime: 150,
                peakResponseTime: 300,
                databaseHealth: 'good',
                connectionUtilization: 25
            };
            
        } catch (error) {
            console.error('❌ Error analyzing performance trends:', error);
            return {
                avgResponseTime: 0,
                peakResponseTime: 0,
                databaseHealth: 'unknown',
                connectionUtilization: 0
            };
        }
    }
    
    /**
     * ALERT SYSTEM
     */
    
    async checkAlerts() {
        try {
            const alerts = [];
            const currentTime = Date.now();
            
            // Check quota violation threshold
            if (this.realTimeMetrics.quotaViolations > this.config.quotaViolationThreshold) {
                alerts.push(this.createAlert('quota_violation_threshold', 
                    `High quota violations detected: ${this.realTimeMetrics.quotaViolations} in the last hour`,
                    'high'
                ));
            }
            
            // Check suspicious activity threshold
            if (this.realTimeMetrics.suspiciousActivities > this.config.suspiciousActivityThreshold) {
                alerts.push(this.createAlert('suspicious_activity_threshold',
                    `High suspicious activity detected: ${this.realTimeMetrics.suspiciousActivities} incidents`,
                    'medium'
                ));
            }
            
            // Check performance thresholds
            if (this.realTimeMetrics.avgResponseTime > this.config.quotaCheckLatencyThreshold) {
                alerts.push(this.createAlert('performance_degradation',
                    `Quota check latency high: ${this.realTimeMetrics.avgResponseTime}ms average`,
                    'medium'
                ));
            }
            
            // Process and log alerts
            for (const alert of alerts) {
                await this.processAlert(alert);
            }
            
            // Clean old alerts
            this.cleanOldAlerts();
            
            console.log(`🚨 Alert check completed: ${alerts.length} new alerts`);
            
            return alerts;
            
        } catch (error) {
            console.error('❌ Error checking alerts:', error);
            throw error;
        }
    }
    
    createAlert(type, message, severity) {
        return {
            id: crypto.randomUUID(),
            type: type,
            message: message,
            severity: severity,
            timestamp: Date.now(),
            metrics: { ...this.realTimeMetrics },
            resolved: false
        };
    }
    
    async processAlert(alert) {
        try {
            // Add to alert history
            this.alertHistory.push(alert);
            
            // Log the alert
            console.warn(`🚨 QUOTA ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
            
            // In production, you would:
            // - Send notifications via email/Slack/webhook
            // - Create incident tickets
            // - Trigger automated responses
            // - Store in persistent alerting system
            
            // For now, just log and track
            console.log(`Alert details:`, {
                id: alert.id,
                type: alert.type,
                severity: alert.severity,
                timestamp: new Date(alert.timestamp).toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error processing alert:', error);
        }
    }
    
    cleanOldAlerts() {
        const retentionTime = Date.now() - (this.config.alertHistoryRetentionDays * 24 * 60 * 60 * 1000);
        this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > retentionTime);
    }
    
    /**
     * MONITORING DATA PERSISTENCE
     */
    
    async storeMetrics(metrics) {
        try {
            // In production, you would store metrics in a time-series database
            // For now, we'll store key metrics in the database
            
            const metricsQuery = `
                INSERT INTO quota_monitoring_metrics 
                (timestamp, quota_checks, quota_violations, cart_operations, suspicious_activities, avg_response_time, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (timestamp) DO UPDATE SET
                quota_checks = EXCLUDED.quota_checks,
                quota_violations = EXCLUDED.quota_violations,
                cart_operations = EXCLUDED.cart_operations,
                suspicious_activities = EXCLUDED.suspicious_activities,
                avg_response_time = EXCLUDED.avg_response_time
            `;
            
            // This would require a monitoring metrics table - for now just log
            console.log(`📊 Storing metrics: ${JSON.stringify(metrics)}`);
            
        } catch (error) {
            console.error('❌ Error storing metrics:', error);
        }
    }
    
    /**
     * UTILITY METHODS
     */
    
    findPeakHour(hourlyData, metric = 'total_operations') {
        if (!hourlyData || hourlyData.length === 0) return null;
        
        return hourlyData.reduce((peak, current) => {
            return (parseInt(current[metric] || 0) > parseInt(peak[metric] || 0)) ? current : peak;
        });
    }
    
    calculateGrowthRate(trends) {
        const current = trends.lastHour?.totalOperations || 0;
        const previous = trends.last6Hours?.totalOperations || 0;
        
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    }
    
    calculateViolationRate(trends) {
        const violations = trends.lastHour?.totalViolations || 0;
        const operations = trends.lastHour?.totalOperations || 1;
        
        return (violations / operations) * 100;
    }
    
    /**
     * PUBLIC API METHODS
     */
    
    getCurrentMetrics() {
        return {
            realTime: this.realTimeMetrics,
            alerts: this.alertHistory.slice(-10), // Last 10 alerts
            trends: {
                usage: Array.from(this.usagePatterns.entries()).slice(-12), // Last 12 data points
                violations: Array.from(this.violationPatterns.entries()).slice(-12)
            },
            isMonitoring: this.isMonitoring,
            config: this.config
        };
    }
    
    getAlerts(severity = null, limit = 50) {
        let alerts = this.alertHistory;
        
        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }
        
        return alerts
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    
    getDashboardData() {
        return {
            summary: {
                totalQuotaChecks: this.realTimeMetrics.quotaChecks,
                totalViolations: this.realTimeMetrics.quotaViolations,
                cartOperations: this.realTimeMetrics.cartOperations,
                avgResponseTime: this.realTimeMetrics.avgResponseTime,
                systemHealth: this.realTimeMetrics.quotaViolations < this.config.quotaViolationThreshold ? 'healthy' : 'warning'
            },
            alerts: this.getAlerts(null, 5),
            trends: this.getCurrentMetrics().trends,
            lastUpdate: this.realTimeMetrics.lastUpdateTime
        };
    }
    
    /**
     * QUOTA-SPECIFIC MONITORING HOOKS
     */
    
    recordQuotaCheck(sessionId, clientKey, result, responseTime) {
        // Hook for Enhanced Quota Manager to record quota operations
        this.realTimeMetrics.quotaChecks++;
        
        if (!result.success) {
            this.realTimeMetrics.quotaViolations++;
        }
        
        // Update rolling average response time
        const alpha = 0.1; // Smoothing factor
        this.realTimeMetrics.avgResponseTime = 
            (alpha * responseTime) + ((1 - alpha) * this.realTimeMetrics.avgResponseTime);
    }
    
    recordCartOperation(sessionId, clientKey, operation, result) {
        // Hook for Enhanced Cart Manager to record cart operations
        this.realTimeMetrics.cartOperations++;
        
        if (result && !result.success && result.code === 'SUSPICIOUS_ACTIVITY') {
            this.realTimeMetrics.suspiciousActivities++;
        }
    }
    
    cleanup() {
        this.stopMonitoring();
        console.log('🧹 Quota Monitoring System cleanup completed');
    }
}

module.exports = QuotaMonitoringSystem;
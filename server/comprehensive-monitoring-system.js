/**
 * Comprehensive Monitoring System for Download Service
 * 
 * Provides structured error logging, performance metrics, automated alerting,
 * and error trend analysis with correlation ID tracking throughout the system.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Monitoring configuration
const MONITORING_CONFIG = {
  LOG_LEVELS: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
  },
  
  // Error severity levels
  SEVERITY_LEVELS: {
    CRITICAL: 'CRITICAL',    // System failure, immediate attention
    HIGH: 'HIGH',           // Service degradation, needs attention
    MEDIUM: 'MEDIUM',       // Warning condition, monitor
    LOW: 'LOW',            // Information, no action needed
    INFO: 'INFO'           // General information
  },

  // Alert thresholds
  ALERT_THRESHOLDS: {
    ERROR_RATE_PER_MINUTE: 10,
    RESPONSE_TIME_MS: 5000,
    MEMORY_USAGE_PERCENT: 85,
    CPU_USAGE_PERCENT: 80,
    DISK_USAGE_PERCENT: 90,
    DATABASE_CONNECTIONS_PERCENT: 90
  },

  // Retention settings
  LOG_RETENTION_DAYS: 30,
  METRICS_RETENTION_DAYS: 7,
  ALERT_RETENTION_DAYS: 14,

  // File settings
  MAX_LOG_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  LOG_FILE_PATH: '/tmp/download-service-logs',
  METRICS_FILE_PATH: '/tmp/download-service-metrics'
};

class ComprehensiveMonitoringSystem {
  constructor() {
    // Error tracking
    this.errors = new Map(); // correlationId -> error details
    this.errorPatterns = new Map(); // pattern -> count
    this.errorTrends = [];
    
    // Performance metrics
    this.performanceMetrics = {
      requestCount: 0,
      responseTime: { total: 0, count: 0, min: Infinity, max: 0 },
      errorCount: 0,
      successCount: 0
    };
    
    // Alert system
    this.alerts = [];
    this.alertHistory = [];
    this.alertCallbacks = new Map();
    
    // Monitoring intervals
    this.metricsInterval = null;
    this.cleanupInterval = null;
    this.alertCheckInterval = null;
    
    // Context tracking
    this.activeContexts = new Map();
    
    this.startMonitoring();
    console.log('✅ Comprehensive Monitoring System initialized');
  }

  /**
   * Log structured error with correlation ID and context
   */
  logError(error, context = {}) {
    const errorId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const correlationId = context.correlationId || crypto.randomUUID();
    
    // Classify error severity
    const severity = this.classifyErrorSeverity(error, context);
    
    // Create structured error entry
    const errorEntry = {
      errorId,
      correlationId,
      timestamp,
      severity,
      message: error.message || error.toString(),
      stack: error.stack,
      errorType: error.constructor.name,
      service: context.service || 'download-service',
      operation: context.operation || 'unknown',
      endpoint: context.endpoint,
      method: context.method,
      userId: context.userId,
      sessionId: context.sessionId,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      requestId: context.requestId,
      duration: context.duration,
      additionalContext: context.additional || {},
      systemMetrics: this.captureSystemMetrics(),
      debugInfo: context.debug || {}
    };

    // Store error
    this.errors.set(correlationId, errorEntry);
    
    // Update error patterns
    const pattern = this.extractErrorPattern(error);
    const currentCount = this.errorPatterns.get(pattern) || 0;
    this.errorPatterns.set(pattern, currentCount + 1);
    
    // Add to trends
    this.errorTrends.push({
      timestamp: Date.now(),
      severity,
      pattern,
      correlationId
    });

    // Update performance metrics
    this.performanceMetrics.errorCount++;
    
    // Write to log file
    this.writeToLogFile('ERROR', errorEntry);
    
    // Console output with appropriate formatting
    this.formatConsoleError(errorEntry);
    
    // Check for alerts
    this.checkErrorAlerts(errorEntry);
    
    return errorId;
  }

  /**
   * Log performance metrics for operations
   */
  logPerformanceMetrics(operation, duration, context = {}) {
    const metricsId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const correlationId = context.correlationId || crypto.randomUUID();
    
    const metricsEntry = {
      metricsId,
      correlationId,
      timestamp,
      operation,
      duration,
      service: context.service || 'download-service',
      endpoint: context.endpoint,
      method: context.method,
      statusCode: context.statusCode,
      userId: context.userId,
      sessionId: context.sessionId,
      resourceUsage: context.resourceUsage,
      systemMetrics: this.captureSystemMetrics(),
      success: context.success !== false
    };

    // Update performance metrics
    this.performanceMetrics.requestCount++;
    this.performanceMetrics.responseTime.total += duration;
    this.performanceMetrics.responseTime.count++;
    this.performanceMetrics.responseTime.min = Math.min(this.performanceMetrics.responseTime.min, duration);
    this.performanceMetrics.responseTime.max = Math.max(this.performanceMetrics.responseTime.max, duration);
    
    if (metricsEntry.success) {
      this.performanceMetrics.successCount++;
    }

    // Write to metrics file
    this.writeToMetricsFile(metricsEntry);
    
    // Check performance alerts
    this.checkPerformanceAlerts(metricsEntry);
    
    console.log(`📊 [${correlationId}] Performance: ${operation} completed in ${duration}ms`);
    
    return metricsId;
  }

  /**
   * Track operation context throughout its lifecycle
   */
  startOperationContext(operationName, context = {}) {
    const correlationId = context.correlationId || crypto.randomUUID();
    const startTime = Date.now();
    
    const operationContext = {
      correlationId,
      operationName,
      startTime,
      context,
      checkpoints: [],
      active: true
    };
    
    this.activeContexts.set(correlationId, operationContext);
    
    console.log(`🚀 [${correlationId}] Starting operation: ${operationName}`);
    
    return correlationId;
  }

  /**
   * Add checkpoint to operation context
   */
  addCheckpoint(correlationId, checkpoint, data = {}) {
    const operationContext = this.activeContexts.get(correlationId);
    if (operationContext) {
      const checkpointEntry = {
        name: checkpoint,
        timestamp: Date.now(),
        duration: Date.now() - operationContext.startTime,
        data
      };
      
      operationContext.checkpoints.push(checkpointEntry);
      
      console.log(`🎯 [${correlationId}] Checkpoint: ${checkpoint} at ${checkpointEntry.duration}ms`);
    }
  }

  /**
   * Complete operation context and log final metrics
   */
  completeOperationContext(correlationId, success = true, result = null) {
    const operationContext = this.activeContexts.get(correlationId);
    if (operationContext) {
      const duration = Date.now() - operationContext.startTime;
      
      operationContext.active = false;
      operationContext.duration = duration;
      operationContext.success = success;
      operationContext.result = result;
      
      // Log performance metrics
      this.logPerformanceMetrics(operationContext.operationName, duration, {
        correlationId,
        success,
        checkpoints: operationContext.checkpoints,
        ...operationContext.context
      });
      
      // Remove from active contexts after a delay (for correlation)
      setTimeout(() => {
        this.activeContexts.delete(correlationId);
      }, 60000); // Keep for 1 minute for correlation
      
      console.log(`✅ [${correlationId}] Completed: ${operationContext.operationName} in ${duration}ms`);
    }
  }

  /**
   * Classify error severity based on error type and context
   */
  classifyErrorSeverity(error, context) {
    const message = error.message?.toLowerCase() || '';
    
    // Critical errors
    if (message.includes('database') && message.includes('connection')) {
      return MONITORING_CONFIG.SEVERITY_LEVELS.CRITICAL;
    }
    
    if (message.includes('out of memory') || message.includes('heap')) {
      return MONITORING_CONFIG.SEVERITY_LEVELS.CRITICAL;
    }
    
    // High severity errors
    if (message.includes('payment') || message.includes('stripe')) {
      return MONITORING_CONFIG.SEVERITY_LEVELS.HIGH;
    }
    
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return MONITORING_CONFIG.SEVERITY_LEVELS.HIGH;
    }
    
    // Medium severity
    if (message.includes('timeout') || message.includes('rate limit')) {
      return MONITORING_CONFIG.SEVERITY_LEVELS.MEDIUM;
    }
    
    if (context.statusCode >= 500) {
      return MONITORING_CONFIG.SEVERITY_LEVELS.HIGH;
    } else if (context.statusCode >= 400) {
      return MONITORING_CONFIG.SEVERITY_LEVELS.MEDIUM;
    }
    
    // Default to low
    return MONITORING_CONFIG.SEVERITY_LEVELS.LOW;
  }

  /**
   * Extract error pattern for trend analysis
   */
  extractErrorPattern(error) {
    const message = error.message || error.toString();
    
    // Common error patterns
    const patterns = [
      { regex: /database.*connection/i, pattern: 'DATABASE_CONNECTION' },
      { regex: /timeout/i, pattern: 'TIMEOUT_ERROR' },
      { regex: /rate.*limit/i, pattern: 'RATE_LIMIT' },
      { regex: /payment.*failed/i, pattern: 'PAYMENT_FAILURE' },
      { regex: /unauthorized|forbidden/i, pattern: 'AUTH_ERROR' },
      { regex: /validation.*failed/i, pattern: 'VALIDATION_ERROR' },
      { regex: /file.*not.*found/i, pattern: 'FILE_NOT_FOUND' },
      { regex: /network.*error/i, pattern: 'NETWORK_ERROR' }
    ];
    
    for (const { regex, pattern } of patterns) {
      if (regex.test(message)) {
        return pattern;
      }
    }
    
    // Default pattern
    return `${error.constructor.name}_ERROR`;
  }

  /**
   * Capture current system metrics
   */
  captureSystemMetrics() {
    try {
      const memory = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        memory: {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
          rss: memory.rss
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: Date.now()
      };
    } catch (error) {
      return { error: 'Failed to capture system metrics' };
    }
  }

  /**
   * Format console error output
   */
  formatConsoleError(errorEntry) {
    const icon = this.getSeverityIcon(errorEntry.severity);
    const color = this.getSeverityColor(errorEntry.severity);
    
    console.log(`${icon} [${errorEntry.correlationId}] ${color}${errorEntry.severity}${'\x1b[0m'}: ${errorEntry.message}`);
    
    if (errorEntry.operation) {
      console.log(`   Operation: ${errorEntry.operation}`);
    }
    
    if (errorEntry.endpoint) {
      console.log(`   Endpoint: ${errorEntry.method} ${errorEntry.endpoint}`);
    }
    
    if (errorEntry.duration) {
      console.log(`   Duration: ${errorEntry.duration}ms`);
    }
    
    if (Object.keys(errorEntry.additionalContext).length > 0) {
      console.log(`   Context: ${JSON.stringify(errorEntry.additionalContext)}`);
    }
  }

  /**
   * Get severity icon for console output
   */
  getSeverityIcon(severity) {
    const icons = {
      [MONITORING_CONFIG.SEVERITY_LEVELS.CRITICAL]: '🚨',
      [MONITORING_CONFIG.SEVERITY_LEVELS.HIGH]: '❌',
      [MONITORING_CONFIG.SEVERITY_LEVELS.MEDIUM]: '⚠️',
      [MONITORING_CONFIG.SEVERITY_LEVELS.LOW]: '💡',
      [MONITORING_CONFIG.SEVERITY_LEVELS.INFO]: 'ℹ️'
    };
    return icons[severity] || '❓';
  }

  /**
   * Get severity color for console output
   */
  getSeverityColor(severity) {
    const colors = {
      [MONITORING_CONFIG.SEVERITY_LEVELS.CRITICAL]: '\x1b[31m', // Red
      [MONITORING_CONFIG.SEVERITY_LEVELS.HIGH]: '\x1b[91m',     // Bright red
      [MONITORING_CONFIG.SEVERITY_LEVELS.MEDIUM]: '\x1b[33m',   // Yellow
      [MONITORING_CONFIG.SEVERITY_LEVELS.LOW]: '\x1b[36m',      // Cyan
      [MONITORING_CONFIG.SEVERITY_LEVELS.INFO]: '\x1b[32m'      // Green
    };
    return colors[severity] || '\x1b[0m';
  }

  /**
   * Check for error-based alerts
   */
  checkErrorAlerts(errorEntry) {
    // Check error rate
    const recentErrors = this.errorTrends.filter(
      trend => Date.now() - trend.timestamp < 60000 // Last minute
    );
    
    if (recentErrors.length >= MONITORING_CONFIG.ALERT_THRESHOLDS.ERROR_RATE_PER_MINUTE) {
      this.triggerAlert('HIGH_ERROR_RATE', {
        message: `High error rate detected: ${recentErrors.length} errors in the last minute`,
        severity: MONITORING_CONFIG.SEVERITY_LEVELS.HIGH,
        data: { errorCount: recentErrors.length, threshold: MONITORING_CONFIG.ALERT_THRESHOLDS.ERROR_RATE_PER_MINUTE }
      });
    }
    
    // Check for critical errors
    if (errorEntry.severity === MONITORING_CONFIG.SEVERITY_LEVELS.CRITICAL) {
      this.triggerAlert('CRITICAL_ERROR', {
        message: `Critical error detected: ${errorEntry.message}`,
        severity: MONITORING_CONFIG.SEVERITY_LEVELS.CRITICAL,
        data: errorEntry
      });
    }
    
    // Check for error pattern spikes
    const pattern = this.extractErrorPattern({ message: errorEntry.message });
    const patternCount = this.errorPatterns.get(pattern) || 0;
    
    if (patternCount >= 5 && patternCount % 5 === 0) { // Alert every 5 occurrences
      this.triggerAlert('ERROR_PATTERN_SPIKE', {
        message: `Recurring error pattern detected: ${pattern} (${patternCount} occurrences)`,
        severity: MONITORING_CONFIG.SEVERITY_LEVELS.MEDIUM,
        data: { pattern, count: patternCount }
      });
    }
  }

  /**
   * Check for performance-based alerts
   */
  checkPerformanceAlerts(metricsEntry) {
    // Check response time
    if (metricsEntry.duration > MONITORING_CONFIG.ALERT_THRESHOLDS.RESPONSE_TIME_MS) {
      this.triggerAlert('SLOW_RESPONSE', {
        message: `Slow response detected: ${metricsEntry.operation} took ${metricsEntry.duration}ms`,
        severity: MONITORING_CONFIG.SEVERITY_LEVELS.MEDIUM,
        data: metricsEntry
      });
    }
    
    // Check memory usage
    const memoryUsage = metricsEntry.systemMetrics.memory?.heapUsed || 0;
    const memoryTotal = metricsEntry.systemMetrics.memory?.heapTotal || 1;
    const memoryPercent = (memoryUsage / memoryTotal) * 100;
    
    if (memoryPercent > MONITORING_CONFIG.ALERT_THRESHOLDS.MEMORY_USAGE_PERCENT) {
      this.triggerAlert('HIGH_MEMORY_USAGE', {
        message: `High memory usage: ${memoryPercent.toFixed(1)}%`,
        severity: MONITORING_CONFIG.SEVERITY_LEVELS.HIGH,
        data: { memoryPercent, memoryUsage, memoryTotal }
      });
    }
  }

  /**
   * Trigger an alert
   */
  triggerAlert(alertType, alertData) {
    const alertId = crypto.randomUUID();
    const alert = {
      alertId,
      alertType,
      timestamp: new Date().toISOString(),
      ...alertData
    };
    
    this.alerts.push(alert);
    this.alertHistory.push(alert);
    
    // Console output
    const icon = this.getSeverityIcon(alert.severity);
    console.log(`${icon} ALERT [${alertId}]: ${alert.message}`);
    
    // Call registered alert callbacks
    const callback = this.alertCallbacks.get(alertType);
    if (callback) {
      try {
        callback(alert);
      } catch (error) {
        console.error('❌ Alert callback error:', error);
      }
    }
    
    // Write alert to file
    this.writeAlertToFile(alert);
  }

  /**
   * Register alert callback
   */
  registerAlertCallback(alertType, callback) {
    this.alertCallbacks.set(alertType, callback);
  }

  /**
   * Write structured log entry to file
   */
  async writeToLogFile(level, entry) {
    try {
      await this.ensureLogDirectory();
      
      const logFileName = `error_${new Date().toISOString().split('T')[0]}.jsonl`;
      const logPath = path.join(MONITORING_CONFIG.LOG_FILE_PATH, logFileName);
      
      const logLine = JSON.stringify({ level, ...entry }) + '\n';
      await fs.appendFile(logPath, logLine);
      
    } catch (error) {
      console.error('❌ Failed to write to log file:', error);
    }
  }

  /**
   * Write metrics entry to file
   */
  async writeToMetricsFile(entry) {
    try {
      await this.ensureMetricsDirectory();
      
      const metricsFileName = `metrics_${new Date().toISOString().split('T')[0]}.jsonl`;
      const metricsPath = path.join(MONITORING_CONFIG.METRICS_FILE_PATH, metricsFileName);
      
      const metricsLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(metricsPath, metricsLine);
      
    } catch (error) {
      console.error('❌ Failed to write to metrics file:', error);
    }
  }

  /**
   * Write alert to file
   */
  async writeAlertToFile(alert) {
    try {
      await this.ensureLogDirectory();
      
      const alertFileName = `alerts_${new Date().toISOString().split('T')[0]}.jsonl`;
      const alertPath = path.join(MONITORING_CONFIG.LOG_FILE_PATH, alertFileName);
      
      const alertLine = JSON.stringify(alert) + '\n';
      await fs.appendFile(alertPath, alertLine);
      
    } catch (error) {
      console.error('❌ Failed to write alert to file:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(MONITORING_CONFIG.LOG_FILE_PATH, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Ensure metrics directory exists
   */
  async ensureMetricsDirectory() {
    try {
      await fs.mkdir(MONITORING_CONFIG.METRICS_FILE_PATH, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Start monitoring intervals
   */
  startMonitoring() {
    // Metrics collection interval
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute
    
    // Cleanup old data
    this.cleanupInterval = setInterval(() => {
      this.performDataCleanup();
    }, 3600000); // Every hour
    
    // Alert checking
    this.alertCheckInterval = setInterval(() => {
      this.performAlertChecks();
    }, 30000); // Every 30 seconds
    
    console.log('📊 Monitoring intervals started');
  }

  /**
   * Collect periodic system metrics
   */
  collectSystemMetrics() {
    const metrics = this.captureSystemMetrics();
    
    this.logPerformanceMetrics('SYSTEM_METRICS', 0, {
      correlationId: crypto.randomUUID(),
      systemMetrics: metrics,
      performanceMetrics: this.performanceMetrics
    });
    
    // Reset counters
    if (this.performanceMetrics.responseTime.count > 1000) {
      this.performanceMetrics.responseTime = { total: 0, count: 0, min: Infinity, max: 0 };
    }
  }

  /**
   * Perform data cleanup
   */
  performDataCleanup() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean up error trends
    this.errorTrends = this.errorTrends.filter(trend => trend.timestamp > cutoffTime);
    
    // Clean up old errors (keep recent ones for correlation)
    const oldErrors = [];
    for (const [correlationId, error] of this.errors.entries()) {
      if (new Date(error.timestamp).getTime() < cutoffTime) {
        oldErrors.push(correlationId);
      }
    }
    oldErrors.forEach(id => this.errors.delete(id));
    
    // Clean up alerts
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > cutoffTime
    );
    
    console.log(`🧹 Cleaned up ${oldErrors.length} old error records and ${this.errorTrends.length} trend entries`);
  }

  /**
   * Perform periodic alert checks
   */
  performAlertChecks() {
    // Check system health
    const metrics = this.captureSystemMetrics();
    
    // Memory check
    if (metrics.memory) {
      const memoryPercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
      if (memoryPercent > MONITORING_CONFIG.ALERT_THRESHOLDS.MEMORY_USAGE_PERCENT) {
        this.triggerAlert('HIGH_MEMORY_USAGE', {
          message: `System memory usage high: ${memoryPercent.toFixed(1)}%`,
          severity: MONITORING_CONFIG.SEVERITY_LEVELS.HIGH,
          data: { memoryPercent, memory: metrics.memory }
        });
      }
    }
  }

  /**
   * Get comprehensive monitoring statistics
   */
  getStatistics() {
    const avgResponseTime = this.performanceMetrics.responseTime.count > 0 ?
      this.performanceMetrics.responseTime.total / this.performanceMetrics.responseTime.count : 0;
    
    return {
      errors: {
        total: this.performanceMetrics.errorCount,
        unique: this.errors.size,
        patterns: Object.fromEntries(this.errorPatterns),
        recentTrends: this.errorTrends.slice(-10)
      },
      performance: {
        ...this.performanceMetrics,
        averageResponseTime: Math.round(avgResponseTime)
      },
      alerts: {
        active: this.alerts.length,
        total: this.alertHistory.length,
        recent: this.alerts.slice(-5)
      },
      system: this.captureSystemMetrics(),
      activeContexts: this.activeContexts.size
    };
  }

  /**
   * Get error analysis and trends
   */
  getErrorAnalysis(timeRange = 3600000) { // Default 1 hour
    const cutoffTime = Date.now() - timeRange;
    const recentTrends = this.errorTrends.filter(trend => trend.timestamp > cutoffTime);
    
    // Group by pattern
    const patternAnalysis = {};
    recentTrends.forEach(trend => {
      if (!patternAnalysis[trend.pattern]) {
        patternAnalysis[trend.pattern] = { count: 0, severity: [], timestamps: [] };
      }
      patternAnalysis[trend.pattern].count++;
      patternAnalysis[trend.pattern].severity.push(trend.severity);
      patternAnalysis[trend.pattern].timestamps.push(trend.timestamp);
    });
    
    return {
      totalErrors: recentTrends.length,
      timeRange,
      patterns: patternAnalysis,
      errorRate: recentTrends.length / (timeRange / 60000), // errors per minute
      topPatterns: Object.entries(patternAnalysis)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 5)
    };
  }

  /**
   * Shutdown monitoring system
   */
  shutdown() {
    console.log('🔄 Shutting down Comprehensive Monitoring System...');
    
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.alertCheckInterval) clearInterval(this.alertCheckInterval);
    
    // Final cleanup
    this.performDataCleanup();
    
    console.log('✅ Comprehensive Monitoring System shutdown complete');
  }
}

// Export singleton instance
const monitoringSystem = new ComprehensiveMonitoringSystem();

module.exports = {
  ComprehensiveMonitoringSystem,
  monitoringSystem,
  MONITORING_CONFIG
};
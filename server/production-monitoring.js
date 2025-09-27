/**
 * Production Monitoring and Alerting System for Payment Processing
 * 
 * Provides comprehensive monitoring, metrics collection, and alerting
 * for the enhanced webhook and payment processing system.
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, gte, lte, sql, desc, count } = require('drizzle-orm');
const { 
  webhookEvents,
  downloadOrders,
  downloadEntitlements,
  photographySessions,
  users 
} = require('../shared/schema');

class ProductionMonitoringSystem {
  constructor(pool = null) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.db = drizzle(this.pool);
    
    // Monitoring configuration
    this.config = {
      metrics: {
        webhookProcessingThresholds: {
          slow: 5000, // 5 seconds
          critical: 30000 // 30 seconds
        },
        failureRateThresholds: {
          warning: 0.05, // 5%
          critical: 0.15 // 15%
        },
        retryQueueThresholds: {
          warning: 20,
          critical: 50
        }
      },
      alerting: {
        channels: {
          email: process.env.ALERT_EMAIL || 'admin@example.com',
          slack: process.env.SLACK_WEBHOOK_URL,
          sms: process.env.TWILIO_ALERT_NUMBER
        },
        cooldown: 300000, // 5 minutes between same alert types
        escalation: {
          immediate: ['payment_system_down', 'webhook_verification_failed'],
          high: ['high_failure_rate', 'payment_processing_errors'],
          medium: ['slow_processing', 'retry_queue_full'],
          low: ['integration_warnings', 'performance_degradation']
        }
      }
    };
    
    // Alert cooldown tracking
    this.alertCooldowns = new Map();
    
    console.log('✅ Production Monitoring System initialized');
  }

  /**
   * WEBHOOK PROCESSING METRICS
   */
  
  async getWebhookMetrics(timeRangeHours = 24) {
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      
      // Overall webhook stats
      const overallStats = await this.db.select({
        totalEvents: count(),
        avgProcessingTime: sql`AVG(processing_duration_ms)`.as('avgProcessingTime'),
        maxProcessingTime: sql`MAX(processing_duration_ms)`.as('maxProcessingTime'),
        successRate: sql`
          ROUND(
            (COUNT(*) FILTER (WHERE status = 'completed'))::numeric / 
            NULLIF(COUNT(*), 0) * 100, 2
          )
        `.as('successRate')
      })
      .from(webhookEvents)
      .where(gte(webhookEvents.createdAt, since));
      
      // Stats by event type
      const eventTypeStats = await this.db.select({
        eventType: webhookEvents.eventType,
        count: count(),
        avgProcessingTime: sql`AVG(processing_duration_ms)`.as('avgProcessingTime'),
        successCount: sql`COUNT(*) FILTER (WHERE status = 'completed')`.as('successCount'),
        failureCount: sql`COUNT(*) FILTER (WHERE status = 'failed')`.as('failureCount'),
        retryingCount: sql`COUNT(*) FILTER (WHERE status = 'retrying')`.as('retryingCount')
      })
      .from(webhookEvents)
      .where(gte(webhookEvents.createdAt, since))
      .groupBy(webhookEvents.eventType);
      
      // Recent failures for analysis
      const recentFailures = await this.db.select({
        id: webhookEvents.id,
        eventType: webhookEvents.eventType,
        errorMessage: webhookEvents.errorMessage,
        processingAttempts: webhookEvents.processingAttempts,
        createdAt: webhookEvents.createdAt
      })
      .from(webhookEvents)
      .where(and(
        gte(webhookEvents.createdAt, since),
        eq(webhookEvents.status, 'failed')
      ))
      .orderBy(desc(webhookEvents.createdAt))
      .limit(10);
      
      return {
        timeRange: `${timeRangeHours} hours`,
        overall: overallStats[0] || {},
        byEventType: eventTypeStats,
        recentFailures,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error getting webhook metrics:', error);
      throw error;
    }
  }

  /**
   * PAYMENT PROCESSING METRICS
   */
  
  async getPaymentMetrics(timeRangeHours = 24) {
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      
      // Payment processing stats
      const paymentStats = await this.db.select({
        totalOrders: count(),
        completedOrders: sql`COUNT(*) FILTER (WHERE status = 'completed')`.as('completedOrders'),
        failedOrders: sql`COUNT(*) FILTER (WHERE status = 'failed')`.as('failedOrders'),
        pendingOrders: sql`COUNT(*) FILTER (WHERE status = 'pending')`.as('pendingOrders'),
        totalRevenue: sql`SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END)`.as('totalRevenue'),
        avgOrderValue: sql`AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END)`.as('avgOrderValue')
      })
      .from(downloadOrders)
      .where(gte(downloadOrders.createdAt, since));
      
      // Revenue by pricing mode
      const revenueByMode = await this.db.select({
        mode: downloadOrders.mode,
        orderCount: count(),
        totalRevenue: sql`SUM(amount)`.as('totalRevenue'),
        avgOrderValue: sql`AVG(amount)`.as('avgOrderValue')
      })
      .from(downloadOrders)
      .where(and(
        gte(downloadOrders.createdAt, since),
        eq(downloadOrders.status, 'completed')
      ))
      .groupBy(downloadOrders.mode);
      
      // Recent failed payments for analysis
      const recentFailures = await this.db.select({
        id: downloadOrders.id,
        amount: downloadOrders.amount,
        mode: downloadOrders.mode,
        failureReason: downloadOrders.failureReason,
        failureMessage: downloadOrders.failureMessage,
        createdAt: downloadOrders.createdAt
      })
      .from(downloadOrders)
      .where(and(
        gte(downloadOrders.createdAt, since),
        eq(downloadOrders.status, 'failed')
      ))
      .orderBy(desc(downloadOrders.createdAt))
      .limit(10);
      
      return {
        timeRange: `${timeRangeHours} hours`,
        overall: paymentStats[0] || {},
        byMode: revenueByMode,
        recentFailures,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error getting payment metrics:', error);
      throw error;
    }
  }

  /**
   * SYSTEM HEALTH CHECKS
   */
  
  async performHealthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    try {
      // Database connectivity
      await this.checkDatabaseHealth(health);
      
      // Webhook processing health
      await this.checkWebhookHealth(health);
      
      // Payment processing health
      await this.checkPaymentHealth(health);
      
      // Retry queue health
      await this.checkRetryQueueHealth(health);
      
      // Integration health
      await this.checkIntegrationHealth(health);
      
      // Overall health determination
      const failedChecks = Object.values(health.checks).filter(check => !check.healthy);
      if (failedChecks.length > 0) {
        health.status = failedChecks.some(check => check.critical) ? 'critical' : 'warning';
      }
      
    } catch (error) {
      health.status = 'critical';
      health.error = error.message;
    }
    
    return health;
  }

  async checkDatabaseHealth(health) {
    try {
      const start = Date.now();
      await this.db.select({ test: sql`1` });
      const responseTime = Date.now() - start;
      
      health.checks.database = {
        healthy: responseTime < 1000,
        responseTime,
        critical: responseTime > 5000,
        message: responseTime > 1000 ? 'Database response time is slow' : 'Database is responsive'
      };
    } catch (error) {
      health.checks.database = {
        healthy: false,
        critical: true,
        error: error.message,
        message: 'Database connection failed'
      };
    }
  }

  async checkWebhookHealth(health) {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const stats = await this.db.select({
        total: count(),
        failed: sql`COUNT(*) FILTER (WHERE status = 'failed')`.as('failed'),
        retrying: sql`COUNT(*) FILTER (WHERE status = 'retrying')`.as('retrying')
      })
      .from(webhookEvents)
      .where(gte(webhookEvents.createdAt, last24h));
      
      const totalEvents = stats[0]?.total || 0;
      const failedEvents = stats[0]?.failed || 0;
      const retryingEvents = stats[0]?.retrying || 0;
      
      const failureRate = totalEvents > 0 ? failedEvents / totalEvents : 0;
      
      health.checks.webhookProcessing = {
        healthy: failureRate < this.config.metrics.failureRateThresholds.warning,
        critical: failureRate > this.config.metrics.failureRateThresholds.critical,
        failureRate: Math.round(failureRate * 100) / 100,
        totalEvents,
        failedEvents,
        retryingEvents,
        message: failureRate > this.config.metrics.failureRateThresholds.critical 
          ? 'High webhook failure rate detected' 
          : 'Webhook processing is healthy'
      };
    } catch (error) {
      health.checks.webhookProcessing = {
        healthy: false,
        critical: true,
        error: error.message,
        message: 'Cannot assess webhook health'
      };
    }
  }

  async checkPaymentHealth(health) {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const stats = await this.db.select({
        total: count(),
        completed: sql`COUNT(*) FILTER (WHERE status = 'completed')`.as('completed'),
        failed: sql`COUNT(*) FILTER (WHERE status = 'failed')`.as('failed')
      })
      .from(downloadOrders)
      .where(gte(downloadOrders.createdAt, last24h));
      
      const totalOrders = stats[0]?.total || 0;
      const failedOrders = stats[0]?.failed || 0;
      
      const failureRate = totalOrders > 0 ? failedOrders / totalOrders : 0;
      
      health.checks.paymentProcessing = {
        healthy: failureRate < this.config.metrics.failureRateThresholds.warning,
        critical: failureRate > this.config.metrics.failureRateThresholds.critical,
        failureRate: Math.round(failureRate * 100) / 100,
        totalOrders,
        failedOrders,
        message: failureRate > this.config.metrics.failureRateThresholds.critical 
          ? 'High payment failure rate detected' 
          : 'Payment processing is healthy'
      };
    } catch (error) {
      health.checks.paymentProcessing = {
        healthy: false,
        critical: true,
        error: error.message,
        message: 'Cannot assess payment health'
      };
    }
  }

  async checkRetryQueueHealth(health) {
    try {
      const retryingEvents = await this.db.select({
        count: count()
      })
      .from(webhookEvents)
      .where(eq(webhookEvents.status, 'retrying'));
      
      const queueSize = retryingEvents[0]?.count || 0;
      
      health.checks.retryQueue = {
        healthy: queueSize < this.config.metrics.retryQueueThresholds.warning,
        critical: queueSize > this.config.metrics.retryQueueThresholds.critical,
        queueSize,
        message: queueSize > this.config.metrics.retryQueueThresholds.critical 
          ? 'Retry queue is overloaded' 
          : 'Retry queue is healthy'
      };
    } catch (error) {
      health.checks.retryQueue = {
        healthy: false,
        critical: true,
        error: error.message,
        message: 'Cannot assess retry queue health'
      };
    }
  }

  async checkIntegrationHealth(health) {
    try {
      // Check Stripe API connectivity
      let stripeHealthy = true;
      let stripeError = null;
      
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.balance.retrieve(); // Simple API call to test connectivity
      } catch (error) {
        stripeHealthy = false;
        stripeError = error.message;
      }
      
      health.checks.integrations = {
        healthy: stripeHealthy,
        critical: !stripeHealthy,
        stripe: {
          healthy: stripeHealthy,
          error: stripeError
        },
        message: stripeHealthy ? 'All integrations are healthy' : 'Integration issues detected'
      };
    } catch (error) {
      health.checks.integrations = {
        healthy: false,
        critical: true,
        error: error.message,
        message: 'Cannot assess integration health'
      };
    }
  }

  /**
   * ALERTING SYSTEM
   */
  
  async sendAlert(type, severity, message, details = {}) {
    try {
      // Check cooldown to prevent spam
      const cooldownKey = `${type}_${severity}`;
      const lastAlert = this.alertCooldowns.get(cooldownKey);
      
      if (lastAlert && Date.now() - lastAlert < this.config.alerting.cooldown) {
        console.log(`🔇 Alert suppressed due to cooldown: ${type}`);
        return;
      }
      
      this.alertCooldowns.set(cooldownKey, Date.now());
      
      const alert = {
        type,
        severity,
        message,
        details,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };
      
      console.error(`🚨 [${severity.toUpperCase()}] ${type}: ${message}`);
      
      // Send to configured channels based on severity
      if (this.config.alerting.escalation.immediate.includes(type)) {
        await this.sendImmediateAlert(alert);
      } else if (this.config.alerting.escalation.high.includes(type)) {
        await this.sendHighPriorityAlert(alert);
      } else {
        await this.sendStandardAlert(alert);
      }
      
    } catch (error) {
      console.error('❌ Error sending alert:', error);
    }
  }

  async sendImmediateAlert(alert) {
    // Send to all available channels for immediate alerts
    await Promise.allSettled([
      this.sendEmailAlert(alert),
      this.sendSlackAlert(alert),
      this.sendSMSAlert(alert)
    ]);
  }

  async sendHighPriorityAlert(alert) {
    // Send to email and Slack for high priority alerts
    await Promise.allSettled([
      this.sendEmailAlert(alert),
      this.sendSlackAlert(alert)
    ]);
  }

  async sendStandardAlert(alert) {
    // Send to Slack for standard alerts
    await this.sendSlackAlert(alert);
  }

  async sendEmailAlert(alert) {
    // TODO: Implement email alerting using SendGrid
    console.log(`📧 Email alert: ${alert.type} - ${alert.message}`);
  }

  async sendSlackAlert(alert) {
    // TODO: Implement Slack alerting
    console.log(`💬 Slack alert: ${alert.type} - ${alert.message}`);
  }

  async sendSMSAlert(alert) {
    // TODO: Implement SMS alerting using Twilio
    console.log(`📱 SMS alert: ${alert.type} - ${alert.message}`);
  }

  /**
   * MONITORING DAEMON METHODS
   */
  
  async startMonitoring() {
    console.log('🔍 Starting production monitoring...');
    
    // Health check every 5 minutes
    setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        
        if (health.status !== 'healthy') {
          console.warn(`⚠️ System health: ${health.status}`);
          
          // Send alerts for failed checks
          for (const [checkName, check] of Object.entries(health.checks)) {
            if (!check.healthy) {
              await this.sendAlert(
                `health_check_${checkName}`,
                check.critical ? 'critical' : 'warning',
                check.message,
                { check: checkName, details: check }
              );
            }
          }
        }
      } catch (error) {
        console.error('❌ Health check failed:', error);
        await this.sendAlert(
          'monitoring_system_error',
          'critical',
          'Health check system failure',
          { error: error.message }
        );
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    // Metrics collection every hour
    setInterval(async () => {
      try {
        const webhookMetrics = await this.getWebhookMetrics(1);
        const paymentMetrics = await this.getPaymentMetrics(1);
        
        console.log('📊 Hourly metrics collected:', {
          webhooks: webhookMetrics.overall,
          payments: paymentMetrics.overall
        });
        
        // Check for concerning trends
        this.analyzeMetricsForAlerts(webhookMetrics, paymentMetrics);
        
      } catch (error) {
        console.error('❌ Metrics collection failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  analyzeMetricsForAlerts(webhookMetrics, paymentMetrics) {
    // Analyze webhook failure rate
    const webhookSuccessRate = webhookMetrics.overall.successRate || 0;
    if (webhookSuccessRate < 90) {
      this.sendAlert(
        'high_webhook_failure_rate',
        'high',
        `Webhook success rate dropped to ${webhookSuccessRate}%`,
        { metrics: webhookMetrics.overall }
      );
    }
    
    // Analyze payment processing
    const paymentFailureRate = paymentMetrics.overall.failedOrders / 
      (paymentMetrics.overall.totalOrders || 1) * 100;
    
    if (paymentFailureRate > 10) {
      this.sendAlert(
        'high_payment_failure_rate',
        'high',
        `Payment failure rate: ${paymentFailureRate.toFixed(1)}%`,
        { metrics: paymentMetrics.overall }
      );
    }
  }

  /**
   * API ENDPOINTS FOR MONITORING DASHBOARD
   */
  
  getMonitoringRoutes() {
    const router = require('express').Router();
    
    // Health check endpoint
    router.get('/health', async (req, res) => {
      try {
        const health = await this.performHealthCheck();
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Webhook metrics endpoint
    router.get('/metrics/webhooks', async (req, res) => {
      try {
        const hours = parseInt(req.query.hours) || 24;
        const metrics = await this.getWebhookMetrics(hours);
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Payment metrics endpoint
    router.get('/metrics/payments', async (req, res) => {
      try {
        const hours = parseInt(req.query.hours) || 24;
        const metrics = await this.getPaymentMetrics(hours);
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    return router;
  }
}

module.exports = ProductionMonitoringSystem;
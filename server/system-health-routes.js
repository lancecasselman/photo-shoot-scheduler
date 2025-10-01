
/**
 * System Health and Error Analysis API Routes
 */

const express = require('express');
const router = express.Router();
const errorDetectionSystem = require('./error-detection-system');
const { monitoringSystem } = require('./comprehensive-monitoring-system');

// Get system health status
router.get('/health', async (req, res) => {
  try {
    const healthReport = await errorDetectionSystem.generateHealthReport();
    res.json(healthReport);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate health report',
      message: error.message
    });
  }
});

// Run manual error analysis
router.post('/analyze-errors', async (req, res) => {
  try {
    const analysis = await errorDetectionSystem.runManualAnalysis();
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error analysis failed',
      message: error.message
    });
  }
});

// Get monitoring statistics
router.get('/monitoring-stats', async (req, res) => {
  try {
    const stats = monitoringSystem.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get monitoring statistics',
      message: error.message
    });
  }
});

// Get error trends
router.get('/error-trends', async (req, res) => {
  try {
    const timeRange = parseInt(req.query.hours) * 60 * 60 * 1000 || 3600000; // Default 1 hour
    const trends = monitoringSystem.getErrorAnalysis(timeRange);
    res.json(trends);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get error trends',
      message: error.message
    });
  }
});

module.exports = router;

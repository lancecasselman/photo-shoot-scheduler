/**
 * API Routes for Installment Plans
 * Handles preview, create, get, and cancel operations
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { calculatePaymentSchedule } = require('./math');
const { createPaymentPlanSchedule, cancelSubscriptionSchedule } = require('./stripe');
const { 
  createPlan, 
  getPlan, 
  getPaymentsByPlan,
  updatePlan,
  cancelPlan: daoCancelPlan,
  getPlansBySession,
  getPlansByPhotographer
} = require('./dao');

const router = express.Router();
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '0');

/**
 * POST /api/installments/preview
 * Preview payment schedule before creating
 */
router.post('/preview', async (req, res) => {
  try {
    const { totalAmount, cadence, startDate, numberOfPayments } = req.body;

    if (!totalAmount || !cadence || !startDate || !numberOfPayments) {
      return res.status(400).json({
        error: 'Missing required fields: totalAmount, cadence, startDate, numberOfPayments'
      });
    }

    if (cadence !== 'biweekly' && cadence !== 'monthly') {
      return res.status(400).json({
        error: 'Cadence must be either "biweekly" or "monthly"'
      });
    }

    const preview = calculatePaymentSchedule(
      totalAmount,
      cadence,
      startDate,
      numberOfPayments,
      PLATFORM_FEE_BPS
    );

    res.json(preview);
  } catch (error) {
    console.error('❌ INSTALLMENT: Preview error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to preview installment plan'
    });
  }
});

/**
 * POST /api/installments/create
 * Create a new installment plan
 */
router.post('/create', async (req, res) => {
  try {
    const request = req.body;

    const required = [
      'sessionId',
      'photographerId',
      'stripeConnectedAccountId',
      'customerEmail',
      'customerName',
      'totalAmount',
      'cadence',
      'startDate',
      'numberOfPayments'
    ];

    for (const field of required) {
      if (!request[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    const preview = calculatePaymentSchedule(
      request.totalAmount,
      request.cadence,
      request.startDate,
      request.numberOfPayments,
      PLATFORM_FEE_BPS
    );

    const planId = uuidv4();
    const now = new Date().toISOString();

    const plan = {
      id: planId,
      sessionId: request.sessionId,
      photographerId: request.photographerId,
      customerEmail: request.customerEmail,
      totalAmount: preview.totalAmount,
      perInstallmentAmount: preview.perInstallmentAmount,
      platformFeeBps: PLATFORM_FEE_BPS,
      platformFeePerPayment: preview.platformFeePerPayment,
      cadence: request.cadence,
      startDate: preview.startDate,
      endDate: preview.endDate,
      numberOfPayments: preview.numberOfPayments,
      stripeConnectedAccountId: request.stripeConnectedAccountId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    await createPlan(plan);

    const { customerId, scheduleId, paymentRecordIds } = await createPaymentPlanSchedule(request, preview, planId);

    await updatePlan(planId, {
      stripeCustomerId: customerId,
      stripeSubscriptionScheduleId: scheduleId
    });

    // Update session to mark it has a payment plan
    const { db, photographySessions } = require('../../../shared/schema');
    const { eq } = require('drizzle-orm');
    
    try {
      await db.update(photographySessions)
        .set({
          has_payment_plan: true,
          payment_plan_id: planId,
          updated_at: new Date()
        })
        .where(eq(photographySessions.id, request.sessionId));
      
      console.log(`✅ INSTALLMENT: Updated session ${request.sessionId} with payment plan flag`);
    } catch (dbError) {
      console.error('⚠️  INSTALLMENT: Failed to update session payment plan flag:', dbError);
      // Don't fail the whole operation if session update fails
    }

    console.log(`✅ INSTALLMENT: Created plan ${planId} with ${preview.numberOfPayments} payments (schedule ${scheduleId})`);

    res.json({
      success: true,
      planId,
      customerId,
      scheduleId,
      paymentCount: preview.numberOfPayments,
      preview
    });
  } catch (error) {
    console.error('❌ INSTALLMENT: Create error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create installment plan'
    });
  }
});

/**
 * GET /api/installments/:planId
 * Get plan details with payment statuses
 */
router.get('/:planId', async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const payments = await getPaymentsByPlan(planId);

    res.json({
      plan,
      payments
    });
  } catch (error) {
    console.error('❌ INSTALLMENT: Get plan error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get plan'
    });
  }
});

/**
 * GET /api/installments/session/:sessionId
 * Get plans by session ID
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const plans = await getPlansBySession(sessionId);

    res.json({ plans });
  } catch (error) {
    console.error('❌ INSTALLMENT: Get session plans error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get session plans'
    });
  }
});

/**
 * GET /api/installments/photographer/:photographerId
 * Get plans by photographer ID
 */
router.get('/photographer/:photographerId', async (req, res) => {
  try {
    const { photographerId } = req.params;
    const plans = await getPlansByPhotographer(photographerId);

    res.json({ plans });
  } catch (error) {
    console.error('❌ INSTALLMENT: Get photographer plans error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get photographer plans'
    });
  }
});

/**
 * POST /api/installments/:planId/cancel
 * Cancel an installment plan
 */
router.post('/:planId/cancel', async (req, res) => {
  try {
    const { planId } = req.params;
    const { reason } = req.body;

    const plan = await getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.status === 'canceled') {
      return res.status(400).json({ error: 'Plan is already canceled' });
    }

    if (plan.stripeSubscriptionScheduleId) {
      await cancelSubscriptionSchedule(plan.stripeSubscriptionScheduleId, plan.stripeConnectedAccountId);
      console.log(`✅ INSTALLMENT: Canceled subscription schedule ${plan.stripeSubscriptionScheduleId} for plan ${planId}`);
    }

    await daoCancelPlan(planId, reason || 'Canceled by user');

    console.log(`✅ INSTALLMENT: Canceled plan ${planId}`);

    res.json({
      success: true,
      message: 'Plan canceled successfully'
    });
  } catch (error) {
    console.error('❌ INSTALLMENT: Cancel error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to cancel plan'
    });
  }
});

module.exports = router;

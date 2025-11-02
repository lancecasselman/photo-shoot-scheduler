/**
 * API Routes for Installment Plans
 * Handles preview, create, get, and cancel operations
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { eq } = require('drizzle-orm');
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
const { db, photographySessions, users } = require('../../../shared/schema');

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

    // Fetch photographer ID and Stripe account from session
    const [session] = await db
      .select({
        userId: photographySessions.user_id,
        stripeConnectAccountId: users.stripe_connect_account_id
      })
      .from(photographySessions)
      .leftJoin(users, eq(photographySessions.user_id, users.uid))
      .where(eq(photographySessions.id, request.sessionId))
      .limit(1);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!session.stripeConnectAccountId) {
      return res.status(400).json({ error: 'Photographer has not connected their Stripe account' });
    }
    
    request.photographerId = session.userId;
    request.stripeConnectedAccountId = session.stripeConnectAccountId;

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
      customerName: request.customerName,
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
      plan: {
        id: planId,
        sessionId: request.sessionId,
        customerId,
        scheduleId,
        numberOfPayments: preview.numberOfPayments
      },
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

/**
 * GET /api/installments/plan/:planId
 * Get plan details for client payment setup (no auth required)
 */
router.get('/plan/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    
    const plan = await getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Payment plan not found or expired' });
    }
    
    // Return plan details without sensitive information
    res.json({
      id: plan.id,
      sessionId: plan.sessionId,
      customerEmail: plan.customerEmail,
      customerName: plan.customerName || 'Valued Client',
      totalAmount: plan.totalAmount,
      perInstallmentAmount: plan.perInstallmentAmount,
      cadence: plan.cadence,
      startDate: plan.startDate,
      endDate: plan.endDate,
      numberOfPayments: plan.numberOfPayments,
      status: plan.status
    });
  } catch (error) {
    console.error('❌ INSTALLMENT: Get plan error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get plan details'
    });
  }
});

/**
 * POST /api/installments/plan/:planId/attach-payment
 * Attach payment method to existing plan and activate billing (no auth required)
 */
router.post('/plan/:planId/attach-payment', async (req, res) => {
  try {
    const { planId } = req.params;
    const { paymentMethodId } = req.body;
    
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }
    
    const plan = await getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }
    
    if (plan.status === 'canceled') {
      return res.status(400).json({ error: 'This payment plan has been canceled' });
    }
    
    if (plan.stripeSubscriptionScheduleId) {
      return res.status(400).json({ error: 'Payment method already attached to this plan' });
    }
    
    // Recreate the preview to get payment schedule
    const preview = calculatePaymentSchedule(
      plan.totalAmount,
      plan.cadence,
      plan.startDate,
      plan.numberOfPayments,
      PLATFORM_FEE_BPS
    );
    
    // Create the subscription schedule with payment method
    const request = {
      customerEmail: plan.customerEmail,
      customerName: plan.customerName,
      stripeConnectedAccountId: plan.stripeConnectedAccountId,
      sessionId: plan.sessionId,
      photographerId: plan.photographerId,
      paymentMethodId,
      cadence: plan.cadence
    };
    
    const { customerId, scheduleId } = await createPaymentPlanSchedule(request, preview, planId);
    
    // Update plan with Stripe IDs
    await updatePlan(planId, {
      stripeCustomerId: customerId,
      stripeSubscriptionScheduleId: scheduleId,
      status: 'active'
    });
    
    console.log(`✅ INSTALLMENT: Payment method attached to plan ${planId}, schedule ${scheduleId} created`);
    
    res.json({
      success: true,
      message: 'Automated billing activated successfully',
      plan: {
        id: planId,
        scheduleId
      }
    });
  } catch (error) {
    console.error('❌ INSTALLMENT: Attach payment error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to attach payment method'
    });
  }
});

module.exports = router;

/**
 * API Routes for Installment Plans
 * Handles preview, create, get, and cancel operations
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { calculatePaymentSchedule } from './math';
import { createSubscriptionSchedule, cancelSubscriptionSchedule } from './stripe';
import { 
  createPlan, 
  createPayment, 
  getPlan, 
  getPaymentsByPlan,
  cancelPlan as daoCancelPlan,
  getPlansBySession,
  getPlansByPhotographer
} from './dao';
import { 
  CreateInstallmentPlanRequest, 
  InstallmentPlan, 
  InstallmentPayment 
} from './schema';

const router = express.Router();
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '500');

/**
 * POST /api/installments/preview
 * Preview payment schedule before creating
 */
router.post('/preview', async (req, res) => {
  try {
    const { totalAmount, cadence, startDate, numberOfPayments } = req.body;

    // Validate inputs
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

    // Calculate preview
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
    const request: CreateInstallmentPlanRequest = req.body;

    // Validate required fields
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
      if (!request[field as keyof CreateInstallmentPlanRequest]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Calculate payment schedule
    const preview = calculatePaymentSchedule(
      request.totalAmount,
      request.cadence,
      request.startDate,
      request.numberOfPayments,
      PLATFORM_FEE_BPS
    );

    // Create Stripe subscription schedule
    const { scheduleId, customerId } = await createSubscriptionSchedule(request, preview);

    // Create plan record
    const planId = uuidv4();
    const now = new Date().toISOString();

    const plan: InstallmentPlan = {
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
      stripeCustomerId: customerId,
      stripeSubscriptionScheduleId: scheduleId,
      stripeConnectedAccountId: request.stripeConnectedAccountId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    await createPlan(plan);

    // Create payment records
    for (const payment of preview.paymentSchedule) {
      const paymentRecord: InstallmentPayment = {
        id: uuidv4(),
        planId,
        paymentNumber: payment.paymentNumber,
        amount: payment.amount,
        platformFee: payment.platformFee,
        photographerPayout: payment.photographerPayout,
        stripeInvoiceId: '', // Will be updated by webhooks
        dueDate: payment.dueDate,
        status: 'pending',
        retryAttempts: 0,
        createdAt: now,
        updatedAt: now
      };

      await createPayment(paymentRecord);
    }

    console.log(`✅ INSTALLMENT: Created plan ${planId} with ${preview.numberOfPayments} payments`);

    res.json({
      success: true,
      plan,
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

    // Cancel Stripe subscription schedule
    await cancelSubscriptionSchedule(plan.stripeSubscriptionScheduleId, reason);

    // Mark plan as canceled
    await daoCancelPlan(planId, reason);

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

export default router;

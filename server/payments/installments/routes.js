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
const { db } = require('../../db.ts');
const { photographySessions, users } = require('../../../shared/schema');

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
        userId: photographySessions.userId,
        stripeConnectAccountId: users.stripeConnectAccountId
      })
      .from(photographySessions)
      .leftJoin(users, eq(photographySessions.userId, users.uid))
      .where(eq(photographySessions.id, request.sessionId))
      .limit(1);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Determine which Stripe account to use
    const usePlatformAccount = !session.stripeConnectAccountId;
    
    if (usePlatformAccount) {
      console.log(`💳 INSTALLMENT: Using PLATFORM Stripe account (photographer has no Connect account)`);
    } else {
      console.log(`💳 INSTALLMENT: Using CONNECTED Stripe account: ${session.stripeConnectAccountId}`);
    }
    
    request.photographerId = session.userId;
    request.stripeConnectedAccountId = session.stripeConnectAccountId || 'platform';

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

    const { customerId, scheduleId, paymentRecordIds } = await createPaymentPlanSchedule(request, preview, planId, usePlatformAccount);

    await updatePlan(planId, {
      stripeCustomerId: customerId,
      stripeSubscriptionScheduleId: scheduleId,
      usePlatformAccount: usePlatformAccount
    });

    // Update session to mark it has a payment plan
    try {
      await db.update(photographySessions)
        .set({
          hasPaymentPlan: true,
          paymentPlanId: planId,
          updatedAt: new Date()
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
      // Determine which Stripe account was used
      const usePlatformAccount = !plan.stripeConnectedAccountId || plan.stripeConnectedAccountId === 'platform';
      await cancelSubscriptionSchedule(plan.stripeSubscriptionScheduleId, plan.stripeConnectedAccountId, usePlatformAccount);
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
    
    // Determine which Stripe account to use
    const usePlatformAccount = !plan.stripeConnectedAccountId || plan.stripeConnectedAccountId === 'platform';
    
    if (usePlatformAccount) {
      console.log(`💳 INSTALLMENT: Attaching payment to PLATFORM Stripe account`);
    } else {
      console.log(`💳 INSTALLMENT: Attaching payment to CONNECTED Stripe account: ${plan.stripeConnectedAccountId}`);
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
    
    const { customerId, scheduleId } = await createPaymentPlanSchedule(request, preview, planId, usePlatformAccount);
    
    // Update plan with Stripe IDs
    await updatePlan(planId, {
      stripeCustomerId: customerId,
      stripeSubscriptionScheduleId: scheduleId,
      status: 'active',
      usePlatformAccount: usePlatformAccount
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

/**
 * POST /api/installments/:planId/send-email
 * Send first payment link via email (using mailto: or SMTP)
 */
router.post('/:planId/send-email', async (req, res) => {
  try {
    const { planId } = req.params;
    const { useMailto = true } = req.body;
    const userId = req.session?.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const plan = await getPlan(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }

    if (plan.photographerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get session and photographer info
    const [session] = await db.select().from(photographySessions).where(eq(photographySessions.id, plan.sessionId));
    const [photographer] = await db.select().from(users).where(eq(users.id, plan.photographerId));

    if (!session || !photographer) {
      return res.status(404).json({ error: 'Session or photographer not found' });
    }

    // Use session's actual email, not what's stored in the plan
    const clientEmail = session.email || plan.customerEmail;
    const clientName = session.clientName || plan.customerName;

    if (!clientEmail || clientEmail === 'client@example.com') {
      return res.status(400).json({ error: 'Client email address not found in session. Please update the session with a valid email address.' });
    }

    // Calculate first payment info from plan data (avoid Firestore query)
    const firstPayment = {
      amount: plan.perInstallmentAmount,
      dueDate: plan.startDate
    };

    // Build payment link - use custom domain if set, otherwise use Replit URLs
    const baseUrl = process.env.BASE_URL || 
      (process.env.REPLIT_DEPLOYMENT === 'production' 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_CLUSTER}.repl.co`
        : `https://${process.env.REPLIT_DEV_DOMAIN}`);
    const clientPaymentLink = `${baseUrl}/installment-setup.html?planId=${planId}`;

    // Format email content
    const emailSubject = `First Payment Ready - ${session.sessionType} Session`;
    
    let emailText = `Hi ${clientName},\n\n`;
    emailText += `Your automated payment plan is ready! Here's the link to set up your payment method for your ${session.sessionType} session with ${photographer.businessName || photographer.displayName}.\n\n`;
    emailText += `Payment Plan Summary:\n`;
    emailText += `${'='.repeat(60)}\n`;
    emailText += `Total Amount: $${parseFloat(plan.totalAmount).toFixed(2)}\n`;
    emailText += `Number of Payments: ${plan.numberOfPayments}\n`;
    emailText += `Payment Frequency: ${plan.cadence === 'biweekly' ? 'Every 2 weeks' : 'Monthly'}\n`;
    emailText += `First Payment: $${parseFloat(firstPayment.amount).toFixed(2)}\n`;
    emailText += `First Payment Date: ${new Date(firstPayment.dueDate).toLocaleDateString()}\n`;
    emailText += `${'='.repeat(60)}\n\n`;
    emailText += `Click the link below to set up your payment method:\n`;
    emailText += `${clientPaymentLink}\n\n`;
    emailText += `Once you set up your payment method, your payments will be automatically charged on the scheduled dates.\n\n`;
    emailText += `If you have any questions, please contact:\n`;
    emailText += `${photographer.businessName || photographer.displayName}\n`;
    emailText += `Email: ${photographer.email}\n`;
    if (photographer.phoneNumber) {
      emailText += `Phone: ${photographer.phoneNumber}\n`;
    }
    emailText += `\nThank you!`;

    if (useMailto) {
      // Generate mailto: URL
      const mailtoUrl = `mailto:${clientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailText)}`;
      
      return res.json({
        success: true,
        method: 'mailto',
        mailtoUrl,
        recipientEmail: clientEmail,
        message: 'Email client URL generated. This will open your default email app.'
      });
    } else {
      // Use nodemailer to send email
      const nodemailer = require('nodemailer');
      
      // Check if SMTP is configured
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.log('⚠ SMTP not configured - falling back to mailto: URL');
        const mailtoUrl = `mailto:${clientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailText)}`;
        
        return res.json({
          success: true,
          method: 'mailto',
          mailtoUrl,
          recipientEmail: clientEmail,
          message: 'SMTP not configured. Use mailto URL to open default email app.',
          note: 'Configure SMTP_USER, SMTP_PASSWORD, SMTP_HOST to enable automatic email sending'
        });
      }

      // Configure nodemailer with SMTP settings
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      // Send email
      await transporter.sendMail({
        from: `"${photographer.businessName || photographer.displayName}" <${process.env.SMTP_USER}>`,
        to: clientEmail,
        subject: emailSubject,
        text: emailText
      });

      console.log(`✅ First payment link email sent to ${clientEmail}`);
      
      return res.json({
        success: true,
        method: 'smtp',
        recipientEmail: clientEmail,
        message: 'First payment link sent via email'
      });
    }
  } catch (error) {
    console.error('❌ INSTALLMENT: Send email error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send email'
    });
  }
});

/**
 * POST /api/installments/:planId/send-sms
 * Generate SMS URL for first payment link
 */
router.post('/:planId/send-sms', async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.session?.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const plan = await getPlan(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }

    if (plan.photographerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get session and photographer info
    const [session] = await db.select().from(photographySessions).where(eq(photographySessions.id, plan.sessionId));
    const [photographer] = await db.select().from(users).where(eq(users.id, plan.photographerId));

    if (!session || !photographer) {
      return res.status(404).json({ error: 'Session or photographer not found' });
    }

    // Use session's actual data
    const clientName = session.clientName || plan.customerName;
    const clientPhone = session.phoneNumber;

    // Check if client phone number exists
    if (!clientPhone) {
      return res.status(400).json({ error: 'Client phone number not found in session. Please update the session with a valid phone number.' });
    }

    // Calculate first payment info from plan data (avoid Firestore query)
    const firstPayment = {
      amount: plan.perInstallmentAmount,
      dueDate: plan.startDate
    };

    // Build payment link - use custom domain if set, otherwise use Replit URLs
    const baseUrl = process.env.BASE_URL || 
      (process.env.REPLIT_DEPLOYMENT === 'production' 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_CLUSTER}.repl.co`
        : `https://${process.env.REPLIT_DEV_DOMAIN}`);
    const clientPaymentLink = `${baseUrl}/installment-setup.html?planId=${planId}`;

    // Format short SMS message
    let smsText = `Hi ${clientName}! Your payment plan is ready for your ${session.sessionType} session with ${photographer.businessName || photographer.displayName}.\n\n`;
    smsText += `Total: $${parseFloat(plan.totalAmount).toFixed(2)}\n`;
    smsText += `${plan.numberOfPayments} payments of ~$${(parseFloat(plan.totalAmount) / plan.numberOfPayments).toFixed(2)}\n`;
    smsText += `First payment: $${parseFloat(firstPayment.amount).toFixed(2)} on ${new Date(firstPayment.dueDate).toLocaleDateString()}\n\n`;
    smsText += `Set up payment method here:\n${clientPaymentLink}\n\n`;
    smsText += `Questions? Contact ${photographer.email}`;

    // Clean phone number
    const cleanPhone = clientPhone.replace(/\D/g, '');
    
    // Generate SMS URL
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(smsText)}`;

    console.log(`📱 First payment link SMS URL generated for ${clientName} (${clientPhone})`);
    
    res.json({
      success: true,
      smsUrl,
      recipientPhone: clientPhone,
      message: 'SMS URL generated. This will open the default SMS app.',
      note: 'Without a third-party SMS service, this opens the device SMS app with pre-filled text'
    });
  } catch (error) {
    console.error('❌ INSTALLMENT: Send SMS error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate SMS'
    });
  }
});

module.exports = router;

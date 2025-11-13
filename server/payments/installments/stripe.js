/**
 * Stripe Integration for Installment Plans
 * Uses Stripe Subscription Schedules for scheduled payments
 */

const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const { calculatePaymentSchedule, dollarsToCents } = require('./math');
const { createPayment, updatePayment } = require('./dao');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia'
});

const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '300');

// Verify platform fee is set correctly to 300 basis points (3%)
if (PLATFORM_FEE_BPS !== 300 && process.env.PLATFORM_FEE_BPS) {
  console.warn(`⚠️ PLATFORM_FEE_BPS is ${PLATFORM_FEE_BPS} but should be 300 (3%)`);
}
console.log(`💰 Platform fee configured: ${PLATFORM_FEE_BPS} basis points (${PLATFORM_FEE_BPS / 100}%)`);

/**
 * Create or get a Stripe customer with payment method setup
 * @param {boolean} usePlatformAccount - If true, create on platform account instead of connected account
 */
async function createOrGetCustomer(email, name, stripeConnectedAccountId, paymentMethodId = null, usePlatformAccount = false) {
  let existingCustomers;
  
  // Only pass stripeAccount option when using connected account
  if (usePlatformAccount) {
    existingCustomers = await stripe.customers.list({
      email,
      limit: 1
    });
  } else {
    existingCustomers = await stripe.customers.list({
      email,
      limit: 1
    }, { stripeAccount: stripeConnectedAccountId });
  }

  let customerId;

  if (existingCustomers.data.length > 0) {
    customerId = existingCustomers.data[0].id;
    console.log(`ℹ️  Found existing customer: ${customerId}`);
  } else {
    const customerData = {
      email,
      name,
      metadata: {
        source: 'installment_plans',
        mode: usePlatformAccount ? 'platform_account' : 'connected_account'
      }
    };

    // CRITICAL: Do NOT set default_payment_method during customer creation on connected accounts
    // Payment method must be attached separately first

    let customer;
    if (usePlatformAccount) {
      customer = await stripe.customers.create(customerData);
    } else {
      customer = await stripe.customers.create(customerData, { stripeAccount: stripeConnectedAccountId });
    }
    customerId = customer.id;
    console.log(`✅ New customer created: ${customerId}`);
  }

  // Attach payment method to customer if provided
  if (paymentMethodId) {
    try {
      // STEP 1: Attach the payment method to the customer first
      if (usePlatformAccount) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId
        });
      } else {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId
        }, { stripeAccount: stripeConnectedAccountId });
      }
      console.log(`✅ Payment method ${paymentMethodId} attached to customer ${customerId}`);
    } catch (attachError) {
      if (attachError.code === 'resource_already_exists') {
        console.log(`ℹ️  Payment method ${paymentMethodId} already attached to customer ${customerId}`);
      } else {
        console.error(`❌ Error attaching payment method:`, attachError.message);
        throw attachError;
      }
    }
    
    // STEP 2: Then set it as the default payment method for all customers (new and existing)
    try {
      if (usePlatformAccount) {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
      } else {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        }, { stripeAccount: stripeConnectedAccountId });
      }
      console.log(`✅ Payment method ${paymentMethodId} set as default for customer ${customerId}`);
    } catch (updateError) {
      console.error(`❌ Error setting default payment method:`, updateError.message);
      throw updateError;
    }
  }

  return customerId;
}

/**
 * Create subscription schedule for installment plan
 * Uses subscription schedules with phases for each payment
 * @param {boolean} usePlatformAccount - If true, charge platform account instead of connected account
 */
async function createPaymentPlanSchedule(request, preview, planId, usePlatformAccount = false) {
  const { 
    customerEmail, 
    customerName, 
    stripeConnectedAccountId,
    sessionId,
    photographerId,
    paymentMethodId,
    cadence
  } = request;

  console.log(`💳 Creating subscription schedule with Stripe Connect`);
  console.log(`📊 STRIPE CONNECT DEBUG:`, {
    usePlatformAccount,
    stripeConnectedAccountId,
    photographerId,
    sessionId: sessionId.substring(0, 8),
    PLATFORM_FEE_BPS,
    platformFeePercent: PLATFORM_FEE_BPS / 100
  });

  // CRITICAL: For Stripe Connect with platform fees, EVERYTHING must be created on platform account
  // We use application_fee_percent + transfer_data in the schedule phases to route payments to connected account
  // DO NOT use on_behalf_of - it creates invoices on the connected account instead of platform
  
  // Always create customer on PLATFORM account (even when using connected account for routing)
  const customerId = await createOrGetCustomer(
    customerEmail, 
    customerName, 
    stripeConnectedAccountId, 
    paymentMethodId,
    true // Force platform account for customer
  );

  console.log(`✅ Customer created/retrieved on PLATFORM account: ${customerId}`);

  const phases = [];
  const paymentRecordIds = [];

  const platformFeePercent = PLATFORM_FEE_BPS / 100;

  // Always create product on PLATFORM account (even when using connected account for routing)
  const product = await stripe.products.create({
    name: `Photography Session - ${sessionId.substring(0, 8)}`,
    metadata: {
      session_id: sessionId,
      plan_id: planId,
      connected_account: stripeConnectedAccountId || 'none'
    }
  });
  
  console.log(`✅ Product created on PLATFORM account: ${product.id}`);

  for (let i = 0; i < preview.paymentSchedule.length; i++) {
    const payment = preview.paymentSchedule[i];
    const paymentRecordId = uuidv4();
    
    const paymentRecord = {
      id: paymentRecordId,
      planId,
      sessionId,
      photographerId,
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      platformFee: payment.platformFee,
      photographerPayout: payment.photographerPayout,
      dueDate: payment.dueDate,
      status: 'pending',
      stripeInvoiceId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await createPayment(paymentRecord);
    paymentRecordIds.push(paymentRecordId);

    // Build phase configuration
    // CRITICAL: Do NOT use on_behalf_of with subscription schedules - it creates invoices on connected account
    // Instead, use ONLY transfer_data with application_fee_percent for platform fee collection
    const phase = {
      items: [{
        price_data: {
          currency: 'usd',
          product: product.id,
          unit_amount: payment.amount,
          recurring: cadence === 'biweekly'
            ? { interval: 'week', interval_count: 2 }
            : { interval: 'month', interval_count: 1 }
        },
        quantity: 1
      }],
      iterations: 1,
      metadata: {
        payment_record_id: paymentRecordId,
        session_id: sessionId,
        photographer_id: photographerId,
        payment_number: payment.paymentNumber.toString(),
        plan_id: planId,
        total_payments: preview.numberOfPayments.toString(),
        account_mode: usePlatformAccount ? 'platform' : 'connected'
      }
    };

    // Only add Connect-specific fields if using connected account
    if (!usePlatformAccount && stripeConnectedAccountId) {
      // Use transfer_data + application_fee_percent WITHOUT on_behalf_of
      // This keeps invoices on platform account while routing funds to connected account
      phase.application_fee_percent = platformFeePercent;
      phase.transfer_data = {
        destination: stripeConnectedAccountId
      };
      console.log(`🔗 CONNECT ROUTING: Payment ${payment.paymentNumber} → Account ${stripeConnectedAccountId}, Fee: ${platformFeePercent}%`);
    } else {
      console.log(`⚠️ PLATFORM ROUTING: Payment ${payment.paymentNumber} → Platform account (Connect ID missing or platform mode)`);
    }

    phases.push(phase);
  }

  // Calculate start timestamp from first payment due date
  const startTimestamp = Math.floor(new Date(preview.paymentSchedule[0].dueDate).getTime() / 1000);

  const scheduleParams = {
    customer: customerId,
    start_date: startTimestamp,
    end_behavior: 'cancel',
    phases: phases,
    metadata: {
      plan_id: planId,
      session_id: sessionId,
      photographer_id: photographerId,
      total_payments: preview.numberOfPayments.toString(),
      account_mode: usePlatformAccount ? 'platform' : 'connected'
    }
  };

  // CRITICAL: ALWAYS create subscription schedules on the PLATFORM account
  // When using connected accounts, we use application_fee_percent + transfer_data to route payments
  // This keeps invoices on platform account, collects 3% platform fee, and transfers 97% to photographer
  console.log(`🏢 Creating subscription schedule on PLATFORM account...`);
  if (!usePlatformAccount && stripeConnectedAccountId) {
    console.log(`🔗 With Connect routing: Funds → ${stripeConnectedAccountId}, Platform fee: ${platformFeePercent}%`);
  } else {
    console.log(`💰 Direct platform billing (no connected account)`);
  }
  
  const schedule = await stripe.subscriptionSchedules.create(scheduleParams);

  console.log(`✅ Subscription schedule created: ${schedule.id}`);
  console.log(`📍 Schedule location: Platform dashboard`);
  console.log(`💳 Customer location: ${usePlatformAccount ? 'Platform account' : `Connected account ${stripeConnectedAccountId}`}`);

  return {
    customerId,
    scheduleId: schedule.id,
    paymentRecordIds,
    invoiceIds: []
  };
}

/**
 * Cancel a subscription schedule
 * @param {boolean} usePlatformAccount - If true, cancel on platform account instead of connected account
 */
async function cancelSubscriptionSchedule(scheduleId, stripeConnectedAccountId, usePlatformAccount = false) {
  // CRITICAL: Always retrieve and cancel from PLATFORM account
  // All subscription schedules are created on platform account (even when using Connect)
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  
  if (schedule.status === 'active' || schedule.status === 'not_started') {
    await stripe.subscriptionSchedules.cancel(scheduleId);
    console.log(`✅ Subscription schedule ${scheduleId} canceled successfully on PLATFORM account`);
  } else {
    console.log(`ℹ️  Subscription schedule ${scheduleId} already in ${schedule.status} status`);
  }
}

/**
 * Cancel (void) an unpaid invoice (legacy support)
 */
async function cancelInvoice(invoiceId) {
  const invoice = await stripe.invoices.retrieve(invoiceId);
  
  if (invoice.status === 'draft' || invoice.status === 'open') {
    await stripe.invoices.voidInvoice(invoiceId);
  }
}

/**
 * Cancel all invoices for a payment plan (legacy support)
 */
async function cancelPlanInvoices(invoiceIds) {
  const results = [];
  
  for (const invoiceId of invoiceIds) {
    try {
      await cancelInvoice(invoiceId);
      results.push({ invoiceId, success: true });
    } catch (error) {
      results.push({ invoiceId, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Get invoice details
 */
async function getInvoice(invoiceId) {
  return await stripe.invoices.retrieve(invoiceId);
}

/**
 * Get subscription schedule details
 * CRITICAL: Always retrieve from platform account (where all schedules are created)
 */
async function getSubscriptionSchedule(scheduleId, stripeConnectedAccountId) {
  // Always retrieve from platform account - schedules are never created on connected accounts
  return await stripe.subscriptionSchedules.retrieve(scheduleId);
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature, secret) {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

module.exports = {
  createOrGetCustomer,
  createPaymentPlanSchedule,
  cancelSubscriptionSchedule,
  cancelInvoice,
  cancelPlanInvoices,
  getInvoice,
  getSubscriptionSchedule,
  verifyWebhookSignature,
  stripe
};

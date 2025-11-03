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

const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '0');

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
  } else {
    const customerData = {
      email,
      name,
      metadata: {
        source: 'installment_plans',
        mode: usePlatformAccount ? 'platform_account' : 'connected_account'
      }
    };

    if (paymentMethodId) {
      customerData.invoice_settings = {
        default_payment_method: paymentMethodId
      };
    }

    let customer;
    if (usePlatformAccount) {
      customer = await stripe.customers.create(customerData);
    } else {
      customer = await stripe.customers.create(customerData, { stripeAccount: stripeConnectedAccountId });
    }
    customerId = customer.id;
  }

  // Attach payment method to customer if provided
  if (paymentMethodId) {
    // Attach the payment method to the customer first
    if (usePlatformAccount) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } else {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      }, { stripeAccount: stripeConnectedAccountId });
    }
    
    // Then set it as the default payment method (only if customer already existed)
    if (existingCustomers.data.length > 0) {
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

  console.log(`💳 Creating subscription schedule in ${usePlatformAccount ? 'PLATFORM' : 'CONNECTED'} account mode`);

  const customerId = await createOrGetCustomer(
    customerEmail, 
    customerName, 
    stripeConnectedAccountId, 
    paymentMethodId,
    usePlatformAccount
  );

  const phases = [];
  const paymentRecordIds = [];

  const platformFeePercent = PLATFORM_FEE_BPS / 100;

  // Create a product for the photography session
  let product;
  if (usePlatformAccount) {
    product = await stripe.products.create({
      name: `Photography Session - ${sessionId.substring(0, 8)}`,
      metadata: {
        session_id: sessionId,
        plan_id: planId
      }
    });
  } else {
    product = await stripe.products.create({
      name: `Photography Session - ${sessionId.substring(0, 8)}`,
      metadata: {
        session_id: sessionId,
        plan_id: planId
      }
    }, { stripeAccount: stripeConnectedAccountId });
  }

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
      phase.application_fee_percent = platformFeePercent;
      phase.on_behalf_of = stripeConnectedAccountId;
      phase.transfer_data = {
        destination: stripeConnectedAccountId
      };
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

  // Create subscription schedule - only pass stripeAccount if using connected account
  let schedule;
  if (usePlatformAccount) {
    schedule = await stripe.subscriptionSchedules.create(scheduleParams);
  } else {
    schedule = await stripe.subscriptionSchedules.create(scheduleParams, { stripeAccount: stripeConnectedAccountId });
  }

  console.log(`✅ Subscription schedule created: ${schedule.id} (${usePlatformAccount ? 'PLATFORM' : 'CONNECTED'} mode)`);

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
  let schedule;
  
  // Retrieve schedule - only pass stripeAccount if using connected account
  if (usePlatformAccount) {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  } else {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, { stripeAccount: stripeConnectedAccountId });
  }
  
  if (schedule.status === 'active' || schedule.status === 'not_started') {
    // Cancel schedule - only pass stripeAccount if using connected account
    if (usePlatformAccount) {
      await stripe.subscriptionSchedules.cancel(scheduleId);
    } else {
      await stripe.subscriptionSchedules.cancel(scheduleId, { stripeAccount: stripeConnectedAccountId });
    }
    console.log(`✅ Subscription schedule canceled: ${scheduleId} (${usePlatformAccount ? 'PLATFORM' : 'CONNECTED'} mode)`);
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
 */
async function getSubscriptionSchedule(scheduleId, stripeConnectedAccountId) {
  const requestOptions = {
    stripeAccount: stripeConnectedAccountId
  };
  return await stripe.subscriptionSchedules.retrieve(scheduleId, requestOptions);
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

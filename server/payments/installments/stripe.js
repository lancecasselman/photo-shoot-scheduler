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
 */
async function createOrGetCustomer(email, name, paymentMethodId = null) {
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1
  });

  let customerId;

  if (existingCustomers.data.length > 0) {
    customerId = existingCustomers.data[0].id;
  } else {
    const customerData = {
      email,
      name,
      metadata: {
        source: 'installment_plans'
      }
    };

    if (paymentMethodId) {
      customerData.invoice_settings = {
        default_payment_method: paymentMethodId
      };
    }

    const customer = await stripe.customers.create(customerData);
    customerId = customer.id;
  }

  if (paymentMethodId && existingCustomers.data.length > 0) {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
  }

  return customerId;
}

/**
 * Create subscription schedule for installment plan
 * Uses subscription schedules with phases for each payment
 */
async function createPaymentPlanInvoices(request, preview, planId) {
  const { 
    customerEmail, 
    customerName, 
    stripeConnectedAccountId,
    sessionId,
    photographerId,
    paymentMethodId
  } = request;

  const customerId = await createOrGetCustomer(customerEmail, customerName, paymentMethodId);

  const phases = [];
  const paymentRecordIds = [];

  const platformFeePercent = PLATFORM_FEE_BPS / 100;

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

    const startTimestamp = Math.floor(new Date(payment.dueDate).getTime() / 1000);

    phases.push({
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Photography Session Payment ${payment.paymentNumber}/${preview.numberOfPayments}`,
            metadata: {
              session_id: sessionId,
              payment_number: payment.paymentNumber.toString()
            }
          },
          unit_amount: payment.amount,
          recurring: {
            interval: 'month',
            interval_count: 1
          }
        },
        quantity: 1
      }],
      iterations: 1,
      start_date: startTimestamp,
      metadata: {
        payment_record_id: paymentRecordId,
        session_id: sessionId,
        photographer_id: photographerId,
        payment_number: payment.paymentNumber.toString(),
        plan_id: planId,
        total_payments: preview.numberOfPayments.toString()
      },
      application_fee_percent: platformFeePercent,
      on_behalf_of: stripeConnectedAccountId,
      transfer_data: {
        destination: stripeConnectedAccountId
      }
    });
  }

  const scheduleParams = {
    customer: customerId,
    start_date: phases[0].start_date,
    end_behavior: 'cancel',
    phases: phases,
    metadata: {
      plan_id: planId,
      session_id: sessionId,
      photographer_id: photographerId,
      total_payments: preview.numberOfPayments.toString()
    }
  };

  const requestOptions = {
    stripeAccount: stripeConnectedAccountId
  };

  const schedule = await stripe.subscriptionSchedules.create(scheduleParams, requestOptions);

  return {
    customerId,
    scheduleId: schedule.id,
    paymentRecordIds,
    invoiceIds: []
  };
}

/**
 * Cancel a subscription schedule
 */
async function cancelSubscriptionSchedule(scheduleId, stripeConnectedAccountId) {
  const requestOptions = {
    stripeAccount: stripeConnectedAccountId
  };
  
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, requestOptions);
  
  if (schedule.status === 'active' || schedule.status === 'not_started') {
    await stripe.subscriptionSchedules.cancel(scheduleId, requestOptions);
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
  createPaymentPlanInvoices,
  cancelSubscriptionSchedule,
  cancelInvoice,
  cancelPlanInvoices,
  getInvoice,
  getSubscriptionSchedule,
  verifyWebhookSignature,
  stripe
};

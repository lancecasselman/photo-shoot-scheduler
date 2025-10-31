/**
 * Stripe Integration for Installment Plans
 * Handles Subscription Schedules with Connect transfers
 */

const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const { calculatePaymentSchedule, dollarsToCents } = require('./math');
const { createPayment } = require('./dao');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia'
});

const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '0');

/**
 * Create or get a Stripe customer
 */
async function createOrGetCustomer(email, name) {
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      source: 'installment_plans'
    }
  });

  return customer.id;
}

/**
 * Create a Subscription Schedule with Connect transfers
 */
async function createSubscriptionSchedule(request, preview, planId) {
  const { 
    customerEmail, 
    customerName, 
    stripeConnectedAccountId,
    sessionId 
  } = request;

  const customerId = await createOrGetCustomer(customerEmail, customerName);

  const paymentRecordIds = [];
  
  for (let i = 0; i < preview.paymentSchedule.length; i++) {
    const paymentSchedule = preview.paymentSchedule[i];
    const paymentRecordId = uuidv4();
    
    const paymentRecord = {
      id: paymentRecordId,
      planId,
      sessionId,
      photographerId: request.photographerId,
      paymentNumber: paymentSchedule.paymentNumber,
      amount: paymentSchedule.amount,
      platformFee: paymentSchedule.platformFee,
      photographerPayout: paymentSchedule.photographerPayout,
      dueDate: paymentSchedule.dueDate,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await createPayment(paymentRecord);
    paymentRecordIds.push(paymentRecordId);
  }

  const phases = [];
  
  for (let i = 0; i < preview.paymentSchedule.length; i++) {
    const payment = preview.paymentSchedule[i];
    const paymentRecordId = paymentRecordIds[i];
    
    phases.push({
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Photography Session Payment ${payment.paymentNumber}/${preview.numberOfPayments}`,
            metadata: {
              session_id: sessionId,
              payment_number: payment.paymentNumber.toString(),
              payment_record_id: paymentRecordId
            }
          },
          unit_amount: payment.amount,
          recurring: {
            interval: preview.cadence === 'biweekly' ? 'week' : 'month',
            interval_count: preview.cadence === 'biweekly' ? 2 : 1
          }
        },
        quantity: 1
      }],
      iterations: 1,
      metadata: {
        session_id: sessionId,
        payment_number: payment.paymentNumber.toString(),
        photographer_id: request.photographerId,
        payment_record_id: paymentRecordId
      },
      transfer_data: {
        destination: stripeConnectedAccountId
      },
      application_fee_amount: payment.platformFee
    });
  }

  const schedule = await stripe.subscriptionSchedules.create({
    customer: customerId,
    start_date: Math.floor(new Date(preview.startDate).getTime() / 1000),
    end_behavior: 'cancel',
    phases,
    metadata: {
      session_id: sessionId,
      photographer_id: request.photographerId,
      total_amount: preview.totalAmount.toString(),
      number_of_payments: preview.numberOfPayments.toString(),
      plan_id: planId
    }
  });

  return {
    scheduleId: schedule.id,
    customerId,
    paymentRecordIds
  };
}

/**
 * Cancel a subscription schedule
 */
async function cancelSubscriptionSchedule(scheduleId, reason) {
  await stripe.subscriptionSchedules.cancel(scheduleId, {
    invoice_now: false,
    prorate: false
  });
}

/**
 * Get subscription schedule details
 */
async function getSubscriptionSchedule(scheduleId) {
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
  createSubscriptionSchedule,
  cancelSubscriptionSchedule,
  getSubscriptionSchedule,
  verifyWebhookSignature,
  stripe
};

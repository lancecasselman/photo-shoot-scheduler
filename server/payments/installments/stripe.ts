/**
 * Stripe Integration for Installment Plans
 * Handles Subscription Schedules with Connect transfers
 */

import Stripe from 'stripe';
import { InstallmentPreview, CreateInstallmentPlanRequest } from './schema';
import { calculatePaymentSchedule, dollarsToCents } from './math';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil'
});

const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '500'); // Default 5%

/**
 * Create or get a Stripe customer
 */
export async function createOrGetCustomer(
  email: string,
  name: string
): Promise<string> {
  // Search for existing customer
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer
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
export async function createSubscriptionSchedule(
  request: CreateInstallmentPlanRequest,
  preview: InstallmentPreview
): Promise<{ scheduleId: string; customerId: string }> {
  const { 
    customerEmail, 
    customerName, 
    stripeConnectedAccountId,
    sessionId 
  } = request;

  // Create or get customer
  const customerId = await createOrGetCustomer(customerEmail, customerName);

  // Build phases for subscription schedule
  const phases: Stripe.SubscriptionScheduleCreateParams.Phase[] = [];
  
  for (let i = 0; i < preview.paymentSchedule.length; i++) {
    const payment = preview.paymentSchedule[i];
    const isLastPayment = i === preview.paymentSchedule.length - 1;
    
    // Each phase is one billing period
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
            interval: preview.cadence === 'biweekly' ? 'week' : 'month',
            interval_count: preview.cadence === 'biweekly' ? 2 : 1
          }
        },
        quantity: 1
      }],
      iterations: 1, // Only charge once per phase
      metadata: {
        session_id: sessionId,
        payment_number: payment.paymentNumber.toString(),
        photographer_id: request.photographerId
      },
      // Transfer to photographer's connected account minus platform fee
      transfer_data: {
        destination: stripeConnectedAccountId,
        amount_percent: ((payment.photographerPayout / payment.amount) * 100)
      },
      // Platform keeps the fee automatically
      application_fee_percent: (payment.platformFee / payment.amount) * 100
    });
  }

  // Create subscription schedule
  const schedule = await stripe.subscriptionSchedules.create({
    customer: customerId,
    start_date: Math.floor(new Date(preview.startDate).getTime() / 1000),
    end_behavior: 'cancel',
    phases,
    metadata: {
      session_id: sessionId,
      photographer_id: request.photographerId,
      total_amount: preview.totalAmount.toString(),
      number_of_payments: preview.numberOfPayments.toString()
    }
  });

  return {
    scheduleId: schedule.id,
    customerId
  };
}

/**
 * Cancel a subscription schedule
 */
export async function cancelSubscriptionSchedule(
  scheduleId: string,
  reason?: string
): Promise<void> {
  await stripe.subscriptionSchedules.cancel(scheduleId, {
    invoice_now: false,
    prorate: false
  });
}

/**
 * Get subscription schedule details
 */
export async function getSubscriptionSchedule(
  scheduleId: string
): Promise<Stripe.SubscriptionSchedule> {
  return await stripe.subscriptionSchedules.retrieve(scheduleId);
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export { stripe };

/**
 * Webhook Handlers for Installment Plans
 * Processes Stripe events for subscription schedules
 */

import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import {
  getPlan,
  getPaymentByInvoiceId,
  markPaymentPaid,
  markPaymentFailed,
  updatePlan,
  storeWebhookEvent,
  markWebhookProcessed
} from './dao';
import { WebhookEvent } from './schema';

/**
 * Handle invoice.payment_succeeded event
 */
export async function handlePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  console.log('💰 INSTALLMENT: Payment succeeded for invoice:', invoice.id);

  // Find the payment record
  const payment = await getPaymentByInvoiceId(invoice.id);
  
  if (!payment) {
    console.warn('⚠️ INSTALLMENT: Payment record not found for invoice:', invoice.id);
    return;
  }

  // Mark payment as paid
  const invoiceAny = invoice as any;
  const paymentIntentId = typeof invoiceAny.payment_intent === 'string' ? invoiceAny.payment_intent : '';
  const chargeId = typeof invoiceAny.charge === 'string' ? invoiceAny.charge : '';
  
  await markPaymentPaid(payment.id, paymentIntentId, chargeId);

  console.log(`✅ INSTALLMENT: Payment ${payment.paymentNumber} marked as paid for plan ${payment.planId}`);

  // Check if all payments are complete
  const plan = await getPlan(payment.planId);
  if (!plan) {
    console.warn('⚠️ INSTALLMENT: Plan not found:', payment.planId);
    return;
  }

  // TODO: Could check if all payments are complete and mark plan as completed
}

/**
 * Handle invoice.payment_failed event
 */
export async function handlePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  console.log('❌ INSTALLMENT: Payment failed for invoice:', invoice.id);

  // Find the payment record
  const payment = await getPaymentByInvoiceId(invoice.id);
  
  if (!payment) {
    console.warn('⚠️ INSTALLMENT: Payment record not found for invoice:', invoice.id);
    return;
  }

  const retryAttempts = (payment.retryAttempts || 0) + 1;
  const failureReason = 'Payment failed';

  // Mark payment as failed
  await markPaymentFailed(payment.id, failureReason, retryAttempts);

  console.log(`❌ INSTALLMENT: Payment ${payment.paymentNumber} failed (attempt ${retryAttempts}) for plan ${payment.planId}`);

  // TODO: Notify photographer and customer
  // TODO: Handle retry logic or cancellation after max attempts
}

/**
 * Handle customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log('🗑️ INSTALLMENT: Subscription deleted:', subscription.id);

  // Find plan by subscription metadata
  const sessionId = subscription.metadata?.session_id || '';
  
  if (!sessionId) {
    console.warn('⚠️ INSTALLMENT: No session_id in subscription metadata');
    return;
  }

  // TODO: Find plan by session ID and mark as canceled
  console.log('📝 INSTALLMENT: Marking plan as canceled for session:', sessionId);
}

/**
 * Process webhook event
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  // Store webhook event
  const webhookEvent: WebhookEvent = {
    id: event.id,
    type: event.type,
    data: event.data,
    createdAt: new Date().toISOString(),
    processed: false
  };

  await storeWebhookEvent(webhookEvent);

  try {
    // Route to appropriate handler
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      default:
        console.log('ℹ️ INSTALLMENT: Unhandled webhook event type:', event.type);
    }

    await markWebhookProcessed(event.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ INSTALLMENT: Error processing webhook:', error);
    await markWebhookProcessed(event.id, errorMessage);
    throw error;
  }
}

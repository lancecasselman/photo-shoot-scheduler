/**
 * Webhook Handlers for Installment Plans
 * Processes Stripe events for subscription schedules
 */

const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const {
  getPlan,
  getPayment,
  getPaymentByInvoiceId,
  getPlansBySession,
  markPaymentPaid,
  markPaymentFailed,
  updatePayment,
  updatePlan,
  cancelPlan,
  storeWebhookEvent,
  markWebhookProcessed
} = require('./dao');

/**
 * Handle invoice.payment_succeeded event
 */
async function handlePaymentSucceeded(invoice) {
  console.log('💰 INSTALLMENT: Payment succeeded for invoice:', invoice.id);

  const invoiceAny = invoice;
  const paymentRecordId = invoiceAny.subscription_details?.metadata?.payment_record_id || 
                          invoice.metadata?.payment_record_id || 
                          invoice.lines?.data?.[0]?.metadata?.payment_record_id;
  
  if (!paymentRecordId) {
    console.warn('⚠️ INSTALLMENT: No payment_record_id in invoice metadata:', invoice.id);
    let payment = await getPaymentByInvoiceId(invoice.id);
    if (!payment) {
      console.error('❌ INSTALLMENT: Cannot find payment record for invoice:', invoice.id);
      return;
    }
  }

  let payment = paymentRecordId ? await getPayment(paymentRecordId) : null;
  
  if (!payment) {
    payment = await getPaymentByInvoiceId(invoice.id);
  }
  
  if (!payment) {
    console.error('❌ INSTALLMENT: Payment record not found for invoice:', invoice.id);
    return;
  }

  const paymentIntentId = typeof invoiceAny.payment_intent === 'string' ? invoiceAny.payment_intent : '';
  const chargeId = typeof invoiceAny.charge === 'string' ? invoiceAny.charge : '';
  
  await markPaymentPaid(payment.id, paymentIntentId, chargeId);

  if (!payment.stripeInvoiceId) {
    await updatePayment(payment.id, { stripeInvoiceId: invoice.id });
  }

  console.log(`✅ INSTALLMENT: Payment ${payment.paymentNumber} marked as paid for plan ${payment.planId}`);

  const plan = await getPlan(payment.planId);
  if (!plan) {
    console.warn('⚠️ INSTALLMENT: Plan not found:', payment.planId);
    return;
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handlePaymentFailed(invoice) {
  console.log('❌ INSTALLMENT: Payment failed for invoice:', invoice.id);

  const invoiceAny = invoice;
  const paymentRecordId = invoiceAny.subscription_details?.metadata?.payment_record_id || 
                          invoice.metadata?.payment_record_id || 
                          invoice.lines?.data?.[0]?.metadata?.payment_record_id;
  
  let payment = paymentRecordId ? await getPayment(paymentRecordId) : null;
  
  if (!payment) {
    payment = await getPaymentByInvoiceId(invoice.id);
  }
  
  if (!payment) {
    console.error('❌ INSTALLMENT: Payment record not found for invoice:', invoice.id);
    return;
  }

  if (!payment.stripeInvoiceId) {
    await updatePayment(payment.id, { stripeInvoiceId: invoice.id });
  }

  const retryAttempts = (payment.retryAttempts || 0) + 1;
  const failureReason = invoice.last_payment_error?.message || 'Payment failed';

  await markPaymentFailed(payment.id, failureReason, retryAttempts);

  console.log(`❌ INSTALLMENT: Payment ${payment.paymentNumber} failed (attempt ${retryAttempts}) for plan ${payment.planId}: ${failureReason}`);
}

/**
 * Handle invoice.voided event (when an invoice is cancelled)
 */
async function handleInvoiceVoided(invoice) {
  console.log('🗑️ INSTALLMENT: Invoice voided:', invoice.id);

  const invoiceAny = invoice;
  const paymentRecordId = invoiceAny.subscription_details?.metadata?.payment_record_id || 
                          invoice.metadata?.payment_record_id || 
                          invoice.lines?.data?.[0]?.metadata?.payment_record_id;
  
  let payment = paymentRecordId ? await getPayment(paymentRecordId) : null;
  
  if (!payment) {
    payment = await getPaymentByInvoiceId(invoice.id);
  }
  
  if (!payment) {
    console.error('❌ INSTALLMENT: Payment record not found for voided invoice:', invoice.id);
    return;
  }

  await updatePayment(payment.id, {
    status: 'canceled',
    updatedAt: new Date().toISOString()
  });

  console.log(`✅ INSTALLMENT: Payment ${payment.paymentNumber} marked as canceled for plan ${payment.planId}`);
}

/**
 * Process webhook event
 */
async function processWebhookEvent(event) {
  const webhookEvent = {
    id: event.id,
    type: event.type,
    data: event.data,
    createdAt: new Date().toISOString(),
    processed: false
  };

  await storeWebhookEvent(webhookEvent);

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      case 'invoice.voided':
        await handleInvoiceVoided(event.data.object);
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

module.exports = {
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleInvoiceVoided,
  processWebhookEvent
};

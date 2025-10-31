/**
 * Data Access Object for Installment Plans
 * Manages Firestore CRUD operations
 */

import { Firestore } from '@google-cloud/firestore';
import { InstallmentPlan, InstallmentPayment, WebhookEvent } from './schema';

const firestore = new Firestore({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }
});

const PLANS_COLLECTION = 'installmentPlans';
const PAYMENTS_COLLECTION = 'installmentPayments';
const WEBHOOKS_COLLECTION = 'installmentWebhooks';

/**
 * Create a new installment plan
 */
export async function createPlan(plan: InstallmentPlan): Promise<void> {
  await firestore.collection(PLANS_COLLECTION).doc(plan.id).set(plan);
}

/**
 * Get an installment plan by ID
 */
export async function getPlan(planId: string): Promise<InstallmentPlan | null> {
  const doc = await firestore.collection(PLANS_COLLECTION).doc(planId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as InstallmentPlan;
}

/**
 * Get plans by session ID
 */
export async function getPlansBySession(sessionId: string): Promise<InstallmentPlan[]> {
  const snapshot = await firestore
    .collection(PLANS_COLLECTION)
    .where('sessionId', '==', sessionId)
    .get();
  
  return snapshot.docs.map(doc => doc.data() as InstallmentPlan);
}

/**
 * Get plans by photographer ID
 */
export async function getPlansByPhotographer(photographerId: string): Promise<InstallmentPlan[]> {
  const snapshot = await firestore
    .collection(PLANS_COLLECTION)
    .where('photographerId', '==', photographerId)
    .get();
  
  return snapshot.docs.map(doc => doc.data() as InstallmentPlan);
}

/**
 * Update a plan
 */
export async function updatePlan(
  planId: string,
  updates: Partial<InstallmentPlan>
): Promise<void> {
  await firestore.collection(PLANS_COLLECTION).doc(planId).update({
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Cancel a plan
 */
export async function cancelPlan(
  planId: string,
  reason?: string
): Promise<void> {
  await firestore.collection(PLANS_COLLECTION).doc(planId).update({
    status: 'canceled',
    canceledAt: new Date().toISOString(),
    cancelReason: reason,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Create a payment record
 */
export async function createPayment(payment: InstallmentPayment): Promise<void> {
  await firestore.collection(PAYMENTS_COLLECTION).doc(payment.id).set(payment);
}

/**
 * Get a payment by ID
 */
export async function getPayment(paymentId: string): Promise<InstallmentPayment | null> {
  const doc = await firestore.collection(PAYMENTS_COLLECTION).doc(paymentId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as InstallmentPayment;
}

/**
 * Get payment by Stripe invoice ID
 */
export async function getPaymentByInvoiceId(invoiceId: string): Promise<InstallmentPayment | null> {
  const snapshot = await firestore
    .collection(PAYMENTS_COLLECTION)
    .where('stripeInvoiceId', '==', invoiceId)
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data() as InstallmentPayment;
}

/**
 * Get all payments for a plan
 */
export async function getPaymentsByPlan(planId: string): Promise<InstallmentPayment[]> {
  const snapshot = await firestore
    .collection(PAYMENTS_COLLECTION)
    .where('planId', '==', planId)
    .orderBy('paymentNumber', 'asc')
    .get();
  
  return snapshot.docs.map(doc => doc.data() as InstallmentPayment);
}

/**
 * Update a payment
 */
export async function updatePayment(
  paymentId: string,
  updates: Partial<InstallmentPayment>
): Promise<void> {
  await firestore.collection(PAYMENTS_COLLECTION).doc(paymentId).update({
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Mark payment as paid
 */
export async function markPaymentPaid(
  paymentId: string,
  paymentIntentId: string,
  chargeId: string
): Promise<void> {
  await updatePayment(paymentId, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId
  });
}

/**
 * Mark payment as failed
 */
export async function markPaymentFailed(
  paymentId: string,
  failureReason: string,
  retryAttempts: number
): Promise<void> {
  await updatePayment(paymentId, {
    status: 'failed',
    failureReason,
    retryAttempts
  });
}

/**
 * Store webhook event
 */
export async function storeWebhookEvent(event: WebhookEvent): Promise<void> {
  await firestore.collection(WEBHOOKS_COLLECTION).doc(event.id).set(event);
}

/**
 * Mark webhook as processed
 */
export async function markWebhookProcessed(eventId: string, error?: string): Promise<void> {
  await firestore.collection(WEBHOOKS_COLLECTION).doc(eventId).update({
    processed: true,
    processedAt: new Date().toISOString(),
    ...(error && { error })
  });
}

export { firestore };

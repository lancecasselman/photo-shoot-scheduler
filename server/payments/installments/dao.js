/**
 * Data Access Object for Installment Plans
 * Manages Firestore CRUD operations
 */

const { Firestore } = require('@google-cloud/firestore');

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
async function createPlan(plan) {
  await firestore.collection(PLANS_COLLECTION).doc(plan.id).set(plan);
}

/**
 * Get an installment plan by ID
 */
async function getPlan(planId) {
  const doc = await firestore.collection(PLANS_COLLECTION).doc(planId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data();
}

/**
 * Get plans by session ID
 */
async function getPlansBySession(sessionId) {
  const snapshot = await firestore
    .collection(PLANS_COLLECTION)
    .where('sessionId', '==', sessionId)
    .get();
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get plans by photographer ID
 */
async function getPlansByPhotographer(photographerId) {
  const snapshot = await firestore
    .collection(PLANS_COLLECTION)
    .where('photographerId', '==', photographerId)
    .get();
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Update a plan
 */
async function updatePlan(planId, updates) {
  await firestore.collection(PLANS_COLLECTION).doc(planId).update({
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Cancel a plan
 */
async function cancelPlan(planId, reason) {
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
async function createPayment(payment) {
  await firestore.collection(PAYMENTS_COLLECTION).doc(payment.id).set(payment);
}

/**
 * Get a payment by ID
 */
async function getPayment(paymentId) {
  const doc = await firestore.collection(PAYMENTS_COLLECTION).doc(paymentId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data();
}

/**
 * Get payment by Stripe invoice ID
 */
async function getPaymentByInvoiceId(invoiceId) {
  const snapshot = await firestore
    .collection(PAYMENTS_COLLECTION)
    .where('stripeInvoiceId', '==', invoiceId)
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data();
}

/**
 * Get all payments for a plan
 */
async function getPaymentsByPlan(planId) {
  const snapshot = await firestore
    .collection(PAYMENTS_COLLECTION)
    .where('planId', '==', planId)
    .orderBy('paymentNumber', 'asc')
    .get();
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Update a payment
 */
async function updatePayment(paymentId, updates) {
  await firestore.collection(PAYMENTS_COLLECTION).doc(paymentId).update({
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Mark payment as paid
 */
async function markPaymentPaid(paymentId, paymentIntentId, chargeId) {
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
async function markPaymentFailed(paymentId, failureReason, retryAttempts) {
  await updatePayment(paymentId, {
    status: 'failed',
    failureReason,
    retryAttempts
  });
}

/**
 * Store webhook event
 */
async function storeWebhookEvent(event) {
  await firestore.collection(WEBHOOKS_COLLECTION).doc(event.id).set(event);
}

/**
 * Mark webhook as processed
 */
async function markWebhookProcessed(eventId, error) {
  await firestore.collection(WEBHOOKS_COLLECTION).doc(eventId).update({
    processed: true,
    processedAt: new Date().toISOString(),
    ...(error && { error })
  });
}

module.exports = {
  createPlan,
  getPlan,
  getPlansBySession,
  getPlansByPhotographer,
  updatePlan,
  cancelPlan,
  createPayment,
  getPayment,
  getPaymentByInvoiceId,
  getPaymentsByPlan,
  updatePayment,
  markPaymentPaid,
  markPaymentFailed,
  storeWebhookEvent,
  markWebhookProcessed,
  firestore
};

/**
 * Stripe Integration for Installment Plans
 * Uses individual Stripe Invoices with auto-collection for scheduled payments
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
 * Create individual invoices for each payment in the installment plan
 * Each invoice is scheduled to auto-charge on its due date
 */
async function createPaymentPlanInvoices(request, preview, planId) {
  const { 
    customerEmail, 
    customerName, 
    stripeConnectedAccountId,
    sessionId,
    photographerId
  } = request;

  const customerId = await createOrGetCustomer(customerEmail, customerName);

  const invoiceIds = [];
  const paymentRecordIds = [];

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

    const dueTimestamp = Math.floor(new Date(payment.dueDate).getTime() / 1000);

    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'charge_automatically',
      auto_advance: true,
      due_date: dueTimestamp,
      on_behalf_of: stripeConnectedAccountId,
      transfer_data: {
        destination: stripeConnectedAccountId
      },
      application_fee_amount: payment.platformFee,
      metadata: {
        payment_record_id: paymentRecordId,
        session_id: sessionId,
        photographer_id: photographerId,
        payment_number: payment.paymentNumber.toString(),
        plan_id: planId,
        total_payments: preview.numberOfPayments.toString()
      }
    });

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: payment.amount,
      currency: 'usd',
      description: `Photography Session Payment ${payment.paymentNumber}/${preview.numberOfPayments}`,
      metadata: {
        session_id: sessionId,
        payment_number: payment.paymentNumber.toString()
      }
    });

    await stripe.invoices.finalizeInvoice(invoice.id);

    await updatePayment(paymentRecordId, {
      stripeInvoiceId: invoice.id
    });

    invoiceIds.push(invoice.id);
    paymentRecordIds.push(paymentRecordId);
  }

  return {
    customerId,
    invoiceIds,
    paymentRecordIds
  };
}

/**
 * Cancel (void) an unpaid invoice
 */
async function cancelInvoice(invoiceId) {
  const invoice = await stripe.invoices.retrieve(invoiceId);
  
  if (invoice.status === 'draft' || invoice.status === 'open') {
    await stripe.invoices.voidInvoice(invoiceId);
  }
}

/**
 * Cancel all invoices for a payment plan
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
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature, secret) {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

module.exports = {
  createOrGetCustomer,
  createPaymentPlanInvoices,
  cancelInvoice,
  cancelPlanInvoices,
  getInvoice,
  verifyWebhookSignature,
  stripe
};

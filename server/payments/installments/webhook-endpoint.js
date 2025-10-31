/**
 * Webhook Endpoint for Installment Plans
 * Handles Stripe webhook events
 */

const express = require('express');
const { verifyWebhookSignature, processWebhookEvent } = require('./index');

const router = express.Router();

/**
 * POST /api/webhooks/installments
 * Handle Stripe webhook events
 */
router.post('/installments', express.raw({ type: 'application/json' }), async (req, res) => {
  const signatureHeader = req.headers['stripe-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  
  if (!signature) {
    console.error('❌ INSTALLMENT WEBHOOK: Missing stripe-signature header');
    return res.status(400).send('Missing signature');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('❌ INSTALLMENT WEBHOOK: STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  try {
    const event = verifyWebhookSignature(req.body, signature, webhookSecret);
    
    console.log('✅ INSTALLMENT WEBHOOK: Verified event:', event.type);

    processWebhookEvent(event).catch(error => {
      console.error('❌ INSTALLMENT WEBHOOK: Processing error:', error);
    });

    res.json({ received: true });
  } catch (error) {
    console.error('❌ INSTALLMENT WEBHOOK: Signature verification failed:', error);
    res.status(400).send('Invalid signature');
  }
});

module.exports = router;

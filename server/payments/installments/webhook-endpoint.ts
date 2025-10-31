/**
 * Webhook Endpoint for Installment Plans
 * Handles Stripe webhook events
 */

import express from 'express';
import { verifyWebhookSignature, processWebhookEvent } from './index';

const router = express.Router();

/**
 * POST /api/webhooks/installments
 * Handle Stripe webhook events
 */
router.post('/installments', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
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
    // Verify webhook signature
    const event = verifyWebhookSignature(req.body, signature, webhookSecret);
    
    console.log('✅ INSTALLMENT WEBHOOK: Verified event:', event.type);

    // Process event asynchronously
    processWebhookEvent(event).catch(error => {
      console.error('❌ INSTALLMENT WEBHOOK: Processing error:', error);
    });

    // Respond immediately to Stripe
    res.json({ received: true });
  } catch (error) {
    console.error('❌ INSTALLMENT WEBHOOK: Signature verification failed:', error);
    res.status(400).send('Invalid signature');
  }
});

export default router;

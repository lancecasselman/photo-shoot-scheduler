// Test webhook signature verification
const crypto = require('crypto');
const http = require('http');

// Simulated webhook payload (checkout.session.completed)
const payload = JSON.stringify({
  id: 'evt_test_webhook_' + Date.now(),
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_' + Date.now(),
      object: 'checkout.session',
      amount_total: 225,
      payment_intent: 'pi_test_' + Date.now(),
      metadata: {
        sessionId: '2d61cd82-a8e0-4b19-9a56-f054c5b57daf',
        type: 'deposit',
        paymentId: 'payment-2d61cd82-a8e0-4b19-9a56-f054c5b57daf-' + Date.now(),
        photographerAccountId: 'acct_1S1uyfGqTZZYB7ET',
        baseAmount: '2.25',
        tipAmount: '0',
        totalAmount: '2.25'
      },
      customer_details: {
        email: 'test@example.com'
      },
      payment_status: 'paid',
      status: 'complete'
    }
  }
});

// Get webhook secret from environment (this is a test secret)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test123';

// Create signature
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(signedPayload)
  .digest('hex');

const signature = `t=${timestamp},v1=${expectedSignature}`;

console.log('Testing webhook endpoint...');
console.log('Payload:', JSON.parse(payload));
console.log('Signature:', signature);

// Make request to local server  
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/stripe/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'stripe-signature': signature
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    if (res.statusCode === 200) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(payload);
req.end();
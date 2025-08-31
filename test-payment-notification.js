const http = require('http');
const crypto = require('crypto');

// Test payment webhook with notification
async function testPaymentNotification() {
    console.log('Testing payment notification system...\n');
    
    // Create a test payment event
    const payload = JSON.stringify({
        id: 'evt_test_notification_' + Date.now(),
        object: 'event',
        type: 'checkout.session.completed',
        account: 'acct_1S1uyfGqTZZYB7ET', // Connected account
        data: {
            object: {
                id: 'cs_test_' + Date.now(),
                object: 'checkout.session',
                amount_total: 500,
                payment_intent: 'pi_test_' + Date.now(),
                metadata: {
                    sessionId: '1a1cdf8a-6cbb-4cdc-bd22-94a30af294e3', // Your actual session ID
                    type: 'invoice',
                    paymentId: 'payment-test-' + Date.now(),
                    photographerAccountId: 'acct_1S1uyfGqTZZYB7ET',
                    baseAmount: '5.00',
                    tipAmount: '0',
                    totalAmount: '5.00'
                },
                customer_details: {
                    email: 'testclient@example.com'
                },
                payment_status: 'paid',
                status: 'complete'
            }
        }
    });
    
    // Create signature (use test secret)
    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');
    
    const signature = `t=${timestamp},v1=${expectedSignature}`;
    
    // Send to Connect webhook endpoint
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/stripe/connect-webhook',
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
                console.log('\n✅ Webhook processed successfully!');
                console.log('Check the server logs above for email notification details.');
            } else {
                console.log('\n❌ Webhook processing failed');
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('Request error:', error);
    });
    
    req.write(payload);
    req.end();
}

// Run the test
console.log('='.repeat(60));
console.log('PAYMENT NOTIFICATION TEST');
console.log('='.repeat(60));
testPaymentNotification();
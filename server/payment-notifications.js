/**
 * Payment Notification System
 * Handles Stripe webhook events for photography session payments and deposits
 */

const { Pool } = require('pg');
const { initializeNotificationServices, sendBillingNotification } = require('./notifications');

class PaymentNotificationManager {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    /**
     * Handle successful payment events from Stripe webhooks
     */
    async handlePaymentSuccess(paymentIntent) {
        // Extract amount from various possible fields (Stripe uses different fields for different event types)
        const amountInCents = paymentIntent.amount_received || paymentIntent.amount || paymentIntent.amount_total || 0;
        const amount = amountInCents / 100;
        
        console.log(' Payment successful:', paymentIntent.id, 'Amount: $', amount.toFixed(2));
        console.log(' Payment data fields:', {
            amount_received: paymentIntent.amount_received,
            amount: paymentIntent.amount,
            amount_total: paymentIntent.amount_total
        });
        
        try {
            // Extract session info from payment metadata
            const sessionId = paymentIntent.metadata?.sessionId;
            const paymentType = paymentIntent.metadata?.type || 'invoice'; // 'deposit' or 'invoice'
            const clientEmail = paymentIntent.receipt_email || paymentIntent.customer_details?.email;
            
            if (!sessionId) {
                console.log(' No session ID in payment metadata, skipping notification');
                return;
            }

            // Get session details from database
            const client = await this.pool.connect();
            try {
                const sessionResult = await client.query(
                    'SELECT * FROM photography_sessions WHERE id = $1',
                    [sessionId]
                );

                if (sessionResult.rows.length === 0) {
                    console.log(' Session not found for payment:', sessionId);
                    return;
                }

                const session = sessionResult.rows[0];

                // Record payment in database
                await this.recordPayment(client, {
                    sessionId: sessionId,
                    stripePaymentIntentId: paymentIntent.id,
                    amount: amount,
                    type: paymentType,
                    clientEmail: clientEmail,
                    status: 'completed',
                    paidAt: new Date()
                });

                // Update session payment status
                if (paymentType === 'deposit') {
                    await this.updateDepositStatus(client, sessionId, amount);
                } else {
                    await this.updateInvoiceStatus(client, sessionId, amount);
                }

                // Send notifications to photographer
                await this.sendPhotographerNotification(session, {
                    amount: amount,
                    type: paymentType,
                    paymentId: paymentIntent.id,
                    clientEmail: clientEmail || session.email
                });

                console.log(' Payment notification processing complete for session:', sessionId);

            } finally {
                client.release();
            }

        } catch (error) {
            console.error('❌ Error processing payment success:', error);
            throw error;
        }
    }

    /**
     * Record payment in payment_records table
     */
    async recordPayment(client, paymentData) {
        try {
            await client.query(`
                INSERT INTO deposit_payments (
                    session_id, stripe_payment_intent_id, amount, payment_type, 
                    client_email, status, paid_at, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                paymentData.sessionId,
                paymentData.stripePaymentIntentId,
                paymentData.amount,
                paymentData.type,
                paymentData.clientEmail,
                paymentData.status,
                paymentData.paidAt,
                new Date()
            ]);

            console.log(' Payment recorded in deposit_payments table:', paymentData.stripePaymentIntentId);
        } catch (error) {
            console.error('❌ Error recording payment:', error);
            throw error;
        }
    }

    /**
     * Update deposit status for session
     */
    async updateDepositStatus(client, sessionId, amount) {
        try {
            await client.query(`
                UPDATE photography_sessions 
                SET deposit_amount = COALESCE(deposit_amount, 0) + $1,
                    deposit_paid = true,
                    deposit_paid_at = NOW(),
                    updated_at = NOW()
                WHERE id = $2
            `, [amount, sessionId]);

            console.log(' Deposit status updated for session:', sessionId, 'Amount:', amount, '- Marked as PAID');
        } catch (error) {
            console.error('❌ Error updating deposit status:', error);
            throw error;
        }
    }

    /**
     * Update invoice payment status for session
     */
    async updateInvoiceStatus(client, sessionId, amount) {
        try {
            await client.query(`
                UPDATE photography_sessions 
                SET paid = true,
                    invoice_paid_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
            `, [sessionId]);

            console.log(' Invoice payment status updated for session:', sessionId, '- Marked as FULLY PAID');
        } catch (error) {
            console.error('❌ Error updating invoice status:', error);
            throw error;
        }
    }

    /**
     * Send notification to photographer about successful payment
     */
    async sendPhotographerNotification(session, paymentDetails) {
        console.log('📧 START: Sending photographer notification for payment:', paymentDetails.paymentId);
        console.log('📧 Session details:', { 
            sessionId: session.id, 
            userId: session.user_id, 
            clientName: session.client_name 
        });
        
        try {
            // Get the photographer's email from the database using their user_id
            const photographerResult = await this.pool.query(
                'SELECT email, display_name, business_name FROM users WHERE id = $1',
                [session.user_id]
            );
            
            console.log('📧 Photographer query result:', {
                found: photographerResult.rows.length > 0,
                email: photographerResult.rows[0]?.email
            });
            
            if (photographerResult.rows.length === 0) {
                console.log('⚠️ Photographer not found for session, using default email');
            }
            
            const photographer = photographerResult.rows[0];
            const photographerEmail = photographer?.email || process.env.PHOTOGRAPHER_EMAIL || 'lancecasselman@icloud.com';
            console.log('📧 Sending to email:', photographerEmail);
            const photographerName = photographer?.display_name || photographer?.business_name || 'Photographer';
            
            const isDeposit = paymentDetails.type === 'deposit';
            const paymentTypeText = isDeposit ? 'Deposit' : 'Final Payment';
            
            const subject = ` ${paymentTypeText} Received - ${session.client_name}`;
            
            const message = `
Hi ${photographerName},

Great news! You've received a ${paymentTypeText.toLowerCase()} for your photography session.

${paymentTypeText} Details:
• Amount: $${paymentDetails.amount.toFixed(2)}
• Payment ID: ${paymentDetails.paymentId}
• Client: ${session.client_name}
• Client Email: ${paymentDetails.clientEmail}

Session Information:
• Session Type: ${session.session_type}
• Date: ${new Date(session.date_time).toLocaleDateString()}
• Location: ${session.location}
• Total Session Price: $${parseFloat(session.price).toFixed(2)}

${isDeposit ? 
    `Deposit received! Remaining balance: $${(parseFloat(session.price) - paymentDetails.amount).toFixed(2)}` :
    'Session fully paid! '
}

You can view the session details in your photography management dashboard.
            `.trim();

            // Send email notification using the email service directly
            const { sendEmailWithSender } = require('./notifications');
            
            console.log('📧 Attempting to send email with subject:', subject);
            console.log('📧 Email service function loaded:', typeof sendEmailWithSender);
            
            const emailResult = await sendEmailWithSender(
                photographerEmail,
                subject,
                message,
                message.replace(/\n/g, '<br>'),
                'noreply@photomanagementsystem.com',
                'Photography Management System'
            );
            
            console.log('📧 Email send result:', emailResult);
            console.log(`✅ Photographer notification sent to ${photographerEmail} for payment:`, paymentDetails.paymentId);

        } catch (error) {
            console.error('❌ Error sending photographer notification:', error);
            // Don't throw - notification failure shouldn't break payment processing
        }
    }

    /**
     * Handle failed payment events
     */
    async handlePaymentFailure(paymentIntent) {
        console.log('❌ Payment failed:', paymentIntent.id);
        
        try {
            const sessionId = paymentIntent.metadata?.sessionId;
            if (!sessionId) return;

            // Get session details for notification
            const client = await this.pool.connect();
            try {
                const sessionResult = await client.query(
                    'SELECT * FROM photography_sessions WHERE id = $1',
                    [sessionId]
                );

                if (sessionResult.rows.length > 0) {
                    const session = sessionResult.rows[0];
                    
                    // Get the photographer's email
                    const photographerResult = await client.query(
                        'SELECT email, display_name, business_name FROM users WHERE id = $1',
                        [session.user_id]
                    );
                    
                    const photographer = photographerResult.rows[0];
                    const photographerEmail = photographer?.email || process.env.PHOTOGRAPHER_EMAIL || 'lancecasselman@icloud.com';
                    const photographerName = photographer?.display_name || photographer?.business_name || 'Photographer';
                    
                    // Notify photographer of payment failure
                    const subject = ` Payment Failed - ${session.client_name}`;
                    const message = `
Hi ${photographerName},

We encountered an issue processing a payment for one of your sessions.

Payment failure details:
• Client: ${session.client_name}
• Session: ${session.session_type} on ${new Date(session.date_time).toLocaleDateString()}
• Amount: $${(paymentIntent.amount / 100).toFixed(2)}
• Payment ID: ${paymentIntent.id}

You may want to follow up with the client about the payment issue.
                    `.trim();

                    const { sendEmailWithSender } = require('./notifications');
                    
                    await sendEmailWithSender(
                        photographerEmail,
                        subject,
                        message,
                        message.replace(/\n/g, '<br>'),
                        'noreply@photomanagementsystem.com',
                        'Photography Management System'
                    );
                    
                    console.log(`⚠️ Payment failure notification sent to ${photographerEmail}`);
                }
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('❌ Error processing payment failure:', error);
        }
    }
}

module.exports = PaymentNotificationManager;
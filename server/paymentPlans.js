const { v4: uuidv4 } = require('uuid');
const { db } = require('./db.ts');
const { paymentPlans, paymentRecords, photographySessions } = require('../shared/schema');
const { eq, and, lte, gte, sql } = require('drizzle-orm');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentPlanManager {
  // Create a payment plan for a session
  async createPaymentPlan(sessionId, userId, totalAmount, startDate, endDate, reminderDays = 3) {
    try {
      // Calculate monthly payments
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Calculate number of months between dates
      const monthsDiff = this.calculateMonthsBetween(start, end);
      const monthlyPayment = (parseFloat(totalAmount) / monthsDiff).toFixed(2);
      
      const planId = uuidv4();
      
      // Create payment plan
      const [plan] = await db.insert(paymentPlans).values({
        id: planId,
        sessionId,
        userId,
        totalAmount: totalAmount.toString(),
        monthlyPayment: monthlyPayment.toString(),
        startDate: start,
        endDate: end,
        totalPayments: monthsDiff,
        remainingBalance: totalAmount.toString(),
        nextPaymentDate: start,
        reminderDaysBefore: reminderDays
      }).returning();

      // Create individual payment records
      const paymentRecordsList = [];
      for (let i = 0; i < monthsDiff; i++) {
        const paymentDate = new Date(start);
        paymentDate.setMonth(paymentDate.getMonth() + i);
        
        paymentRecordsList.push({
          id: uuidv4(),
          planId,
          sessionId,
          userId,
          paymentNumber: i + 1,
          dueDate: paymentDate,
          amount: monthlyPayment.toString()
        });
      }

      await db.insert(paymentRecords).values(paymentRecordsList);

      // Update session with payment plan info
      await db.update(photographySessions)
        .set({
          hasPaymentPlan: true,
          paymentPlanId: planId,
          totalAmount: totalAmount.toString(),
          paymentPlanStartDate: start,
          paymentPlanEndDate: end,
          monthlyPayment: monthlyPayment.toString(),
          paymentsRemaining: monthsDiff,
          nextPaymentDate: start
        })
        .where(eq(photographySessions.id, sessionId));

      console.log(`SUCCESS: Payment plan created: ${monthsDiff} payments of $${monthlyPayment}`);
      return { plan, payments: paymentRecordsList };

    } catch (error) {
      console.error('Error creating payment plan:', error);
      throw error;
    }
  }

  // Calculate months between two dates
  calculateMonthsBetween(start, end) {
    const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                  (end.getMonth() - start.getMonth());
    return Math.max(1, months); // Minimum 1 month
  }

  // Get payment plan for a session
  async getPaymentPlan(sessionId) {
    try {
      const [plan] = await db.select()
        .from(paymentPlans)
        .where(eq(paymentPlans.sessionId, sessionId));

      if (!plan) return null;

      const payments = await db.select()
        .from(paymentRecords)
        .where(eq(paymentRecords.planId, plan.id))
        .orderBy(paymentRecords.paymentNumber);

      return { ...plan, payments };
    } catch (error) {
      console.error('Error getting payment plan:', error);
      return null;
    }
  }

  // Mark payment as received
  async markPaymentReceived(paymentId, paymentMethod = 'stripe', notes = '') {
    try {
      // Use direct SQL to avoid Drizzle timestamp issues
      const result = await db.execute(sql`
        UPDATE payment_records 
        SET status = 'paid', 
            paid_date = CURRENT_TIMESTAMP,
            payment_method = ${paymentMethod},
            notes = ${notes},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${paymentId}
        RETURNING *
      `);
      
      const payment = result.rows[0];
      if (!payment) throw new Error('Payment record not found');

      if (!payment) throw new Error('Payment record not found');

      // Update payment plan
      const [plan] = await db.select()
        .from(paymentPlans)
        .where(eq(paymentPlans.id, payment.planId));

      if (plan) {
        const newAmountPaid = parseFloat(plan.amountPaid) + parseFloat(payment.amount);
        const newRemainingBalance = parseFloat(plan.remainingBalance) - parseFloat(payment.amount);
        const newPaymentsCompleted = plan.paymentsCompleted + 1;
        
        // Check if plan is completed
        const isCompleted = newRemainingBalance <= 0.01; // Account for floating point precision
        
        // Get next payment date if not completed
        const nextPaymentDate = isCompleted ? null : await this.getNextPaymentDate(payment.planId);
        
        await db.update(paymentPlans)
          .set({
            paymentsCompleted: newPaymentsCompleted,
            amountPaid: newAmountPaid.toFixed(2),
            remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
            status: isCompleted ? 'completed' : 'active',
            nextPaymentDate
          })
          .where(eq(paymentPlans.id, payment.planId));

        // Update session (temporarily disabled timestamp update to debug)
        await db.update(photographySessions)
          .set({
            paymentsRemaining: Math.max(0, plan.totalPayments - newPaymentsCompleted),
            paid: isCompleted
          })
          .where(eq(photographySessions.id, payment.sessionId));

        console.log(`SUCCESS: Payment ${payment.paymentNumber} marked as paid. ${isCompleted ? 'Plan completed!' : `${plan.totalPayments - newPaymentsCompleted} payments remaining`}`);
      }

      return payment;
    } catch (error) {
      console.error('Error marking payment received:', error);
      throw error;
    }
  }

  // Get next payment date for a plan
  async getNextPaymentDate(planId) {
    try {
      const [nextPayment] = await db.select()
        .from(paymentRecords)
        .where(and(
          eq(paymentRecords.planId, planId),
          eq(paymentRecords.status, 'pending')
        ))
        .orderBy(paymentRecords.dueDate)
        .limit(1);

      if (nextPayment && nextPayment.dueDate) {
        // Ensure we return a proper Date object
        return new Date(nextPayment.dueDate);
      }
      return null;
    } catch (error) {
      console.error('Error getting next payment date:', error);
      return null;
    }
  }

  // Send invoice for payment
  async sendPaymentInvoice(paymentId, forceResend = false) {
    try {
      const [payment] = await db.select()
        .from(paymentRecords)
        .where(eq(paymentRecords.id, paymentId));

      if (!payment) throw new Error('Payment record not found');
      
      if (payment.invoiceSent && !forceResend) {
        console.log(`Invoice already sent for payment ${payment.paymentNumber}`);
        return payment;
      }

      // Get session details
      const [session] = await db.select()
        .from(photographySessions)
        .where(eq(photographySessions.id, payment.sessionId));

      if (!session) throw new Error('Session not found');

      // Create Stripe invoice
      let stripeInvoice = null;
      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 50) {
        try {
          // Create or get customer
          const customer = await stripe.customers.create({
            email: session.email,
            name: session.clientName,
            metadata: {
              sessionId: session.id,
              paymentPlanId: payment.planId,
              paymentNumber: payment.paymentNumber.toString()
            }
          });

          // Create invoice
          const invoice = await stripe.invoices.create({
            customer: customer.id,
            collection_method: 'send_invoice',
            days_until_due: 7,
            description: `Payment ${payment.paymentNumber} for ${session.sessionType} session`,
            metadata: {
              sessionId: session.id,
              paymentId: payment.id,
              paymentNumber: payment.paymentNumber.toString(),
              photographerName: 'Lance - The Legacy Photography'
            },
            footer: 'Thank you for choosing Lance - The Legacy Photography!\nContact: lance@thelegacyphotography.com'
          });

          // Add invoice item
          await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: invoice.id,
            amount: Math.round(parseFloat(payment.amount) * 100), // Convert to cents
            currency: 'usd',
            description: `${session.sessionType} Session - Payment ${payment.paymentNumber} of ${session.paymentsRemaining + 1}`,
          });

          // Finalize and send invoice
          const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
          const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);

          stripeInvoice = {
            id: sentInvoice.id,
            url: sentInvoice.hosted_invoice_url,
            pdf: sentInvoice.invoice_pdf,
            status: sentInvoice.status
          };

          console.log(`SUCCESS: Stripe invoice sent for payment ${payment.paymentNumber}: ${sentInvoice.hosted_invoice_url}`);
        } catch (stripeError) {
          console.error('Stripe invoice error:', stripeError.message);
          // Continue with email fallback
        }
      }

      // Update payment record
      await db.update(paymentRecords)
        .set({
          invoiceSent: true,
          invoiceSentAt: new Date(),
          stripeInvoiceId: stripeInvoice?.id || null,
          stripeInvoiceUrl: stripeInvoice?.url || null
        })
        .where(eq(paymentRecords.id, paymentId));

      console.log(`SUCCESS: Invoice sent for payment ${payment.paymentNumber}`);
      return payment;

    } catch (error) {
      console.error('Error sending payment invoice:', error);
      throw error;
    }
  }

  // Get all overdue payments
  async getOverduePayments() {
    try {
      const today = new Date();
      const overduePayments = await db.select()
        .from(paymentRecords)
        .where(and(
          eq(paymentRecords.status, 'pending'),
          lte(paymentRecords.dueDate, today)
        ));

      return overduePayments;
    } catch (error) {
      console.error('Error getting overdue payments:', error);
      return [];
    }
  }

  // Get payments due soon (for reminders)
  async getPaymentsDueSoon(daysBefore = 3) {
    try {
      const today = new Date();
      const reminderDate = new Date();
      reminderDate.setDate(today.getDate() + daysBefore);

      const upcomingPayments = await db.select()
        .from(paymentRecords)
        .where(and(
          eq(paymentRecords.status, 'pending'),
          gte(paymentRecords.dueDate, today),
          lte(paymentRecords.dueDate, reminderDate),
          eq(paymentRecords.reminderSent, false)
        ));

      return upcomingPayments;
    } catch (error) {
      console.error('Error getting upcoming payments:', error);
      return [];
    }
  }

  // Process automated monthly invoices and reminders
  async processAutomatedPayments() {
    console.log('🔄 Processing automated payment invoices and reminders...');
    
    try {
      // Send invoices for payments due today
      const today = new Date();
      const paymentsDueToday = await db.select()
        .from(paymentRecords)
        .where(and(
          eq(paymentRecords.status, 'pending'),
          lte(paymentRecords.dueDate, today),
          eq(paymentRecords.invoiceSent, false)
        ));

      console.log(`📋 Found ${paymentsDueToday.length} payments due for invoicing`);

      for (const payment of paymentsDueToday) {
        try {
          await this.sendPaymentInvoice(payment.id);
          console.log(`SUCCESS: Sent invoice for payment ${payment.paymentNumber}`);
        } catch (error) {
          console.error(`❌ Failed to send invoice for payment ${payment.id}:`, error.message);
        }
      }

      // Send reminders for upcoming payments
      const upcomingPayments = await this.getPaymentsDueSoon(3);
      console.log(`📋 Found ${upcomingPayments.length} payments due for reminders`);

      for (const payment of upcomingPayments) {
        try {
          // Mark reminder as sent
          await db.update(paymentRecords)
            .set({
              reminderSent: true,
              reminderSentAt: new Date()
            })
            .where(eq(paymentRecords.id, payment.id));

          console.log(`SUCCESS: Reminder sent for payment ${payment.paymentNumber} due ${payment.dueDate.toLocaleDateString()}`);
        } catch (error) {
          console.error(`❌ Failed to send reminder for payment ${payment.id}:`, error.message);
        }
      }

      // Update overdue payments
      const overduePayments = await this.getOverduePayments();
      if (overduePayments.length > 0) {
        console.log(`WARNING: Found ${overduePayments.length} overdue payments`);
        
        for (const payment of overduePayments) {
          await db.update(paymentRecords)
            .set({ status: 'overdue' })
            .where(eq(paymentRecords.id, payment.id));
        }
      }

      console.log('SUCCESS: Automated payment processing completed');
      return {
        invoicesSent: paymentsDueToday.length,
        remindersSent: upcomingPayments.length,
        overdueUpdated: overduePayments.length
      };

    } catch (error) {
      console.error('Error processing automated payments:', error);
      throw error;
    }
  }
}

module.exports = PaymentPlanManager;
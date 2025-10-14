const { v4: uuidv4 } = require('uuid');
const { createDb } = require('./db.ts');
const { paymentPlans, paymentRecords, photographySessions, users } = require('../shared/schema');
const { eq, and, lte, gte, sql } = require('drizzle-orm');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentPlanManager {
  constructor(pool) {
    if (!pool) {
      throw new Error('PaymentPlanManager requires a shared database pool parameter');
    }
    this.db = createDb(pool);
  }

  // Create a payment plan for a session
  async createPaymentPlan(sessionId, userId, totalAmount, startDate, endDate, frequency = 'monthly', reminderDays = 3) {
    try {
      // Calculate payments based on frequency
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Calculate number of payments based on frequency
      const paymentInfo = this.calculatePaymentsByFrequency(start, end, frequency, totalAmount);
      const { totalPayments, paymentAmount, paymentDates } = paymentInfo;

      const planId = uuidv4();

      // Create payment plan
      const [plan] = await this.db.insert(paymentPlans).values({
        id: planId,
        sessionId,
        userId,
        totalAmount: totalAmount.toString(),
        monthlyPayment: paymentAmount.toString(),
        startDate: start,
        endDate: end,
        totalPayments: totalPayments,
        remainingBalance: totalAmount.toString(),
        nextPaymentDate: start,
        reminderDaysBefore: reminderDays,
        paymentFrequency: frequency
      }).returning();

      // Create individual payment records
      const paymentRecordsList = [];
      for (let i = 0; i < totalPayments; i++) {
        paymentRecordsList.push({
          id: uuidv4(),
          planId,
          sessionId,
          userId,
          paymentNumber: i + 1,
          dueDate: paymentDates[i],
          amount: paymentAmount.toString()
        });
      }

      await this.db.insert(paymentRecords).values(paymentRecordsList);

      // Update session with payment plan info
      await this.db.update(photographySessions)
        .set({
          hasPaymentPlan: true,
          paymentPlanId: planId,
          totalAmount: totalAmount.toString(),
          paymentPlanStartDate: start,
          paymentPlanEndDate: end,
          monthlyPayment: paymentAmount.toString(),
          paymentsRemaining: totalPayments,
          nextPaymentDate: start
        })
        .where(eq(photographySessions.id, sessionId));

      console.log(`SUCCESS: Payment plan created: ${totalPayments} ${frequency} payments of $${paymentAmount}`);
      return { plan, payments: paymentRecordsList };

    } catch (error) {
      console.error('Error creating payment plan:', error);
      throw error;
    }
  }

  // Calculate payments by frequency (weekly, bi-weekly, monthly)
  calculatePaymentsByFrequency(startDate, endDate, frequency, totalAmount) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const paymentDates = [];
    let currentDate = new Date(start);

    // Calculate interval based on frequency
    let intervalDays;
    switch (frequency) {
      case 'weekly':
        intervalDays = 7;
        break;
      case 'biweekly':
        intervalDays = 14;
        break;
      case 'monthly':
        intervalDays = 30; // Approximate for calculation
        break;
      default:
        intervalDays = 30;
    }

    // Generate payment dates
    while (currentDate <= end) {
      paymentDates.push(new Date(currentDate));

      if (frequency === 'monthly') {
        // For monthly, increment by actual month
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        // For weekly/bi-weekly, increment by days
        currentDate.setDate(currentDate.getDate() + intervalDays);
      }
    }

    const totalPayments = paymentDates.length;
    const paymentAmount = (parseFloat(totalAmount) / totalPayments).toFixed(2);

    return {
      totalPayments,
      paymentAmount,
      paymentDates
    };
  }

  // Calculate months between two dates (legacy method)
  calculateMonthsBetween(start, end) {
    const months = (end.getFullYear() - start.getFullYear()) * 12 +
                  (end.getMonth() - start.getMonth());
    return Math.max(1, months); // Minimum 1 month
  }

  // Get payment plan for a session
  async getPaymentPlan(sessionId) {
    try {
      const [plan] = await this.db.select()
        .from(paymentPlans)
        .where(eq(paymentPlans.sessionId, sessionId));

      if (!plan) return null;

      const payments = await this.db.select()
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
      const result = await this.db.execute(sql`
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
      const [plan] = await this.db.select()
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

        await this.db.update(paymentPlans)
          .set({
            paymentsCompleted: newPaymentsCompleted,
            amountPaid: newAmountPaid.toFixed(2),
            remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
            status: isCompleted ? 'completed' : 'active',
            nextPaymentDate
          })
          .where(eq(paymentPlans.id, payment.planId));

        // Update session (temporarily disabled timestamp update to debug)
        await this.db.update(photographySessions)
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
      const [nextPayment] = await this.db.select()
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
      const [payment] = await this.db.select()
        .from(paymentRecords)
        .where(eq(paymentRecords.id, paymentId));

      if (!payment) throw new Error('Payment record not found');

      if (payment.invoiceSent && !forceResend) {
        console.log(`Invoice already sent for payment ${payment.paymentNumber}`);
        return payment;
      }

      // Get session details
      const [session] = await this.db.select()
        .from(photographySessions)
        .where(eq(photographySessions.id, payment.sessionId));

      if (!session) throw new Error('Session not found');

      // Get photographer's business information
      const [photographer] = await this.db.select()
        .from(users)
        .where(eq(users.id, session.userId));

      if (!photographer) throw new Error('Photographer not found');

      // Use photographer's business name, contact info and address for invoicing
      const businessName = photographer.businessName ||
                          (photographer.displayName ? `${photographer.displayName} Photography` : 'Photography Business');
      const businessEmail = photographer.email || 'noreply@photomanagementsystem.com';
      const businessPhone = photographer.phoneNumber || '';
      const businessAddress = (photographer.streetAddress && photographer.city && photographer.state)
        ? `${photographer.streetAddress}, ${photographer.city}, ${photographer.state} ${photographer.zipCode || ''}`
        : '';

      // Create Stripe invoice using Stripe Connect Manager
      let stripeInvoice = null;
      let invoiceSuccessfullySent = false;

      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 50) {
        try {
          // Check if photographer has Stripe Connect account
          if (!photographer.stripeConnectAccountId) {
            throw new Error('Photographer must complete Stripe Connect onboarding before accepting payments');
          }

          // Verify Stripe Connect account is active
          const StripeConnectManager = require('./stripe-connect');
          const stripeConnectManager = new StripeConnectManager();

          const accountStatus = await stripeConnectManager.getAccountStatus(photographer.stripeConnectAccountId);
          if (!accountStatus.success || !accountStatus.canReceivePayments) {
            throw new Error('Photographer Stripe account is not ready to receive payments');
          }

          // Create customer using Stripe Connect Manager
          const customerResult = await stripeConnectManager.createCustomer(
            session.email,
            session.clientName,
            photographer.stripeConnectAccountId
          );

          if (!customerResult.success) {
            throw new Error('Failed to create customer on photographer account');
          }

          const customer = customerResult.customer;

          // Create invoice using Stripe Connect Manager
          const baseUrl = process.env.BASE_URL || 'https://photomanagementsystem.com';
          const invoiceCustomUrl = `${baseUrl}/invoice.html?payment=${payment.id}`;

          const invoiceItems = [{
            amount: parseFloat(payment.amount),
            description: `${session.sessionType} Session - Payment ${payment.paymentNumber} of ${session.paymentsRemaining + 1}`,
            metadata: {
              sessionId: session.id,
              paymentId: payment.id,
              paymentNumber: payment.paymentNumber.toString()
            }
          }];

          // Add optional tip if specified
          const tipAmount = parseFloat(payment.tipAmount || '0');
          if (tipAmount > 0) {
            invoiceItems.push({
              amount: tipAmount,
              description: 'Optional Tip',
              metadata: { type: 'tip' }
            });
          }

          const invoiceResult = await stripeConnectManager.createInvoice(
            customer.id,
            invoiceItems,
            photographer.stripeConnectAccountId,
            {
              sessionId: session.id,
              paymentId: payment.id,
              paymentNumber: payment.paymentNumber.toString(),
              photographerName: businessName,
              photographerEmail: businessEmail,
              photographerPhone: businessPhone,
              photographerAddress: businessAddress,
              customInvoiceUrl: invoiceCustomUrl
            },
            {
              daysUntilDue: 7,
              description: `Payment ${payment.paymentNumber} for ${session.sessionType} session`,
              footer: `Thank you for choosing ${businessName}!\n${businessAddress ? `\n${businessAddress}` : ''}\n\nYou can add an optional tip and view full invoice details at:\n${invoiceCustomUrl}\n\nContact: ${businessEmail}${businessPhone ? ` | ${businessPhone}` : ''}`
            }
          );

          if (!invoiceResult.success) {
            throw new Error(`Failed to create invoice: ${invoiceResult.error}`);
          }

          const sentInvoice = invoiceResult.invoice;

          stripeInvoice = {
            id: sentInvoice.id,
            url: sentInvoice.hosted_invoice_url,
            pdf: sentInvoice.invoice_pdf,
            status: sentInvoice.status
          };

          // Mark as successfully sent only after create complete
          invoiceSuccessfullySent = true;
          console.log(`SUCCESS: Stripe invoice created for payment ${payment.paymentNumber}: ${sentInvoice.hosted_invoice_url}`);

        } catch (stripeError) {
          console.error(`❌ STRIPE ERROR for payment ${payment.paymentNumber}:`, stripeError.message);
          // Don't continue - throw the error to prevent marking as sent
          throw new Error(`Failed to send Stripe invoice: ${stripeError.message}`);
        }
      } else {
        // No Stripe configuration available
        throw new Error('Stripe is not configured - cannot send invoice');
      }

      // Only update payment record if invoice was successfully sent
      if (invoiceSuccessfullySent && stripeInvoice) {
        await this.db.update(paymentRecords)
          .set({
            invoiceSent: true,
            invoiceSentAt: new Date(),
            stripeInvoiceId: stripeInvoice.id,
            stripeInvoiceUrl: stripeInvoice.url
          })
          .where(eq(paymentRecords.id, paymentId));

        console.log(`SUCCESS: Invoice sent and recorded for payment ${payment.paymentNumber}`);
        return payment;
      } else {
        throw new Error('Invoice was not successfully sent via Stripe');
      }

    } catch (error) {
      console.error('Error sending payment invoice:', error);
      throw error;
    }
  }

  // Get all overdue payments
  async getOverduePayments() {
    try {
      const today = new Date();
      const overduePayments = await this.db.select()
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

      const upcomingPayments = await this.db.select()
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
    console.log(' Processing automated payment invoices and reminders...');

    try {
      // Send invoices for payments due today
      const today = new Date();
      const paymentsDueToday = await this.db.select()
        .from(paymentRecords)
        .where(and(
          eq(paymentRecords.status, 'pending'),
          lte(paymentRecords.dueDate, today),
          eq(paymentRecords.invoiceSent, false)
        ));

      console.log(` Found ${paymentsDueToday.length} payments due for invoicing`);

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
      console.log(` Found ${upcomingPayments.length} payments due for reminders`);

      for (const payment of upcomingPayments) {
        try {
          // Mark reminder as sent
          await this.db.update(paymentRecords)
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
          await this.db.update(paymentRecords)
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

  // Update tip amount for a payment record
  async updateTipAmount(paymentId, tipAmount) {
    try {
      await this.db.update(paymentRecords)
        .set({ tipAmount: tipAmount.toString() })
        .where(eq(paymentRecords.id, paymentId));

      console.log(`SUCCESS: Tip amount updated for payment ${paymentId}: $${tipAmount}`);
      return true;
    } catch (error) {
      console.error('Error updating tip amount:', error);
      throw error;
    }
  }

  // Get public invoice details (for client viewing)
  async getPublicInvoiceDetails(paymentId) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    let client;
    try {
      client = await pool.connect();

      // Get payment details
      const paymentResult = await client.query(`
        SELECT id, payment_number, amount, tip_amount, due_date, status, session_id, stripe_invoice_url
        FROM payment_records
        WHERE id = $1
      `, [paymentId]);

      if (paymentResult.rows.length === 0) {
        return null;
      }

      const payment = paymentResult.rows[0];

      // Get session details
      const sessionResult = await client.query(`
        SELECT s.client_name, s.session_type, s.date_time, s.email, s.user_id,
               u.business_name, u.email as photographer_email, u.display_name
        FROM photography_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = $1
      `, [payment.session_id]);

      if (sessionResult.rows.length === 0) {
        return null;
      }

      const session = sessionResult.rows[0];

      // Determine photographer business name
      const businessName = session.business_name ||
                          (session.display_name ? `${session.display_name} Photography` : 'Photography Business');
      const businessEmail = session.photographer_email || 'noreply@photomanagementsystem.com';

      return {
        id: payment.id,
        paymentNumber: payment.payment_number,
        amount: parseFloat(payment.amount),
        tipAmount: parseFloat(payment.tip_amount || '0'),
        dueDate: payment.due_date,
        status: payment.status,
        session: {
          clientName: session.client_name,
          sessionType: session.session_type,
          dateTime: session.date_time,
          email: session.email
        },
        photographer: {
          businessName: businessName,
          email: businessEmail
        },
        stripeInvoiceUrl: payment.stripe_invoice_url
      };
    } catch (error) {
      console.error('Error getting public invoice details:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
      await pool.end();
    }
  }
}

module.exports = PaymentPlanManager;
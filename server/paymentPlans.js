const { v4: uuidv4 } = require('uuid');
const { db } = require('./db.ts');
const { paymentPlans, paymentRecords, photographySessions, users } = require('../shared/schema');
const { eq, and, lte, gte, sql } = require('drizzle-orm');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createNotification } = require('./notifications-routes');

class PaymentPlanManager {
  constructor() {
    // Admin emails that use regular platform Stripe instead of Stripe Connect
    this.adminEmails = [
      'lancecasselman@icloud.com',
      'lancecasselman2011@gmail.com',
      'lance@thelegacyphotography.com'
    ];
  }

  // Check if user is an admin account
  isAdminAccount(email) {
    if (!email) return false;
    return this.adminEmails.some(adminEmail => 
      adminEmail.toLowerCase() === email.toLowerCase()
    );
  }

  // Verify that a session belongs to the specified user (authorization check)
  async verifySessionOwnership(sessionId, userId) {
    try {
      const [session] = await db.select()
        .from(photographySessions)
        .where(eq(photographySessions.id, sessionId));

      if (!session) {
        return {
          valid: false,
          reason: 'Session not found'
        };
      }

      if (session.userId !== userId) {
        return {
          valid: false,
          reason: 'Unauthorized: Session belongs to different user'
        };
      }

      return {
        valid: true,
        session
      };
    } catch (error) {
      console.error('Error verifying session ownership:', error);
      return {
        valid: false,
        reason: 'Error verifying session ownership'
      };
    }
  }

  // Create a payment plan for a session
  async createPaymentPlan(sessionId, userId, totalAmount, startDate, endDate, frequency = 'monthly', reminderDays = 3) {
    try {
      // Calculate payments based on frequency
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Calculate number of payments based on frequency
      const paymentInfo = this.calculatePaymentsByFrequency(start, end, frequency, totalAmount);
      const { totalPayments, paymentAmount, paymentDates, paymentAmounts } = paymentInfo;

      const planId = uuidv4();

      // Create payment plan
      const [plan] = await db.insert(paymentPlans).values({
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

      // Create individual payment records with exact amounts
      const paymentRecordsList = [];
      for (let i = 0; i < totalPayments; i++) {
        paymentRecordsList.push({
          id: uuidv4(),
          planId,
          sessionId,
          userId,
          paymentNumber: i + 1,
          dueDate: paymentDates[i],
          amount: paymentAmounts[i] // Use individual amount from array
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
    // Normalize dates to midnight to avoid time-of-day issues
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Normalize frequency (handle both 'biweekly' and 'bi-weekly')
    const normalizedFrequency = frequency.toLowerCase().replace('-', '');
    
    const paymentDates = [];
    let currentDate = new Date(start);

    // Validate inputs
    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    const totalAmountNum = parseFloat(totalAmount);
    if (isNaN(totalAmountNum) || totalAmountNum <= 0) {
      throw new Error('Total amount must be a positive number');
    }

    // For monthly payments, preserve the original desired day-of-month
    const desiredDayOfMonth = start.getDate();

    // Generate payment dates
    while (currentDate <= end) {
      paymentDates.push(new Date(currentDate));

      // Calculate next payment date based on frequency
      switch (normalizedFrequency) {
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          // For monthly, properly handle month-end dates
          // Move to next month (first set day to 1 to avoid overflow)
          currentDate.setDate(1);
          currentDate.setMonth(currentDate.getMonth() + 1);
          
          // Get the last day of this month
          const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
          
          // Set to the desired day or last day of month, whichever is smaller
          currentDate.setDate(Math.min(desiredDayOfMonth, lastDayOfMonth));
          break;
        default:
          // Default to monthly if frequency is unrecognized
          console.warn(`Unknown frequency '${frequency}', defaulting to monthly`);
          currentDate.setDate(1);
          currentDate.setMonth(currentDate.getMonth() + 1);
          const defaultLastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
          currentDate.setDate(Math.min(desiredDayOfMonth, defaultLastDay));
      }
    }

    const totalPayments = paymentDates.length;
    
    // Ensure at least one payment
    if (totalPayments === 0) {
      throw new Error('Payment plan must have at least one payment');
    }

    // Calculate base payment amount (rounded down to 2 decimals)
    const basePaymentAmount = Math.floor((totalAmountNum / totalPayments) * 100) / 100;
    
    // Calculate what the last payment should be to make the total exact
    const sumOfBasePayments = basePaymentAmount * (totalPayments - 1);
    const lastPaymentAmount = Math.round((totalAmountNum - sumOfBasePayments) * 100) / 100;

    // Create payment amounts array
    const paymentAmounts = [];
    for (let i = 0; i < totalPayments - 1; i++) {
      paymentAmounts.push(basePaymentAmount.toFixed(2));
    }
    paymentAmounts.push(lastPaymentAmount.toFixed(2));

    // Validate that all payments sum to total (account for floating point precision)
    const calculatedTotal = paymentAmounts.reduce((sum, amt) => sum + parseFloat(amt), 0);
    const difference = Math.abs(calculatedTotal - totalAmountNum);
    
    if (difference > 0.01) {
      console.error(`Payment calculation error: Total ${totalAmountNum} vs Calculated ${calculatedTotal}`);
      throw new Error('Payment amounts do not sum to total amount');
    }

    // For backward compatibility, return single paymentAmount (most common amount)
    // Frontend/display logic can use the paymentAmounts array for detailed breakdown
    const paymentAmount = basePaymentAmount.toFixed(2);

    console.log(`Payment calculation: ${totalPayments} payments, base $${basePaymentAmount}, last payment $${lastPaymentAmount}`);

    return {
      totalPayments,
      paymentAmount, // Base payment amount for backward compatibility
      paymentDates,
      paymentAmounts, // Array of exact payment amounts
      lastPaymentAmount: lastPaymentAmount.toFixed(2)
    };
  }

  // Calculate months between two dates (legacy method)
  calculateMonthsBetween(start, end) {
    const months = (end.getFullYear() - start.getFullYear()) * 12 +
                  (end.getMonth() - start.getMonth());
    return Math.max(1, months); // Minimum 1 month
  }

  // Get payment plan for a session with authorization check
  async getPaymentPlan(sessionId, userId) {
    try {
      // Verify ownership: select plan only if it belongs to the requesting user
      const [plan] = await db.select()
        .from(paymentPlans)
        .where(and(
          eq(paymentPlans.sessionId, sessionId),
          eq(paymentPlans.userId, userId)
        ));

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

  // Delete payment plan
  async deletePaymentPlan(planId, userId) {
    try {
      // First, verify the plan exists and belongs to the user
      const [plan] = await db.select()
        .from(paymentPlans)
        .where(and(
          eq(paymentPlans.id, planId),
          eq(paymentPlans.userId, userId)
        ));

      if (!plan) {
        return {
          success: false,
          error: 'Payment plan not found or unauthorized'
        };
      }

      const sessionId = plan.sessionId;

      // Delete all payment records associated with this plan
      await db.delete(paymentRecords)
        .where(eq(paymentRecords.planId, planId));

      console.log(`✅ Deleted payment records for plan ${planId}`);

      // Delete the payment plan
      await db.delete(paymentPlans)
        .where(eq(paymentPlans.id, planId));

      console.log(`✅ Deleted payment plan ${planId}`);

      // Update the session to remove payment plan references
      await db.update(photographySessions)
        .set({
          hasPaymentPlan: false,
          paymentPlanId: null,
          totalAmount: null,
          paymentPlanStartDate: null,
          paymentPlanEndDate: null,
          monthlyPayment: null,
          paymentsRemaining: 0,
          nextPaymentDate: null
        })
        .where(eq(photographySessions.id, sessionId));

      console.log(`✅ Updated session ${sessionId} to remove payment plan`);

      return {
        success: true,
        sessionId
      };

    } catch (error) {
      console.error('Error deleting payment plan:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete payment plan'
      };
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
        
        const [session] = await db.select()
          .from(photographySessions)
          .where(eq(photographySessions.id, payment.sessionId));
        
        if (session) {
          await createNotification(
            payment.userId,
            'payment_received',
            'Payment Received',
            `Payment of $${parseFloat(payment.amount).toFixed(2)} received from ${session.clientName}`,
            {
              sessionId: payment.sessionId,
              paymentId: payment.id,
              amount: payment.amount,
              clientName: session.clientName
            }
          );
        }
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

      // Get photographer's business information
      const [photographer] = await db.select()
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

      // Create Stripe invoice - use platform Stripe for admin, Stripe Connect for photographers
      let stripeInvoice = null;
      let invoiceSuccessfullySent = false;
      const isAdmin = this.isAdminAccount(photographer.email);

      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 50) {
        try {
          let customer;
          let stripeAccountId = null;

          if (isAdmin) {
            // Admin account - use regular platform Stripe
            console.log(`💳 ADMIN ACCOUNT: Using platform Stripe for ${photographer.email}`);
            
            // Create customer on platform Stripe account
            const existingCustomers = await stripe.customers.list({
              email: session.email,
              limit: 1
            });

            if (existingCustomers.data.length > 0) {
              customer = existingCustomers.data[0];
              console.log(`Found existing customer: ${customer.id}`);
            } else {
              customer = await stripe.customers.create({
                email: session.email,
                name: session.clientName,
                metadata: {
                  sessionId: session.id,
                  paymentId: payment.id
                }
              });
              console.log(`Created new customer: ${customer.id}`);
            }
          } else {
            // Regular photographer - use Stripe Connect
            console.log(`🔗 PHOTOGRAPHER ACCOUNT: Using Stripe Connect for ${photographer.email}`);
            
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

            customer = customerResult.customer;
            stripeAccountId = photographer.stripeConnectAccountId;
          }

          // Create invoice - different logic for admin vs photographer
          const baseUrl = process.env.BASE_URL || 'https://photomanagementsystem.com';
          const invoiceCustomUrl = `${baseUrl}/invoice.html?payment=${payment.id}`;
          const tipAmount = parseFloat(payment.tipAmount || '0');
          let sentInvoice;

          if (isAdmin) {
            // ADMIN: Create invoice using regular platform Stripe
            console.log(`📄 Creating platform Stripe invoice for admin account`);
            
            // Create invoice items
            const invoiceItemPromises = [];
            
            // Main payment item
            invoiceItemPromises.push(
              stripe.invoiceItems.create({
                customer: customer.id,
                amount: Math.round(parseFloat(payment.amount) * 100),
                currency: 'usd',
                description: `${session.sessionType} Session - Payment ${payment.paymentNumber} of ${session.paymentsRemaining + 1}`,
                metadata: {
                  sessionId: session.id,
                  paymentId: payment.id,
                  paymentNumber: payment.paymentNumber.toString()
                }
              })
            );

            // Add optional tip if specified
            if (tipAmount > 0) {
              invoiceItemPromises.push(
                stripe.invoiceItems.create({
                  customer: customer.id,
                  amount: Math.round(tipAmount * 100),
                  currency: 'usd',
                  description: 'Optional Tip',
                  metadata: { type: 'tip' }
                })
              );
            }

            await Promise.all(invoiceItemPromises);

            // Create the invoice
            sentInvoice = await stripe.invoices.create({
              customer: customer.id,
              auto_advance: true,
              collection_method: 'send_invoice',
              days_until_due: 7,
              description: `Payment ${payment.paymentNumber} for ${session.sessionType} session`,
              footer: `Thank you for choosing ${businessName}!\n${businessAddress ? `\n${businessAddress}` : ''}\n\nYou can add an optional tip and view full invoice details at:\n${invoiceCustomUrl}\n\nContact: ${businessEmail}${businessPhone ? ` | ${businessPhone}` : ''}`,
              metadata: {
                sessionId: session.id,
                paymentId: payment.id,
                paymentNumber: payment.paymentNumber.toString(),
                photographerName: businessName,
                photographerEmail: businessEmail,
                customInvoiceUrl: invoiceCustomUrl
              }
            });

            // Finalize and send the invoice
            sentInvoice = await stripe.invoices.finalizeInvoice(sentInvoice.id);
            sentInvoice = await stripe.invoices.sendInvoice(sentInvoice.id);

          } else {
            // PHOTOGRAPHER: Create invoice using Stripe Connect
            console.log(`📄 Creating Stripe Connect invoice for photographer account`);
            
            const StripeConnectManager = require('./stripe-connect');
            const stripeConnectManager = new StripeConnectManager();

            const invoiceItems = [{
              amount: parseFloat(payment.amount),
              description: `${session.sessionType} Session - Payment ${payment.paymentNumber} of ${session.paymentsRemaining + 1}`,
              metadata: {
                sessionId: session.id,
                paymentId: payment.id,
                paymentNumber: payment.paymentNumber.toString()
              }
            }];

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
              stripeAccountId,
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

            sentInvoice = invoiceResult.invoice;
          }

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
        await db.update(paymentRecords)
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
    console.log(' Processing automated payment invoices and reminders...');

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

  // Update tip amount for a payment record
  async updateTipAmount(paymentId, tipAmount) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    let client;
    try {
      client = await pool.connect();

      await client.query(`
        UPDATE payment_records
        SET tip_amount = $1
        WHERE id = $2
      `, [tipAmount.toString(), paymentId]);

      console.log(`SUCCESS: Tip amount updated for payment ${paymentId}: $${tipAmount}`);
      return true;
    } catch (error) {
      console.error('Error updating tip amount:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
      await pool.end();
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
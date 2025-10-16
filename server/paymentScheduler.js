const cron = require('node-cron');
const PaymentPlanManager = require('./paymentPlans');

class PaymentScheduler {
  constructor() {
    this.paymentManager = new PaymentPlanManager();
    this.isRunning = false;
  }

  // Start the automated payment scheduler
  start() {
    if (this.isRunning) {
      console.log(' Payment scheduler already running');
      return;
    }

    console.log('Starting Starting automated payment scheduler...');

    // Run daily at 9:00 AM to process payments and send invoices
    cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Daily payment processing started at', new Date().toLocaleString());
      try {
        const results = await this.paymentManager.processAutomatedPayments();
        console.log(' Daily payment processing results:', results);
      } catch (error) {
        console.error('❌ Error in daily payment processing:', error);
      }
    });

    // Run weekly on Mondays at 8:00 AM for comprehensive review
    cron.schedule('0 8 * * 1', async () => {
      console.log('Schedule: Weekly payment plan review started at', new Date().toLocaleString());
      try {
        await this.weeklyPaymentReview();
      } catch (error) {
        console.error('❌ Error in weekly payment review:', error);
      }
    });

    // Run every 4 hours during business hours for urgent payments
    cron.schedule('0 9,13,17 * * *', async () => {
      console.log(' Business hours payment check at', new Date().toLocaleString());
      try {
        const overduePayments = await this.paymentManager.getOverduePayments();
        if (overduePayments.length > 0) {
          console.log(`WARNING: Found ${overduePayments.length} overdue payments - processing urgently`);
          await this.paymentManager.processAutomatedPayments();
        }
      } catch (error) {
        console.error('❌ Error in business hours payment check:', error);
      }
    });

    // Manual trigger for immediate processing (for testing)
    this.manualTrigger = async () => {
      console.log(' Manual payment processing triggered');
      try {
        const results = await this.paymentManager.processAutomatedPayments();
        console.log('SUCCESS: Manual processing completed:', results);
        return results;
      } catch (error) {
        console.error('❌ Manual processing failed:', error);
        throw error;
      }
    };

    this.isRunning = true;
    console.log('SUCCESS: Payment scheduler started successfully');
    console.log('Schedule: Schedules active:');
    console.log('   • Daily at 9:00 AM - Invoice processing');
    console.log('   • Weekly on Mondays at 8:00 AM - Comprehensive review');
    console.log('   • Every 4 hours (9 AM, 1 PM, 5 PM) - Overdue payment checks');
  }

  // Weekly comprehensive payment plan review
  async weeklyPaymentReview() {
    console.log(' Starting weekly payment plan review...');
    
    try {
      const { db } = require('./db');
      const { paymentPlans, paymentRecords } = require('../shared/schema');
      const { eq, and } = require('drizzle-orm');

      // Get all active payment plans
      const activePlans = await db.select()
        .from(paymentPlans)
        .where(eq(paymentPlans.status, 'active'));

      console.log(` Reviewing ${activePlans.length} active payment plans`);

      let plansUpdated = 0;
      let invoicesSent = 0;
      let remindersScheduled = 0;

      for (const plan of activePlans) {
        try {
          // Check if plan should be completed
          const remainingPayments = await db.select()
            .from(paymentRecords)
            .where(and(
              eq(paymentRecords.planId, plan.id),
              eq(paymentRecords.status, 'pending')
            ));

          if (remainingPayments.length === 0) {
            // Mark plan as completed
            await db.update(paymentPlans)
              .set({ status: 'completed' })
              .where(eq(paymentPlans.id, plan.id));
            plansUpdated++;
            console.log(`SUCCESS: Plan ${plan.id} marked as completed`);
            continue;
          }

          // Send invoices for payments due this week
          const weekFromNow = new Date();
          weekFromNow.setDate(weekFromNow.getDate() + 7);

          const upcomingPayments = remainingPayments.filter(payment => 
            new Date(payment.dueDate) <= weekFromNow && !payment.invoiceSent
          );

          for (const payment of upcomingPayments) {
            await this.paymentManager.sendPaymentInvoice(payment.id);
            invoicesSent++;
          }

          // Schedule reminders for next week's payments
          const nextWeekPayments = remainingPayments.filter(payment => {
            const paymentDate = new Date(payment.dueDate);
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const weekAfter = new Date();
            weekAfter.setDate(weekAfter.getDate() + 14);
            return paymentDate >= nextWeek && paymentDate <= weekAfter && !payment.reminderSent;
          });

          remindersScheduled += nextWeekPayments.length;

        } catch (planError) {
          console.error(`❌ Error reviewing plan ${plan.id}:`, planError.message);
        }
      }

      console.log(' Weekly review completed:', {
        plansReviewed: activePlans.length,
        plansUpdated,
        invoicesSent,
        remindersScheduled
      });

    } catch (error) {
      console.error('❌ Error in weekly payment review:', error);
      throw error;
    }
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log(' Payment scheduler not running');
      return;
    }

    // Note: node-cron doesn't provide a direct way to stop all tasks
    // In a production environment, you'd want to keep references to each task
    console.log('🛑 Payment scheduler stopped');
    this.isRunning = false;
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedules: {
        daily: 'Daily at 9:00 AM - Invoice processing',
        weekly: 'Weekly on Mondays at 8:00 AM - Comprehensive review',
        businessHours: 'Every 4 hours (9 AM, 1 PM, 5 PM) - Overdue payment checks'
      },
      lastRun: new Date().toLocaleString()
    };
  }
}

module.exports = PaymentScheduler;
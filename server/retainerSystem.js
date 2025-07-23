const express = require('express');
const Stripe = require('stripe');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

class RetainerSystem {
  // Calculate remaining balance after retainer
  calculateRemainingBalance(totalPrice, retainerAmount) {
    const total = parseFloat(totalPrice);
    const retainer = parseFloat(retainerAmount);
    return Math.max(0, total - retainer);
  }

  // Create and send retainer invoice
  async createRetainerInvoice(sessionId, retainerAmount, getSessionById, updateSession) {
    try {
      const session = await getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Create Stripe customer if needed
      const customer = await stripe.customers.create({
        name: session.clientName,
        email: session.email,
        metadata: {
          sessionId: sessionId,
          photographer: 'Lance - The Legacy Photography',
          businessEmail: 'lance@thelegacyphotography.com'
        }
      });

      // Create retainer invoice
      const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: 30,
        description: `Photography Session Retainer - ${session.sessionType}`,
        metadata: {
          sessionId: sessionId,
          invoiceType: 'retainer',
          photographer: 'Lance - The Legacy Photography',
          sessionType: session.sessionType,
          sessionDate: session.dateTime,
          location: session.location
        },
        custom_fields: [
          {
            name: 'Photographer',
            value: 'Lance - The Legacy Photography'
          },
          {
            name: 'Session Type',
            value: session.sessionType
          },
          {
            name: 'Session Date',
            value: new Date(session.dateTime).toLocaleDateString()
          }
        ],
        footer: 'Thank you for choosing The Legacy Photography! For questions, contact lance@thelegacyphotography.com'
      });

      // Add retainer fee as invoice item
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: Math.round(parseFloat(retainerAmount) * 100), // Convert to cents
        currency: 'usd',
        description: `Retainer Fee - ${session.sessionType} Session`,
        metadata: {
          sessionId: sessionId,
          itemType: 'retainer'
        }
      });

      // Finalize and send the invoice
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      await stripe.invoices.sendInvoice(finalizedInvoice.id);

      // Calculate remaining balance
      const remainingBalance = this.calculateRemainingBalance(session.price, retainerAmount);

      // Update session with retainer information
      await updateSession(sessionId, {
        retainerAmount: retainerAmount,
        retainerStripeInvoiceId: finalizedInvoice.id,
        retainerStripeInvoiceUrl: finalizedInvoice.hosted_invoice_url,
        remainingBalance: remainingBalance.toString()
      });

      return {
        success: true,
        invoiceId: finalizedInvoice.id,
        invoiceUrl: finalizedInvoice.hosted_invoice_url,
        retainerAmount: retainerAmount,
        remainingBalance: remainingBalance,
        message: `Retainer invoice sent to ${session.email}`
      };

    } catch (error) {
      console.error('Retainer invoice creation error:', error);
      throw new Error(`Failed to create retainer invoice: ${error.message}`);
    }
  }

  // Mark retainer as paid
  async markRetainerPaid(sessionId, getSessionById, updateSession, paymentDate = null) {
    try {
      const session = await getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      await updateSession(sessionId, {
        retainerPaid: true,
        retainerPaidDate: paymentDate || new Date()
      });

      return {
        success: true,
        message: 'Retainer marked as paid'
      };
    } catch (error) {
      console.error('Mark retainer paid error:', error);
      throw new Error(`Failed to mark retainer as paid: ${error.message}`);
    }
  }

  // Create final balance invoice (after retainer is paid)
  async createFinalBalanceInvoice(sessionId, getSessionById, updateSession) {
    try {
      const session = await getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.retainerPaid) {
        throw new Error('Retainer must be paid before creating final balance invoice');
      }

      const remainingBalance = parseFloat(session.remainingBalance || 0);
      if (remainingBalance <= 0) {
        throw new Error('No remaining balance to invoice');
      }

      // Create customer (or find existing)
      const customer = await stripe.customers.create({
        name: session.clientName,
        email: session.email,
        metadata: {
          sessionId: sessionId,
          photographer: 'Lance - The Legacy Photography'
        }
      });

      // Create final balance invoice
      const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: 15,
        description: `Photography Session Final Balance - ${session.sessionType}`,
        metadata: {
          sessionId: sessionId,
          invoiceType: 'final_balance',
          photographer: 'Lance - The Legacy Photography'
        },
        custom_fields: [
          {
            name: 'Photographer',
            value: 'Lance - The Legacy Photography'
          },
          {
            name: 'Session Type',
            value: session.sessionType
          },
          {
            name: 'Retainer Paid',
            value: `$${session.retainerAmount}`
          }
        ],
        footer: 'Thank you for choosing The Legacy Photography! Final payment due before session delivery.'
      });

      // Add final balance as invoice item
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: Math.round(remainingBalance * 100), // Convert to cents
        currency: 'usd',
        description: `Final Balance - ${session.sessionType} Session (Total: $${session.price}, Retainer: $${session.retainerAmount})`,
        metadata: {
          sessionId: sessionId,
          itemType: 'final_balance'
        }
      });

      // Finalize and send the invoice
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      await stripe.invoices.sendInvoice(finalizedInvoice.id);

      // Update session with final balance invoice info
      await updateSession(sessionId, {
        stripeInvoice: JSON.stringify({
          invoiceId: finalizedInvoice.id,
          invoiceUrl: finalizedInvoice.hosted_invoice_url,
          type: 'final_balance',
          amount: remainingBalance
        })
      });

      return {
        success: true,
        invoiceId: finalizedInvoice.id,
        invoiceUrl: finalizedInvoice.hosted_invoice_url,
        finalBalance: remainingBalance,
        message: `Final balance invoice sent to ${session.email}`
      };

    } catch (error) {
      console.error('Final balance invoice creation error:', error);
      throw new Error(`Failed to create final balance invoice: ${error.message}`);
    }
  }

  // Get retainer status for a session
  async getRetainerStatus(sessionId, getSessionById) {
    try {
      const session = await getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      return {
        success: true,
        sessionId: sessionId,
        totalAmount: parseFloat(session.price || 0),
        retainerAmount: parseFloat(session.retainerAmount || 0),
        retainerPaid: session.retainerPaid || false,
        retainerPaidDate: session.retainerPaidDate,
        remainingBalance: parseFloat(session.remainingBalance || session.price || 0),
        retainerInvoiceUrl: session.retainerStripeInvoiceUrl,
        hasRetainer: !!session.retainerAmount
      };
    } catch (error) {
      console.error('Get retainer status error:', error);
      throw new Error(`Failed to get retainer status: ${error.message}`);
    }
  }
}

// Export the RetainerSystem class
module.exports = { RetainerSystem };
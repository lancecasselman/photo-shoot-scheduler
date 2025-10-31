/**
 * Installment Plan Schema
 * Defines data models for Firestore collections
 */

export interface InstallmentPlan {
  id: string;
  sessionId: string;
  photographerId: string;
  customerEmail: string;
  
  // Financial details
  totalAmount: number;
  perInstallmentAmount: number;
  platformFeeBps: number;
  platformFeePerPayment: number;
  
  // Schedule details
  cadence: 'biweekly' | 'monthly';
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  numberOfPayments: number;
  
  // Stripe IDs
  stripeCustomerId: string;
  stripeSubscriptionScheduleId: string;
  stripeConnectedAccountId: string;
  
  // Status tracking
  status: 'active' | 'completed' | 'canceled' | 'failed';
  createdAt: string;
  updatedAt: string;
  canceledAt?: string;
  cancelReason?: string;
}

export interface InstallmentPayment {
  id: string;
  planId: string;
  
  // Payment details
  paymentNumber: number;
  amount: number;
  platformFee: number;
  photographerPayout: number;
  
  // Stripe IDs
  stripeInvoiceId: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  
  // Schedule
  dueDate: string; // ISO 8601
  paidAt?: string; // ISO 8601
  
  // Status
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  failureReason?: string;
  retryAttempts: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPreview {
  totalAmount: number;
  numberOfPayments: number;
  perInstallmentAmount: number;
  platformFee: number;
  platformFeePerPayment: number;
  photographerReceivesTotal: number;
  photographerReceivesPerPayment: number;
  cadence: 'biweekly' | 'monthly';
  startDate: string;
  endDate: string;
  paymentSchedule: Array<{
    paymentNumber: number;
    dueDate: string;
    amount: number;
    platformFee: number;
    photographerPayout: number;
  }>;
}

export interface CreateInstallmentPlanRequest {
  sessionId: string;
  photographerId: string;
  stripeConnectedAccountId: string;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
  cadence: 'biweekly' | 'monthly';
  startDate: string; // ISO 8601
  numberOfPayments: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  createdAt: string;
  processed: boolean;
  processedAt?: string;
  error?: string;
}

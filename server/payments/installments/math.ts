/**
 * Installment Payment Math
 * Calculates payment schedules, amounts, and fees
 */

import { InstallmentPreview } from './schema';

/**
 * Calculate payment schedule for bi-weekly or monthly installments
 */
export function calculatePaymentSchedule(
  totalAmount: number,
  cadence: 'biweekly' | 'monthly',
  startDate: string,
  numberOfPayments: number,
  platformFeeBps: number
): InstallmentPreview {
  if (totalAmount <= 0) {
    throw new Error('Total amount must be positive');
  }
  
  if (numberOfPayments < 2) {
    throw new Error('Number of payments must be at least 2');
  }
  
  if (platformFeeBps < 0 || platformFeeBps > 10000) {
    throw new Error('Platform fee must be between 0 and 10000 basis points');
  }

  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }

  // Calculate total platform fee
  const totalPlatformFee = Math.round((totalAmount * platformFeeBps) / 10000);
  
  // Calculate base payment amount per installment (in cents)
  const basePaymentAmount = Math.floor(totalAmount / numberOfPayments);
  
  // Calculate what the last payment should be to reach exact total
  const sumOfBasePayments = basePaymentAmount * (numberOfPayments - 1);
  const lastPaymentAmount = totalAmount - sumOfBasePayments;
  
  // Calculate platform fee per payment
  const basePlatformFee = Math.floor(totalPlatformFee / numberOfPayments);
  const sumOfBaseFees = basePlatformFee * (numberOfPayments - 1);
  const lastPlatformFee = totalPlatformFee - sumOfBaseFees;

  // Generate payment schedule
  const paymentSchedule: Array<{
    paymentNumber: number;
    dueDate: string;
    amount: number;
    platformFee: number;
    photographerPayout: number;
  }> = [];
  let currentDate = new Date(start);

  for (let i = 1; i <= numberOfPayments; i++) {
    const isLastPayment = i === numberOfPayments;
    const amount = isLastPayment ? lastPaymentAmount : basePaymentAmount;
    const platformFee = isLastPayment ? lastPlatformFee : basePlatformFee;
    const photographerPayout = amount - platformFee;

    paymentSchedule.push({
      paymentNumber: i,
      dueDate: currentDate.toISOString(),
      amount,
      platformFee,
      photographerPayout
    });

    // Calculate next payment date
    if (i < numberOfPayments) {
      if (cadence === 'biweekly') {
        currentDate = addDays(currentDate, 14);
      } else {
        currentDate = addMonths(currentDate, 1);
      }
    }
  }

  // Verify totals
  const calculatedTotal = paymentSchedule.reduce((sum, p) => sum + p.amount, 0);
  const calculatedFees = paymentSchedule.reduce((sum, p) => sum + p.platformFee, 0);
  
  if (calculatedTotal !== totalAmount) {
    throw new Error(`Payment calculation error: ${calculatedTotal} !== ${totalAmount}`);
  }
  
  if (calculatedFees !== totalPlatformFee) {
    throw new Error(`Fee calculation error: ${calculatedFees} !== ${totalPlatformFee}`);
  }

  const lastPayment = paymentSchedule[paymentSchedule.length - 1];
  
  return {
    totalAmount,
    numberOfPayments,
    perInstallmentAmount: basePaymentAmount,
    platformFee: totalPlatformFee,
    platformFeePerPayment: basePlatformFee,
    photographerReceivesTotal: totalAmount - totalPlatformFee,
    photographerReceivesPerPayment: basePaymentAmount - basePlatformFee,
    cadence,
    startDate: start.toISOString(),
    endDate: lastPayment.dueDate,
    paymentSchedule
  };
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date, preserving day of month when possible
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const desiredDay = date.getDate();
  
  // Move to first of month to avoid overflow issues
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  
  // Get last day of target month
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  
  // Set to desired day or last day of month, whichever is smaller
  result.setDate(Math.min(desiredDay, lastDayOfMonth));
  
  return result;
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Installment Payment Math
 * Calculates payment schedules, amounts, and fees
 */

/**
 * Calculate payment schedule for bi-weekly or monthly installments
 */
function calculatePaymentSchedule(
  totalAmount,
  cadence,
  startDate,
  numberOfPayments,
  platformFeeBps
) {
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

  const totalPlatformFee = Math.round((totalAmount * platformFeeBps) / 10000);
  
  const basePaymentAmount = Math.floor(totalAmount / numberOfPayments);
  
  const sumOfBasePayments = basePaymentAmount * (numberOfPayments - 1);
  const lastPaymentAmount = totalAmount - sumOfBasePayments;
  
  const basePlatformFee = Math.floor(totalPlatformFee / numberOfPayments);
  const sumOfBaseFees = basePlatformFee * (numberOfPayments - 1);
  const lastPlatformFee = totalPlatformFee - sumOfBaseFees;

  const paymentSchedule = [];
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

    if (i < numberOfPayments) {
      if (cadence === 'biweekly') {
        currentDate = addDays(currentDate, 14);
      } else {
        currentDate = addMonths(currentDate, 1);
      }
    }
  }

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
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date, preserving day of month when possible
 */
function addMonths(date, months) {
  const result = new Date(date);
  const desiredDay = date.getDate();
  
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  
  result.setDate(Math.min(desiredDay, lastDayOfMonth));
  
  return result;
}

/**
 * Convert dollars to cents
 */
function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
function centsToDollars(cents) {
  return cents / 100;
}

module.exports = {
  calculatePaymentSchedule,
  dollarsToCents,
  centsToDollars
};

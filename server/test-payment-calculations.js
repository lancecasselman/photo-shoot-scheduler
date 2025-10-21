const PaymentPlanManager = require('./paymentPlans');

const manager = new PaymentPlanManager();

console.log('=== Testing Payment Plan Calculations ===\n');

const testCases = [
  {
    name: 'Monthly - $100 over 3 months',
    startDate: '2025-01-01',
    endDate: '2025-03-01',
    frequency: 'monthly',
    totalAmount: 100
  },
  {
    name: 'Weekly - $100 over 4 weeks',
    startDate: '2025-01-01',
    endDate: '2025-01-28',
    frequency: 'weekly',
    totalAmount: 100
  },
  {
    name: 'Bi-weekly - $500 over 2 months',
    startDate: '2025-01-01',
    endDate: '2025-02-28',
    frequency: 'bi-weekly',
    totalAmount: 500
  },
  {
    name: 'Monthly - $1234.56 over 12 months',
    startDate: '2025-01-01',
    endDate: '2025-12-01',
    frequency: 'monthly',
    totalAmount: 1234.56
  },
  {
    name: 'Weekly - $999.99 over 10 weeks',
    startDate: '2025-01-01',
    endDate: '2025-03-10',
    frequency: 'weekly',
    totalAmount: 999.99
  },
  {
    name: 'Bi-weekly (no hyphen) - $750 over 6 weeks',
    startDate: '2025-01-01',
    endDate: '2025-02-14',
    frequency: 'biweekly',
    totalAmount: 750
  },
  {
    name: 'Monthly - Month-end edge case (Jan 31 start)',
    startDate: '2025-01-31',
    endDate: '2025-04-30',
    frequency: 'monthly',
    totalAmount: 600,
    expectedDates: ['2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30']
  },
  {
    name: 'Monthly - Month-end edge case (Jan 30 start)',
    startDate: '2025-01-30',
    endDate: '2025-04-30',
    frequency: 'monthly',
    totalAmount: 400,
    expectedDates: ['2025-01-30', '2025-02-28', '2025-03-30', '2025-04-30']
  },
  {
    name: 'Monthly - Leap year edge case (Jan 29 in leap year)',
    startDate: '2024-01-29',
    endDate: '2024-04-29',
    frequency: 'monthly',
    totalAmount: 800,
    expectedDates: ['2024-01-29', '2024-02-29', '2024-03-29', '2024-04-29']
  },
  {
    name: 'Monthly - End of month alignment (May 31 start)',
    startDate: '2025-05-31',
    endDate: '2025-08-31',
    frequency: 'monthly',
    totalAmount: 450,
    expectedDates: ['2025-05-31', '2025-06-30', '2025-07-31', '2025-08-31']
  }
];

function runTests() {
  let allPassed = true;

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test ${index + 1}: ${testCase.name} ---`);
    
    try {
      const result = manager.calculatePaymentsByFrequency(
        testCase.startDate,
        testCase.endDate,
        testCase.frequency,
        testCase.totalAmount
      );

      console.log(`Total Payments: ${result.totalPayments}`);
      console.log(`Base Payment: $${result.paymentAmount}`);
      console.log(`Last Payment: $${result.lastPaymentAmount}`);
      
      console.log('\nPayment Schedule:');
      result.paymentDates.forEach((date, i) => {
        const amount = result.paymentAmounts[i];
        console.log(`  Payment ${i + 1}: ${date.toLocaleDateString()} - $${amount}`);
      });

      const calculatedTotal = result.paymentAmounts.reduce((sum, amt) => sum + parseFloat(amt), 0);
      const difference = Math.abs(calculatedTotal - testCase.totalAmount);
      
      console.log(`\nCalculated Total: $${calculatedTotal.toFixed(2)}`);
      console.log(`Expected Total: $${testCase.totalAmount.toFixed(2)}`);
      console.log(`Difference: $${difference.toFixed(4)}`);
      
      let passed = true;
      
      if (difference > 0.01) {
        console.log('❌ FAILED: Total mismatch!');
        passed = false;
      }
      
      // Check expected dates if provided
      if (testCase.expectedDates && testCase.expectedDates.length > 0) {
        console.log('\nValidating expected dates:');
        testCase.expectedDates.forEach((expectedDateStr, i) => {
          const actualDate = result.paymentDates[i];
          const expectedDate = new Date(expectedDateStr);
          
          // Compare dates (normalize to same format)
          const actualStr = actualDate.toISOString().split('T')[0];
          const expectedStr = expectedDate.toISOString().split('T')[0];
          
          if (actualStr !== expectedStr) {
            console.log(`  ❌ Payment ${i + 1}: Expected ${expectedStr}, got ${actualStr}`);
            passed = false;
          } else {
            console.log(`  ✅ Payment ${i + 1}: ${expectedStr}`);
          }
        });
      }
      
      if (passed) {
        console.log('\n✅ PASSED');
      } else {
        allPassed = false;
      }

    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      allPassed = false;
    }
  });

  console.log('\n\n=== Test Summary ===');
  if (allPassed) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed!');
  }
  
  return allPassed;
}

const success = runTests();
process.exit(success ? 0 : 1);

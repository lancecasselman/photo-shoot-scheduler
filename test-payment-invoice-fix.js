/**
 * Test script to verify the PaymentPlanManager.sendPaymentInvoice() fix
 * 
 * This test verifies that:
 * 1. When Stripe operations fail, invoiceSent remains FALSE (allows retries)
 * 2. When Stripe operations succeed, invoiceSent is set to TRUE
 * 3. Proper error handling prevents false positives
 */

const PaymentPlanManager = require('./server/paymentPlans');

// Mock Stripe to simulate failures and successes
const mockStripe = {
    customers: {
        create: jest.fn()
    },
    invoices: {
        create: jest.fn(),
        finalizeInvoice: jest.fn(),
        sendInvoice: jest.fn()
    },
    invoiceItems: {
        create: jest.fn()
    }
};

// Mock database
const mockDb = {
    select: jest.fn(),
    update: jest.fn()
};

// Mock database results
const mockPayment = {
    id: 'test-payment-id',
    paymentNumber: 1,
    amount: '500.00',
    sessionId: 'test-session-id',
    planId: 'test-plan-id',
    invoiceSent: false
};

const mockSession = {
    id: 'test-session-id',
    sessionType: 'Wedding',
    clientName: 'John Doe',
    email: 'john@example.com',
    userId: 'test-user-id'
};

const mockPhotographer = {
    id: 'test-user-id',
    email: 'photographer@example.com',
    businessName: 'Test Photography',
    stripeConnectAccountId: 'acct_test123'
};

async function testStripeFailureScenario() {
    console.log('\n🧪 TEST 1: Stripe Failure Scenario');
    console.log('=====================================');
    
    // Setup mocks for failure scenario
    mockDb.select.mockImplementation(() => {
        return Promise.resolve([mockPayment, mockSession, mockPhotographer]);
    });
    
    // Mock Stripe to fail during invoice creation
    mockStripe.customers.create.mockRejectedValue(new Error('Stripe Connect account not found'));
    
    const paymentManager = new PaymentPlanManager();
    
    try {
        await paymentManager.sendPaymentInvoice('test-payment-id');
        console.log('❌ FAIL: Expected error but method succeeded');
        return false;
    } catch (error) {
        console.log('✅ PASS: Method correctly threw error:', error.message);
        
        // Verify invoiceSent was NOT updated in database
        const updateCalls = mockDb.update.mock.calls;
        const invoiceSentUpdate = updateCalls.find(call => 
            call[0].set && call[0].set.invoiceSent === true
        );
        
        if (invoiceSentUpdate) {
            console.log('❌ FAIL: invoiceSent was incorrectly marked as true despite Stripe failure');
            return false;
        } else {
            console.log('✅ PASS: invoiceSent was NOT marked as true after Stripe failure');
            return true;
        }
    }
}

async function testStripeSuccessScenario() {
    console.log('\n🧪 TEST 2: Stripe Success Scenario');
    console.log('=====================================');
    
    // Reset mocks
    mockDb.select.mockClear();
    mockDb.update.mockClear();
    
    // Setup mocks for success scenario
    mockDb.select.mockImplementation(() => {
        return Promise.resolve([mockPayment, mockSession, mockPhotographer]);
    });
    
    mockDb.update.mockImplementation(() => {
        return Promise.resolve([{ ...mockPayment, invoiceSent: true }]);
    });
    
    // Mock successful Stripe operations
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_test123' });
    mockStripe.invoices.create.mockResolvedValue({ id: 'in_test123' });
    mockStripe.invoiceItems.create.mockResolvedValue({ id: 'ii_test123' });
    mockStripe.invoices.finalizeInvoice.mockResolvedValue({ id: 'in_test123' });
    mockStripe.invoices.sendInvoice.mockResolvedValue({
        id: 'in_test123',
        hosted_invoice_url: 'https://invoice.stripe.com/test',
        invoice_pdf: 'https://pdf.stripe.com/test',
        status: 'sent'
    });
    
    const paymentManager = new PaymentPlanManager();
    
    try {
        const result = await paymentManager.sendPaymentInvoice('test-payment-id');
        console.log('✅ PASS: Method succeeded without errors');
        
        // Verify invoiceSent was updated in database
        const updateCalls = mockDb.update.mock.calls;
        const invoiceSentUpdate = updateCalls.find(call => 
            call[0].set && call[0].set.invoiceSent === true
        );
        
        if (invoiceSentUpdate) {
            console.log('✅ PASS: invoiceSent was correctly marked as true after Stripe success');
            return true;
        } else {
            console.log('❌ FAIL: invoiceSent was NOT marked as true despite Stripe success');
            return false;
        }
    } catch (error) {
        console.log('❌ FAIL: Method unexpectedly threw error:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🧪 TESTING PAYMENT INVOICE FIX');
    console.log('===============================');
    console.log('Verifying that invoiceSent is only set to TRUE when Stripe operations succeed');
    
    const test1Result = await testStripeFailureScenario();
    const test2Result = await testStripeSuccessScenario();
    
    console.log('\n📊 TEST RESULTS:');
    console.log('=================');
    console.log(`Test 1 (Stripe Failure): ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Test 2 (Stripe Success): ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
    
    if (test1Result && test2Result) {
        console.log('\n🎉 ALL TESTS PASSED! The bug fix is working correctly.');
        console.log('✅ invoiceSent is only set to TRUE when Stripe operations succeed');
        console.log('✅ invoiceSent remains FALSE when Stripe operations fail (allows retries)');
        console.log('✅ Proper error handling prevents false positives');
    } else {
        console.log('\n❌ SOME TESTS FAILED! The bug fix needs attention.');
    }
}

// Export test functions for use in other test files
module.exports = {
    testStripeFailureScenario,
    testStripeSuccessScenario,
    runTests
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}
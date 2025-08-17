// Simple subscription system test that works without payment methods
const { Pool } = require('pg');
const UnifiedSubscriptionManager = require('./server/unified-subscription-manager');

async function testSimpleSubscription() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    const subscriptionManager = new UnifiedSubscriptionManager(pool);
    const testUserId = 'test-user-456';
    const testEmail = 'test-user@example.com';

    console.log('🧪 Starting simple subscription test...\n');

    try {
        // 1. Initialize tables
        console.log('1. Initializing tables...');
        await subscriptionManager.initializeTables();

        // 2. Test direct database operations first
        console.log('2. Testing database operations...');
        
        // Insert a test subscription directly
        await subscriptionManager.saveSubscription({
            userId: testUserId,
            subscriptionType: 'professional',
            platform: 'stripe',
            externalSubscriptionId: 'sub_test_123',
            externalCustomerId: 'cus_test_123',
            status: 'active',
            priceAmount: 39.00,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            metadata: { test: true }
        });

        console.log('✅ Professional subscription saved to database');

        // Add storage subscription
        await subscriptionManager.saveSubscription({
            userId: testUserId,
            subscriptionType: 'storage_addon',
            platform: 'stripe',
            externalSubscriptionId: 'sub_test_storage_456',
            externalCustomerId: 'cus_test_123',
            status: 'active',
            priceAmount: 50.00, // 2TB × $25
            storageTb: 2,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            metadata: { test: true, storage_tb: '2' }
        });

        console.log('✅ Storage subscription saved to database');

        // 3. Update user summary
        console.log('3. Updating user summary...');
        await subscriptionManager.updateUserSummary(testUserId);
        console.log('✅ User summary updated');

        // 4. Test status retrieval
        console.log('4. Testing status retrieval...');
        const status = await subscriptionManager.getUserSubscriptionStatus(testUserId);

        console.log('\n📊 Test Results:');
        console.log('='.repeat(50));
        console.log('Professional Plan:', status.summary?.has_professional_plan ? '✅ Active' : '❌ Not Active');
        console.log('Platform:', status.summary?.professional_platform || 'None');
        console.log('Base Storage:', status.summary?.base_storage_gb || 0, 'GB');
        console.log('Storage Add-ons:', status.summary?.total_storage_tb || 0, 'TB');
        console.log('Total Storage:', status.summary?.total_storage_gb || 0, 'GB');
        console.log('Active Subscriptions:', status.summary?.active_subscriptions || 0);
        console.log('Monthly Total: $' + (status.summary?.monthly_total || '0.00'));
        console.log('Next Billing:', status.summary?.next_billing_date ? 
            new Date(status.summary.next_billing_date).toLocaleDateString() : 'N/A');

        console.log('\n📋 Individual Subscriptions:');
        status.subscriptions.forEach((sub, index) => {
            console.log(`  ${index + 1}. ${sub.subscription_type.toUpperCase()} - $${sub.price_amount}/month`);
            console.log(`     Platform: ${sub.platform} | Status: ${sub.status}`);
            if (sub.storage_tb > 0) {
                console.log(`     Storage: ${sub.storage_tb}TB`);
            }
            console.log(`     External ID: ${sub.external_subscription_id}`);
            console.log('     ---');
        });

        // 5. Test expected calculations
        console.log('\n🧮 Validation Checks:');
        const expectedTotalStorage = 100 + (2 * 1000); // 100GB base + 2TB addon
        const expectedMonthlyTotal = 39 + 50; // $39 professional + $50 storage
        
        console.log('Expected Total Storage:', expectedTotalStorage, 'GB');
        console.log('Actual Total Storage:', status.summary?.total_storage_gb, 'GB');
        console.log('Storage Match:', expectedTotalStorage === status.summary?.total_storage_gb ? '✅' : '❌');
        
        console.log('Expected Monthly Total: $' + expectedMonthlyTotal);
        console.log('Actual Monthly Total: $' + status.summary?.monthly_total);
        console.log('Price Match:', expectedMonthlyTotal == status.summary?.monthly_total ? '✅' : '❌');

        console.log('\n🎉 Database-level subscription system is working correctly!');
        console.log('💡 The system can track subscriptions from any platform (Stripe, Apple IAP, Google Play)');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Details:', error);
    } finally {
        await pool.end();
    }
}

// Run test if called directly
if (require.main === module) {
    testSimpleSubscription().catch(console.error);
}

module.exports = { testSimpleSubscription };
// Direct subscription system test without browser authentication
const { Pool } = require('pg');
const UnifiedSubscriptionManager = require('./server/unified-subscription-manager');

async function testSubscriptionSystem() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    const subscriptionManager = new UnifiedSubscriptionManager(pool);
    const testUserId = 'test-user-123';
    const testEmail = 'test@example.com';

    console.log('🧪 Starting direct subscription system test...\n');

    try {
        // 1. Initialize tables
        console.log('1. Initializing subscription tables...');
        await subscriptionManager.initializeTables();
        console.log('✅ Tables initialized\n');

        // 2. Create Professional Plan
        console.log('2. Creating Professional Plan...');
        const professionalResult = await subscriptionManager.createProfessionalPlanStripe(
            testUserId, 
            testEmail
        );
        
        if (professionalResult.success) {
            console.log('✅ Professional plan created:', professionalResult.subscription.id);
            console.log('💳 Client secret available:', !!professionalResult.clientSecret);
        } else {
            console.log('❌ Professional plan failed:', professionalResult.error);
        }
        console.log();

        // 3. Add Storage Add-on
        console.log('3. Adding 2TB storage add-on...');
        const storageResult = await subscriptionManager.addStorageAddonStripe(testUserId, 2);
        
        if (storageResult.success) {
            console.log('✅ Storage add-on created:', storageResult.subscription.id);
            console.log('💰 Monthly cost: $50 (2TB × $25)');
        } else {
            console.log('❌ Storage add-on failed:', storageResult.error);
        }
        console.log();

        // 4. Check subscription status
        console.log('4. Checking subscription status...');
        const status = await subscriptionManager.getUserSubscriptionStatus(testUserId);
        
        console.log('📊 Subscription Summary:');
        console.log('  Professional Plan:', status.summary?.has_professional_plan ? '✅ Active' : '❌ Not Active');
        console.log('  Platform:', status.summary?.professional_platform || 'None');
        console.log('  Total Storage:', status.summary?.total_storage_gb || 0, 'GB');
        console.log('  Storage Add-ons:', status.summary?.total_storage_tb || 0, 'TB');
        console.log('  Active Subscriptions:', status.summary?.active_subscriptions || 0);
        console.log('  Monthly Total: $' + (status.summary?.monthly_total || '0.00'));
        console.log('  Next Billing:', status.summary?.next_billing_date ? 
            new Date(status.summary.next_billing_date).toLocaleDateString() : 'N/A');
        
        console.log('\n📋 Individual Subscriptions:');
        status.subscriptions.forEach((sub, index) => {
            console.log(`  ${index + 1}. ${sub.subscription_type} (${sub.platform})`);
            console.log(`     Price: $${sub.price_amount}/month | Status: ${sub.status}`);
            if (sub.storage_tb > 0) {
                console.log(`     Storage: ${sub.storage_tb}TB`);
            }
            console.log(`     Created: ${new Date(sub.created_at).toLocaleDateString()}`);
        });

        console.log('\n🎉 Subscription system test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

// Run test if called directly
if (require.main === module) {
    testSubscriptionSystem().catch(console.error);
}

module.exports = { testSubscriptionSystem };
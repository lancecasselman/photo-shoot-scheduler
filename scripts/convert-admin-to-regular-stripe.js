#!/usr/bin/env node

/**
 * Convert Admin Account from Stripe Connect to Regular Stripe Customer
 * 
 * This script converts the admin account (lancecasselman@icloud.com, ID: 44735007) 
 * from using Stripe Connect to using a regular Stripe customer for direct platform payments.
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../shared/schema');
const { eq } = require('drizzle-orm');

// Initialize Stripe with the existing secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = drizzle(pool);

// Admin account details
const ADMIN_ID = '44735007';
const ADMIN_EMAIL = 'lancecasselman@icloud.com';

async function convertAdminToRegularStripe() {
    console.log('🔄 Starting conversion of admin account to regular Stripe...');
    console.log(`   Admin ID: ${ADMIN_ID}`);
    console.log(`   Admin Email: ${ADMIN_EMAIL}`);
    
    try {
        // Step 1: Check if Stripe is configured
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY environment variable is not set');
        }
        console.log('✅ Stripe secret key is configured');

        // Step 2: Get current admin account data
        console.log('\n📋 Fetching current admin account data...');
        const currentAdmin = await db.select()
            .from(users)
            .where(eq(users.id, ADMIN_ID))
            .limit(1);

        if (currentAdmin.length === 0) {
            throw new Error(`Admin account with ID ${ADMIN_ID} not found in database`);
        }

        const adminUser = currentAdmin[0];
        console.log('✅ Current admin account found:');
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Current Stripe Customer ID: ${adminUser.stripeCustomerId || 'NULL'}`);
        console.log(`   Current Stripe Connect Account ID: ${adminUser.stripeConnectAccountId || 'NULL'}`);
        console.log(`   Current Onboarding Complete: ${adminUser.stripeOnboardingComplete}`);

        // Step 3: Create regular Stripe customer (skip if already exists)
        let stripeCustomerId = adminUser.stripeCustomerId;
        
        if (!stripeCustomerId) {
            console.log('\n💳 Creating regular Stripe customer...');
            
            const customer = await stripe.customers.create({
                email: ADMIN_EMAIL,
                name: adminUser.displayName || `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Admin User',
                description: 'Admin account - Platform direct payments',
                metadata: {
                    user_id: ADMIN_ID,
                    account_type: 'admin',
                    platform: 'photography_management_system',
                    converted_from_connect: adminUser.stripeConnectAccountId || 'none',
                    converted_at: new Date().toISOString()
                }
            });

            stripeCustomerId = customer.id;
            console.log(`✅ Regular Stripe customer created: ${stripeCustomerId}`);
        } else {
            console.log(`✅ Regular Stripe customer already exists: ${stripeCustomerId}`);
        }

        // Step 4: Update database - set customer ID, clear Connect account, set onboarding complete
        console.log('\n💾 Updating database...');
        
        const updateData = {
            stripeCustomerId: stripeCustomerId,
            stripeConnectAccountId: null, // Clear the Connect account ID
            stripeOnboardingComplete: true, // Regular Stripe doesn't need Connect onboarding
            updatedAt: new Date()
        };

        const updatedUser = await db.update(users)
            .set(updateData)
            .where(eq(users.id, ADMIN_ID))
            .returning();

        if (updatedUser.length === 0) {
            throw new Error('Failed to update admin account in database');
        }

        console.log('✅ Database updated successfully');
        console.log(`   Set stripe_customer_id: ${stripeCustomerId}`);
        console.log(`   Cleared stripe_connect_account_id: ${adminUser.stripeConnectAccountId} → NULL`);
        console.log(`   Set stripe_onboarding_complete: ${adminUser.stripeOnboardingComplete} → true`);

        // Step 5: Verify the changes
        console.log('\n🔍 Verifying changes...');
        const verifyAdmin = await db.select()
            .from(users)
            .where(eq(users.id, ADMIN_ID))
            .limit(1);

        const verifiedUser = verifyAdmin[0];
        console.log('✅ Verification complete:');
        console.log(`   Email: ${verifiedUser.email}`);
        console.log(`   Stripe Customer ID: ${verifiedUser.stripeCustomerId}`);
        console.log(`   Stripe Connect Account ID: ${verifiedUser.stripeConnectAccountId || 'NULL'}`);
        console.log(`   Onboarding Complete: ${verifiedUser.stripeOnboardingComplete}`);

        console.log('\n🎉 CONVERSION COMPLETED SUCCESSFULLY!');
        console.log('\n📋 Summary of changes:');
        console.log(`   ✅ Created regular Stripe customer: ${stripeCustomerId}`);
        console.log(`   ✅ Updated database to use regular Stripe customer`);
        console.log(`   ✅ Cleared Stripe Connect account ID: ${adminUser.stripeConnectAccountId}`);
        console.log(`   ✅ Set onboarding complete to true`);
        console.log('\n   The admin account now uses regular Stripe for direct platform payments');
        console.log('   while photographers continue using Stripe Connect accounts.');

        return {
            success: true,
            stripeCustomerId: stripeCustomerId,
            previousConnectAccountId: adminUser.stripeConnectAccountId,
            changes: updateData
        };

    } catch (error) {
        console.error('\n❌ CONVERSION FAILED:');
        console.error(`   Error: ${error.message}`);
        console.error('\n   Stack trace:');
        console.error(error.stack);
        
        return {
            success: false,
            error: error.message
        };
    } finally {
        // Close database connection
        await pool.end();
    }
}

// Run the conversion if this script is executed directly
if (require.main === module) {
    convertAdminToRegularStripe()
        .then(result => {
            if (result.success) {
                console.log('\n✅ Script completed successfully');
                process.exit(0);
            } else {
                console.log('\n❌ Script failed');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 Script crashed:', error.message);
            process.exit(1);
        });
}

module.exports = convertAdminToRegularStripe;
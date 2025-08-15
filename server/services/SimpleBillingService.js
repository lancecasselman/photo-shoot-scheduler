// Simple AI Credit Billing Service
// Manages monthly subscription billing with included credits and overage charges

const postgres = require('postgres');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const sql = postgres(process.env.DATABASE_URL);

class SimpleBillingService {
  
  // Get user's current billing summary
  async getUserUsageSummary(userId) {
    try {
      // Get current billing cycle
      const cycles = await sql`
        SELECT * FROM ai_credit_billing_cycles 
        WHERE user_id = ${userId} 
        AND cycle_start <= NOW() 
        AND cycle_end >= NOW() 
        AND status = 'active'
        ORDER BY cycle_start DESC
        LIMIT 1
      `;
      
      if (!cycles.length) {
        return null;
      }
      
      const cycle = cycles[0];
      
      // Get user's purchased credits
      const users = await sql`
        SELECT ai_credits FROM users 
        WHERE id = ${userId}
        LIMIT 1
      `;
      
      const user = users[0] || { ai_credits: 0 };
      
      // Get plan details
      const plans = await sql`
        SELECT * FROM subscription_plans 
        WHERE plan_name = ${cycle.subscription_plan}
        LIMIT 1
      `;
      
      const plan = plans[0] || {};
      
      const remainingIncluded = Math.max(0, cycle.included_credits - cycle.credits_used);
      const overageCharges = cycle.overage_credits * parseFloat(plan.overage_price_per_credit || '0.10');
      
      return {
        currentCycle: {
          start: cycle.cycle_start,
          end: cycle.cycle_end,
          plan: cycle.subscription_plan
        },
        credits: {
          included: cycle.included_credits,
          used: cycle.credits_used,
          remainingIncluded,
          purchased: user.ai_credits || 0,
          totalAvailable: remainingIncluded + (user.ai_credits || 0)
        },
        overage: {
          credits: cycle.overage_credits,
          charges: overageCharges,
          pricePerCredit: plan.overage_price_per_credit || '0.10'
        },
        billing: {
          monthlyBase: plan.monthly_price || '0.00',
          estimatedOverage: overageCharges,
          estimatedTotal: parseFloat(plan.monthly_price || '0.00') + overageCharges
        }
      };
    } catch (error) {
      console.error('Error getting user usage summary:', error);
      return null;
    }
  }

  // Check if user can use AI credits
  async canUseCredits(userId, creditsNeeded = 1) {
    try {
      const summary = await this.getUserUsageSummary(userId);
      
      if (!summary) {
        return { canUse: false, reason: 'No active billing cycle' };
      }
      
      return {
        canUse: summary.credits.totalAvailable >= creditsNeeded,
        availableCredits: summary.credits.totalAvailable,
        remainingIncluded: summary.credits.remainingIncluded,
        purchasedCredits: summary.credits.purchased,
        cycle: summary.currentCycle
      };
    } catch (error) {
      console.error('Error checking credits:', error);
      return { canUse: false, reason: 'Database error' };
    }
  }

  // Use AI credits for a request
  async useCredits(userId, requestType, prompt, creditsNeeded = 1, success = true) {
    try {
      const creditCheck = await this.canUseCredits(userId, creditsNeeded);
      
      if (!creditCheck.canUse) {
        throw new Error(`Insufficient credits: ${creditCheck.reason}`);
      }
      
      // Record the usage
      const usageId = `usage_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      await sql`
        INSERT INTO ai_credit_usage (id, user_id, request_type, credits_used, prompt, success, used_at)
        VALUES (${usageId}, ${userId}, ${requestType}, ${creditsNeeded}, ${prompt?.substring(0, 1000) || ''}, ${success}, NOW())
      `;
      
      // Update billing cycle
      const cycles = await sql`
        SELECT * FROM ai_credit_billing_cycles 
        WHERE user_id = ${userId} 
        AND cycle_start <= NOW() 
        AND cycle_end >= NOW() 
        AND status = 'active'
        LIMIT 1
      `;
      
      if (cycles.length > 0) {
        const cycle = cycles[0];
        const newCreditsUsed = cycle.credits_used + creditsNeeded;
        const newOverageCredits = Math.max(0, newCreditsUsed - cycle.included_credits);
        
        await sql`
          UPDATE ai_credit_billing_cycles 
          SET credits_used = ${newCreditsUsed}, overage_credits = ${newOverageCredits}
          WHERE id = ${cycle.id}
        `;
        
        // Update user purchased credits if using them
        if (creditsNeeded > creditCheck.remainingIncluded) {
          const purchasedCreditsToUse = creditsNeeded - creditCheck.remainingIncluded;
          await sql`
            UPDATE users 
            SET ai_credits = ai_credits - ${purchasedCreditsToUse},
                total_ai_credits_used = total_ai_credits_used + ${creditsNeeded}
            WHERE id = ${userId}
          `;
        }
      }
      
      return {
        success: true,
        creditsUsed: creditsNeeded,
        remainingCredits: creditCheck.availableCredits - creditsNeeded,
        usageId
      };
    } catch (error) {
      console.error('Error using credits:', error);
      throw error;
    }
  }

  // Create billing cycle
  async createBillingCycle(userId, subscriptionPlan) {
    try {
      const plans = await sql`
        SELECT * FROM subscription_plans 
        WHERE plan_name = ${subscriptionPlan}
        LIMIT 1
      `;
      
      if (!plans.length) {
        throw new Error(`Subscription plan ${subscriptionPlan} not found`);
      }
      
      const plan = plans[0];
      const now = new Date();
      const cycleEnd = new Date(now);
      cycleEnd.setMonth(cycleEnd.getMonth() + 1);
      
      const cycleId = `cycle_${userId}_${Date.now()}`;
      
      await sql`
        INSERT INTO ai_credit_billing_cycles (
          id, user_id, cycle_start, cycle_end, included_credits, 
          credits_used, overage_credits, overage_charges, subscription_plan, status
        ) VALUES (
          ${cycleId}, ${userId}, ${now.toISOString()}, ${cycleEnd.toISOString()}, 
          ${plan.included_ai_credits}, 0, 0, '0.00', ${subscriptionPlan}, 'active'
        )
      `;
      
      return cycleId;
    } catch (error) {
      console.error('Error creating billing cycle:', error);
      throw error;
    }
  }

  // Initialize subscription plans
  async initializeSubscriptionPlans() {
    try {
      const plans = [
        {
          id: 'plan_basic',
          plan_name: 'basic',
          monthly_price: '39.00',
          included_ai_credits: 10,
          overage_price_per_credit: '0.20',
          storage_gb: 100,
          features: JSON.stringify(['Basic website builder', '10 AI edits/month', '100GB storage']),
          stripe_price_id: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic_placeholder'
        },
        {
          id: 'plan_pro',
          plan_name: 'pro',
          monthly_price: '79.00',
          included_ai_credits: 50,
          overage_price_per_credit: '0.15',
          storage_gb: 500,
          features: JSON.stringify(['Advanced website builder', '50 AI edits/month', '500GB storage', 'Priority support']),
          stripe_price_id: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder'
        },
        {
          id: 'plan_enterprise',
          plan_name: 'enterprise',
          monthly_price: '149.00',
          included_ai_credits: 200,
          overage_price_per_credit: '0.10',
          storage_gb: 2000,
          features: JSON.stringify(['Full website builder', '200 AI edits/month', '2TB storage', 'White-label', '24/7 support']),
          stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder'
        }
      ];
      
      for (const plan of plans) {
        await sql`
          INSERT INTO subscription_plans ${sql(plan)}
          ON CONFLICT (id) DO UPDATE SET 
            monthly_price = ${plan.monthly_price},
            included_ai_credits = ${plan.included_ai_credits},
            overage_price_per_credit = ${plan.overage_price_per_credit},
            features = ${plan.features},
            updated_at = NOW()
        `;
      }
      
      console.log('Subscription plans initialized');
    } catch (error) {
      console.error('Error initializing subscription plans:', error);
      throw error;
    }
  }
}

module.exports = { 
  SimpleBillingService,
  simpleBillingService: new SimpleBillingService()
};
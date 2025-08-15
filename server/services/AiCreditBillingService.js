// AI Credit Billing Service
// Manages monthly subscription billing with included credits and overage charges

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, gte, lte, sum, desc } = require('drizzle-orm');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Initialize database connection
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
const db = drizzle(sql);

class AiCreditBillingService {
  
  // Get user's current billing cycle
  async getCurrentBillingCycle(userId) {
    const now = new Date();
    
    // Use direct SQL queries instead of Drizzle schema imports
    const cycle = await sql`
      SELECT * FROM ai_credit_billing_cycles 
      WHERE user_id = ${userId} 
      AND cycle_start <= ${now.toISOString()} 
      AND cycle_end >= ${now.toISOString()} 
      AND status = 'active'
      LIMIT 1
    `;
      
    return cycle[0] || null;
  }

  // Create new billing cycle (called at subscription start or renewal)
  async createBillingCycle(userId, subscriptionPlan) {
    const now = new Date();
    const cycleEnd = new Date(now);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    
    const plan = await sql`
      SELECT * FROM subscription_plans 
      WHERE plan_name = ${subscriptionPlan}
      LIMIT 1
    `;
      
    if (!plan[0]) {
      throw new Error(`Subscription plan ${subscriptionPlan} not found`);
    }
    
    const cycleId = `cycle_${userId}_${Date.now()}`;
    
    await sql`
      INSERT INTO ai_credit_billing_cycles (
        id, user_id, cycle_start, cycle_end, included_credits, 
        credits_used, overage_credits, overage_charges, subscription_plan, status
      ) VALUES (
        ${cycleId}, ${userId}, ${now.toISOString()}, ${cycleEnd.toISOString()}, 
        ${plan[0].included_ai_credits}, 0, 0, '0.00', ${subscriptionPlan}, 'active'
      )
    `;
    
    return cycleId;
  }

  // Check if user can use AI credits (has remaining balance)
  async canUseCredits(userId, creditsNeeded = 1) {
    const cycle = await this.getCurrentBillingCycle(userId);
    
    if (!cycle) {
      return { canUse: false, reason: 'No active billing cycle' };
    }
    
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
    if (!user[0]) {
      return { canUse: false, reason: 'User not found' };
    }
    
    // Calculate available credits
    const remainingIncluded = Math.max(0, cycle.includedCredits - cycle.creditsUsed);
    const availableCredits = remainingIncluded + user[0].aiCredits; // Purchased credits
    
    return {
      canUse: availableCredits >= creditsNeeded,
      availableCredits,
      remainingIncluded,
      purchasedCredits: user[0].aiCredits,
      cycle
    };
  }

  // Use AI credits and track usage
  async useCredits(userId, requestType, prompt, creditsNeeded = 1, success = true) {
    const creditCheck = await this.canUseCredits(userId, creditsNeeded);
    
    if (!creditCheck.canUse) {
      throw new Error(`Insufficient credits: ${creditCheck.reason}`);
    }
    
    // Record usage
    const usageId = `usage_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await db.insert(aiCreditUsage).values({
      id: usageId,
      userId,
      requestType,
      creditsUsed: creditsNeeded,
      prompt: prompt?.substring(0, 1000), // Truncate long prompts
      success,
      usedAt: new Date()
    });
    
    // Update cycle usage
    await db
      .update(aiCreditBillingCycles)
      .set({
        creditsUsed: creditCheck.cycle.creditsUsed + creditsNeeded,
        overageCredits: Math.max(0, (creditCheck.cycle.creditsUsed + creditsNeeded) - creditCheck.cycle.includedCredits)
      })
      .where(eq(aiCreditBillingCycles.id, creditCheck.cycle.id));
    
    // Update user purchased credits if needed
    if (creditsNeeded > creditCheck.remainingIncluded) {
      const purchasedCreditsToUse = creditsNeeded - creditCheck.remainingIncluded;
      await db
        .update(users)
        .set({
          aiCredits: creditCheck.purchasedCredits - purchasedCreditsToUse,
          totalAiCreditsUsed: (creditCheck.cycle.creditsUsed || 0) + creditsNeeded
        })
        .where(eq(users.id, userId));
    }
    
    return {
      success: true,
      creditsUsed: creditsNeeded,
      remainingCredits: creditCheck.availableCredits - creditsNeeded,
      usageId
    };
  }

  // Get usage summary for current cycle
  async getUserUsageSummary(userId) {
    const cycle = await this.getCurrentBillingCycle(userId);
    if (!cycle) return null;
    
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
    if (!user[0]) return null;
    
    const plan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.planName, cycle.subscriptionPlan))
      .limit(1);
    
    const remainingIncluded = Math.max(0, cycle.includedCredits - cycle.creditsUsed);
    const overageCharges = cycle.overageCredits * parseFloat(plan[0]?.overagePricePerCredit || '0.10');
    
    return {
      currentCycle: {
        start: cycle.cycleStart,
        end: cycle.cycleEnd,
        plan: cycle.subscriptionPlan
      },
      credits: {
        included: cycle.includedCredits,
        used: cycle.creditsUsed,
        remainingIncluded,
        purchased: user[0].aiCredits,
        totalAvailable: remainingIncluded + user[0].aiCredits
      },
      overage: {
        credits: cycle.overageCredits,
        charges: overageCharges,
        pricePerCredit: plan[0]?.overagePricePerCredit || '0.10'
      },
      billing: {
        monthlyBase: plan[0]?.monthlyPrice || '0.00',
        estimatedOverage: overageCharges,
        estimatedTotal: parseFloat(plan[0]?.monthlyPrice || '0.00') + overageCharges
      }
    };
  }

  // Initialize subscription plans (run once)
  async initializeSubscriptionPlans() {
    const plans = [
      {
        id: 'plan_basic',
        planName: 'basic',
        monthlyPrice: '39.00',
        includedAiCredits: 10,
        overagePricePerCredit: '0.20',
        storageGB: 100,
        features: ['Basic website builder', '10 AI edits/month', '100GB storage'],
        stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic_placeholder'
      },
      {
        id: 'plan_pro',
        planName: 'pro',
        monthlyPrice: '79.00',
        includedAiCredits: 50,
        overagePricePerCredit: '0.15',
        storageGB: 500,
        features: ['Advanced website builder', '50 AI edits/month', '500GB storage', 'Priority support'],
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder'
      },
      {
        id: 'plan_enterprise',
        planName: 'enterprise',
        monthlyPrice: '149.00',
        includedAiCredits: 200,
        overagePricePerCredit: '0.10',
        storageGB: 2000,
        features: ['Full website builder', '200 AI edits/month', '2TB storage', 'White-label', '24/7 support'],
        stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder'
      }
    ];
    
    for (const plan of plans) {
      await db
        .insert(subscriptionPlans)
        .values(plan)
        .onConflictDoUpdate({
          target: subscriptionPlans.id,
          set: {
            monthlyPrice: plan.monthlyPrice,
            includedAiCredits: plan.includedAiCredits,
            overagePricePerCredit: plan.overagePricePerCredit,
            features: plan.features,
            updatedAt: new Date()
          }
        });
    }
    
    console.log('Subscription plans initialized');
  }

  // Process monthly overage billing (run via cron job)
  async processMonthlyOverageBilling() {
    const activeCycles = await db
      .select()
      .from(aiCreditBillingCycles)
      .where(
        and(
          eq(aiCreditBillingCycles.status, 'active'),
          lte(aiCreditBillingCycles.cycleEnd, new Date())
        )
      );
    
    for (const cycle of activeCycles) {
      if (cycle.overageCredits > 0) {
        const plan = await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.planName, cycle.subscriptionPlan))
          .limit(1);
          
        const overageAmount = cycle.overageCredits * parseFloat(plan[0]?.overagePricePerCredit || '0.10');
        
        // Create Stripe invoice for overage
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, cycle.userId))
          .limit(1);
          
        if (user[0]?.stripeCustomerId && overageAmount > 0) {
          try {
            const invoice = await stripe.invoices.create({
              customer: user[0].stripeCustomerId,
              description: `AI Credits Overage - ${cycle.overageCredits} credits`,
              metadata: {
                billingCycleId: cycle.id,
                overageCredits: cycle.overageCredits.toString(),
                userId: cycle.userId
              }
            });
            
            await stripe.invoiceItems.create({
              customer: user[0].stripeCustomerId,
              invoice: invoice.id,
              amount: Math.round(overageAmount * 100), // Convert to cents
              currency: 'usd',
              description: `AI Credits Overage (${cycle.overageCredits} credits @ $${plan[0]?.overagePricePerCredit || '0.10'} each)`
            });
            
            await stripe.invoices.finalizeInvoice(invoice.id);
            
            console.log(`Created overage invoice for user ${cycle.userId}: $${overageAmount}`);
          } catch (error) {
            console.error(`Failed to create overage invoice for user ${cycle.userId}:`, error);
          }
        }
        
        // Update cycle charges
        await db
          .update(aiCreditBillingCycles)
          .set({
            overageCharges: overageAmount.toFixed(2),
            status: 'billed',
            billedAt: new Date()
          })
          .where(eq(aiCreditBillingCycles.id, cycle.id));
      } else {
        // No overage, just close the cycle
        await db
          .update(aiCreditBillingCycles)
          .set({
            status: 'closed',
            billedAt: new Date()
          })
          .where(eq(aiCreditBillingCycles.id, cycle.id));
      }
    }
    
    console.log(`Processed ${activeCycles.length} billing cycles for overage charges`);
  }
}

module.exports = { 
  AiCreditBillingService,
  aiCreditBillingService: new AiCreditBillingService()
};
const express = require('express');
const router = express.Router();
const PaymentPlanManager = require('./paymentPlans');

const paymentPlanManager = new PaymentPlanManager();

router.post('/', async (req, res) => {
    try {
        console.log('📋 Payment plan creation request:', req.body);
        
        const { sessionId, totalAmount, frequency, startDate, endDate, reminderDays = 3 } = req.body;
        
        if (!sessionId || !totalAmount || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sessionId, totalAmount, startDate, endDate'
            });
        }
        
        const userId = req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const result = await paymentPlanManager.createPaymentPlan(
            sessionId,
            userId,
            parseFloat(totalAmount),
            startDate,
            endDate,
            frequency || 'monthly',
            parseInt(reminderDays) || 3
        );
        
        console.log('✅ Payment plan created successfully:', {
            planId: result.plan.id,
            totalPayments: result.plan.totalPayments,
            monthlyPayment: result.plan.monthlyPayment
        });
        
        res.json({
            success: true,
            plan: result.plan,
            payments: result.payments
        });
        
    } catch (error) {
        console.error('❌ Error creating payment plan:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create payment plan'
        });
    }
});

router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const userId = req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const plan = await paymentPlanManager.getPaymentPlan(sessionId, userId);
        
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'Payment plan not found'
            });
        }
        
        res.json({
            success: true,
            plan
        });
        
    } catch (error) {
        console.error('❌ Error fetching payment plan:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch payment plan'
        });
    }
});

// Get formatted payment schedule with session details (handles both manual and automated plans)
router.get('/:sessionId/schedule', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const userId = req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        // First try to get manual payment plan from PostgreSQL
        let schedule = await paymentPlanManager.getPaymentSchedule(sessionId, userId);
        
        // If no manual plan found, check for automated plan in Firestore
        if (!schedule) {
            const { getPlansBySession } = require('./payments/installments/dao');
            const { db, photographySessions, users } = require('../shared/schema');
            const { eq, and } = require('drizzle-orm');
            
            const plans = await getPlansBySession(sessionId);
            
            if (plans && plans.length > 0) {
                const plan = plans[0]; // Get first active plan
                
                // Get session details
                const [session] = await db.select()
                    .from(photographySessions)
                    .where(and(
                        eq(photographySessions.id, sessionId),
                        eq(photographySessions.userId, userId)
                    ));
                
                if (!session) {
                    return res.status(404).json({
                        success: false,
                        error: 'Session not found'
                    });
                }
                
                // Get photographer details
                const [photographer] = await db.select()
                    .from(users)
                    .where(eq(users.id, userId));
                
                const businessName = photographer?.businessName ||
                    (photographer?.displayName ? `${photographer.displayName} Photography` : 'Photography Business');
                
                // Format automated plan for display
                schedule = {
                    plan: {
                        id: plan.id,
                        totalAmount: parseFloat(plan.totalAmount),
                        totalPayments: plan.numberOfPayments,
                        paymentsCompleted: 0, // TODO: Calculate from Stripe
                        amountPaid: 0, // TODO: Calculate from Stripe
                        remainingBalance: parseFloat(plan.totalAmount),
                        status: plan.status,
                        paymentFrequency: plan.cadence,
                        monthlyPayment: parseFloat(plan.perInstallmentAmount),
                        nextPaymentDate: plan.startDate,
                        startDate: plan.startDate,
                        endDate: plan.endDate,
                        type: 'automated', // Mark as automated plan
                        stripeSubscriptionScheduleId: plan.stripeSubscriptionScheduleId
                    },
                    session: {
                        id: session.id,
                        clientName: session.clientName,
                        clientEmail: session.email,
                        clientPhone: session.phoneNumber,
                        sessionType: session.sessionType,
                        sessionDate: session.dateTime
                    },
                    photographer: {
                        businessName,
                        email: photographer?.email || '',
                        phone: photographer?.phoneNumber || ''
                    },
                    payments: [] // Automated payments are managed by Stripe
                };
            }
        }
        
        if (!schedule) {
            return res.status(404).json({
                success: false,
                error: 'Payment schedule not found'
            });
        }
        
        res.json(schedule);
        
    } catch (error) {
        console.error('❌ Error fetching payment schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch payment schedule'
        });
    }
});

// Send payment schedule via email (using mailto: or nodemailer)
router.post('/:sessionId/send-email', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { useMailto = false } = req.body;
        
        const userId = req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const result = await paymentPlanManager.sendPaymentScheduleEmail(sessionId, userId, useMailto);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error sending payment schedule email:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send payment schedule email'
        });
    }
});

// Generate SMS URL for payment schedule
router.post('/:sessionId/send-sms', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const userId = req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const result = await paymentPlanManager.generatePaymentScheduleSMS(sessionId, userId);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error generating payment schedule SMS:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate payment schedule SMS'
        });
    }
});

router.post('/test/trigger-automation', async (req, res) => {
    try {
        console.log('🧪 TEST: Manually triggering automated payment processing...');
        
        const userId = req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const results = await paymentPlanManager.processAutomatedPayments();
        
        console.log('✅ TEST: Automated payment processing completed:', results);
        
        res.json({
            success: true,
            message: 'Automated payment processing completed',
            results: results
        });
        
    } catch (error) {
        console.error('❌ TEST: Error in automated payment processing:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process automated payments'
        });
    }
});

module.exports = router;

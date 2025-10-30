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
        
        // SECURITY: Verify session ownership before creating payment plan
        // Prevents horizontal privilege escalation (users creating plans for other users' sessions)
        const sessionOwnership = await paymentPlanManager.verifySessionOwnership(sessionId, userId);
        if (!sessionOwnership.valid) {
            console.warn('🚨 Unauthorized payment plan creation attempt:', {
                userId,
                sessionId,
                reason: sessionOwnership.reason
            });
            return res.status(403).json({
                success: false,
                error: sessionOwnership.reason || 'Unauthorized: Session does not belong to this user'
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
            planId: result.plan.id,
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

router.delete('/:planId', async (req, res) => {
    try {
        const { planId } = req.params;
        console.log('🗑️ Payment plan deletion request:', planId);
        
        const userId = req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const result = await paymentPlanManager.deletePaymentPlan(planId, userId);
        
        if (result.success) {
            console.log('✅ Payment plan deleted successfully:', planId);
            res.json({
                success: true,
                message: 'Payment plan deleted successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error || 'Failed to delete payment plan'
            });
        }
        
    } catch (error) {
        console.error('❌ Error deleting payment plan:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete payment plan'
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

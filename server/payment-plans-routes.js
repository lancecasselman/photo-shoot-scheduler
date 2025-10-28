const express = require('express');
const router = express.Router();
const { PaymentPlanManager } = require('./paymentPlans');

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

module.exports = router;

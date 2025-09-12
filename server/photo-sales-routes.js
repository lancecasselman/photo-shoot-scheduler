// Photo Sales API Routes
// Handles print orders and digital downloads for for-sale photos

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PrintServiceAPI = require('./print-service');

const router = express.Router();

// Initialize WHCC print service
const printService = new PrintServiceAPI();

// Digital photo purchase endpoint
router.post('/digital-order', async (req, res) => {
    try {
        console.log('📱 Processing digital photo order:', req.body);
        
        const { photoUrl, filename, price, customerInfo } = req.body;
        
        if (!photoUrl || !filename || !price) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Create Stripe checkout session for digital download
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Digital Download - ${filename}`,
                        description: 'High-resolution digital photo download',
                        images: [photoUrl]
                    },
                    unit_amount: Math.round(price * 100) // Convert to cents
                },
                quantity: 1
            }],
            metadata: {
                type: 'digital_download',
                photoUrl: photoUrl,
                filename: filename
            },
            success_url: `${req.protocol}://${req.get('host')}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&type=digital`,
            cancel_url: `${req.protocol}://${req.get('host')}/print-checkout.html?cancelled=true`
        });
        
        console.log('✅ Created Stripe session for digital download:', session.id);
        
        res.json({
            checkoutUrl: session.url,
            sessionId: session.id
        });
        
    } catch (error) {
        console.error('❌ Digital order failed:', error);
        res.status(500).json({ error: 'Failed to process digital order' });
    }
});

// Print order endpoint with WHCC integration
router.post('/print-order', async (req, res) => {
    try {
        console.log('🖼️ Processing print order:', req.body);
        
        const { photoUrl, filename, products, customerInfo, galleryToken } = req.body;
        
        if (!photoUrl || !filename || !products || !Array.isArray(products)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Calculate total price for all selected products
        let totalPrice = 0;
        const lineItems = [];
        
        for (const product of products) {
            const itemPrice = calculateProductPrice(product);
            totalPrice += itemPrice * (product.quantity || 1);
            
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${product.name} - ${product.size}`,
                        description: `Professional print from ${filename}`,
                        images: [photoUrl]
                    },
                    unit_amount: Math.round(itemPrice * 100) // Convert to cents
                },
                quantity: product.quantity || 1
            });
        }
        
        // Create Stripe checkout session for print order
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: lineItems,
            shipping_address_collection: {
                allowed_countries: ['US', 'CA']
            },
            metadata: {
                type: 'print_order',
                photoUrl: photoUrl,
                filename: filename,
                products: JSON.stringify(products),
                galleryToken: galleryToken || ''
            },
            success_url: `${req.protocol}://${req.get('host')}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&type=print`,
            cancel_url: `${req.protocol}://${req.get('host')}/print-checkout.html?cancelled=true`
        });
        
        console.log('✅ Created Stripe session for print order:', session.id);
        
        res.json({
            checkoutUrl: session.url,
            sessionId: session.id,
            totalPrice: totalPrice
        });
        
    } catch (error) {
        console.error('❌ Print order failed:', error);
        res.status(500).json({ error: 'Failed to process print order' });
    }
});

// WHCC product catalog endpoint
router.get('/whcc-products', async (req, res) => {
    try {
        console.log('📦 Fetching WHCC product catalog...');
        
        const products = await printService.getProducts();
        
        console.log(`✅ Retrieved ${products.length} WHCC products`);
        
        res.json({
            products: products,
            success: true
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch WHCC products:', error);
        res.status(500).json({ error: 'Failed to fetch product catalog' });
    }
});

// Webhook handler for completed payments
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        
        console.log('🔔 Stripe webhook received:', event.type);
        
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            console.log('💳 Payment completed for session:', session.id);
            
            if (session.metadata.type === 'digital_download') {
                await handleDigitalDownload(session);
            } else if (session.metadata.type === 'print_order') {
                await handlePrintOrder(session);
            }
        }
        
        res.json({received: true});
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Handle completed digital download payment
async function handleDigitalDownload(session) {
    try {
        console.log('📱 Processing digital download fulfillment...');
        
        const { photoUrl, filename } = session.metadata;
        
        // In a real implementation, you would:
        // 1. Generate a secure download link
        // 2. Send download email to customer
        // 3. Log the transaction
        
        console.log(`✅ Digital download processed for ${filename}`);
        
        // For now, we'll just log the successful transaction
        // TODO: Implement actual digital delivery system
        
    } catch (error) {
        console.error('❌ Digital download fulfillment failed:', error);
    }
}

// Handle completed print order payment
async function handlePrintOrder(session) {
    try {
        console.log('🖼️ Processing print order fulfillment...');
        
        const { photoUrl, filename, products } = session.metadata;
        const parsedProducts = JSON.parse(products);
        
        // Submit order to WHCC
        try {
            const whccOrder = await submitToWHCC(session, parsedProducts);
            console.log('✅ Order submitted to WHCC:', whccOrder.orderId);
        } catch (whccError) {
            console.error('❌ WHCC order submission failed:', whccError);
            // TODO: Implement fallback or retry logic
        }
        
    } catch (error) {
        console.error('❌ Print order fulfillment failed:', error);
    }
}

// Submit order to WHCC print service
async function submitToWHCC(session, products) {
    console.log('📦 Submitting order to WHCC...');
    
    // Transform our product data to WHCC format
    const whccItems = products.map(product => ({
        ProductUID: product.whccProductId || 'default-product-id',
        Quantity: product.quantity || 1,
        Size: product.size,
        // TODO: Add crop/positioning data
        ImageUrl: session.metadata.photoUrl
    }));
    
    // Use existing WHCC service to submit order
    try {
        const result = await printService.submitOrder({
            items: whccItems,
            customerInfo: {
                name: session.customer_details?.name || 'Customer',
                email: session.customer_details?.email,
                address: session.shipping_details?.address
            },
            reference: session.id
        });
        
        return result;
    } catch (error) {
        console.error('❌ WHCC API error:', error);
        throw error;
    }
}

// Helper function to calculate product price
function calculateProductPrice(product) {
    // Base pricing logic - could be enhanced with dynamic pricing
    const basePrices = {
        '4x6': 15.00,
        '5x7': 18.00,
        '8x10': 25.00,
        '11x14': 35.00,
        '16x20': 55.00,
        '20x30': 95.00
    };
    
    return basePrices[product.size] || 25.00;
}

module.exports = router;
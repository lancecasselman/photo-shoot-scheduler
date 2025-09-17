// Photo Sales API Routes
// Handles print orders and digital downloads for for-sale photos

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PrintServiceAPI = require('./print-service');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db.ts');
const { photoForSaleSettings } = require('../shared/schema');
const { eq, and } = require('drizzle-orm');
const router = express.Router();

// Initialize WHCC print service
const printService = new PrintServiceAPI();

// Cache for WHCC product catalog (refresh every 30 minutes)
let whccCatalogCache = null;
let catalogCacheExpiry = 0;
const CATALOG_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// SECURITY: Validate photo ownership before allowing operations
async function validatePhotoOwnership(userId, photoUrl) {
    try {
        // Check if photo belongs to any of the user's photography sessions
        const { photographySessions } = require('../shared/schema');
        
        const userSessions = await db.select().from(photographySessions)
            .where(eq(photographySessions.userId, userId));
        
        if (userSessions.length === 0) {
            console.warn('⚠️ User has no photography sessions:', userId);
            return false;
        }
        
        // Check if photoUrl contains reference to user's session
        for (const session of userSessions) {
            if (photoUrl.includes(session.id) || photoUrl.includes(userId)) {
                console.log('✅ Photo ownership validated:', { userId, sessionId: session.id });
                return true;
            }
        }
        
        console.warn('⚠️ Photo ownership validation failed:', { userId, photoUrl });
        return false;
        
    } catch (error) {
        console.error('❌ Error validating photo ownership:', error);
        return false; // Fail-safe: deny access on error
    }
}

// Get WHCC product catalog with caching
async function getWHCCCatalog() {
    const now = Date.now();
    
    if (whccCatalogCache && now < catalogCacheExpiry) {
        return whccCatalogCache;
    }
    
    try {
        console.log('🔄 Refreshing WHCC catalog cache...');
        const result = await printService.getProducts();
        
        
        // Extract products array from result
        const products = Array.isArray(result) ? result : (result.products || []);
        whccCatalogCache = products;
        catalogCacheExpiry = now + CATALOG_CACHE_DURATION;
        console.log(`✅ WHCC catalog cached with ${products.length} products`);
        return products;
    } catch (error) {
        console.error('❌ Failed to refresh WHCC catalog cache:', error);
        // Return cached data if available, otherwise empty array
        return whccCatalogCache || [];
    }
}

// Calculate product price based on WHCC catalog and admin settings
async function calculateProductPrice(product, userId = null) {
    try {
        console.log('💰 Calculating price for product:', { 
            productUID: product.productUID, 
            size: product.size,
            userId: userId 
        });
        
        // Get WHCC catalog
        const catalog = await getWHCCCatalog();
        
        // Find the product in WHCC catalog
        const whccProduct = catalog.find(p => 
            p.productUID === product.productUID || 
            p.id === product.productUID
        );
        
        if (!whccProduct) {
            console.warn('⚠️ Product not found in WHCC catalog:', product.productUID);
            throw new Error(`Product ${product.productUID} not found in WHCC catalog`);
        }
        
        // Find the specific size pricing
        let basePrice = whccProduct.price || 0; // Default price
        
        if (product.size && whccProduct.sizes && Array.isArray(whccProduct.sizes)) {
            const sizeOption = whccProduct.sizes.find(s => 
                s.label === product.size || 
                s.id === product.size ||
                s.productNodeUID === product.productNodeUID
            );
            
            if (sizeOption) {
                basePrice = sizeOption.price || basePrice;
                console.log(`📏 Found size pricing: ${product.size} = $${basePrice}`);
            } else {
                console.warn('⚠️ Size not found, using base price:', product.size);
            }
        }
        
        // Get admin-configured markup if user ID provided
        let finalPrice = basePrice;
        if (userId) {
            try {
                const settingsResult = await db.select({
                    printMarkupPercentage: photoForSaleSettings.printMarkupPercentage,
                    minPrintPrice: photoForSaleSettings.minPrintPrice
                })
                .from(photoForSaleSettings)
                .where(and(
                    eq(photoForSaleSettings.userId, userId),
                    eq(photoForSaleSettings.isActive, true)
                ))
                .limit(1);
                
                if (settingsResult.length > 0) {
                    const settings = settingsResult[0];
                    const markupPercentage = parseFloat(settings.printMarkupPercentage) || 25; // Default 25%
                    const minPrice = parseFloat(settings.minPrintPrice) || 5; // Default $5
                    
                    finalPrice = basePrice * (1 + markupPercentage / 100);
                    finalPrice = Math.max(finalPrice, minPrice); // Enforce minimum
                    
                    console.log(`📈 Applied ${markupPercentage}% markup: $${basePrice} → $${finalPrice.toFixed(2)} (min: $${minPrice})`);
                } else {
                    // Default 25% markup if no settings found
                    finalPrice = basePrice * 1.25;
                    console.log(`📈 Applied default 25% markup: $${basePrice} → $${finalPrice.toFixed(2)}`);
                }
            } catch (dbError) {
                console.warn('⚠️ Could not fetch admin pricing settings, using default markup:', dbError.message);
                finalPrice = basePrice * 1.25; // Default 25% markup
            }
        }
        
        // Round to 2 decimal places
        finalPrice = Math.round(finalPrice * 100) / 100;
        
        console.log(`✅ Final calculated price: $${finalPrice}`);
        return finalPrice;
        
    } catch (error) {
        console.error('❌ Error calculating product price:', error);
        throw error;
    }
}

// Validate and get digital photo price from admin settings
async function getDigitalPhotoPrice(userId, photoUrl) {
    try {
        // Use Drizzle ORM for database queries
        const result = await db.select({ digitalPrice: photoForSaleSettings.digitalPrice })
            .from(photoForSaleSettings)
            .where(and(
                eq(photoForSaleSettings.userId, userId),
                eq(photoForSaleSettings.photoUrl, photoUrl),
                eq(photoForSaleSettings.isActive, true)
            ));
        
        if (result.length > 0) {
            return parseFloat(result[0].digitalPrice);
        }
        
        // Fallback: check for any digital price setting for this user
        const fallbackResult = await db.select({ digitalPrice: photoForSaleSettings.digitalPrice })
            .from(photoForSaleSettings)
            .where(and(
                eq(photoForSaleSettings.userId, userId),
                eq(photoForSaleSettings.isActive, true)
            ))
            .limit(1);
        
        if (fallbackResult.length > 0) {
            return parseFloat(fallbackResult[0].digitalPrice);
        }
        
        // Default digital price if no settings found
        return 25.00;
        
    } catch (error) {
        console.warn('⚠️ Could not fetch digital price, using default:', error.message);
        return 25.00;
    }
}

// Public endpoint for WHCC status check (no auth required)
router.get('/whcc-status', async (req, res) => {
    try {
        console.log('🔍 Checking WHCC status (public endpoint)...');
        
        const result = await printService.getProducts();
        
        // Service is available
        return res.json({
            success: true,
            message: 'Print fulfillment service is available'
        });
        
    } catch (error) {
        console.error('❌ Failed to check WHCC status:', error);
        // Return error response
        res.json({
            success: false,
            message: 'Print fulfillment service temporarily unavailable'
        });
    }
});

// Simple authentication middleware for photo sales
const requireAuth = (req, res, next) => {
    const userId = req.user?.uid || req.session?.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// DEEP DIVE TEST ENDPOINT - Add BEFORE authentication middleware
// This bypasses authentication for testing purposes
router.get('/whcc-complete-test', async (req, res) => {
    console.log('\n🚀 COMPLETE WHCC CAPABILITIES TEST');
    console.log('='.repeat(60));
    
    try {
        const results = {
            authentication: {},
            catalog: {},
            editorAPI: {},
            analysis: {},
            recommendations: []
        };
        
        // Test 1: Authentication
        console.log('📋 Step 1: Testing Authentication...');
        const token = await printService.getAccessToken();
        if (token) {
            results.authentication = {
                success: true,
                tokenLength: token.length,
                environment: printService.isSandbox ? 'sandbox' : 'production',
                customerNumber: '443225'  // Your WHCC account number
            };
            console.log('✅ Authentication successful');
            
            // Test 2: Get full catalog
            console.log('\n📚 Step 2: Fetching Complete Catalog...');
            const catalogUrl = `${printService.isSandbox ? printService.sandboxUrl : printService.oasBaseUrl}/api/catalog`;
            
            const fetch = (await import('node-fetch')).default;
            const catalogResponse = await fetch(catalogUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (catalogResponse.ok) {
                const catalog = await catalogResponse.json();
                
                // Deep analysis of catalog
                let totalProducts = 0;
                const productTypes = {
                    albums: [],
                    books: [],
                    prints: [],
                    canvas: [],
                    metal: [],
                    acrylic: [],
                    cards: [],
                    other: []
                };
                
                if (catalog.Categories) {
                    catalog.Categories.forEach(category => {
                        console.log(`  📦 Category: ${category.Name}`);
                        if (category.ProductList) {
                            totalProducts += category.ProductList.length;
                            console.log(`     Products: ${category.ProductList.length}`);
                            
                            category.ProductList.forEach(product => {
                                const name = product.Name || product.Description || '';
                                const lowerName = name.toLowerCase();
                                
                                // Categorize products
                                if (lowerName.includes('album')) {
                                    productTypes.albums.push(name);
                                    console.log(`     📚 ALBUM FOUND: ${name}`);
                                } else if (lowerName.includes('book')) {
                                    productTypes.books.push(name);
                                    console.log(`     📖 BOOK FOUND: ${name}`);
                                } else if (lowerName.includes('metal') && !lowerName.includes('ornament')) {
                                    productTypes.metal.push(name);
                                    console.log(`     🔩 METAL PRINT FOUND: ${name}`);
                                } else if (lowerName.includes('acrylic') && !lowerName.includes('magnet')) {
                                    productTypes.acrylic.push(name);
                                } else if (lowerName.includes('canvas') || lowerName.includes('gallery wrap')) {
                                    productTypes.canvas.push(name);
                                } else if (lowerName.includes('card')) {
                                    productTypes.cards.push(name);
                                } else if (lowerName.includes('print') && !lowerName.includes('canvas')) {
                                    productTypes.prints.push(name);
                                } else {
                                    productTypes.other.push(name);
                                }
                            });
                        }
                    });
                }
                
                results.catalog = {
                    success: true,
                    totalCategories: catalog.Categories ? catalog.Categories.length : 0,
                    totalProducts: totalProducts,
                    productTypes: {
                        albums: productTypes.albums.length,
                        albumNames: productTypes.albums,
                        books: productTypes.books.length,
                        bookNames: productTypes.books,
                        metalPrints: productTypes.metal.length,
                        metalNames: productTypes.metal,
                        acrylicPrints: productTypes.acrylic.length,
                        acrylicNames: productTypes.acrylic,
                        canvasProducts: productTypes.canvas.length,
                        photoPrints: productTypes.prints.length,
                        cards: productTypes.cards.length,
                        other: productTypes.other.length,
                        otherNames: productTypes.other.slice(0, 10)
                    },
                    hasOrderAttributes: !!(catalog.Categories?.[0]?.OrderAttributeCategoryList),
                    orderAttributeCount: catalog.Categories?.[0]?.OrderAttributeCategoryList?.length || 0
                };
                
                console.log(`✅ Catalog loaded: ${totalProducts} products found`);
                
                // Check for specific album/book products
                const catalogString = JSON.stringify(catalog).toLowerCase();
                results.analysis = {
                    containsAlbumKeyword: catalogString.includes('album'),
                    containsBookKeyword: catalogString.includes('book'),
                    containsLayflatKeyword: catalogString.includes('layflat') || catalogString.includes('lay-flat'),
                    containsHardcoverKeyword: catalogString.includes('hardcover') || catalogString.includes('hard cover'),
                    containsPressBookKeyword: catalogString.includes('press'),
                    containsMetalKeyword: catalogString.includes('metal')
                };
                
            } else {
                const errorText = await catalogResponse.text();
                results.catalog = {
                    success: false,
                    error: errorText.substring(0, 200),
                    status: catalogResponse.status
                };
                console.log(`❌ Catalog fetch failed: ${catalogResponse.status}`);
            }
            
            // Test 3: Editor API capabilities
            console.log('\n🎨 Step 3: Checking Editor API...');
            if (printService.editorKeyId && printService.editorKeySecret) {
                results.editorAPI = {
                    configured: true,
                    hasCredentials: true,
                    keyIdLength: printService.editorKeyId.length,
                    editorUrl: printService.editorBaseUrl
                };
                
                // According to WHCC docs, Editor API supports:
                results.editorAPI.documentedSupport = {
                    albums: true,  // "Albums with various cover and debossing options"
                    flatCards: true,  // "5x7 Flat Cards with optional boutique shapes and foils"
                    prints: true,  // "Photo and Fine Art Prints"
                    framedPrints: true  // "Framed Prints"
                };
                
                console.log('✅ Editor API configured and ready');
                console.log('   📚 Editor API supports ALBUMS through the Editor interface!');
            } else {
                results.editorAPI = {
                    configured: false,
                    hasCredentials: false
                };
            }
            
        } else {
            results.authentication = {
                success: false,
                error: 'Failed to get access token'
            };
        }
        
        // Generate recommendations based on findings
        if (results.catalog.productTypes?.albums === 0 && results.catalog.productTypes?.books === 0) {
            if (results.editorAPI.configured) {
                results.recommendations.push('📚 Albums/Books not in Order Submit catalog BUT Editor API is configured - they ARE available through Editor API!');
                results.recommendations.push('Use the Editor API to create album/book products for customers');
            } else {
                results.recommendations.push('Contact WHCC to enable Albums/Books for your account (#443225)');
            }
        } else if (results.catalog.productTypes?.albums > 0 || results.catalog.productTypes?.books > 0) {
            results.recommendations.push('✅ Albums/Books ARE available in your catalog!');
        }
        
        if (results.catalog.productTypes?.metalPrints === 0 && !results.analysis?.containsMetalKeyword) {
            results.recommendations.push('Metal prints not found - may need to be enabled for account #443225');
        } else if (results.catalog.productTypes?.metalPrints > 0) {
            results.recommendations.push('✅ Metal prints are available!');
        }
        
        if (results.catalog.success && results.editorAPI.configured) {
            results.recommendations.push('✅ Full WHCC integration is working! Both Order Submit API and Editor API are configured.');
        }
        
        console.log('\n✅ COMPLETE TEST FINISHED');
        console.log('='.repeat(60));
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            accountNumber: '443225',
            environment: printService.isSandbox ? 'SANDBOX' : 'PRODUCTION',
            results: results
        });
        
    } catch (error) {
        console.error('❌ Complete test error:', error);
        res.status(500).json({
            error: 'Complete test failed',
            message: error.message,
            stack: error.stack
        });
    }
});

// Apply authentication middleware to all protected routes
router.use(requireAuth);

// Digital photo purchase endpoint
router.post('/digital-order', async (req, res) => {
    try {
        console.log('📱 Processing digital photo order:', req.body);
        
        const { photoUrl, filename, customerInfo } = req.body;
        
        if (!photoUrl || !filename) {
            return res.status(400).json({ error: 'Missing required fields: photoUrl and filename are required' });
        }
        
        // SECURITY: Get userId from authenticated session, never trust client
        const userId = req.user?.uid || req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // SECURITY: Validate photo ownership before processing
        const hasAccess = await validatePhotoOwnership(userId, photoUrl);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: Photo not owned by user' });
        }
        
        // SECURITY: Calculate price server-side, never trust client
        const validatedPrice = await getDigitalPhotoPrice(userId, photoUrl);
        console.log(`💰 Server-validated digital price: $${validatedPrice}`);
        
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
                    unit_amount: Math.round(validatedPrice * 100) // Server-validated price
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
        
        // SECURITY: Calculate all prices server-side, never trust client
        let totalPrice = 0;
        const lineItems = [];
        const validatedProducts = [];
        
        // SECURITY: Get userId from authenticated session, never trust client
        const userId = req.user?.uid || req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // SECURITY: Validate photo ownership before processing
        const hasAccess = await validatePhotoOwnership(userId, photoUrl);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: Photo not owned by user' });
        }
        
        for (const product of products) {
            // Validate each product against WHCC catalog
            const itemPrice = await calculateProductPrice(product, userId);
            totalPrice += itemPrice * (product.quantity || 1);
            
            // Store validated product for later use
            validatedProducts.push({
                ...product,
                validatedPrice: itemPrice
            });
            
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
                products: JSON.stringify(validatedProducts), // Use validated products with server prices
                galleryToken: galleryToken || '',
                userId: userId || 'anonymous',
                serverValidatedTotal: totalPrice.toFixed(2)
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

// WHCC product catalog endpoint (requires auth)
router.get('/whcc-products', async (req, res) => {
    try {
        console.log('📦 Fetching WHCC product catalog...');
        
        const result = await printService.getProducts();
        
        
        const products = Array.isArray(result) ? result : (result.products || []);
        
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

// WHCC order submission function with proper structure
async function submitToWHCC(orderData) {
    try {
        console.log('📦 Submitting order to WHCC:', orderData.reference);
        
        // Map our order data to WHCC format
        const whccOrderData = {
            Reference: orderData.reference,
            ClientInfo: {
                FirstName: orderData.customer.firstName || '',
                LastName: orderData.customer.lastName || '',
                Email: orderData.customer.email,
                Phone: orderData.customer.phone || '',
                Address1: orderData.shipping.address1,
                Address2: orderData.shipping.address2 || '',
                City: orderData.shipping.city,
                State: orderData.shipping.state,
                Zip: orderData.shipping.zip,
                Country: orderData.shipping.country || 'US'
            },
            Items: orderData.items.map(item => ({
                ProductUID: item.productUID,
                ProductNodeUID: item.productNodeUID || item.nodeId,
                Quantity: item.quantity || 1,
                LayoutUID: 0, // Default layout
                Attributes: Array.isArray(item.attributes) ? item.attributes.map(attr => ({
                    AttributeUID: attr.attributeUID || attr.id,
                    CategoryUID: attr.categoryUID || attr.categoryId
                })) : [],
                Assets: [{
                    AssetPath: item.imageUrl || orderData.photoUrl,
                    PrintedFileName: item.fileName || orderData.filename,
                    ImageHash: item.imageHash || '',
                    DP2NodeID: item.nodeId || 10000
                }],
                // Include editor project if item was customized
                ...(item.editorProjectUID && {
                    EditorProjectUID: item.editorProjectUID,
                    IsCustomized: true
                })
            })),
            ShippingMethod: orderData.shippingMethod || 'Standard',
            PaymentMethod: 'Prepaid', // We handle payment via Stripe
            Comments: orderData.comments || 'Order from gallery print sales'
        };
        
        // Submit to WHCC
        const result = await printService.createOrder(whccOrderData);
        console.log('✅ WHCC order created:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ WHCC order submission failed:', error);
        throw error;
    }
}

// Webhook handler for completed payments with proper security
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    // Verify webhook secret exists
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).send('Webhook secret not configured');
    }
    
    try {
        // SECURITY: Verify webhook signature BEFORE processing
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        
        console.log('🔔 Stripe webhook received:', event.type);
        
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            console.log('💳 Payment completed for session:', session.id);
            console.log('📋 Session metadata:', session.metadata);
            
            // Verify total amount matches server-calculated amount (additional security)
            if (session.metadata.serverValidatedTotal) {
                const expectedTotal = parseFloat(session.metadata.serverValidatedTotal);
                const actualTotal = session.amount_total / 100; // Stripe amounts are in cents
                
                if (Math.abs(expectedTotal - actualTotal) > 0.01) { // Allow 1 cent difference for rounding
                    console.error('❌ Payment amount mismatch detected:', {
                        expected: expectedTotal,
                        actual: actualTotal,
                        sessionId: session.id
                    });
                    // Log but continue processing - this is an additional check
                }
            }
            
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

// Add API endpoint for getting photo for-sale settings
router.get('/photo-settings/:photoUrl', async (req, res) => {
    try {
        const { photoUrl } = req.params;
        const decodedPhotoUrl = decodeURIComponent(photoUrl);
        
        // SECURITY: Get userId from authenticated session
        const userId = req.user?.uid || req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        console.log('📋 Getting photo for-sale settings:', { userId, photoUrl: decodedPhotoUrl });
        
        // Use Drizzle ORM instead of raw queries
        const result = await db.select().from(photoForSaleSettings)
            .where(and(
                eq(photoForSaleSettings.userId, userId),
                eq(photoForSaleSettings.photoUrl, decodedPhotoUrl),
                eq(photoForSaleSettings.isActive, true)
            ));
        
        if (result.length > 0) {
            const settings = result[0];
            res.json({
                success: true,
                isForSale: settings.isForSale,
                allowPrints: settings.allowPrints,
                allowDigital: settings.allowDigital,
                digitalPrice: parseFloat(settings.digitalPrice),
                printMarkupPercentage: parseFloat(settings.printMarkupPercentage),
                minPrintPrice: parseFloat(settings.minPrintPrice)
            });
        } else {
            // Return default settings if no specific settings found
            res.json({
                success: true,
                isForSale: false,
                allowPrints: true,
                allowDigital: true,
                digitalPrice: 25.00,
                printMarkupPercentage: 25.00,
                minPrintPrice: 5.00
            });
        }
        
    } catch (error) {
        console.error('❌ Error getting photo settings:', error);
        res.status(500).json({ error: 'Failed to get photo settings' });
    }
});

// Add API endpoint for saving photo for-sale settings
router.post('/photo-settings', async (req, res) => {
    try {
        const { photoUrl, photoFilename, settings } = req.body;
        
        if (!photoUrl || !settings) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // SECURITY: Get userId from authenticated session
        const userId = req.user?.uid || req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // SECURITY: Validate photo ownership before allowing settings changes
        const hasAccess = await validatePhotoOwnership(userId, photoUrl);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: Photo not owned by user' });
        }
        
        console.log('💾 Saving photo for-sale settings:', { userId, photoUrl, settings });
        
        const settingId = uuidv4();
        const pageId = 'gallery'; // Default page ID
        
        // Use Drizzle ORM for database operations
        const { sql } = require('drizzle-orm');
        
        try {
            await db.insert(photoForSaleSettings).values({
                id: settingId,
                userId: userId,
                pageId: pageId,
                photoSelector: `img[src="${photoUrl}"]`,
                photoUrl: photoUrl,
                photoFilename: photoFilename || 'photo.jpg',
                isForSale: settings.isForSale || false,
                allowPrints: settings.allowPrints || true,
                allowDigital: settings.allowDigital || true,
                digitalPrice: settings.digitalPrice?.toString() || '25.00',
                printMarkupPercentage: settings.printMarkupPercentage?.toString() || '25.00',
                minPrintPrice: settings.minPrintPrice?.toString() || '5.00'
            }).onConflictDoUpdate({
                target: [photoForSaleSettings.userId, photoForSaleSettings.photoUrl],
                set: {
                    isForSale: settings.isForSale || false,
                    allowPrints: settings.allowPrints || true,
                    allowDigital: settings.allowDigital || true,
                    digitalPrice: settings.digitalPrice?.toString() || '25.00',
                    printMarkupPercentage: settings.printMarkupPercentage?.toString() || '25.00',
                    minPrintPrice: settings.minPrintPrice?.toString() || '5.00',
                    updatedAt: sql`NOW()`
                }
            });
        } catch (dbError) {
            console.error('❌ Database error saving settings:', dbError);
            return res.status(500).json({ error: 'Database error saving settings' });
        }
        
        res.json({ success: true, message: 'Photo settings saved' });
        
    } catch (error) {
        console.error('❌ Error saving photo settings:', error);
        res.status(500).json({ error: 'Failed to save photo settings' });
    }
});

// DEEP DIVE TEST ENDPOINT - Comprehensive WHCC capabilities check
router.get('/whcc-deep-dive', async (req, res) => {
    console.log('\n🚀 DEEP DIVE INTO WHCC CAPABILITIES');
    console.log('='.repeat(60));
    
    // BYPASS AUTH FOR TESTING - Remove this in production
    req.session = req.session || {};
    req.session.user = req.session.user || { uid: 'test-deep-dive' };
    
    try {
        const results = {
            authentication: {},
            catalog: {},
            editorAPI: {},
            analysis: {}
        };
        
        // Test 1: Authentication
        console.log('📋 Step 1: Testing Authentication...');
        const token = await printService.getAccessToken();
        if (token) {
            results.authentication = {
                success: true,
                tokenLength: token.length,
                environment: printService.isSandbox ? 'sandbox' : 'production'
            };
            console.log('✅ Authentication successful');
            
            // Test 2: Get full catalog
            console.log('\n📚 Step 2: Fetching Complete Catalog...');
            const catalogUrl = `${printService.isSandbox ? printService.sandboxUrl : printService.oasBaseUrl}/api/catalog`;
            
            const catalogResponse = await fetch(catalogUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (catalogResponse.ok) {
                const catalog = await catalogResponse.json();
                
                // Deep analysis of catalog
                let totalProducts = 0;
                const productTypes = {
                    albums: [],
                    books: [],
                    prints: [],
                    canvas: [],
                    metal: [],
                    acrylic: [],
                    cards: [],
                    other: []
                };
                
                if (catalog.Categories) {
                    catalog.Categories.forEach(category => {
                        if (category.ProductList) {
                            totalProducts += category.ProductList.length;
                            
                            category.ProductList.forEach(product => {
                                const name = product.Name || product.Description || '';
                                const lowerName = name.toLowerCase();
                                
                                // Categorize products
                                if (lowerName.includes('album')) productTypes.albums.push(name);
                                else if (lowerName.includes('book')) productTypes.books.push(name);
                                else if (lowerName.includes('metal') && !lowerName.includes('ornament')) productTypes.metal.push(name);
                                else if (lowerName.includes('acrylic') && !lowerName.includes('magnet')) productTypes.acrylic.push(name);
                                else if (lowerName.includes('canvas') || lowerName.includes('gallery wrap')) productTypes.canvas.push(name);
                                else if (lowerName.includes('card')) productTypes.cards.push(name);
                                else if (lowerName.includes('print') && !lowerName.includes('canvas')) productTypes.prints.push(name);
                                else productTypes.other.push(name);
                            });
                        }
                    });
                }
                
                results.catalog = {
                    success: true,
                    totalCategories: catalog.Categories ? catalog.Categories.length : 0,
                    totalProducts: totalProducts,
                    productTypes: {
                        albums: productTypes.albums.length,
                        albumNames: productTypes.albums.slice(0, 5),
                        books: productTypes.books.length,
                        bookNames: productTypes.books.slice(0, 5),
                        metalPrints: productTypes.metal.length,
                        metalNames: productTypes.metal.slice(0, 5),
                        acrylicPrints: productTypes.acrylic.length,
                        acrylicNames: productTypes.acrylic.slice(0, 5),
                        canvasProducts: productTypes.canvas.length,
                        photoPrints: productTypes.prints.length,
                        cards: productTypes.cards.length,
                        other: productTypes.other.length
                    },
                    hasOrderAttributes: !!(catalog.Categories?.[0]?.OrderAttributeCategoryList),
                    orderAttributeCount: catalog.Categories?.[0]?.OrderAttributeCategoryList?.length || 0
                };
                
                console.log(`✅ Catalog loaded: ${totalProducts} products found`);
                
                // Check for specific album/book products
                const catalogString = JSON.stringify(catalog).toLowerCase();
                results.analysis = {
                    containsAlbumKeyword: catalogString.includes('album'),
                    containsBookKeyword: catalogString.includes('book'),
                    containsLayflatKeyword: catalogString.includes('layflat') || catalogString.includes('lay-flat'),
                    containsHardcoverKeyword: catalogString.includes('hardcover') || catalogString.includes('hard cover'),
                    containsPressBookKeyword: catalogString.includes('press')
                };
                
            } else {
                const errorText = await catalogResponse.text();
                results.catalog = {
                    success: false,
                    error: errorText.substring(0, 100)
                };
            }
            
            // Test 3: Editor API capabilities
            console.log('\n🎨 Step 3: Checking Editor API...');
            if (printService.editorKeyId && printService.editorKeySecret) {
                results.editorAPI = {
                    configured: true,
                    hasCredentials: true,
                    keyIdLength: printService.editorKeyId.length,
                    editorUrl: printService.editorBaseUrl
                };
                
                // According to WHCC docs, Editor API supports:
                results.editorAPI.documentedSupport = {
                    albums: true,  // "Albums with various cover and debossing options"
                    flatCards: true,  // "5x7 Flat Cards with optional boutique shapes and foils"
                    prints: true,  // "Photo and Fine Art Prints"
                    framedPrints: true  // "Framed Prints"
                };
                
                console.log('✅ Editor API configured and ready');
            } else {
                results.editorAPI = {
                    configured: false,
                    hasCredentials: false
                };
            }
            
        } else {
            results.authentication = {
                success: false,
                error: 'Failed to get access token'
            };
        }
        
        // Generate recommendations
        results.recommendations = [];
        
        if (results.catalog.productTypes?.albums === 0 && results.catalog.productTypes?.books === 0) {
            if (results.editorAPI.configured) {
                results.recommendations.push('Albums/Books not in Order Submit catalog but Editor API is configured - they should be available through Editor API');
            } else {
                results.recommendations.push('Contact WHCC to enable Albums/Books for your account (#443225)');
            }
        } else if (results.catalog.productTypes?.albums > 0 || results.catalog.productTypes?.books > 0) {
            results.recommendations.push('✅ Albums/Books ARE available in your catalog!');
        }
        
        if (results.catalog.productTypes?.metalPrints === 0) {
            results.recommendations.push('Metal prints not found - may need to be enabled for your account');
        }
        
        console.log('\n✅ DEEP DIVE COMPLETE');
        console.log('='.repeat(60));
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            results: results
        });
        
    } catch (error) {
        console.error('❌ Deep dive error:', error);
        res.status(500).json({
            error: 'Deep dive failed',
            message: error.message
        });
    }
});

module.exports = router;
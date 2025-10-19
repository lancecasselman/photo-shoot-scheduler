// Photo Sales API Routes
// Handles print orders and digital downloads for for-sale photos

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db.ts');
const { photoForSaleSettings, downloadTokens, digitalTransactions, photographySessions } = require('../shared/schema');
const { eq, and } = require('drizzle-orm');
const router = express.Router();

// WHCC print service removed - functionality disabled

// Router-level safeguard for any remaining WHCC/print endpoints
router.all(['/whcc*', '/print*', '/products', '/client-print-order'], (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'All print functionality is no longer available'
    });
});

// Configurable default pricing settings
const DEFAULT_PRINT_MARKUP_PERCENTAGE = Number.isFinite(parseFloat(process.env.DEFAULT_PRINT_MARKUP_PERCENTAGE)) ? parseFloat(process.env.DEFAULT_PRINT_MARKUP_PERCENTAGE) : 25; // 25%
const DEFAULT_MIN_PRINT_PRICE = Number.isFinite(parseFloat(process.env.DEFAULT_MIN_PRINT_PRICE)) ? parseFloat(process.env.DEFAULT_MIN_PRINT_PRICE) : 5.00; // $5.00
const DEFAULT_DIGITAL_PRICE = Number.isFinite(parseFloat(process.env.DEFAULT_DIGITAL_PRICE)) ? parseFloat(process.env.DEFAULT_DIGITAL_PRICE) : 25.00; // $25.00

// Customer info validation utilities
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return { valid: false, error: 'Please enter a valid email address' };
    }
    
    if (email.length > 254) {
        return { valid: false, error: 'Email address is too long' };
    }
    
    return { valid: true, sanitized: email.trim().toLowerCase() };
}

function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'Phone number is required for shipping' };
    }
    
    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length < 10) {
        return { valid: false, error: 'Phone number must be at least 10 digits' };
    }
    
    if (digitsOnly.length > 15) {
        return { valid: false, error: 'Phone number is too long' };
    }
    
    return { valid: true, sanitized: phone.trim() };
}

function validateName(name, fieldName = 'Name') {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: `${fieldName} is required` };
    }
    
    const trimmed = name.trim();
    if (trimmed.length < 1) {
        return { valid: false, error: `${fieldName} is required` };
    }
    
    if (trimmed.length > 100) {
        return { valid: false, error: `${fieldName} is too long (max 100 characters)` };
    }
    
    // Check for suspicious patterns (basic XSS prevention)
    if (/<script|javascript:|on\w+=/i.test(trimmed)) {
        return { valid: false, error: `${fieldName} contains invalid characters` };
    }
    
    return { valid: true, sanitized: trimmed };
}

function validateAddress(address) {
    if (!address || typeof address !== 'object') {
        return { valid: false, error: 'Shipping address is required' };
    }
    
    const errors = [];
    const sanitized = {};
    
    // Validate address line 1
    const addr1 = validateName(address.line1 || address.address1, 'Street address');
    if (!addr1.valid) {
        errors.push(addr1.error);
    } else {
        sanitized.line1 = addr1.sanitized;
    }
    
    // Validate city
    const city = validateName(address.city, 'City');
    if (!city.valid) {
        errors.push(city.error);
    } else {
        sanitized.city = city.sanitized;
    }
    
    // Validate state/province
    if (!address.state || typeof address.state !== 'string' || address.state.trim().length < 2) {
        errors.push('State/Province is required (at least 2 characters)');
    } else {
        sanitized.state = address.state.trim().toUpperCase();
    }
    
    // Validate postal code
    if (!address.postal_code && !address.zip) {
        errors.push('Postal/ZIP code is required');
    } else {
        const postalCode = address.postal_code || address.zip;
        if (!/^[A-Za-z0-9\s\-]{3,10}$/.test(postalCode)) {
            errors.push('Please enter a valid postal/ZIP code');
        } else {
            sanitized.postal_code = postalCode.trim().toUpperCase();
        }
    }
    
    // Validate country
    const allowedCountries = ['US', 'CA', 'USA', 'CAN'];
    const country = (address.country || 'US').toUpperCase();
    if (!allowedCountries.includes(country)) {
        errors.push('Currently, we only ship to US and Canada');
    } else {
        sanitized.country = country === 'USA' ? 'US' : (country === 'CAN' ? 'CA' : country);
    }
    
    // Optional address line 2
    if (address.line2 || address.address2) {
        const addr2 = validateName(address.line2 || address.address2, 'Address line 2');
        if (!addr2.valid) {
            errors.push(addr2.error);
        } else {
            sanitized.line2 = addr2.sanitized;
        }
    }
    
    if (errors.length > 0) {
        return { valid: false, errors };
    }
    
    return { valid: true, sanitized };
}

function validateCustomerInfo(customerInfo, requireShipping = false) {
    if (!customerInfo || typeof customerInfo !== 'object') {
        return { 
            valid: false, 
            error: 'Customer information is required',
            code: 'CUSTOMER_INFO_REQUIRED'
        };
    }
    
    const errors = [];
    const sanitized = {};
    
    // Validate name
    const name = validateName(customerInfo.name || `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim(), 'Customer name');
    if (!name.valid) {
        errors.push(name.error);
    } else {
        sanitized.name = name.sanitized;
    }
    
    // Validate email
    const email = validateEmail(customerInfo.email);
    if (!email.valid) {
        errors.push(email.error);
    } else {
        sanitized.email = email.sanitized;
    }
    
    // Validate phone (optional for digital, required for print)
    if (customerInfo.phone) {
        const phone = validatePhone(customerInfo.phone);
        if (!phone.valid) {
            errors.push(phone.error);
        } else {
            sanitized.phone = phone.sanitized;
        }
    } else if (requireShipping) {
        errors.push('Phone number is required for shipping orders');
    }
    
    // Validate shipping address (required for print orders)
    if (requireShipping) {
        if (!customerInfo.address && !customerInfo.shipping) {
            errors.push('Shipping address is required for print orders');
        } else {
            const address = validateAddress(customerInfo.address || customerInfo.shipping);
            if (!address.valid) {
                errors.push(...(address.errors || [address.error]));
            } else {
                sanitized.address = address.sanitized;
            }
        }
    }
    
    if (errors.length > 0) {
        return { 
            valid: false, 
            errors,
            error: errors[0], // First error for backward compatibility
            code: 'CUSTOMER_INFO_INVALID'
        };
    }
    
    return { valid: true, sanitized };
}

// Centralized Stripe error mapping for consistent error responses
function mapStripeErrorToResponse(stripeError, context = '') {
    console.error(`❌ Stripe session creation failed${context ? ' for ' + context : ''}:`, stripeError);
    
    if (stripeError.type === 'StripeRateLimitError') {
        return {
            status: 429,
            response: { 
                error: 'Too many requests',
                details: 'Please wait a moment and try again.',
                code: 'RATE_LIMIT'
            }
        };
    } else if (stripeError.type === 'StripeInvalidRequestError') {
        console.error('Stripe invalid request error details:', stripeError.param, stripeError.message);
        
        // Check for specific parameter issues
        if (stripeError.param && stripeError.param.includes('line_items')) {
            return {
                status: 400,
                response: { 
                    error: 'Product configuration error',
                    details: 'There was an issue with one or more products in your order. Please review your selections and try again.',
                    code: 'PRODUCT_CONFIG_ERROR'
                }
            };
        } else if (stripeError.param && stripeError.param.includes('shipping')) {
            return {
                status: 400,
                response: { 
                    error: 'Shipping configuration error',
                    details: 'There was an issue with shipping options. Please try again or contact support.',
                    code: 'SHIPPING_CONFIG_ERROR'
                }
            };
        } else {
            return {
                status: 400,
                response: { 
                    error: 'Invalid request',
                    details: 'There was an issue with your order. Please try again or contact support.',
                    code: 'INVALID_REQUEST'
                }
            };
        }
    } else if (stripeError.type === 'StripeAPIError') {
        return {
            status: 503,
            response: { 
                error: 'Payment system temporarily unavailable',
                details: 'Our payment system is experiencing issues. Please try again in a few minutes.',
                code: 'PAYMENT_SYSTEM_ERROR'
            }
        };
    } else if (stripeError.type === 'StripeConnectionError') {
        return {
            status: 503,
            response: { 
                error: 'Connection error',
                details: 'Unable to connect to payment system. Please check your internet connection and try again.',
                code: 'CONNECTION_ERROR'
            }
        };
    } else if (stripeError.type === 'StripeAuthenticationError') {
        console.error('❌ Stripe authentication error - check API keys');
        return {
            status: 500,
            response: { 
                error: 'Payment system configuration error',
                details: 'There is a configuration issue with our payment system. Please contact support.',
                code: 'PAYMENT_CONFIG_ERROR'
            }
        };
    } else {
        // Unknown Stripe error
        console.error('❌ Unknown Stripe error:', stripeError);
        return {
            status: 500,
            response: { 
                error: 'Payment processing error',
                details: 'An unexpected error occurred while processing your payment. Please try again.',
                code: 'UNKNOWN_PAYMENT_ERROR'
            }
        };
    }
}

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

// SECURITY: Validate photo belongs to gallery session (for client orders)
async function validateGalleryPhotoAccess(gallerySession, photoUrl) {
    try {
        // Check if photo belongs to the gallery session
        if (!gallerySession || !gallerySession.photos || !Array.isArray(gallerySession.photos)) {
            console.warn('⚠️ Gallery session has no photos:', gallerySession?.id);
            return false;
        }
        
        // Check if photoUrl is in the gallery's photo list
        const photoExists = gallerySession.photos.some(photo => 
            photo.url === photoUrl || 
            photo.filename === photoUrl.split('/').pop() ||
            photoUrl.includes(photo.filename)
        );
        
        if (photoExists) {
            console.log('✅ Gallery photo access validated:', { sessionId: gallerySession.id, photoUrl });
            return true;
        }
        
        console.warn('⚠️ Photo not found in gallery:', { sessionId: gallerySession.id, photoUrl });
        return false;
        
    } catch (error) {
        console.error('❌ Error validating gallery photo access:', error);
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
        
        // Apply pricing logic (admin settings if userId provided, otherwise defaults)
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
                    const mpRaw = settings.printMarkupPercentage;
                    const minRaw = settings.minPrintPrice;
                    const mpParsed = (mpRaw === null || mpRaw === '') ? NaN : parseFloat(mpRaw);
                    const minParsed = (minRaw === null || minRaw === '') ? NaN : parseFloat(minRaw);
                    const markupPercentage = Number.isFinite(mpParsed) ? mpParsed : DEFAULT_PRINT_MARKUP_PERCENTAGE;
                    const minPrice = Number.isFinite(minParsed) ? minParsed : DEFAULT_MIN_PRINT_PRICE;
                    
                    finalPrice = basePrice * (1 + markupPercentage / 100);
                    finalPrice = Math.max(finalPrice, minPrice); // Enforce minimum
                    
                    console.log(`📈 Applied ${markupPercentage}% markup: $${basePrice} → $${finalPrice.toFixed(2)} (min: $${minPrice})`);
                } else {
                    // Apply configurable default markup if no settings found
                    finalPrice = basePrice * (1 + DEFAULT_PRINT_MARKUP_PERCENTAGE / 100);
                    finalPrice = Math.max(finalPrice, DEFAULT_MIN_PRINT_PRICE); // Enforce minimum price
                    console.log(`📈 Applied default ${DEFAULT_PRINT_MARKUP_PERCENTAGE}% markup: $${basePrice} → $${finalPrice.toFixed(2)} (min: $${DEFAULT_MIN_PRINT_PRICE})`);  
                }
            } catch (dbError) {
                console.warn('⚠️ Could not fetch admin pricing settings, using default markup:', dbError.message);
                finalPrice = basePrice * (1 + DEFAULT_PRINT_MARKUP_PERCENTAGE / 100); // Apply configurable default markup
                finalPrice = Math.max(finalPrice, DEFAULT_MIN_PRINT_PRICE); // Enforce minimum price
            }
        } else {
            // Apply defaults when no userId provided (e.g., public pricing preview)
            finalPrice = basePrice * (1 + DEFAULT_PRINT_MARKUP_PERCENTAGE / 100);
            finalPrice = Math.max(finalPrice, DEFAULT_MIN_PRINT_PRICE);
            console.log(`📈 Applied default pricing (no user): ${DEFAULT_PRINT_MARKUP_PERCENTAGE}% markup, min $${DEFAULT_MIN_PRINT_PRICE}`);
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
            const priceRaw = result[0].digitalPrice;
            const priceParsed = (priceRaw === null || priceRaw === '') ? NaN : parseFloat(priceRaw);
            if (Number.isFinite(priceParsed)) {
                return Math.round(priceParsed * 100) / 100;
            }
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
            const fallbackRaw = fallbackResult[0].digitalPrice;
            const fallbackParsed = (fallbackRaw === null || fallbackRaw === '') ? NaN : parseFloat(fallbackRaw);
            if (Number.isFinite(fallbackParsed)) {
                return Math.round(fallbackParsed * 100) / 100;
            }
        }
        
        // Default digital price if no settings found
        return Math.round(DEFAULT_DIGITAL_PRICE * 100) / 100;
        
    } catch (error) {
        console.warn('⚠️ Could not fetch digital price, using default:', error.message);
        return Math.round(DEFAULT_DIGITAL_PRICE * 100) / 100;
    }
}

// Public endpoint for WHCC status check (no auth required)
router.get('/whcc-status', (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'WHCC status endpoint is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
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

// Public endpoint for WHCC products (no auth required) - DISABLED
router.get('/products', (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'Product catalog is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
    try {
        console.log('📦 Fetching WHCC products for public display...');
        
        const products = await getWHCCCatalog();
        
        return res.json({
            products: products,
            success: true,
            count: products.length
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch WHCC products:', error);
        return res.status(500).json({
            error: 'Failed to load print products',
            message: 'Unable to load available print products. Please try again later.'
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

// SECURE gallery access middleware - headers only (prevents token leakage)
const requireGalleryAccess = async (req, res, next) => {
    try {
        // SECURITY: Only accept gallery tokens from secure headers (no query/body leakage)
        const accessToken = req.headers['x-gallery-token'];
        
        if (!accessToken) {
            return res.status(401).json({ 
                error: 'Gallery access required',
                message: 'Please provide a valid gallery access token to place orders'
            });
        }
        
        // Validate gallery access token and get session info
        const { photographySessions } = require('../shared/schema');
        const gallerySession = await db.select()
            .from(photographySessions)
            .where(eq(photographySessions.galleryAccessToken, accessToken))
            .limit(1);
        
        if (gallerySession.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid gallery access',
                message: 'Gallery access token is invalid or expired'
            });
        }
        
        const session = gallerySession[0];
        
        // Check if gallery access has expired
        if (session.galleryExpiresAt && new Date() > new Date(session.galleryExpiresAt)) {
            return res.status(401).json({ 
                error: 'Gallery access expired',
                message: 'This gallery link has expired. Please contact the photographer for a new link.'
            });
        }
        
        // Add session and user info to request for downstream use
        req.gallerySession = session;
        req.galleryUserId = session.userId;
        req.accessToken = accessToken;
        
        console.log('✅ Gallery access validated for session:', session.id);
        next();
        
    } catch (error) {
        console.error('❌ Gallery access validation error:', error);
        return res.status(500).json({ 
            error: 'Gallery access validation failed',
            message: 'Unable to validate gallery access. Please try again.'
        });
    }
};

// DEEP DIVE TEST ENDPOINT - Protected for admin use
// NOTE: In production, this should be admin-only or disabled
router.get('/whcc-complete-test', requireAuth, (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'WHCC test endpoint is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
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

// Public endpoint for product catalog (no auth required for gallery clients) - DISABLED
router.get('/products', (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'Product catalog is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
    try {
        console.log('📦 Fetching WHCC product catalog (public)...');
        
        const result = await printService.getProducts();
        const products = Array.isArray(result) ? result : (result.products || []);
        
        console.log(`✅ Retrieved ${products.length} WHCC products for public display`);
        
        res.json({
            products: products,
            success: true,
            count: products.length
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch WHCC products:', error);
        
        // Return fallback catalog with albums included - using elegant "No Image" placeholders since WHCC doesn't provide product images
        const fallbackProducts = [
            // Albums - we confirmed these are available
            { category: 'Albums', name: '10x10 Album', productUID: 'album-10x10', price: 299.99, sizes: [{width: 10, height: 10, price: 299.99}] },
            { category: 'Albums', name: '12x12 Album', productUID: 'album-12x12', price: 349.99, sizes: [{width: 12, height: 12, price: 349.99}] },
            { category: 'Albums', name: '8x8 Album', productUID: 'album-8x8', price: 249.99, sizes: [{width: 8, height: 8, price: 249.99}] },
            { category: 'Albums', name: '11x14H Album', productUID: 'album-11x14h', price: 329.99, sizes: [{width: 11, height: 14, price: 329.99}] },
            { category: 'Albums', name: '11x14V Album', productUID: 'album-11x14v', price: 329.99, sizes: [{width: 14, height: 11, price: 329.99}] },
            
            // Books
            { category: 'Books', name: 'Photo Print 2up Yearbook', productUID: 'book-yearbook', price: 199.99, sizes: [{width: 8, height: 10, price: 199.99}] },
            
            // Metal Prints - confirmed available
            { category: 'Metal Prints', name: 'Metal Print 8x10', productUID: 'metal-8x10', price: 59.99, sizes: [{width: 8, height: 10, price: 59.99}] },
            { category: 'Metal Prints', name: 'Metal Print 11x14', productUID: 'metal-11x14', price: 89.99, sizes: [{width: 11, height: 14, price: 89.99}] },
            { category: 'Metal Prints', name: 'Metal Print 16x20', productUID: 'metal-16x20', price: 129.99, sizes: [{width: 16, height: 20, price: 129.99}] },
            { category: 'Metal Prints', name: 'Metal Print 20x24', productUID: 'metal-20x24', price: 179.99, sizes: [{width: 20, height: 24, price: 179.99}] },
            { category: 'Metal Prints', name: 'Metal Print 24x30', productUID: 'metal-24x30', price: 249.99, sizes: [{width: 24, height: 30, price: 249.99}] },
            { category: 'Metal Prints', name: 'Metal Print 30x40', productUID: 'metal-30x40', price: 379.99, sizes: [{width: 30, height: 40, price: 379.99}] },
            
            // Standard Prints
            { category: 'Photographic Prints', name: 'Photo Print 4x6', productUID: 'print-4x6', price: 2.99, sizes: [{width: 4, height: 6, price: 2.99}] },
            { category: 'Photographic Prints', name: 'Photo Print 5x7', productUID: 'print-5x7', price: 4.99, sizes: [{width: 5, height: 7, price: 4.99}] },
            { category: 'Photographic Prints', name: 'Photo Print 8x10', productUID: 'print-8x10', price: 9.99, sizes: [{width: 8, height: 10, price: 9.99}] },
            { category: 'Photographic Prints', name: 'Photo Print 11x14', productUID: 'print-11x14', price: 19.99, sizes: [{width: 11, height: 14, price: 19.99}] },
            { category: 'Photographic Prints', name: 'Photo Print 16x20', productUID: 'print-16x20', price: 39.99, sizes: [{width: 16, height: 20, price: 39.99}] },
            
            // Canvas
            { category: 'Canvas Prints', name: 'Canvas Print 8x10', productUID: 'canvas-8x10', price: 49.99, sizes: [{width: 8, height: 10, price: 49.99}] },
            { category: 'Canvas Prints', name: 'Canvas Print 11x14', productUID: 'canvas-11x14', price: 69.99, sizes: [{width: 11, height: 14, price: 69.99}] },
            { category: 'Canvas Prints', name: 'Canvas Print 16x20', productUID: 'canvas-16x20', price: 99.99, sizes: [{width: 16, height: 20, price: 99.99}] },
            { category: 'Canvas Prints', name: 'Canvas Print 20x24', productUID: 'canvas-20x24', price: 149.99, sizes: [{width: 20, height: 24, price: 149.99}] },
            { category: 'Canvas Prints', name: 'Canvas Print 24x30', productUID: 'canvas-24x30', price: 199.99, sizes: [{width: 24, height: 30, price: 199.99}] }
        ];
        
        res.json({
            products: fallbackProducts,
            success: false,
            fallback: true,
            count: fallbackProducts.length,
            message: 'Using fallback catalog - WHCC API temporarily unavailable'
        });
    }
});

// =============================================================================
// CLIENT PRINT ORDERING ENDPOINTS (Gallery Access Token Authentication)
// =============================================================================

// Client endpoint for print orders using gallery access
router.post('/client-print-order', requireGalleryAccess, (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'Client print order functionality is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
    try {
        console.log('🖼️ Processing client print order with gallery access:', req.body);
        
        const { photos, customerInfo } = req.body;
        
        if (!photos || !Array.isArray(photos) || photos.length === 0) {
            return res.status(400).json({
                error: 'No photos selected',
                message: 'Please select at least one photo to print'
            });
        }

        // Validate customer information (shipping required for prints)
        const customerValidation = validateCustomerInfo(customerInfo, true);
        if (!customerValidation.valid) {
            console.error('❌ Client customer info validation failed:', customerValidation.errors || customerValidation.error);
            return res.status(400).json({
                error: 'Invalid customer information',
                details: customerValidation.errors?.join('; ') || customerValidation.error,
                validationErrors: customerValidation.errors || [customerValidation.error]
            });
        }

        // Validate each photo exists in the gallery
        for (const photoOrder of photos) {
            if (!photoOrder.url || !photoOrder.products || !Array.isArray(photoOrder.products)) {
                return res.status(400).json({
                    error: 'Invalid photo order',
                    message: 'Each photo must have a URL and products array'
                });
            }

            // Validate photo belongs to this gallery
            const hasAccess = await validateGalleryPhotoAccess(req.gallerySession, photoOrder.url);
            if (!hasAccess) {
                return res.status(403).json({
                    error: 'Photo access denied',
                    message: 'One or more selected photos are not available in this gallery'
                });
            }
        }

        // Build Stripe line items with server-validated pricing
        const lineItems = [];
        let totalProducts = 0;

        for (const photoOrder of photos) {
            for (const product of photoOrder.products) {
                try {
                    // Validate product price server-side using gallery owner's pricing
                    const validatedPrice = await calculateProductPrice(product, req.galleryUserId);
                    
                    const quantity = product.quantity || 1;
                    totalProducts += quantity;

                    lineItems.push({
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `${product.name || 'Print'} - ${product.size || 'Custom Size'}`,
                                description: `Print of ${photoOrder.filename || 'photo'}`,
                                images: [photoOrder.url]
                            },
                            unit_amount: Math.round(validatedPrice * 100)
                        },
                        quantity: quantity
                    });

                } catch (pricingError) {
                    console.error('❌ Error calculating product price:', pricingError);
                    return res.status(400).json({
                        error: 'Product pricing error',
                        message: 'Unable to calculate price for selected products'
                    });
                }
            }
        }

        if (lineItems.length === 0) {
            return res.status(400).json({
                error: 'No valid products',
                message: 'No valid products found in order'
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
            customer_email: customerValidation.sanitized.email,
            success_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/cancel`,
            metadata: {
                order_type: 'client_print',
                gallery_token: req.accessToken,
                gallery_session_id: req.gallerySession.id,
                photographer_id: req.galleryUserId,
                customer_name: customerValidation.sanitized.name,
                customer_phone: customerValidation.sanitized.phone || '',
                total_products: totalProducts.toString()
            }
        });

        console.log('✅ Client print checkout session created:', session.id);
        
        res.json({
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id,
            totalProducts: totalProducts
        });

    } catch (error) {
        console.error('❌ Client print order failed:', error);
        
        // Handle Stripe-specific errors
        if (error.type && error.type.startsWith('Stripe')) {
            const errorMapping = mapStripeErrorToResponse(error, 'client print order');
            return res.status(errorMapping.status).json(errorMapping.response);
        }

        res.status(500).json({
            error: 'Print order failed',
            message: 'Unable to process print order. Please try again.'
        });
    }
});

// Client endpoint for digital photo orders using gallery access
router.post('/client-digital-order', requireGalleryAccess, async (req, res) => {
    try {
        console.log('📱 Processing client digital photo order with gallery access:', req.body);
        
        const { photoUrl, filename, customerInfo } = req.body;
        
        if (!photoUrl || !filename) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Photo URL and filename are required'
            });
        }

        // Validate customer information (shipping not required for digital)
        const customerValidation = validateCustomerInfo(customerInfo, false);
        if (!customerValidation.valid) {
            console.error('❌ Client digital customer info validation failed:', customerValidation.errors || customerValidation.error);
            return res.status(400).json({
                error: 'Invalid customer information',
                details: customerValidation.errors?.join('; ') || customerValidation.error,
                validationErrors: customerValidation.errors || [customerValidation.error]
            });
        }

        // Validate photo belongs to this gallery
        const hasAccess = await validateGalleryPhotoAccess(req.gallerySession, photoUrl);
        if (!hasAccess) {
            return res.status(403).json({
                error: 'Photo access denied',
                message: 'Selected photo is not available in this gallery'
            });
        }

        // Get digital photo price from gallery owner's settings
        const validatedPrice = await getDigitalPhotoPrice(req.galleryUserId, photoUrl);
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
                    unit_amount: Math.round(validatedPrice * 100)
                },
                quantity: 1
            }],
            customer_email: customerValidation.sanitized.email,
            success_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/cancel`,
            metadata: {
                order_type: 'client_digital',
                gallery_token: req.accessToken,
                gallery_session_id: req.gallerySession.id,
                photographer_id: req.galleryUserId,
                photo_url: photoUrl,
                filename: filename,
                customer_name: customerValidation.sanitized.name,
                customer_email: customerValidation.sanitized.email
            }
        });

        console.log('✅ Client digital checkout session created:', session.id);
        
        res.json({
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id,
            price: validatedPrice
        });

    } catch (error) {
        console.error('❌ Client digital order failed:', error);
        
        // Handle Stripe-specific errors
        if (error.type && error.type.startsWith('Stripe')) {
            const errorMapping = mapStripeErrorToResponse(error, 'client digital order');
            return res.status(errorMapping.status).json(errorMapping.response);
        }

        res.status(500).json({
            error: 'Digital order failed',
            message: 'Unable to process digital order. Please try again.'
        });
    }
});

// Test endpoint for client print ordering (no auth, just gallery token)
router.post('/gallery/test-order', (req, res, next) => {
    console.log('🧪 GALLERY TEST ENDPOINT HIT - Request reached photo-sales routes:', {
        method: req.method,
        path: req.path,
        headers: {
            'x-gallery-token': req.headers['x-gallery-token'],
            'user-agent': req.headers['user-agent']
        },
        timestamp: new Date().toISOString()
    });
    next();
}, requireGalleryAccess, async (req, res) => {
    try {
        console.log('🧪 Testing client print order with gallery access...');
        
        // Simple test response
        res.json({
            success: true,
            message: 'Client print ordering is working!',
            gallerySessionId: req.gallerySession.id,
            photographerId: req.galleryUserId,
            galleryPhotosCount: req.gallerySession.photos?.length || 0,
            accessToken: req.accessToken
        });

    } catch (error) {
        console.error('❌ Client order test failed:', error);
        res.status(500).json({
            error: 'Test failed',
            message: error.message
        });
    }
});

// =============================================================================
// PHOTOGRAPHER ENDPOINTS (User Authentication Required)
// =============================================================================

// Apply authentication middleware to all protected routes
router.use(requireAuth);

// Digital photo purchase endpoint
router.post('/digital-order', async (req, res) => {
    try {
        console.log('📱 Processing digital photo order:', req.body);
        
        const { photoUrl, filename, customerInfo, sessionId, galleryToken } = req.body;
        
        if (!photoUrl || !filename) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: 'Photo URL and filename are required',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }
        
        // Validate customer information for digital orders (shipping not required)
        if (customerInfo) {
            const customerValidation = validateCustomerInfo(customerInfo, false);
            if (!customerValidation.valid) {
                console.error('❌ Customer info validation failed:', customerValidation.errors || customerValidation.error);
                return res.status(400).json({
                    error: 'Invalid customer information',
                    details: customerValidation.errors?.join('; ') || customerValidation.error,
                    code: customerValidation.code || 'CUSTOMER_INFO_INVALID',
                    validationErrors: customerValidation.errors
                });
            }
            // Use sanitized customer info for security
            req.body.customerInfo = customerValidation.sanitized;
        }
        
        // SECURITY: Get userId from authenticated session, never trust client
        const userId = req.user?.uid || req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // SECURITY: If sessionId provided, validate photo belongs to that session
        if (sessionId) {
            try {
                const { sessionFiles } = require('../shared/schema');
                const photoSession = await db.select()
                    .from(photographySessions)
                    .where(and(
                        eq(photographySessions.id, sessionId),
                        eq(photographySessions.userId, userId)
                    ))
                    .limit(1);
                
                if (photoSession.length === 0) {
                    return res.status(403).json({ 
                        error: 'Access denied: Session not found or not owned by user',
                        code: 'SESSION_ACCESS_DENIED'
                    });
                }
                
                // Validate photo belongs to this session (check if photo exists in session.photos)
                const session = photoSession[0];
                const photos = session.photos || [];
                const photoExists = photos.some(photo => 
                    photo.url === photoUrl || 
                    photo.filename === filename ||
                    photoUrl.includes(photo.filename)
                );
                
                if (!photoExists) {
                    return res.status(403).json({ 
                        error: 'Access denied: Photo not found in this session',
                        code: 'PHOTO_NOT_IN_SESSION'
                    });
                }
                
                console.log(`✅ Photo ownership validated for session ${sessionId}`);
            } catch (error) {
                console.error('❌ Error validating photo session ownership:', error);
                return res.status(500).json({ 
                    error: 'Validation error',
                    details: 'Unable to validate photo ownership',
                    code: 'VALIDATION_ERROR'
                });
            }
        } else {
            // SECURITY: Validate photo ownership before processing (legacy check)
            const hasAccess = await validatePhotoOwnership(userId, photoUrl);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied: Photo not owned by user' });
            }
        }
        
        // SECURITY: Calculate price server-side, never trust client
        const validatedPrice = await getDigitalPhotoPrice(userId, photoUrl);
        console.log(`💰 Server-validated digital price: $${validatedPrice}`);
        
        // Build success URL with sessionId and galleryToken if provided
        let successUrl = `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&type=digital`;
        if (sessionId && galleryToken) {
            successUrl += `&photography_session_id=${encodeURIComponent(sessionId)}&gallery_token=${encodeURIComponent(galleryToken)}`;
        }
        
        // Create Stripe checkout session for digital download
        let session;
        try {
            session = await stripe.checkout.sessions.create({
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
                    filename: filename,
                    sessionId: sessionId || '', // Photography session ID
                    galleryToken: galleryToken || '',
                    userId: userId
                },
                success_url: successUrl,
                cancel_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/print-checkout.html?cancelled=true`
            });
            
            console.log('✅ Created Stripe session for digital download:', session.id);
            
        } catch (stripeError) {
            const errorMapping = mapStripeErrorToResponse(stripeError, 'digital download');
            return res.status(errorMapping.status).json(errorMapping.response);
        }
        
        // Validate that session was created successfully
        if (!session || !session.url) {
            console.error('❌ Stripe session created but missing checkout URL');
            return res.status(500).json({ 
                error: 'Payment setup incomplete',
                details: 'Unable to set up payment page. Please try again.',
                code: 'CHECKOUT_SETUP_ERROR'
            });
        }
        
        res.json({
            checkoutUrl: session.url,
            sessionId: session.id
        });
        
    } catch (error) {
        console.error('❌ Digital order failed:', error);
        
        // Check for common non-Stripe errors
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            return res.status(503).json({ 
                error: 'Network connectivity issue',
                details: 'Unable to connect to our servers. Please check your internet connection and try again.',
                code: 'NETWORK_ERROR'
            });
        } else if (error.message.includes('timeout')) {
            return res.status(504).json({ 
                error: 'Request timeout',
                details: 'The request took too long to process. Please try again.',
                code: 'TIMEOUT_ERROR'
            });
        } else if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                error: 'Invalid data',
                details: 'Some of the provided information is invalid. Please check your details and try again.',
                code: 'VALIDATION_ERROR'
            });
        } else {
            // Generic fallback error
            return res.status(500).json({ 
                error: 'Processing error',
                details: 'An unexpected error occurred. Please try again, and contact support if the problem persists.',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});

// Print order endpoint with WHCC integration
router.post('/print-order', (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'Print order functionality is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
    try {
        console.log('🖼️ Processing print order:', req.body);
        
        const { photoUrl, filename, products, customerInfo, galleryToken } = req.body;
        
        if (!photoUrl || !filename || !products || !Array.isArray(products)) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: 'Photo URL, filename, and products are required',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }
        
        // Validate customer information for print orders (shipping required)
        if (customerInfo) {
            const customerValidation = validateCustomerInfo(customerInfo, true);
            if (!customerValidation.valid) {
                console.error('❌ Customer info validation failed:', customerValidation.errors || customerValidation.error);
                return res.status(400).json({
                    error: 'Invalid customer information',
                    details: customerValidation.errors?.join('; ') || customerValidation.error,
                    code: customerValidation.code || 'CUSTOMER_INFO_INVALID',
                    validationErrors: customerValidation.errors
                });
            }
            // Use sanitized customer info for security
            req.body.customerInfo = customerValidation.sanitized;
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
        let session;
        try {
            session = await stripe.checkout.sessions.create({
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
                success_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&type=print`,
                cancel_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/print-checkout.html?cancelled=true`
            });
            
            console.log('✅ Created Stripe session for print order:', session.id);
            
        } catch (stripeError) {
            const errorMapping = mapStripeErrorToResponse(stripeError, 'print order');
            return res.status(errorMapping.status).json(errorMapping.response);
        }
        
        // Validate that session was created successfully
        if (!session || !session.url) {
            console.error('❌ Stripe session created but missing checkout URL for print order');
            return res.status(500).json({ 
                error: 'Payment setup incomplete',
                details: 'Unable to set up payment page. Please try again.',
                code: 'CHECKOUT_SETUP_ERROR'
            });
        }
        
        res.json({
            checkoutUrl: session.url,
            sessionId: session.id,
            totalPrice: totalPrice
        });
        
    } catch (error) {
        console.error('❌ Print order failed:', error);
        
        // Check for structured WHCC errors first
        if (error.isWHCCError || error.code?.startsWith('WHCC_')) {
            return res.status(error.status || 500).json({ 
                error: error.message,
                details: error.details,
                code: error.code
            });
        }
        
        // Check for WHCC catalog or pricing errors
        if (error.message.includes('Product') && error.message.includes('not found')) {
            return res.status(400).json({ 
                error: 'Product unavailable',
                details: 'One or more selected products are currently unavailable. Please try different options.',
                code: 'PRODUCT_UNAVAILABLE'
            });
        } else if (error.message.includes('calculateProductPrice')) {
            return res.status(400).json({ 
                error: 'Pricing error',
                details: 'Unable to calculate pricing for your order. Please try again or contact support.',
                code: 'PRICING_ERROR'
            });
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            return res.status(503).json({ 
                error: 'Network connectivity issue',
                details: 'Unable to connect to our servers. Please check your internet connection and try again.',
                code: 'NETWORK_ERROR'
            });
        } else if (error.message.includes('timeout')) {
            return res.status(504).json({ 
                error: 'Request timeout',
                details: 'The request took too long to process. Please try again.',
                code: 'TIMEOUT_ERROR'
            });
        } else if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                error: 'Invalid order data',
                details: 'Some of the order information is invalid. Please check your selections and try again.',
                code: 'VALIDATION_ERROR'
            });
        } else {
            // Generic fallback error
            return res.status(500).json({ 
                error: 'Order processing error',
                details: 'An unexpected error occurred while processing your order. Please try again, and contact support if the problem persists.',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});

// Print order status endpoint (requires auth)
router.get('/order-status/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // SECURITY: Get userId from authenticated session
        const userId = req.user?.uid || req.session?.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        console.log(`📋 Fetching order status for session: ${sessionId}`);
        
        // Query database for order by session ID and user ID
        const { printOrders } = require('../shared/schema');
        const { eq, and } = require('drizzle-orm');
        
        const orders = await db.select()
            .from(printOrders)
            .where(and(
                eq(printOrders.stripeSessionId, sessionId),
                eq(printOrders.userId, userId)
            ));
        
        if (orders.length === 0) {
            return res.status(404).json({ 
                error: 'Order not found',
                details: 'No order found with the provided session ID.',
                code: 'ORDER_NOT_FOUND'
            });
        }
        
        const order = orders[0];
        
        // Get detailed status from WHCC if we have an order ID
        let whccStatus = null;
        if (order.whccOrderId) {
            try {
                whccStatus = await printService.getOrderStatus(order.whccOrderId);
            } catch (whccError) {
                console.warn('⚠️ Could not fetch WHCC status:', whccError.message);
                // Continue with database status if WHCC is unavailable
            }
        }
        
        // Provide comprehensive status information
        const statusResponse = {
            sessionId: sessionId,
            orderId: order.id,
            status: order.status,
            whccStatus: order.whccStatus || whccStatus?.status,
            whccOrderId: order.whccOrderId,
            trackingNumber: order.trackingNumber,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            shippedAt: order.shippedAt,
            totalPrice: order.totalPrice,
            items: (() => {
                try {
                    return order.items ? JSON.parse(order.items) : [];
                } catch (e) {
                    console.warn('⚠️ Failed to parse order items JSON:', e.message);
                    return [];
                }
            })(),
            
            // Human-readable status messages
            statusMessage: getStatusMessage(order.status, order.whccStatus),
            canCancel: canCancelOrder(order.status),
            estimatedDelivery: getEstimatedDelivery(order.status, order.createdAt)
        };
        
        console.log(`✅ Retrieved order status: ${order.status}`);
        
        res.json({
            success: true,
            order: statusResponse
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch order status:', error);
        
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            return res.status(503).json({ 
                error: 'Service temporarily unavailable',
                details: 'Unable to check order status right now. Please try again later.',
                code: 'SERVICE_UNAVAILABLE'
            });
        } else {
            return res.status(500).json({ 
                error: 'Failed to retrieve order status',
                details: 'An error occurred while checking your order status. Please try again.',
                code: 'STATUS_CHECK_ERROR'
            });
        }
    }
});

// Helper functions for order status
function getStatusMessage(status, whccStatus) {
    const currentStatus = whccStatus || status;
    
    switch (currentStatus?.toLowerCase()) {
        case 'pending':
            return 'Your order is being prepared for processing.';
        case 'processing':
        case 'confirmed':
            return 'Your order is being processed and will be printed soon.';
        case 'printing':
        case 'production':
            return 'Your order is currently being printed.';
        case 'quality_check':
            return 'Your order is undergoing quality inspection.';
        case 'shipped':
            return 'Your order has been shipped and is on its way to you.';
        case 'delivered':
            return 'Your order has been delivered.';
        case 'cancelled':
            return 'Your order has been cancelled.';
        case 'failed':
        case 'error':
            return 'There was an issue with your order. Please contact support.';
        default:
            return 'Your order status is being updated.';
    }
}

function canCancelOrder(status) {
    const cancelableStatuses = ['pending', 'confirmed', 'processing'];
    return cancelableStatuses.includes(status?.toLowerCase());
}

function getEstimatedDelivery(status, createdAt) {
    if (!createdAt) return null;
    
    const orderDate = new Date(createdAt);
    const now = new Date();
    
    switch (status?.toLowerCase()) {
        case 'pending':
        case 'processing':
        case 'confirmed':
            // Typically 3-5 business days for processing + 3-7 days shipping
            const processAndShip = new Date(orderDate);
            processAndShip.setDate(processAndShip.getDate() + 10);
            return processAndShip.toISOString().split('T')[0]; // Return as YYYY-MM-DD
        case 'shipped':
            // Usually 3-7 days for delivery after shipping
            const deliveryDate = new Date(now);
            deliveryDate.setDate(deliveryDate.getDate() + 5);
            return deliveryDate.toISOString().split('T')[0];
        case 'delivered':
            return 'Delivered';
        default:
            return null;
    }
}

// Get purchased photos for a gallery session
router.get('/purchased-photos', async (req, res) => {
    try {
        const { sessionId, galleryToken } = req.query;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing sessionId parameter',
                code: 'MISSING_SESSION_ID'
            });
        }
        
        console.log('🔍 Looking up purchased photos for session:', sessionId);
        
        // SECURITY: Support two authentication methods
        // 1. Gallery token (for client visitors)
        // 2. User authentication (for photographers)
        
        let hasAccess = false;
        
        // Method 1: Check gallery token (for clients viewing the gallery)
        if (galleryToken) {
            const sessionCheck = await db.select()
                .from(photographySessions)
                .where(and(
                    eq(photographySessions.id, sessionId),
                    eq(photographySessions.galleryAccessToken, galleryToken)
                ))
                .limit(1);
            
            if (sessionCheck.length > 0) {
                hasAccess = true;
                console.log('✅ Gallery token validated for session access');
            }
        }
        
        // Method 2: Check user authentication (for photographers)
        if (!hasAccess) {
            const userId = req.user?.uid || req.session?.user?.uid;
            if (userId) {
                const sessionCheck = await db.select()
                    .from(photographySessions)
                    .where(and(
                        eq(photographySessions.id, sessionId),
                        eq(photographySessions.userId, userId)
                    ))
                    .limit(1);
                
                if (sessionCheck.length > 0) {
                    hasAccess = true;
                    console.log('✅ User authentication validated for session access');
                }
            }
        }
        
        // Deny access if neither method succeeded
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: Invalid gallery token or authentication required',
                code: 'SESSION_ACCESS_DENIED'
            });
        }
        
        // Query downloadTokens table for all purchased photos in this session
        const purchasedPhotos = await db.select({
            id: downloadTokens.id,
            token: downloadTokens.token,
            photoUrl: downloadTokens.photoUrl,
            filename: downloadTokens.filename,
            createdAt: downloadTokens.createdAt,
            expiresAt: downloadTokens.expiresAt,
            isUsed: downloadTokens.isUsed,
            usedAt: downloadTokens.usedAt
        })
        .from(downloadTokens)
        .where(eq(downloadTokens.sessionId, sessionId))
        .orderBy(downloadTokens.createdAt);
        
        console.log(`✅ Found ${purchasedPhotos.length} purchased photos for session ${sessionId}`);
        
        // Format the response with download URLs
        const baseUrl = process.env.REPLIT_DEV_DOMAIN || 
                       process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` :
                       'https://photography-app.example.com';
        
        const formattedPhotos = purchasedPhotos.map(photo => ({
            filename: photo.filename,
            photoUrl: photo.photoUrl,
            downloadToken: photo.token,
            downloadUrl: `${baseUrl}/api/print/secure/${photo.token}`,
            purchasedAt: photo.createdAt,
            expiresAt: photo.expiresAt,
            isUsed: photo.isUsed,
            usedAt: photo.usedAt,
            isExpired: photo.expiresAt ? new Date(photo.expiresAt) < new Date() : false
        }));
        
        res.json({
            success: true,
            sessionId: sessionId,
            purchasedPhotos: formattedPhotos,
            count: formattedPhotos.length
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch purchased photos:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch purchased photos',
            message: 'An error occurred while retrieving purchased photos',
            code: 'FETCH_ERROR'
        });
    }
});

// WHCC product catalog endpoint (requires auth)
router.get('/whcc-products', (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'WHCC products endpoint is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
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
        
        // If this is a structured WHCC error, preserve the structure for proper handling
        if (error.isWHCCError) {
            throw error;
        }
        
        // For other errors, wrap them appropriately
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            const wrappedError = new Error('Network connectivity issue');
            wrappedError.details = 'Unable to connect to print service. Please check your internet connection and try again.';
            wrappedError.code = 'WHCC_NETWORK_ERROR';
            wrappedError.status = 503;
            throw wrappedError;
        } else if (error.message.includes('timeout')) {
            const wrappedError = new Error('Print service timeout');
            wrappedError.details = 'The print service took too long to respond. Please try again.';
            wrappedError.code = 'WHCC_TIMEOUT_ERROR';
            wrappedError.status = 504;
            throw wrappedError;
        } else {
            const wrappedError = new Error('Print service error');
            wrappedError.details = 'An unexpected error occurred with the print service. Please try again or contact support.';
            wrappedError.code = 'WHCC_UNKNOWN_ERROR';
            wrappedError.status = 500;
            throw wrappedError;
        }
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
        
        const { photoUrl, filename, sessionId: photographySessionId } = session.metadata;
        const customerEmail = session.customer_details?.email;
        const customerName = session.customer_details?.name || 'Customer';
        
        if (!customerEmail) {
            console.error('❌ No customer email found for digital delivery');
            return;
        }
        
        // Extract photography session ID from metadata (NOT the Stripe session ID)
        const photoSessionId = photographySessionId || session.metadata.sessionId;
        console.log('📸 Photography session ID from metadata:', photoSessionId);
        console.log('💳 Stripe session ID:', session.id);
        
        if (!photoSessionId) {
            console.warn('⚠️ No photography sessionId in metadata, download token may not be linked to gallery');
        }
        
        // 1. Generate a secure download link with expiration
        // Pass the PHOTOGRAPHY session ID, not the Stripe session ID
        const downloadToken = await generateSecureDownloadToken(photoUrl, filename, photoSessionId || session.id);
        
        // Get the correct base URL for download links
        const baseUrl = process.env.REPLIT_DEV_DOMAIN || 
                       process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` :
                       'https://photography-app.example.com';
        
        const downloadUrl = `${baseUrl}/api/print/secure/${downloadToken}`;
        
        // 2. Send download email to customer
        const emailSent = await sendDigitalDownloadEmail({
            customerEmail,
            customerName,
            filename,
            downloadUrl,
            sessionId: session.id
        });
        
        if (emailSent) {
            console.log(`✅ Digital download email sent to ${customerEmail} for ${filename}`);
        } else {
            console.error(`❌ Failed to send download email to ${customerEmail}`);
        }
        
        // 3. Log the transaction in database
        await logDigitalTransaction(session, downloadToken, photoSessionId);
        
        console.log(`✅ Digital download processed for ${filename}`);
        
    } catch (error) {
        console.error('❌ Digital download fulfillment failed:', error);
    }
}

// Generate secure download token with expiration
async function generateSecureDownloadToken(photoUrl, filename, sessionId) {
    const crypto = require('crypto');
    
    // Create unique token
    const tokenData = {
        photoUrl,
        filename,
        sessionId,
        timestamp: Date.now(),
        expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
    };
    
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token in database for validation
    try {
        await db.insert(downloadTokens).values({
            id: uuidv4(),
            token,
            photoUrl,
            filename,
            sessionId,
            expiresAt: new Date(tokenData.expires),
            createdAt: new Date(),
            isUsed: false
        });
        
        console.log(`🔑 Generated download token for ${filename}`);
        return token;
    } catch (error) {
        console.error('❌ Failed to store download token:', error);
        throw error;
    }
}

// Send digital download email using SendGrid
async function sendDigitalDownloadEmail({ customerEmail, customerName, filename, downloadUrl, sessionId }) {
    try {
        if (!process.env.SENDGRID_API_KEY) {
            console.error('❌ SENDGRID_API_KEY not configured');
            return false;
        }
        
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .download-btn { display: inline-block; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📸 Your Digital Download is Ready!</h1>
                        <p>Thank you for your purchase</p>
                    </div>
                    <div class="content">
                        <p>Hi ${customerName},</p>
                        <p>Your high-resolution digital photo download is now available:</p>
                        <p><strong>File:</strong> ${filename}</p>
                        <p><strong>Order ID:</strong> ${sessionId.substring(0, 12)}...</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${downloadUrl}" class="download-btn">📥 Download Your Photo</a>
                        </div>
                        
                        <div class="footer">
                            <p><strong>Important Notes:</strong></p>
                            <ul>
                                <li>This download link will expire in 7 days</li>
                                <li>The link can only be used once</li>
                                <li>Save the file to your device immediately after downloading</li>
                                <li>For questions, please contact us with your order ID</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const msg = {
            to: customerEmail,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourphotography.com',
            subject: `📸 Your Digital Photo Download - ${filename}`,
            text: `Hi ${customerName},\n\nYour digital photo download is ready!\n\nFile: ${filename}\nDownload Link: ${downloadUrl}\n\nThis link expires in 7 days and can only be used once.\n\nThank you for your purchase!`,
            html: emailHtml
        };
        
        await sgMail.send(msg);
        console.log(`📧 Download email sent to ${customerEmail}`);
        return true;
        
    } catch (error) {
        console.error('❌ Failed to send download email:', error);
        return false;
    }
}

// Log digital transaction in database
async function logDigitalTransaction(session, downloadToken, photographySessionId) {
    try {
        // Use photography session ID if available, otherwise fall back to Stripe session ID
        const sessionIdToStore = photographySessionId || session.id;
        
        await db.insert(digitalTransactions).values({
            id: uuidv4(),
            sessionId: sessionIdToStore, // Store photography session ID
            photoUrl: session.metadata.photoUrl,
            filename: session.metadata.filename,
            customerEmail: session.customer_details?.email,
            customerName: session.customer_details?.name,
            amount: session.amount_total,
            downloadToken,
            createdAt: new Date(),
            status: 'completed'
        });
        
        console.log(`📊 Digital transaction logged for photography session ${sessionIdToStore} (Stripe session: ${session.id})`);
    } catch (error) {
        console.error('❌ Failed to log digital transaction:', error);
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
router.get('/whcc-deep-dive', (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'WHCC deep dive endpoint is no longer available'
    });
    return;
    
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

// WHCC Webhook handler for order status updates
router.post('/whcc-webhook', express.raw({type: 'application/json'}), (req, res) => {
    res.status(410).json({
        success: false,
        error: 'WHCC print service has been removed',
        message: 'WHCC webhook endpoint is no longer available'
    });
    return;
    // Original endpoint disabled below
    /*
    const signature = req.headers['whcc-signature'];
    
    // Get raw payload for signature verification
    const rawPayload = req.body.toString('utf8');
    
    try {
        // Verify WHCC webhook signature using consumer secret
        const isValid = printService.verifyWhccSignature(rawPayload, signature, process.env.OAS_CONSUMER_SECRET);
        
        if (!isValid) {
            console.error('❌ WHCC webhook signature verification failed');
            return res.status(401).send('Unauthorized');
        }
        
        // Parse the webhook payload
        const webhookData = JSON.parse(rawPayload);
        console.log('🔔 WHCC webhook received:', { 
            eventType: webhookData.EventType, 
            orderId: webhookData.OrderID,
            status: webhookData.Status 
        });
        
        // Handle different webhook events
        const eventType = webhookData.EventType || webhookData.event_type;
        const orderId = webhookData.OrderID || webhookData.order_id;
        const status = webhookData.Status || webhookData.status;
        
        console.log(`📦 WHCC Order ${orderId}: ${eventType} - ${status}`);
        
        // Update order status in database using Drizzle ORM
        if (orderId) {
            const { printOrders } = require('../shared/schema');
            const { eq } = require('drizzle-orm');
            
            await db.update(printOrders)
                .set({ 
                    status: status,
                    whccStatus: status,
                    updatedAt: new Date()
                })
                .where(eq(printOrders.whccOrderId, orderId));
            
            // If order is shipped, update tracking info
            if (eventType === 'order.shipped' && webhookData.TrackingNumber) {
                await db.update(printOrders)
                    .set({ 
                        trackingNumber: webhookData.TrackingNumber,
                        shippedAt: new Date()
                    })
                    .where(eq(printOrders.whccOrderId, orderId));
            }
        }
        
        // Send success response
        res.json({ received: true });
        
    } catch (error) {
        console.error('❌ Error processing WHCC webhook:', error);
        res.status(400).send('Bad Request');
    }
    */
});

// Secure download endpoint for digital purchases
router.get('/secure/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        console.log(`🔐 Processing secure download request for token: ${token.substring(0, 8)}...`);
        
        // Find and validate the download token
        const tokenRecord = await db.select().from(downloadTokens)
            .where(eq(downloadTokens.token, token))
            .limit(1);
        
        if (tokenRecord.length === 0) {
            console.warn('⚠️ Invalid download token requested:', token.substring(0, 8));
            return res.status(404).json({ error: 'Invalid or expired download link' });
        }
        
        const download = tokenRecord[0];
        
        // REMOVED: Token expiration and usage restrictions for unlimited downloads
        console.log(`🔓 Token validation passed - unlimited access enabled for ${token.substring(0, 8)}`);
        
        // REMOVED: Token usage marking for unlimited re-downloads
        console.log(`🔓 Token usage tracking disabled - allowing unlimited re-downloads`);
        
        // SECURITY: Get the photography session to validate ownership
        const { photographySessions } = require('../shared/schema');
        const session = await db.select()
            .from(photographySessions)
            .where(eq(photographySessions.id, download.sessionId))
            .limit(1);
        
        if (session.length === 0) {
            console.warn('⚠️ Photography session not found for download token:', download.sessionId);
            return res.status(404).json({ error: 'Session not found' });
        }
        
        const photographerId = session[0].userId;
        const tokenSessionId = download.sessionId;
        const tokenFilename = download.filename;
        
        // SECURITY: Construct the expected R2 key from trusted database fields
        const expectedR2Key = `photographer-${photographerId}/session-${tokenSessionId}/gallery/${tokenFilename}`;
        
        console.log(`🔒 Expected R2 key from trusted data: ${expectedR2Key}`);
        
        // Verify the Stripe session is still valid and paid
        try {
            const stripeSession = await stripe.checkout.sessions.retrieve(download.sessionId);
            
            if (stripeSession.payment_status !== 'paid') {
                console.warn('⚠️ Attempted download for unpaid session:', download.sessionId);
                return res.status(403).json({ error: 'Payment required to access download' });
            }
            
            console.log(`✅ Payment verified for session ${download.sessionId}, file: ${tokenFilename}`);
            
        } catch (stripeError) {
            console.error('❌ Failed to verify Stripe session:', stripeError);
            return res.status(500).json({ error: 'Unable to verify payment status' });
        }
        
        // Stream the file securely from R2 storage
        try {
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            const { S3Client } = require('@aws-sdk/client-s3');
            
            // Initialize S3 client for R2
            const s3Client = new S3Client({
                endpoint: process.env.R2_ENDPOINT,
                region: 'auto',
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
                },
            });
            
            // SECURITY: Extract actual R2 key from photoUrl using proper URL parsing
            let actualR2Key = download.photoUrl;
            
            // If it's a full URL, safely extract the pathname
            if (actualR2Key.includes('://')) {
                try {
                    const url = new URL(actualR2Key);
                    // Remove leading slash from pathname and decode percent-encoding
                    actualR2Key = decodeURIComponent(url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname);
                } catch (urlError) {
                    console.error('❌ Invalid photo URL format:', actualR2Key);
                    return res.status(400).json({ error: 'Invalid photo URL' });
                }
            }
            
            // Normalize both keys by trimming whitespace and decoding
            const normalizedActualKey = actualR2Key.trim();
            const normalizedExpectedKey = expectedR2Key.trim();
            
            // SECURITY: Verify the actual R2 key EXACTLY matches the expected key
            if (normalizedActualKey !== normalizedExpectedKey) {
                console.warn('⚠️ R2 key mismatch - potential tampering detected:', {
                    expected: normalizedExpectedKey,
                    actual: normalizedActualKey,
                    sessionId: download.sessionId
                });
                return res.status(403).json({ error: 'Invalid download - file path mismatch' });
            }
            
            console.log(`📥 Downloading from R2 with validated key: ${normalizedExpectedKey}`);
            
            // Get object from R2 using the validated expected key
            const command = new GetObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: normalizedExpectedKey,
            });
            
            const response = await s3Client.send(command);
            
            if (!response.Body) {
                console.error('❌ No file body returned from R2:', r2Key);
                return res.status(404).json({ error: 'Photo file not found' });
            }
            
            // Set headers for secure file download
            const contentType = response.ContentType || 'image/jpeg';
            const sanitizedFilename = download.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Content-Length', response.ContentLength || 0);
            
            // Stream the file securely
            if (response.Body.pipe) {
                response.Body.pipe(res);
            } else {
                // Handle ReadableStream for newer AWS SDK versions
                const chunks = [];
                const reader = response.Body.getReader();
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
                
                const buffer = Buffer.concat(chunks);
                res.send(buffer);
            }
            
            console.log(`✅ Secure digital download completed for ${download.filename}`);
            
        } catch (r2Error) {
            console.error('❌ Error streaming from R2:', r2Error);
            res.status(500).json({ error: 'Failed to download photo' });
        }
        
    } catch (error) {
        console.error('❌ Secure download error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// SIMPLIFIED PRICING SYSTEM
// SECURE: Calculate vendor cost using only server-side catalog data (no client price tampering)
async function calculateVendorCost(productUID, attributeUIDs = [], quantity = 1) {
    try {
        console.log('🔒 SECURE vendor cost calculation for:', { productUID, attributeUIDs, quantity });
        
        const catalog = await getWHCCCatalog();
        
        // Find the product in WHCC catalog using UID
        const whccProduct = catalog.find(p => 
            p.productUID === productUID || 
            p.id === productUID ||
            p.ProductUID === productUID
        );
        
        if (!whccProduct) {
            console.warn('⚠️ Product not found in WHCC catalog:', productUID);
            throw new Error(`Product ${productUID} not found in WHCC catalog`);
        }
        
        // Start with base product price (WHCC wholesale cost)
        let totalVendorCost = parseFloat(whccProduct.price || whccProduct.Price || 0);
        console.log(`📦 Base product cost (WHCC wholesale): $${totalVendorCost}`);
        
        // SECURE & STRICT: Look up attribute costs from server catalog - FAIL on unknown UIDs
        if (attributeUIDs && attributeUIDs.length > 0) {
            for (const attributeUID of attributeUIDs) {
                let attributeFound = false;
                let attributeCost = 0;
                
                // Try to find attribute in product's attribute catalog
                if (whccProduct.attributes && Array.isArray(whccProduct.attributes)) {
                    const attribute = whccProduct.attributes.find(a => 
                        a.attributeUID === attributeUID || 
                        a.uid === attributeUID ||
                        a.id === attributeUID
                    );
                    
                    if (attribute) {
                        attributeCost = parseFloat(attribute.price || attribute.cost || 0);
                        attributeFound = true;
                        console.log(`🔧 Added secure attribute "${attribute.name || attributeUID}": +$${attributeCost}`);
                    }
                }
                
                // Alternative: Look in options array if not found in attributes
                if (!attributeFound && whccProduct.options) {
                    const option = whccProduct.options.find(o => 
                        o.attributeUID === attributeUID || 
                        o.uid === attributeUID ||
                        o.id === attributeUID
                    );
                    
                    if (option) {
                        attributeCost = parseFloat(option.price || option.cost || 0);
                        attributeFound = true;
                        console.log(`🔧 Added secure option "${option.name || attributeUID}": +$${attributeCost}`);
                    }
                }
                
                // STRICT SECURITY: Fail if attribute UID is unknown (prevents underpricing)
                if (!attributeFound) {
                    console.error(`❌ SECURITY: Unknown attribute UID ${attributeUID} for product ${productUID}`);
                    throw new Error(`Invalid attribute UID: ${attributeUID}. This attribute is not available for product ${productUID}.`);
                }
                
                totalVendorCost += attributeCost;
            }
        }
        
        // Apply quantity
        totalVendorCost *= quantity;
        
        console.log(`✅ SECURE total vendor cost: $${totalVendorCost.toFixed(2)} (qty: ${quantity})`);
        return totalVendorCost;
        
    } catch (error) {
        console.error('❌ Error in secure vendor cost calculation:', error);
        throw error;
    }
}


// SECURE quote endpoint with authentication - no client userId tampering possible
router.post('/quote', requireGalleryAccess, async (req, res) => {
    try {
        console.log('🔒 SECURE pricing quote request (authenticated):', req.body);
        
        const { productUID, attributeUIDs = [], quantity = 1 } = req.body;
        // SECURITY: userId is now derived server-side from authenticated gallery token
        const userId = req.galleryUserId;
        
        // Input validation
        if (!productUID) {
            return res.status(400).json({ error: 'Product UID is required' });
        }
        
        // SECURITY: Validate quantity to prevent misuse
        const quantityNum = parseInt(quantity);
        if (!Number.isInteger(quantityNum) || quantityNum < 1 || quantityNum > 100) {
            return res.status(400).json({ 
                error: 'Invalid quantity', 
                message: 'Quantity must be a whole number between 1 and 100' 
            });
        }
        
        console.log(`🔐 Using server-derived userId: ${userId} (cannot be tampered by client)`);
        
        // SECURE: Calculate vendor cost using only server catalog (no client price tampering)
        const vendorCost = await calculateVendorCost(productUID, attributeUIDs, quantity);
        
        // Apply photographer markup and minimum price (same logic as existing system)
        let finalPrice = vendorCost;
        let markupApplied = DEFAULT_PRINT_MARKUP_PERCENTAGE;
        let minPriceApplied = false;
        
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
                    const mpRaw = settings.printMarkupPercentage;
                    const minRaw = settings.minPrintPrice;
                    const mpParsed = (mpRaw === null || mpRaw === '') ? NaN : parseFloat(mpRaw);
                    const minParsed = (minRaw === null || minRaw === '') ? NaN : parseFloat(minRaw);
                    markupApplied = Number.isFinite(mpParsed) ? mpParsed : DEFAULT_PRINT_MARKUP_PERCENTAGE;
                    const minPrice = Number.isFinite(minParsed) ? minParsed : DEFAULT_MIN_PRINT_PRICE;
                    
                    finalPrice = vendorCost * (1 + markupApplied / 100);
                    if (finalPrice < minPrice) {
                        finalPrice = minPrice;
                        minPriceApplied = true;
                    }
                } else {
                    finalPrice = vendorCost * (1 + DEFAULT_PRINT_MARKUP_PERCENTAGE / 100);
                    finalPrice = Math.max(finalPrice, DEFAULT_MIN_PRINT_PRICE);
                    if (finalPrice === DEFAULT_MIN_PRINT_PRICE) minPriceApplied = true;
                }
            } catch (dbError) {
                console.warn('⚠️ Could not fetch user pricing settings, using defaults:', dbError.message);
                finalPrice = vendorCost * (1 + DEFAULT_PRINT_MARKUP_PERCENTAGE / 100);
                finalPrice = Math.max(finalPrice, DEFAULT_MIN_PRINT_PRICE);
                if (finalPrice === DEFAULT_MIN_PRINT_PRICE) minPriceApplied = true;
            }
        } else {
            finalPrice = vendorCost * (1 + DEFAULT_PRINT_MARKUP_PERCENTAGE / 100);
            finalPrice = Math.max(finalPrice, DEFAULT_MIN_PRINT_PRICE);
            if (finalPrice === DEFAULT_MIN_PRINT_PRICE) minPriceApplied = true;
        }
        
        console.log(`💰 Simple quote complete: $${vendorCost.toFixed(2)} → $${finalPrice.toFixed(2)} (${markupApplied}% markup)`);
        
        // Return simple total price response
        res.json({
            totalPrice: parseFloat(finalPrice.toFixed(2)),
            currency: 'USD',
            vendorCost: parseFloat(vendorCost.toFixed(2)),
            markupPercent: markupApplied,
            minPriceApplied,
            quantity
        });
        
    } catch (error) {
        console.error('❌ Quote calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate quote' });
    }
});

module.exports = router;
/**
 * Download Commerce Module
 * Comprehensive download pricing, Stripe Connect checkout, and entitlement management
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const { drizzle } = require('drizzle-orm/node-postgres');
const { 
    downloadPolicies, 
    downloadOrders, 
    downloadEntitlements, 
    downloadHistory, 
    downloadTokens,
    photographySessions,
    users 
} = require('../shared/schema');
const { eq, and, gte, gt, lte, or, sql } = require('drizzle-orm');

// Initialize SendGrid if available
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Platform fee percentage (configurable via environment variable)
const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 5; // 5% default

class DownloadCommerceManager {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // Initialize drizzle with the pool
        this.db = drizzle(this.pool);
        
        this.stripe = stripe;
        this.stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
        
        if (!this.stripeEnabled) {
            console.warn('⚠️ DOWNLOAD COMMERCE: Stripe not configured - payment features disabled');
        }
        
        console.log('✅ Download Commerce Manager initialized');
    }

    /**
     * Policy Management Methods
     */
    
    // Fetch or create default policy for a session
    async getPolicyForSession(sessionId) {
        try {
            // Try to fetch existing policy
            const existing = await this.db.select()
                .from(downloadPolicies)
                .where(eq(downloadPolicies.sessionId, sessionId))
                .limit(1);
            
            if (existing.length > 0) {
                return {
                    success: true,
                    policy: existing[0]
                };
            }
            
            // Create default policy if none exists
            const defaultPolicy = {
                id: uuidv4(),
                sessionId: sessionId,
                mode: 'free',
                pricePerPhoto: '0.00',
                freeCount: null,
                bulkTiers: [],
                maxPerClient: null,
                maxGlobal: null,
                screenshotProtection: false,
                currency: 'USD',
                taxIncluded: false,
                watermarkPreset: null,
                updatedBy: null,
                updatedAt: new Date(),
                createdAt: new Date()
            };
            
            const created = await this.db.insert(downloadPolicies)
                .values(defaultPolicy)
                .returning();
            
            console.log(`📋 Created default policy for session ${sessionId}`);
            
            return {
                success: true,
                policy: created[0]
            };
            
        } catch (error) {
            console.error('❌ Error fetching/creating policy:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Update pricing policy with validation
    async updatePolicy(sessionId, userId, policyData) {
        try {
            // Validate ownership
            const session = await this.db.select()
                .from(photographySessions)
                .where(and(
                    eq(photographySessions.id, sessionId),
                    eq(photographySessions.userId, userId)
                ))
                .limit(1);
            
            if (session.length === 0) {
                return {
                    success: false,
                    error: 'Session not found or unauthorized'
                };
            }
            
            // Validate pricing mode and data
            const validation = this.validatePricingMode(policyData.mode, policyData);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error
                };
            }
            
            // Update or create policy
            const existing = await this.db.select()
                .from(downloadPolicies)
                .where(eq(downloadPolicies.sessionId, sessionId))
                .limit(1);
            
            const policyId = existing.length > 0 ? existing[0].id : uuidv4();
            
            const policyValues = {
                id: policyId,
                sessionId: sessionId,
                mode: policyData.mode,
                pricePerPhoto: policyData.pricePerPhoto || null,
                freeCount: policyData.freeCount || null,
                bulkTiers: policyData.bulkTiers || [],
                maxPerClient: policyData.maxPerClient || null,
                maxGlobal: policyData.maxGlobal || null,
                screenshotProtection: policyData.screenshotProtection || false,
                currency: policyData.currency || 'USD',
                taxIncluded: policyData.taxIncluded || false,
                watermarkPreset: policyData.watermarkPreset || null,
                updatedBy: userId,
                updatedAt: new Date()
            };
            
            if (existing.length > 0) {
                // Update existing
                const updated = await this.db.update(downloadPolicies)
                    .set(policyValues)
                    .where(eq(downloadPolicies.id, policyId))
                    .returning();
                
                console.log(`📋 Updated policy for session ${sessionId}`);
                return {
                    success: true,
                    policy: updated[0]
                };
            } else {
                // Create new
                policyValues.createdAt = new Date();
                const created = await this.db.insert(downloadPolicies)
                    .values(policyValues)
                    .returning();
                
                console.log(`📋 Created policy for session ${sessionId}`);
                return {
                    success: true,
                    policy: created[0]
                };
            }
            
        } catch (error) {
            console.error('❌ Error updating policy:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Validate pricing mode and data consistency
    validatePricingMode(mode, data) {
        const validModes = ['free', 'fixed', 'freemium', 'per_photo', 'bulk'];
        
        if (!validModes.includes(mode)) {
            return {
                valid: false,
                error: `Invalid pricing mode: ${mode}`
            };
        }
        
        switch (mode) {
            case 'free':
                // Free mode requires no additional data
                return { valid: true };
                
            case 'fixed':
            case 'per_photo':
                // These modes require a price per photo
                if (!data.pricePerPhoto || parseFloat(data.pricePerPhoto) <= 0) {
                    return {
                        valid: false,
                        error: `${mode} mode requires a valid price per photo`
                    };
                }
                return { valid: true };
                
            case 'freemium':
                // Freemium requires free count and price per photo
                if (!data.freeCount || parseInt(data.freeCount) <= 0) {
                    return {
                        valid: false,
                        error: 'Freemium mode requires a valid free count'
                    };
                }
                if (!data.pricePerPhoto || parseFloat(data.pricePerPhoto) <= 0) {
                    return {
                        valid: false,
                        error: 'Freemium mode requires a valid price per photo after free limit'
                    };
                }
                return { valid: true };
                
            case 'bulk':
                // Bulk requires tier configuration
                if (!data.bulkTiers || !Array.isArray(data.bulkTiers) || data.bulkTiers.length === 0) {
                    return {
                        valid: false,
                        error: 'Bulk mode requires pricing tiers'
                    };
                }
                // Validate each tier
                for (const tier of data.bulkTiers) {
                    if (!tier.qty || !tier.price || tier.qty <= 0 || tier.price <= 0) {
                        return {
                            valid: false,
                            error: 'Each bulk tier must have valid quantity and price'
                        };
                    }
                }
                return { valid: true };
                
            default:
                return {
                    valid: false,
                    error: 'Unknown pricing mode'
                };
        }
    }

    /**
     * Get client entitlements for a session
     */
    async getClientEntitlements(sessionId, clientKey) {
        try {
            const entitlements = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.clientKey, clientKey),
                    eq(downloadEntitlements.isActive, true)
                ));
            
            return {
                success: true,
                entitlements: entitlements
            };
        } catch (error) {
            console.error('Error getting client entitlements:', error);
            return {
                success: false,
                error: error.message,
                entitlements: []
            };
        }
    }
    
    /**
     * Create free entitlements for a client
     */
    async createFreeEntitlements(sessionId, clientKey, items) {
        try {
            const entitlementIds = [];
            
            for (const item of items) {
                const entitlementId = uuidv4();
                await this.db.insert(downloadEntitlements)
                    .values({
                        id: entitlementId,
                        sessionId: sessionId,
                        clientKey: clientKey,
                        photoId: item.photoId,
                        remaining: 1, // Explicitly set remaining value
                        isActive: true // Explicitly set active status
                    });
                entitlementIds.push(entitlementId);
            }
            
            console.log(`✅ Created ${entitlementIds.length} free entitlements for ${clientKey}`);
            
            return {
                success: true,
                count: entitlementIds.length,
                entitlementIds: entitlementIds
            };
        } catch (error) {
            console.error('Error creating free entitlements:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Verify if an entitlement exists for a client
     */
    async verifyEntitlement(sessionId, clientKey, photoId) {
        try {
            const entitlement = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.clientKey, clientKey),
                    eq(downloadEntitlements.photoId, photoId),
                    eq(downloadEntitlements.isActive, true)
                ))
                .limit(1);
            
            if (entitlement.length > 0) {
                return {
                    success: true,
                    entitlement: entitlement[0]
                };
            }
            
            return {
                success: false,
                error: 'No entitlement found'
            };
        } catch (error) {
            console.error('Error verifying entitlement:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Checkout & Payment Processing
     */
    
    // Create Stripe Checkout Session for downloads
    async createCheckoutSession(sessionId, clientKey, items, mode = 'payment') {
        try {
            if (!this.stripeEnabled) {
                return {
                    success: false,
                    error: 'Payment processing not configured'
                };
            }
            
            // Generate idempotency key for this checkout attempt
            const idempotencyKey = `checkout_${sessionId}_${clientKey}_${Date.now()}`;
            
            // Get session and photographer details
            const session = await this.db.select()
                .from(photographySessions)
                .where(eq(photographySessions.id, sessionId))
                .limit(1);
            
            if (session.length === 0) {
                return {
                    success: false,
                    error: 'Session not found'
                };
            }
            
            const photographer = await this.db.select()
                .from(users)
                .where(eq(users.id, session[0].userId))
                .limit(1);
            
            if (photographer.length === 0) {
                return {
                    success: false,
                    error: 'Photographer not found'
                };
            }
            
            // Validate photographer's Connect account
            const connectValidation = await this.validatePhotographer(sessionId);
            if (!connectValidation.success) {
                return connectValidation;
            }
            
            // Get policy and calculate total
            const policyResult = await this.getPolicyForSession(sessionId);
            if (!policyResult.success) {
                return policyResult;
            }
            
            const policy = policyResult.policy;
            const totalPrice = await this.calculateTotalPrice(items, policy);
            
            if (totalPrice <= 0) {
                return {
                    success: false,
                    error: 'Invalid price calculation'
                };
            }
            
            // Calculate platform fee
            const platformFee = Math.round(totalPrice * (PLATFORM_FEE_PERCENTAGE / 100));
            
            // Prepare line items (aggregate if too many)
            let lineItems = [];
            if (items.length <= 10) {
                // Individual line items for small carts
                for (const item of items) {
                    const itemPrice = await this.calculateItemPrice(item, policy);
                    lineItems.push({
                        price_data: {
                            currency: policy.currency || 'usd',
                            product_data: {
                                name: `Photo Download: ${item.photoId || item.id}`,
                                description: `High-resolution digital download`,
                                metadata: {
                                    photoId: item.photoId || item.id,
                                    sessionId: sessionId
                                }
                            },
                            unit_amount: Math.round(itemPrice * 100) // Convert to cents
                        },
                        quantity: 1
                    });
                }
            } else {
                // Aggregate for large carts
                lineItems.push({
                    price_data: {
                        currency: policy.currency || 'usd',
                        product_data: {
                            name: `Download Package (${items.length} photos)`,
                            description: `High-resolution digital downloads from session`,
                            metadata: {
                                sessionId: sessionId,
                                itemCount: items.length
                            }
                        },
                        unit_amount: Math.round(totalPrice * 100)
                    },
                    quantity: 1
                });
            }
            
            // Create order record with pending status
            const orderId = uuidv4();
            await this.db.insert(downloadOrders).values({
                id: orderId,
                sessionId: sessionId,
                userId: photographer[0].id,
                clientKey: clientKey,
                amount: totalPrice.toFixed(2),
                currency: policy.currency || 'USD',
                mode: policy.mode,
                items: items,
                stripeConnectAccountId: photographer[0].stripeConnectAccountId,
                platformFeeAmount: (platformFee / 100).toFixed(2),
                status: 'pending',
                createdAt: new Date()
            });
            
            // Create Stripe Checkout Session
            const checkoutSession = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: mode,
                success_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/download-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
                cancel_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/gallery?session=${sessionId}`,
                metadata: {
                    orderId: orderId,
                    sessionId: sessionId,
                    clientKey: clientKey,
                    itemCount: items.length,
                    photographerId: photographer[0].id,
                    type: 'download_purchase'
                },
                // Stripe Connect configuration
                payment_intent_data: {
                    application_fee_amount: platformFee,
                    on_behalf_of: photographer[0].stripeConnectAccountId,
                    transfer_data: {
                        destination: photographer[0].stripeConnectAccountId
                    },
                    metadata: {
                        orderId: orderId,
                        sessionId: sessionId,
                        type: 'download_purchase'
                    }
                },
                expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
            });
            
            // Update order with Stripe session ID
            await this.db.update(downloadOrders)
                .set({ 
                    stripeCheckoutSessionId: checkoutSession.id 
                })
                .where(eq(downloadOrders.id, orderId));
            
            console.log(`💳 Created checkout session for order ${orderId}`);
            
            return {
                success: true,
                checkoutUrl: checkoutSession.url,
                sessionId: checkoutSession.id,
                orderId: orderId
            };
            
        } catch (error) {
            console.error('❌ Error creating checkout session:', error);
            return {
                success: false,
                error: this.mapStripeError(error)
            };
        }
    }
    
    // Create Payment Intent for direct charges
    async createPaymentIntent(sessionId, clientKey, amount, photoIds) {
        try {
            if (!this.stripeEnabled) {
                return {
                    success: false,
                    error: 'Payment processing not configured'
                };
            }
            
            // Get photographer details
            const session = await this.db.select()
                .from(photographySessions)
                .where(eq(photographySessions.id, sessionId))
                .limit(1);
            
            if (session.length === 0) {
                return {
                    success: false,
                    error: 'Session not found'
                };
            }
            
            const photographer = await this.db.select()
                .from(users)
                .where(eq(users.id, session[0].userId))
                .limit(1);
            
            if (photographer.length === 0 || !photographer[0].stripeConnectAccountId) {
                return {
                    success: false,
                    error: 'Photographer payment account not configured'
                };
            }
            
            // Calculate platform fee
            const amountInCents = Math.round(amount * 100);
            const platformFee = Math.round(amountInCents * (PLATFORM_FEE_PERCENTAGE / 100));
            
            // Create order record
            const orderId = uuidv4();
            const policy = await this.getPolicyForSession(sessionId);
            
            await this.db.insert(downloadOrders).values({
                id: orderId,
                sessionId: sessionId,
                userId: photographer[0].id,
                clientKey: clientKey,
                amount: amount.toFixed(2),
                currency: 'USD',
                mode: policy.policy?.mode || 'per_photo',
                items: photoIds.map(id => ({ photoId: id })),
                stripeConnectAccountId: photographer[0].stripeConnectAccountId,
                platformFeeAmount: (platformFee / 100).toFixed(2),
                status: 'pending',
                createdAt: new Date()
            });
            
            // Create Payment Intent
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amountInCents,
                currency: 'usd',
                application_fee_amount: platformFee,
                on_behalf_of: photographer[0].stripeConnectAccountId,
                transfer_data: {
                    destination: photographer[0].stripeConnectAccountId
                },
                metadata: {
                    orderId: orderId,
                    sessionId: sessionId,
                    clientKey: clientKey,
                    photoIds: JSON.stringify(photoIds),
                    type: 'download_purchase'
                }
            });
            
            // Update order with payment intent ID
            await this.db.update(downloadOrders)
                .set({ 
                    stripePaymentIntentId: paymentIntent.id 
                })
                .where(eq(downloadOrders.id, orderId));
            
            console.log(`💳 Created payment intent for order ${orderId}`);
            
            return {
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                orderId: orderId
            };
            
        } catch (error) {
            console.error('❌ Error creating payment intent:', error);
            return {
                success: false,
                error: this.mapStripeError(error)
            };
        }
    }

    /**
     * Entitlement Management
     */
    
    // Create entitlements after successful payment
    async createEntitlements(orderId, sessionId, clientKey, items, mode) {
        try {
            const entitlements = [];
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days default expiration
            
            // Get policy for mode-specific handling
            const policyResult = await this.getPolicyForSession(sessionId);
            const policy = policyResult.policy;
            
            switch (mode || policy?.mode) {
                case 'free':
                    // Create unlimited entitlements for free mode
                    for (const item of items) {
                        entitlements.push({
                            id: uuidv4(),
                            orderId: orderId,
                            sessionId: sessionId,
                            clientKey: clientKey,
                            photoId: item.photoId || item.id,
                            remaining: 999, // Effectively unlimited
                            expiresAt: null, // No expiration for free
                            createdAt: new Date()
                        });
                    }
                    break;
                    
                case 'freemium':
                    // Check if within free quota
                    const existingDownloads = await this.db.select()
                        .from(downloadEntitlements)
                        .where(and(
                            eq(downloadEntitlements.sessionId, sessionId),
                            eq(downloadEntitlements.clientKey, clientKey)
                        ));
                    
                    const freeRemaining = (policy?.freeCount || 0) - existingDownloads.length;
                    
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        entitlements.push({
                            id: uuidv4(),
                            orderId: i < freeRemaining ? null : orderId, // Free items don't need order
                            sessionId: sessionId,
                            clientKey: clientKey,
                            photoId: item.photoId || item.id,
                            remaining: 1,
                            expiresAt: expiresAt,
                            createdAt: new Date()
                        });
                    }
                    break;
                    
                case 'bulk':
                    // Create a pool of downloads for bulk purchase
                    const bulkEntitlement = {
                        id: uuidv4(),
                        orderId: orderId,
                        sessionId: sessionId,
                        clientKey: clientKey,
                        photoId: null, // Null means any photo
                        remaining: items.length || 10, // Number of photos purchased
                        expiresAt: expiresAt,
                        createdAt: new Date()
                    };
                    entitlements.push(bulkEntitlement);
                    break;
                    
                case 'per_photo':
                case 'fixed':
                default:
                    // Create individual entitlements per photo
                    for (const item of items) {
                        entitlements.push({
                            id: uuidv4(),
                            orderId: orderId,
                            sessionId: sessionId,
                            clientKey: clientKey,
                            photoId: item.photoId || item.id,
                            remaining: policy?.maxPerClient || 3, // Default 3 downloads per photo
                            expiresAt: expiresAt,
                            createdAt: new Date(),
                            isActive: true // Explicitly set active status
                        });
                    }
                    break;
            }
            
            // Insert entitlements
            if (entitlements.length > 0) {
                await this.db.insert(downloadEntitlements)
                    .values(entitlements);
                
                console.log(`✅ Created ${entitlements.length} entitlements for order ${orderId}`);
            }
            
            return {
                success: true,
                entitlements: entitlements
            };
            
        } catch (error) {
            console.error('❌ Error creating entitlements:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Check if client has entitlement to download
    async checkEntitlement(sessionId, clientKey, photoId) {
        try {
            // First check for specific photo entitlement
            const specificEntitlement = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.clientKey, clientKey),
                    eq(downloadEntitlements.photoId, photoId),
                    gt(downloadEntitlements.remaining, 0),
                    or(
                        eq(downloadEntitlements.expiresAt, null),
                        gte(downloadEntitlements.expiresAt, new Date())
                    )
                ))
                .limit(1);
            
            if (specificEntitlement.length > 0) {
                return {
                    success: true,
                    entitled: true,
                    entitlement: specificEntitlement[0],
                    reason: 'specific_entitlement'
                };
            }
            
            // Check for bulk entitlement (photoId = null means any photo)
            const bulkEntitlement = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.clientKey, clientKey),
                    eq(downloadEntitlements.photoId, null),
                    gt(downloadEntitlements.remaining, 0),
                    or(
                        eq(downloadEntitlements.expiresAt, null),
                        gte(downloadEntitlements.expiresAt, new Date())
                    )
                ))
                .limit(1);
            
            if (bulkEntitlement.length > 0) {
                return {
                    success: true,
                    entitled: true,
                    entitlement: bulkEntitlement[0],
                    reason: 'bulk_entitlement'
                };
            }
            
            // Check if session has free mode
            const policy = await this.getPolicyForSession(sessionId);
            if (policy.success && policy.policy.mode === 'free') {
                return {
                    success: true,
                    entitled: true,
                    entitlement: null,
                    reason: 'free_mode'
                };
            }
            
            // Check freemium quota
            if (policy.success && policy.policy.mode === 'freemium') {
                const downloads = await this.db.select()
                    .from(downloadHistory)
                    .where(and(
                        eq(downloadHistory.sessionId, sessionId),
                        eq(downloadHistory.clientKey, clientKey),
                        eq(downloadHistory.status, 'success')
                    ));
                
                if (downloads.length < (policy.policy.freeCount || 0)) {
                    return {
                        success: true,
                        entitled: true,
                        entitlement: null,
                        reason: 'freemium_quota',
                        remaining: (policy.policy.freeCount || 0) - downloads.length
                    };
                }
            }
            
            return {
                success: true,
                entitled: false,
                reason: 'no_entitlement'
            };
            
        } catch (error) {
            console.error('❌ Error checking entitlement:', error);
            return {
                success: false,
                entitled: false,
                error: error.message
            };
        }
    }
    
    // Consume an entitlement when downloading
    async consumeEntitlement(sessionId, clientKey, photoId) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Check entitlement
            const entitlementCheck = await this.checkEntitlement(sessionId, clientKey, photoId);
            
            if (!entitlementCheck.entitled) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'No valid entitlement'
                };
            }
            
            // If there's a specific entitlement, consume it
            if (entitlementCheck.entitlement) {
                const entitlement = entitlementCheck.entitlement;
                
                // Decrement remaining count
                const newRemaining = entitlement.remaining - 1;
                const updates = {
                    remaining: newRemaining
                };
                
                // Mark as used if depleted
                if (newRemaining <= 0) {
                    updates.usedAt = new Date();
                }
                
                await this.db.update(downloadEntitlements)
                    .set(updates)
                    .where(eq(downloadEntitlements.id, entitlement.id));
                
                console.log(`📉 Consumed entitlement ${entitlement.id}, ${newRemaining} remaining`);
            }
            
            // Create download history entry
            await this.db.insert(downloadHistory).values({
                id: uuidv4(),
                sessionId: sessionId,
                clientKey: clientKey,
                photoId: photoId,
                tokenId: null,
                orderId: entitlementCheck.entitlement?.orderId || null,
                ipAddress: null, // Will be set by caller
                userAgent: null, // Will be set by caller
                status: 'success',
                failureReason: null,
                createdAt: new Date()
            });
            
            await client.query('COMMIT');
            
            return {
                success: true,
                remaining: entitlementCheck.entitlement?.remaining - 1 || null
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error consuming entitlement:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Token Management
     */
    
    // Issue secure download token
    async issueDownloadToken(sessionId, clientKey, photoId, entitlementId = null) {
        try {
            // Generate secure token
            const token = crypto.randomBytes(32).toString('hex');
            const tokenId = uuidv4();
            
            // Token expires in 5 minutes
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 5);
            
            // Get photo details from session
            const session = await this.db.select()
                .from(photographySessions)
                .where(eq(photographySessions.id, sessionId))
                .limit(1);
            
            if (session.length === 0) {
                return {
                    success: false,
                    error: 'Session not found'
                };
            }
            
            const photos = session[0].photos || [];
            const photo = photos.find(p => p.id === photoId || p.filename === photoId);
            
            if (!photo) {
                return {
                    success: false,
                    error: 'Photo not found'
                };
            }
            
            // Create token record
            await this.db.insert(downloadTokens).values({
                id: tokenId,
                token: token,
                photoUrl: photo.url || photo.original || '',
                filename: photo.filename || photo.name || photoId,
                sessionId: sessionId,
                expiresAt: expiresAt,
                isUsed: false,
                oneTime: true,
                createdAt: new Date()
            });
            
            console.log(`🔑 Issued download token for ${photoId}`);
            
            return {
                success: true,
                token: token,
                tokenId: tokenId,
                expiresAt: expiresAt
            };
            
        } catch (error) {
            console.error('❌ Error issuing download token:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * History & Analytics
     */
    
    // Log download attempt
    async logDownloadAttempt(sessionId, clientKey, photoId, status, details = {}) {
        try {
            await this.db.insert(downloadHistory).values({
                id: uuidv4(),
                sessionId: sessionId,
                clientKey: clientKey,
                photoId: photoId,
                tokenId: details.tokenId || null,
                orderId: details.orderId || null,
                ipAddress: details.ipAddress || null,
                userAgent: details.userAgent || null,
                status: status,
                failureReason: details.failureReason || null,
                createdAt: new Date()
            });
            
            console.log(`📊 Logged download attempt: ${status} for ${photoId}`);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error logging download attempt:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Get download history for photographer
    async getDownloadHistory(sessionId, userId) {
        try {
            // Verify ownership
            const session = await this.db.select()
                .from(photographySessions)
                .where(and(
                    eq(photographySessions.id, sessionId),
                    eq(photographySessions.userId, userId)
                ))
                .limit(1);
            
            if (session.length === 0) {
                return {
                    success: false,
                    error: 'Session not found or unauthorized'
                };
            }
            
            // Fetch history
            const history = await this.db.select()
                .from(downloadHistory)
                .where(eq(downloadHistory.sessionId, sessionId))
                .orderBy(sql`${downloadHistory.createdAt} DESC`)
                .limit(100);
            
            return {
                success: true,
                history: history
            };
            
        } catch (error) {
            console.error('❌ Error fetching download history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Get client's download history
    async getClientDownloads(sessionId, clientKey) {
        try {
            const downloads = await this.db.select()
                .from(downloadHistory)
                .where(and(
                    eq(downloadHistory.sessionId, sessionId),
                    eq(downloadHistory.clientKey, clientKey),
                    eq(downloadHistory.status, 'success')
                ))
                .orderBy(sql`${downloadHistory.createdAt} DESC`);
            
            return {
                success: true,
                downloads: downloads
            };
            
        } catch (error) {
            console.error('❌ Error fetching client downloads:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Webhook Handler
     */
    
    // Process Stripe webhook events with signature verification
    async handleStripeWebhook(rawBody, signature) {
        try {
            // Verify webhook signature
            const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_CONNECT || process.env.STRIPE_WEBHOOK_SECRET;
            
            if (!webhookSecret) {
                console.error('⚠️ Webhook secret not configured');
                return {
                    success: false,
                    error: 'Webhook verification not configured'
                };
            }
            
            let event;
            try {
                event = this.stripe.webhooks.constructEvent(
                    rawBody,
                    signature,
                    webhookSecret
                );
            } catch (err) {
                console.error('❌ Webhook signature verification failed:', err.message);
                return {
                    success: false,
                    error: `Webhook Error: ${err.message}`
                };
            }
            
            console.log(`🪝 Processing webhook: ${event.type}`);
            
            // Check for idempotency - prevent duplicate processing
            const idempotencyKey = `webhook_${event.id}`;
            
            // Check if we've already processed this event
            const existingEvent = await this.db.select()
                .from(downloadOrders)
                .where(eq(downloadOrders.webhookEventId, event.id))
                .limit(1);
            
            if (existingEvent.length > 0) {
                console.log(`ℹ️ Event ${event.id} already processed - skipping`);
                return { success: true, duplicate: true };
            }
            
            let order;
            
            switch (event.type) {
                case 'checkout.session.completed':
                    const checkoutSession = event.data.object;
                    
                    // Find order by checkout session ID
                    const ordersByCheckout = await this.db.select()
                        .from(downloadOrders)
                        .where(eq(downloadOrders.stripeCheckoutSessionId, checkoutSession.id))
                        .limit(1);
                    
                    if (ordersByCheckout.length === 0) {
                        console.log('No order found for checkout session:', checkoutSession.id);
                        return { success: true };
                    }
                    
                    order = ordersByCheckout[0];
                    
                    // Update order status with idempotency tracking
                    await this.db.update(downloadOrders)
                        .set({
                            status: 'completed',
                            completedAt: new Date(),
                            receiptUrl: checkoutSession.receipt_url || null,
                            webhookEventId: event.id,
                            webhookProcessedAt: new Date()
                        })
                        .where(eq(downloadOrders.id, order.id));
                    
                    // Create entitlements
                    await this.createEntitlements(
                        order.id,
                        order.sessionId,
                        order.clientKey,
                        order.items,
                        order.mode
                    );
                    
                    // Send receipt email
                    if (checkoutSession.customer_details?.email) {
                        await this.sendDownloadReceipt(order, checkoutSession.customer_details.email);
                    }
                    
                    console.log(`✅ Processed checkout completion for order ${order.id}`);
                    break;
                    
                case 'payment_intent.succeeded':
                    const paymentIntent = event.data.object;
                    
                    // Find order by payment intent ID
                    const ordersByIntent = await this.db.select()
                        .from(downloadOrders)
                        .where(eq(downloadOrders.stripePaymentIntentId, paymentIntent.id))
                        .limit(1);
                    
                    if (ordersByIntent.length === 0) {
                        console.log('No order found for payment intent:', paymentIntent.id);
                        return { success: true };
                    }
                    
                    order = ordersByIntent[0];
                    
                    // Update order status with idempotency tracking
                    await this.db.update(downloadOrders)
                        .set({
                            status: 'completed',
                            completedAt: new Date(),
                            webhookEventId: event.id,
                            webhookProcessedAt: new Date()
                        })
                        .where(eq(downloadOrders.id, order.id));
                    
                    // Create entitlements
                    await this.createEntitlements(
                        order.id,
                        order.sessionId,
                        order.clientKey,
                        order.items,
                        order.mode
                    );
                    
                    // Send receipt if we have email
                    if (paymentIntent.receipt_email) {
                        await this.sendDownloadReceipt(order, paymentIntent.receipt_email);
                    }
                    
                    console.log(`✅ Processed payment success for order ${order.id}`);
                    break;
                    
                case 'payment_intent.payment_failed':
                    const failedIntent = event.data.object;
                    
                    // Update order status to failed with idempotency tracking
                    await this.db.update(downloadOrders)
                        .set({
                            status: 'failed',
                            webhookEventId: event.id,
                            webhookProcessedAt: new Date()
                        })
                        .where(eq(downloadOrders.stripePaymentIntentId, failedIntent.id));
                    
                    console.log(`❌ Payment failed for intent ${failedIntent.id}`);
                    break;
                    
                default:
                    console.log(`Unhandled webhook type: ${event.type}`);
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error handling webhook:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Helper Methods
     */
    
    // Calculate total price for items based on policy
    async calculateTotalPrice(items, policy) {
        if (!policy) return 0;
        
        switch (policy.mode) {
            case 'free':
                return 0;
                
            case 'fixed':
            case 'per_photo':
                return items.length * parseFloat(policy.pricePerPhoto || 0);
                
            case 'freemium':
                // Need to check how many free downloads already used
                // This would need additional context about client's previous downloads
                const pricePerPhoto = parseFloat(policy.pricePerPhoto || 0);
                return items.length * pricePerPhoto; // Simplified - assumes all are paid
                
            case 'bulk':
                // Find the best tier for quantity
                if (!policy.bulkTiers || policy.bulkTiers.length === 0) {
                    return 0;
                }
                
                const quantity = items.length;
                let bestPrice = Infinity;
                
                for (const tier of policy.bulkTiers) {
                    if (quantity >= tier.qty && tier.price < bestPrice) {
                        bestPrice = tier.price;
                    }
                }
                
                return bestPrice === Infinity ? 0 : bestPrice;
                
            default:
                return 0;
        }
    }
    
    // Calculate price for single item
    async calculateItemPrice(item, policy) {
        if (!policy) return 0;
        
        switch (policy.mode) {
            case 'free':
                return 0;
            case 'fixed':
            case 'per_photo':
                return parseFloat(policy.pricePerPhoto || 0);
            default:
                return parseFloat(policy.pricePerPhoto || 0);
        }
    }
    
    // Validate photographer's Connect account
    async validatePhotographer(sessionId) {
        try {
            const session = await this.db.select()
                .from(photographySessions)
                .where(eq(photographySessions.id, sessionId))
                .limit(1);
            
            if (session.length === 0) {
                return {
                    success: false,
                    error: 'Session not found'
                };
            }
            
            const photographer = await this.db.select()
                .from(users)
                .where(eq(users.id, session[0].userId))
                .limit(1);
            
            if (photographer.length === 0) {
                return {
                    success: false,
                    error: 'Photographer not found'
                };
            }
            
            if (!photographer[0].stripeConnectAccountId) {
                return {
                    success: false,
                    error: 'Photographer has not set up payment processing'
                };
            }
            
            if (!photographer[0].stripeOnboardingComplete) {
                return {
                    success: false,
                    error: 'Photographer payment setup is incomplete'
                };
            }
            
            // Optionally check with Stripe API for current status
            if (this.stripeEnabled) {
                try {
                    const account = await this.stripe.accounts.retrieve(
                        photographer[0].stripeConnectAccountId
                    );
                    
                    if (!account.charges_enabled || !account.payouts_enabled) {
                        return {
                            success: false,
                            error: 'Photographer payment account is not fully activated'
                        };
                    }
                } catch (stripeError) {
                    console.error('Error checking Stripe account:', stripeError);
                    // Continue anyway - don't block if we can't verify
                }
            }
            
            return {
                success: true,
                photographerId: photographer[0].id,
                stripeAccountId: photographer[0].stripeConnectAccountId
            };
            
        } catch (error) {
            console.error('❌ Error validating photographer:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Get or create stable client identifier
    async getOrCreateClientKey(email, galleryToken = null) {
        // Use email as primary key if available
        if (email) {
            return email.toLowerCase().trim();
        }
        
        // Use gallery token as fallback
        if (galleryToken) {
            return `token_${galleryToken}`;
        }
        
        // Generate anonymous key as last resort
        return `anon_${uuidv4()}`;
    }
    
    // Send download receipt email
    async sendDownloadReceipt(order, clientEmail) {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                console.log('SendGrid not configured, skipping receipt email');
                return { success: true };
            }
            
            // Get session details
            const session = await this.db.select()
                .from(photographySessions)
                .where(eq(photographySessions.id, order.sessionId))
                .limit(1);
            
            if (session.length === 0) {
                return { success: false };
            }
            
            // Get photographer details
            const photographer = await this.db.select()
                .from(users)
                .where(eq(users.id, order.userId))
                .limit(1);
            
            const photographerName = photographer[0]?.businessName || 'Your Photographer';
            
            // Create email content
            const itemCount = order.items?.length || 0;
            const amount = parseFloat(order.amount).toFixed(2);
            
            const msg = {
                to: clientEmail,
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@photomanagementsystem.com',
                subject: `📷 Your Photo Download Receipt - ${photographerName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px;">Download Receipt</h1>
                            <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">${photographerName}</p>
                        </div>
                        
                        <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                            <h2 style="color: #333; margin-top: 0;">Thank you for your purchase!</h2>
                            <p style="color: #666; line-height: 1.6;">Your photo downloads are now available.</p>
                            
                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Order ID:</strong></td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${order.id.substring(0, 8)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Photos:</strong></td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${itemCount} photos</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Total Amount:</strong></td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 18px; color: #667eea;"><strong>$${amount}</strong></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0;"><strong>Date:</strong></td>
                                        <td style="padding: 10px 0; text-align: right;">${new Date().toLocaleDateString()}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #856404;">
                                    <strong>Important:</strong> Your download links expire in 7 days. 
                                    Please download your photos as soon as possible.
                                </p>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.BASE_URL || 'https://photomanagementsystem.com'}/gallery?session=${order.sessionId}" 
                                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Access Gallery
                                </a>
                            </div>
                        </div>
                        
                        <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                            <p>Questions? Contact ${photographerName} directly.</p>
                            <p style="font-size: 12px;">This is an automated receipt from the photo management system.</p>
                        </div>
                    </div>
                `
            };
            
            await sgMail.send(msg);
            console.log(`📧 Sent download receipt to ${clientEmail}`);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error sending receipt email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Map Stripe errors to user-friendly messages
    mapStripeError(error) {
        if (!error) return 'An unknown error occurred';
        
        const errorMap = {
            'card_declined': 'Your card was declined. Please try a different payment method.',
            'expired_card': 'Your card has expired. Please use a different card.',
            'insufficient_funds': 'Your card has insufficient funds.',
            'payment_intent_authentication_failure': 'Authentication failed. Please try again.',
            'payment_method_not_available': 'This payment method is not available.',
            'processing_error': 'An error occurred while processing your payment. Please try again.',
            'rate_limit': 'Too many requests. Please wait a moment and try again.'
        };
        
        if (error.code && errorMap[error.code]) {
            return errorMap[error.code];
        }
        
        if (error.type === 'StripeCardError') {
            return error.message || 'There was an issue with your card.';
        }
        
        if (error.type === 'StripeInvalidRequestError') {
            return 'Invalid request. Please check your information and try again.';
        }
        
        if (error.type === 'StripeAPIError') {
            return 'A temporary error occurred. Please try again later.';
        }
        
        return error.message || 'An error occurred processing your payment.';
    }
    
    /**
     * Token Generation & Management
     * SECURITY: Time-limited, single-use tokens bound to session + client + photo
     */
    
    // Generate secure download token with strict security constraints
    async generateDownloadToken(sessionId, photoId, clientKey, ipAddress = null) {
        try {
            // Verify entitlement first
            const entitlementCheck = await this.checkEntitlement(sessionId, clientKey, photoId);
            if (!entitlementCheck.hasEntitlement) {
                return {
                    success: false,
                    error: 'No entitlement for this download'
                };
            }
            
            // Generate cryptographically secure token
            const tokenValue = crypto.randomBytes(32).toString('hex');
            
            // Create token bound to session + client + photo
            const tokenData = {
                sessionId,
                clientKey,
                photoId,
                ipAddress,
                timestamp: Date.now()
            };
            
            // Hash the token data for additional validation
            const tokenHash = crypto
                .createHash('sha256')
                .update(JSON.stringify(tokenData))
                .digest('hex');
            
            // Set strict expiration (5 minutes max)
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 5);
            
            // Store token with all security constraints
            const tokenId = uuidv4();
            await this.db.insert(downloadTokens).values({
                id: tokenId,
                token: tokenValue,
                sessionId: sessionId,
                photoId: photoId,
                clientKey: clientKey,
                tokenHash: tokenHash,
                ipAddress: ipAddress,
                expiresAt: expiresAt,
                isUsed: false,
                maxUses: 1, // Single-use only
                createdAt: new Date()
            });
            
            console.log(`🔐 Generated secure download token for photo ${photoId} (expires in 5 minutes)`);
            
            return {
                success: true,
                token: {
                    id: tokenId,
                    value: tokenValue,
                    expiresAt: expiresAt,
                    photoId: photoId
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating download token:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Validate and consume download token
    async validateAndConsumeToken(token, sessionId, clientKey, photoId, ipAddress = null) {
        try {
            // Find the token
            const tokens = await this.db.select()
                .from(downloadTokens)
                .where(and(
                    eq(downloadTokens.token, token),
                    eq(downloadTokens.sessionId, sessionId),
                    eq(downloadTokens.photoId, photoId)
                ))
                .limit(1);
            
            if (tokens.length === 0) {
                console.warn(`⚠️ Invalid token attempt for session ${sessionId}`);
                return {
                    success: false,
                    error: 'Invalid or expired token'
                };
            }
            
            const tokenData = tokens[0];
            
            // Check if expired
            if (new Date() > tokenData.expiresAt) {
                console.warn(`⚠️ Expired token attempt for photo ${photoId}`);
                return {
                    success: false,
                    error: 'Token has expired'
                };
            }
            
            // Check if already used (single-use enforcement)
            if (tokenData.isUsed) {
                console.warn(`⚠️ Reused token attempt for photo ${photoId}`);
                return {
                    success: false,
                    error: 'Token has already been used'
                };
            }
            
            // Validate client key binding
            if (tokenData.clientKey && tokenData.clientKey !== clientKey) {
                console.warn(`⚠️ Client key mismatch for token`);
                return {
                    success: false,
                    error: 'Token validation failed'
                };
            }
            
            // Optional: Check IP address if it was bound
            if (tokenData.ipAddress && ipAddress && tokenData.ipAddress !== ipAddress) {
                console.warn(`⚠️ IP address mismatch for token (stored: ${tokenData.ipAddress}, current: ${ipAddress})`);
                // Log suspicious activity but don't necessarily block (user might be on VPN/mobile)
            }
            
            // Mark token as used (atomic operation)
            const updateResult = await this.db.update(downloadTokens)
                .set({
                    isUsed: true,
                    usedAt: new Date(),
                    usedByIp: ipAddress
                })
                .where(and(
                    eq(downloadTokens.id, tokenData.id),
                    eq(downloadTokens.isUsed, false) // Ensure it hasn't been used in a race condition
                ));
            
            // Log the download in history
            await this.recordDownload(sessionId, clientKey, photoId, {
                tokenId: tokenData.id,
                ipAddress: ipAddress,
                status: 'success'
            });
            
            console.log(`✅ Token validated and consumed for photo ${photoId}`);
            
            return {
                success: true,
                tokenData: tokenData
            };
            
        } catch (error) {
            console.error('❌ Error validating token:', error);
            return {
                success: false,
                error: 'Token validation failed'
            };
        }
    }
    
    // Clean up expired tokens (should be run periodically)
    async cleanupExpiredTokens() {
        try {
            const result = await this.db.delete(downloadTokens)
                .where(lte(downloadTokens.expiresAt, new Date()));
            
            console.log(`🧹 Cleaned up expired download tokens`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error cleaning up tokens:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export the manager class
module.exports = DownloadCommerceManager;
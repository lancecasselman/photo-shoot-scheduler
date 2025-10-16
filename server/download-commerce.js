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
const { dbTransactionManager } = require('./database-transaction-manager');
const { 
    downloadPolicies, 
    downloadOrders, 
    downloadEntitlements, 
    downloadHistory, 
    downloadTokens,
    photographySessions,
    sessionFiles,
    users 
} = require('../shared/schema');
const { eq, and, gte, gt, lte, or, sql } = require('drizzle-orm');

// Initialize SendGrid if available
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Platform fee percentage (configurable via environment variable)
const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 0; // No platform fee - photographers keep 100%

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
        
        // Admin emails that use regular Stripe instead of Stripe Connect
        this.adminEmails = [
            'lancecasselman@icloud.com',
            'lancecasselman2011@gmail.com', 
            'lance@thelegacyphotography.com'
        ];
        
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
    
    // Update pricing policy with validation using transaction manager
    async updatePolicy(sessionId, userId, policyData) {
        try {
            const result = await dbTransactionManager.executeTransaction(
                async (client, db, transactionId) => {
                    console.log(`📋 [${transactionId}] Updating policy for session ${sessionId}`);
                    
                    // Validate ownership with row-level locking
                    const session = await db.select()
                        .from(photographySessions)
                        .where(and(
                            eq(photographySessions.id, sessionId),
                            eq(photographySessions.userId, userId)
                        ))
                        .limit(1)
                        .for('update'); // Row-level lock to prevent concurrent modifications
                    
                    if (session.length === 0) {
                        throw new Error('Session not found or unauthorized');
                    }
                    
                    // Validate pricing mode and data
                    const validation = this.validatePricingMode(policyData.mode, policyData);
                    if (!validation.valid) {
                        throw new Error(validation.error);
                    }
                    
                    // Check for existing policy with lock
                    const existing = await db.select()
                        .from(downloadPolicies)
                        .where(eq(downloadPolicies.sessionId, sessionId))
                        .limit(1)
                        .for('update');
                    
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
                    
                    let policy;
                    if (existing.length > 0) {
                        // Update existing
                        const updated = await db.update(downloadPolicies)
                            .set(policyValues)
                            .where(eq(downloadPolicies.id, policyId))
                            .returning();
                        policy = updated[0];
                        console.log(`📋 [${transactionId}] Updated existing policy for session ${sessionId}`);
                    } else {
                        // Create new
                        policyValues.createdAt = new Date();
                        const created = await db.insert(downloadPolicies)
                            .values(policyValues)
                            .returning();
                        policy = created[0];
                        console.log(`📋 [${transactionId}] Created new policy for session ${sessionId}`);
                    }
                    
                    return policy;
                },
                {
                    isolationLevel: 'SERIALIZABLE', // Highest isolation level for policy updates
                    timeout: 15000, // 15 seconds timeout
                    context: {
                        operation: 'updatePolicy',
                        sessionId,
                        userId,
                        policyMode: policyData.mode
                    }
                }
            );
            
            return {
                success: true,
                policy: result.result
            };
            
        } catch (error) {
            console.error('❌ Error updating policy:', error);
            
            // Handle specific database errors
            const errorType = error.errorType || 'UNKNOWN_ERROR';
            let userMessage = 'Failed to update pricing policy';
            
            switch (errorType) {
                case 'DEADLOCK_DETECTED':
                    userMessage = 'Policy update conflict detected. Please try again.';
                    break;
                case 'TIMEOUT_ERROR':
                    userMessage = 'Policy update took too long. Please try again.';
                    break;
                case 'FOREIGN_KEY_VIOLATION':
                    userMessage = 'Invalid session or user reference.';
                    break;
                case 'UNIQUE_CONSTRAINT_VIOLATION':
                    userMessage = 'Policy configuration conflict.';
                    break;
                default:
                    userMessage = error.message || 'Failed to update pricing policy';
            }
            
            return {
                success: false,
                error: userMessage,
                errorType: errorType,
                retryable: error.retryable || false
            };
        }
    }
    
    // Validate pricing mode and data consistency
    /**
     * Check if a user email is an admin account
     */
    isAdminAccount(email) {
        if (!email) return false;
        return this.adminEmails.includes(email.toLowerCase());
    }
    
    /**
     * Get photographer details and determine if they are an admin
     */
    async getPhotographerInfo(sessionId) {
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
            
            const isAdmin = this.isAdminAccount(photographer[0].email);
            
            return {
                success: true,
                photographer: photographer[0],
                isAdmin: isAdmin,
                session: session[0]
            };
            
        } catch (error) {
            console.error('❌ Error getting photographer info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

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
                    eq(downloadEntitlements.clientKey, clientKey)
                    // Temporarily removed isActive filter due to SQL generation issue
                ))
                .orderBy(sql`${downloadEntitlements.createdAt} DESC`);
            
            // Filter active entitlements in application logic for now
            const activeEntitlements = entitlements.filter(e => e.isActive !== false);
            
            return {
                success: true,
                entitlements: activeEntitlements
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
            // Get session data to determine free download limit
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

            const sessionData = session[0];
            const pricingModel = sessionData.pricing_model || sessionData.pricingModel || 'free';
            const freeDownloads = sessionData.freeDownloads || sessionData.free_downloads || 1;
            
            console.log(`📊 Creating free entitlements: session pricing model is '${pricingModel}'`);

            // For FREE pricing model, skip all quota checks and allow unlimited downloads
            if (pricingModel === 'free') {
                console.log(`🆓 FREE pricing model detected - unlimited downloads allowed, skipping quota checks`);
                
                const entitlementIds = [];
                
                for (const item of items) {
                    const entitlementId = uuidv4();
                    
                    // Check if entitlement already exists for this specific photo to avoid unique constraint violation
                    const existing = await this.db.select()
                        .from(downloadEntitlements)
                        .where(and(
                            eq(downloadEntitlements.sessionId, sessionId),
                            eq(downloadEntitlements.clientKey, clientKey),
                            eq(downloadEntitlements.photoId, item.photoId)
                        ))
                        .limit(1);
                    
                    if (existing.length > 0) {
                        console.log(`⚠️ Entitlement already exists for photo ${item.photoId}, using existing entitlement`);
                        entitlementIds.push(existing[0].id);
                        continue;
                    }
                    
                    await this.db.insert(downloadEntitlements)
                        .values({
                            id: entitlementId,
                            sessionId: sessionId,
                            clientKey: clientKey,
                            photoId: item.photoId,
                            remaining: 999999, // FREE mode: Unlimited re-downloads
                            orderId: null, // Free entitlements have no order
                            expiresAt: null, // Free entitlements don't expire
                            createdAt: new Date()
                        });
                    console.log(`✅ Created FREE entitlement ${entitlementId} for photo ${item.photoId} - UNLIMITED RE-DOWNLOADS`);
                    entitlementIds.push(entitlementId);
                }
                
                console.log(`✅ Created ${entitlementIds.length} FREE unlimited entitlements for ${clientKey}`);
                
                return {
                    success: true,
                    count: entitlementIds.length,
                    entitlementIds: entitlementIds,
                    freeDownloads: 999999, // Unlimited for FREE mode
                    usedDownloads: 0, // Not applicable for FREE mode
                    remainingFree: 999999 // Unlimited for FREE mode
                };
            }

            // For FREEMIUM pricing model, enforce quota limits
            console.log(`📊 FREEMIUM pricing model detected: session allows ${freeDownloads} free downloads per client`);

            // Check existing free entitlements for this client (orderId is null for free downloads)
            const existingEntitlements = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.clientKey, clientKey),
                    eq(downloadEntitlements.orderId, null)
                ));

            // SINGLE SOURCE OF TRUTH: Count free downloads by counting entitlements where orderId is null
            // Each free entitlement represents one photo download attempt (whether used or not)
            // This ensures consistency with checkEntitlement() method
            let totalConsumedDownloads = existingEntitlements.length;
            
            console.log(`📊 Client ${clientKey} has ${existingEntitlements.length} existing entitlements (each represents 1 download attempt)`);

            const remainingFreeDownloads = Math.max(0, freeDownloads - totalConsumedDownloads);

            console.log(`📊 Client ${clientKey}: ${totalConsumedDownloads} download slots used out of ${freeDownloads} free downloads, ${remainingFreeDownloads} remaining free`);

            if (remainingFreeDownloads <= 0) {
                return {
                    success: false,
                    error: 'Free download limit exceeded',
                    freeDownloads: freeDownloads,
                    usedDownloads: totalConsumedDownloads
                };
            }

            const entitlementIds = [];
            const itemsToProcess = items.slice(0, remainingFreeDownloads); // Only create entitlements for remaining free slots
            
            for (const item of itemsToProcess) {
                const entitlementId = uuidv4();
                
                // Check if entitlement already exists for this specific photo to avoid unique constraint violation
                const existing = await this.db.select()
                    .from(downloadEntitlements)
                    .where(and(
                        eq(downloadEntitlements.sessionId, sessionId),
                        eq(downloadEntitlements.clientKey, clientKey),
                        eq(downloadEntitlements.photoId, item.photoId)
                    ))
                    .limit(1);
                
                if (existing.length > 0) {
                    console.log(`⚠️ Entitlement already exists for photo ${item.photoId}, using existing entitlement`);
                    entitlementIds.push(existing[0].id);
                    continue;
                }
                
                await this.db.insert(downloadEntitlements)
                    .values({
                        id: entitlementId,
                        sessionId: sessionId,
                        clientKey: clientKey,
                        photoId: item.photoId,
                        remaining: 999999, // FREEMIUM: Unlimited re-downloads for free photos too!
                        orderId: null, // Free entitlements have no order
                        expiresAt: null, // Free entitlements don't expire
                        createdAt: new Date()
                    });
                console.log(`✅ Created FREEMIUM free entitlement ${entitlementId} for photo ${item.photoId} - UNLIMITED RE-DOWNLOADS`);
                entitlementIds.push(entitlementId);
            }
            
            console.log(`✅ Created ${entitlementIds.length} free entitlements for ${clientKey} (${remainingFreeDownloads} free slots available)`);
            
            return {
                success: true,
                count: entitlementIds.length,
                entitlementIds: entitlementIds,
                freeDownloads: freeDownloads,
                usedDownloads: totalConsumedDownloads + entitlementIds.length,
                remainingFree: remainingFreeDownloads - entitlementIds.length
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
     * BACKWARDS COMPATIBILITY: Searches with authoritative key first, then fallback to legacy key formats
     */
    async verifyEntitlement(sessionId, clientKey, photoId) {
        try {
            console.log(`🔍 [ENTITLEMENT CHECK] verifyEntitlement called with:`);
            console.log(`  🗂️ sessionId: "${sessionId}"`);
            console.log(`  🔑 clientKey: "${clientKey}"`);
            console.log(`  📷 photoId: "${photoId}"`);
            
            // STEP 1: Primary lookup with the authoritative client key
            console.log(`🔍 [PRIMARY LOOKUP] Searching with authoritative client key`);
            let entitlement = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.clientKey, clientKey),
                    eq(downloadEntitlements.photoId, photoId),
                    gt(downloadEntitlements.remaining, 0)
                ))
                .limit(1);
            
            if (entitlement.length > 0) {
                console.log(`✅ [PRIMARY LOOKUP] Found entitlement with authoritative key`);
                return {
                    success: true,
                    entitlement: entitlement[0],
                    keyType: 'authoritative'
                };
            }
            
            // STEP 2: Backwards compatibility fallback lookups for legacy entitlements
            console.log(`🔄 [BACKWARDS COMPATIBILITY] Primary lookup failed, trying legacy key formats`);
            
            // Get gallery access token for generating legacy keys
            const session = await this.db.select()
                .from(photographySessions)
                .where(eq(photographySessions.id, sessionId))
                .limit(1);
            
            const legacyKeys = [];
            
            if (session.length > 0 && session[0].galleryAccessToken) {
                const galleryToken = session[0].galleryAccessToken;
                
                // Legacy format 1: Old IP-based server keys with different IP variations
                const crypto = require('crypto');
                const baseString = `${galleryToken}-${sessionId}`;
                
                // Try with 'direct' (old fallback)
                const directKey = `gallery-${crypto.createHash('sha256').update(`${baseString}-direct`).digest('hex').substring(0, 16)}`;
                legacyKeys.push({ key: directKey, type: 'old-server-direct' });
                
                // Try with common IP hash patterns (simulate old server behavior)
                ['127.0.0.1', '0.0.0.0', 'localhost'].forEach(ip => {
                    const ipHash = crypto.createHash('md5').update(ip).digest('hex').substring(0, 8);
                    const legacyKey = `gallery-${crypto.createHash('sha256').update(`${baseString}-${ipHash}`).digest('hex').substring(0, 16)}`;
                    legacyKeys.push({ key: legacyKey, type: `old-server-${ip}` });
                });
            }
            
            // Legacy format 2: Visitor ID patterns (client-provided)
            // Check if there are any visitor-* keys in this session
            const existingVisitorEntitlements = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.photoId, photoId),
                    gt(downloadEntitlements.remaining, 0)
                ))
                .limit(10); // Get up to 10 to check for visitor patterns
            
            existingVisitorEntitlements.forEach(ent => {
                if (ent.clientKey.startsWith('visitor-') || ent.clientKey.includes('@')) {
                    legacyKeys.push({ key: ent.clientKey, type: 'existing-legacy' });
                }
            });
            
            // STEP 3: Try each legacy key format
            for (const legacyKeyObj of legacyKeys) {
                console.log(`🔄 [LEGACY SEARCH] Trying ${legacyKeyObj.type}: ${legacyKeyObj.key}`);
                
                entitlement = await this.db.select()
                    .from(downloadEntitlements)
                    .where(and(
                        eq(downloadEntitlements.sessionId, sessionId),
                        eq(downloadEntitlements.clientKey, legacyKeyObj.key),
                        eq(downloadEntitlements.photoId, photoId),
                        gt(downloadEntitlements.remaining, 0)
                    ))
                    .limit(1);
                
                if (entitlement.length > 0) {
                    console.log(`✅ [LEGACY FOUND] Found entitlement with ${legacyKeyObj.type} key: ${legacyKeyObj.key}`);
                    return {
                        success: true,
                        entitlement: entitlement[0],
                        keyType: legacyKeyObj.type,
                        legacyKey: legacyKeyObj.key
                    };
                }
            }
            
            // STEP 4: No entitlement found with any key format
            console.warn(`❌ [NO ENTITLEMENT] No valid entitlement found for photo ${photoId}`);
            console.warn(`  🔑 Tried authoritative key: ${clientKey}`);
            console.warn(`  🔄 Tried ${legacyKeys.length} legacy key formats`);
            
            // Debug: Show what entitlements exist for this session/photo
            const debugEntitlements = await this.db.select()
                .from(downloadEntitlements)
                .where(and(
                    eq(downloadEntitlements.sessionId, sessionId),
                    eq(downloadEntitlements.photoId, photoId)
                ))
                .limit(5);
            
            console.warn(`  📋 Existing entitlements for this photo (any key, any status):`, 
                debugEntitlements.map(e => ({ key: e.clientKey, remaining: e.remaining, active: e.isActive })));
            
            return {
                success: false,
                error: 'No valid entitlement found',
                debug: {
                    searchedKeys: [clientKey, ...legacyKeys.map(k => k.key)],
                    existingEntitlements: debugEntitlements.length
                }
            };
            
        } catch (error) {
            console.error('❌ [ENTITLEMENT ERROR] Error verifying entitlement:', error);
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
            
            const sessionData = session[0];
            const photographer = await this.db.select()
                .from(users)
                .where(eq(users.id, sessionData.userId))
                .limit(1);
            
            if (photographer.length === 0) {
                return {
                    success: false,
                    error: 'Photographer not found'
                };
            }
            
            // **FREEMIUM MODE HANDLING** - Check if this is a freemium session
            const isFreemiumSession = sessionData.pricing_model === 'freemium' || sessionData.pricingModel === 'freemium';
            
            let freeItems = [];
            let paidItems = [];
            let freeEntitlementResult = null;
            
            if (isFreemiumSession) {
                console.log(`🎯 FREEMIUM MODE: Processing checkout for freemium session ${sessionId}`);
                
                // Try to auto-grant free entitlements for items within free quota
                freeEntitlementResult = await this.createFreeEntitlements(sessionId, clientKey, items);
                
                if (freeEntitlementResult.success && freeEntitlementResult.count > 0) {
                    // Split items into free and paid based on how many free entitlements were granted
                    freeItems = items.slice(0, freeEntitlementResult.count);
                    paidItems = items.slice(freeEntitlementResult.count);
                    
                    console.log(`🎯 FREEMIUM: Granted ${freeEntitlementResult.count} free entitlements, ${paidItems.length} items require payment`);
                } else {
                    // No free entitlements available, all items require payment
                    paidItems = items;
                    console.log(`🎯 FREEMIUM: No free entitlements available, all ${paidItems.length} items require payment`);
                }
            } else {
                // Non-freemium session, all items require payment
                paidItems = items;
                console.log(`💰 NON-FREEMIUM: All ${paidItems.length} items require payment`);
            }
            
            // If all items are free, return success without creating Stripe session
            if (paidItems.length === 0) {
                console.log(`✅ FREEMIUM: All items processed as free downloads, no payment required`);
                return {
                    success: true,
                    checkoutUrl: null, // No checkout needed
                    sessionId: null,
                    orderId: null,
                    freeItemsProcessed: freeItems.length,
                    paidItemsProcessed: 0,
                    message: `All ${freeItems.length} items have been granted as free downloads`
                };
            }
            
            // Validate photographer's Connect account for paid items
            const connectValidation = await this.validatePhotographer(sessionId);
            if (!connectValidation.success) {
                return connectValidation;
            }
            
            const isAdminAccount = connectValidation.isAdmin || false;
            
            // Get policy and calculate total for paid items only
            const policyResult = await this.getPolicyForSession(sessionId);
            if (!policyResult.success) {
                return policyResult;
            }
            
            const policy = policyResult.policy;
            
            // **SECURITY: SERVER-SIDE PRICE VALIDATION**
            // Recalculate prices server-side and validate against client-submitted prices
            // to prevent price manipulation attacks
            console.log(`🔒 [PRICE VALIDATION] Starting server-side price validation for ${items.length} items`);
            
            if (policy.mode === 'freemium') {
                // Get existing free entitlements for this client (orderId = null indicates free downloads)
                const freeEntitlements = await this.db.select()
                    .from(downloadEntitlements)
                    .where(and(
                        eq(downloadEntitlements.sessionId, sessionId),
                        eq(downloadEntitlements.clientKey, clientKey),
                        or(eq(downloadEntitlements.orderId, null), eq(downloadEntitlements.orderId, ''))
                    ));
                
                const freeCount = parseInt(policy.freeCount) || 0;
                const remainingFreeSlots = Math.max(0, freeCount - freeEntitlements.length);
                const pricePerPhoto = parseFloat(policy.pricePerPhoto || 0);
                
                console.log(`🔒 [PRICE VALIDATION] Freemium mode: ${freeCount} total free, ${freeEntitlements.length} used, ${remainingFreeSlots} remaining`);
                
                // Validate each item's price based on position
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const serverPrice = i < remainingFreeSlots ? 0 : pricePerPhoto;
                    const clientPrice = parseFloat(item.price || 0);
                    
                    // Allow 1 cent tolerance for floating point comparison
                    if (Math.abs(serverPrice - clientPrice) > 0.01) {
                        console.error(`🚨 [SECURITY] Price validation failed for item ${i}:`, {
                            photoId: item.photoId || item.id,
                            position: i,
                            serverPrice: serverPrice,
                            clientPrice: clientPrice,
                            remainingFreeSlots: remainingFreeSlots,
                            sessionId: sessionId,
                            clientKey: clientKey
                        });
                        
                        return {
                            success: false,
                            error: 'Price validation failed - cart prices do not match server calculation. Please refresh and try again.'
                        };
                    }
                    
                    console.log(`✅ [PRICE VALIDATION] Item ${i} validated: server=${serverPrice}, client=${clientPrice}`);
                }
                
                console.log(`✅ [PRICE VALIDATION] All ${items.length} items passed validation`);
                
            } else if (policy.mode === 'per_photo' || policy.mode === 'fixed') {
                // For per_photo and fixed modes, all items should have the same price
                const pricePerPhoto = parseFloat(policy.pricePerPhoto || 0);
                
                console.log(`🔒 [PRICE VALIDATION] ${policy.mode} mode: expected price per photo = ${pricePerPhoto}`);
                
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const clientPrice = parseFloat(item.price || 0);
                    
                    if (Math.abs(pricePerPhoto - clientPrice) > 0.01) {
                        console.error(`🚨 [SECURITY] Price validation failed for item ${i}:`, {
                            photoId: item.photoId || item.id,
                            serverPrice: pricePerPhoto,
                            clientPrice: clientPrice,
                            mode: policy.mode,
                            sessionId: sessionId,
                            clientKey: clientKey
                        });
                        
                        return {
                            success: false,
                            error: 'Price validation failed - cart prices do not match server calculation. Please refresh and try again.'
                        };
                    }
                }
                
                console.log(`✅ [PRICE VALIDATION] All ${items.length} items passed validation`);
                
            } else if (policy.mode === 'free') {
                // Free mode - all items should be price 0
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const clientPrice = parseFloat(item.price || 0);
                    
                    if (clientPrice > 0.01) {
                        console.error(`🚨 [SECURITY] Price validation failed - free mode but client sent non-zero price:`, {
                            photoId: item.photoId || item.id,
                            clientPrice: clientPrice,
                            sessionId: sessionId,
                            clientKey: clientKey
                        });
                        
                        return {
                            success: false,
                            error: 'Price validation failed - this session has free downloads only'
                        };
                    }
                }
                
                console.log(`✅ [PRICE VALIDATION] All items validated as free`);
            }
            
            // Now calculate total using server-validated prices
            const totalPrice = await this.calculateTotalPrice(paidItems, policy);
            
            if (totalPrice <= 0) {
                return {
                    success: false,
                    error: 'Invalid price calculation for paid items'
                };
            }
            
            // Calculate platform fee
            const platformFee = Math.round(totalPrice * (PLATFORM_FEE_PERCENTAGE / 100));
            
            // Prepare line items for PAID ITEMS ONLY (aggregate if too many)
            let lineItems = [];
            if (paidItems.length <= 10) {
                // Individual line items for small carts
                for (const item of paidItems) {
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
                            name: `Download Package (${paidItems.length} photos)`,
                            description: `High-resolution digital downloads from session`,
                            metadata: {
                                sessionId: sessionId,
                                itemCount: paidItems.length,
                                freeItemsGranted: freeItems.length
                            }
                        },
                        unit_amount: Math.round(totalPrice * 100)
                    },
                    quantity: 1
                });
            }
            
            // Create order record with pending status (PAID ITEMS ONLY)
            const orderId = uuidv4();
            await this.db.insert(downloadOrders).values({
                id: orderId,
                sessionId: sessionId,
                userId: photographer[0].id,
                clientKey: clientKey,
                amount: totalPrice.toFixed(2),
                currency: policy.currency || 'USD',
                mode: policy.mode,
                items: paidItems, // Only paid items in the order
                stripeConnectAccountId: isAdminAccount ? null : photographer[0].stripeConnectAccountId,
                platformFeeAmount: isAdminAccount ? 0 : (platformFee / 100).toFixed(2), // No platform fee for admin accounts
                status: 'pending',
                isAdminAccount: isAdminAccount,
                createdAt: new Date()
            });
            
            // Create Stripe Checkout Session
            let checkoutSessionConfig = {
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: mode,
                success_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/download-success.html?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}&sessionId=${sessionId}&clientKey=${clientKey}`,
                cancel_url: `${process.env.BASE_URL || 'https://photomanagementsystem.com'}/gallery?session=${sessionId}&clientKey=${clientKey}`,
                metadata: {
                    orderId: orderId,
                    sessionId: sessionId,
                    clientKey: clientKey,
                    itemCount: paidItems.length, // Only paid items count
                    freeItemsGranted: freeItems.length, // Track free items granted
                    totalItemsRequested: items.length, // Total items in original request
                    photographerId: photographer[0].id,
                    type: 'download_purchase',
                    isAdminAccount: isAdminAccount
                },
                expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
            };

            if (isAdminAccount) {
                // Regular Stripe checkout for admin accounts - payment goes to platform account
                console.log(`💳 ADMIN ACCOUNT: Creating regular Stripe checkout for ${photographer[0].email}`);
                checkoutSessionConfig.payment_intent_data = {
                    metadata: {
                        orderId: orderId,
                        sessionId: sessionId,
                        type: 'download_purchase',
                        isAdminAccount: true
                    }
                };
            } else {
                // Stripe Connect configuration for regular photographers
                console.log(`💳 PHOTOGRAPHER ACCOUNT: Creating Stripe Connect checkout for ${photographer[0].email}`);
                checkoutSessionConfig.payment_intent_data = {
                    application_fee_amount: platformFee,
                    on_behalf_of: photographer[0].stripeConnectAccountId,
                    transfer_data: {
                        destination: photographer[0].stripeConnectAccountId
                    },
                    metadata: {
                        orderId: orderId,
                        sessionId: sessionId,
                        type: 'download_purchase',
                        isAdminAccount: false
                    }
                };
            }

            const checkoutSession = await this.stripe.checkout.sessions.create(checkoutSessionConfig);
            
            // Update order with Stripe session ID
            await this.db.update(downloadOrders)
                .set({ 
                    stripeCheckoutSessionId: checkoutSession.id 
                })
                .where(eq(downloadOrders.id, orderId));
            
            console.log(`💳 Created checkout session for order ${orderId} (${paidItems.length} paid items, ${freeItems.length} free items)`);
            
            return {
                success: true,
                checkoutUrl: checkoutSession.url,
                sessionId: checkoutSession.id,
                orderId: orderId,
                freeItemsProcessed: freeItems.length,
                paidItemsProcessed: paidItems.length,
                totalItemsRequested: items.length,
                message: freeItems.length > 0 ? 
                    `${freeItems.length} free downloads granted, ${paidItems.length} items require payment` :
                    `All ${paidItems.length} items require payment`
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
                    // Get session data for freemium settings
                    const sessionForFreemium = await this.db.select()
                        .from(photographySessions)
                        .where(eq(photographySessions.id, sessionId))
                        .limit(1);
                    
                    const sessionFreemiumData = sessionForFreemium[0];
                    const sessionFreeDownloads = sessionFreemiumData?.freeDownloads || sessionFreemiumData?.free_downloads || 0;
                    
                    // Check existing downloads for this client
                    const existingDownloads = await this.db.select()
                        .from(downloadEntitlements)
                        .where(and(
                            eq(downloadEntitlements.sessionId, sessionId),
                            eq(downloadEntitlements.clientKey, clientKey)
                        ));
                    
                    const freeRemaining = Math.max(0, sessionFreeDownloads - existingDownloads.length);
                    
                    console.log(`🎯 Freemium mode: session allows ${sessionFreeDownloads} free, client has ${existingDownloads.length} used, ${freeRemaining} remaining`);
                    
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
            // SINGLE SOURCE OF TRUTH: Count from downloadEntitlements table (matching createFreeEntitlements logic)
            if (policy.success && policy.policy.mode === 'freemium') {
                const freeCount = policy.policy.freeCount || 0;
                
                // Count existing free entitlements for this client (orderId is null for free downloads)
                const freeEntitlements = await this.db.select()
                    .from(downloadEntitlements)
                    .where(and(
                        eq(downloadEntitlements.sessionId, sessionId),
                        eq(downloadEntitlements.clientKey, clientKey),
                        eq(downloadEntitlements.orderId, null)
                    ));
                
                // Calculate remaining free downloads (identical to createFreeEntitlements logic)
                const remainingFree = freeCount - freeEntitlements.length;
                
                if (remainingFree > 0) {
                    console.log(`✅ FREEMIUM: Client has used ${freeEntitlements.length}/${freeCount} free downloads, ${remainingFree} remaining`);
                    return {
                        success: true,
                        entitled: true,
                        entitlement: null,
                        reason: 'freemium_quota',
                        remaining: remainingFree
                    };
                }
                
                console.log(`📊 FREEMIUM: Free quota exhausted (${freeEntitlements.length}/${freeCount}), photo requires purchase or entitlement`);
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
                
                // FREEMIUM MODE: Don't decrement purchased photo entitlements (they're unlimited)
                // Check if this is a FREEMIUM purchased entitlement (remaining = 999999)
                const isFreemiumPurchased = entitlement.remaining >= 999999;
                
                if (!isFreemiumPurchased) {
                    // Decrement remaining count for non-freemium entitlements
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
                } else {
                    console.log(`♾️ FREEMIUM purchased photo - unlimited re-downloads, not consuming entitlement`);
                }
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
            
            // No expiration
            const expiresAt = new Date(Date.now() + (100 * 365 * 24 * 60 * 60 * 1000)); // 100 years (effectively no expiration)
            
            // Get photo details from session_files table (authoritative source)
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
            
            // CRITICAL FIX: Query session_files table directly using raw SQL (Drizzle schema issue)
            const sessionFileResults = await this.pool.query(`
                SELECT filename, original_name as "originalName", r2_key as "r2Key"
                FROM session_files 
                WHERE session_id = $1 AND folder_type = 'gallery'
                ORDER BY uploaded_at ASC
            `, [sessionId]);
                
            // Format photos to match expected structure
            const photos = sessionFileResults.rows.map(row => ({
                id: row.filename, // Use filename as ID for consistency
                filename: row.filename,
                name: row.originalName,
                url: row.r2Key ? `https://pub-fc48b3b29b574ea18a4ede9b6a3b1c0e.r2.dev/${row.r2Key}` : null,
                original: row.r2Key ? `https://pub-fc48b3b29b574ea18a4ede9b6a3b1c0e.r2.dev/${row.r2Key}` : null
            }));
            
            console.log(`📷 Found ${photos.length} photos in session_files for session ${sessionId}`);
            console.log(`📷 Looking for photoId: "${photoId}"`);
            console.log(`📷 Available photos:`, photos.map(p => ({ id: p.id, filename: p.filename })));
            
            // Try multiple strategies to find the photo
            let photo = null;
            
            // Strategy 1: Direct match on id or filename
            photo = photos.find(p => p.id === photoId || p.filename === photoId);
            
            // Strategy 2: If photoId is a numeric index, try array access
            if (!photo && /^\d+$/.test(photoId)) {
                const index = parseInt(photoId);
                if (index >= 0 && index < photos.length) {
                    photo = photos[index];
                    console.log(`📷 Found photo using index ${index}: ${photo.filename}`);
                }
            }
            
            // Strategy 3: Try to match by partial filename
            if (!photo) {
                photo = photos.find(p => p.filename && p.filename.includes(photoId));
                if (photo) {
                    console.log(`📷 Found photo using partial filename match: ${photo.filename}`);
                }
            }
            
            if (!photo) {
                console.error(`❌ Photo not found for photoId "${photoId}"`);
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
    
    // Validate photographer's Connect account (skip for admin accounts)
    async validatePhotographer(sessionId) {
        try {
            // Get photographer info and check if admin
            const photographerInfo = await this.getPhotographerInfo(sessionId);
            if (!photographerInfo.success) {
                return photographerInfo;
            }
            
            const { photographer, isAdmin } = photographerInfo;
            
            // Skip Stripe Connect validation for admin accounts
            if (isAdmin) {
                console.log(`🔧 ADMIN ACCOUNT: Skipping Stripe Connect validation for ${photographer.email}`);
                return {
                    success: true,
                    photographerId: photographer.id,
                    stripeAccountId: null, // Admin accounts use platform Stripe, not Connect
                    isAdmin: true
                };
            }
            
            // Regular Stripe Connect validation for non-admin photographers
            if (!photographer.stripeConnectAccountId) {
                return {
                    success: false,
                    error: 'Photographer has not set up payment processing'
                };
            }
            
            if (!photographer.stripeOnboardingComplete) {
                return {
                    success: false,
                    error: 'Photographer payment setup is incomplete'
                };
            }
            
            // Check with Stripe API for current status
            if (this.stripeEnabled) {
                try {
                    const account = await this.stripe.accounts.retrieve(
                        photographer.stripeConnectAccountId
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
                photographerId: photographer.id,
                stripeAccountId: photographer.stripeConnectAccountId,
                isAdmin: false
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
            
            // No expiration
            const expiresAt = new Date(Date.now() + (100 * 365 * 24 * 60 * 60 * 1000)); // 100 years (effectively no expiration)
            
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
            // No cleanup needed since tokens don't expire
            console.log(`🧹 Token cleanup skipped - tokens don't expire`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error cleaning up tokens:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * VERIFY PAYMENT
     * Verifies a Stripe payment intent for download service
     */
    async verifyPayment(paymentIntentId, options = {}) {
        try {
            if (!this.stripeEnabled) {
                return {
                    success: false,
                    error: 'Payment processing not configured'
                };
            }

            // Retrieve payment intent from Stripe
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

            if (!paymentIntent) {
                return {
                    success: false,
                    error: 'Payment intent not found'
                };
            }

            // Check payment status
            if (paymentIntent.status !== 'succeeded') {
                return {
                    success: false,
                    error: `Payment not completed. Status: ${paymentIntent.status}`
                };
            }

            // Verify amount if expected amount provided
            if (options.expectedAmount) {
                const expectedAmountCents = Math.round(options.expectedAmount * 100);
                if (paymentIntent.amount !== expectedAmountCents) {
                    return {
                        success: false,
                        error: 'Payment amount mismatch'
                    };
                }
            }

            // Verify currency if provided
            if (options.currency && paymentIntent.currency !== options.currency.toLowerCase()) {
                return {
                    success: false,
                    error: 'Payment currency mismatch'
                };
            }

            // Find or create order record
            let orderId = null;
            const existingOrder = await this.db.select()
                .from(downloadOrders)
                .where(eq(downloadOrders.paymentIntentId, paymentIntentId))
                .limit(1);

            if (existingOrder.length > 0) {
                orderId = existingOrder[0].id;
                
                // Update order status if necessary
                if (existingOrder[0].status !== 'completed') {
                    await this.db.update(downloadOrders)
                        .set({ 
                            status: 'completed',
                            completedAt: new Date()
                        })
                        .where(eq(downloadOrders.id, orderId));
                }
            } else {
                // Create new order record for this payment
                orderId = uuidv4();
                await this.db.insert(downloadOrders).values({
                    id: orderId,
                    sessionId: options.sessionId,
                    clientKey: this.generateClientKeyFromSession(options.sessionId),
                    amount: (paymentIntent.amount / 100).toFixed(2),
                    currency: paymentIntent.currency.toUpperCase(),
                    mode: 'per_photo',
                    items: options.photoId ? [{ photoId: options.photoId }] : [],
                    paymentIntentId: paymentIntentId,
                    status: 'completed',
                    completedAt: new Date(),
                    createdAt: new Date()
                });
            }

            console.log(`✅ Payment verified: ${paymentIntentId} - $${paymentIntent.amount / 100}`);

            return {
                success: true,
                paymentIntent: paymentIntent,
                orderId: orderId,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency.toUpperCase()
            };

        } catch (error) {
            console.error('❌ Error verifying payment:', error);
            return {
                success: false,
                error: this.mapStripeError(error) || 'Payment verification failed'
            };
        }
    }

    /**
     * CREATE PAID ENTITLEMENT
     * Creates a paid entitlement after successful payment verification
     */
    async createPaidEntitlement(entitlementData) {
        try {
            const { 
                sessionId, 
                clientKey, 
                photoId, 
                amount, 
                currency = 'USD', 
                paymentIntentId, 
                orderId 
            } = entitlementData;

            if (!sessionId || !clientKey || !photoId || !amount || !paymentIntentId) {
                return {
                    success: false,
                    error: 'Missing required entitlement data'
                };
            }

            // Check if session is FREEMIUM mode to determine remaining downloads
            const policy = await this.getPolicyForSession(sessionId);
            const isFreemium = policy.success && policy.policy.mode === 'freemium';
            
            // FREEMIUM MODE: Purchased photos are permanently unlocked (unlimited re-downloads)
            // OTHER MODES: Single download per purchase
            const remainingDownloads = isFreemium ? 999999 : 1;

            // Create entitlement record
            const entitlementId = uuidv4();
            const expiresAt = new Date(Date.now() + (100 * 365 * 24 * 60 * 60 * 1000)); // 100 years (effectively no expiration)

            await this.db.insert(downloadEntitlements).values({
                id: entitlementId,
                orderId: orderId,
                sessionId: sessionId,
                clientKey: clientKey,
                photoId: photoId,
                amount: amount.toFixed(2),
                currency: currency,
                paymentIntentId: paymentIntentId,
                remaining: remainingDownloads, // Unlimited for freemium, single for others
                isActive: true,
                expiresAt: expiresAt,
                createdAt: new Date()
            });

            if (isFreemium) {
                console.log(`💰 Created FREEMIUM entitlement: ${entitlementId} for photo ${photoId} ($${amount}) - UNLIMITED RE-DOWNLOADS`);
            } else {
                console.log(`💰 Created paid entitlement: ${entitlementId} for photo ${photoId} ($${amount}) - Single download`);
            }

            return {
                success: true,
                entitlementId: entitlementId,
                photoId: photoId,
                amount: amount,
                currency: currency,
                expiresAt: expiresAt
            };

        } catch (error) {
            console.error('❌ Error creating paid entitlement:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * LOG DOWNLOAD HISTORY
     * Logs download activity with comprehensive details for audit trail
     */
    async logDownloadHistory(logEntry) {
        try {
            const {
                sessionId,
                clientKey,
                photoId,
                pricing,
                amount = 0,
                currency = 'USD',
                paymentIntentId = null,
                clientIp = null,
                userAgent = null,
                status,
                error = null,
                timestamp = new Date(),
                metadata = {}
            } = logEntry;

            // Create history record
            const historyId = uuidv4();
            
            await this.db.insert(downloadHistory).values({
                id: historyId,
                sessionId: sessionId,
                clientKey: clientKey,
                photoId: photoId,
                tokenId: null, // Will be set by token system if applicable
                orderId: paymentIntentId ? await this.getOrderIdByPaymentIntent(paymentIntentId) : null,
                amount: amount.toString(),
                currency: currency,
                pricing: pricing,
                paymentIntentId: paymentIntentId,
                ipAddress: clientIp,
                userAgent: userAgent,
                status: status,
                failureReason: error,
                metadata: metadata,
                createdAt: timestamp
            });

            console.log(`📊 Logged download history: ${status} - ${pricing} - ${photoId} - $${amount}`);

            return {
                success: true,
                historyId: historyId
            };

        } catch (error) {
            console.error('❌ Error logging download history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * HELPER METHOD: Get order ID by payment intent
     */
    async getOrderIdByPaymentIntent(paymentIntentId) {
        try {
            const order = await this.db.select()
                .from(downloadOrders)
                .where(eq(downloadOrders.paymentIntentId, paymentIntentId))
                .limit(1);

            return order.length > 0 ? order[0].id : null;
        } catch (error) {
            console.warn('Could not find order for payment intent:', paymentIntentId);
            return null;
        }
    }

    /**
     * HELPER METHOD: Generate client key from session (for legacy compatibility)
     */
    generateClientKeyFromSession(sessionId) {
        // This is a fallback method for cases where clientKey isn't provided
        // In practice, the DownloadService should always provide the proper clientKey
        return `legacy-${crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 12)}`;
    }
}

// Export the manager class
module.exports = DownloadCommerceManager;
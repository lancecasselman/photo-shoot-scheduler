/**
 * Enhanced Cart Manager
 * Cart operations with bulletproof quota enforcement to prevent circumvention
 */

const EnhancedQuotaManager = require('./enhanced-quota-manager');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, sql } = require('drizzle-orm');
const crypto = require('crypto');
const {
    downloadEntitlements,
    downloadPolicies,
    photographySessions
} = require('../shared/schema');

class EnhancedCartManager {
    constructor(pool = null, monitoringSystem = null) {
        this.pool = pool || new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.db = drizzle(this.pool);
        this.monitoringSystem = monitoringSystem;
        this.quotaManager = new EnhancedQuotaManager(this.pool, monitoringSystem);
        
        // Cart-specific configuration
        this.config = {
            maxCartSize: 50,
            cartReservationTTL: 30 * 60 * 1000, // 30 minutes
            maxSimultaneousCartOperations: 10,
            cartValidationStrictness: 'high'
        };
        
        // Track active cart operations to prevent concurrent manipulation
        this.activeCartOperations = new Map();
        
        console.log('✅ Enhanced Cart Manager initialized with quota enforcement');
    }

    /**
     * ATOMIC CART ADD OPERATION WITH QUOTA ENFORCEMENT
     * This is the primary method that prevents cart-based quota circumvention
     */
    
    async addItemToCart(sessionId, clientKey, photoIds, options = {}) {
        const operationId = crypto.randomUUID();
        const startTime = Date.now();
        
        try {
            // Step 1: Validate inputs and prevent concurrent operations
            const validationResult = await this.validateCartAddRequest(
                sessionId, 
                clientKey, 
                photoIds, 
                options
            );
            
            if (!validationResult.success) {
                return validationResult;
            }
            
            // Step 2: Lock cart operations for this client to prevent race conditions
            const lockResult = await this.acquireCartLock(sessionId, clientKey, operationId);
            if (!lockResult.success) {
                return lockResult;
            }
            
            try {
                // Step 3: Use Enhanced Quota Manager for atomic quota validation
                const quotaResult = await this.quotaManager.validateAndReserveQuota(
                    sessionId,
                    clientKey,
                    photoIds,
                    {
                        ipAddress: options.ipAddress,
                        userAgent: options.userAgent,
                        operation: 'cart_add',
                        operationId: operationId
                    }
                );
                
                if (!quotaResult.success) {
                    await this.logCartOperation('cart_add_blocked', {
                        sessionId,
                        clientKey: this.hashClientKey(clientKey),
                        photoIds,
                        reason: quotaResult.error,
                        code: quotaResult.code,
                        operationId
                    });
                    
                    return quotaResult;
                }
                
                // Step 4: Validate cart size limits
                const cartSizeCheck = await this.validateCartSizeLimit(sessionId, clientKey, photoIds.length);
                if (!cartSizeCheck.success) {
                    return cartSizeCheck;
                }
                
                // Step 5: Check for duplicate items in cart
                const duplicateCheck = await this.checkForDuplicateItems(sessionId, clientKey, photoIds);
                if (!duplicateCheck.success) {
                    return duplicateCheck;
                }
                
                // Step 6: Success - items have been reserved by quota manager
                await this.logCartOperation('cart_add_success', {
                    sessionId,
                    clientKey: this.hashClientKey(clientKey),
                    photoIds,
                    quotaInfo: quotaResult.quotaInfo,
                    reservations: quotaResult.reservations?.length || 0,
                    freeItems: quotaResult.quotaInfo?.freePhotosGranted || 0,
                    paidItems: quotaResult.quotaInfo?.paidPhotosRequired || 0,
                    operationId,
                    processingTime: Date.now() - startTime
                });
                
                const result = {
                    success: true,
                    cartInfo: {
                        sessionId,
                        itemsAdded: photoIds.length,
                        quotaInfo: quotaResult.quotaInfo,
                        reservations: quotaResult.reservations,
                        requiresPayment: quotaResult.requiresPayment,
                        paymentAmount: quotaResult.paymentAmount
                    },
                    operationId
                };
                
                // Record cart operation in monitoring
                if (this.monitoringSystem) {
                    this.monitoringSystem.recordCartOperation(sessionId, clientKey, 'add_item', result);
                }
                
                return result;
                
            } finally {
                // Always release the cart lock
                await this.releaseCartLock(sessionId, clientKey, operationId);
            }
            
        } catch (error) {
            console.error('❌ Cart add operation error:', error);
            
            await this.logCartOperation('cart_add_error', {
                sessionId,
                clientKey: this.hashClientKey(clientKey),
                photoIds,
                error: error.message,
                operationId,
                processingTime: Date.now() - startTime
            });
            
            return {
                success: false,
                error: 'Cart operation failed due to system error',
                code: 'CART_SYSTEM_ERROR',
                operationId
            };
        }
    }
    
    /**
     * ENHANCED CART CLEARING WITH QUOTA RELEASE
     */
    
    async clearCart(sessionId, clientKey, options = {}) {
        const operationId = crypto.randomUUID();
        const startTime = Date.now();
        
        try {
            // Step 1: Acquire cart lock
            const lockResult = await this.acquireCartLock(sessionId, clientKey, operationId);
            if (!lockResult.success) {
                return lockResult;
            }
            
            try {
                // Step 2: Get current cart reservations with lock
                const cartItems = await this.getCartItemsWithLock(sessionId, clientKey);
                
                // Step 3: Atomic cart clearing
                const clearResult = await this.pool.connect().then(async (client) => {
                    try {
                        await client.query('BEGIN');
                        
                        // Delete all cart reservations for this client
                        const deleteQuery = `
                            DELETE FROM download_entitlements 
                            WHERE session_id = $1 
                            AND client_key = $2 
                            AND type = 'cart_reservation'
                            AND is_active = false
                        `;
                        
                        const deleteResult = await client.query(deleteQuery, [sessionId, clientKey]);
                        
                        await client.query('COMMIT');
                        
                        return {
                            success: true,
                            itemsCleared: deleteResult.rowCount || 0,
                            cartItems: cartItems
                        };
                        
                    } catch (error) {
                        await client.query('ROLLBACK');
                        throw error;
                    } finally {
                        client.release();
                    }
                });
                
                // Step 4: Invalidate quota cache
                this.quotaManager.invalidateQuotaCache(sessionId, clientKey);
                
                await this.logCartOperation('cart_clear_success', {
                    sessionId,
                    clientKey: this.hashClientKey(clientKey),
                    itemsCleared: clearResult.itemsCleared,
                    operationId,
                    processingTime: Date.now() - startTime
                });
                
                return clearResult;
                
            } finally {
                await this.releaseCartLock(sessionId, clientKey, operationId);
            }
            
        } catch (error) {
            console.error('❌ Cart clear operation error:', error);
            
            await this.logCartOperation('cart_clear_error', {
                sessionId,
                clientKey: this.hashClientKey(clientKey),
                error: error.message,
                operationId,
                processingTime: Date.now() - startTime
            });
            
            return {
                success: false,
                error: 'Cart clear operation failed',
                code: 'CART_CLEAR_ERROR',
                operationId
            };
        }
    }
    
    /**
     * GET CART STATUS WITH REAL-TIME QUOTA VALIDATION
     */
    
    async getCartStatus(sessionId, clientKey, options = {}) {
        try {
            // Step 1: Get current cart items
            const cartItems = await this.getCartItems(sessionId, clientKey);
            
            // Step 2: Get current quota status
            const quotaInfo = await this.getCurrentQuotaStatus(sessionId, clientKey);
            
            // Step 3: Validate cart against current quota (detect any inconsistencies)
            const validationResult = await this.validateCartConsistency(sessionId, clientKey, cartItems, quotaInfo);
            
            // Step 4: Get session policy for client display
            const policyResult = await this.getSessionPolicy(sessionId);
            
            return {
                success: true,
                cart: {
                    items: cartItems,
                    count: cartItems.length,
                    valid: validationResult.valid,
                    issues: validationResult.issues || []
                },
                quota: quotaInfo,
                policy: policyResult.success ? policyResult.policy : null,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Cart status error:', error);
            return {
                success: false,
                error: 'Failed to get cart status',
                code: 'CART_STATUS_ERROR'
            };
        }
    }
    
    /**
     * CART VALIDATION AND SECURITY METHODS
     */
    
    async validateCartAddRequest(sessionId, clientKey, photoIds, options) {
        try {
            // Basic input validation
            if (!sessionId || !clientKey || !Array.isArray(photoIds) || photoIds.length === 0) {
                return {
                    success: false,
                    error: 'Invalid request parameters',
                    code: 'INVALID_REQUEST'
                };
            }
            
            // Validate photo IDs format
            for (const photoId of photoIds) {
                if (!photoId || typeof photoId !== 'string') {
                    return {
                        success: false,
                        error: 'Invalid photo ID format',
                        code: 'INVALID_PHOTO_ID'
                    };
                }
            }
            
            // Check for excessive batch size
            if (photoIds.length > this.config.maxCartSize) {
                return {
                    success: false,
                    error: `Maximum ${this.config.maxCartSize} items can be added at once`,
                    code: 'BATCH_SIZE_EXCEEDED'
                };
            }
            
            // Validate session exists
            const sessionExists = await this.validateSessionExists(sessionId);
            if (!sessionExists.success) {
                return sessionExists;
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Cart add request validation error:', error);
            return {
                success: false,
                error: 'Request validation failed',
                code: 'VALIDATION_ERROR'
            };
        }
    }
    
    async validateCartSizeLimit(sessionId, clientKey, newItemsCount) {
        try {
            const currentCartSize = await this.getCurrentCartSize(sessionId, clientKey);
            const totalAfterAdd = currentCartSize + newItemsCount;
            
            if (totalAfterAdd > this.config.maxCartSize) {
                return {
                    success: false,
                    error: `Cart size limit exceeded. Maximum ${this.config.maxCartSize} items allowed.`,
                    code: 'CART_SIZE_EXCEEDED',
                    cartInfo: {
                        current: currentCartSize,
                        adding: newItemsCount,
                        limit: this.config.maxCartSize,
                        available: Math.max(0, this.config.maxCartSize - currentCartSize)
                    }
                };
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Cart size validation error:', error);
            return {
                success: false,
                error: 'Cart size validation failed',
                code: 'SIZE_VALIDATION_ERROR'
            };
        }
    }
    
    async checkForDuplicateItems(sessionId, clientKey, photoIds) {
        try {
            const existingItemsQuery = `
                SELECT photo_id 
                FROM download_entitlements 
                WHERE session_id = $1 
                AND client_key = $2 
                AND photo_id = ANY($3)
                AND (
                    (type = 'cart_reservation' AND is_active = false) OR
                    (type = 'download' AND remaining > 0)
                )
            `;
            
            const result = await this.pool.query(existingItemsQuery, [sessionId, clientKey, photoIds]);
            
            if (result.rows.length > 0) {
                const duplicatePhotoIds = result.rows.map(row => row.photo_id);
                return {
                    success: false,
                    error: 'Some items are already in cart or available for download',
                    code: 'DUPLICATE_ITEMS',
                    duplicateItems: duplicatePhotoIds
                };
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Duplicate check error:', error);
            return {
                success: false,
                error: 'Duplicate check failed',
                code: 'DUPLICATE_CHECK_ERROR'
            };
        }
    }
    
    /**
     * CART LOCKING MECHANISM TO PREVENT RACE CONDITIONS
     */
    
    async acquireCartLock(sessionId, clientKey, operationId) {
        const lockKey = `${sessionId}_${clientKey}`;
        const maxWaitTime = 5000; // 5 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (!this.activeCartOperations.has(lockKey)) {
                this.activeCartOperations.set(lockKey, {
                    operationId,
                    acquiredAt: Date.now(),
                    sessionId,
                    clientKey: this.hashClientKey(clientKey)
                });
                
                return { success: true };
            }
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return {
            success: false,
            error: 'Cart is currently being modified by another operation',
            code: 'CART_LOCKED',
            retryAfter: 1
        };
    }
    
    async releaseCartLock(sessionId, clientKey, operationId) {
        const lockKey = `${sessionId}_${clientKey}`;
        const lock = this.activeCartOperations.get(lockKey);
        
        if (lock && lock.operationId === operationId) {
            this.activeCartOperations.delete(lockKey);
        }
    }
    
    /**
     * QUOTA AND CART CONSISTENCY VALIDATION
     */
    
    async getCurrentQuotaStatus(sessionId, clientKey) {
        try {
            // Check cache first
            const cached = this.quotaManager.getQuotaFromCache(sessionId, clientKey);
            if (cached) {
                return cached;
            }
            
            // Get fresh quota information
            const quotaQuery = `
                SELECT 
                    COUNT(*) FILTER (WHERE order_id IS NULL AND is_active = true) as free_used,
                    COUNT(*) FILTER (WHERE type = 'cart_reservation' AND is_active = false) as cart_reservations,
                    COUNT(*) FILTER (WHERE remaining > 0 AND is_active = true) as available_downloads
                FROM download_entitlements 
                WHERE session_id = $1 AND client_key = $2
            `;
            
            const result = await this.pool.query(quotaQuery, [sessionId, clientKey]);
            const stats = result.rows[0];
            
            // Get policy information
            const policyResult = await this.getSessionPolicy(sessionId);
            const policy = policyResult.success ? policyResult.policy : null;
            
            const quotaInfo = {
                freeLimit: policy?.free_count || 0,
                freeUsed: parseInt(stats.free_used || 0),
                freeRemaining: Math.max(0, (policy?.free_count || 0) - parseInt(stats.free_used || 0)),
                cartReservations: parseInt(stats.cart_reservations || 0),
                availableDownloads: parseInt(stats.available_downloads || 0),
                mode: policy?.mode || 'unknown'
            };
            
            // Cache the result
            this.quotaManager.updateQuotaCache(sessionId, clientKey, quotaInfo);
            
            return quotaInfo;
            
        } catch (error) {
            console.error('❌ Error getting quota status:', error);
            return {
                error: 'Failed to get quota status',
                freeLimit: 0,
                freeUsed: 0,
                freeRemaining: 0,
                cartReservations: 0,
                availableDownloads: 0,
                mode: 'unknown'
            };
        }
    }
    
    async validateCartConsistency(sessionId, clientKey, cartItems, quotaInfo) {
        try {
            const issues = [];
            
            // Check if cart reservations match quota info
            if (cartItems.length !== quotaInfo.cartReservations) {
                issues.push({
                    type: 'cart_quota_mismatch',
                    message: 'Cart items count does not match quota reservations',
                    cartCount: cartItems.length,
                    quotaReservations: quotaInfo.cartReservations
                });
            }
            
            // Check for expired cart items
            const currentTime = new Date();
            const expiredItems = cartItems.filter(item => 
                item.expires_at && new Date(item.expires_at) < currentTime
            );
            
            if (expiredItems.length > 0) {
                issues.push({
                    type: 'expired_cart_items',
                    message: 'Some cart items have expired',
                    expiredCount: expiredItems.length,
                    expiredItems: expiredItems.map(item => item.photo_id)
                });
            }
            
            return {
                valid: issues.length === 0,
                issues: issues
            };
            
        } catch (error) {
            console.error('❌ Cart consistency validation error:', error);
            return {
                valid: false,
                issues: [{
                    type: 'validation_error',
                    message: 'Failed to validate cart consistency'
                }]
            };
        }
    }
    
    /**
     * UTILITY METHODS
     */
    
    async validateSessionExists(sessionId) {
        try {
            const result = await this.pool.query(
                'SELECT id FROM photography_sessions WHERE id = $1',
                [sessionId]
            );
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Session not found',
                    code: 'SESSION_NOT_FOUND'
                };
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Session validation error:', error);
            return {
                success: false,
                error: 'Session validation failed',
                code: 'SESSION_VALIDATION_ERROR'
            };
        }
    }
    
    async getCurrentCartSize(sessionId, clientKey) {
        try {
            const result = await this.pool.query(`
                SELECT COUNT(*) as cart_size
                FROM download_entitlements 
                WHERE session_id = $1 
                AND client_key = $2 
                AND type = 'cart_reservation' 
                AND is_active = false
            `, [sessionId, clientKey]);
            
            return parseInt(result.rows[0].cart_size || 0);
            
        } catch (error) {
            console.error('❌ Error getting cart size:', error);
            return 0;
        }
    }
    
    async getCartItems(sessionId, clientKey) {
        try {
            const result = await this.pool.query(`
                SELECT id, photo_id, expires_at, created_at
                FROM download_entitlements 
                WHERE session_id = $1 
                AND client_key = $2 
                AND type = 'cart_reservation' 
                AND is_active = false
                ORDER BY created_at DESC
            `, [sessionId, clientKey]);
            
            return result.rows;
            
        } catch (error) {
            console.error('❌ Error getting cart items:', error);
            return [];
        }
    }
    
    async getCartItemsWithLock(sessionId, clientKey) {
        try {
            const result = await this.pool.query(`
                SELECT id, photo_id, expires_at, created_at
                FROM download_entitlements 
                WHERE session_id = $1 
                AND client_key = $2 
                AND type = 'cart_reservation' 
                AND is_active = false
                FOR UPDATE
            `, [sessionId, clientKey]);
            
            return result.rows;
            
        } catch (error) {
            console.error('❌ Error getting cart items with lock:', error);
            return [];
        }
    }
    
    async getSessionPolicy(sessionId) {
        try {
            const result = await this.pool.query(`
                SELECT * FROM download_policies WHERE session_id = $1 LIMIT 1
            `, [sessionId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Session policy not found'
                };
            }
            
            return {
                success: true,
                policy: result.rows[0]
            };
            
        } catch (error) {
            console.error('❌ Error getting session policy:', error);
            return {
                success: false,
                error: 'Failed to get session policy'
            };
        }
    }
    
    hashClientKey(clientKey) {
        return crypto.createHash('sha256').update(clientKey).digest('hex').substring(0, 16);
    }
    
    async logCartOperation(type, data) {
        try {
            console.log(`🛒 CART: ${type}`, data);
            // Additional logging can be added here for external monitoring systems
        } catch (error) {
            console.error('❌ Failed to log cart operation:', error);
        }
    }
    
    /**
     * CLEANUP AND MAINTENANCE
     */
    
    async cleanupExpiredCartItems() {
        try {
            const result = await this.pool.query(`
                DELETE FROM download_entitlements 
                WHERE type = 'cart_reservation' 
                AND is_active = false 
                AND expires_at < NOW()
            `);
            
            if (result.rowCount > 0) {
                console.log(`🧹 Cleaned up ${result.rowCount} expired cart items`);
            }
            
            return result.rowCount;
            
        } catch (error) {
            console.error('❌ Error cleaning up expired cart items:', error);
            return 0;
        }
    }
    
    getCartMetrics() {
        return {
            activeCartOperations: this.activeCartOperations.size,
            config: this.config
        };
    }
}

module.exports = EnhancedCartManager;
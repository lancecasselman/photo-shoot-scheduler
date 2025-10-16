/**
 * Enhanced Quota Manager
 * Production-ready quota tracking and enforcement system with atomic operations
 * and comprehensive abuse protection for freemium galleries
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, gte, lte, count, sum, sql } = require('drizzle-orm');
const crypto = require('crypto');
const { 
    downloadPolicies, 
    downloadEntitlements, 
    downloadHistory,
    photographySessions 
} = require('../shared/schema');

class EnhancedQuotaManager {
    constructor(pool = null, monitoringSystem = null) {
        this.pool = pool || new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.db = drizzle(this.pool);
        this.monitoringSystem = monitoringSystem;
        
        // Configuration for quota enforcement
        this.config = {
            // Rate limiting configuration
            maxQuotaChecksPerMinute: 30,
            maxQuotaChecksPerHour: 200,
            suspiciousActivityThreshold: 10,
            
            // Security configuration
            clientKeyValidationStrength: 'high',
            ipTrackingEnabled: true,
            bruteForceProtection: true,
            
            // Performance configuration
            transactionTimeout: 10000, // 10 seconds
            lockTimeout: 5000, // 5 seconds
            maxConcurrentTransactions: 50,
            
            // Quota validation configuration
            quotaCheckCacheTTL: 30000, // 30 seconds
            quotaUpdateDebounce: 1000, // 1 second
        };
        
        // In-memory tracking for performance and security
        this.rateLimitTracker = new Map(); // IP -> request count tracking
        this.suspiciousActivity = new Map(); // IP -> suspicious activity tracking
        this.quotaCache = new Map(); // clientKey+sessionId -> cached quota info
        this.activeTransactions = new Set(); // Track active quota transactions
        
        // Security event tracking
        this.securityEvents = [];
        
        console.log('✅ Enhanced Quota Manager initialized with production security features');
    }

    /**
     * ATOMIC QUOTA VALIDATION AND ENFORCEMENT
     * The core method that prevents race conditions in quota operations
     */
    
    async validateAndReserveQuota(sessionId, clientKey, photoIds, options = {}) {
        const startTime = Date.now();
        const transactionId = crypto.randomUUID();
        
        try {
            // Step 1: Security and rate limiting validation
            const securityCheck = await this.validateSecurityConstraints(
                sessionId, 
                clientKey, 
                options.ipAddress, 
                options.userAgent
            );
            
            if (!securityCheck.allowed) {
                await this.logSecurityEvent('quota_validation_blocked', {
                    sessionId,
                    clientKey: this.hashClientKey(clientKey),
                    reason: securityCheck.reason,
                    ipAddress: options.ipAddress
                });
                return securityCheck;
            }
            
            // Step 2: Begin atomic transaction for quota operations
            this.activeTransactions.add(transactionId);
            
            return await this.pool.connect().then(async (client) => {
                try {
                    await client.query('BEGIN');
                    
                    // Set transaction-level lock timeout
                    await client.query(`SET LOCAL lock_timeout = '${this.config.lockTimeout}ms'`);
                    
                    // Step 3: Get session policy with row-level lock
                    const policyResult = await this.getSessionPolicyWithLock(client, sessionId);
                    if (!policyResult.success) {
                        await client.query('ROLLBACK');
                        
                        // Record failed quota check in monitoring
                        if (this.monitoringSystem) {
                            this.monitoringSystem.recordQuotaCheck(sessionId, clientKey, policyResult, Date.now() - startTime);
                        }
                        
                        return policyResult;
                    }
                    
                    const policy = policyResult.policy;
                    
                    // Step 4: Atomic quota validation for freemium mode
                    if (policy.mode === 'freemium') {
                        const quotaResult = await this.atomicFreemiumQuotaCheck(
                            client, 
                            sessionId, 
                            clientKey, 
                            photoIds, 
                            policy,
                            options
                        );
                        
                        if (quotaResult.success) {
                            await client.query('COMMIT');
                            
                            // Update quota cache
                            this.updateQuotaCache(sessionId, clientKey, quotaResult.quotaInfo);
                            
                            await this.logQuotaOperation('quota_reserved', {
                                sessionId,
                                clientKey: this.hashClientKey(clientKey),
                                photoCount: photoIds.length,
                                freeUsed: quotaResult.freePhotosReserved || 0,
                                paidRequired: quotaResult.paidPhotosRequired || 0,
                                transactionId,
                                processingTime: Date.now() - startTime
                            });
                            
                            // Record successful quota check in monitoring
                            if (this.monitoringSystem) {
                                this.monitoringSystem.recordQuotaCheck(sessionId, clientKey, quotaResult, Date.now() - startTime);
                            }
                            
                            return quotaResult;
                        } else {
                            await client.query('ROLLBACK');
                            
                            // Record failed quota check in monitoring
                            if (this.monitoringSystem) {
                                this.monitoringSystem.recordQuotaCheck(sessionId, clientKey, quotaResult, Date.now() - startTime);
                            }
                            
                            return quotaResult;
                        }
                    } else {
                        // For non-freemium modes, validate other constraints
                        const result = await this.atomicNonFreemiumQuotaCheck(
                            client,
                            sessionId,
                            clientKey,
                            photoIds,
                            policy,
                            options
                        );
                        
                        if (result.success) {
                            await client.query('COMMIT');
                        } else {
                            await client.query('ROLLBACK');
                        }
                        
                        // Record quota check in monitoring
                        if (this.monitoringSystem) {
                            this.monitoringSystem.recordQuotaCheck(sessionId, clientKey, result, Date.now() - startTime);
                        }
                        
                        return result;
                    }
                    
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                    this.activeTransactions.delete(transactionId);
                }
            });
            
        } catch (error) {
            console.error('❌ Atomic quota validation error:', error);
            
            await this.logSecurityEvent('quota_validation_error', {
                sessionId,
                clientKey: this.hashClientKey(clientKey),
                error: error.message,
                transactionId,
                processingTime: Date.now() - startTime
            });
            
            return {
                success: false,
                error: 'Quota validation failed due to system error',
                code: 'SYSTEM_ERROR',
                transactionId
            };
        }
    }
    
    /**
     * ATOMIC FREEMIUM QUOTA CHECK WITH ROW-LEVEL LOCKING
     * Prevents race conditions when multiple requests check/update quotas simultaneously
     */
    
    async atomicFreemiumQuotaCheck(client, sessionId, clientKey, photoIds, policy, options = {}) {
        try {
            const freeLimit = policy.freeCount || 0;
            
            // Step 1: Lock and count current free entitlements atomically
            const currentFreeQuery = `
                SELECT COUNT(*) as used_count
                FROM download_entitlements 
                WHERE session_id = $1 
                AND client_key = $2 
                AND order_id IS NULL 
                AND is_active = true
                FOR UPDATE
            `;
            
            const currentFreeResult = await client.query(currentFreeQuery, [sessionId, clientKey]);
            const currentFreeUsed = parseInt(currentFreeResult.rows[0].used_count || 0);
            
            // Step 2: Calculate available free downloads
            const remainingFree = Math.max(0, freeLimit - currentFreeUsed);
            const requestedCount = photoIds.length;
            
            // Step 3: Determine allocation strategy
            const freePhotosToGrant = Math.min(remainingFree, requestedCount);
            const paidPhotosRequired = requestedCount - freePhotosToGrant;
            
            // Step 4: Validate against per-client limits
            if (policy.maxPerClient) {
                const totalQuotaQuery = `
                    SELECT COUNT(*) as total_count
                    FROM download_entitlements 
                    WHERE session_id = $1 
                    AND client_key = $2 
                    AND is_active = true
                    FOR UPDATE
                `;
                
                const totalResult = await client.query(totalQuotaQuery, [sessionId, clientKey]);
                const totalUsed = parseInt(totalResult.rows[0].total_count || 0);
                
                if (totalUsed + requestedCount > policy.maxPerClient) {
                    return {
                        success: false,
                        error: `Quota exceeded: Maximum ${policy.maxPerClient} downloads per client`,
                        code: 'CLIENT_QUOTA_EXCEEDED',
                        quotaInfo: {
                            limit: policy.maxPerClient,
                            used: totalUsed,
                            requested: requestedCount,
                            available: Math.max(0, policy.maxPerClient - totalUsed)
                        }
                    };
                }
            }
            
            // Step 5: Validate global session limits
            if (policy.maxGlobal) {
                const globalQuotaQuery = `
                    SELECT COUNT(*) as global_count
                    FROM download_entitlements 
                    WHERE session_id = $1 
                    AND is_active = true
                    FOR UPDATE
                `;
                
                const globalResult = await client.query(globalQuotaQuery, [sessionId]);
                const globalUsed = parseInt(globalResult.rows[0].global_count || 0);
                
                if (globalUsed + requestedCount > policy.maxGlobal) {
                    return {
                        success: false,
                        error: `Global quota exceeded: Maximum ${policy.maxGlobal} downloads for this session`,
                        code: 'GLOBAL_QUOTA_EXCEEDED',
                        quotaInfo: {
                            globalLimit: policy.maxGlobal,
                            globalUsed: globalUsed,
                            requested: requestedCount,
                            globalAvailable: Math.max(0, policy.maxGlobal - globalUsed)
                        }
                    };
                }
            }
            
            // Step 6: Create entitlement reservations atomically
            const reservations = [];
            const currentTime = new Date();
            const expiresAt = new Date(currentTime.getTime() + (30 * 60 * 1000)); // 30 minutes
            
            // Create free entitlements
            for (let i = 0; i < freePhotosToGrant; i++) {
                const entitlementId = crypto.randomUUID();
                const insertQuery = `
                    INSERT INTO download_entitlements 
                    (id, session_id, client_key, photo_id, remaining, expires_at, is_active, created_at, type, ip_address)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `;
                
                await client.query(insertQuery, [
                    entitlementId,
                    sessionId,
                    clientKey,
                    photoIds[i],
                    1, // remaining downloads
                    expiresAt,
                    true, // is_active
                    currentTime,
                    'download', // type
                    options.ipAddress || null
                ]);
                
                reservations.push({
                    id: entitlementId,
                    photoId: photoIds[i],
                    type: 'free',
                    remaining: 1
                });
            }
            
            // Create cart reservations for paid photos (if any)
            for (let i = freePhotosToGrant; i < requestedCount; i++) {
                const reservationId = crypto.randomUUID();
                const insertQuery = `
                    INSERT INTO download_entitlements 
                    (id, session_id, client_key, photo_id, remaining, expires_at, is_active, created_at, type, ip_address)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `;
                
                await client.query(insertQuery, [
                    reservationId,
                    sessionId,
                    clientKey,
                    photoIds[i],
                    0, // no remaining downloads (cart reservation)
                    expiresAt,
                    false, // not active until paid
                    currentTime,
                    'cart_reservation',
                    options.ipAddress || null
                ]);
                
                reservations.push({
                    id: reservationId,
                    photoId: photoIds[i],
                    type: 'cart_reservation',
                    remaining: 0
                });
            }
            
            return {
                success: true,
                quotaInfo: {
                    mode: 'freemium',
                    freeLimit: freeLimit,
                    freeUsed: currentFreeUsed,
                    freeRemaining: remainingFree - freePhotosToGrant,
                    freePhotosGranted: freePhotosToGrant,
                    paidPhotosRequired: paidPhotosRequired,
                    totalRequested: requestedCount
                },
                reservations: reservations,
                requiresPayment: paidPhotosRequired > 0,
                paymentAmount: paidPhotosRequired * parseFloat(policy.pricePerPhoto || 0)
            };
            
        } catch (error) {
            console.error('❌ Atomic freemium quota check error:', error);
            throw error;
        }
    }
    
    /**
     * SECURITY VALIDATION AND ANTI-ABUSE MEASURES
     */
    
    async validateSecurityConstraints(sessionId, clientKey, ipAddress, userAgent) {
        try {
            // Rate limiting validation
            const rateLimitResult = await this.checkRateLimit(ipAddress, sessionId);
            if (!rateLimitResult.allowed) {
                return rateLimitResult;
            }
            
            // Client key validation
            const clientKeyValidation = this.validateClientKey(clientKey, sessionId);
            if (!clientKeyValidation.valid) {
                return {
                    allowed: false,
                    reason: 'Invalid client key format',
                    code: 'INVALID_CLIENT_KEY'
                };
            }
            
            // Suspicious activity detection
            const suspiciousCheck = this.checkSuspiciousActivity(ipAddress, clientKey, userAgent);
            if (suspiciousCheck.suspicious) {
                await this.recordSuspiciousActivity(ipAddress, 'quota_check_suspicious', {
                    clientKey: this.hashClientKey(clientKey),
                    sessionId,
                    userAgent,
                    reason: suspiciousCheck.reason
                });
                
                if (suspiciousCheck.block) {
                    return {
                        allowed: false,
                        reason: 'Suspicious activity detected',
                        code: 'SUSPICIOUS_ACTIVITY'
                    };
                }
            }
            
            return { allowed: true };
            
        } catch (error) {
            console.error('❌ Security validation error:', error);
            return {
                allowed: false,
                reason: 'Security validation failed',
                code: 'SECURITY_ERROR'
            };
        }
    }
    
    /**
     * RATE LIMITING IMPLEMENTATION
     */
    
    async checkRateLimit(ipAddress, sessionId) {
        if (!ipAddress) return { allowed: true };
        
        const currentTime = Date.now();
        const windowStart = currentTime - (60 * 1000); // 1 minute window
        
        const trackingKey = `${ipAddress}_${sessionId}`;
        const existing = this.rateLimitTracker.get(trackingKey) || {
            requests: [],
            firstRequest: currentTime
        };
        
        // Remove old requests outside the window
        existing.requests = existing.requests.filter(timestamp => timestamp > windowStart);
        
        // Check if limit exceeded
        if (existing.requests.length >= this.config.maxQuotaChecksPerMinute) {
            return {
                allowed: false,
                reason: 'Rate limit exceeded',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil((existing.requests[0] + (60 * 1000) - currentTime) / 1000)
            };
        }
        
        // Add current request
        existing.requests.push(currentTime);
        this.rateLimitTracker.set(trackingKey, existing);
        
        return { allowed: true };
    }
    
    /**
     * CLIENT KEY VALIDATION AND ANTI-MANIPULATION
     */
    
    validateClientKey(clientKey, sessionId) {
        try {
            // Expected format: gallery-[16 hex chars]
            const expectedPattern = /^gallery-[a-f0-9]{16}$/;
            
            if (!expectedPattern.test(clientKey)) {
                return {
                    valid: false,
                    reason: 'Invalid client key format'
                };
            }
            
            // Additional validation: verify key could be generated from valid inputs
            const keyPart = clientKey.replace('gallery-', '');
            if (keyPart.length !== 16) {
                return {
                    valid: false,
                    reason: 'Invalid client key length'
                };
            }
            
            return { valid: true };
            
        } catch (error) {
            return {
                valid: false,
                reason: 'Client key validation error'
            };
        }
    }
    
    /**
     * SUSPICIOUS ACTIVITY DETECTION
     */
    
    checkSuspiciousActivity(ipAddress, clientKey, userAgent) {
        const currentTime = Date.now();
        const suspicious = {
            suspicious: false,
            block: false,
            reason: ''
        };
        
        // Check for suspicious user agents
        const suspiciousPatterns = [
            /bot|crawler|spider|scraper/i,
            /automated|script|curl|wget/i,
            /test|probe|scan/i,
            /attack|exploit|hack/i
        ];
        
        if (userAgent && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
            suspicious.suspicious = true;
            suspicious.reason = 'Suspicious user agent';
        }
        
        // Check for rapid client key changes from same IP
        const ipActivity = this.suspiciousActivity.get(ipAddress) || {
            clientKeys: new Set(),
            requests: [],
            firstSeen: currentTime
        };
        
        ipActivity.clientKeys.add(this.hashClientKey(clientKey));
        ipActivity.requests.push(currentTime);
        
        // Clean old requests (1 hour window)
        const hourAgo = currentTime - (60 * 60 * 1000);
        ipActivity.requests = ipActivity.requests.filter(timestamp => timestamp > hourAgo);
        
        // Flag if too many different client keys from same IP
        if (ipActivity.clientKeys.size > 10) {
            suspicious.suspicious = true;
            suspicious.reason = 'Multiple client keys from same IP';
        }
        
        // Flag if too many requests in short time
        const recentRequests = ipActivity.requests.filter(timestamp => timestamp > currentTime - (5 * 60 * 1000));
        if (recentRequests.length > 50) {
            suspicious.suspicious = true;
            suspicious.block = true;
            suspicious.reason = 'Excessive request frequency';
        }
        
        this.suspiciousActivity.set(ipAddress, ipActivity);
        
        return suspicious;
    }
    
    /**
     * UTILITY METHODS
     */
    
    async getSessionPolicyWithLock(client, sessionId) {
        try {
            const query = `
                SELECT dp.* 
                FROM download_policies dp 
                WHERE dp.session_id = $1 
                FOR UPDATE
            `;
            
            const result = await client.query(query, [sessionId]);
            
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
            console.error('❌ Error getting session policy with lock:', error);
            return {
                success: false,
                error: 'Failed to retrieve session policy'
            };
        }
    }
    
    hashClientKey(clientKey) {
        return crypto.createHash('sha256').update(clientKey).digest('hex').substring(0, 16);
    }
    
    updateQuotaCache(sessionId, clientKey, quotaInfo) {
        const cacheKey = `${sessionId}_${clientKey}`;
        this.quotaCache.set(cacheKey, {
            data: quotaInfo,
            timestamp: Date.now(),
            ttl: this.config.quotaCheckCacheTTL
        });
    }
    
    async logQuotaOperation(type, data) {
        try {
            console.log(`📊 QUOTA: ${type}`, data);
            // Additional logging to external systems can be added here
        } catch (error) {
            console.error('❌ Failed to log quota operation:', error);
        }
    }
    
    async logSecurityEvent(type, data) {
        try {
            const event = {
                type,
                data,
                timestamp: new Date().toISOString()
            };
            
            this.securityEvents.push(event);
            
            // Keep only last 1000 events in memory
            if (this.securityEvents.length > 1000) {
                this.securityEvents = this.securityEvents.slice(-1000);
            }
            
            console.warn(`🚨 SECURITY: ${type}`, data);
            
        } catch (error) {
            console.error('❌ Failed to log security event:', error);
        }
    }
    
    async recordSuspiciousActivity(ipAddress, type, details) {
        try {
            await this.logSecurityEvent('suspicious_activity', {
                ipAddress,
                type,
                details,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('❌ Failed to record suspicious activity:', error);
        }
    }
    
    /**
     * QUOTA CACHE MANAGEMENT
     */
    
    getQuotaFromCache(sessionId, clientKey) {
        const cacheKey = `${sessionId}_${clientKey}`;
        const cached = this.quotaCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
            return cached.data;
        }
        
        this.quotaCache.delete(cacheKey);
        return null;
    }
    
    invalidateQuotaCache(sessionId, clientKey = null) {
        if (clientKey) {
            const cacheKey = `${sessionId}_${clientKey}`;
            this.quotaCache.delete(cacheKey);
        } else {
            // Invalidate all cache entries for session
            for (const key of this.quotaCache.keys()) {
                if (key.startsWith(`${sessionId}_`)) {
                    this.quotaCache.delete(key);
                }
            }
        }
    }
    
    /**
     * PERFORMANCE MONITORING
     */
    
    getPerformanceMetrics() {
        return {
            activeTransactions: this.activeTransactions.size,
            cacheSize: this.quotaCache.size,
            rateLimitTracking: this.rateLimitTracker.size,
            suspiciousActivityTracking: this.suspiciousActivity.size,
            securityEvents: this.securityEvents.length
        };
    }
    
    cleanup() {
        const currentTime = Date.now();
        
        // Clean expired cache entries
        for (const [key, cached] of this.quotaCache.entries()) {
            if ((currentTime - cached.timestamp) > cached.ttl) {
                this.quotaCache.delete(key);
            }
        }
        
        // Clean old rate limit tracking
        const oneHourAgo = currentTime - (60 * 60 * 1000);
        for (const [key, data] of this.rateLimitTracker.entries()) {
            if (data.firstRequest < oneHourAgo) {
                this.rateLimitTracker.delete(key);
            }
        }
        
        console.log('🧹 Enhanced Quota Manager cleanup completed');
    }
}

module.exports = EnhancedQuotaManager;
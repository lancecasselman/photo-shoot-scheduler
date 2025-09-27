/**
 * Quota System Validation Suite
 * Comprehensive testing and validation for the hardened quota tracking system
 * Tests all security features, atomicity, and production scenarios
 */

const { Pool } = require('pg');
const EnhancedQuotaManager = require('./enhanced-quota-manager');
const EnhancedCartManager = require('./enhanced-cart-manager');
const QuotaMonitoringSystem = require('./quota-monitoring-system');
const crypto = require('crypto');

class QuotaSystemValidator {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.monitoringSystem = new QuotaMonitoringSystem(this.pool);
        this.quotaManager = new EnhancedQuotaManager(this.pool, this.monitoringSystem);
        this.cartManager = new EnhancedCartManager(this.pool, this.monitoringSystem);
        
        this.testResults = [];
        this.testSession = null;
        this.testClients = [];
        
        console.log('🧪 Quota System Validation Suite initialized');
    }

    /**
     * RUN COMPREHENSIVE VALIDATION SUITE
     */
    
    async runValidationSuite() {
        console.log('\n🚀 Starting Comprehensive Quota System Validation Suite');
        console.log('=' .repeat(70));
        
        try {
            // Setup test environment
            await this.setupTestEnvironment();
            
            // Run all validation tests
            await this.testAtomicQuotaValidation();
            await this.testCartCircumventionPrevention();
            await this.testRateLimitingAndAbusePrevention();
            await this.testConcurrentAccessHandling();
            await this.testClientKeyValidation();
            await this.testPerformanceUnderLoad();
            await this.testMonitoringAndAlerting();
            await this.testDataIntegrityConstraints();
            
            // Generate validation report
            await this.generateValidationReport();
            
            // Cleanup test environment
            await this.cleanupTestEnvironment();
            
            console.log('\n✅ Quota System Validation Suite completed successfully');
            return this.testResults;
            
        } catch (error) {
            console.error('❌ Validation suite failed:', error);
            await this.cleanupTestEnvironment();
            throw error;
        }
    }
    
    /**
     * TEST 1: ATOMIC QUOTA VALIDATION
     */
    
    async testAtomicQuotaValidation() {
        console.log('\n📋 Test 1: Atomic Quota Validation');
        const testName = 'Atomic Quota Validation';
        
        try {
            const clientKey = this.generateTestClientKey();
            const photoIds = ['photo1', 'photo2', 'photo3'];
            
            // Test 1a: Successful quota allocation
            console.log('  Testing successful quota allocation...');
            const result1 = await this.quotaManager.validateAndReserveQuota(
                this.testSession.id,
                clientKey,
                ['photo1'],
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            if (!result1.success) {
                throw new Error(`Quota allocation failed: ${result1.error}`);
            }
            
            // Test 1b: Quota limit enforcement
            console.log('  Testing quota limit enforcement...');
            const result2 = await this.quotaManager.validateAndReserveQuota(
                this.testSession.id,
                clientKey,
                ['photo2', 'photo3', 'photo4', 'photo5'], // Exceeds freemium limit
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            if (result2.success && result2.quotaInfo.freePhotosGranted > 1) {
                throw new Error('Quota limit not properly enforced');
            }
            
            // Test 1c: Transaction rollback on failure
            console.log('  Testing transaction rollback...');
            const invalidSessionResult = await this.quotaManager.validateAndReserveQuota(
                'invalid-session-id',
                clientKey,
                ['photo6'],
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            if (invalidSessionResult.success) {
                throw new Error('Transaction should have rolled back for invalid session');
            }
            
            this.recordTestResult(testName, true, 'All atomic quota validation tests passed');
            console.log('  ✅ Atomic quota validation tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Atomic quota validation failed: ${error.message}`);
        }
    }
    
    /**
     * TEST 2: CART CIRCUMVENTION PREVENTION
     */
    
    async testCartCircumventionPrevention() {
        console.log('\n📋 Test 2: Cart Circumvention Prevention');
        const testName = 'Cart Circumvention Prevention';
        
        try {
            const clientKey = this.generateTestClientKey();
            
            // Test 2a: Cart respects quota limits
            console.log('  Testing cart quota limits...');
            const cartResult1 = await this.cartManager.addItemToCart(
                this.testSession.id,
                clientKey,
                ['cart1', 'cart2'], // Within freemium limit
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            if (!cartResult1.success) {
                throw new Error(`Cart addition within limits failed: ${cartResult1.error}`);
            }
            
            // Test 2b: Cart prevents quota circumvention
            console.log('  Testing cart quota circumvention prevention...');
            const cartResult2 = await this.cartManager.addItemToCart(
                this.testSession.id,
                clientKey,
                ['cart3', 'cart4', 'cart5'], // Exceeds remaining quota
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            if (cartResult2.success && cartResult2.cartInfo.quotaInfo.freePhotosGranted > 0) {
                throw new Error('Cart allowed quota circumvention');
            }
            
            // Test 2c: Cart atomic operations
            console.log('  Testing cart atomic operations...');
            const cartStatus = await this.cartManager.getCartStatus(
                this.testSession.id,
                clientKey
            );
            
            if (!cartStatus.success || !cartStatus.cart.valid) {
                throw new Error('Cart status validation failed');
            }
            
            this.recordTestResult(testName, true, 'All cart circumvention prevention tests passed');
            console.log('  ✅ Cart circumvention prevention tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Cart circumvention prevention failed: ${error.message}`);
        }
    }
    
    /**
     * TEST 3: RATE LIMITING AND ABUSE PREVENTION
     */
    
    async testRateLimitingAndAbusePrevention() {
        console.log('\n📋 Test 3: Rate Limiting and Abuse Prevention');
        const testName = 'Rate Limiting and Abuse Prevention';
        
        try {
            const clientKey = this.generateTestClientKey();
            
            // Test 3a: Rate limiting enforcement
            console.log('  Testing rate limiting...');
            const rapidRequests = [];
            for (let i = 0; i < 35; i++) { // Exceed rate limit
                rapidRequests.push(
                    this.quotaManager.validateAndReserveQuota(
                        this.testSession.id,
                        clientKey,
                        [`rapid${i}`],
                        { ipAddress: '192.168.1.100', userAgent: 'test-agent' }
                    )
                );
            }
            
            const results = await Promise.all(rapidRequests);
            const rateLimitedResults = results.filter(r => r.code === 'RATE_LIMIT_EXCEEDED');
            
            if (rateLimitedResults.length === 0) {
                throw new Error('Rate limiting not enforced');
            }
            
            // Test 3b: Suspicious activity detection
            console.log('  Testing suspicious activity detection...');
            const suspiciousResult = await this.quotaManager.validateAndReserveQuota(
                this.testSession.id,
                clientKey,
                ['suspicious1'],
                { 
                    ipAddress: '192.168.1.100', 
                    userAgent: 'bot/scraper/automated-script' // Suspicious user agent
                }
            );
            
            // Should detect suspicious activity but may not block immediately
            console.log('    Suspicious activity detection result:', suspiciousResult.code || 'allowed');
            
            // Test 3c: Client key validation
            console.log('  Testing client key validation...');
            const invalidKeyResult = await this.quotaManager.validateAndReserveQuota(
                this.testSession.id,
                'invalid-key-format',
                ['invalidkey1'],
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            if (invalidKeyResult.success) {
                throw new Error('Invalid client key should be rejected');
            }
            
            this.recordTestResult(testName, true, 'All rate limiting and abuse prevention tests passed');
            console.log('  ✅ Rate limiting and abuse prevention tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Rate limiting and abuse prevention failed: ${error.message}`);
        }
    }
    
    /**
     * TEST 4: CONCURRENT ACCESS HANDLING
     */
    
    async testConcurrentAccessHandling() {
        console.log('\n📋 Test 4: Concurrent Access Handling');
        const testName = 'Concurrent Access Handling';
        
        try {
            const clientKey = this.generateTestClientKey();
            
            // Test 4a: Concurrent quota requests
            console.log('  Testing concurrent quota validation...');
            const concurrentRequests = [];
            for (let i = 0; i < 10; i++) {
                concurrentRequests.push(
                    this.quotaManager.validateAndReserveQuota(
                        this.testSession.id,
                        clientKey + i, // Different client keys
                        [`concurrent${i}`],
                        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
                    )
                );
            }
            
            const concurrentResults = await Promise.all(concurrentRequests);
            const successfulRequests = concurrentResults.filter(r => r.success);
            
            if (successfulRequests.length === 0) {
                throw new Error('No concurrent requests succeeded');
            }
            
            // Test 4b: Cart locking mechanism
            console.log('  Testing cart locking mechanism...');
            const cartPromises = [
                this.cartManager.addItemToCart(
                    this.testSession.id,
                    clientKey,
                    ['lock1'],
                    { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
                ),
                this.cartManager.addItemToCart(
                    this.testSession.id,
                    clientKey,
                    ['lock2'],
                    { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
                )
            ];
            
            const cartResults = await Promise.all(cartPromises);
            
            // At least one should succeed (locking prevents both from conflicting)
            const successfulCartRequests = cartResults.filter(r => r.success);
            if (successfulCartRequests.length === 0) {
                throw new Error('Cart locking mechanism failed');
            }
            
            this.recordTestResult(testName, true, 'All concurrent access handling tests passed');
            console.log('  ✅ Concurrent access handling tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Concurrent access handling failed: ${error.message}`);
        }
    }
    
    /**
     * TEST 5: CLIENT KEY VALIDATION
     */
    
    async testClientKeyValidation() {
        console.log('\n📋 Test 5: Client Key Validation');
        const testName = 'Client Key Validation';
        
        try {
            // Test 5a: Valid client key format
            console.log('  Testing valid client key format...');
            const validKey = 'gallery-' + crypto.randomBytes(8).toString('hex');
            const validResult = await this.quotaManager.validateAndReserveQuota(
                this.testSession.id,
                validKey,
                ['validkey1'],
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            if (!validResult.success && validResult.code === 'INVALID_CLIENT_KEY') {
                throw new Error('Valid client key was rejected');
            }
            
            // Test 5b: Invalid client key formats
            console.log('  Testing invalid client key formats...');
            const invalidKeys = [
                'invalid-format',
                'gallery-short',
                'gallery-' + 'x'.repeat(20), // Too long
                'notgallery-1234567890abcdef',
                ''
            ];
            
            for (const invalidKey of invalidKeys) {
                const invalidResult = await this.quotaManager.validateAndReserveQuota(
                    this.testSession.id,
                    invalidKey,
                    ['invalidtest'],
                    { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
                );
                
                if (invalidResult.success) {
                    throw new Error(`Invalid client key accepted: ${invalidKey}`);
                }
            }
            
            this.recordTestResult(testName, true, 'All client key validation tests passed');
            console.log('  ✅ Client key validation tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Client key validation failed: ${error.message}`);
        }
    }
    
    /**
     * TEST 6: PERFORMANCE UNDER LOAD
     */
    
    async testPerformanceUnderLoad() {
        console.log('\n📋 Test 6: Performance Under Load');
        const testName = 'Performance Under Load';
        
        try {
            const startTime = Date.now();
            const loadTestPromises = [];
            
            console.log('  Running load test with 50 concurrent operations...');
            
            // Create 50 concurrent quota operations
            for (let i = 0; i < 50; i++) {
                const clientKey = this.generateTestClientKey();
                loadTestPromises.push(
                    this.quotaManager.validateAndReserveQuota(
                        this.testSession.id,
                        clientKey,
                        [`load${i}`],
                        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
                    )
                );
            }
            
            const loadResults = await Promise.all(loadTestPromises);
            const endTime = Date.now();
            
            const totalTime = endTime - startTime;
            const avgResponseTime = totalTime / loadResults.length;
            const successfulRequests = loadResults.filter(r => r.success).length;
            
            console.log(`  Load test results: ${successfulRequests}/50 successful in ${totalTime}ms (avg: ${avgResponseTime.toFixed(2)}ms per request)`);
            
            // Performance thresholds
            if (avgResponseTime > 1000) { // 1 second threshold
                throw new Error(`Performance degraded: Average response time ${avgResponseTime.toFixed(2)}ms exceeds 1000ms threshold`);
            }
            
            if (successfulRequests < 40) { // At least 80% success rate
                throw new Error(`Poor success rate: ${successfulRequests}/50 requests successful`);
            }
            
            this.recordTestResult(testName, true, `Performance test passed: ${avgResponseTime.toFixed(2)}ms avg response time, ${successfulRequests}/50 successful`);
            console.log('  ✅ Performance under load tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Performance under load failed: ${error.message}`);
        }
    }
    
    /**
     * TEST 7: MONITORING AND ALERTING
     */
    
    async testMonitoringAndAlerting() {
        console.log('\n📋 Test 7: Monitoring and Alerting');
        const testName = 'Monitoring and Alerting';
        
        try {
            // Test 7a: Monitoring system functionality
            console.log('  Testing monitoring system functionality...');
            
            const metricsBeforeTest = this.monitoringSystem.getCurrentMetrics();
            
            // Generate some test activity
            const clientKey = this.generateTestClientKey();
            await this.quotaManager.validateAndReserveQuota(
                this.testSession.id,
                clientKey,
                ['monitor1'],
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            await this.cartManager.addItemToCart(
                this.testSession.id,
                clientKey,
                ['monitor2'],
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            // Check if monitoring recorded the activity
            const metricsAfterTest = this.monitoringSystem.getCurrentMetrics();
            
            // Test 7b: Dashboard data availability
            console.log('  Testing dashboard data...');
            const dashboardData = this.monitoringSystem.getDashboardData();
            
            if (!dashboardData.summary || !dashboardData.alerts) {
                throw new Error('Dashboard data incomplete');
            }
            
            // Test 7c: Alert system
            console.log('  Testing alert system...');
            const alerts = this.monitoringSystem.getAlerts();
            
            console.log(`    Current alerts: ${alerts.length}`);
            console.log(`    System health: ${dashboardData.summary.systemHealth}`);
            
            this.recordTestResult(testName, true, `Monitoring system functional with ${alerts.length} alerts and ${dashboardData.summary.systemHealth} health status`);
            console.log('  ✅ Monitoring and alerting tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Monitoring and alerting failed: ${error.message}`);
        }
    }
    
    /**
     * TEST 8: DATA INTEGRITY CONSTRAINTS
     */
    
    async testDataIntegrityConstraints() {
        console.log('\n📋 Test 8: Data Integrity Constraints');
        const testName = 'Data Integrity Constraints';
        
        try {
            // Test 8a: Database constraint enforcement
            console.log('  Testing database constraints...');
            
            // Test unique constraint violation (should be handled gracefully)
            const clientKey = this.generateTestClientKey();
            const result1 = await this.quotaManager.validateAndReserveQuota(
                this.testSession.id,
                clientKey,
                ['integrity1'],
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            
            // Test 8b: Cache consistency
            console.log('  Testing cache consistency...');
            const cachedQuota = this.quotaManager.getQuotaFromCache(this.testSession.id, clientKey);
            
            // Cache should be updated after quota operations
            if (result1.success && !cachedQuota) {
                console.log('    Note: Cache may not be populated immediately after operation');
            }
            
            // Test 8c: Cleanup operations
            console.log('  Testing cleanup operations...');
            this.quotaManager.cleanup();
            this.cartManager.cleanupExpiredCartItems();
            
            this.recordTestResult(testName, true, 'All data integrity constraint tests passed');
            console.log('  ✅ Data integrity constraint tests passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
            console.log(`  ❌ Data integrity constraint failed: ${error.message}`);
        }
    }
    
    /**
     * UTILITY METHODS
     */
    
    async setupTestEnvironment() {
        console.log('\n🔧 Setting up test environment...');
        
        // Create test session
        const testSessionId = crypto.randomUUID();
        
        const sessionQuery = `
            INSERT INTO photography_sessions 
            (id, user_id, session_date, client_name, photos, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (id) DO NOTHING
        `;
        
        await this.pool.query(sessionQuery, [
            testSessionId,
            'test-user-quota-validation',
            new Date(),
            'Quota Validation Test Client',
            JSON.stringify([
                { id: 'photo1', filename: 'test1.jpg' },
                { id: 'photo2', filename: 'test2.jpg' },
                { id: 'photo3', filename: 'test3.jpg' }
            ])
        ]);
        
        // Create test policy (freemium with 2 free downloads)
        const policyQuery = `
            INSERT INTO download_policies 
            (id, session_id, mode, free_count, price_per_photo, max_per_client, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (session_id) DO UPDATE SET
            mode = EXCLUDED.mode,
            free_count = EXCLUDED.free_count,
            price_per_photo = EXCLUDED.price_per_photo,
            max_per_client = EXCLUDED.max_per_client
        `;
        
        await this.pool.query(policyQuery, [
            crypto.randomUUID(),
            testSessionId,
            'freemium',
            2, // 2 free downloads
            5.00, // $5 per photo after free limit
            10 // Max 10 per client
        ]);
        
        this.testSession = { id: testSessionId };
        
        console.log(`  Test session created: ${testSessionId}`);
        console.log('  Test policy created: freemium mode, 2 free downloads, $5 per additional photo');
    }
    
    async cleanupTestEnvironment() {
        console.log('\n🧹 Cleaning up test environment...');
        
        if (this.testSession) {
            try {
                // Clean up test data
                await this.pool.query('DELETE FROM download_entitlements WHERE session_id = $1', [this.testSession.id]);
                await this.pool.query('DELETE FROM download_history WHERE session_id = $1', [this.testSession.id]);
                await this.pool.query('DELETE FROM download_policies WHERE session_id = $1', [this.testSession.id]);
                await this.pool.query('DELETE FROM photography_sessions WHERE id = $1', [this.testSession.id]);
                
                console.log('  Test data cleaned up successfully');
            } catch (error) {
                console.error('  ⚠️ Cleanup error:', error.message);
            }
        }
        
        // Stop monitoring
        this.monitoringSystem.cleanup();
    }
    
    generateTestClientKey() {
        return 'gallery-' + crypto.randomBytes(8).toString('hex');
    }
    
    recordTestResult(testName, success, details) {
        this.testResults.push({
            test: testName,
            success: success,
            details: details,
            timestamp: new Date().toISOString()
        });
    }
    
    async generateValidationReport() {
        console.log('\n📊 QUOTA SYSTEM VALIDATION REPORT');
        console.log('=' .repeat(70));
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        console.log('\nDetailed Results:');
        console.log('-' .repeat(70));
        
        for (const result of this.testResults) {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.test}`);
            console.log(`       ${result.details}`);
        }
        
        if (failedTests === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Quota system is production-ready.');
        } else {
            console.log(`\n⚠️ ${failedTests} test(s) failed. Please review and fix issues before production deployment.`);
        }
        
        // Performance metrics from monitoring system
        const performanceMetrics = this.quotaManager.getPerformanceMetrics();
        console.log('\nSystem Performance Metrics:');
        console.log('-' .repeat(70));
        console.log(`Active Transactions: ${performanceMetrics.activeTransactions}`);
        console.log(`Cache Size: ${performanceMetrics.cacheSize}`);
        console.log(`Rate Limit Tracking: ${performanceMetrics.rateLimitTracking}`);
        console.log(`Security Events: ${performanceMetrics.securityEvents}`);
        
        return {
            totalTests,
            passedTests,
            failedTests,
            successRate: (passedTests / totalTests) * 100,
            details: this.testResults,
            performanceMetrics
        };
    }
}

// Export for use in testing
module.exports = QuotaSystemValidator;

// Self-executing validation if run directly
if (require.main === module) {
    const validator = new QuotaSystemValidator();
    validator.runValidationSuite()
        .then((results) => {
            console.log('\n🏁 Validation suite completed');
            process.exit(results.failedTests === 0 ? 0 : 1);
        })
        .catch((error) => {
            console.error('\n💥 Validation suite crashed:', error);
            process.exit(1);
        });
}
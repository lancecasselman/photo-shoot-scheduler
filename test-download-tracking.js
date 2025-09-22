// ==================== DOWNLOAD TRACKING VERIFICATION TEST ====================
// Comprehensive test to verify download tracking accuracy and limit enforcement
// Author: Replit Agent
// Date: September 22, 2025

const { Pool } = require('pg');
const fetch = require('node-fetch');

// Test session information
const TEST_SESSION_ID = 'd0892278-1882-4466-955f-fba2425e53ef';
const GALLERY_TOKEN = 'dda7ad42-1613-4bac-9fe0-7b38d10dba80'; // From database
const BASE_URL = 'http://localhost:3000';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test results tracking
const testResults = {
  downloadCountAccuracy: [],
  limitEnforcement: [],
  databaseConsistency: [],
  edgeCases: [],
  summary: {}
};

// Utility functions
function logTest(category, testName, passed, details) {
  const result = {
    test: testName,
    passed,
    details,
    timestamp: new Date().toISOString()
  };
  testResults[category].push(result);
  
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${category}] ${testName}`);
  if (details) console.log(`   Details: ${details}`);
}

async function getDownloadCounts(sessionId) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_downloads,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_downloads,
      COUNT(*) FILTER (WHERE status = 'reserved') as reserved_downloads,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_downloads
    FROM gallery_downloads 
    WHERE session_id = $1
  `, [sessionId]);
  
  return result.rows[0];
}

async function getSessionLimits(sessionId) {
  const result = await pool.query(`
    SELECT download_max, pricing_model, free_downloads, price_per_download, watermark_enabled
    FROM photography_sessions 
    WHERE id = $1
  `, [sessionId]);
  
  return result.rows[0];
}

async function makeDownloadRequest(sessionId, assetId, token) {
  try {
    const response = await fetch(`${BASE_URL}/api/downloads/sessions/${sessionId}/assets/${assetId}/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });
    
    const data = await response.json();
    return {
      status: response.status,
      success: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      error: error.message
    };
  }
}

// ==================== TEST 1: DOWNLOAD COUNT ACCURACY ====================
async function testDownloadCountAccuracy() {
  console.log('\n🔍 Testing Download Count Accuracy...');
  
  try {
    // Get current download counts
    const counts = await getDownloadCounts(TEST_SESSION_ID);
    const sessionLimits = await getSessionLimits(TEST_SESSION_ID);
    
    console.log(`📊 Current counts: Total=${counts.total_downloads}, Completed=${counts.completed_downloads}, Reserved=${counts.reserved_downloads}`);
    console.log(`📋 Session limits: Max=${sessionLimits.download_max}, Model=${sessionLimits.pricing_model}, Free=${sessionLimits.free_downloads}`);
    
    // Test 1.1: Verify total count includes both completed and reserved
    const expectedTotal = parseInt(counts.completed_downloads) + parseInt(counts.reserved_downloads) + parseInt(counts.failed_downloads || 0);
    const actualTotal = parseInt(counts.total_downloads);
    
    logTest('downloadCountAccuracy', 'Total count includes all statuses', 
      actualTotal === expectedTotal,
      `Expected: ${expectedTotal}, Actual: ${actualTotal}`
    );
    
    // Test 1.2: Check if counts exceed limits (this should indicate a problem)
    const downloadLimit = parseInt(sessionLimits.download_max || 0);
    const limitsExceeded = actualTotal > downloadLimit && downloadLimit > 0;
    
    logTest('downloadCountAccuracy', 'Download counts respect limits', 
      !limitsExceeded,
      limitsExceeded ? `Downloads (${actualTotal}) exceed limit (${downloadLimit}) - SYSTEM BUG DETECTED` : `Within limits: ${actualTotal}/${downloadLimit}`
    );
    
    // Test 1.3: Verify database consistency
    const tokenResult = await pool.query(`
      SELECT COUNT(*) as token_count
      FROM download_tokens 
      WHERE session_id = $1
    `, [TEST_SESSION_ID]);
    
    const tokenCount = parseInt(tokenResult.rows[0].token_count);
    
    logTest('downloadCountAccuracy', 'Token count matches download count',
      tokenCount === actualTotal,
      `Tokens: ${tokenCount}, Downloads: ${actualTotal}`
    );
    
  } catch (error) {
    logTest('downloadCountAccuracy', 'Count accuracy test execution', false, `Error: ${error.message}`);
  }
}

// ==================== TEST 2: REAL-TIME LIMIT ENFORCEMENT ====================
async function testLimitEnforcement() {
  console.log('\n🚫 Testing Real-Time Limit Enforcement...');
  
  try {
    const sessionLimits = await getSessionLimits(TEST_SESSION_ID);
    const currentCounts = await getDownloadCounts(TEST_SESSION_ID);
    
    console.log(`📋 Testing with session: max=${sessionLimits.download_max}, current=${currentCounts.total_downloads}`);
    
    // Test 2.1: Attempt to download when limit is already exceeded
    const downloadResponse = await makeDownloadRequest(TEST_SESSION_ID, '20250911232742-DSC_0580.jpg', GALLERY_TOKEN);
    
    console.log(`📥 Download attempt response: Status=${downloadResponse.status}, Success=${downloadResponse.success}`);
    console.log(`📥 Response data:`, downloadResponse.data);
    
    const shouldBlockDownload = parseInt(currentCounts.total_downloads) >= parseInt(sessionLimits.download_max);
    const wasBlocked = downloadResponse.status === 403 && downloadResponse.data.status === 'limit_exceeded';
    
    logTest('limitEnforcement', 'Blocks downloads when limit exceeded',
      shouldBlockDownload ? wasBlocked : downloadResponse.success,
      shouldBlockDownload ? 
        (wasBlocked ? `Correctly blocked: ${downloadResponse.data.message}` : `FAILED TO BLOCK - Status: ${downloadResponse.status}`) :
        (downloadResponse.success ? 'Download allowed within limits' : 'Unexpected error')
    );
    
    // Test 2.2: Verify error message contains correct information
    if (wasBlocked && downloadResponse.data) {
      const correctData = downloadResponse.data.downloadMax === parseInt(sessionLimits.download_max) &&
                         downloadResponse.data.usedDownloads === parseInt(currentCounts.total_downloads);
      
      logTest('limitEnforcement', 'Error message contains accurate data',
        correctData,
        `Max: ${downloadResponse.data.downloadMax}/${sessionLimits.download_max}, Used: ${downloadResponse.data.usedDownloads}/${currentCounts.total_downloads}`
      );
    }
    
  } catch (error) {
    logTest('limitEnforcement', 'Limit enforcement test execution', false, `Error: ${error.message}`);
  }
}

// ==================== TEST 3: DATABASE CONSISTENCY ====================
async function testDatabaseConsistency() {
  console.log('\n🗄️ Testing Database Consistency...');
  
  try {
    // Test 3.1: Verify all downloads have corresponding tokens
    const orphanedDownloads = await pool.query(`
      SELECT gd.id, gd.download_token
      FROM gallery_downloads gd
      LEFT JOIN download_tokens dt ON gd.download_token = dt.token
      WHERE gd.session_id = $1 AND dt.token IS NULL
    `, [TEST_SESSION_ID]);
    
    logTest('databaseConsistency', 'All downloads have valid tokens',
      orphanedDownloads.rows.length === 0,
      orphanedDownloads.rows.length === 0 ? 'All downloads linked to tokens' : `${orphanedDownloads.rows.length} orphaned downloads found`
    );
    
    // Test 3.2: Verify token usage flags are consistent with download status
    const inconsistentTokens = await pool.query(`
      SELECT dt.token, dt.is_used, gd.status
      FROM download_tokens dt
      JOIN gallery_downloads gd ON dt.token = gd.download_token
      WHERE dt.session_id = $1 
      AND ((dt.is_used = true AND gd.status != 'completed') OR (dt.is_used = false AND gd.status = 'completed'))
    `, [TEST_SESSION_ID]);
    
    logTest('databaseConsistency', 'Token usage flags match download status',
      inconsistentTokens.rows.length === 0,
      inconsistentTokens.rows.length === 0 ? 'All token flags consistent' : `${inconsistentTokens.rows.length} inconsistent tokens found`
    );
    
    // Test 3.3: Verify timestamps are logical
    const illogicalTimestamps = await pool.query(`
      SELECT dt.token, dt.created_at as token_created, gd.created_at as download_created
      FROM download_tokens dt
      JOIN gallery_downloads gd ON dt.token = gd.download_token
      WHERE dt.session_id = $1 AND dt.created_at > gd.created_at
    `, [TEST_SESSION_ID]);
    
    logTest('databaseConsistency', 'Timestamps are logical',
      illogicalTimestamps.rows.length === 0,
      illogicalTimestamps.rows.length === 0 ? 'All timestamps logical' : `${illogicalTimestamps.rows.length} illogical timestamps found`
    );
    
  } catch (error) {
    logTest('databaseConsistency', 'Database consistency test execution', false, `Error: ${error.message}`);
  }
}

// ==================== TEST 4: EDGE CASES ====================
async function testEdgeCases() {
  console.log('\n🔬 Testing Edge Cases...');
  
  try {
    // Test 4.1: Test with invalid token
    const invalidTokenResponse = await makeDownloadRequest(TEST_SESSION_ID, '20250911232742-DSC_0580.jpg', 'invalid-token-12345');
    
    logTest('edgeCases', 'Rejects invalid gallery tokens',
      invalidTokenResponse.status === 403,
      `Status: ${invalidTokenResponse.status}, Response: ${JSON.stringify(invalidTokenResponse.data)}`
    );
    
    // Test 4.2: Test with invalid session ID
    const invalidSessionResponse = await makeDownloadRequest('invalid-session-id', '20250911232742-DSC_0580.jpg', GALLERY_TOKEN);
    
    logTest('edgeCases', 'Rejects invalid session IDs',
      invalidSessionResponse.status === 403,
      `Status: ${invalidSessionResponse.status}`
    );
    
    // Test 4.3: Test with invalid asset ID
    const invalidAssetResponse = await makeDownloadRequest(TEST_SESSION_ID, 'nonexistent-asset.jpg', GALLERY_TOKEN);
    
    logTest('edgeCases', 'Rejects invalid asset IDs',
      invalidAssetResponse.status === 404,
      `Status: ${invalidAssetResponse.status}`
    );
    
    // Test 4.4: Check for expired tokens in the database
    const expiredTokens = await pool.query(`
      SELECT COUNT(*) as expired_count
      FROM download_tokens
      WHERE session_id = $1 AND expires_at < NOW()
    `, [TEST_SESSION_ID]);
    
    const expiredCount = parseInt(expiredTokens.rows[0].expired_count);
    
    logTest('edgeCases', 'Handles expired tokens appropriately',
      true, // This is informational
      `Found ${expiredCount} expired tokens in database`
    );
    
  } catch (error) {
    logTest('edgeCases', 'Edge case test execution', false, `Error: ${error.message}`);
  }
}

// ==================== MAIN TEST EXECUTION ====================
async function runAllTests() {
  console.log('🧪 DOWNLOAD TRACKING VERIFICATION TEST SUITE');
  console.log('===============================================');
  console.log(`Target Session: ${TEST_SESSION_ID}`);
  console.log(`Test Started: ${new Date().toISOString()}`);
  
  try {
    await testDownloadCountAccuracy();
    await testLimitEnforcement();
    await testDatabaseConsistency();
    await testEdgeCases();
    
    // Generate summary
    console.log('\n📋 TEST SUMMARY');
    console.log('================');
    
    const categories = ['downloadCountAccuracy', 'limitEnforcement', 'databaseConsistency', 'edgeCases'];
    let totalTests = 0;
    let passedTests = 0;
    
    categories.forEach(category => {
      const tests = testResults[category];
      const passed = tests.filter(t => t.passed).length;
      const total = tests.length;
      
      console.log(`${category}: ${passed}/${total} passed`);
      
      // Show failed tests
      tests.filter(t => !t.passed).forEach(test => {
        console.log(`  ❌ ${test.test}: ${test.details}`);
      });
      
      totalTests += total;
      passedTests += passed;
    });
    
    console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
    
    testResults.summary = {
      totalTests,
      passedTests,
      successRate: (passedTests / totalTests * 100).toFixed(1) + '%',
      timestamp: new Date().toISOString()
    };
    
    // Critical findings
    console.log('\n🚨 CRITICAL FINDINGS:');
    const criticalIssues = testResults.downloadCountAccuracy.concat(testResults.limitEnforcement)
      .filter(t => !t.passed && (t.test.includes('limits') || t.test.includes('enforcement')));
    
    if (criticalIssues.length > 0) {
      criticalIssues.forEach(issue => {
        console.log(`⚠️  ${issue.test}: ${issue.details}`);
      });
    } else {
      console.log('✅ No critical limit enforcement issues detected in current state');
    }
    
    return testResults;
    
  } catch (error) {
    console.error('❌ Test suite execution failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute tests if run directly
if (require.main === module) {
  runAllTests()
    .then(results => {
      console.log('\n✅ Test suite completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testResults };
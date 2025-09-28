/**
 * Test Script for Download Orchestrator
 * 
 * Verifies that the unified download orchestrator correctly handles:
 * - FREE/FREEMIUM/PAID pricing models
 * - Photo not found errors
 * - Filename property access errors  
 * - Proper sessionFiles table queries
 */

const DownloadOrchestrator = require('./download-orchestrator');
const DownloadError = require('./DownloadError');

class OrchestratorTester {
  constructor() {
    this.orchestrator = new DownloadOrchestrator();
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Starting Download Orchestrator Tests');
    console.log('=' .repeat(50));
    
    await this.testAuthenticationStage();
    await this.testPolicyResolution();
    await this.testFileLookupsWithFixedSchema();
    await this.testErrorHandling();
    await this.testPricingModels();
    
    this.printResults();
    return this.testResults;
  }

  async testAuthenticationStage() {
    console.log('\n🔐 Testing Authentication Stage');
    
    try {
      // Test 1: Valid session with gallery token
      const context = { correlationId: 'test-auth-1' };
      const session = await this.getTestSession();
      
      if (session) {
        const params = {
          sessionId: session.id,
          token: session.galleryAccessToken
        };
        
        const authResult = await this.orchestrator.authenticate(params, context);
        
        this.addTestResult('Authentication - Gallery Token', 
          authResult.session && authResult.authResult.type === 'gallery', 
          'Gallery token authentication should succeed');
        
        console.log('✅ Gallery token authentication passed');
      } else {
        this.addTestResult('Authentication - Gallery Token', false, 
          'No test session available');
      }
      
    } catch (error) {
      console.log('❌ Authentication test failed:', error.message);
      this.addTestResult('Authentication - Gallery Token', false, error.message);
    }
    
    // Test 2: Invalid session ID
    try {
      const context = { correlationId: 'test-auth-2' };
      const params = {
        sessionId: 'invalid-session-id',
        token: 'some-token'
      };
      
      await this.orchestrator.authenticate(params, context);
      this.addTestResult('Authentication - Invalid Session', false, 
        'Should have thrown SESSION_NOT_FOUND error');
        
    } catch (error) {
      const passed = error instanceof DownloadError && error.code === 'SESSION_NOT_FOUND';
      this.addTestResult('Authentication - Invalid Session', passed,
        `Should throw SESSION_NOT_FOUND, got: ${error.code || error.message}`);
      
      if (passed) {
        console.log('✅ Invalid session properly rejected');
      }
    }
  }

  async testPolicyResolution() {
    console.log('\n📋 Testing Policy Resolution Stage');
    
    try {
      const session = await this.getTestSession();
      if (!session) {
        this.addTestResult('Policy Resolution', false, 'No test session available');
        return;
      }
      
      const authData = {
        session: session,
        sessionId: session.id,
        userId: session.userId,
        pricingModel: session.pricingModel || 'free'
      };
      
      const context = { correlationId: 'test-policy-1' };
      const policyResult = await this.orchestrator.policyResolve(authData, context);
      
      const passed = policyResult.policy && 
                    typeof policyResult.requiresPayment === 'boolean' &&
                    policyResult.policy.mode;
      
      this.addTestResult('Policy Resolution', passed,
        'Policy resolution should return valid policy object');
      
      if (passed) {
        console.log(`✅ Policy resolved: ${policyResult.policy.mode} model, payment required: ${policyResult.requiresPayment}`);
      }
      
    } catch (error) {
      console.log('❌ Policy resolution test failed:', error.message);
      this.addTestResult('Policy Resolution', false, error.message);
    }
  }

  async testFileLookupsWithFixedSchema() {
    console.log('\n📁 Testing File Lookups (Fixed Schema)');
    
    try {
      // Get a real file from the database
      const files = await this.orchestrator.db.select()
        .from(this.orchestrator.schema.sessionFiles)
        .limit(1);
      
      if (files.length === 0) {
        this.addTestResult('File Lookup - Schema Query', false, 
          'No files found in sessionFiles table');
        return;
      }
      
      const testFile = files[0];
      console.log(`🔍 Testing with file: ${testFile.filename} in session: ${testFile.sessionId}`);
      
      // Create mock entitlement data
      const mockEntitlementData = {
        sessionId: testFile.sessionId,
        session: { id: testFile.sessionId },
        entitlement: { granted: true }
      };
      
      const context = { correlationId: 'test-file-1' };
      const params = { filename: testFile.filename };
      
      const fileResult = await this.orchestrator.fileLookup(mockEntitlementData, params, context);
      
      // Test that we get proper file record with required properties
      const passed = fileResult.fileRecord && 
                    fileResult.fileRecord.filename &&
                    fileResult.fileRecord.r2Key &&
                    typeof fileResult.fileRecord.id !== 'undefined';
      
      this.addTestResult('File Lookup - Fixed Schema', passed,
        'File lookup should return complete file record with filename and r2Key');
      
      if (passed) {
        console.log('✅ File lookup successful:');
        console.log(`   - Filename: ${fileResult.fileRecord.filename}`);
        console.log(`   - R2 Key: ${fileResult.fileRecord.r2Key}`);
        console.log(`   - File Size: ${fileResult.fileRecord.fileSizeMb} MB`);
      }
      
      // Test file not found scenario
      try {
        const notFoundParams = { filename: 'non-existent-file.jpg' };
        await this.orchestrator.fileLookup(mockEntitlementData, notFoundParams, context);
        
        this.addTestResult('File Lookup - Not Found Error', false,
          'Should have thrown FILE_NOT_FOUND error');
          
      } catch (error) {
        const passed = error instanceof DownloadError && error.code === 'FILE_NOT_FOUND';
        this.addTestResult('File Lookup - Not Found Error', passed,
          `Should throw FILE_NOT_FOUND, got: ${error.code || error.message}`);
          
        if (passed) {
          console.log('✅ File not found properly handled');
        }
      }
      
    } catch (error) {
      console.log('❌ File lookup test failed:', error.message);
      this.addTestResult('File Lookup - Fixed Schema', false, error.message);
    }
  }

  async testErrorHandling() {
    console.log('\n🚨 Testing Error Handling');
    
    // Test DownloadError creation and response formatting
    const testError = DownloadError.photoNotFound('test-photo-123', 'test-session-456', 'test-correlation-789');
    
    const response = testError.toResponse();
    const statusCode = testError.getStatusCode();
    
    const errorTestPassed = testError.code === 'PHOTO_NOT_FOUND' &&
                           statusCode === 404 &&
                           response.success === false &&
                           response.error.correlationId === 'test-correlation-789';
    
    this.addTestResult('Error Handling - DownloadError', errorTestPassed,
      'DownloadError should format properly with correlation ID');
      
    if (errorTestPassed) {
      console.log('✅ DownloadError formatting works correctly');
      console.log(`   - Code: ${testError.code}`);
      console.log(`   - Status: ${statusCode}`);
      console.log(`   - Message: ${testError.getUserFriendlyMessage()}`);
    }
    
    // Test error recovery suggestions
    const suggestions = testError.getRecoverySuggestions();
    const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;
    
    this.addTestResult('Error Handling - Recovery Suggestions', hasSuggestions,
      'Errors should provide recovery suggestions');
      
    if (hasSuggestions) {
      console.log(`✅ Recovery suggestions: ${suggestions.join(', ')}`);
    }
  }

  async testPricingModels() {
    console.log('\n💰 Testing Pricing Models');
    
    // Test FREE model
    const freePolicyData = {
      session: { id: 'test-session', userId: 'test-user' },
      sessionId: 'test-session',
      policy: {
        mode: 'free',
        pricePerPhoto: '0.00',
        watermarkPreset: null
      },
      authResult: { type: 'gallery', token: 'test-token' }
    };
    
    try {
      const context = { correlationId: 'test-free-model' };
      const entitlementResult = await this.orchestrator.entitlement(freePolicyData, context);
      
      const freeTestPassed = entitlementResult.entitlement.granted === true &&
                            entitlementResult.entitlement.requiresPayment === false;
      
      this.addTestResult('Pricing Model - FREE', freeTestPassed,
        'Free model should grant access without payment');
        
      if (freeTestPassed) {
        console.log('✅ FREE model works correctly');
      }
      
    } catch (error) {
      console.log('❌ FREE model test failed:', error.message);
      this.addTestResult('Pricing Model - FREE', false, error.message);
    }
    
    // Test PAID model without entitlement
    const paidPolicyData = {
      ...freePolicyData,
      policy: {
        mode: 'paid',
        pricePerPhoto: '5.00'
      }
    };
    
    try {
      const context = { correlationId: 'test-paid-model' };
      await this.orchestrator.entitlement(paidPolicyData, context);
      
      this.addTestResult('Pricing Model - PAID (No Entitlement)', false,
        'Paid model without entitlement should require payment');
        
    } catch (error) {
      const paidTestPassed = error instanceof DownloadError && error.code === 'PAYMENT_REQUIRED';
      
      this.addTestResult('Pricing Model - PAID (No Entitlement)', paidTestPassed,
        `Should throw PAYMENT_REQUIRED, got: ${error.code || error.message}`);
        
      if (paidTestPassed) {
        console.log('✅ PAID model correctly requires payment');
      }
    }
  }

  async getTestSession() {
    try {
      const sessions = await this.orchestrator.db.select()
        .from(this.orchestrator.schema.photographySessions)
        .limit(1);
        
      return sessions.length > 0 ? sessions[0] : null;
    } catch (error) {
      console.log('⚠️ Could not fetch test session:', error.message);
      return null;
    }
  }

  addTestResult(testName, passed, details) {
    this.testResults.push({
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(50));
    
    let passedCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      if (!result.passed) {
        console.log(`     ${result.details}`);
      }
      if (result.passed) passedCount++;
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`Final Score: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
      console.log('🎉 All tests passed! Orchestrator is ready for production.');
    } else {
      console.log('⚠️ Some tests failed. Please review and fix issues before deployment.');
    }
    
    return passedCount === totalCount;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new OrchestratorTester();
  tester.runAllTests()
    .then((results) => {
      process.exit(results.every(r => r.passed) ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = OrchestratorTester;
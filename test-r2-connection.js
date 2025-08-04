#!/usr/bin/env node

/**
 * R2 Connection Test Script
 * Tests the Cloudflare R2 storage connection and functionality
 */

const R2StorageService = require('./server/r2-storage');

async function testR2Connection() {
    console.log('🔧 Testing Cloudflare R2 Storage Connection...\n');
    
    try {
        // Initialize R2 service
        const r2Service = new R2StorageService();
        
        console.log('✅ R2 Service initialized');
        console.log(`   Bucket: ${process.env.CLOUDFLARE_R2_BUCKET_NAME}`);
        console.log(`   Account ID: ${process.env.CLOUDFLARE_R2_ACCOUNT_ID}`);
        console.log(`   Access Key ID: ${process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.substring(0, 8)}...`);
        
        // Test connection
        console.log('\n🔄 Testing connection...');
        const isConnected = await r2Service.testConnection();
        
        if (isConnected) {
            console.log('✅ R2 Connection successful!');
            
            // Test basic functionality
            console.log('\n🔄 Testing basic functionality...');
            
            // Create a test file buffer
            const testData = Buffer.from('Test file content for R2 upload verification');
            const testFilename = `test-${Date.now()}.txt`;
            const testUserId = 'test-user-123';
            const testSessionId = 'test-session-456';
            
            try {
                // Test upload
                console.log('   📤 Testing upload...');
                const uploadResult = await r2Service.uploadRawFile(
                    testData, 
                    testFilename, 
                    testUserId, 
                    testSessionId
                );
                console.log('   ✅ Upload successful:', uploadResult.r2Key);
                
                // Test download
                console.log('   📥 Testing download...');
                const downloadResult = await r2Service.downloadRawFile(uploadResult.r2Key);
                console.log('   ✅ Download successful');
                
                // Test deletion
                console.log('   🗑️ Testing deletion...');
                const deleteResult = await r2Service.deleteRawFile(uploadResult.r2Key);
                console.log('   ✅ Deletion successful');
                
                console.log('\n🎉 All R2 functionality tests passed!');
                
            } catch (functionalityError) {
                console.error('❌ R2 functionality test failed:', functionalityError.message);
                return false;
            }
            
        } else {
            console.error('❌ R2 Connection failed');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ R2 Test Script Error:', error);
        
        // Detailed error analysis
        if (error.message.includes('getaddrinfo')) {
            console.error('🌐 Network connectivity issue - check internet connection');
        } else if (error.message.includes('Access Denied') || error.message.includes('SignatureDoesNotMatch')) {
            console.error('🔑 Authentication issue - check R2 credentials');
        } else if (error.message.includes('NoSuchBucket')) {
            console.error('📦 Bucket not found - check bucket name and permissions');
        } else {
            console.error('❓ Unknown error - check R2 configuration');
        }
        
        return false;
    }
}

// Run the test
if (require.main === module) {
    testR2Connection().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testR2Connection };
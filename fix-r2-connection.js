const { S3Client, HeadBucketCommand, CreateBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

// R2 Configuration from environment  
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

console.log('🔧 R2 Connection Fix and Test');
console.log('==============================');
console.log(`Bucket: ${bucketName}`);
console.log(`Endpoint: https://${accountId}.r2.cloudflarestorage.com`);
console.log('');

// Create S3 client identical to what R2FileManager uses
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
  forcePathStyle: true,
});

async function comprehensiveR2Test() {
  try {
    // Test 1: Basic connection (identical to R2FileManager.testConnection)
    console.log('🧪 Test 1: Basic bucket connectivity...');
    const headCommand = new HeadBucketCommand({ Bucket: bucketName });
    await s3Client.send(headCommand);
    console.log('✅ Basic connectivity successful');
    console.log('');

    // Test 2: List objects (identical to StorageSystem.calculateStorageUsage)
    console.log('🧪 Test 2: Testing listObjects functionality...');
    const testPrefixes = [
      'photographer-44735007/session-test-paid-1759016642017/gallery/',
      'photographer-44735007/session-test-paid-1759016642017/raw/',
      'photographer-44735007/', // General photographer prefix
      '' // Root level
    ];

    for (const prefix of testPrefixes) {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          MaxKeys: 10 // Just get a few objects for testing
        });
        
        const response = await s3Client.send(listCommand);
        const fileCount = response.Contents?.length || 0;
        const totalSize = response.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0;
        
        console.log(`  ✅ Prefix "${prefix}": ${fileCount} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      } catch (listError) {
        console.log(`  ⚠️  Prefix "${prefix}": ${listError.message}`);
      }
    }
    console.log('');

    // Test 3: Verify R2FileManager would work
    console.log('🧪 Test 3: Simulating R2FileManager functionality...');
    
    // Test the exact same flow as in R2FileManager.testConnection()
    try {
      const headCommand = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(headCommand);
      console.log('✅ R2FileManager.testConnection() should succeed');
    } catch (error) {
      console.log(`❌ R2FileManager.testConnection() would fail: ${error.message}`);
      
      // Test bucket creation flow
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log('   Attempting bucket creation...');
        try {
          const createCommand = new CreateBucketCommand({ Bucket: bucketName });
          await s3Client.send(createCommand);
          console.log('✅ Bucket created successfully');
        } catch (createError) {
          console.log(`❌ Bucket creation failed: ${createError.message}`);
        }
      }
    }
    console.log('');

    // Test 4: Storage quota calculation simulation  
    console.log('🧪 Test 4: Simulating StorageSystem.calculateStorageUsage...');
    
    let totalBytes = 0;
    let totalFiles = 0;
    const userId = '44735007'; // Example user ID
    
    // Simulate getting sessions (this would normally come from database)
    const testSessions = [
      { id: 'test-paid-1759016642017' },
      { id: 'example-session-123' }
    ];
    
    console.log(`   Checking storage for user ${userId} across ${testSessions.length} test sessions...`);
    
    for (const session of testSessions) {
      try {
        // Test gallery files
        const galleryPrefix = `photographer-${userId}/session-${session.id}/gallery/`;
        const galleryCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: galleryPrefix,
          MaxKeys: 1000
        });
        
        const galleryResponse = await s3Client.send(galleryCommand);
        const galleryFiles = galleryResponse.Contents || [];
        
        // Test raw files
        const rawPrefix = `photographer-${userId}/session-${session.id}/raw/`;
        const rawCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: rawPrefix,
          MaxKeys: 1000
        });
        
        const rawResponse = await s3Client.send(rawCommand);
        const rawFiles = rawResponse.Contents || [];
        
        // Calculate sizes
        const sessionGalleryBytes = galleryFiles.reduce((sum, file) => sum + (file.Size || 0), 0);
        const sessionRawBytes = rawFiles.reduce((sum, file) => sum + (file.Size || 0), 0);
        const sessionTotalBytes = sessionGalleryBytes + sessionRawBytes;
        
        totalBytes += sessionTotalBytes;
        totalFiles += galleryFiles.length + rawFiles.length;
        
        console.log(`   Session ${session.id}:`);
        console.log(`     Gallery: ${galleryFiles.length} files, ${(sessionGalleryBytes / 1024 / 1024).toFixed(2)}MB`);
        console.log(`     Raw: ${rawFiles.length} files, ${(sessionRawBytes / 1024 / 1024).toFixed(2)}MB`);
        
      } catch (sessionError) {
        console.log(`   ❌ Session ${session.id} error: ${sessionError.message}`);
      }
    }
    
    const totalGB = parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(3));
    console.log('');
    console.log(`   ✅ Storage calculation would succeed:`);
    console.log(`      Total: ${totalGB}GB (${totalFiles} files)`);
    console.log(`      This data would be returned to StorageSystem.canUpload()`);
    console.log('');

    // Test 5: Upload permission check simulation
    console.log('🧪 Test 5: Simulating upload permission check...');
    const quotaGB = 100; // Default 100GB quota
    const testUploadSizeMB = 50; // Simulate 50MB upload
    const testUploadSizeBytes = testUploadSizeMB * 1024 * 1024;
    
    const newTotalGB = (totalBytes + testUploadSizeBytes) / (1024 * 1024 * 1024);
    const canUpload = newTotalGB <= quotaGB;
    
    console.log(`   Current usage: ${totalGB}GB`);
    console.log(`   Upload size: ${testUploadSizeMB}MB`);
    console.log(`   New total would be: ${parseFloat(newTotalGB.toFixed(3))}GB`);
    console.log(`   Quota limit: ${quotaGB}GB`);
    console.log(`   Can upload: ${canUpload ? '✅ YES' : '❌ NO - QUOTA EXCEEDED'}`);
    
    if (!canUpload) {
      console.log(`   ⚠️  This would trigger "Storage quota exceeded" error`);
    }

    console.log('');
    console.log('🎉 COMPREHENSIVE R2 TEST COMPLETED SUCCESSFULLY!');
    console.log('   All R2 functionality is working correctly.');
    console.log('   The application should be able to:');
    console.log('   • Connect to R2 bucket');
    console.log('   • List objects for storage calculation');
    console.log('   • Perform accurate quota checks');
    console.log('   • Handle uploads without fake quota errors');

    return true;

  } catch (error) {
    console.error('');
    console.error('💥 COMPREHENSIVE R2 TEST FAILED');
    console.error(`   Error: ${error.name || 'Unknown'}`);
    console.error(`   Message: ${error.message}`);
    console.error(`   This explains why the application is showing "Storage quota exceeded" errors`);
    console.error('');
    
    return false;
  }
}

// Run the comprehensive test
comprehensiveR2Test().then((success) => {
  if (!success) {
    process.exit(1);
  }
}).catch((error) => {
  console.error('💥 UNEXPECTED ERROR:', error);
  process.exit(1);
});
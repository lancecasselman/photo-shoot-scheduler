// Comprehensive deletion test to verify complete cleanup
const { Pool } = require('pg');
const AWS = require('aws-sdk');

// Test configuration
const TEST_SESSION_ID = 'test-deletion-cleanup-' + Date.now();
const TEST_USER_ID = 'test-user-123';

const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Configure R2 client
const s3 = new AWS.S3({
  endpoint: 'https://c63e5e9dae18a57faff7ea25de2856ff.r2.cloudflarestorage.com',
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: 'auto'
});

const BUCKET_NAME = 'photoappr2token';

async function testDeletionCleanup() {
  console.log('🧪 Starting comprehensive deletion cleanup test...\n');
  
  try {
    // Step 1: Create test files in database
    console.log('📝 Step 1: Creating test database records...');
    
    const testFiles = [
      {
        filename: 'test-gallery-1.jpg',
        folderType: 'gallery',
        sizeBytes: 1024000,
        sizeMB: 1.0
      },
      {
        filename: 'test-raw-1.tif',
        folderType: 'raw',
        sizeBytes: 50000000,
        sizeMB: 50.0
      }
    ];
    
    for (const file of testFiles) {
      await dbPool.query(
        'INSERT INTO session_files (user_id, session_id, folder_type, filename, file_size_bytes, file_size_mb) VALUES ($1, $2, $3, $4, $5, $6)',
        [TEST_USER_ID, TEST_SESSION_ID, file.folderType, file.filename, file.sizeBytes, file.sizeMB]
      );
      console.log(`   ✅ Created database record: ${file.filename} (${file.folderType})`);
    }
    
    // Step 2: Create test files in cloud storage
    console.log('\n☁️ Step 2: Creating test files in cloud storage...');
    
    for (const file of testFiles) {
      const cloudPath = `.private/sessions/${TEST_SESSION_ID}/${file.folderType}/${file.filename}`;
      
      await s3.putObject({
        Bucket: BUCKET_NAME,
        Key: cloudPath,
        Body: Buffer.alloc(1000, 'test-data'), // Small test file
        ContentType: 'application/octet-stream'
      }).promise();
      
      console.log(`   ✅ Created cloud file: ${cloudPath}`);
    }
    
    // Step 3: Verify files exist before deletion
    console.log('\n🔍 Step 3: Verifying files exist before deletion...');
    
    const beforeQuery = await dbPool.query(
      'SELECT COUNT(*) as count FROM session_files WHERE session_id = $1',
      [TEST_SESSION_ID]
    );
    console.log(`   📊 Database records before: ${beforeQuery.rows[0].count}`);
    
    for (const file of testFiles) {
      const cloudPath = `.private/sessions/${TEST_SESSION_ID}/${file.folderType}/${file.filename}`;
      try {
        await s3.headObject({ Bucket: BUCKET_NAME, Key: cloudPath }).promise();
        console.log(`   ☁️ Cloud file exists: ${file.filename}`);
      } catch (error) {
        console.log(`   ❌ Cloud file missing: ${file.filename}`);
      }
    }
    
    // Step 4: Test deletion via API endpoint
    console.log('\n🗑️ Step 4: Testing deletion via API endpoint...');
    
    for (const file of testFiles) {
      const response = await fetch(`http://localhost:5000/api/r2/delete/${TEST_USER_ID}/${TEST_SESSION_ID}/${file.filename}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token' // Mock auth for test
        }
      });
      
      if (response.ok) {
        console.log(`   ✅ API deletion successful: ${file.filename}`);
      } else {
        console.log(`   ❌ API deletion failed: ${file.filename} (${response.status})`);
      }
    }
    
    // Step 5: Verify complete cleanup
    console.log('\n🔍 Step 5: Verifying complete cleanup...');
    
    const afterQuery = await dbPool.query(
      'SELECT COUNT(*) as count FROM session_files WHERE session_id = $1',
      [TEST_SESSION_ID]
    );
    console.log(`   📊 Database records after: ${afterQuery.rows[0].count}`);
    
    let cloudFilesRemaining = 0;
    for (const file of testFiles) {
      const cloudPath = `.private/sessions/${TEST_SESSION_ID}/${file.folderType}/${file.filename}`;
      try {
        await s3.headObject({ Bucket: BUCKET_NAME, Key: cloudPath }).promise();
        console.log(`   ❌ Cloud file still exists: ${file.filename}`);
        cloudFilesRemaining++;
      } catch (error) {
        console.log(`   ✅ Cloud file deleted: ${file.filename}`);
      }
    }
    
    // Step 6: Test results
    console.log('\n📋 Test Results:');
    const dbCleanupSuccess = afterQuery.rows[0].count === '0';
    const cloudCleanupSuccess = cloudFilesRemaining === 0;
    
    console.log(`   Database cleanup: ${dbCleanupSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Cloud storage cleanup: ${cloudCleanupSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Overall test: ${dbCleanupSuccess && cloudCleanupSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    // Cleanup any remaining test data
    await dbPool.query('DELETE FROM session_files WHERE session_id = $1', [TEST_SESSION_ID]);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await dbPool.end();
  }
}

// Run the test
testDeletionCleanup();
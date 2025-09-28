const { S3Client, HeadBucketCommand, CreateBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// R2 Configuration from environment
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

console.log('🔧 R2 Configuration:');
console.log(`  Bucket Name: ${bucketName}`);
console.log(`  Account ID: ${accountId}`);
console.log(`  Access Key ID: ${accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'MISSING'}`);
console.log(`  Secret Key: ${secretAccessKey ? secretAccessKey.substring(0, 8) + '...' : 'MISSING'}`);
console.log(`  Endpoint: https://${accountId}.r2.cloudflarestorage.com`);
console.log('');

// Create S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
  forcePathStyle: true,
});

async function testR2BucketCreation() {
  try {
    console.log('🧪 Testing R2 Connection and Bucket Creation...');
    console.log('');
    
    // Step 1: List all buckets to test credentials
    console.log('1️⃣ Testing credentials with ListBuckets...');
    try {
      const listCommand = new ListBucketsCommand({});
      const listResult = await s3Client.send(listCommand);
      console.log(`✅ Credentials valid! Found ${listResult.Buckets.length} bucket(s):`);
      listResult.Buckets.forEach((bucket, index) => {
        console.log(`   ${index + 1}. ${bucket.Name} (created: ${bucket.CreationDate})`);
      });
      console.log('');
    } catch (listError) {
      console.error('❌ Credential test failed:', listError.message);
      if (listError.name === 'InvalidAccessKeyId') {
        console.error('   Issue: Invalid Access Key ID');
      } else if (listError.message.includes('SignatureDoesNotMatch')) {
        console.error('   Issue: Invalid Secret Access Key');
      }
      throw listError;
    }

    // Step 2: Check if target bucket exists
    console.log(`2️⃣ Checking if bucket '${bucketName}' exists...`);
    try {
      const headCommand = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(headCommand);
      console.log(`✅ Bucket '${bucketName}' already exists and is accessible!`);
      return true;
    } catch (headError) {
      if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
        console.log(`⚠️  Bucket '${bucketName}' does not exist. Attempting to create...`);
      } else {
        console.error(`❌ Error checking bucket: ${headError.name} - ${headError.message}`);
        throw headError;
      }
    }

    // Step 3: Create the bucket
    console.log(`3️⃣ Creating bucket '${bucketName}'...`);
    try {
      const createCommand = new CreateBucketCommand({ 
        Bucket: bucketName,
        CreateBucketConfiguration: {
          // R2 uses 'auto' region for global accessibility
        }
      });
      
      await s3Client.send(createCommand);
      console.log(`✅ Bucket '${bucketName}' created successfully!`);
    } catch (createError) {
      console.error(`❌ Bucket creation failed: ${createError.name} - ${createError.message}`);
      
      // Provide specific error guidance
      if (createError.message?.includes('BucketAlreadyExists')) {
        console.error('   Issue: Bucket exists but may not be owned by this account');
      } else if (createError.message?.includes('BucketAlreadyOwnedByYou')) {
        console.log('   Info: Bucket already exists and is owned by you - this is fine!');
      } else if (createError.message?.includes('Access Denied')) {
        console.error('   Issue: Insufficient permissions to create buckets');
        console.error('   Solution: Ensure R2 API token has Object Read & Write + Bucket Read & Write permissions');
      }
      throw createError;
    }

    // Step 4: Verify the bucket was created successfully
    console.log(`4️⃣ Verifying bucket '${bucketName}' accessibility...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for propagation
    
    try {
      const verifyCommand = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(verifyCommand);
      console.log(`✅ Bucket verification successful! '${bucketName}' is fully operational.`);
      return true;
    } catch (verifyError) {
      console.error(`❌ Bucket verification failed: ${verifyError.message}`);
      throw verifyError;
    }

  } catch (error) {
    console.error('');
    console.error('💥 R2 Bucket Creation Test FAILED');
    console.error(`   Error: ${error.name || 'Unknown'}`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Account ID: ${accountId}`);
    console.error(`   Endpoint: https://${accountId}.r2.cloudflarestorage.com`);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Verify R2 API Token permissions in Cloudflare dashboard');
    console.error('   2. Check that Account ID matches the token account');
    console.error('   3. Ensure bucket name follows R2 naming rules (lowercase, no special chars)');
    console.error('   4. Verify no typos in credentials');
    return false;
  }
}

// Run the test
testR2BucketCreation().then((success) => {
  if (success) {
    console.log('');
    console.log('🎉 R2 BUCKET TEST COMPLETED SUCCESSFULLY!');
    console.log(`   Bucket '${bucketName}' is ready for use.`);
  } else {
    console.log('');
    console.log('❌ R2 BUCKET TEST FAILED');
    process.exit(1);
  }
}).catch((error) => {
  console.error('');
  console.error('💥 UNEXPECTED ERROR:', error);
  process.exit(1);
});
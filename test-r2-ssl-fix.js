const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

// Test R2 connection with different SSL configurations
async function testR2Configurations() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  console.log('🧪 Testing R2 connection configurations...');
  console.log(`Account ID: ${accountId ? accountId.substring(0, 8) + '...' : 'MISSING'}`);
  console.log(`Bucket: ${bucketName || 'MISSING'}`);

  const configurations = [
    {
      name: 'Standard Configuration',
      config: {
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      }
    },
    {
      name: 'Alternative Region',
      config: {
        region: 'us-east-1',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      }
    },
    {
      name: 'With requestHandler',
      config: {
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        requestHandler: {
          httpsAgent: undefined, // Use default
          connectionTimeout: 30000,
          requestTimeout: 60000,
        }
      }
    }
  ];

  for (const { name, config } of configurations) {
    try {
      console.log(`\n📡 Testing: ${name}`);
      const s3Client = new S3Client(config);
      
      const command = new HeadBucketCommand({ Bucket: bucketName });
      const result = await s3Client.send(command);
      
      console.log(`✅ ${name}: SUCCESS`);
      console.log(`   - Region: ${result.$metadata.region || 'auto'}`);
      console.log(`   - HTTP Status: ${result.$metadata.httpStatusCode}`);
      return { success: true, config, name };
      
    } catch (error) {
      console.log(`❌ ${name}: FAILED`);
      console.log(`   - Error: ${error.code || error.name}`);
      console.log(`   - Message: ${error.message?.substring(0, 100)}`);
    }
  }
  
  return { success: false };
}

// Run test
testR2Configurations().then(result => {
  if (result.success) {
    console.log(`\n🎉 Working configuration found: ${result.name}`);
    console.log('✅ R2 connection successful!');
  } else {
    console.log('\n💔 All configurations failed');
    console.log('🔧 Recommendation: Check R2 credentials in Cloudflare dashboard');
  }
}).catch(error => {
  console.error('🚨 Test script error:', error);
});
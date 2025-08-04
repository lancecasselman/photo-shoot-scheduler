// Test alternative R2 endpoint configurations
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

async function testAlternativeEndpoints() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  console.log('🔧 Testing alternative R2 endpoint configurations...');

  const alternatives = [
    {
      name: 'Global Endpoint',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto'
    },
    {
      name: 'WNAM Endpoint',
      endpoint: `https://${accountId}.r2.wnam.cloudflarestorage.com`,
      region: 'wnam'
    },
    {
      name: 'ENAM Endpoint', 
      endpoint: `https://${accountId}.r2.enam.cloudflarestorage.com`,
      region: 'enam'
    },
    {
      name: 'APAC Endpoint',
      endpoint: `https://${accountId}.r2.apac.cloudflarestorage.com`,
      region: 'apac'
    },
    {
      name: 'EEUR Endpoint',
      endpoint: `https://${accountId}.r2.eeur.cloudflarestorage.com`,
      region: 'eeur'
    }
  ];

  for (const config of alternatives) {
    try {
      console.log(`\n📡 Testing: ${config.name}`);
      console.log(`   Endpoint: ${config.endpoint}`);
      
      const s3Client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true,
      });

      const command = new HeadBucketCommand({ Bucket: bucketName });
      const result = await s3Client.send(command);
      
      console.log(`✅ ${config.name}: SUCCESS!`);
      console.log(`   Status: ${result.$metadata.httpStatusCode}`);
      console.log(`   Region: ${result.$metadata.region || config.region}`);
      
      return { success: true, config, result };
      
    } catch (error) {
      console.log(`❌ ${config.name}: ${error.code || 'FAILED'}`);
      if (error.message && !error.message.includes('SSL')) {
        console.log(`   Details: ${error.message.substring(0, 80)}`);
      }
    }
  }
  
  console.log('\n💔 All alternative endpoints failed');
  console.log('🔧 Recommendation: Regenerate R2 API tokens in Cloudflare dashboard');
  return { success: false };
}

testAlternativeEndpoints().then(result => {
  if (result.success) {
    console.log('\n🎉 Found working R2 endpoint!');
    console.log('💡 Update your R2FileManager configuration to use this endpoint');
  } else {
    console.log('\n🔄 Continuing with local backup until R2 credentials are fixed');
  }
}).catch(error => {
  console.error('🚨 Test error:', error);
});
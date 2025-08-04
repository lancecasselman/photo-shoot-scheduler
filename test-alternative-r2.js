const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

// Try alternative R2 endpoint formats
const endpoints = [
  `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  `https://r2.cloudflarestorage.com`,
  `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.dev`
];

async function testMultipleEndpoints() {
  console.log('Testing multiple R2 endpoint formats...\n');
  
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`${i + 1}. Testing: ${endpoint}`);
    
    try {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });
      
      const command = new ListBucketsCommand({});
      const result = await s3Client.send(command);
      
      console.log(`   ✅ Success with ${endpoint}`);
      console.log(`   Buckets found:`, result.Buckets?.map(b => b.Name) || []);
      return { success: true, endpoint, buckets: result.Buckets };
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message.split('\n')[0]}`);
    }
  }
  
  console.log('\n❌ All endpoint tests failed');
  return { success: false };
}

testMultipleEndpoints().then(result => {
  if (result.success) {
    console.log(`\n🎉 Working endpoint found: ${result.endpoint}`);
  } else {
    console.log('\n⚠️  No working endpoints found. Possible issues:');
    console.log('   1. Network connectivity from Replit to Cloudflare R2');
    console.log('   2. Account ID or credentials format');
    console.log('   3. R2 service not enabled for this account');
  }
});
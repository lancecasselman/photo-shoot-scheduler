const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

console.log('Testing R2 with simplified approach...');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

async function testSimple() {
  try {
    console.log('Credentials check:');
    console.log('- Access Key ID length:', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.length);
    console.log('- Secret Key length:', process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.length);
    console.log('- Account ID:', process.env.CLOUDFLARE_R2_ACCOUNT_ID);
    
    console.log('\nAttempting to list buckets...');
    const command = new ListBucketsCommand({});
    const result = await s3Client.send(command);
    
    console.log('✅ Success! Buckets:', result.Buckets?.map(b => b.Name));
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.Code) console.error('Error Code:', error.Code);
    return false;
  }
}

testSimple();
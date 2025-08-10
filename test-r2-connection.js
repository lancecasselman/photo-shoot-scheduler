const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Use the actual environment variables
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function test() {
  try {
    console.log('Testing R2 connection with environment credentials...');
    console.log('Bucket:', process.env.CLOUDFLARE_R2_BUCKET_NAME);
    console.log('Endpoint:', `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    
    // Upload test file
    const putCommand = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: 'test-connection.txt',
      Body: 'R2 connection test successful',
    });
    
    await s3Client.send(putCommand);
    console.log('✅ Test file uploaded successfully');
    
    // List files
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      MaxKeys: 10
    });
    
    const response = await s3Client.send(listCommand);
    console.log('\nFiles in bucket:', response.Contents?.length || 0);
    if (response.Contents) {
      response.Contents.forEach(file => {
        console.log('  -', file.Key, '(', file.Size, 'bytes)');
      });
    }
  } catch (error) {
    console.error('❌ R2 test failed:', error.message);
    if (error.Code) console.error('Error code:', error.Code);
    if (error.$metadata) console.error('HTTP Status:', error.$metadata.httpStatusCode);
  }
}

test();
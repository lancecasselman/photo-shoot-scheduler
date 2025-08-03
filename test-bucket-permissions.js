const { S3Client, HeadBucketCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

async function testBucketPermissions() {
    console.log('Testing bucket permissions for private R2 bucket...');
    
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
    });
    
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    
    try {
        // Test basic bucket access
        console.log('Testing bucket access...');
        const headCommand = new HeadBucketCommand({ Bucket: bucketName });
        const headResult = await s3Client.send(headCommand);
        console.log('✓ Bucket access successful');
        
        // Test small file upload to verify write permissions
        console.log('Testing write permissions with small test file...');
        const testContent = 'R2 connection test - ' + new Date().toISOString();
        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: 'test-connection.txt',
            Body: Buffer.from(testContent),
            ContentType: 'text/plain'
        });
        
        const putResult = await s3Client.send(putCommand);
        console.log('✓ Write permissions successful, ETag:', putResult.ETag);
        
        return true;
    } catch (error) {
        console.log('✗ Bucket test failed:', error.message);
        console.log('Error code:', error.name);
        console.log('HTTP status:', error.$metadata?.httpStatusCode);
        return false;
    }
}

testBucketPermissions().then(success => {
    console.log('\nTest result:', success ? 'SUCCESS - Bucket is accessible' : 'FAILED - Check bucket permissions');
}).catch(console.error);
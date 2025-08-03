const { S3Client, HeadBucketCommand, CreateBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function testR2V3() {
    console.log('Testing R2 with AWS SDK v3...');
    
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
    console.log(`Testing bucket: ${bucketName}`);
    
    try {
        // Test 1: Head bucket
        console.log('Testing HeadBucket...');
        const headCommand = new HeadBucketCommand({ Bucket: bucketName });
        await s3Client.send(headCommand);
        console.log('✓ HeadBucket successful - bucket exists');
        return true;
    } catch (error) {
        console.log('✗ HeadBucket failed:', error.message);
        
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            try {
                console.log('Attempting to create bucket...');
                const createCommand = new CreateBucketCommand({ Bucket: bucketName });
                await s3Client.send(createCommand);
                console.log('✓ Bucket created successfully');
                return true;
            } catch (createError) {
                console.log('✗ Bucket creation failed:', createError.message);
                return false;
            }
        }
        return false;
    }
}

testR2V3().then(success => {
    console.log('Test result:', success ? 'SUCCESS' : 'FAILED');
}).catch(console.error);
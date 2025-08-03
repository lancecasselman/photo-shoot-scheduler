const AWS = require('aws-sdk');

// Test R2 connection with different configurations
async function testR2Connection() {
    console.log('Testing R2 connection configurations...');
    
    const configs = [
        {
            name: 'Config 1: s3ForcePathStyle=true, region=auto',
            config: {
                endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
                region: 'auto',
                signatureVersion: 'v4',
                s3ForcePathStyle: true,
            }
        },
        {
            name: 'Config 2: s3ForcePathStyle=false, region=us-east-1',
            config: {
                endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
                region: 'us-east-1',
                signatureVersion: 'v4',
                s3ForcePathStyle: false,
            }
        }
    ];
    
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    console.log(`Testing bucket: ${bucketName}`);
    console.log(`Account ID: ${process.env.CLOUDFLARE_R2_ACCOUNT_ID}`);
    console.log(`Access Key Length: ${process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.length || 0}`);
    
    for (const test of configs) {
        console.log(`\n--- ${test.name} ---`);
        try {
            const s3 = new AWS.S3(test.config);
            
            // Test 1: List buckets (should fail for R2 but gives insight)
            try {
                console.log('Testing listBuckets...');
                const buckets = await s3.listBuckets().promise();
                console.log('✓ listBuckets success:', buckets.Buckets?.length || 0, 'buckets');
            } catch (err) {
                console.log('✗ listBuckets failed:', err.message);
            }
            
            // Test 2: Head bucket (should work if bucket exists)
            try {
                console.log('Testing headBucket...');
                await s3.headBucket({ Bucket: bucketName }).promise();
                console.log('✓ headBucket success - bucket exists and accessible');
            } catch (err) {
                console.log('✗ headBucket failed:', err.message);
            }
            
            // Test 3: List objects in bucket
            try {
                console.log('Testing listObjectsV2...');
                const objects = await s3.listObjectsV2({ Bucket: bucketName, MaxKeys: 1 }).promise();
                console.log('✓ listObjectsV2 success - bucket accessible');
            } catch (err) {
                console.log('✗ listObjectsV2 failed:', err.message);
            }
            
        } catch (err) {
            console.log('✗ S3 client creation failed:', err.message);
        }
    }
}

testR2Connection().catch(console.error);
const { S3Client, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');

async function testR2Direct() {
    console.log('🔧 Direct R2 Connection Test with Latest Credentials\n');
    
    const endpoint = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    console.log('Configuration:');
    console.log(`- Endpoint: ${endpoint}`);
    console.log(`- Bucket: rawphoto`);
    console.log(`- Access Key ID: ${process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.substring(0, 8)}...`);
    console.log(`- Secret Key: ${process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.substring(0, 8)}...`);
    
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
        requestHandler: {
            requestTimeout: 30000,
            httpsAgent: { keepAlive: false }
        }
    });
    
    try {
        console.log('\n🔄 Testing bucket access...');
        
        // Test if rawphoto bucket exists
        const headCommand = new HeadBucketCommand({ Bucket: 'rawphoto' });
        await s3Client.send(headCommand);
        
        console.log('✅ SUCCESS: rawphoto bucket exists and is accessible!');
        return true;
        
    } catch (error) {
        console.log(`❌ HeadBucket failed: ${error.message}`);
        
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            console.log('\n🔄 Bucket not found, attempting to create...');
            
            try {
                const createCommand = new CreateBucketCommand({ Bucket: 'rawphoto' });
                await s3Client.send(createCommand);
                console.log('✅ SUCCESS: rawphoto bucket created successfully!');
                return true;
                
            } catch (createError) {
                console.log(`❌ Create bucket failed: ${createError.message}`);
                return false;
            }
        } else {
            console.log('❌ Connection failed with error:', error.code || error.name);
            return false;
        }
    }
}

testR2Direct().then(success => {
    if (success) {
        console.log('\n🎉 R2 is now working! You can use the RAW backup system.');
    } else {
        console.log('\n⚠️ R2 connection still has issues. Check credentials or network.');
    }
    process.exit(success ? 0 : 1);
});
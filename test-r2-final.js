const { S3Client, ListBucketsCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');

async function finalR2Test() {
    console.log('🔧 Final R2 Connection Attempt\n');
    
    // Try with minimal configuration
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
        maxAttempts: 1,
        requestHandler: {
            requestTimeout: 5000
        }
    });
    
    try {
        console.log('Attempting to list all buckets...');
        const listCommand = new ListBucketsCommand({});
        const result = await s3Client.send(listCommand);
        
        console.log('✅ SUCCESS! R2 connection working!');
        console.log('Available buckets:', result.Buckets?.map(b => b.Name) || []);
        
        // Check if rawphoto exists
        const hasRawPhoto = result.Buckets?.some(b => b.Name === 'rawphoto');
        
        if (!hasRawPhoto) {
            console.log('\n📦 Creating rawphoto bucket...');
            try {
                const createCommand = new CreateBucketCommand({ Bucket: 'rawphoto' });
                await s3Client.send(createCommand);
                console.log('✅ rawphoto bucket created successfully!');
            } catch (createError) {
                console.log('❌ Failed to create bucket:', createError.message);
            }
        } else {
            console.log('✅ rawphoto bucket already exists!');
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Final test failed:', error.message);
        
        // Check if it's a credential issue vs network issue
        if (error.message.includes('EPROTO') || error.message.includes('handshake')) {
            console.log('\n🔍 Diagnosis: SSL/TLS handshake failure');
            console.log('   This suggests network-level blocking between Replit and R2');
            console.log('   Possible causes:');
            console.log('   • Replit firewall restrictions');
            console.log('   • R2 geo-blocking');
            console.log('   • Invalid account configuration');
        } else if (error.message.includes('Access Denied') || error.message.includes('InvalidAccessKeyId')) {
            console.log('\n🔍 Diagnosis: Authentication failure');
            console.log('   Check credentials in Cloudflare dashboard');
        } else {
            console.log('\n🔍 Diagnosis: Unknown error');
            console.log('   Error details:', error.code, error.name);
        }
        
        return false;
    }
}

finalR2Test().then(success => {
    if (success) {
        console.log('\n🎉 R2 is now fully operational!');
    } else {
        console.log('\n⚠️ R2 connection blocked. Using Firebase Storage as primary storage.');
    }
});
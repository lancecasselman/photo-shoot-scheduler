const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

// Test different region configurations for R2
const configs = [
    { region: 'auto', name: 'Auto Region' },
    { region: 'us-east-1', name: 'US East 1' },
    { region: 'wnam', name: 'Western North America' },
    { region: 'enam', name: 'Eastern North America' }
];

async function testR2Regions() {
    console.log('Testing R2 with different region configurations...\n');
    
    for (const config of configs) {
        console.log(`Testing ${config.name} (${config.region})...`);
        
        try {
            const s3Client = new S3Client({
                region: config.region,
                endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
                },
                forcePathStyle: true,
                requestHandler: {
                    requestTimeout: 10000
                }
            });
            
            const command = new HeadBucketCommand({ Bucket: 'rawphoto' });
            await s3Client.send(command);
            
            console.log(`   ✅ SUCCESS with ${config.name}!`);
            return { success: true, region: config.region };
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message.substring(0, 80)}...`);
        }
    }
    
    return { success: false };
}

testR2Regions().then(result => {
    if (result.success) {
        console.log(`\n🎉 Working region found: ${result.region}`);
    } else {
        console.log('\n❌ All region tests failed - likely network/credentials issue');
    }
});
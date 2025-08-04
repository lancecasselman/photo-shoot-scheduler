// Direct HTTP test to R2 without AWS SDK
const https = require('https');
const crypto = require('crypto');

async function testDirectR2Connection() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  console.log('🔧 Testing direct HTTPS connection to R2...');
  
  // Test basic HTTPS connectivity
  const hostname = `${accountId}.r2.cloudflarestorage.com`;
  console.log(`📡 Testing HTTPS connection to: ${hostname}`);

  return new Promise((resolve) => {
    const options = {
      hostname,
      port: 443,
      path: `/${bucketName}`,
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'User-Agent': 'Photography-Management-System/1.0'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`✅ HTTPS connection successful!`);
      console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      if (res.statusCode === 403) {
        console.log('🔐 Got 403 - This is expected without authentication');
        console.log('✅ R2 endpoint is reachable, SSL is working');
        resolve({ success: true, reachable: true });
      } else {
        resolve({ success: true, reachable: true });
      }
    });

    req.on('error', (error) => {
      console.log(`❌ HTTPS connection failed: ${error.code}`);
      console.log(`   Message: ${error.message}`);
      
      if (error.code === 'EPROTO') {
        console.log('💡 SSL protocol error - likely incompatible TLS version');
      } else if (error.code === 'ENOTFOUND') {
        console.log('💡 DNS resolution failed - check account ID');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('💡 Connection timeout - network or firewall issue');
      }
      
      resolve({ success: false, error: error.code });
    });

    req.on('timeout', () => {
      console.log('⏰ Request timeout');
      req.destroy();
      resolve({ success: false, error: 'TIMEOUT' });
    });

    req.end();
  });
}

// Run test
testDirectR2Connection().then(result => {
  if (result.success) {
    console.log('\n🎉 Direct connection successful!');
    console.log('🔍 Issue is likely with AWS SDK configuration, not network connectivity');
  } else {
    console.log('\n💔 Direct connection failed');
    console.log('🔧 Network or SSL compatibility issue confirmed');
  }
}).catch(error => {
  console.error('🚨 Test error:', error);
});
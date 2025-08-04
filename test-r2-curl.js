const https = require('https');

// Test basic HTTPS connection to R2 endpoint
const endpoint = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

console.log('Testing basic HTTPS connection to:', endpoint);

https.get(endpoint, {
  timeout: 10000,
  agent: false,
}, (res) => {
  console.log('✅ HTTPS connection successful');
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
}).on('error', (err) => {
  console.error('❌ HTTPS connection failed:', err.message);
  console.error('Error code:', err.code);
}).on('timeout', () => {
  console.error('❌ Connection timeout');
});
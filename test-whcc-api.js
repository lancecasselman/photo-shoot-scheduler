const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const crypto = require('crypto');
require('dotenv').config();

// WHCC credentials from environment
const OAS_CONSUMER_KEY = process.env.OAS_CONSUMER_KEY;
const OAS_CONSUMER_SECRET = process.env.OAS_CONSUMER_SECRET;

// Check which environment we're using
const WHCC_ENV = process.env.WHCC_ENV || 'production';
const isSandbox = WHCC_ENV === 'sandbox';
const baseUrl = isSandbox ? 'https://sandbox.apps.whcc.com' : 'https://apps.whcc.com';

console.log('🔧 WHCC Configuration:');
console.log(`  Environment: ${WHCC_ENV} (${isSandbox ? 'SANDBOX' : 'PRODUCTION'})`);
console.log(`  Base URL: ${baseUrl}`);
console.log(`  Consumer Key: ${OAS_CONSUMER_KEY ? OAS_CONSUMER_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
console.log(`  Consumer Secret: ${OAS_CONSUMER_SECRET ? '***' : 'NOT SET'}`);
console.log('');

// Generate OAS signature for authentication
function generateOASSignature(method, url, timestamp) {
  const stringToSign = `${method.toUpperCase()}${url}${timestamp}`;
  const signature = crypto
    .createHmac('sha256', OAS_CONSUMER_SECRET)
    .update(stringToSign)
    .digest('base64');
  return signature;
}

// Get OAS auth headers
function getOASAuthHeader(method, endpoint) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = `${baseUrl}${endpoint}`;
  const signature = generateOASSignature(method, url, timestamp);
  
  return {
    'OAS-Consumer-Key': OAS_CONSUMER_KEY,
    'OAS-Consumer-Timestamp': timestamp.toString(),
    'OAS-Consumer-Signature': signature,
    'Content-Type': 'application/json'
  };
}

// Get access token from WHCC
async function getAccessToken() {
  try {
    const authEndpoint = '/api/AccessToken';
    const authUrl = `${baseUrl}${authEndpoint}`;
    
    console.log(`📡 Getting access token from: ${authUrl}`);
    
    const headers = getOASAuthHeader('GET', authEndpoint);
    const response = await fetch(authUrl, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Auth failed (${response.status}): ${text}`);
      return null;
    }

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    if (data.access_token) {
      console.log(`✅ Got access token: ${data.access_token.substring(0, 20)}...`);
      return data.access_token;
    } else if (data.AccessToken) {
      console.log(`✅ Got access token: ${data.AccessToken.substring(0, 20)}...`);
      return data.AccessToken;
    } else {
      console.error('❌ No access token in response:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting access token:', error.message);
    return null;
  }
}

// Fetch catalog from WHCC
async function fetchCatalog() {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.error('❌ No access token available');
      return;
    }

    const catalogEndpoint = '/api/catalog';
    const catalogUrl = `${baseUrl}${catalogEndpoint}`;
    
    console.log(`\n📦 Fetching catalog from: ${catalogUrl}`);
    
    const response = await fetch(catalogUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Catalog fetch failed (${response.status}): ${text}`);
      return;
    }

    const catalog = await response.json();
    console.log(`\n✅ WHCC Catalog received!`);
    console.log(`  Categories: ${catalog.Categories ? catalog.Categories.length : 0}`);
    
    // Show all categories
    if (catalog.Categories) {
      console.log('\n📂 Available Categories:');
      catalog.Categories.forEach(cat => {
        const productCount = cat.ProductList ? cat.ProductList.length : 0;
        console.log(`  - ${cat.Name} (${productCount} products)`);
        
        // Show first 5 products in each category
        if (cat.ProductList && cat.ProductList.length > 0) {
          cat.ProductList.slice(0, 5).forEach(prod => {
            const nodeCount = prod.ProductNodes ? prod.ProductNodes.length : 0;
            console.log(`    • ${prod.Name} (UID: ${prod.ProductUID}, ${nodeCount} sizes)`);
          });
          if (cat.ProductList.length > 5) {
            console.log(`    ... and ${cat.ProductList.length - 5} more`);
          }
        }
      });
    }

    // Count total products
    let totalProducts = 0;
    let totalSizes = 0;
    if (catalog.Categories) {
      catalog.Categories.forEach(cat => {
        if (cat.ProductList) {
          totalProducts += cat.ProductList.length;
          cat.ProductList.forEach(prod => {
            if (prod.ProductNodes) {
              totalSizes += prod.ProductNodes.length;
            }
          });
        }
      });
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total Categories: ${catalog.Categories ? catalog.Categories.length : 0}`);
    console.log(`  Total Products: ${totalProducts}`);
    console.log(`  Total Size Options: ${totalSizes}`);
    
    // Save raw catalog for inspection
    const fs = require('fs');
    fs.writeFileSync('whcc-catalog-raw.json', JSON.stringify(catalog, null, 2));
    console.log('\n💾 Full catalog saved to whcc-catalog-raw.json for inspection');
    
  } catch (error) {
    console.error('❌ Error fetching catalog:', error.message);
    console.error(error.stack);
  }
}

// Run the test
console.log('🚀 Testing WHCC API Connection...\n');
fetchCatalog();
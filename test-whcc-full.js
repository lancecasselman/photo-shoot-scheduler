// Deep dive test script for WHCC APIs
const fetch = require('node-fetch');
const crypto = require('crypto');

// Configuration
const OAS_KEY = process.env.OAS_CONSUMER_KEY;
const OAS_SECRET = process.env.OAS_CONSUMER_SECRET;
const EDITOR_KEY = process.env.EDITOR_API_KEY_ID;
const EDITOR_SECRET = process.env.EDITOR_API_KEY_SECRET;

const IS_SANDBOX = process.env.WHCC_ENV === 'sandbox' || true; // Default to sandbox
const BASE_URL = IS_SANDBOX ? 'https://sandbox.apps.whcc.com' : 'https://apps.whcc.com';
const EDITOR_URL = IS_SANDBOX ? 'https://prospector-stage.dragdrop.design' : 'https://prospector.dragdrop.design';

console.log('🚀 DEEP DIVE INTO WHCC APIs');
console.log('=' .repeat(60));
console.log(`Environment: ${IS_SANDBOX ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`Order Submit API: ${BASE_URL}`);
console.log(`Editor API: ${EDITOR_URL}`);
console.log('=' .repeat(60));

// Get access token
async function getAccessToken() {
  try {
    console.log('\n📋 Step 1: Getting Access Token...');
    
    const authUrl = `${BASE_URL}/api/AccessToken`;
    const requestBody = new URLSearchParams({
      'grant_type': 'consumer_credentials',
      'consumer_key': OAS_KEY,
      'consumer_secret': OAS_SECRET
    });
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: requestBody.toString()
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Auth failed:', error);
      return null;
    }
    
    const data = await response.json();
    console.log('✅ Access Token received!');
    console.log(`   Client ID: ${data.ClientId}`);
    console.log(`   Consumer Key: ${data.ConsumerKey}`);
    console.log(`   Valid until: ${data.ExpirationDate}`);
    
    return data.Token;
  } catch (error) {
    console.error('❌ Error getting access token:', error);
    return null;
  }
}

// Get catalog with deep analysis
async function getCatalog(token) {
  try {
    console.log('\n📚 Step 2: Fetching Full Product Catalog...');
    
    const catalogUrl = `${BASE_URL}/api/catalog`;
    const response = await fetch(catalogUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Catalog fetch failed:', error);
      return null;
    }
    
    const catalog = await response.json();
    console.log('✅ Catalog received!');
    
    // Analyze categories
    if (catalog.Categories) {
      console.log(`\n📦 PRODUCT CATEGORIES (${catalog.Categories.length} total):`);
      console.log('-'.repeat(60));
      
      const productSummary = {
        albums: [],
        books: [],
        prints: [],
        canvas: [],
        metal: [],
        acrylic: [],
        cards: [],
        other: []
      };
      
      catalog.Categories.forEach(category => {
        console.log(`\n🏷️ Category: ${category.Name}`);
        
        if (category.ProductList && category.ProductList.length > 0) {
          console.log(`   Products in category: ${category.ProductList.length}`);
          
          category.ProductList.forEach(product => {
            const name = product.Name || product.Description || 'Unknown';
            
            // Categorize products
            const lowerName = name.toLowerCase();
            if (lowerName.includes('album')) productSummary.albums.push(name);
            else if (lowerName.includes('book')) productSummary.books.push(name);
            else if (lowerName.includes('print') && !lowerName.includes('canvas')) productSummary.prints.push(name);
            else if (lowerName.includes('canvas')) productSummary.canvas.push(name);
            else if (lowerName.includes('metal')) productSummary.metal.push(name);
            else if (lowerName.includes('acrylic')) productSummary.acrylic.push(name);
            else if (lowerName.includes('card')) productSummary.cards.push(name);
            else productSummary.other.push(name);
            
            // Show first few products in detail
            if (category.ProductList.indexOf(product) < 3) {
              console.log(`   - ${name}`);
              if (product.ProductNodes && product.ProductNodes.length > 0) {
                const sizes = product.ProductNodes.map(n => `${n.W}x${n.H}`).join(', ');
                console.log(`     Sizes: ${sizes}`);
              }
            }
          });
          
          if (category.ProductList.length > 3) {
            console.log(`   ... and ${category.ProductList.length - 3} more`);
          }
        }
      });
      
      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('📊 PRODUCT TYPE SUMMARY:');
      console.log('='.repeat(60));
      console.log(`📚 ALBUMS: ${productSummary.albums.length}`);
      if (productSummary.albums.length > 0) {
        productSummary.albums.slice(0, 5).forEach(a => console.log(`   ✅ ${a}`));
      }
      
      console.log(`📖 BOOKS: ${productSummary.books.length}`);
      if (productSummary.books.length > 0) {
        productSummary.books.slice(0, 5).forEach(b => console.log(`   ✅ ${b}`));
      }
      
      console.log(`🖼️ PRINTS: ${productSummary.prints.length}`);
      console.log(`🎨 CANVAS: ${productSummary.canvas.length}`);
      console.log(`🔩 METAL: ${productSummary.metal.length}`);
      if (productSummary.metal.length > 0) {
        productSummary.metal.slice(0, 5).forEach(m => console.log(`   ✅ ${m}`));
      }
      
      console.log(`💎 ACRYLIC: ${productSummary.acrylic.length}`);
      if (productSummary.acrylic.length > 0) {
        productSummary.acrylic.slice(0, 5).forEach(a => console.log(`   ✅ ${a}`));
      }
      
      console.log(`💌 CARDS: ${productSummary.cards.length}`);
      console.log(`📦 OTHER: ${productSummary.other.length}`);
    }
    
    // Check for order attributes (shipping methods, etc)
    if (catalog.Categories && catalog.Categories[0] && catalog.Categories[0].OrderAttributeCategoryList) {
      console.log('\n📬 ORDER ATTRIBUTES:');
      const orderAttrs = catalog.Categories[0].OrderAttributeCategoryList;
      orderAttrs.forEach(attr => {
        console.log(`   - ${attr.CategoryName}: ${attr.Attributes ? attr.Attributes.length : 0} options`);
      });
    }
    
    return catalog;
  } catch (error) {
    console.error('❌ Error fetching catalog:', error);
    return null;
  }
}

// Test Editor API
async function testEditorAPI() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🎨 Step 3: Testing Editor API...');
    console.log('='.repeat(60));
    
    if (!EDITOR_KEY || !EDITOR_SECRET) {
      console.log('⚠️ Editor API credentials not configured');
      return;
    }
    
    // Generate Editor API auth
    const timestamp = Date.now();
    const message = `${EDITOR_KEY}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', EDITOR_SECRET)
      .update(message)
      .digest('hex');
    
    const headers = {
      'X-API-Key': EDITOR_KEY,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
      'Content-Type': 'application/json'
    };
    
    console.log('📝 Editor API configured with:');
    console.log(`   Key ID: ${EDITOR_KEY.substring(0, 8)}...`);
    console.log(`   Signature generated: ${signature.substring(0, 16)}...`);
    
    // Try to get Editor API token
    const tokenUrl = `${EDITOR_URL}/api/v1/auth/token`;
    console.log(`   Testing: ${tokenUrl}`);
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({})
    });
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      console.log('✅ Editor API authentication successful!');
      console.log(`   Token: ${JSON.stringify(tokenData).substring(0, 50)}...`);
      
      // List available products/designs
      const productsUrl = `${EDITOR_URL}/api/v1/products`;
      const productsResponse = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          ...headers,
          'Authorization': `Bearer ${tokenData.token || tokenData.access_token || ''}`
        }
      });
      
      if (productsResponse.ok) {
        const products = await productsResponse.json();
        console.log('\n📦 Editor API Products:');
        if (Array.isArray(products)) {
          products.slice(0, 10).forEach(p => {
            console.log(`   - ${p.name || p.Name || JSON.stringify(p).substring(0, 50)}`);
          });
        } else {
          console.log(`   Response: ${JSON.stringify(products).substring(0, 200)}...`);
        }
      } else {
        console.log('⚠️ Could not fetch Editor products:', productsResponse.status);
      }
    } else {
      console.log('⚠️ Editor API auth returned:', tokenResponse.status);
      const errorText = await tokenResponse.text();
      console.log('   Response:', errorText.substring(0, 200));
    }
    
  } catch (error) {
    console.error('⚠️ Editor API test error:', error.message);
  }
}

// Main execution
async function main() {
  console.log('\n🔥 STARTING DEEP DIVE...\n');
  
  // Get access token
  const token = await getAccessToken();
  if (!token) {
    console.error('❌ Failed to get access token. Check credentials.');
    return;
  }
  
  // Get catalog
  const catalog = await getCatalog(token);
  
  // Test Editor API
  await testEditorAPI();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 DEEP DIVE COMPLETE!');
  console.log('='.repeat(60));
  
  // Final recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (catalog) {
    const hasAlbums = JSON.stringify(catalog).toLowerCase().includes('album');
    const hasBooks = JSON.stringify(catalog).toLowerCase().includes('book');
    
    if (!hasAlbums && !hasBooks) {
      console.log('📌 Albums/Books not found in Order Submit catalog');
      console.log('   → They may be available through Editor API');
      console.log('   → Or need to be enabled for your account');
      console.log('   → Contact WHCC to enable these products');
    } else {
      console.log('✅ Albums/Books ARE available in your catalog!');
    }
  }
}

// Run the test
main().catch(console.error);
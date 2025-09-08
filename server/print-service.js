const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class PrintServiceAPI {
  constructor() {
    this.oasKey = process.env.OAS_CONSUMER_KEY;
    this.oasSecret = process.env.OAS_CONSUMER_SECRET;
    this.editorKeyId = process.env.EDITOR_API_KEY_ID;
    this.editorKeySecret = process.env.EDITOR_API_KEY_SECRET;
    
    // WHCC (WhiteHouse Custom Color) API endpoints
    // Using the correct WHCC sandbox endpoint
    this.oasBaseUrl = process.env.OAS_API_URL || 'https://apps.whcc.com';
    this.sandboxUrl = process.env.OAS_API_URL || 'https://sandbox.apps.whcc.com';
    
    // Editor API endpoints for WHCC
    this.editorBaseUrl = 'https://studio.whcc.com/editor/api';
    
    this.isSandbox = true; // Start in sandbox mode for testing
  }

  // Generate OAS API signature
  generateOASSignature(method, url, timestamp) {
    const signatureBase = `${method}&${encodeURIComponent(url)}&${timestamp}`;
    const signingKey = `${this.oasSecret}&`;
    return crypto
      .createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');
  }

  // Get OAS authorization header
  getOASAuthHeader(method, endpoint) {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${endpoint}`;
    const signature = this.generateOASSignature(method, url, timestamp);
    
    return {
      'Authorization': `OAuth oauth_consumer_key="${this.oasKey}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="${timestamp}",oauth_signature="${signature}",oauth_version="1.0"`,
      'Content-Type': 'application/json'
    };
  }

  // Get Editor API authorization header
  getEditorAuthHeader() {
    const timestamp = Date.now();
    const message = `${this.editorKeyId}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.editorKeySecret)
      .update(message)
      .digest('hex');
    
    return {
      'X-API-Key': this.editorKeyId,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
      'Content-Type': 'application/json'
    };
  }

  // Authenticate and get access token for WHCC Order Submit API
  async getAccessToken() {
    try {
      console.log('🔐 Getting WHCC access token using Order Submit API...');
      
      // WHCC Access Token endpoint - simpler than OAuth
      const authEndpoint = '/api/AccessToken';
      const authUrl = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${authEndpoint}`;
      
      console.log(`- Auth URL: ${authUrl}`);
      console.log(`- Consumer Key: ${this.oasKey ? this.oasKey.substring(0, 8) + '...' : 'NOT SET'}`);
      console.log(`- Consumer Secret: ${this.oasSecret ? 'SET' : 'NOT SET'}`);
      
      // Build query parameters for GET request
      const params = new URLSearchParams({
        'grant_type': 'consumer_credentials',
        'consumer_key': this.oasKey,
        'consumer_secret': this.oasSecret
      });
      
      console.log(`- Full request URL: ${authUrl}?${params.toString().substring(0, 100)}...`);
      
      const response = await fetch(`${authUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`- Response status: ${response.status}`);
      console.log(`- Response headers:`, response.headers.get('content-type'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Auth failed: ${response.status}`);
        console.log(`- Error response: ${errorText.substring(0, 500)}`);
        throw new Error(`WHCC authentication failed: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      
      const authData = await response.json();
      console.log('✅ Got access token:', {
        clientId: authData.ClientId,
        consumerKey: authData.ConsumerKey,
        effectiveDate: authData.EffectiveDate,
        expirationDate: authData.ExpirationDate,
        tokenLength: authData.Token ? authData.Token.length : 0
      });
      
      return authData.Token;
    } catch (error) {
      console.error('❌ WHCC authentication error:', error.message);
      console.error('- Full error:', error);
      throw error;
    }
  }

  // Get available print products using WHCC Order Submit API
  async getProducts(categoryId = null) {
    console.log('📦 Fetching WHCC product catalog...');
    
    try {
      // First, get access token
      const accessToken = await this.getAccessToken();
      
      // WHCC catalog endpoint as per documentation
      const catalogEndpoint = '/api/catalog';
      const catalogUrl = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${catalogEndpoint}`;
      
      console.log(`- Fetching catalog from: ${catalogUrl}`);
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(catalogUrl, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Catalog fetch failed: ${response.status} - ${errorText.substring(0, 200)}`);
        throw new Error(`Failed to fetch WHCC catalog: ${response.status}`);
      }
      
      const catalog = await response.json();
      console.log(`✅ Got WHCC catalog with ${catalog.Categories ? catalog.Categories.length : 0} categories`);
      
      // Log first category structure to understand format
      if (catalog.Categories && catalog.Categories.length > 0) {
        const firstCategory = catalog.Categories[0];
        console.log('📦 First category structure:', {
          name: firstCategory.CategoryName || firstCategory.Name,
          hasProducts: !!firstCategory.Products,
          productCount: firstCategory.Products ? firstCategory.Products.length : 0,
          keys: Object.keys(firstCategory).slice(0, 10)
        });
        
        if (firstCategory.Products && firstCategory.Products.length > 0) {
          console.log('📦 First product structure:', {
            keys: Object.keys(firstCategory.Products[0]).slice(0, 10)
          });
        }
      }
      
      // Transform WHCC catalog to our format
      return this.transformWHCCCatalog(catalog);
      
    } catch (error) {
      console.error('❌ WHCC catalog error:', error.message);
      
      // Return professional fallback options
      console.log('📦 Using professional fallback products');
      return this.getProfessionalFallbackProducts();
    }
  }
  
  // Transform WHCC catalog format to our gallery format
  transformWHCCCatalog(catalog) {
    const products = [];
    
    try {
      // WHCC catalog has Categories array with ProductList nested inside
      if (catalog.Categories && Array.isArray(catalog.Categories)) {
        catalog.Categories.forEach(category => {
          // Check for ProductList (the actual field name in WHCC catalog)
          const productList = category.ProductList || category.Products || [];
          
          if (Array.isArray(productList) && productList.length > 0) {
            productList.forEach(product => {
              // Extract key product attributes
              const baseProduct = {
                id: `whcc_${product.ProductUID || Math.random()}`,
                name: product.Name || product.Description || 'WHCC Product',
                description: product.Description || category.CategoryName,
                category: category.CategoryName?.toLowerCase() || 'prints',
                productUID: product.ProductUID,
                attributes: []
              };
              
              // Extract pricing from attributes
              let price = 0;
              if (product.Attributes && Array.isArray(product.Attributes)) {
                product.Attributes.forEach(attr => {
                  if (attr.Price) {
                    price = parseFloat(attr.Price) || 0;
                  }
                  // Store available attributes (sizes, finishes, etc.)
                  if (attr.Name && attr.AttributeUID) {
                    baseProduct.attributes.push({
                      id: attr.AttributeUID,
                      name: attr.Name,
                      price: parseFloat(attr.Price) || 0
                    });
                  }
                });
              }
              
              baseProduct.price = price || 9.99; // Default if no price found
              products.push(baseProduct);
            });
          }
        });
      }
      
      // If we got products, return them, otherwise use fallback
      if (products.length > 0) {
        console.log(`✅ Transformed ${products.length} WHCC products from catalog`);
        return products.slice(0, 20); // Return first 20 products for gallery display
      } else {
        console.log('⚠️ No products found in WHCC catalog structure');
        return this.getProfessionalFallbackProducts();
      }
    } catch (error) {
      console.error('❌ Error transforming WHCC catalog:', error);
      return this.getProfessionalFallbackProducts();
    }
  }
  
  // Format individual WHCC product for our gallery
  formatWHCCProduct(product, categoryName) {
    return {
      id: product.id || `whcc_${product.sku || Math.random()}`,
      name: product.name || product.title || 'WHCC Product',
      description: product.description || `Professional ${categoryName}`,
      price: product.price || product.basePrice || 0,
      category: categoryName?.toLowerCase() || 'prints',
      sizes: product.sizes || [],
      sku: product.sku
    };
  }
  
  // Professional fallback products
  getProfessionalFallbackProducts() {
    return [
      { id: 'lustre_4x6', name: '4"×6" Lustre Print', description: 'Professional lustre finish', price: 2.99, category: 'prints' },
      { id: 'lustre_5x7', name: '5"×7" Lustre Print', description: 'Professional lustre finish', price: 4.99, category: 'prints' },
      { id: 'lustre_8x10', name: '8"×10" Lustre Print', description: 'Professional lustre finish', price: 9.99, category: 'prints' },
      { id: 'matte_5x7', name: '5"×7" Matte Print', description: 'Elegant matte finish', price: 5.99, category: 'prints' },
      { id: 'matte_8x10', name: '8"×10" Matte Print', description: 'Elegant matte finish', price: 11.99, category: 'prints' },
      { id: 'canvas_11x14', name: '11"×14" Canvas Print', description: 'Gallery-wrapped canvas', price: 49.99, category: 'canvas' },
      { id: 'metal_8x10', name: '8"×10" Metal Print', description: 'Vibrant metal finish', price: 34.99, category: 'specialty' },
      { id: 'digital_high_res', name: 'High-Resolution Digital', description: 'Full resolution download', price: 19.99, category: 'digital' }
    ];
  }

  // Get product categories
  async getCategories() {
    try {
      const endpoint = '/categories';
      const headers = this.getOASAuthHeader('GET', endpoint);
      const url = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  // Get product details including pricing
  async getProductDetails(productId) {
    try {
      const endpoint = `/products/${productId}`;
      const headers = this.getOASAuthHeader('GET', endpoint);
      const url = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product details: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching product details:', error);
      throw error;
    }
  }

  // Create a print order
  async createOrder(orderData) {
    try {
      const endpoint = '/orders';
      const headers = this.getOASAuthHeader('POST', endpoint);
      const url = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create order: ${JSON.stringify(errorData)}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Upload image to Editor API
  async uploadImageToEditor(imageBuffer, filename) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('image', imageBuffer, filename);
      
      const headers = {
        ...this.getEditorAuthHeader(),
        ...form.getHeaders()
      };
      delete headers['Content-Type']; // Let form-data set this
      
      const response = await fetch(`${this.editorBaseUrl}/images`, {
        method: 'POST',
        headers,
        body: form
      });

      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading image to editor:', error);
      throw error;
    }
  }

  // Create a print project in Editor API
  async createPrintProject(projectData) {
    try {
      const headers = this.getEditorAuthHeader();
      
      const response = await fetch(`${this.editorBaseUrl}/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating print project:', error);
      throw error;
    }
  }

  // Get order status
  async getOrderStatus(orderId) {
    try {
      const endpoint = `/orders/${orderId}`;
      const headers = this.getOASAuthHeader('GET', endpoint);
      const url = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch order status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching order status:', error);
      throw error;
    }
  }

  // Calculate shipping rates
  async calculateShipping(shippingData) {
    try {
      const endpoint = '/shipping/calculate';
      const headers = this.getOASAuthHeader('POST', endpoint);
      const url = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(shippingData)
      });

      if (!response.ok) {
        throw new Error(`Failed to calculate shipping: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calculating shipping:', error);
      throw error;
    }
  }

  // Validate address
  async validateAddress(address) {
    try {
      const endpoint = '/address/validate';
      const headers = this.getOASAuthHeader('POST', endpoint);
      const url = `${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(address)
      });

      if (!response.ok) {
        throw new Error(`Failed to validate address: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error validating address:', error);
      throw error;
    }
  }
}

// Initialize and export singleton instance
const printService = new PrintServiceAPI();

// Log initialization status
if (printService.oasKey && printService.oasSecret) {
  console.log('✅ Print Service: WHCC OAS API configured');
}
if (printService.editorKeyId && printService.editorKeySecret) {
  console.log('✅ Print Service: WHCC Editor API configured');
}

module.exports = PrintServiceAPI;
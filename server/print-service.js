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
      
      // Build request body parameters for POST request (secure)
      const requestBody = new URLSearchParams({
        'grant_type': 'consumer_credentials',
        'consumer_key': this.oasKey,
        'consumer_secret': this.oasSecret
      });
      
      // Log URL without exposing any sensitive data
      console.log(`- Request URL: ${authUrl}`);
      console.log(`- Using POST method to protect consumer_secret`);
      
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: requestBody.toString()
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
          name: firstCategory.Name,
          hasProductList: !!firstCategory.ProductList,
          productCount: firstCategory.ProductList ? firstCategory.ProductList.length : 0,
          hasOrderAttributes: !!firstCategory.OrderAttributeCategoryList,
          orderAttrCount: firstCategory.OrderAttributeCategoryList ? firstCategory.OrderAttributeCategoryList.length : 0,
          keys: Object.keys(firstCategory).slice(0, 10)
        });
        
        // Check for pricing in OrderAttributeCategoryList
        if (firstCategory.OrderAttributeCategoryList && firstCategory.OrderAttributeCategoryList.length > 0) {
          console.log('📦 OrderAttributeCategory sample:', firstCategory.OrderAttributeCategoryList[0]);
        }
        
        if (firstCategory.ProductList && firstCategory.ProductList.length > 0) {
          const firstProduct = firstCategory.ProductList[0];
          console.log('📦 First product structure:', {
            name: firstProduct.Name,
            description: firstProduct.Description,
            productUID: firstProduct.ProductUID,
            hasAttributes: !!firstProduct.AttributeList,
            attributeCount: firstProduct.AttributeList ? firstProduct.AttributeList.length : 0,
            keys: Object.keys(firstProduct).slice(0, 10)
          });
          
          if (firstProduct.AttributeList && firstProduct.AttributeList.length > 0) {
            console.log('📦 First attribute:', firstProduct.AttributeList[0]);
          }
          
          // Check for other attribute fields
          if (firstProduct.AttributeCategories && firstProduct.AttributeCategories.length > 0) {
            console.log('📦 AttributeCategories:', firstProduct.AttributeCategories[0]);
          }
          
          if (firstProduct.ProductNodes && firstProduct.ProductNodes.length > 0) {
            console.log('📦 ProductNodes sample:', {
              firstNode: firstProduct.ProductNodes[0],
              nodeCount: firstProduct.ProductNodes.length
            });
          }
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
                id: `whcc_${product.ProductUID || product.Id || Math.random()}`,
                name: product.Name || product.Description || 'WHCC Product',
                description: product.Description || category.Name,
                category: category.Name?.toLowerCase().replace(/\s+/g, '_') || 'prints',
                productUID: product.ProductUID || product.Id,
                attributes: []
              };
              
              // Calculate pricing based on print dimensions (standard industry pricing)
              let price = 19.99; // Base price
              
              // Extract dimensions from product name or nodes
              if (product.ProductNodes && product.ProductNodes.length > 0) {
                const node = product.ProductNodes[0];
                const area = (node.H || 0) * (node.W || 0); // Calculate print area in square inches
                
                // Price calculation based on square inches (typical print lab pricing)
                if (area > 0) {
                  if (area <= 35) price = 4.99;        // Small prints (5x7)
                  else if (area <= 80) price = 9.99;   // Medium prints (8x10)
                  else if (area <= 154) price = 14.99; // Large prints (11x14)
                  else if (area <= 192) price = 19.99; // X-Large prints (12x16)
                  else if (area <= 320) price = 29.99; // XX-Large prints (16x20)
                  else if (area <= 480) price = 39.99; // Jumbo prints (20x24)
                  else if (area <= 720) price = 59.99; // Super prints (24x30)
                  else if (area <= 1200) price = 89.99; // Mega prints (30x40)
                  else price = 129.99; // Ultra prints (40x60+)
                }
                
                // Store dimensions
                baseProduct.dimensions = {
                  width: node.W,
                  height: node.H,
                  area: area
                };
              }
              
              // Extract display options from AttributeCategories
              if (product.AttributeCategories && Array.isArray(product.AttributeCategories)) {
                product.AttributeCategories.forEach(attrCat => {
                  if (attrCat.Attributes && Array.isArray(attrCat.Attributes)) {
                    attrCat.Attributes.forEach(attr => {
                      baseProduct.attributes.push({
                        id: attr.Id,
                        name: attr.AttributeName,
                        category: attrCat.AttributeCategoryName,
                        sortOrder: attr.SortOrder
                      });
                    });
                  }
                });
              }
              
              baseProduct.price = price;
              
              products.push(baseProduct);
            });
          }
        });
      }
      
      // If we got products, return them, otherwise use fallback
      if (products.length > 0) {
        console.log(`✅ Transformed ${products.length} WHCC products from catalog`);
        return products; // Return ALL products from WHCC catalog
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

  // Create a print order in WHCC system
  async createOrder(orderData) {
    try {
      const token = await this.getWHCCAccessToken();
      
      // Format order for WHCC OrderImport API
      const whccOrder = {
        Reference: orderData.orderId, // Our internal order ID
        ClientInfo: {
          FirstName: orderData.customer.firstName,
          LastName: orderData.customer.lastName,
          Email: orderData.customer.email,
          Phone: orderData.customer.phone || '',
          Address1: orderData.shipping.address1,
          Address2: orderData.shipping.address2 || '',
          City: orderData.shipping.city,
          State: orderData.shipping.state,
          Zip: orderData.shipping.zip,
          Country: orderData.shipping.country || 'US'
        },
        Items: orderData.items.map(item => ({
          ProductUID: item.productUID,
          Quantity: item.quantity,
          LayoutUID: 0, // Default layout
          Attributes: item.attributes || [],
          Assets: [{
            AssetPath: item.imageUrl,
            PrintedFileName: item.fileName || 'print.jpg',
            ImageHash: item.imageHash || '',
            DP2NodeID: item.nodeId || 10000
          }]
        })),
        ShippingMethod: orderData.shippingMethod || 'Standard',
        PaymentMethod: 'Prepaid', // We handle payment via Stripe
        Comments: orderData.comments || ''
      };
      
      console.log('📦 Creating WHCC order:', {
        reference: whccOrder.Reference,
        itemCount: whccOrder.Items.length
      });
      
      const response = await fetch(`${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}/api/OrderImport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(whccOrder)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ WHCC order creation failed:', errorText);
        throw new Error(`Failed to create order: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ WHCC order created:', result);
      
      return {
        success: true,
        orderId: result.OrderID,
        reference: result.Reference,
        status: result.Status,
        confirmationUrl: result.ConfirmationUrl,
        estimatedShipping: result.EstimatedShipDate,
        total: result.Total
      };
      
    } catch (error) {
      console.error('❌ Error creating WHCC order:', error);
      throw error;
    }
  }
  
  // Submit order for production
  async submitOrder(whccOrderId) {
    try {
      const token = await this.getWHCCAccessToken();
      
      console.log('🚀 Submitting WHCC order for production:', whccOrderId);
      
      const response = await fetch(`${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}/api/OrderImport/Submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          OrderID: whccOrderId,
          ConfirmProduction: true
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ WHCC order submission failed:', errorText);
        throw new Error(`Failed to submit order: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ WHCC order submitted for production:', result);
      
      return {
        success: true,
        orderId: result.OrderID,
        status: result.Status,
        productionDate: result.ProductionDate,
        trackingNumber: result.TrackingNumber
      };
      
    } catch (error) {
      console.error('❌ Error submitting WHCC order:', error);
      throw error;
    }
  }
  
  // Get order status from WHCC
  async getOrderStatus(whccOrderId) {
    try {
      const token = await this.getWHCCAccessToken();
      
      const response = await fetch(`${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}/api/Orders/${whccOrderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get order status: ${response.status}`);
      }
      
      const order = await response.json();
      
      return {
        success: true,
        orderId: order.OrderID,
        status: order.Status,
        trackingNumber: order.TrackingNumber,
        shipDate: order.ShipDate,
        items: order.Items
      };
      
    } catch (error) {
      console.error('❌ Error getting WHCC order status:', error);
      throw error;
    }
  }
  
  // Register webhook for order status updates
  async registerWebhook(webhookUrl) {
    try {
      const token = await this.getWHCCAccessToken();
      
      const response = await fetch(`${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}/api/Webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Url: webhookUrl,
          Events: [
            'order.created',
            'order.submitted',
            'order.accepted',
            'order.rejected',
            'order.shipped',
            'order.cancelled'
          ],
          Active: true
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Webhook registration failed:', errorText);
        throw new Error(`Failed to register webhook: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Webhook registered:', result);
      
      return {
        success: true,
        webhookId: result.WebhookID,
        url: result.Url
      };
      
    } catch (error) {
      console.error('❌ Error registering webhook:', error);
      throw error;
    }
  }
  
  // Calculate shipping costs
  async calculateShipping(orderData) {
    try {
      const token = await this.getWHCCAccessToken();
      
      const response = await fetch(`${this.isSandbox ? this.sandboxUrl : this.oasBaseUrl}/api/Shipping/Calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Items: orderData.items.map(item => ({
            ProductUID: item.productUID,
            Quantity: item.quantity
          })),
          ShipTo: {
            City: orderData.shipping.city,
            State: orderData.shipping.state,
            Zip: orderData.shipping.zip,
            Country: orderData.shipping.country || 'US'
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to calculate shipping: ${response.status}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        methods: result.ShippingMethods || []
      };
      
    } catch (error) {
      console.error('❌ Error calculating shipping:', error);
      // Return default shipping options if API fails
      return {
        success: false,
        methods: [
          { name: 'Standard', cost: 9.99, days: '5-7' },
          { name: 'Express', cost: 19.99, days: '2-3' },
          { name: 'Overnight', cost: 39.99, days: '1' }
        ]
      };
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
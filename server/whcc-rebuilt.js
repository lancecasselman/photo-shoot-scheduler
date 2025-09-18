const crypto = require('crypto');
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));

/**
 * WHCC Print Service API - Completely Rebuilt
 * Based on uploaded PHP specification examples
 * 
 * Proper WHCC Order Submit API Flow:
 * 1. getAccessToken() - Get bearer token
 * 2. importOrder() - Import order data, get ConfirmationID  
 * 3. submitOrder() - Submit for production using ConfirmationID
 * 4. getOrder() - Check order status
 */
class WHCCPrintService {
  constructor() {
    // WHCC API Credentials
    this.oasKey = process.env.OAS_CONSUMER_KEY;
    this.oasSecret = process.env.OAS_CONSUMER_SECRET;
    this.editorKeyId = process.env.EDITOR_API_KEY_ID;
    this.editorKeySecret = process.env.EDITOR_API_KEY_SECRET;
    
    // Environment Configuration
    this.isSandbox = process.env.WHCC_ENV !== 'production';
    this.baseUrl = this.isSandbox 
      ? 'https://sandbox.apps.whcc.com' 
      : 'https://apps.whcc.com';
    
    // WHCC API Endpoints (following PHP Config pattern)
    this.endpoints = {
      token: '/api/AccessToken',
      orderImport: '/api/OrderImport',
      orderSubmit: '/api/OrderImport/Submit', 
      orderGet: '/api/Orders',
      catalog: '/api/catalog'
    };
    
    console.log(`🏭 WHCC Service: ${this.isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);
    console.log(`🔧 Base URL: ${this.baseUrl}`);
    console.log(`🔑 Credentials: ${this.oasKey ? 'OAS ✓' : 'OAS ✗'} | ${this.editorKeyId ? 'Editor ✓' : 'Editor ✗'}`);
  }

  /**
   * Step 1: Get Access Token
   * Following WHCC Order Submit API specification
   */
  async getAccessToken() {
    try {
      console.log('🔐 WHCC: Getting access token...');
      
      const url = `${this.baseUrl}${this.endpoints.token}`;
      
      // Use form data for token request (per WHCC spec)
      const params = new URLSearchParams({
        grant_type: 'consumer_credentials',
        consumer_key: this.oasKey,
        consumer_secret: this.oasSecret
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Check for WHCC error response (they return 200 with error)
      if (data.ErrorNumber || data.error) {
        throw new Error(`WHCC Auth Error: ${data.Message || data.error_description || 'Unknown error'}`);
      }
      
      if (!data.Token) {
        throw new Error('No token received from WHCC');
      }
      
      console.log('✅ WHCC: Access token obtained');
      return data.Token;
      
    } catch (error) {
      console.error('❌ WHCC: Token error:', error.message);
      throw new Error(`Failed to authenticate with WHCC: ${error.message}`);
    }
  }

  /**
   * Step 2: Import Order
   * This is the missing piece! Creates order and returns ConfirmationID
   */
  async importOrder(token, orderPayload) {
    try {
      console.log('📦 WHCC: Importing order...');
      
      const url = `${this.baseUrl}${this.endpoints.orderImport}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Order import failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      // Check for WHCC error response
      if (result.ErrorNumber || result.error) {
        throw new Error(`WHCC Import Error: ${result.Message || result.error_description || 'Unknown error'}`);
      }
      
      if (!result.ConfirmationID) {
        throw new Error('No ConfirmationID received from order import');
      }
      
      console.log('✅ WHCC: Order imported, ConfirmationID:', result.ConfirmationID);
      return result.ConfirmationID;
      
    } catch (error) {
      console.error('❌ WHCC: Import error:', error.message);
      throw new Error(`Failed to import order to WHCC: ${error.message}`);
    }
  }

  /**
   * Step 3: Submit Order for Production
   * Uses ConfirmationID from import step
   */
  async submitOrder(token, confirmationId) {
    try {
      console.log('🚀 WHCC: Submitting order for production...');
      
      const url = `${this.baseUrl}${this.endpoints.orderSubmit}`;
      
      const submitPayload = {
        ConfirmationID: confirmationId,
        ConfirmProduction: true
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(submitPayload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Order submission failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      // Check for WHCC error response
      if (result.ErrorNumber || result.error) {
        throw new Error(`WHCC Submit Error: ${result.Message || result.error_description || 'Unknown error'}`);
      }
      
      console.log('✅ WHCC: Order submitted for production');
      return result;
      
    } catch (error) {
      console.error('❌ WHCC: Submit error:', error.message);
      throw new Error(`Failed to submit order to WHCC: ${error.message}`);
    }
  }

  /**
   * Step 4: Get Order Status
   * Track order progress
   */
  async getOrder(token, confirmationId) {
    try {
      console.log('📋 WHCC: Getting order status...');
      
      const url = `${this.baseUrl}${this.endpoints.orderGet}/${confirmationId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Order status request failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      console.log('✅ WHCC: Order status retrieved');
      return result;
      
    } catch (error) {
      console.error('❌ WHCC: Status error:', error.message);
      throw new Error(`Failed to get order status from WHCC: ${error.message}`);
    }
  }

  /**
   * Payload Builder - Creates WHCC order payloads
   * Based on PayloadBuilder pattern from PHP specs
   */
  buildOrderPayload(orderType, orderData) {
    const basePayload = {
      EntryId: orderData.orderId || `order_${Date.now()}`,
      Orders: [{
        SequenceNumber: 1,
        Instructions: orderData.instructions || '',
        Reference: orderData.reference || `Order ${orderData.orderId}`,
        SendNotificationEmailAddress: orderData.customer?.email || null,
        SendNotificationEmailToAccount: true,
        
        // Ship To Address
        ShipToAddress: {
          Name: `${orderData.customer?.firstName || ''} ${orderData.customer?.lastName || ''}`.trim(),
          Attn: orderData.shipping?.attention || null,
          Addr1: orderData.shipping?.address1 || '',
          Addr2: orderData.shipping?.address2 || null,
          City: orderData.shipping?.city || '',
          State: orderData.shipping?.state || '',
          Zip: orderData.shipping?.zip || '',
          Country: orderData.shipping?.country || 'US',
          Phone: orderData.customer?.phone || ''
        },
        
        // Ship From Address (photographer/studio)
        ShipFromAddress: {
          Name: orderData.studio?.name || 'Photography Studio',
          Addr1: orderData.studio?.address1 || '',
          Addr2: orderData.studio?.address2 || null,
          City: orderData.studio?.city || '',
          State: orderData.studio?.state || '',
          Zip: orderData.studio?.zip || '',
          Country: orderData.studio?.country || 'US',
          Phone: orderData.studio?.phone || ''
        },
        
        OrderAttributes: orderData.orderAttributes || [],
        OrderItems: this.buildOrderItems(orderData.items || [])
      }]
    };
    
    return basePayload;
  }

  /**
   * Build Order Items for different product types
   */
  buildOrderItems(items) {
    return items.map(item => ({
      ProductUID: item.productUID,
      Quantity: item.quantity || 1,
      
      // Item Assets (images)
      ItemAssets: [{
        ProductNodeID: item.productNodeUID,
        AssetPath: item.imageUrl,
        ImageHash: item.imageHash || '',
        PrintedFileName: item.fileName || 'print.jpg',
        AutoRotate: item.autoRotate !== false,
        AssetEnhancement: item.enhancement || null
      }],
      
      // Item Attributes (size, paper, etc.)
      ItemAttributes: (item.attributes || []).map(attr => ({
        AttributeUID: attr.id || attr.AttributeUID || attr
      })),
      
      // Editor Project UID (if customized)
      ...(item.editorProjectUID && { EditorProjectUID: item.editorProjectUID })
    }));
  }

  /**
   * Complete WHCC Order Flow - All steps combined
   * This is what external code should call
   */
  async processOrder(orderData) {
    try {
      console.log('🏭 WHCC: Starting complete order process...');
      
      // Step 1: Get token
      const token = await this.getAccessToken();
      
      // Step 2: Build payload and import order
      const payload = this.buildOrderPayload('standard', orderData);
      const confirmationId = await this.importOrder(token, payload);
      
      // Step 3: Submit for production
      const submitResult = await this.submitOrder(token, confirmationId);
      
      // Step 4: Get final status
      const orderStatus = await this.getOrder(token, confirmationId);
      
      console.log('✅ WHCC: Order process completed successfully');
      
      return {
        success: true,
        confirmationId,
        whccOrderId: submitResult.OrderID,
        status: orderStatus.Status || 'Submitted',
        trackingNumber: orderStatus.TrackingNumber || null
      };
      
    } catch (error) {
      console.error('❌ WHCC: Order process failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        details: 'WHCC order processing failed. Please try again or contact support.'
      };
    }
  }

  /**
   * Get WHCC Product Catalog
   */
  async getCatalog() {
    try {
      const token = await this.getAccessToken();
      
      const url = `${this.baseUrl}${this.endpoints.catalog}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Catalog request failed: ${response.status}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.error('❌ WHCC: Catalog error:', error.message);
      throw error;
    }
  }

  /**
   * Webhook Signature Verification
   * For WHCC webhook security (required by existing code)
   */
  verifyWhccSignature(payload, signature, secret) {
    try {
      if (!signature || !secret) {
        console.log('❌ WHCC Webhook: Missing signature or secret');
        return false;
      }
      
      // Generate expected signature using HMAC-SHA256
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
      
      // Compare signatures (constant-time comparison using crypto.timingSafeEqual)
      const providedBuffer = Buffer.from(signature.toLowerCase(), 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      if (providedBuffer.length !== expectedBuffer.length) {
        return false;
      }
      
      const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer);
      console.log(`🔐 WHCC Webhook signature ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
      
    } catch (error) {
      console.error('❌ WHCC Webhook verification error:', error.message);
      return false;
    }
  }

  /**
   * Compatibility method for getProducts() - delegates to getCatalog()
   * Maintains compatibility with existing code
   */
  async getProducts() {
    try {
      const catalog = await this.getCatalog();
      
      // Transform catalog to match expected product format
      if (!catalog || !catalog.Categories) {
        return [];
      }
      
      const products = [];
      catalog.Categories.forEach(category => {
        const productList = category.ProductList || [];
        productList.forEach(product => {
          const baseProduct = {
            id: `whcc_${product.Id}`,
            name: product.Name || category.Name,
            description: product.Description || `Professional ${category.Name}`,
            category: this.normalizeProductCategory(product.Name, category.Name),
            productUID: product.Id,
            sizes: []
          };
          
          // Process ProductNodes into proper size objects
          if (product.ProductNodes && product.ProductNodes.length > 0) {
            console.log(`📏 Processing ${product.ProductNodes.length} size options for ${baseProduct.name}`);
            
            product.ProductNodes.forEach(node => {
              const width = node.W || 0;
              const height = node.H || 0;
              const area = width * height;
              
              // Calculate price based on product type and size
              let price = this.calculateProductPrice(baseProduct.category, width, height, node.Price);
              
              const sizeOption = {
                uid: node.UID || `${width}x${height}`,
                label: `${width}" x ${height}"`,
                width: width,
                height: height,
                area: area,
                price: price,
                productNodeUID: node.UID
              };
              
              baseProduct.sizes.push(sizeOption);
            });
            
            // Sort sizes by area (smallest to largest)
            baseProduct.sizes.sort((a, b) => a.area - b.area);
            
            console.log(`✅ Extracted ${baseProduct.sizes.length} sizes: ${baseProduct.sizes.map(s => s.label).join(', ')}`);
            products.push(baseProduct);
          } else {
            console.log(`⚠️ No ProductNodes found for ${baseProduct.name}, no sizes available`);
            // Still add the product but with empty sizes array
            products.push(baseProduct);
          }
        });
      });
      
      return products;
      
    } catch (error) {
      console.error('❌ WHCC: Products error:', error.message);
      return [];
    }
  }

  /**
   * Normalize product category names for consistent handling
   */
  normalizeProductCategory(productName, categoryName) {
    const name = (productName || categoryName || '').toLowerCase();
    
    if (name.includes('album')) return 'albums';
    if (name.includes('book')) return 'books';
    if (name.includes('metal')) return 'metal_prints';
    if (name.includes('canvas')) return 'canvas_prints';
    if (name.includes('card')) return 'cards';
    if (name.includes('print')) return 'photographic_prints';
    
    return categoryName ? categoryName.toLowerCase().replace(/\s+/g, '_') : 'other';
  }

  /**
   * Calculate product pricing based on category and size
   */
  calculateProductPrice(category, width, height, nodePrice) {
    // Use node price if available
    if (nodePrice && nodePrice > 0) {
      return nodePrice;
    }
    
    const area = width * height;
    let price = 19.99; // Base price
    
    switch (category) {
      case 'albums':
        if (width <= 8 && height <= 8) price = 149.99;      // Small albums (8x8)
        else if (width <= 10 && height <= 10) price = 199.99; // Medium albums (10x10)
        else if (width <= 11 && height <= 14) price = 249.99; // Large albums (11x14)
        else if (width <= 12 && height <= 12) price = 299.99; // X-Large albums (12x12)
        else price = 349.99; // Premium albums
        break;
        
      case 'books':
        price = 99.99; // Base price for books
        if (width <= 8 && height <= 10) price = 89.99;
        else if (width >= 11) price = 129.99;
        break;
        
      case 'metal_prints':
        if (area <= 80) price = 59.99;       // Small metal (8x10)
        else if (area <= 154) price = 89.99; // Medium metal (11x14)
        else if (area <= 320) price = 129.99; // Large metal (16x20)
        else if (area <= 480) price = 179.99; // X-Large metal (20x24)
        else if (area <= 720) price = 249.99; // XX-Large metal (24x30)
        else price = 379.99; // Ultra metal
        break;
        
      case 'canvas_prints':
        if (area <= 80) price = 49.99;       // Small canvas (8x10)
        else if (area <= 154) price = 69.99; // Medium canvas (11x14)
        else if (area <= 320) price = 99.99; // Large canvas (16x20)
        else if (area <= 480) price = 149.99; // X-Large canvas (20x24)
        else price = 199.99; // Premium canvas
        break;
        
      default:
        // Standard print pricing based on area
        if (area > 0) {
          if (area <= 35) price = 4.99;        // Small prints (5x7)
          else if (area <= 80) price = 9.99;   // Medium prints (8x10)
          else if (area <= 154) price = 14.99; // Large prints (11x14)
          else if (area <= 192) price = 19.99; // X-Large prints (12x16)
          else if (area <= 320) price = 29.99; // XX-Large prints (16x20)
          else price = 39.99; // Ultra prints
        }
    }
    
    return price;
  }
}

module.exports = WHCCPrintService;
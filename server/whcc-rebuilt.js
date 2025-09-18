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
          products.push({
            id: `whcc_${product.Id}`,
            name: product.Name || category.Name,
            description: product.Description || `Professional ${category.Name}`,
            category: category.Name.toLowerCase(),
            productUID: product.Id,
            sizes: product.ProductNodes || []
          });
        });
      });
      
      return products;
      
    } catch (error) {
      console.error('❌ WHCC: Products error:', error.message);
      return [];
    }
  }
}

module.exports = WHCCPrintService;
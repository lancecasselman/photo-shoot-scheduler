const crypto = require('crypto');
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const { eq } = require('drizzle-orm');
const { whccOrders } = require('../shared/schema');

/**
 * WHCC Core Service - Editor-Driven Ordering
 * Handles order submission, status tracking, asset management, and webhooks
 */
class WHCCCoreService {
  constructor() {
    // WHCC API Credentials from OAS secrets
    this.oasKey = process.env.OAS_CONSUMER_KEY;
    this.oasSecret = process.env.OAS_CONSUMER_SECRET;
    
    // Environment Configuration
    this.isSandbox = process.env.WHCC_ENV !== 'production';
    this.baseUrl = this.isSandbox 
      ? 'https://sandbox.apps.whcc.com' 
      : 'https://apps.whcc.com';
    
    // WHCC API Endpoints
    this.endpoints = {
      token: '/api/AccessToken',
      orderImport: '/api/OrderImport',
      orderSubmit: '/api/OrderImport/Submit', 
      orderGet: '/api/Orders',
      catalog: '/api/catalog'
    };

    // Database connection
    this.db = null;
    this.initializeDatabase();

    console.log(`🏭 WHCC Core Service: ${this.isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);
    console.log(`🔧 Base URL: ${this.baseUrl}`);
    console.log(`🔑 Credentials: ${this.oasKey ? 'OAS ✓' : 'OAS ✗'}`);
  }

  /**
   * Initialize database connection
   */
  initializeDatabase() {
    try {
      if (!process.env.DATABASE_URL) {
        console.warn('⚠️ WHCC Core: DATABASE_URL not found');
        return;
      }
      
      const sql = neon(process.env.DATABASE_URL);
      this.db = drizzle(sql);
      console.log('✅ WHCC Core: Database connection initialized');
    } catch (error) {
      console.error('❌ WHCC Core: Database initialization failed:', error.message);
    }
  }

  /**
   * Get OAS Access Token
   */
  async getAccessToken() {
    try {
      console.log('🔐 WHCC Core: Getting access token...');
      
      const url = `${this.baseUrl}${this.endpoints.token}`;
      
      const params = new URLSearchParams({
        grant_type: 'consumer_credentials',
        consumer_key: this.oasKey,
        consumer_secret: this.oasSecret
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString(),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.ErrorNumber || data.error) {
        throw new Error(`WHCC Auth Error: ${data.Message || data.error_description || 'Unknown error'}`);
      }
      
      if (!data.Token) {
        throw new Error('No token received from WHCC');
      }
      
      console.log('✅ WHCC Core: Access token obtained');
      return data.Token;
      
    } catch (error) {
      console.error('❌ WHCC Core: Token error:', error.message);
      throw new Error(`Failed to authenticate with WHCC: ${error.message}`);
    }
  }

  /**
   * Import Order - Creates order and returns ConfirmationID
   */
  async importOrder(token, orderPayload) {
    try {
      console.log('📦 WHCC Core: Importing order...');
      
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
      
      if (result.ErrorNumber || result.error) {
        throw new Error(`WHCC Import Error: ${result.Message || result.error_description || 'Unknown error'}`);
      }
      
      if (!result.ConfirmationID) {
        throw new Error('No ConfirmationID received from order import');
      }
      
      console.log('✅ WHCC Core: Order imported, ConfirmationID:', result.ConfirmationID);
      return result.ConfirmationID;
      
    } catch (error) {
      console.error('❌ WHCC Core: Import error:', error.message);
      throw new Error(`Failed to import order to WHCC: ${error.message}`);
    }
  }

  /**
   * Submit Order for Production
   */
  async submitOrder(token, confirmationId) {
    try {
      console.log('🚀 WHCC Core: Submitting order for production...');
      
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
      
      if (result.ErrorNumber || result.error) {
        throw new Error(`WHCC Submit Error: ${result.Message || result.error_description || 'Unknown error'}`);
      }
      
      console.log('✅ WHCC Core: Order submitted for production');
      return result;
      
    } catch (error) {
      console.error('❌ WHCC Core: Submit error:', error.message);
      throw new Error(`Failed to submit order to WHCC: ${error.message}`);
    }
  }

  /**
   * Get Order Status
   */
  async getOrder(token, confirmationId) {
    try {
      console.log('📋 WHCC Core: Getting order status...');
      
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
      
      console.log('✅ WHCC Core: Order status retrieved');
      return result;
      
    } catch (error) {
      console.error('❌ WHCC Core: Status error:', error.message);
      throw new Error(`Failed to get order status from WHCC: ${error.message}`);
    }
  }

  /**
   * Build Order Payload for Editor-Driven Orders
   * Takes editor selections and creates WHCC-compliant order payload
   */
  buildOrderPayload(editorOrderData) {
    try {
      console.log('🏗️ WHCC Core: Building order payload from editor data');

      const {
        orderId,
        customer,
        shipping,
        items,
        studio,
        instructions = '',
        reference = `Editor Order ${orderId}`
      } = editorOrderData;

      // Validate required data
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('No items provided for order');
      }

      if (!customer || !customer.email) {
        throw new Error('Customer information is required');
      }

      if (!shipping || !shipping.address1) {
        throw new Error('Shipping address is required');
      }

      const basePayload = {
        EntryId: orderId || `editor_order_${Date.now()}`,
        Orders: [{
          SequenceNumber: 1,
          Instructions: instructions,
          Reference: reference,
          SendNotificationEmailAddress: customer.email,
          SendNotificationEmailToAccount: true,
          
          // Ship To Address (customer)
          ShipToAddress: {
            Name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            Attn: shipping.attention || null,
            Addr1: shipping.address1,
            Addr2: shipping.address2 || null,
            City: shipping.city,
            State: shipping.state,
            Zip: shipping.zip,
            Country: shipping.country || 'US',
            Phone: customer.phone || ''
          },
          
          // Ship From Address (photographer/studio)
          ShipFromAddress: {
            Name: studio?.name || 'Photography Studio',
            Addr1: studio?.address1 || '',
            Addr2: studio?.address2 || null,
            City: studio?.city || '',
            State: studio?.state || '',
            Zip: studio?.zip || '',
            Country: studio?.country || 'US',
            Phone: studio?.phone || ''
          },
          
          // Shipping method (use real WHCC ShipMethodUID)
          ShipMethodUID: shipping.methodUID || null,
          
          // Order items with editor configurations
          OrderItems: this.buildOrderItems(items)
        }]
      };
      
      console.log('✅ WHCC Core: Order payload built successfully');
      return basePayload;

    } catch (error) {
      console.error('❌ WHCC Core: Payload build error:', error.message);
      throw new Error(`Failed to build order payload: ${error.message}`);
    }
  }

  /**
   * Build Order Items from Editor Selections
   */
  buildOrderItems(items) {
    return items.map((item, index) => {
      // Validate required item data
      if (!item.productUID) {
        throw new Error(`Item ${index + 1}: ProductUID is required`);
      }

      if (!item.imageUrl) {
        throw new Error(`Item ${index + 1}: Image URL is required`);
      }

      if (!item.productNodeUID) {
        throw new Error(`Item ${index + 1}: ProductNodeUID is required for size selection`);
      }
      
      if (!item.attributeSelections || item.attributeSelections.length === 0) {
        console.warn(`Item ${index + 1}: No AttributeUID/OptionUID selections provided - order may fail WHCC validation`);
      }

      return {
        ProductUID: item.productUID,
        ProductNodeUID: item.productNodeUID,
        Quantity: item.quantity || 1,
        
        // Item Assets (images with crop data from editor)
        ItemAssets: [{
          AssetPath: item.imageUrl, // R2 signed URL 
          ImageHash: item.imageHash || '',
          PrintedFileName: item.fileName || 'print.jpg',
          AutoRotate: item.autoRotate !== false,
          
          // Editor crop data
          ...(item.cropData && {
            CropLeft: item.cropData.left || 0,
            CropTop: item.cropData.top || 0,
            CropWidth: item.cropData.width || 1,
            CropHeight: item.cropData.height || 1
          })
        }],
        
        // Item Attributes (size, paper, finish, etc. from editor)
        // WHCC requires AttributeUID and OptionUID pairs
        ItemAttributes: (item.attributeSelections || []).map(selection => ({
          AttributeUID: selection.attributeUID,
          OptionUID: selection.optionUID
        })),
        
        // Editor Project UID if customized
        ...(item.editorProjectUID && { EditorProjectUID: item.editorProjectUID })
      };
    });
  }

  /**
   * Create Signed R2 URL for WHCC Asset Access
   */
  async createSignedImageURL(imageKey, expiresIn = 3600) {
    try {
      console.log('📸 WHCC Core: Creating signed R2 URL for asset access...');
      
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        endpoint: process.env.R2_ENDPOINT,
        region: 'auto',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'photoappr2token',
        Key: imageKey,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: expiresIn 
      });

      console.log('✅ WHCC Core: Signed R2 URL created for WHCC access');
      return signedUrl;

    } catch (error) {
      console.error('❌ WHCC Core: Failed to create signed R2 URL:', error.message);
      throw new Error(`Failed to create signed asset URL: ${error.message}`);
    }
  }

  /**
   * Webhook Signature Verification using OAS_CONSUMER_SECRET
   */
  verifyWebhookSignature(payload, signature, secret = null) {
    try {
      const webhookSecret = secret || process.env.OAS_CONSUMER_SECRET;
      
      if (!signature || !webhookSecret) {
        console.log('❌ WHCC Webhook: Missing signature or secret');
        return false;
      }
      
      // Generate expected signature using HMAC-SHA256
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');
      
      // Compare signatures securely
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
   * Complete WHCC Order Flow - Editor to Production
   * This is the main method the API routes will call
   */
  async processEditorOrder(editorOrderData) {
    try {
      console.log('🎯 WHCC Core: Starting editor-driven order process...');
      
      // Step 1: Get token
      const token = await this.getAccessToken();
      
      // Step 1.5: Process images to create R2 signed URLs for WHCC access
      const processedOrderData = await this.processOrderImages(editorOrderData);
      
      // Step 2: Build payload from editor data with signed URLs
      const payload = this.buildOrderPayload(processedOrderData);
      
      // Step 3: Import order to get ConfirmationID
      const confirmationId = await this.importOrder(token, payload);
      
      // Step 4: Submit for production
      const submitResult = await this.submitOrder(token, confirmationId);
      
      // Step 5: Get initial status
      const orderStatus = await this.getOrder(token, confirmationId);
      
      // Step 6: Save order to database for tracking
      const savedOrder = await this.saveOrderToDatabase(editorOrderData, confirmationId, submitResult.OrderID, orderStatus);
      
      console.log('✅ WHCC Core: Editor order process completed successfully');
      
      return {
        success: true,
        confirmationId,
        whccOrderId: submitResult.OrderID,
        status: orderStatus.Status || 'Submitted',
        trackingNumber: orderStatus.TrackingNumber || null,
        orderReference: editorOrderData.reference || `Editor Order ${editorOrderData.orderId}`,
        databaseOrderId: savedOrder?.id || null
      };
      
    } catch (error) {
      console.error('❌ WHCC Core: Editor order process failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        details: 'WHCC order processing failed. Please check your product selections and try again.'
      };
    }
  }

  /**
   * Process R2 Image for WHCC Order
   * Converts local R2 image to WHCC-accessible signed URL
   */
  async processImageForOrder(r2ImagePath) {
    try {
      console.log('🖼️ WHCC Core: Processing image for order...');
      
      // Extract R2 key from the image path
      let r2Key = r2ImagePath;
      if (r2ImagePath.startsWith('/r2/file/')) {
        r2Key = r2ImagePath.replace('/r2/file/', '');
      }
      
      // Create signed URL that WHCC can access
      const signedUrl = await this.createSignedImageURL(r2Key, 24 * 60 * 60); // 24 hour expiry
      
      console.log('✅ WHCC Core: Image processed for order');
      return signedUrl;
      
    } catch (error) {
      console.error('❌ WHCC Core: Image processing failed:', error.message);
      throw new Error(`Failed to process image for order: ${error.message}`);
    }
  }
  
  /**
   * Process Order Images - Convert R2 paths to signed URLs for WHCC
   */
  async processOrderImages(editorOrderData) {
    try {
      console.log('🖼️ WHCC Core: Processing order images for WHCC access...');
      
      const processedData = { ...editorOrderData };
      
      // Process each item's image
      if (processedData.items && processedData.items.length > 0) {
        for (let i = 0; i < processedData.items.length; i++) {
          const item = processedData.items[i];
          
          if (item.imageUrl) {
            // Convert R2 path to signed URL for WHCC access
            const signedUrl = await this.processImageForOrder(item.imageUrl);
            processedData.items[i] = {
              ...item,
              imageUrl: signedUrl
            };
          }
        }
      }
      
      console.log('✅ WHCC Core: All order images processed');
      return processedData;
      
    } catch (error) {
      console.error('❌ WHCC Core: Image processing failed:', error.message);
      throw new Error(`Failed to process order images: ${error.message}`);
    }
  }

  /**
   * Update Order Status from WHCC Webhook
   * Updates order status and timestamps in database based on webhook events
   */
  async updateOrderStatus(webhookData) {
    try {
      console.log('📋 WHCC Core: Updating order status from webhook...');
      
      if (!this.db) {
        console.warn('⚠️ WHCC Core: Database not initialized, cannot update order status');
        return { success: false, error: 'Database not available' };
      }

      const { confirmationId, status, type } = webhookData;
      
      if (!confirmationId) {
        console.error('❌ WHCC Core: Missing confirmationId in webhook data');
        return { success: false, error: 'Missing confirmation ID' };
      }

      console.log(`🔍 WHCC Core: Looking for order with confirmationId: ${confirmationId}`);
      
      // Find order by WHCC confirmation ID
      const existingOrders = await this.db
        .select()
        .from(whccOrders)
        .where(eq(whccOrders.confirmationId, confirmationId));

      if (existingOrders.length === 0) {
        console.warn(`⚠️ WHCC Core: No order found with confirmationId: ${confirmationId}`);
        return { success: false, error: 'Order not found' };
      }

      const order = existingOrders[0];
      console.log(`📦 WHCC Core: Found order ${order.id} for confirmationId: ${confirmationId}`);

      // Prepare webhook event for logging
      const webhookEvent = {
        type: type || 'unknown',
        status: status || 'unknown',
        confirmationId,
        receivedAt: new Date().toISOString()
      };

      // Prepare update data using existing schema fields
      const updateData = {
        whccStatus: status || 'unknown', // Update WHCC status field
        webhookEvents: [...(order.webhookEvents || []), webhookEvent], // Append to webhook events log
        updatedAt: new Date()
      };

      // Update order status in database with confirmation
      const updateResult = await this.db
        .update(whccOrders)
        .set(updateData)
        .where(eq(whccOrders.id, order.id))
        .returning({ id: whccOrders.id, whccStatus: whccOrders.whccStatus });

      // Verify row was actually updated
      if (!updateResult || updateResult.length === 0) {
        console.warn(`⚠️ WHCC Core: No rows updated for order ${order.id}`);
        return { success: false, error: 'Failed to update order status' };
      }

      console.log(`✅ WHCC Core: Order ${order.id} status updated to: ${status}`);
      
      return {
        success: true,
        orderId: order.id,
        confirmationId,
        oldStatus: order.status,
        newStatus: status,
        webhookType: type
      };
      
    } catch (error) {
      console.error('❌ WHCC Core: Order status update failed:', error.message);
      return { 
        success: false, 
        error: error.message,
        confirmationId: webhookData?.confirmationId
      };
    }
  }

  /**
   * Save Order to Database for Tracking
   * Saves order data to whcc_orders table for status tracking and management
   */
  async saveOrderToDatabase(editorOrderData, confirmationId, whccOrderId, orderStatus) {
    try {
      console.log('💾 WHCC Core: Saving order to database...');
      
      if (!this.db) {
        console.warn('⚠️ WHCC Core: Database not initialized, cannot save order');
        return null;
      }

      const { v4: uuidv4 } = require('uuid');
      const orderId = uuidv4();

      // Prepare order data for database
      const orderData = {
        id: orderId,
        userId: editorOrderData.userId || null,
        sessionId: editorOrderData.sessionId || null,
        galleryToken: editorOrderData.galleryToken || null,
        
        // WHCC Integration Fields
        confirmationId: confirmationId,
        whccOrderId: whccOrderId,
        whccStatus: orderStatus.Status || 'submitted',
        
        // Order Details
        orderId: editorOrderData.orderId || orderId,
        orderReference: editorOrderData.reference || `WHCC-${confirmationId}`,
        instructions: editorOrderData.instructions || '',
        
        // Customer Information
        customerInfo: editorOrderData.customerInfo,
        shippingAddress: editorOrderData.shippingAddress,
        studioAddress: editorOrderData.studioAddress || null,
        
        // Pricing
        subtotal: editorOrderData.subtotal || '0.00',
        shippingCost: editorOrderData.shippingCost || '0.00',
        tax: editorOrderData.tax || '0.00',
        total: editorOrderData.total || '0.00',
        
        // Status Tracking
        orderStatus: 'submitted',
        paymentStatus: 'pending',
        
        // WHCC Tracking
        trackingNumber: orderStatus.TrackingNumber || null,
        shippingMethodUID: editorOrderData.shippingMethodUID || null,
        
        // Processing Dates
        importedAt: new Date(),
        submittedAt: new Date(),
        
        // Metadata
        source: 'editor',
        metadata: { 
          originalOrderData: editorOrderData,
          whccResponse: orderStatus
        },
        webhookEvents: [], // Initialize empty webhook events array
        
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert order into database
      const [savedOrder] = await this.db
        .insert(whccOrders)
        .values(orderData)
        .returning({ id: whccOrders.id, confirmationId: whccOrders.confirmationId });

      console.log(`✅ WHCC Core: Order saved to database with ID ${savedOrder.id}`);
      return savedOrder;
      
    } catch (error) {
      console.error('❌ WHCC Core: Failed to save order to database:', error.message);
      return null;
    }
  }

  /**
   * Verify WHCC Webhook Signature
   * Validates webhook authenticity using WHCC webhook secret
   */
  verifyWebhookSignature(payload, signature, secret) {
    try {
      if (!secret) {
        console.error('❌ WHCC Core: Webhook secret not configured');
        return false;
      }

      if (!signature) {
        console.error('❌ WHCC Core: Missing webhook signature');
        return false;
      }

      // WHCC typically uses HMAC-SHA256 for webhook signatures
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      // Compare signatures securely
      const providedSignature = signature.replace('sha256=', '');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );

      console.log(`🔐 WHCC Core: Webhook signature ${isValid ? 'verified' : 'failed'}`);
      return isValid;
      
    } catch (error) {
      console.error('❌ WHCC Core: Webhook signature verification error:', error.message);
      return false;
    }
  }
}

module.exports = WHCCCoreService;
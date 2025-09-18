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
    
    // Editor API Endpoints (may differ from OAS API)
    this.editorEndpoints = {
      token: '/api/AccessToken',
      catalog: '/api/catalog'
    };
    
    console.log(`🏭 WHCC Service: ${this.isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);
    console.log(`🔧 Base URL: ${this.baseUrl}`);
    console.log(`🔑 Credentials: ${this.oasKey ? 'OAS ✓' : 'OAS ✗'} | ${this.editorKeyId ? 'Editor ✓' : 'Editor ✗'}`);
  }

  /**
   * Step 1a: Get OAS Access Token
   * Following WHCC Order Submit API specification
   */
  async getAccessToken() {
    try {
      console.log('🔐 WHCC OAS: Getting access token...');
      
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
      
      console.log('✅ WHCC OAS: Access token obtained');
      return data.Token;
      
    } catch (error) {
      console.error('❌ WHCC OAS: Token error:', error.message);
      throw new Error(`Failed to authenticate with WHCC: ${error.message}`);
    }
  }

  /**
   * Step 1b: Get Editor API Access Token
   * Following WHCC Editor API specification
   */
  async getEditorAccessToken() {
    try {
      console.log('🔐 WHCC Editor: Getting access token...');
      
      if (!this.editorKeyId || !this.editorKeySecret) {
        throw new Error('Editor API credentials not configured. Please set EDITOR_API_KEY_ID and EDITOR_API_KEY_SECRET environment variables.');
      }
      
      const url = `${this.baseUrl}${this.editorEndpoints.token}`;
      
      // Use form data for token request (per WHCC spec)
      const params = new URLSearchParams({
        grant_type: 'consumer_credentials',
        consumer_key: this.editorKeyId,
        consumer_secret: this.editorKeySecret
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
        throw new Error(`Editor API token request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Check for WHCC error response (they return 200 with error)
      if (data.ErrorNumber || data.error) {
        throw new Error(`WHCC Editor Auth Error: ${data.Message || data.error_description || 'Unknown error'}`);
      }
      
      if (!data.Token) {
        throw new Error('No token received from WHCC Editor API');
      }
      
      console.log('✅ WHCC Editor: Access token obtained');
      return data.Token;
      
    } catch (error) {
      console.error('❌ WHCC Editor: Token error:', error.message);
      throw new Error(`Failed to authenticate with WHCC Editor API: ${error.message}`);
    }
  }

  /**
   * Determine which API to use based on product category
   */
  shouldUseEditorAPI(category) {
    const editorCategories = ['albums', 'cards', 'books'];
    return editorCategories.includes(category);
  }

  /**
   * Get appropriate token based on category
   */
  async getTokenForCategory(category) {
    if (this.shouldUseEditorAPI(category)) {
      console.log(`🎯 Using Editor API for category: ${category}`);
      return await this.getEditorAccessToken();
    } else {
      console.log(`🎯 Using OAS API for category: ${category}`);
      return await this.getAccessToken();
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
   * Get WHCC Product Catalog from specific API
   */
  async getCatalogFromAPI(useEditorAPI = false) {
    try {
      const token = useEditorAPI ? await this.getEditorAccessToken() : await this.getAccessToken();
      const endpoints = useEditorAPI ? this.editorEndpoints : this.endpoints;
      const apiName = useEditorAPI ? 'Editor' : 'OAS';
      
      const url = `${this.baseUrl}${endpoints.catalog}`;
      
      console.log(`📚 WHCC ${apiName}: Fetching catalog from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${apiName} catalog request failed: ${response.status} - ${errorText}`);
      }
      
      const catalog = await response.json();
      console.log(`✅ WHCC ${apiName}: Catalog received with ${catalog.Categories?.length || 0} categories`);
      
      return catalog;
      
    } catch (error) {
      console.error(`❌ WHCC ${useEditorAPI ? 'Editor' : 'OAS'}: Catalog error:`, error.message);
      throw error;
    }
  }

  /**
   * Get Combined WHCC Product Catalog from both APIs
   * Routes products based on category: Albums/Cards/Books -> Editor API, others -> OAS API
   */
  async getCatalog(categoryFilter = null) {
    try {
      console.log('🏭 WHCC: Getting dual API catalog...');
      
      const results = { Categories: [] };
      const processedCategories = new Set();
      
      // If a specific category filter is provided, route to appropriate API
      if (categoryFilter) {
        const useEditorAPI = this.shouldUseEditorAPIForCatalogCategory(categoryFilter);
        console.log(`🎯 Category filter '${categoryFilter}' routed to ${useEditorAPI ? 'Editor' : 'OAS'} API`);
        return await this.getCatalogFromAPI(useEditorAPI);
      }
      
      // Otherwise, get products from both APIs and merge them
      const [oasCatalog, editorCatalog] = await Promise.allSettled([
        this.getCatalogFromAPI(false), // OAS API
        this.getCatalogFromAPI(true)   // Editor API
      ]);
      
      // Process OAS API results (Canvas Prints, Photo Prints, etc.)
      if (oasCatalog.status === 'fulfilled' && oasCatalog.value?.Categories) {
        console.log('📋 Processing OAS API categories...');
        oasCatalog.value.Categories.forEach(category => {
          const categoryName = category.Name?.toLowerCase() || '';
          
          // Skip if this category should be handled by Editor API
          if (this.shouldUseEditorAPIForCatalogCategory(categoryName)) {
            console.log(`⏭️ Skipping OAS category '${category.Name}' - will be handled by Editor API`);
            return;
          }
          
          console.log(`✅ Adding OAS category: ${category.Name}`);
          results.Categories.push({
            ...category,
            _source: 'OAS'
          });
          processedCategories.add(categoryName);
        });
      } else if (oasCatalog.status === 'rejected') {
        console.warn('⚠️ OAS API catalog failed:', oasCatalog.reason.message);
      }
      
      // Process Editor API results (Albums, Cards, Books)
      if (editorCatalog.status === 'fulfilled' && editorCatalog.value?.Categories) {
        console.log('📋 Processing Editor API categories...');
        editorCatalog.value.Categories.forEach(category => {
          const categoryName = category.Name?.toLowerCase() || '';
          
          // Only include if this category should be handled by Editor API
          if (this.shouldUseEditorAPIForCatalogCategory(categoryName)) {
            console.log(`✅ Adding Editor category: ${category.Name}`);
            results.Categories.push({
              ...category,
              _source: 'Editor'
            });
            processedCategories.add(categoryName);
          } else {
            console.log(`⏭️ Skipping Editor category '${category.Name}' - handled by OAS API`);
          }
        });
      } else if (editorCatalog.status === 'rejected') {
        console.warn('⚠️ Editor API catalog failed:', editorCatalog.reason.message);
      }
      
      console.log(`🏭 WHCC: Combined catalog with ${results.Categories.length} categories from dual APIs`);
      
      return results;
      
    } catch (error) {
      console.error('❌ WHCC: Dual catalog error:', error.message);
      throw error;
    }
  }

  /**
   * Determine if a catalog category should use Editor API
   */
  shouldUseEditorAPIForCatalogCategory(categoryName) {
    if (!categoryName || typeof categoryName !== 'string') {
      return false;
    }
    
    const name = categoryName.toLowerCase();
    const editorKeywords = ['album', 'card', 'book', 'layflat', 'hardcover', 'softcover'];
    
    return editorKeywords.some(keyword => name.includes(keyword));
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
   * Get products with dual API routing support
   * Maintains compatibility with existing code while adding dual API functionality
   */
  async getProducts(categoryFilter = null) {
    try {
      console.log('🛍️ WHCC: Getting products with dual API support...');
      
      const catalog = await this.getCatalog(categoryFilter);
      
      // Transform catalog to match expected product format
      if (!catalog || !catalog.Categories) {
        console.log('⚠️ WHCC: No catalog categories found');
        return [];
      }
      
      const products = [];
      let editorApiCount = 0;
      let oasApiCount = 0;
      
      catalog.Categories.forEach(category => {
        const productList = category.ProductList || [];
        const isEditorSource = category._source === 'Editor';
        const isOASSource = category._source === 'OAS';
        
        console.log(`📂 Processing category '${category.Name}' from ${category._source || 'Unknown'} API (${productList.length} products)`);
        
        productList.forEach(product => {
          const normalizedCategory = this.normalizeProductCategory(product.Name, category.Name);
          
          const baseProduct = {
            id: `whcc_${product.Id}`,
            name: product.Name || category.Name,
            description: product.Description || `Professional ${category.Name}`,
            category: normalizedCategory,
            productUID: product.Id,
            sizes: [],
            // Add source API information for transparency
            _apiSource: category._source || 'Unknown',
            _usesEditorAPI: this.shouldUseEditorAPI(normalizedCategory)
          };
          
          // Track API usage
          if (isEditorSource) editorApiCount++;
          if (isOASSource) oasApiCount++;
          
          // Enhanced size extraction: Handle both ProductNodes and AttributeGroups
          let sizesExtracted = false;
          
          // Method 1: Extract sizes from ProductNodes (existing logic)
          if (product.ProductNodes && product.ProductNodes.length > 0) {
            console.log(`📏 Processing ${product.ProductNodes.length} ProductNode options for ${baseProduct.name}`);
            
            product.ProductNodes.forEach(node => {
              let width = node.W || 0;
              let height = node.H || 0;
              
              // If W/H missing, try parsing from node name/display name
              if (!width || !height) {
                const dimensions = this.parseDimensionsFromText(node.Name || node.DisplayName || '');
                if (dimensions) {
                  width = dimensions.width;
                  height = dimensions.height;
                  console.log(`📐 Parsed dimensions from node name: ${width}x${height}`);
                }
              }
              
              if (width > 0 && height > 0) {
                const area = width * height;
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
                sizesExtracted = true;
              }
            });
          }
          
          // Method 2: Extract sizes from AttributeGroups (for Albums, Books, etc.)
          if (!sizesExtracted && product.AttributeGroups && product.AttributeGroups.length > 0) {
            console.log(`🔍 No ProductNode sizes found, checking ${product.AttributeGroups.length} AttributeGroups for ${baseProduct.name}`);
            
            // Add detailed debugging for Albums
            if (baseProduct.category === 'albums') {
              console.log(`🐛 ALBUM DEBUG - AttributeGroups:`, product.AttributeGroups.map(g => ({
                name: g.Name,
                hasAttributes: !!(g.Attributes && g.Attributes.length > 0),
                attributeCount: g.Attributes ? g.Attributes.length : 0
              })));
            }
            
            product.AttributeGroups.forEach((group, groupIndex) => {
              const isSize = this.isSizeRelatedGroup(group.Name);
              console.log(`  Group ${groupIndex + 1}: "${group.Name}" - Size-related: ${isSize}`);
              
              if (isSize) {
                console.log(`📏 Found size-related group: ${group.Name}`);
                
                if (group.Attributes && group.Attributes.length > 0) {
                  group.Attributes.forEach((attribute, attrIndex) => {
                    console.log(`    Attribute ${attrIndex + 1}: "${attribute.Name || 'Unnamed'}" - Options: ${attribute.Options ? attribute.Options.length : 0}`);
                    
                    if (attribute.Options && attribute.Options.length > 0) {
                      attribute.Options.forEach((option, optIndex) => {
                        const optionText = option.Label || option.Name || '';
                        const dimensions = this.parseDimensionsFromText(optionText);
                        console.log(`      Option ${optIndex + 1}: "${optionText}" - Parsed: ${dimensions ? dimensions.width + 'x' + dimensions.height : 'No dimensions'}`);
                        
                        if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
                          const area = dimensions.width * dimensions.height;
                          let price = this.calculateProductPrice(baseProduct.category, dimensions.width, dimensions.height, option.Price || null);
                          
                          const sizeOption = {
                            uid: option.AttributeUID || `${dimensions.width}x${dimensions.height}`,
                            label: option.Label || `${dimensions.width}" x ${dimensions.height}"`,
                            width: dimensions.width,
                            height: dimensions.height,
                            area: area,
                            price: price,
                            productNodeUID: null,
                            attributeUID: option.AttributeUID
                          };
                          
                          baseProduct.sizes.push(sizeOption);
                          sizesExtracted = true;
                        }
                      });
                    }
                  });
                } else {
                  console.log(`    No attributes found in group: ${group.Name}`);
                }
              }
            });
            
            if (!sizesExtracted && baseProduct.category === 'albums') {
              console.log(`🐛 ALBUM DEBUG COMPLETE - No sizes extracted from any AttributeGroups`);
            }
          }
          
          // Sort sizes by area and remove duplicates
          if (baseProduct.sizes.length > 0) {
            // Remove duplicate sizes based on dimensions
            const uniqueSizes = baseProduct.sizes.filter((size, index, self) => {
              return index === self.findIndex(s => s.width === size.width && s.height === size.height);
            });
            
            baseProduct.sizes = uniqueSizes.sort((a, b) => a.area - b.area);
            console.log(`✅ Extracted ${baseProduct.sizes.length} sizes: ${baseProduct.sizes.map(s => s.label).join(', ')}`);
          } else {
            console.log(`⚠️ No sizes found for ${baseProduct.name} (checked ProductNodes and AttributeGroups)`);
          }
          
          products.push(baseProduct);
        });
      });
      
      // Log dual API summary
      const totalProducts = products.length;
      console.log(`🏭 WHCC Dual API Summary:`);
      console.log(`  📊 Total products: ${totalProducts}`);
      console.log(`  🎨 Editor API products: ${editorApiCount} (Albums, Cards, Books)`);
      console.log(`  🖼️ OAS API products: ${oasApiCount} (Canvas Prints, Photo Prints, etc.)`);
      
      // Verify routing accuracy
      const editorProducts = products.filter(p => p._usesEditorAPI).length;
      const oasProducts = products.filter(p => !p._usesEditorAPI).length;
      console.log(`  ✅ Routing verification: ${editorProducts} Editor-routed, ${oasProducts} OAS-routed`);
      
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
   * Parse dimensions from text strings using regex patterns
   * Handles formats like: "8x10", "8"x10"", "8 x 10", "10×10", etc.
   */
  parseDimensionsFromText(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }
    
    // Common dimension patterns
    const patterns = [
      // Pattern 1: 8x10, 8×10, 8 x 10
      /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i,
      // Pattern 2: 8"x10", 8" x 10"
      /(\d+(?:\.\d+)?)["'']?\s*[x×]\s*(\d+(?:\.\d+)?)["'']/i,
      // Pattern 3: 8 by 10, 8" by 10"
      /(\d+(?:\.\d+)?)["'']?\s*by\s*(\d+(?:\.\d+)?)["'']/i,
      // Pattern 4: Just dimensions with quotes: 8" × 10"
      /(\d+(?:\.\d+)?)["'']\s*[×x]\s*(\d+(?:\.\d+)?)["'']/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const width = parseFloat(match[1]);
        const height = parseFloat(match[2]);
        
        if (width > 0 && height > 0) {
          return {
            width: width,
            height: height
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Check if an attribute group name is size-related
   */
  isSizeRelatedGroup(groupName) {
    if (!groupName || typeof groupName !== 'string') {
      return false;
    }
    
    const name = groupName.toLowerCase();
    const sizeKeywords = [
      'size', 'dimension', 'album size', 'book size', 'card size', 
      'print size', 'page size', 'format', 'dimensions', 'album dimensions',
      'book dimensions', 'page format', 'album format', 'book format'
    ];
    
    return sizeKeywords.some(keyword => name.includes(keyword));
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
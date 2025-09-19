const crypto = require('crypto');
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));

/**
 * WHCC Product Service - Rebuilt for Editor Integration
 * Uses curated product catalog from OAS secrets and runs ordering through editor
 */
class WHCCProductService {
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

    // Product cache for performance
    this.productCache = null;
    this.cacheExpiry = 0;
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    // Curated product catalog - exact structure from photo-sales-routes.js fallback
    // These are the real WHCC products we expose to customers
    this.curatedProducts = [
      // Albums - confirmed available
      { category: 'Albums', name: '10x10 Album', productUID: 'album-10x10', price: 299.99, sizes: [{width: 10, height: 10, price: 299.99}] },
      { category: 'Albums', name: '12x12 Album', productUID: 'album-12x12', price: 349.99, sizes: [{width: 12, height: 12, price: 349.99}] },
      { category: 'Albums', name: '8x8 Album', productUID: 'album-8x8', price: 249.99, sizes: [{width: 8, height: 8, price: 249.99}] },
      { category: 'Albums', name: '11x14H Album', productUID: 'album-11x14h', price: 329.99, sizes: [{width: 11, height: 14, price: 329.99}] },
      { category: 'Albums', name: '11x14V Album', productUID: 'album-11x14v', price: 329.99, sizes: [{width: 14, height: 11, price: 329.99}] },
      
      // Books
      { category: 'Books', name: 'Photo Print 2up Yearbook', productUID: 'book-yearbook', price: 199.99, sizes: [{width: 8, height: 10, price: 199.99}] },
      
      // Metal Prints - confirmed available
      { category: 'Metal Prints', name: 'Metal Print 8x10', productUID: 'metal-8x10', price: 59.99, sizes: [{width: 8, height: 10, price: 59.99}] },
      { category: 'Metal Prints', name: 'Metal Print 11x14', productUID: 'metal-11x14', price: 89.99, sizes: [{width: 11, height: 14, price: 89.99}] },
      { category: 'Metal Prints', name: 'Metal Print 16x20', productUID: 'metal-16x20', price: 129.99, sizes: [{width: 16, height: 20, price: 129.99}] },
      { category: 'Metal Prints', name: 'Metal Print 20x24', productUID: 'metal-20x24', price: 179.99, sizes: [{width: 20, height: 24, price: 179.99}] },
      { category: 'Metal Prints', name: 'Metal Print 24x30', productUID: 'metal-24x30', price: 249.99, sizes: [{width: 24, height: 30, price: 249.99}] },
      { category: 'Metal Prints', name: 'Metal Print 30x40', productUID: 'metal-30x40', price: 379.99, sizes: [{width: 30, height: 40, price: 379.99}] },
      
      // Standard Prints
      { category: 'Photographic Prints', name: 'Photo Print 4x6', productUID: 'print-4x6', price: 2.99, sizes: [{width: 4, height: 6, price: 2.99}] },
      { category: 'Photographic Prints', name: 'Photo Print 5x7', productUID: 'print-5x7', price: 4.99, sizes: [{width: 5, height: 7, price: 4.99}] },
      { category: 'Photographic Prints', name: 'Photo Print 8x10', productUID: 'print-8x10', price: 9.99, sizes: [{width: 8, height: 10, price: 9.99}] },
      { category: 'Photographic Prints', name: 'Photo Print 11x14', productUID: 'print-11x14', price: 19.99, sizes: [{width: 11, height: 14, price: 19.99}] },
      { category: 'Photographic Prints', name: 'Photo Print 16x20', productUID: 'print-16x20', price: 39.99, sizes: [{width: 16, height: 20, price: 39.99}] },
      
      // Canvas
      { category: 'Canvas Prints', name: 'Canvas Print 8x10', productUID: 'canvas-8x10', price: 49.99, sizes: [{width: 8, height: 10, price: 49.99}] },
      { category: 'Canvas Prints', name: 'Canvas Print 11x14', productUID: 'canvas-11x14', price: 69.99, sizes: [{width: 11, height: 14, price: 69.99}] },
      { category: 'Canvas Prints', name: 'Canvas Print 16x20', productUID: 'canvas-16x20', price: 99.99, sizes: [{width: 16, height: 20, price: 99.99}] },
      { category: 'Canvas Prints', name: 'Canvas Print 20x24', productUID: 'canvas-20x24', price: 149.99, sizes: [{width: 20, height: 24, price: 149.99}] },
      { category: 'Canvas Prints', name: 'Canvas Print 24x30', productUID: 'canvas-24x30', price: 199.99, sizes: [{width: 24, height: 30, price: 199.99}] }
    ];

    console.log(`🏭 WHCC Product Service: ${this.isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);
    console.log(`🔧 Base URL: ${this.baseUrl}`);
    console.log(`🔑 Credentials: ${this.oasKey ? 'OAS ✓' : 'OAS ✗'}`);
    console.log(`📦 Curated Products: ${this.curatedProducts.length} items`);
  }

  /**
   * Get OAS Access Token
   */
  async getAccessToken() {
    try {
      console.log('🔐 WHCC OAS: Getting access token...');
      
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
      
      console.log('✅ WHCC OAS: Access token obtained');
      return data.Token;
      
    } catch (error) {
      console.error('❌ WHCC OAS: Token error:', error.message);
      throw new Error(`Failed to authenticate with WHCC: ${error.message}`);
    }
  }

  /**
   * Get Products - Main method that returns curated catalog
   * Falls back to OAS API and filters against curated list
   */
  async getProducts() {
    try {
      // Check cache first
      const now = Date.now();
      if (this.productCache && now < this.cacheExpiry) {
        console.log('✅ Returning cached WHCC products');
        return this.productCache;
      }

      console.log('🔄 Refreshing WHCC product cache...');
      
      // Try to get enhanced data from WHCC OAS API
      let enhancedProducts = [];
      try {
        const token = await this.getAccessToken();
        const catalog = await this.getCatalogFromOAS(token);
        enhancedProducts = this.enhanceProductsWithOASData(catalog);
      } catch (oasError) {
        console.warn('⚠️ WHCC OAS API unavailable, using curated catalog only:', oasError.message);
      }

      // If OAS enhanced data is available, use it; otherwise use curated catalog
      const products = enhancedProducts.length > 0 ? enhancedProducts : this.getCuratedCatalog();

      // Cache the results
      this.productCache = products;
      this.cacheExpiry = now + this.CACHE_DURATION;

      console.log(`✅ WHCC product catalog loaded: ${products.length} items`);
      return products;

    } catch (error) {
      console.error('❌ WHCC Product Service error:', error.message);
      // Always return curated catalog as fallback
      return this.getCuratedCatalog();
    }
  }

  /**
   * Get curated catalog - always available fallback
   * Returns products in format needed for editor-driven ordering
   */
  getCuratedCatalog() {
    console.log('📦 Using curated product catalog');
    return this.curatedProducts.map(product => ({
      id: product.productUID,
      name: product.name,
      category: product.category,
      productUID: product.productUID,
      // Simplified pricing - "one price for total amount"
      totalPrice: product.price,
      basePrice: product.price,
      // Provide sizes array with proper structure for editor
      sizes: product.sizes.map(size => ({
        uid: `${product.productUID}_${size.width}x${size.height}`,
        label: `${size.width}" x ${size.height}"`,
        width: size.width,
        height: size.height,
        price: size.price,
        // Will be populated from OAS when available
        productNodeUID: null,
        attributeUIDs: []
      })),
      // Editor needs these for order construction
      attributeGroups: [],
      productNodeUID: null,
      _source: 'curated'
    }));
  }

  /**
   * Get catalog from WHCC OAS API
   */
  async getCatalogFromOAS(token) {
    const url = `${this.baseUrl}${this.endpoints.catalog}`;
    
    console.log(`📚 WHCC OAS: Fetching catalog from ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAS catalog request failed: ${response.status} - ${errorText}`);
    }
    
    const catalog = await response.json();
    console.log(`✅ WHCC OAS: Catalog received with ${catalog.Categories?.length || 0} categories`);
    
    return catalog;
  }

  /**
   * Enhance curated products with real WHCC OAS data using deterministic mapping
   * Maps curated ProductUIDs to actual WHCC catalog ProductUIDs, ProductNodeUIDs, and AttributeUIDs
   */
  enhanceProductsWithOASData(catalog) {
    if (!catalog || !catalog.Categories) {
      return [];
    }

    const { findWhccProductByCuratedUID, createOrderReadyProduct } = require('./whcc-product-mapping');
    const enhancedProducts = [];
    
    // Only process products that exist in our curated list with deterministic mapping
    this.curatedProducts.forEach(curatedProduct => {
      const matchedWhccProduct = findWhccProductByCuratedUID(curatedProduct.productUID, catalog);

      if (matchedWhccProduct) {
        // Create order-ready product with real WHCC data
        const orderReadyProduct = createOrderReadyProduct(curatedProduct, matchedWhccProduct);
        enhancedProducts.push(orderReadyProduct);
      } else {
        // Log missing mapping and provide deterministic fallback
        console.warn(`⚠️ No WHCC mapping found for curated product: ${curatedProduct.productUID}`);
        
        const deterministicFallback = {
          id: curatedProduct.productUID,
          name: curatedProduct.name,
          category: curatedProduct.category,
          productUID: curatedProduct.productUID, // Keep curated UID for now
          totalPrice: curatedProduct.price,
          basePrice: curatedProduct.price,
          sizes: curatedProduct.sizes.map(size => ({
            uid: `${curatedProduct.productUID}_${size.width}x${size.height}`,
            label: `${size.width}" x ${size.height}"`,
            width: size.width,
            height: size.height,
            price: size.price,
            productNodeUID: null,
            attributeUIDs: [] // Empty - cannot create orders without real UIDs
          })),
          defaultAttributeUIDs: [],
          shippingMethods: require('./whcc-product-mapping').SHIPPING_METHODS,
          productNodeUID: null,
          _source: 'curated_fallback'
        };
        enhancedProducts.push(deterministicFallback);
      }
    });

    return enhancedProducts;
  }




}

module.exports = WHCCProductService;
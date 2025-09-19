/**
 * WHCC Product Mapping - Deterministic mapping between curated products and real WHCC data
 * This ensures order-ready product data for editor-driven ordering
 */

// Mapping between curated product names and real WHCC product names from OAS API
const WHCC_PRODUCT_MAPPING = {
  // Albums - exact names from OAS API logs
  'album-8x8': 'Album 8x8',
  'album-10x10': 'Album 10x10', 
  'album-11x14h': 'Album 11x14H',
  'album-11x14v': 'Album 11x14V',
  'album-12x12': 'Album 12x12',

  // Photo Prints - exact names from OAS API logs
  'print-4x6': 'Photo Print 4x6',
  'print-5x7': 'Photo Print 5x7 ',
  'print-8x10': 'Photo Print 8x10 ',
  'print-11x14': 'Photo Print 11x14',
  'print-16x20': 'Photo Print 16x20',

  // Canvas Prints - exact names from OAS API logs
  'canvas-8x10': 'Canvas Print 8x10',
  'canvas-11x14': 'Canvas Print 11x14',
  'canvas-16x20': 'Canvas Print 16x20',
  'canvas-20x24': 'Canvas Print 20x24',
  'canvas-24x30': 'Canvas Print 24x30',

  // Metal Prints - these might be in Gallery Wraps or Partner Photo Fulfillment
  'metal-8x10': 'Photo Print 8x10 ',  // Fallback to photo prints
  'metal-11x14': 'Photo Print 11x14',
  'metal-16x20': 'Photo Print 16x20',
  'metal-20x24': 'Photo Print 20x24',
  'metal-24x30': 'Photo Print 24x30',
  'metal-30x40': 'Photo Print 30x40',

  // Books
  'book-yearbook': 'Photo Print 2up Yearbook'
};

// Default AttributeUIDs for common configurations
const DEFAULT_ATTRIBUTE_UIDS = {
  // Photo prints typically need paper type and finish
  'photo_prints': [
    // These would be real AttributeUIDs from the WHCC catalog
    // Will be populated when we have access to AttributeGroup data
  ],
  
  // Canvas prints typically need wrap type and thickness
  'canvas_prints': [
    // Canvas-specific AttributeUIDs
  ],
  
  // Albums need cover type and binding
  'albums': [
    // Album-specific AttributeUIDs
  ]
};

// Shipping methods available in WHCC
const SHIPPING_METHODS = [
  {
    id: 'standard',
    name: 'Standard Shipping',
    description: '5-7 business days',
    price: 9.99
  },
  {
    id: 'expedited', 
    name: 'Expedited Shipping',
    description: '2-3 business days',
    price: 19.99
  },
  {
    id: 'overnight',
    name: 'Overnight Shipping', 
    description: '1 business day',
    price: 39.99
  }
];

/**
 * Find WHCC product by curated product UID
 */
function findWhccProductByCuratedUID(curatedUID, whccCatalog) {
  const whccProductName = WHCC_PRODUCT_MAPPING[curatedUID];
  if (!whccProductName) {
    return null;
  }

  // Search through all categories for exact name match
  for (const category of whccCatalog.Categories || []) {
    for (const product of category.ProductList || []) {
      if (product.Name === whccProductName) {
        return {
          ...product,
          categoryName: category.Name
        };
      }
    }
  }

  return null;
}

/**
 * Extract ProductNodeUID and dimensions from WHCC product
 */
function extractProductNodeData(whccProduct) {
  const nodes = [];
  
  if (whccProduct.ProductNodes && whccProduct.ProductNodes.length > 0) {
    whccProduct.ProductNodes.forEach(node => {
      if (node.W && node.H && node.UID) {
        nodes.push({
          uid: node.UID,
          width: node.W,
          height: node.H,
          name: node.Name || `${node.W}x${node.H}`
        });
      }
    });
  }
  
  return nodes;
}

/**
 * Extract AttributeUIDs from WHCC product for order configuration
 */
function extractAttributeUIDs(whccProduct) {
  const attributeUIDs = [];
  
  if (whccProduct.AttributeGroups && whccProduct.AttributeGroups.length > 0) {
    whccProduct.AttributeGroups.forEach(group => {
      if (group.Attributes && group.Attributes.length > 0) {
        group.Attributes.forEach(attribute => {
          if (attribute.Options && attribute.Options.length > 0) {
            // Use first option as default
            const defaultOption = attribute.Options[0];
            if (defaultOption.AttributeUID) {
              attributeUIDs.push(defaultOption.AttributeUID);
            }
          }
        });
      }
    });
  }
  
  return attributeUIDs;
}

/**
 * Create order-ready product data with real WHCC UIDs
 */
function createOrderReadyProduct(curatedProduct, whccProduct) {
  const productNodes = extractProductNodeData(whccProduct);
  const attributeUIDs = extractAttributeUIDs(whccProduct);
  
  // Use first ProductNode as primary
  const primaryNode = productNodes[0];
  
  return {
    id: curatedProduct.productUID,
    name: curatedProduct.name,
    category: curatedProduct.category,
    
    // Real WHCC ordering data
    productUID: whccProduct.Id,
    productNodeUID: primaryNode?.uid || null,
    
    // Simplified pricing
    totalPrice: curatedProduct.price,
    basePrice: curatedProduct.price,
    
    // Order-ready sizes with real UIDs
    sizes: productNodes.map(node => ({
      uid: node.uid,
      label: `${node.width}" x ${node.height}"`,
      width: node.width,
      height: node.height,
      price: curatedProduct.price,
      productNodeUID: node.uid,
      attributeUIDs: attributeUIDs
    })),
    
    // Default attributes for orders
    defaultAttributeUIDs: attributeUIDs,
    
    // Shipping options
    shippingMethods: SHIPPING_METHODS,
    
    _source: 'whcc_mapped'
  };
}

module.exports = {
  WHCC_PRODUCT_MAPPING,
  DEFAULT_ATTRIBUTE_UIDS,
  SHIPPING_METHODS,
  findWhccProductByCuratedUID,
  extractProductNodeData,
  extractAttributeUIDs,
  createOrderReadyProduct
};
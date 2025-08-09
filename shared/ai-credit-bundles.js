// Single source of truth for AI credit bundles
// Used by both frontend and backend to ensure consistency

const AI_CREDIT_BUNDLES = [
  { credits: 1000, price: 1.00, popular: false },
  { credits: 5000, price: 4.99, popular: false },
  { credits: 10000, price: 8.99, popular: true },
  { credits: 25000, price: 19.99, popular: false },
  { credits: 50000, price: 34.99, popular: false }
];

// Validation function to check if a bundle is valid
function isValidBundle(credits, price) {
  return AI_CREDIT_BUNDLES.some(bundle => 
    bundle.credits === credits && Math.abs(bundle.price - price) < 0.01
  );
}

// Get bundle description for UI
function getBundleDescription(credits) {
  if (credits <= 1000) return 'basic content generation';
  if (credits <= 5000) return 'small websites';
  if (credits <= 10000) return 'medium websites';
  if (credits <= 25000) return 'large websites';
  return 'multiple websites';
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    AI_CREDIT_BUNDLES,
    isValidBundle,
    getBundleDescription
  };
} else {
  // Browser environment
  window.AI_CREDIT_BUNDLES = AI_CREDIT_BUNDLES;
  window.isValidBundle = isValidBundle;
  window.getBundleDescription = getBundleDescription;
}
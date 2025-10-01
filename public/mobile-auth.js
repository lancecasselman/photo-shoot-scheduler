
/**
 * Mobile Authentication Handler
 * Provides authentication utilities for mobile devices
 */

console.log('🔧 Mobile Auth: Initializing mobile authentication utilities...');

// Mobile-specific authentication utilities
window.MobileAuth = {
  isCapacitor: () => {
    return typeof window.Capacitor !== 'undefined';
  },
  
  isAndroid: () => {
    return /Android/i.test(navigator.userAgent);
  },
  
  isiOS: () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },
  
  isMobile: () => {
    return window.MobileAuth.isAndroid() || window.MobileAuth.isiOS();
  },
  
  getDeviceInfo: () => {
    return {
      isCapacitor: window.MobileAuth.isCapacitor(),
      isAndroid: window.MobileAuth.isAndroid(),
      isiOS: window.MobileAuth.isiOS(),
      isMobile: window.MobileAuth.isMobile(),
      userAgent: navigator.userAgent
    };
  }
};

console.log('✅ Mobile Auth: Utilities loaded', window.MobileAuth.getDeviceInfo());

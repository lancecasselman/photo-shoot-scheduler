// Console Cleanup Utility - Suppress development warnings in production
(function() {
    'use strict';
    
    // Production console cleanup
    const isProduction = !window.location.hostname.includes('localhost') && 
                        !window.location.hostname.includes('127.0.0.1') &&
                        !window.location.search.includes('debug=true');
    
    if (isProduction) {
        // Store original console methods
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalLog = console.log;
        
        // Patterns to suppress in production
        const suppressedPatterns = [
            /Tracking Prevention blocked access to storage/i,
            /Unrecognized feature:/i,
            /Allow attribute will take precedence/i,
            /Error while parsing the 'sandbox' attribute/i,
            /Failed to load resource.*404.*Not Found/i,
            /gravatar\.com.*404/i,
            /favicon\.ico.*404/i,
            /Intervention.*Slow network is detected/i,
            /Mixed Content.*was loaded over HTTPS/i,
            /Content Security Policy/i,
            /Permissions-Policy/i,
            /Feature-Policy/i
        ];
        
        function shouldSuppress(message) {
            const messageStr = String(message);
            return suppressedPatterns.some(pattern => pattern.test(messageStr));
        }
        
        // Override console methods to filter out noise
        console.error = function(...args) {
            const message = args.join(' ');
            if (!shouldSuppress(message)) {
                originalError.apply(console, args);
            }
        };
        
        console.warn = function(...args) {
            const message = args.join(' ');
            if (!shouldSuppress(message)) {
                originalWarn.apply(console, args);
            }
        };
        
        // Optional: Also filter console.log in production
        console.log = function(...args) {
            const message = args.join(' ');
            // Don't suppress important authentication and Firebase logs
            // Only suppress browser warnings and known noise patterns
            if (!shouldSuppress(message)) {
                originalLog.apply(console, args);
            }
        };
    }
    
    // Global error handler for resource loading failures
    document.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG') {
            const img = e.target;
            
            // Handle gravatar failures specifically
            if (img.src.includes('gravatar.com')) {
                img.style.display = 'none';
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // Handle other 404 image errors
            if (img.src.includes('favicon.ico') || img.alt === 'favicon') {
                img.style.display = 'none';
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // For other failed images, try a fallback or hide
            if (!img.getAttribute('data-fallback-attempted')) {
                img.setAttribute('data-fallback-attempted', 'true');
                
                // Generate initials avatar if AvatarUtils is available
                if (window.AvatarUtils && (img.alt || img.getAttribute('data-user'))) {
                    const userName = img.alt || img.getAttribute('data-user');
                    img.src = AvatarUtils.generateInitialsAvatar(userName, img.width || 40);
                } else {
                    img.style.display = 'none';
                }
                
                e.preventDefault();
                e.stopPropagation();
            }
        }
        
        // Suppress other resource load errors in production
        if (isProduction) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    
    // Handle unhandled promise rejections in production
    window.addEventListener('unhandledrejection', function(e) {
        const reason = e.reason || e.detail || 'Unknown error';
        
        // Only suppress in production and if shouldSuppress function is available
        if (isProduction && typeof shouldSuppress === 'function' && shouldSuppress(String(reason))) {
            e.preventDefault();
        }
    });
    
    console.log('Console cleanup initialized for ' + (isProduction ? 'production' : 'development'));
})();
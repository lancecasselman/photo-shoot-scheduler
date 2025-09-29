/**
 * Screenshot Protection System
 * Comprehensive deterrents to protect photographers' intellectual property
 * Note: Complete prevention is technically impossible on the web - these are deterrents
 */

class ScreenshotProtection {
    constructor() {
        this.protectionEnabled = false;
        this.sessionPolicy = null;
        this.watermarkCache = new Map();
        this.blobUrlCache = new Map();
        this.protectedImages = new Set();
        this.purchasedPhotos = new Set();
        this.consoleWarningShown = false;
        
        // Protection settings
        this.settings = {
            disableRightClick: true,
            disableKeyboardShortcuts: true,
            disableDragDrop: true,
            disableDevTools: true,
            useWatermarks: true,
            useBlurEffect: true,
            useBlobUrls: true,
            useCanvasRendering: true,
            consoleLogs: false // Set to true for debugging
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize protection system
     */
    async init() {
        // Load session policy
        await this.loadSessionPolicy();
        
        // Show console warning
        this.showConsoleWarning();
        
        // Initialize protection if enabled
        if (this.protectionEnabled) {
            this.initProtection();
        }
    }
    
    /**
     * Load session policy to determine protection settings
     */
    async loadSessionPolicy() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('sessionId');
            
            if (!sessionId) {
                this.log('No session ID found, using default protection settings');
                return;
            }
            
            // CRITICAL FIX: Use the correct policy endpoint that includes pricing model
            try {
                const policyResponse = await fetch(`/api/downloads/policies/${sessionId}`);
                if (policyResponse.ok) {
                    const policyData = await policyResponse.json();
                    
                    if (policyData.success && policyData.policy) {
                        this.sessionPolicy = policyData.policy;
                        
                        // CRITICAL FIX: Adjust protection based on pricing model
                        const pricingModel = this.sessionPolicy.pricingModel || 'free';
                        
                        this.log('Session policy loaded from policy endpoint:', {
                            pricingModel,
                            screenshotProtection: this.sessionPolicy.screenshotProtection,
                            watermarkEnabled: this.sessionPolicy.watermarkEnabled
                        });
                        
                        // Configure protection based on pricing model
                        if (pricingModel === 'free') {
                            // FREE pricing model: Minimal protection to allow easy access
                            this.protectionEnabled = this.sessionPolicy.screenshotProtection !== false;
                            this.settings.useWatermarks = !!this.sessionPolicy.watermarkEnabled;
                            
                            // Reduce protection intensity for FREE models
                            this.settings.disableRightClick = false; // Allow right-click on free photos
                            this.settings.disableKeyboardShortcuts = false; // Allow keyboard shortcuts
                            this.settings.disableDragDrop = false; // Allow drag/drop
                            this.settings.useBlurEffect = false; // No blur on free photos
                            this.settings.useBlobUrls = false; // No blob URL conversion
                            
                            this.log('FREE pricing model detected - reduced protection enabled');
                        } else {
                            // PAID/FREEMIUM: Full protection enabled
                            this.protectionEnabled = this.sessionPolicy.screenshotProtection !== false;
                            this.settings.useWatermarks = !!this.sessionPolicy.watermarkEnabled;
                            
                            this.log(`${pricingModel.toUpperCase()} pricing model detected - full protection enabled`);
                        }
                        
                        return; // Successfully loaded policy
                    }
                }
                
                this.log('Policy endpoint did not return valid data, falling back to health check');
            } catch (policyError) {
                this.log('Policy endpoint failed, falling back to health check:', policyError);
            }
            
            // Fallback: Try orchestrator health endpoint
            const healthResponse = await fetch('/api/downloads/orchestrator/health');
            if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                this.log('Orchestrator health check:', healthData);
                
                // Try to get session-specific policy via debug endpoint (if debug mode enabled)
                if (window.location.search.includes('debug')) {
                    try {
                        const debugResponse = await fetch(`/api/downloads/orchestrator/debug/session/${sessionId}`);
                        if (debugResponse.ok) {
                            const debugData = await debugResponse.json();
                            this.sessionPolicy = debugData.debug.policy;
                            
                            // Enable protection based on policy settings
                            this.protectionEnabled = this.sessionPolicy.mode !== 'DISABLED';
                            this.settings.useWatermarks = !!debugData.debug.policy.watermarkSettings;
                            
                            this.log('Session policy loaded from orchestrator debug:', debugData.debug.policy);
                            return;
                        }
                    } catch (debugError) {
                        this.log('Debug endpoint not available, using default policy');
                    }
                }
                
                // Fallback to default protection settings when orchestrator is healthy
                this.sessionPolicy = {
                    mode: 'ENABLED',
                    pricingModel: 'freemium', // Default to freemium for safety
                    screenshotProtection: true,
                    watermarkEnabled: true
                };
                this.protectionEnabled = true;
                this.settings.useWatermarks = true;
                
                this.log('Using default protection policy (orchestrator healthy)');
            }
        } catch (error) {
            this.log('Error loading session policy:', error);
            // Default to enabled protection on error
            this.protectionEnabled = true;
            this.sessionPolicy = {
                mode: 'ENABLED',
                pricingModel: 'freemium', // Default to freemium for safety
                screenshotProtection: true,
                watermarkEnabled: true
            };
            this.settings.useWatermarks = true;
        }
    }
    
    /**
     * Initialize all protection measures
     */
    initProtection() {
        this.log('Initializing screenshot protection...');
        
        // Disable right-click context menu
        if (this.settings.disableRightClick) {
            this.disableRightClick();
        }
        
        // Disable keyboard shortcuts
        if (this.settings.disableKeyboardShortcuts) {
            this.disableKeyboardShortcuts();
        }
        
        // Disable drag and drop
        if (this.settings.disableDragDrop) {
            this.disableDragDrop();
        }
        
        // Disable developer tools (deterrent only)
        if (this.settings.disableDevTools) {
            this.disableDevTools();
        }
        
        // Add CSS protection styles
        this.addProtectionStyles();
        
        // Initialize mobile app protection (if applicable)
        this.initMobileProtection();
        
        // Monitor for new images
        this.startImageMonitoring();
        
        this.log('Screenshot protection initialized');
    }
    
    /**
     * Disable right-click context menu on protected elements
     */
    disableRightClick() {
        document.addEventListener('contextmenu', (e) => {
            // Check if target is an image or within a protected area
            if (e.target.tagName === 'IMG' || 
                e.target.closest('.photo-wrapper') || 
                e.target.closest('.photo-card') ||
                e.target.closest('.protected-image')) {
                
                // CRITICAL FIX: Allow right-click on legitimate download URLs
                if (e.target.tagName === 'IMG') {
                    const isDownloadUrl = this.isLegitimateDownloadUrl(e.target.src);
                    const photoId = e.target.dataset.photoId;
                    const isPurchased = photoId && this.purchasedPhotos.has(photoId);
                    
                    if (isDownloadUrl || isPurchased) {
                        this.log('Allowing right-click on legitimate download/purchased photo');
                        return true; // Allow right-click for downloads
                    }
                }
                
                e.preventDefault();
                this.showProtectionNotice('Right-click disabled for image protection');
                return false;
            }
        }, true);
        
        this.log('Right-click protection enabled with download exemptions');
    }
    
    /**
     * Disable keyboard shortcuts that could be used for screenshots
     */
    disableKeyboardShortcuts() {
        const blockedKeys = {
            // Print screen (various combinations)
            'PrintScreen': true,
            'Print': true,
            
            // Save shortcuts
            's': (e) => e.ctrlKey || e.metaKey,
            'S': (e) => e.ctrlKey || e.metaKey,
            
            // Select all
            'a': (e) => e.ctrlKey || e.metaKey,
            'A': (e) => e.ctrlKey || e.metaKey,
            
            // Copy
            'c': (e) => e.ctrlKey || e.metaKey,
            'C': (e) => e.ctrlKey || e.metaKey,
            
            // Developer tools
            'F12': true,
            'I': (e) => (e.ctrlKey || e.metaKey) && e.shiftKey,
            'i': (e) => (e.ctrlKey || e.metaKey) && e.shiftKey,
            'J': (e) => (e.ctrlKey || e.metaKey) && e.shiftKey,
            'j': (e) => (e.ctrlKey || e.metaKey) && e.shiftKey,
            'C': (e) => (e.ctrlKey || e.metaKey) && e.shiftKey,
            'c': (e) => (e.ctrlKey || e.metaKey) && e.shiftKey,
            
            // Print
            'p': (e) => e.ctrlKey || e.metaKey,
            'P': (e) => e.ctrlKey || e.metaKey,
        };
        
        document.addEventListener('keydown', (e) => {
            const blocker = blockedKeys[e.key];
            if (blocker && (typeof blocker === 'boolean' || blocker(e))) {
                // CRITICAL FIX: Allow keyboard shortcuts on legitimate download URLs
                const activeElement = document.activeElement;
                if (activeElement && activeElement.tagName === 'IMG') {
                    const isDownloadUrl = this.isLegitimateDownloadUrl(activeElement.src);
                    const photoId = activeElement.dataset.photoId;
                    const isPurchased = photoId && this.purchasedPhotos.has(photoId);
                    
                    if (isDownloadUrl || isPurchased) {
                        this.log('Allowing keyboard shortcut on legitimate download/purchased photo');
                        return true; // Allow keyboard shortcuts for downloads
                    }
                }
                
                e.preventDefault();
                e.stopPropagation();
                this.showProtectionNotice('This keyboard shortcut has been disabled for image protection');
                return false;
            }
        }, true);
        
        // Also block copy events on images (with download exemptions)
        document.addEventListener('copy', (e) => {
            if (e.target.tagName === 'IMG' || e.target.closest('.protected-image')) {
                // CRITICAL FIX: Allow copying legitimate download URLs
                if (e.target.tagName === 'IMG') {
                    const isDownloadUrl = this.isLegitimateDownloadUrl(e.target.src);
                    const photoId = e.target.dataset.photoId;
                    const isPurchased = photoId && this.purchasedPhotos.has(photoId);
                    
                    if (isDownloadUrl || isPurchased) {
                        this.log('Allowing copy operation on legitimate download/purchased photo');
                        return true; // Allow copying for downloads
                    }
                }
                
                e.clipboardData.setData('text/plain', 'Images are protected by copyright');
                e.preventDefault();
                this.showProtectionNotice('Copying images is disabled');
                return false;
            }
        });
        
        this.log('Keyboard shortcut protection enabled');
    }
    
    /**
     * Disable drag and drop for images
     */
    disableDragDrop() {
        // Disable dragging
        document.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'IMG' || e.target.closest('.protected-image')) {
                e.preventDefault();
                this.showProtectionNotice('Dragging images is disabled');
                return false;
            }
        }, true);
        
        // Disable drop
        document.addEventListener('drop', (e) => {
            if (e.target.tagName === 'IMG' || e.target.closest('.protected-image')) {
                e.preventDefault();
                return false;
            }
        }, true);
        
        this.log('Drag and drop protection enabled');
    }
    
    /**
     * Add deterrents for developer tools (not foolproof)
     */
    disableDevTools() {
        // Detect devtools by monitoring window size changes
        let devtools = {open: false, orientation: null};
        const threshold = 160;
        
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > threshold || 
                window.outerWidth - window.innerWidth > threshold) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.onDevToolsOpen();
                }
            } else {
                devtools.open = false;
            }
        }, 500);
        
        // Disable F12 and other dev tool shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.keyCode === 123 || // F12
                (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
                (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
                (e.ctrlKey && e.keyCode === 85)) { // Ctrl+U (view source)
                e.preventDefault();
                this.showProtectionNotice('Developer tools access is restricted');
                return false;
            }
        });
        
        // Disable right-click inspect element
        document.addEventListener('contextmenu', (e) => {
            if (e.ctrlKey || e.shiftKey) {
                e.preventDefault();
                return false;
            }
        });
        
        this.log('Developer tools deterrents enabled');
    }
    
    /**
     * Handle developer tools being opened
     */
    onDevToolsOpen() {
        console.clear();
        this.showConsoleWarning();
        this.log('Developer tools detected - protection measures active');
        
        // Could implement more aggressive measures here if needed
        // For example: blur all images, show warning overlay, etc.
    }
    
    /**
     * Add CSS protection styles
     */
    addProtectionStyles() {
        const style = document.createElement('style');
        style.id = 'screenshot-protection-styles';
        style.innerHTML = `
            /* Disable selection on protected elements */
            .protected-image,
            .photo-wrapper img,
            .photo-card img,
            .gallery-grid img {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
                -webkit-user-drag: none !important;
                -khtml-user-drag: none !important;
                -moz-user-drag: none !important;
                -o-user-drag: none !important;
                user-drag: none !important;
                -webkit-touch-callout: none !important;
                pointer-events: none !important;
            }
            
            /* Allow interaction with parent containers */
            .photo-wrapper,
            .photo-card {
                pointer-events: auto !important;
            }
            
            /* Transparent overlay to prevent direct access */
            .protection-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10;
                background: transparent;
                pointer-events: auto;
                user-select: none;
            }
            
            /* Watermark overlay styles */
            .watermark-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 48px;
                font-weight: bold;
                color: rgba(255, 255, 255, 0.4);
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
                z-index: 15;
                pointer-events: none;
                white-space: nowrap;
                font-family: 'Arial Black', sans-serif;
                letter-spacing: 8px;
                text-transform: uppercase;
            }
            
            /* Blur effect for unpurchased photos */
            .blur-unpurchased {
                filter: blur(15px) !important;
                transition: filter 0.3s ease;
            }
            
            .blur-unpurchased:hover {
                filter: blur(5px) !important;
            }
            
            /* Purchase overlay */
            .purchase-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px 30px;
                border-radius: 10px;
                font-weight: bold;
                z-index: 20;
                text-align: center;
                pointer-events: none;
            }
            
            /* Print media protection */
            @media print {
                .protected-image,
                .photo-wrapper img,
                .photo-card img,
                .gallery-grid img {
                    display: none !important;
                    visibility: hidden !important;
                    filter: blur(50px) !important;
                    opacity: 0 !important;
                }
                
                body::before {
                    content: "Images are protected by copyright and cannot be printed without permission";
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 24px;
                    font-weight: bold;
                    color: red;
                    z-index: 9999;
                }
            }
            
            /* Protection notice */
            .protection-notice {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 10000;
                animation: fadeInOut 3s ease;
                pointer-events: none;
            }
            
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
            
            /* Mobile-specific protection */
            @media (max-width: 768px) {
                .protected-image,
                .photo-wrapper img,
                .photo-card img {
                    -webkit-touch-callout: none !important;
                    -webkit-tap-highlight-color: transparent !important;
                }
            }
        `;
        document.head.appendChild(style);
        
        this.log('Protection CSS styles added');
    }
    
    /**
     * Initialize mobile app protection (Capacitor ready)
     */
    initMobileProtection() {
        // Check if running in Capacitor
        if (window.Capacitor) {
            this.log('Capacitor detected - enabling mobile protection');
            
            // Android FLAG_SECURE (prevents screenshots)
            if (window.Capacitor.getPlatform() === 'android') {
                if (window.Capacitor.Plugins && window.Capacitor.Plugins.ScreenProtection) {
                    window.Capacitor.Plugins.ScreenProtection.enable();
                    this.log('Android FLAG_SECURE enabled');
                }
            }
            
            // iOS screenshot detection
            if (window.Capacitor.getPlatform() === 'ios') {
                // Listen for screenshot events (requires custom plugin)
                if (window.Capacitor.Plugins && window.Capacitor.Plugins.ScreenshotDetector) {
                    window.Capacitor.Plugins.ScreenshotDetector.addListener('screenshotTaken', () => {
                        this.onScreenshotDetected();
                    });
                    this.log('iOS screenshot detection enabled');
                }
            }
        }
    }
    
    /**
     * Handle detected screenshot on mobile
     */
    onScreenshotDetected() {
        this.log('Screenshot detected!');
        this.showProtectionNotice('Screenshots are not allowed. Images are protected by copyright.');
        
        // Could implement more measures here:
        // - Log the event to server
        // - Temporarily hide images
        // - Show warning overlay
    }
    
    /**
     * Start monitoring for new images to protect
     */
    startImageMonitoring() {
        // Use MutationObserver to detect new images
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if it's an image or contains images
                        if (node.tagName === 'IMG') {
                            this.protectImage(node);
                        } else if (node.querySelectorAll) {
                            const images = node.querySelectorAll('img');
                            images.forEach(img => this.protectImage(img));
                        }
                    }
                });
            });
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also protect existing images
        document.querySelectorAll('img').forEach(img => this.protectImage(img));
        
        this.log('Image monitoring started');
    }
    
    /**
     * Apply protection to an individual image
     */
    protectImage(imgElement, isPurchased = false) {
        // Skip if already protected
        if (this.protectedImages.has(imgElement)) {
            return;
        }
        
        // Mark as protected
        this.protectedImages.add(imgElement);
        imgElement.classList.add('protected-image');
        
        // Check if image is purchased (from data attribute or other source)
        const photoId = imgElement.dataset.photoId;
        if (photoId && this.purchasedPhotos.has(photoId)) {
            isPurchased = true;
        }
        
        // CRITICAL FIX: Check if this is a legitimate download URL
        const isDownloadUrl = this.isLegitimateDownloadUrl(imgElement.src);
        
        // Get parent wrapper
        const wrapper = imgElement.closest('.photo-wrapper') || imgElement.parentElement;
        
        // Add protection overlay
        if (!wrapper.querySelector('.protection-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'protection-overlay';
            overlay.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showProtectionNotice('Right-click disabled for image protection');
                return false;
            });
            wrapper.style.position = 'relative';
            wrapper.appendChild(overlay);
        }
        
        // CRITICAL FIX: Apply protection based on purchase status, URL type, AND pricing model
        const pricingModel = this.sessionPolicy?.pricingModel || 'freemium';
        const isFreeModel = pricingModel === 'free';
        
        // For FREE pricing models, treat photos as "purchased" since they should be freely accessible
        const effectivelyPurchased = isPurchased || isFreeModel;
        
        if (!effectivelyPurchased && !isDownloadUrl) {
            // Add watermark for unpurchased photos (but not download URLs or FREE model photos)
            if (this.settings.useWatermarks && this.protectionEnabled) {
                this.addWatermarkOverlay(wrapper);
            }
            
            // Note: Removed blur effect and purchase overlay - users can now see watermarked previews directly
            // Server-side watermarked previews provide sufficient protection while allowing purchase decisions
            
            // Use blob URLs for enhanced protection (EXEMPT download URLs and FREE model photos)
            if (this.settings.useBlobUrls && this.protectionEnabled) {
                this.convertToBlobUrl(imgElement);
            }
        }
        
        // Prevent image dragging
        imgElement.draggable = false;
        imgElement.ondragstart = () => false;
        
        // Disable image selection
        imgElement.onselectstart = () => false;
        imgElement.onmousedown = () => false;
        
        this.log(`Protected image: ${imgElement.src.substring(0, 50)}...`);
    }
    
    /**
     * Add watermark overlay to element
     */
    addWatermarkOverlay(element) {
        // Skip if watermark already exists
        if (element.querySelector('.watermark-overlay')) {
            return;
        }
        
        const watermark = document.createElement('div');
        watermark.className = 'watermark-overlay';
        
        // Get watermark text from policy or use default
        const watermarkText = this.sessionPolicy?.watermarkText || 'PROOF';
        watermark.textContent = watermarkText;
        
        // Apply custom opacity if specified
        if (this.sessionPolicy?.watermarkOpacity) {
            watermark.style.opacity = (this.sessionPolicy.watermarkOpacity / 100).toString();
        }
        
        element.appendChild(watermark);
        this.log(`Watermark added: ${watermarkText}`);
    }
    
    /**
     * Add purchase overlay to element
     */
    addPurchaseOverlay(element) {
        // Skip if overlay already exists
        if (element.querySelector('.purchase-overlay')) {
            return;
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'purchase-overlay';
        overlay.innerHTML = `
            <div>🔒</div>
            <div>Purchase to View</div>
            <div style="font-size: 12px; margin-top: 5px; font-weight: normal;">
                Full quality available after purchase
            </div>
        `;
        element.appendChild(overlay);
    }
    
    /**
     * Check if URL is a legitimate download URL that should be exempt from protection
     */
    isLegitimateDownloadUrl(url) {
        if (!url) return false;
        
        // Check for download orchestrator URLs
        const downloadPatterns = [
            '/api/download/session/',
            '/api/downloads/orchestrator/',
            '/api/download/auth/session/',
            '/api/downloads/token/',
            // R2 signed URLs (CloudFlare R2)
            'https://pub-',
            // Common download URL parameters
            'download=true',
            'disposition=attachment',
            // File extension patterns for direct downloads
            '&download',
            '?download'
        ];
        
        // Check for explicit download patterns
        for (const pattern of downloadPatterns) {
            if (url.includes(pattern)) {
                this.log('Legitimate download URL detected, exempting from protection:', url.substring(0, 100));
                return true;
            }
        }
        
        // Check for R2 URLs with signed parameters (long query strings indicate signed URLs)
        try {
            const urlObj = new URL(url, window.location.origin);
            if (urlObj.searchParams.toString().length > 100) {
                // Long query strings typically indicate signed download URLs
                this.log('Signed URL detected (long query string), exempting from protection');
                return true;
            }
        } catch (e) {
            // If URL parsing fails, assume it's not a download URL
            this.log('URL parsing failed, treating as non-download:', e.message);
        }
        
        // Check for specific R2 domains and signed URL patterns
        if (url.match(/^https:\/\/[a-f0-9-]+\.r2\.cloudflarestorage\.com/)) {
            this.log('CloudFlare R2 URL detected, exempting from protection');
            return true;
        }
        
        return false;
    }
    
    /**
     * Restore original URL for purchased photos or download contexts
     */
    restoreOriginalUrl(imgElement) {
        const originalSrc = imgElement.dataset.originalSrc;
        if (originalSrc && originalSrc !== imgElement.src) {
            this.log('Restoring original URL for purchased/download photo:', originalSrc.substring(0, 100));
            
            // Revoke current blob URL if it exists
            if (imgElement.src.startsWith('blob:')) {
                URL.revokeObjectURL(imgElement.src);
                this.blobUrlCache.delete(originalSrc);
            }
            
            // Restore original URL
            imgElement.src = originalSrc;
            imgElement.removeAttribute('data-original-src');
            
            return true;
        }
        return false;
    }
    
    /**
     * Convert image to blob URL for protection
     */
    async convertToBlobUrl(imgElement) {
        try {
            const originalSrc = imgElement.src;
            
            // Skip if already a blob URL
            if (originalSrc.startsWith('blob:')) {
                return;
            }
            
            // Check cache
            if (this.blobUrlCache.has(originalSrc)) {
                imgElement.src = this.blobUrlCache.get(originalSrc);
                return;
            }
            
            // Fetch image as blob
            const response = await fetch(originalSrc);
            const blob = await response.blob();
            
            // Create blob URL
            const blobUrl = URL.createObjectURL(blob);
            
            // Cache it
            this.blobUrlCache.set(originalSrc, blobUrl);
            
            // Apply to image
            imgElement.src = blobUrl;
            
            // Store original source as data attribute
            imgElement.dataset.originalSrc = originalSrc;
            
            // Revoke blob URL after a delay to free memory
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
                this.blobUrlCache.delete(originalSrc);
            }, 300000); // 5 minutes
            
            this.log(`Converted to blob URL: ${originalSrc.substring(0, 50)}...`);
        } catch (error) {
            this.log(`Failed to convert to blob URL: ${error.message}`);
        }
    }
    
    /**
     * Show protection notice to user
     */
    showProtectionNotice(message) {
        // Remove existing notice
        const existingNotice = document.querySelector('.protection-notice');
        if (existingNotice) {
            existingNotice.remove();
        }
        
        // Create new notice
        const notice = document.createElement('div');
        notice.className = 'protection-notice';
        notice.textContent = message;
        document.body.appendChild(notice);
        
        // Remove after animation
        setTimeout(() => {
            notice.remove();
        }, 3000);
    }
    
    /**
     * Show console warning message
     */
    showConsoleWarning() {
        if (this.consoleWarningShown) {
            return;
        }
        
        const styles = [
            'color: red',
            'font-size: 24px',
            'font-weight: bold',
            'text-shadow: 2px 2px 4px rgba(0,0,0,0.5)'
        ].join(';');
        
        console.log('%c⚠️ STOP! ⚠️', styles);
        console.log('%cThis is a browser feature intended for developers.', 'color: red; font-size: 16px;');
        console.log('%cImages on this site are protected by copyright law.', 'color: #ff6b6b; font-size: 14px;');
        console.log('%cUnauthorized downloading or copying of images is illegal and may result in legal action.', 'color: #ff6b6b; font-size: 14px;');
        console.log('%c© All images are property of the photographer and protected under copyright law.', 'color: #666; font-size: 12px;');
        console.log('%cFor licensing inquiries, please contact the photographer directly.', 'color: #666; font-size: 12px;');
        
        this.consoleWarningShown = true;
    }
    
    /**
     * Update purchased photos list
     */
    updatePurchasedPhotos(photoIds) {
        photoIds.forEach(id => this.purchasedPhotos.add(id));
        this.log(`Updated purchased photos: ${photoIds.length} items`);
        
        // Update protection on existing images
        document.querySelectorAll(`img[data-photo-id]`).forEach(img => {
            const photoId = img.dataset.photoId;
            if (this.purchasedPhotos.has(photoId)) {
                // CRITICAL FIX: Restore original URL for purchased photos
                this.restoreOriginalUrl(img);
                
                // Remove heavy protection from purchased photos
                img.classList.remove('blur-unpurchased');
                const wrapper = img.closest('.photo-wrapper');
                if (wrapper) {
                    const purchaseOverlay = wrapper.querySelector('.purchase-overlay');
                    if (purchaseOverlay) {
                        purchaseOverlay.remove();
                    }
                    
                    // Remove watermark for purchased photos
                    const watermarkOverlay = wrapper.querySelector('.watermark-overlay');
                    if (watermarkOverlay) {
                        watermarkOverlay.remove();
                    }
                }
            }
        });
    }
    
    /**
     * Toggle protection on/off
     */
    toggleProtection(enabled) {
        this.protectionEnabled = enabled;
        
        if (enabled) {
            this.initProtection();
            document.querySelectorAll('img').forEach(img => this.protectImage(img));
        } else {
            // Remove protection classes
            document.querySelectorAll('.blur-unpurchased').forEach(el => {
                el.classList.remove('blur-unpurchased');
            });
            document.querySelectorAll('.purchase-overlay').forEach(el => el.remove());
            document.querySelectorAll('.watermark-overlay').forEach(el => el.remove());
        }
        
        this.log(`Protection ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Enable debugging mode for testing
     */
    enableDebugMode() {
        this.settings.consoleLogs = true;
        console.log('[Screenshot Protection] Debug mode enabled');
        console.log('[Screenshot Protection] Current settings:', this.settings);
        console.log('[Screenshot Protection] Purchased photos:', Array.from(this.purchasedPhotos));
        console.log('[Screenshot Protection] Protected images count:', this.protectedImages.size);
        console.log('[Screenshot Protection] Blob URL cache size:', this.blobUrlCache.size);
    }
    
    /**
     * Test URL patterns for debugging
     */
    testUrlPattern(url) {
        const isDownload = this.isLegitimateDownloadUrl(url);
        console.log(`[Screenshot Protection] URL Test: ${url} -> Download URL: ${isDownload}`);
        return isDownload;
    }
    
    /**
     * Utility logging function
     */
    log(...args) {
        if (this.settings.consoleLogs) {
            console.log('[Screenshot Protection]', ...args);
        }
    }
}

// Export for use in other scripts
window.ScreenshotProtection = ScreenshotProtection;

// Auto-initialize if on client gallery page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.pathname.includes('client-gallery')) {
            window.screenshotProtection = new ScreenshotProtection();
        }
    });
} else {
    if (window.location.pathname.includes('client-gallery')) {
        window.screenshotProtection = new ScreenshotProtection();
    }
}
// Photo For Sale Client-Side Functionality
// This script adds purchase options to photo blocks marked as "for sale"

(function() {
    'use strict';
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePhotoSales);
    } else {
        initializePhotoSales();
    }
    
    function initializePhotoSales() {
        console.log('🛒 Initializing photo sales functionality...');
        
        // Find all photo blocks marked as for-sale
        const forSalePhotos = document.querySelectorAll('.photo-block.for-sale');
        
        if (forSalePhotos.length === 0) {
            console.log('No for-sale photos found on this page');
            return;
        }
        
        console.log(`Found ${forSalePhotos.length} for-sale photo(s)`);
        
        // Add purchase functionality to each for-sale photo (async processing)
        Promise.all(Array.from(forSalePhotos).map(async (photoBlock, index) => {
            try {
                await addPurchaseOptions(photoBlock, index);
            } catch (error) {
                console.error(`Error processing photo ${index + 1}:`, error);
            }
        })).then(() => {
            console.log('✅ All for-sale photos processed');
        });
        
        // Add CSS for purchase options
        addSaleStyles();
    }
    
    async function addPurchaseOptions(photoBlock, index) {
        const img = photoBlock.querySelector('img');
        const caption = photoBlock.querySelector('.photo-caption');
        
        if (!img) {
            console.log('No image found in for-sale photo block');
            return;
        }
        
        // Get photo sale data from saved content or defaults
        const saleData = await extractSaleData(photoBlock);
        
        // Add mobile touch handler
        if (window.innerWidth <= 480) {
            img.addEventListener('click', () => {
                toggleMobileActionSheet(index);
            });
        }
        
        // Create gradient scrim overlay (non-blocking, max 35% height)
        const purchaseOverlay = document.createElement('div');
        purchaseOverlay.className = 'photo-purchase-scrim';
        
        // Create corner price badge
        const priceBadge = document.createElement('div');
        priceBadge.className = `price-badge ${saleData.isForSale ? 'paid' : 'free'}`;
        priceBadge.textContent = saleData.isForSale ? `$${saleData.basePrice.toFixed(2)}` : 'Free';
        
        // Create minimal action buttons in scrim
        const actionButtons = document.createElement('div');
        actionButtons.className = 'scrim-actions';
        actionButtons.innerHTML = `
            ${saleData.allowPrints ? `<button class="scrim-btn print-btn" onclick="startPrintOrder('${index}')" title="Order Prints">🖼️</button>` : ''}
            ${saleData.allowDigital ? `<button class="scrim-btn digital-btn" onclick="orderDigital('${index}')" title="Buy Digital ($${saleData.digitalPrice.toFixed(2)})">💾</button>` : ''}
            <button class="scrim-btn cart-btn" onclick="toggleCart('${index}')" title="Add to Cart">🛒</button>
        `;
        
        purchaseOverlay.appendChild(actionButtons);
        
        // Make photo block container relative for overlay positioning
        photoBlock.style.position = 'relative';
        
        // Add corner badge and scrim to photo block
        photoBlock.appendChild(priceBadge);
        photoBlock.appendChild(purchaseOverlay);
        
        // Store sale data on the photo block for easy access
        photoBlock.dataset.saleData = JSON.stringify(saleData);
        photoBlock.dataset.photoIndex = index;
        
        console.log(`Added purchase options to photo ${index + 1}:`, saleData);
    }
    
    async function extractSaleData(photoBlock) {
        const img = photoBlock.querySelector('img');
        if (!img || !img.src) {
            console.warn('⚠️ No image source found for photo block');
            return getDefaultSaleData();
        }
        
        try {
            const photoUrl = encodeURIComponent(img.src);
            
            console.log('💰 Fetching sale data from server:', { photoUrl: img.src });
            
            // Fetch sale data from server API (userId now derived from session)
            const response = await fetch(`/api/photo-sales/photo-settings/${photoUrl}`);
            
            if (!response.ok) {
                console.warn('⚠️ Failed to fetch sale settings, using defaults:', response.statusText);
                return getDefaultSaleData();
            }
            
            const settings = await response.json();
            
            if (settings.success && settings.isForSale) {
                console.log('✅ Loaded sale settings from server:', settings);
                
                return {
                    basePrice: Math.max(settings.minPrintPrice, 15.00), // Use server settings
                    allowPrints: settings.allowPrints,
                    allowDigital: settings.allowDigital,
                    digitalPrice: settings.digitalPrice,
                    printMarkupPercentage: settings.printMarkupPercentage,
                    minPrintPrice: settings.minPrintPrice,
                    isForSale: true
                };
            } else {
                // Photo is not configured for sale
                return { isForSale: false };
            }
            
        } catch (error) {
            console.error('❌ Error fetching sale data:', error);
            return getDefaultSaleData();
        }
    }
    
    function getDefaultSaleData() {
        return {
            basePrice: 15.00,
            allowPrints: true,
            allowDigital: true,
            digitalPrice: 25.00,
            isForSale: false // Default to not for sale
        };
    }
    
    function getCurrentUserId() {
        // Try to extract user ID from various sources
        if (typeof window.currentUser !== 'undefined' && window.currentUser) {
            return window.currentUser.id;
        }
        
        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser) {
            try {
                return JSON.parse(sessionUser).id;
            } catch (e) { /* ignore */ }
        }
        
        const userId = document.body.dataset.userId || document.documentElement.dataset.userId;
        if (userId) return userId;
        
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('userId') || urlParams.get('user') || null;
    }
    
    function addSaleStyles() {
        // Check if styles already added
        if (document.getElementById('photo-sale-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'photo-sale-styles';
        style.textContent = `
            /* Professional Preview Overlay System */
            .photo-purchase-scrim {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 35%; /* Limited to 35% of image height */
                background: linear-gradient(to top, 
                    rgba(0,0,0,0.75) 0%, 
                    rgba(0,0,0,0.4) 40%, 
                    transparent 100%);
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding: 16px;
                z-index: 5;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .photo-block.for-sale:hover .photo-purchase-scrim {
                opacity: 1;
            }
            
            /* Corner Price Badge */
            .price-badge {
                position: absolute;
                top: 12px;
                left: 12px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(8px);
                padding: 6px 12px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 0.85rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                z-index: 10;
                transition: all 0.3s ease;
            }
            
            .price-badge.free {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
            }
            
            .price-badge.paid {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white;
            }
            
            /* Scrim Action Buttons */
            .scrim-actions {
                display: flex;
                gap: 8px;
                justify-content: center;
                align-items: center;
            }
            
            .scrim-btn {
                width: 44px;
                height: 44px;
                border: none;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                color: #2d3748;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .scrim-btn:hover {
                transform: translateY(-2px) scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            }
            
            .scrim-btn.print-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .scrim-btn.digital-btn {
                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                color: white;
            }
            
            .scrim-btn.cart-btn {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white;
            }
            
            /* Mobile Optimization */
            @media (max-width: 768px) {
                .photo-purchase-scrim {
                    height: 40%; /* Slightly larger on mobile for easier touch */
                    background: linear-gradient(to top, 
                        rgba(0,0,0,0.85) 0%, 
                        rgba(0,0,0,0.5) 50%, 
                        transparent 100%);
                    opacity: 1; /* Always visible on mobile */
                }
                
                .price-badge {
                    top: 8px;
                    left: 8px;
                    font-size: 0.8rem;
                    padding: 4px 10px;
                }
                
                .scrim-actions {
                    gap: 12px; /* Larger gaps for easier touch */
                }
                
                .scrim-btn {
                    width: 48px; /* Larger touch targets */
                    height: 48px;
                    font-size: 20px;
                }
            }
            
            /* Mobile Action Sheet (for enhanced UX) */
            @media (max-width: 480px) {
                .photo-purchase-scrim {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: auto;
                    background: rgba(255, 255, 255, 0.98);
                    backdrop-filter: blur(20px);
                    border-radius: 16px 16px 0 0;
                    transform: translateY(100%);
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 -8px 32px rgba(0,0,0,0.15);
                    padding: 20px;
                    z-index: 1000;
                }
                
                .photo-block.for-sale.active .photo-purchase-scrim {
                    transform: translateY(0);
                }
                
                .scrim-actions {
                    justify-content: space-around;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                
                .scrim-btn {
                    width: 60px;
                    height: 60px;
                    font-size: 24px;
                    flex-direction: column;
                    gap: 4px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Cart management functions
    window.toggleCart = function(photoIndex) {
        console.log('🛒 Toggling cart for photo:', photoIndex);
        
        const photoBlock = document.querySelector(`[data-photo-index="${photoIndex}"]`);
        if (!photoBlock) return;
        
        const isInCart = photoBlock.classList.contains('in-cart');
        
        if (isInCart) {
            photoBlock.classList.remove('in-cart');
            console.log('✅ Removed from cart:', photoIndex);
        } else {
            photoBlock.classList.add('in-cart');
            console.log('✅ Added to cart:', photoIndex);
        }
        
        updateCartIndicator();
    };
    
    // Update cart indicator
    function updateCartIndicator() {
        const cartItems = document.querySelectorAll('.photo-block.in-cart').length;
        const cartBadge = document.querySelector('.cart-badge');
        
        if (cartBadge) {
            cartBadge.textContent = cartItems;
            cartBadge.style.display = cartItems > 0 ? 'block' : 'none';
        }
        
        // Update floating cart if present
        const floatingCart = document.querySelector('.floating-cart');
        if (floatingCart) {
            const badge = floatingCart.querySelector('.cart-count');
            if (badge) {
                badge.textContent = cartItems;
                badge.style.display = cartItems > 0 ? 'block' : 'none';
            }
        }
    }
    
    // Mobile action sheet toggle
    window.toggleMobileActionSheet = function(photoIndex) {
        const photoBlock = document.querySelector(`[data-photo-index="${photoIndex}"]`);
        if (!photoBlock) return;
        
        // Close other action sheets
        document.querySelectorAll('.photo-block.active').forEach(block => {
            if (block !== photoBlock) {
                block.classList.remove('active');
            }
        });
        
        photoBlock.classList.toggle('active');
    };
    
    // Show coming soon modal for WHCC features
    function showComingSoonModal(title, message) {
        // Remove any existing modal
        const existingModal = document.getElementById('coming-soon-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'coming-soon-modal';
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            ">
                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 500px;
                    margin: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: slideIn 0.3s ease;
                ">
                    <h2 style="
                        margin: 0 0 15px 0;
                        color: #333;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    ">
                        🚧 ${title}
                    </h2>
                    <p style="
                        margin: 0 0 25px 0;
                        color: #666;
                        line-height: 1.6;
                        font-size: 16px;
                    ">
                        ${message}
                    </p>
                    <button onclick="document.getElementById('coming-soon-modal').remove()" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: transform 0.2s;
                        width: 100%;
                    " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        Got It!
                    </button>
                </div>
            </div>
        `;
        
        // Add animation styles
        const animationStyle = document.createElement('style');
        animationStyle.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(animationStyle);
        
        // Add modal to body
        document.body.appendChild(modal);
        
        // Close modal on background click
        modal.addEventListener('click', function(e) {
            if (e.target === modal.firstElementChild) {
                modal.remove();
            }
        });
    }
    
    // Make showComingSoonModal globally available
    window.showComingSoonModal = showComingSoonModal;
    
    // Global functions for purchase actions
    window.startPrintOrder = async function(photoIndex) {
        const photoBlock = document.querySelector(`[data-photo-index="${photoIndex}"]`);
        if (!photoBlock) return;
        
        const img = photoBlock.querySelector('img');
        const saleData = JSON.parse(photoBlock.dataset.saleData);
        
        if (!img) {
            alert('Photo not available for ordering');
            return;
        }
        
        // Check if WHCC print fulfillment is available (using public status endpoint)
        try {
            const response = await fetch('/api/print/whcc-status');
            const result = await response.json();
            
            if (result.comingSoon) {
                // Show coming soon message with nice styling
                showComingSoonModal('Print Fulfillment Coming Soon!', 
                    result.message || 'We\'re working hard to bring you professional print ordering through WHCC. ' +
                    'This feature will be available soon with a wide selection of high-quality print products.');
                return;
            }
        } catch (error) {
            console.error('Error checking print availability:', error);
            // Show coming soon on error to avoid exposing issues
            showComingSoonModal('Print Fulfillment Coming Soon!', 
                'Print ordering service is being prepared. Please check back soon!');
            return;
        }
        
        // Create a professional print preview with WHCC integration
        const photoUrl = img.src;
        const filename = img.alt || `photo-${photoIndex + 1}.jpg`;
        
        console.log('🖼️ Starting print order for:', { photoUrl, filename, saleData });
        
        // Get gallery token from current page (available in client-gallery.html)
        const currentToken = window.galleryToken || 
                           (window.location.pathname.split('/').pop()) || 
                           new URLSearchParams(window.location.search).get('token');
        
        // Open print preview page with WHCC product selection
        const previewUrl = `/print-preview-pro.html?photo=${encodeURIComponent(photoUrl)}&filename=${encodeURIComponent(filename)}&basePrice=${saleData.basePrice}&token=${encodeURIComponent(currentToken)}`;
        
        // Open in same window for better experience
        window.location.href = previewUrl;
    };
    
    window.orderDigital = async function(photoIndex) {
        const photoBlock = document.querySelector(`[data-photo-index="${photoIndex}"]`);
        if (!photoBlock) return;
        
        const img = photoBlock.querySelector('img');
        const saleData = JSON.parse(photoBlock.dataset.saleData);
        
        if (!img) {
            alert('Photo not available for purchase');
            return;
        }
        
        console.log('💾 Starting digital order for photo:', photoIndex + 1);
        
        // Get session information
        const sessionId = getSessionId();
        const galleryToken = getGalleryToken();
        const clientKey = await generateClientKey(galleryToken, sessionId);
        
        if (!sessionId || !galleryToken) {
            console.warn('⚠️ Missing session info, falling back to standard purchase modal');
            showDigitalPurchaseModal(img.src, img.alt || `photo-${photoIndex + 1}.jpg`, saleData.digitalPrice);
            return;
        }
        
        // Try freemium mode first - check for immediate free download using orchestrator
        try {
            console.log('🎯 Checking for freemium mode free download...');
            
            const photoId = img.src.split('/').pop().split('?')[0]; // Extract actual filename from src
            const filename = img.alt || `photo-${photoIndex + 1}.jpg`; // For download filename only
            
            // Use orchestrator endpoint with real photo identifier (properly URL-encoded)
            const orchestratorUrl = `/api/downloads/orchestrator/session/${sessionId}/file/${encodeURIComponent(photoId)}?token=${galleryToken}`;
            
            const response = await fetch(orchestratorUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/octet-stream, application/json'
                }
            });
            
            // Check if response is JSON (error) or binary (success)
            const contentType = response.headers.get('content-type');
            
            if (response.ok && contentType && !contentType.includes('application/json')) {
                // Successful download - trigger immediate download
                console.log('🆓 Free download granted via orchestrator');
                
                // Create blob URL and trigger download
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                
                // Show success message
                showFreeDownloadSuccess({ downloadUrl: orchestratorUrl }, { quotaUsed: 1 });
                
                // Trigger download immediately
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Clean up blob URL
                setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);
                
                return;
            } else {
                // Parse error response or handle failed download
                let result = {};
                try {
                    result = await response.json();
                } catch (e) {
                    result = { error: `HTTP ${response.status}: ${response.statusText}` };
                }
                
                console.log('💰 Free downloads not available:', result.error || result);
                
                // Check if it's specifically because free limit exceeded
                if (result.error && result.error.includes('Free download limit exceeded')) {
                    showFreemiumLimitMessage(result.freeDownloads, result.usedDownloads);
                }
            }
        } catch (error) {
            console.error('❌ Error checking free download via orchestrator:', error);
        }
        
        // Fall back to standard purchase modal
        console.log('💳 Falling back to standard purchase flow');
        showDigitalPurchaseModal(img.src, img.alt || `photo-${photoIndex + 1}.jpg`, saleData.digitalPrice);
    };
    
    function showDigitalPurchaseModal(photoUrl, filename, price) {
        // Create modal for digital purchase
        const modal = document.createElement('div');
        modal.className = 'digital-purchase-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>💾 Purchase Digital Download</h2>
                    <button class="close-modal" onclick="this.closest('.digital-purchase-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <img src="${photoUrl}" alt="${filename}" style="max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px;">
                    <h3>${filename}</h3>
                    <p>High-resolution digital download</p>
                    <div class="price-info">
                        <span class="price">$${price.toFixed(2)}</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="cancel-btn" onclick="this.closest('.digital-purchase-modal').remove()">Cancel</button>
                    <button class="purchase-digital-btn" onclick="processDigitalPurchase('${photoUrl}', '${filename}', ${price})">
                        Purchase Digital Download
                    </button>
                </div>
            </div>
        `;
        
        // Add modal styles
        const modalStyle = document.createElement('style');
        modalStyle.textContent = `
            .digital-purchase-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                padding: 20px;
            }
            
            .modal-content {
                background: white;
                border-radius: 15px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h2 {
                margin: 0;
                color: #2d3748;
            }
            
            .close-modal {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #718096;
            }
            
            .modal-body {
                padding: 20px;
                text-align: center;
            }
            
            .modal-body h3 {
                margin: 15px 0 5px;
                color: #2d3748;
            }
            
            .modal-body p {
                color: #718096;
                margin-bottom: 20px;
            }
            
            .price-info {
                background: #f7fafc;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
            }
            
            .price {
                font-size: 24px;
                font-weight: 700;
                color: #48bb78;
            }
            
            .modal-footer {
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .cancel-btn {
                padding: 10px 20px;
                border: 2px solid #e2e8f0;
                background: white;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            }
            
            .purchase-digital-btn {
                padding: 10px 20px;
                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            }
            
            .purchase-digital-btn:hover {
                transform: translateY(-1px);
            }
        `;
        
        document.head.appendChild(modalStyle);
        document.body.appendChild(modal);
    }
    
    // Helper functions for freemium mode
    function getSessionId() {
        // Try multiple ways to get session ID
        if (typeof window.sessionData !== 'undefined' && window.sessionData && window.sessionData.id) {
            return window.sessionData.id;
        }
        
        // Try URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id') || urlParams.get('sessionId');
        if (sessionId) return sessionId;
        
        // Try extracting from current URL path
        const pathParts = window.location.pathname.split('/');
        const galleryIndex = pathParts.findIndex(part => part === 'gallery');
        if (galleryIndex !== -1 && pathParts[galleryIndex + 1]) {
            return pathParts[galleryIndex + 1];
        }
        
        return null;
    }
    
    function getGalleryToken() {
        // Try multiple ways to get gallery token
        if (typeof window.galleryToken !== 'undefined' && window.galleryToken) {
            return window.galleryToken;
        }
        
        // Try URL parameters  
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) return token;
        
        // Try extracting from path (last segment if it looks like a token)
        const pathParts = window.location.pathname.split('/');
        const lastSegment = pathParts[pathParts.length - 1];
        if (lastSegment && lastSegment.length > 10 && !lastSegment.includes('.')) {
            return lastSegment;
        }
        
        return null;
    }
    
    /**
     * AUTHORITATIVE CLIENT KEY GENERATION
     * Generate client key using IDENTICAL logic to server
     * CRITICAL: Must match server's generateGalleryClientKey function exactly
     */
    async function generateClientKey(galleryToken, sessionId) {
        if (!galleryToken || !sessionId) {
            throw new Error('Gallery token and session ID are required for client key generation');
        }
        
        // CRITICAL: Use ONLY gallery token + session ID (no IP, no user agent, no other identifiers)
        // This ensures both server and client can generate the exact same key deterministically
        const baseString = `${galleryToken}-${sessionId}`;
        
        // Create a SHA-256 hash for the final client key
        const hashHex = await sha256(baseString);
        const clientKey = `gallery-${hashHex.substring(0, 16)}`;
        
        console.log(`🔑 Generated authoritative client key: ${clientKey} for gallery token: ${galleryToken.substring(0, 8)}...`);
        
        return clientKey;
    }
    
    /**
     * Simple SHA-256 implementation for client-side key generation
     */
    async function sha256(message) {
        // Use Web Crypto API for SHA-256 hashing
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
    
    function showFreeDownloadSuccess(entitlement, quotaInfo) {
        // Create success notification
        const notification = document.createElement('div');
        notification.className = 'free-download-success';
        notification.innerHTML = `
            <div class="success-content">
                <div class="success-icon">🆓</div>
                <h3>Free Download Started!</h3>
                <p>Your download should begin automatically.</p>
                <div class="quota-info">
                    ${quotaInfo.remaining} of ${quotaInfo.total} free downloads remaining
                </div>
                <button onclick="this.closest('.free-download-success').remove()">Close</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .free-download-success {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                color: white;
                padding: 20px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                z-index: 10000;
                animation: slideIn 0.3s ease;
                max-width: 300px;
            }
            
            .success-content {
                text-align: center;
            }
            
            .success-icon {
                font-size: 2rem;
                margin-bottom: 10px;
            }
            
            .success-content h3 {
                margin: 0 0 10px;
                font-size: 1.2rem;
            }
            
            .success-content p {
                margin: 0 0 15px;
                opacity: 0.9;
            }
            
            .quota-info {
                background: rgba(255,255,255,0.2);
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 0.9rem;
                margin-bottom: 15px;
            }
            
            .success-content button {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
            }
            
            .success-content button:hover {
                background: rgba(255,255,255,0.3);
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    function showFreemiumLimitMessage(freeDownloads, usedDownloads) {
        // Create limit message
        const notification = document.createElement('div');
        notification.className = 'freemium-limit-message';
        notification.innerHTML = `
            <div class="limit-content">
                <div class="limit-icon">⚠️</div>
                <h3>Free Downloads Used</h3>
                <p>You've used all ${freeDownloads} free downloads.</p>
                <p>Additional downloads require payment.</p>
                <button onclick="this.closest('.freemium-limit-message').remove()">Continue to Purchase</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .freemium-limit-message {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white;
                padding: 20px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                z-index: 10000;
                animation: slideIn 0.3s ease;
                max-width: 300px;
            }
            
            .limit-content {
                text-align: center;
            }
            
            .limit-icon {
                font-size: 2rem;
                margin-bottom: 10px;
            }
            
            .limit-content h3 {
                margin: 0 0 10px;
                font-size: 1.2rem;
            }
            
            .limit-content p {
                margin: 0 0 10px;
                opacity: 0.9;
                font-size: 0.9rem;
            }
            
            .limit-content button {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 10px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                margin-top: 10px;
            }
            
            .limit-content button:hover {
                background: rgba(255,255,255,0.3);
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 8000);
    }

    window.processDigitalPurchase = async function(photoUrl, filename, price) {
        console.log('💳 Processing digital purchase:', { photoUrl, filename, price });
        
        try {
            // Get session information for purchase tracking
            const sessionId = getSessionId();
            const galleryToken = getGalleryToken();
            
            if (!sessionId || !galleryToken) {
                console.warn('⚠️ Missing session info for purchase tracking');
            }
            
            // Call API to create Stripe payment for digital download
            const response = await fetch('/api/print/digital-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photoUrl,
                    filename,
                    price,
                    type: 'digital',
                    sessionId,
                    galleryToken
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.checkoutUrl) {
                    // Redirect to Stripe checkout
                    window.location.href = result.checkoutUrl;
                } else if (result.downloadUrl) {
                    // Direct download available
                    alert('✅ Purchase successful! Your download will start shortly.');
                    window.open(result.downloadUrl, '_blank');
                    document.querySelector('.digital-purchase-modal').remove();
                } else {
                    throw new Error('No checkout URL or download URL provided');
                }
            } else {
                throw new Error('Payment processing failed');
            }
        } catch (error) {
            console.error('❌ Digital purchase failed:', error);
            alert('Purchase failed. Please try again or contact support.');
        }
    };
    
    console.log('✅ Photo sales functionality loaded');
})();
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
        
        // Create purchase overlay
        const purchaseOverlay = document.createElement('div');
        purchaseOverlay.className = 'photo-purchase-overlay';
        purchaseOverlay.innerHTML = `
            <div class="purchase-controls">
                <div class="price-display">Starting at $${saleData.basePrice.toFixed(2)}</div>
                <div class="purchase-buttons">
                    ${saleData.allowPrints ? `<button class="purchase-btn print-btn" onclick="startPrintOrder('${index}')">🖼️ Order Prints</button>` : ''}
                    ${saleData.allowDigital ? `<button class="purchase-btn digital-btn" onclick="orderDigital('${index}')">💾 Buy Digital ($${saleData.digitalPrice.toFixed(2)})</button>` : ''}
                </div>
            </div>
        `;
        
        // Make photo block container relative for overlay positioning
        photoBlock.style.position = 'relative';
        
        // Add overlay to photo block
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
            /* Photo Purchase Overlay Styles */
            .photo-purchase-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
                padding: 20px;
                transform: translateY(100%);
                transition: transform 0.3s ease;
                z-index: 10;
            }
            
            .photo-block.for-sale:hover .photo-purchase-overlay {
                transform: translateY(0);
            }
            
            .purchase-controls {
                text-align: center;
            }
            
            .price-display {
                color: white;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .purchase-buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .purchase-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 120px;
            }
            
            .print-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .print-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            .digital-btn {
                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                color: white;
            }
            
            .digital-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .photo-purchase-overlay {
                    position: static;
                    transform: none;
                    background: rgba(0,0,0,0.8);
                    margin-top: 10px;
                    border-radius: 8px;
                }
                
                .purchase-buttons {
                    flex-direction: column;
                }
                
                .purchase-btn {
                    width: 100%;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
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
    
    window.orderDigital = function(photoIndex) {
        const photoBlock = document.querySelector(`[data-photo-index="${photoIndex}"]`);
        if (!photoBlock) return;
        
        const img = photoBlock.querySelector('img');
        const saleData = JSON.parse(photoBlock.dataset.saleData);
        
        if (!img) {
            alert('Photo not available for purchase');
            return;
        }
        
        console.log('💾 Starting digital order for photo:', photoIndex + 1);
        
        // Create digital purchase modal
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
    
    window.processDigitalPurchase = async function(photoUrl, filename, price) {
        console.log('💳 Processing digital purchase:', { photoUrl, filename, price });
        
        try {
            // Call API to create Stripe payment for digital download
            const response = await fetch('/api/print/digital-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photoUrl,
                    filename,
                    price,
                    type: 'digital'
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
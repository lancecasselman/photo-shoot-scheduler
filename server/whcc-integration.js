// WHCC Print Lab Integration Service
// Enables subscribers to offer direct print ordering from client galleries

const { pool } = require('./db');

class WHCCIntegrationService {
    constructor() {
        this.whccBaseURL = 'https://api.whcc.com/v1';
        this.defaultPrintProducts = [
            {
                id: 'prints_4x6',
                name: '4x6 Print',
                category: 'prints',
                basePrice: 0.89,
                description: 'Professional photo print'
            },
            {
                id: 'prints_5x7',
                name: '5x7 Print',
                category: 'prints',
                basePrice: 1.49,
                description: 'Professional photo print'
            },
            {
                id: 'prints_8x10',
                name: '8x10 Print',
                category: 'prints',
                basePrice: 3.99,
                description: 'Professional photo print'
            },
            {
                id: 'canvas_8x10',
                name: '8x10 Canvas',
                category: 'canvas',
                basePrice: 24.99,
                description: 'Gallery wrapped canvas'
            },
            {
                id: 'canvas_11x14',
                name: '11x14 Canvas',
                category: 'canvas',
                basePrice: 39.99,
                description: 'Gallery wrapped canvas'
            },
            {
                id: 'metal_8x10',
                name: '8x10 Metal Print',
                category: 'metal',
                basePrice: 34.99,
                description: 'Vibrant metal print'
            }
        ];
    }

    // Enable WHCC integration for a subscriber
    async enableWHCCForSubscriber(userId, whccCredentials = null) {
        try {
            const integrationSettings = {
                enabled: true,
                whccCredentials: whccCredentials, // Their WHCC account details
                markup: 2.0, // 100% markup default
                enabledProducts: this.defaultPrintProducts.map(p => p.id),
                customMessage: 'Order professional prints directly from your gallery!',
                enabledAt: new Date().toISOString()
            };

            await pool.query(`
                INSERT INTO subscriber_whcc_settings (
                    user_id, 
                    settings, 
                    created_at, 
                    updated_at
                ) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET 
                    settings = $2,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, JSON.stringify(integrationSettings)]);

            console.log(`✅ WHCC integration enabled for subscriber ${userId}`);
            return true;

        } catch (error) {
            console.error('Error enabling WHCC integration:', error);
            return false;
        }
    }

    // Get WHCC settings for a subscriber
    async getWHCCSettings(userId) {
        try {
            const result = await pool.query(`
                SELECT settings FROM subscriber_whcc_settings 
                WHERE user_id = $1
            `, [userId]);

            if (result.rows.length > 0) {
                return JSON.parse(result.rows[0].settings);
            }

            return null;

        } catch (error) {
            console.error('Error getting WHCC settings:', error);
            return null;
        }
    }

    // Generate print ordering UI for gallery
    generatePrintOrderingUI(photoUrl, photoId, subscriberUserId) {
        return `
            <div class="whcc-print-ordering" data-photo-id="${photoId}" data-photo-url="${photoUrl}">
                <div class="print-section-header">
                    <h3>📸 Order Professional Prints</h3>
                    <p>High-quality prints delivered directly to your door</p>
                </div>
                
                <div class="print-products-grid">
                    ${this.defaultPrintProducts.map(product => `
                        <div class="print-product-card" data-product-id="${product.id}">
                            <div class="product-info">
                                <h4>${product.name}</h4>
                                <p class="product-description">${product.description}</p>
                                <div class="product-price">
                                    $<span class="price-amount" data-base-price="${product.basePrice}">
                                        ${(product.basePrice * 2).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <div class="product-actions">
                                <div class="quantity-selector">
                                    <button class="qty-btn" onclick="changeQuantity('${product.id}', -1)">-</button>
                                    <input type="number" id="qty-${product.id}" value="1" min="1" max="50">
                                    <button class="qty-btn" onclick="changeQuantity('${product.id}', 1)">+</button>
                                </div>
                                <button class="add-to-cart-btn" onclick="addToCart('${product.id}', '${photoId}')">
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="cart-summary" id="cart-summary" style="display: none;">
                    <h4>Your Order</h4>
                    <div id="cart-items"></div>
                    <div class="cart-total">
                        <strong>Total: $<span id="cart-total">0.00</span></strong>
                    </div>
                    <button class="checkout-btn" onclick="proceedToCheckout()">
                        Proceed to Checkout
                    </button>
                </div>
            </div>
        `;
    }

    // Generate print ordering JavaScript
    generatePrintOrderingJS() {
        return `
            <script>
                let cart = [];
                
                function changeQuantity(productId, change) {
                    const qtyInput = document.getElementById('qty-' + productId);
                    let newQty = parseInt(qtyInput.value) + change;
                    if (newQty < 1) newQty = 1;
                    if (newQty > 50) newQty = 50;
                    qtyInput.value = newQty;
                }
                
                function addToCart(productId, photoId) {
                    const qtyInput = document.getElementById('qty-' + productId);
                    const quantity = parseInt(qtyInput.value);
                    const priceElement = document.querySelector('[data-product-id="' + productId + '"] .price-amount');
                    const price = parseFloat(priceElement.getAttribute('data-base-price')) * 2; // Apply markup
                    
                    const existingItem = cart.find(item => item.productId === productId && item.photoId === photoId);
                    
                    if (existingItem) {
                        existingItem.quantity += quantity;
                    } else {
                        cart.push({
                            productId,
                            photoId,
                            quantity,
                            price,
                            name: document.querySelector('[data-product-id="' + productId + '"] h4').textContent
                        });
                    }
                    
                    updateCartDisplay();
                    showMessage('Added to cart!', 'success');
                }
                
                function updateCartDisplay() {
                    const cartSummary = document.getElementById('cart-summary');
                    const cartItems = document.getElementById('cart-items');
                    const cartTotal = document.getElementById('cart-total');
                    
                    if (cart.length === 0) {
                        cartSummary.style.display = 'none';
                        return;
                    }
                    
                    cartSummary.style.display = 'block';
                    
                    cartItems.innerHTML = cart.map(item => 
                        '<div class="cart-item">' +
                            '<span>' + item.name + ' x' + item.quantity + '</span>' +
                            '<span>$' + (item.price * item.quantity).toFixed(2) + '</span>' +
                        '</div>'
                    ).join('');
                    
                    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    cartTotal.textContent = total.toFixed(2);
                }
                
                async function proceedToCheckout() {
                    if (cart.length === 0) {
                        showMessage('Your cart is empty', 'error');
                        return;
                    }
                    
                    try {
                        showMessage('Redirecting to WHCC checkout...', 'info');
                        
                        const response = await fetch('/api/whcc/create-order', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                cart,
                                sessionToken: new URLSearchParams(window.location.search).get('token')
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Redirect to WHCC checkout
                            window.open(result.checkoutUrl, '_blank');
                        } else {
                            showMessage('Error creating order: ' + result.error, 'error');
                        }
                        
                    } catch (error) {
                        console.error('Checkout error:', error);
                        showMessage('Error processing checkout', 'error');
                    }
                }
                
                function showMessage(message, type) {
                    // Use existing message system if available
                    if (typeof window.showMessage === 'function') {
                        window.showMessage(message, type);
                    } else {
                        alert(message);
                    }
                }
            </script>
        `;
    }

    // Generate CSS for print ordering UI
    generatePrintOrderingCSS() {
        return `
            <style>
                .whcc-print-ordering {
                    background: white;
                    border-radius: 12px;
                    padding: 25px;
                    margin-top: 30px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }
                
                .print-section-header {
                    text-align: center;
                    margin-bottom: 25px;
                }
                
                .print-section-header h3 {
                    color: #2d3748;
                    margin-bottom: 8px;
                }
                
                .print-section-header p {
                    color: #666;
                    font-size: 14px;
                }
                
                .print-products-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-bottom: 25px;
                }
                
                .print-product-card {
                    border: 2px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 20px;
                    transition: all 0.3s ease;
                }
                
                .print-product-card:hover {
                    border-color: #d4af37;
                    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.2);
                }
                
                .product-info h4 {
                    color: #2d3748;
                    margin-bottom: 5px;
                }
                
                .product-description {
                    color: #666;
                    font-size: 13px;
                    margin-bottom: 10px;
                }
                
                .product-price {
                    font-size: 18px;
                    font-weight: 600;
                    color: #d4af37;
                    margin-bottom: 15px;
                }
                
                .product-actions {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .quantity-selector {
                    display: flex;
                    align-items: center;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    overflow: hidden;
                }
                
                .qty-btn {
                    background: #f7fafc;
                    border: none;
                    padding: 8px 12px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background 0.2s;
                }
                
                .qty-btn:hover {
                    background: #e2e8f0;
                }
                
                .quantity-selector input {
                    border: none;
                    width: 50px;
                    text-align: center;
                    padding: 8px 4px;
                    font-size: 14px;
                }
                
                .add-to-cart-btn {
                    background: #d4af37;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    flex: 1;
                }
                
                .add-to-cart-btn:hover {
                    background: #b8941f;
                    transform: translateY(-1px);
                }
                
                .cart-summary {
                    background: #f7fafc;
                    border-radius: 8px;
                    padding: 20px;
                    margin-top: 20px;
                }
                
                .cart-summary h4 {
                    color: #2d3748;
                    margin-bottom: 15px;
                }
                
                .cart-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .cart-total {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 2px solid #e2e8f0;
                    font-size: 18px;
                    text-align: right;
                }
                
                .checkout-btn {
                    background: #48bb78;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    width: 100%;
                    margin-top: 15px;
                    font-size: 16px;
                    transition: all 0.3s ease;
                }
                
                .checkout-btn:hover {
                    background: #38a169;
                    transform: translateY(-1px);
                }
                
                @media (max-width: 768px) {
                    .print-products-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .product-actions {
                        flex-direction: column;
                        gap: 10px;
                    }
                    
                    .quantity-selector {
                        width: 100%;
                        justify-content: center;
                    }
                }
            </style>
        `;
    }

    // Create WHCC order via API
    async createWHCCOrder(orderData, subscriberUserId) {
        try {
            const whccSettings = await this.getWHCCSettings(subscriberUserId);
            if (!whccSettings || !whccSettings.enabled) {
                throw new Error('WHCC integration not enabled for this subscriber');
            }

            // This would integrate with actual WHCC API
            // For now, return a mock checkout URL
            const mockCheckoutUrl = `https://checkout.whcc.com/order/${Date.now()}`;

            // Store order in database for tracking
            await pool.query(`
                INSERT INTO whcc_orders (
                    subscriber_id,
                    order_data,
                    whcc_order_id,
                    status,
                    created_at
                ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            `, [
                subscriberUserId,
                JSON.stringify(orderData),
                `whcc_${Date.now()}`,
                'pending'
            ]);

            return {
                success: true,
                checkoutUrl: mockCheckoutUrl,
                orderId: `whcc_${Date.now()}`
            };

        } catch (error) {
            console.error('Error creating WHCC order:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Check if subscriber has WHCC enabled
    async isWHCCEnabled(userId) {
        const settings = await this.getWHCCSettings(userId);
        return settings && settings.enabled;
    }
}

module.exports = { WHCCIntegrationService };
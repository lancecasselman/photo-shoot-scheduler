/**
 * Frontend subscription access guard
 * Checks subscription status and redirects users without active subscriptions
 */

class SubscriptionAccessGuard {
    constructor() {
        this.subscriptionStatus = null;
        this.checkInProgress = false;
    }

    async init() {
        // Check subscription status on page load
        await this.checkSubscriptionStatus();
        this.setupEventListeners();
        this.guardMainAppAccess();
    }

    async checkSubscriptionStatus() {
        if (this.checkInProgress) return;
        this.checkInProgress = true;

        try {
            const response = await fetch('/api/subscription-status');
            const data = await response.json();

            if (response.ok) {
                this.subscriptionStatus = data.status;
                return data;
            } else if (response.status === 401) {
                // Not authenticated - redirect to login
                this.redirectToAuth();
                return null;
            } else {
                console.error('Failed to check subscription status:', data.error);
                return null;
            }
        } catch (error) {
            console.error('Error checking subscription status:', error);
            return null;
        } finally {
            this.checkInProgress = false;
        }
    }

    guardMainAppAccess() {
        // Only run on main app pages (not landing, auth, etc.)
        const protectedPages = ['/', '/index.html'];
        const currentPath = window.location.pathname;

        if (protectedPages.includes(currentPath)) {
            this.enforceSubscriptionAccess();
        }
    }

    async enforceSubscriptionAccess() {
        const status = await this.checkSubscriptionStatus();

        if (!status) return; // Auth check failed, already redirected

        // Check if user has active professional plan
        if (!status.hasProfessionalPlan || status.professionalStatus !== 'active') {
            this.showSubscriptionRequiredModal(status);
            return;
        }

        // User has active subscription - allow access
        this.enableAppFeatures();
    }

    showSubscriptionRequiredModal(status) {
        // Create subscription required modal
        const modal = document.createElement('div');
        modal.className = 'subscription-required-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🔒 Subscription Required</h2>
                    </div>
                    <div class="modal-body">
                        ${this.getSubscriptionMessage(status)}
                        <div class="current-status">
                            <h4>Current Status:</h4>
                            <p><strong>Professional Plan:</strong> ${status.hasProfessionalPlan ? 'Yes' : 'No'}</p>
                            <p><strong>Status:</strong> ${status.professionalStatus || 'None'}</p>
                            <p><strong>Storage:</strong> ${status.totalStorageGb || 0}GB</p>
                            <p><strong>Monthly Total:</strong> $${(status.monthlyTotal || 0).toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="window.location.href='/subscription-checkout.html'">
                            Subscribe Now - $39/month
                        </button>
                        <button class="btn-secondary" onclick="this.closest('.subscription-required-modal').remove()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles
        if (!document.getElementById('subscription-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'subscription-modal-styles';
            styles.textContent = `
                .subscription-required-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                }
                
                .modal-overlay {
                    background: rgba(0, 0, 0, 0.8);
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                
                .modal-content {
                    background: white;
                    border-radius: 12px;
                    max-width: 500px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                
                .modal-header {
                    padding: 30px 30px 20px;
                    border-bottom: 1px solid #e9ecef;
                    text-align: center;
                }
                
                .modal-header h2 {
                    color: #495057;
                    margin: 0;
                    font-size: 1.5rem;
                }
                
                .modal-body {
                    padding: 30px;
                }
                
                .modal-body p {
                    color: #6c757d;
                    line-height: 1.6;
                    margin-bottom: 20px;
                }
                
                .current-status {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                
                .current-status h4 {
                    color: #495057;
                    margin-bottom: 10px;
                }
                
                .current-status p {
                    margin: 5px 0;
                    font-size: 0.9rem;
                }
                
                .modal-actions {
                    padding: 20px 30px 30px;
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #c4962d 0%, #f4e06d 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(196, 150, 45, 0.3);
                }
                
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .btn-secondary:hover {
                    background: #5a6268;
                }
                
                @media (max-width: 768px) {
                    .modal-actions {
                        flex-direction: column;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(modal);

        // Disable main app functionality
        this.disableAppFeatures();
    }

    getSubscriptionMessage(status) {
        if (!status.hasProfessionalPlan) {
            return `
                <p>You need an active <strong>Professional Plan</strong> to access the Photography Management Platform.</p>
                <p>The Professional Plan includes:</p>
                <ul>
                    <li>✅ Complete session management</li>
                    <li>✅ Client galleries and portfolios</li>
                    <li>✅ Invoice and payment processing</li>
                    <li>✅ Contract management</li>
                    <li>✅ 100GB cloud storage</li>
                    <li>✅ Website builder</li>
                    <li>✅ Community platform access</li>
                </ul>
            `;
        } else if (status.professionalStatus !== 'active') {
            return `
                <p>Your Professional Plan subscription is currently <strong>${status.professionalStatus}</strong>.</p>
                <p>Please reactivate your subscription to continue using the platform.</p>
            `;
        }
        
        return '<p>There was an issue verifying your subscription. Please try again.</p>';
    }

    enableAppFeatures() {
        // Remove any subscription modals
        const modals = document.querySelectorAll('.subscription-required-modal');
        modals.forEach(modal => modal.remove());

        // Enable app functionality
        document.body.classList.remove('subscription-disabled');
        
        console.log('✅ Subscription verified - app features enabled');
    }

    disableAppFeatures() {
        // Disable main app functionality by adding CSS class
        document.body.classList.add('subscription-disabled');
        
        // Prevent form submissions and key interactions
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', this.preventAction);
        });
        
        console.log('🔒 App features disabled - subscription required');
    }

    preventAction(event) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    redirectToAuth() {
        if (window.location.pathname !== '/auth.html') {
            window.location.href = '/auth.html';
        }
    }

    setupEventListeners() {
        // Check subscription status when user comes back to tab
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkSubscriptionStatus();
            }
        });

        // Periodically check subscription status (every 5 minutes)
        setInterval(() => {
            this.checkSubscriptionStatus();
        }, 5 * 60 * 1000);
    }
}

// Initialize subscription guard IMMEDIATELY - don't wait for DOM
(function() {
    console.log('🔐 Subscription guard initializing...');
    
    // Hide the app immediately until subscription is verified
    const style = document.createElement('style');
    style.id = 'subscription-block';
    style.textContent = `
        body { 
            display: none !important; 
            opacity: 0 !important;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.documentElement.appendChild(style);
    }
    
    // Create guard instance
    window.subscriptionGuard = new SubscriptionAccessGuard();
    
    // Run subscription check immediately
    async function checkSubscriptionNow() {
        console.log('🔐 Running subscription check...');
        try {
            // Check if we're on a protected page
            const protectedPages = ['/', '/index.html'];
            const currentPath = window.location.pathname;
            
            console.log('🔐 Current path:', currentPath);
            
            if (!protectedPages.includes(currentPath)) {
                console.log('🔐 Not a protected page, allowing access');
                const blockStyle = document.getElementById('subscription-block');
                if (blockStyle) blockStyle.remove();
                document.body.style.display = '';
                document.body.style.opacity = '';
                return;
            }
            
            console.log('🔐 Protected page detected, checking authentication...');
            
            // Check authentication first
            const authResponse = await fetch('/api/check-auth');
            if (!authResponse.ok) {
                console.log('🔐 Not authenticated, redirecting to login');
                window.location.href = '/auth.html';
                return;
            }
            
            console.log('🔐 User authenticated, checking admin status...');
            
            // Admin whitelist bypass
            const whitelistedEmails = [
                'lancecasselman@icloud.com',
                'lancecasselman2011@gmail.com', 
                'lance@thelegacyphotography.com'
            ];
            
            // Check current user email
            const userResponse = await fetch('/api/current-user');
            if (userResponse.ok) {
                const userData = await userResponse.json();
                console.log('🔐 User email:', userData.email);
                if (userData.email && whitelistedEmails.includes(userData.email)) {
                    console.log('✅ Admin account detected - bypassing subscription check');
                    const blockStyle = document.getElementById('subscription-block');
                    if (blockStyle) blockStyle.remove();
                    document.body.style.display = '';
                    document.body.style.opacity = '';
                    return;
                }
            }
            
            console.log('🔐 Not admin, checking subscription status...');
            
            // Check subscription status
            const subResponse = await fetch('/api/subscription-status');
            const data = await subResponse.json();
            
            console.log('🔐 Subscription data:', data.status);
            
            if (!data.status || !data.status.hasProfessionalPlan || data.status.professionalStatus !== 'active') {
                // No active subscription - redirect immediately
                console.log('🔒 No active subscription detected - blocking access');
                console.log('🔒 Redirecting to subscription checkout...');
                window.location.href = '/subscription-checkout.html?message=subscription_required';
                return;
            }
            
            // User has subscription - show the app
            console.log('✅ Subscription verified - allowing access');
            const blockStyle = document.getElementById('subscription-block');
            if (blockStyle) blockStyle.remove();
            document.body.style.display = '';
            document.body.style.opacity = '';
            
        } catch (error) {
            console.error('🔐 Subscription check error:', error);
            // On error, redirect to auth for safety
            window.location.href = '/auth.html';
        }
    }
    
    // Run the check immediately - don't wait for anything
    console.log('🔐 Starting immediate subscription check');
    checkSubscriptionNow();
    
    // Also run when DOM is ready (backup)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.subscriptionGuard.init();
        });
    } else {
        setTimeout(() => window.subscriptionGuard.init(), 100);
    }
})();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubscriptionAccessGuard;
}
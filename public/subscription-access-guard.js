/**
 * Enhanced Frontend Access Guard with 3-Day Trial Support
 * Checks subscription and trial status, handles access restrictions
 */

class SubscriptionAccessGuard {
    constructor() {
        this.subscriptionStatus = null;
        this.trialStatus = null;
        this.checkInProgress = false;
        this.trialBanner = null;
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
                this.trialStatus = data.trialStatus;
                
                // Update trial banner if user is on trial
                this.updateTrialBanner(data);
                
                return data;
            } else if (response.status === 401) {
                // Not authenticated - redirect to login
                this.redirectToAuth();
                return null;
            } else if (response.status === 402 && data.trialExpired) {
                // Trial has expired - show expiration message
                this.handleTrialExpired(data);
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
        // Skip subscription checks on actual landing page and auth pages only
        const currentPath = window.location.pathname;
        const authPages = ['/secure-login.html', '/auth.html', '/auth', '/login'];
        
        // Check if this is the real landing page (not the app served at root)
        const isLandingPage = document.querySelector('.landing-hero') || document.querySelector('.pricing-section') || document.title.includes('Complete Business Platform');
        
        if (authPages.includes(currentPath) || (currentPath === '/' && isLandingPage)) {
            console.log('Skipping subscription check for:', currentPath);
            return;
        }

        // Enforce subscription on all app pages
        this.enforceSubscriptionAccess();
    }

    async enforceSubscriptionAccess() {
        const status = await this.checkSubscriptionStatus();

        if (!status) return; // Auth check failed, already redirected

        // Check if user has access (either paid subscription or active trial)
        if (status.hasAccess) {
            // User has valid access (paid or trial)
            this.enableAppFeatures();
            
            // Show trial banner if on trial
            if (status.isTrial) {
                this.showTrialBanner(status);
            }
            return;
        }

        // No valid access - show appropriate modal
        if (status.trialStatus && status.trialStatus.reason === 'trial_expired') {
            this.showTrialExpiredModal(status);
        } else {
            this.showSubscriptionRequiredModal(status);
        }
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
                            <p><strong>Storage:</strong> ${status.totalStorageGb}GB</p>
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
        if (window.location.pathname !== '/secure-login.html') {
            window.location.href = '/secure-login.html';
        }
    }

    // NEW TRIAL SYSTEM METHODS
    
    updateTrialBanner(data) {
        if (data.isTrial && data.trialStatus && data.trialStatus.hoursRemaining > 0) {
            this.showTrialBanner(data);
        } else {
            this.hideTrialBanner();
        }
    }
    
    showTrialBanner(data) {
        // Remove existing banner
        this.hideTrialBanner();
        
        const hoursLeft = data.trialStatus.hoursRemaining;
        const daysLeft = Math.ceil(hoursLeft / 24);
        
        let bannerClass = 'trial-banner';
        let urgencyMessage = '';
        
        if (hoursLeft <= 24) {
            bannerClass += ' urgent';
            urgencyMessage = hoursLeft <= 1 ? 
                `⏰ Less than 1 hour remaining!` : 
                `⏰ ${hoursLeft} hours remaining!`;
        } else {
            urgencyMessage = `${daysLeft} days remaining in your free trial`;
        }
        
        this.trialBanner = document.createElement('div');
        this.trialBanner.className = bannerClass;
        this.trialBanner.innerHTML = `
            <div class="trial-banner-content">
                <div class="trial-info">
                    <span class="trial-icon">🆓</span>
                    <span class="trial-message">${urgencyMessage}</span>
                </div>
                <button class="trial-upgrade-btn" onclick="window.location.href='/subscription-checkout.html'">
                    Upgrade Now - $39/month
                </button>
                <button class="trial-close-btn" onclick="this.closest('.trial-banner').style.display='none'">
                    ×
                </button>
            </div>
        `;
        
        // Add banner styles if not already present
        if (!document.getElementById('trial-banner-styles')) {
            const styles = document.createElement('style');
            styles.id = 'trial-banner-styles';
            styles.textContent = `
                .trial-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                    color: white;
                    z-index: 9999;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    animation: slideDown 0.3s ease-out;
                }
                
                .trial-banner.urgent {
                    background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
                    animation: pulseUrgent 2s infinite;
                }
                
                .trial-banner-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .trial-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .trial-icon {
                    font-size: 1.2rem;
                }
                
                .trial-message {
                    font-weight: 600;
                    font-size: 0.95rem;
                }
                
                .trial-upgrade-btn {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: 2px solid white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    backdrop-filter: blur(10px);
                }
                
                .trial-upgrade-btn:hover {
                    background: white;
                    color: #28a745;
                    transform: translateY(-1px);
                }
                
                .urgent .trial-upgrade-btn:hover {
                    color: #dc3545;
                }
                
                .trial-close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    margin-left: 10px;
                    opacity: 0.7;
                    transition: opacity 0.3s ease;
                }
                
                .trial-close-btn:hover {
                    opacity: 1;
                }
                
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
                
                @keyframes pulseUrgent {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                
                @media (max-width: 768px) {
                    .trial-banner-content {
                        flex-direction: column;
                        gap: 10px;
                        padding: 15px;
                        text-align: center;
                    }
                    
                    .trial-upgrade-btn {
                        order: -1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.insertBefore(this.trialBanner, document.body.firstChild);
        
        // Adjust body padding to account for banner
        document.body.style.paddingTop = '60px';
    }
    
    hideTrialBanner() {
        if (this.trialBanner) {
            this.trialBanner.remove();
            this.trialBanner = null;
            document.body.style.paddingTop = '';
        }
    }
    
    showTrialExpiredModal(status) {
        const modal = document.createElement('div');
        modal.className = 'subscription-required-modal trial-expired';
        
        const expiredHours = status.trialStatus ? status.trialStatus.expiredHours : 0;
        const expiredTime = expiredHours > 24 ? 
            `${Math.floor(expiredHours / 24)} days ago` : 
            `${expiredHours} hours ago`;
        
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>⏰ Trial Period Ended</h2>
                    </div>
                    <div class="modal-body">
                        <p>Your 3-day free trial expired <strong>${expiredTime}</strong>.</p>
                        <p>Subscribe now to restore full access to your photography business platform:</p>
                        
                        <div class="trial-expired-features">
                            <h4>🔒 Currently Blocked:</h4>
                            <ul>
                                <li>Session management</li>
                                <li>Photo uploads and galleries</li>
                                <li>Client communications</li>
                                <li>Invoice generation</li>
                                <li>Website builder</li>
                            </ul>
                        </div>
                        
                        <div class="upgrade-offer">
                            <h4>💎 Professional Plan - $39/month</h4>
                            <p>Full platform access + 100GB storage</p>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="window.location.href='/subscription-checkout.html'">
                            Subscribe Now - Restore Access
                        </button>
                        <button class="btn-secondary" onclick="window.location.href='/secure-login.html?action=logout'">
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add specific styles for expired trial modal
        if (!document.getElementById('trial-expired-styles')) {
            const styles = document.createElement('style');
            styles.id = 'trial-expired-styles';
            styles.textContent = `
                .trial-expired .modal-header {
                    background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
                    color: white;
                }
                
                .trial-expired-features {
                    background: #fff5f5;
                    border-left: 4px solid #dc3545;
                    padding: 15px;
                    margin: 20px 0;
                }
                
                .trial-expired-features h4 {
                    color: #dc3545;
                    margin-bottom: 10px;
                }
                
                .trial-expired-features ul {
                    list-style: none;
                    padding-left: 0;
                }
                
                .trial-expired-features li {
                    padding: 5px 0;
                    color: #721c24;
                }
                
                .upgrade-offer {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    margin: 20px 0;
                }
                
                .upgrade-offer h4 {
                    color: #c4962d;
                    margin-bottom: 5px;
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(modal);
        this.disableAppFeatures();
    }
    
    handleTrialExpired(data) {
        console.log('🚫 Trial expired - blocking access');
        this.hideTrialBanner();
        this.showTrialExpiredModal({ trialStatus: data });
        this.disableAppFeatures();
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

// Initialize subscription guard on page load
document.addEventListener('DOMContentLoaded', () => {
    window.subscriptionGuard = new SubscriptionAccessGuard();
    window.subscriptionGuard.init();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubscriptionAccessGuard;
}
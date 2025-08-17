// Safari Session Persistence Fix for Replit
// This addresses Safari's restrictive cookie handling in development environments

class SafariSessionManager {
    constructor() {
        this.sessionKey = 'photoapp_session';
        this.userKey = 'photoapp_user';
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        // Detect Safari browser
        this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        this.isReplit = window.location.hostname.includes('replit');
        
        if (this.isSafari && this.isReplit) {
            console.log('🔧 Safari + Replit detected - enabling session persistence fix');
            this.enableSafariSessionFix();
        }
        
        this.initialized = true;
    }

    enableSafariSessionFix() {
        // Store user data in localStorage as backup for Safari
        const originalFetch = window.fetch;
        
        window.fetch = async function(url, options = {}) {
            const response = await originalFetch(url, options);
            
            // Intercept successful auth responses
            if (url.includes('/api/auth/firebase-verify') && response.ok) {
                try {
                    const data = await response.clone().json();
                    if (data.success && data.user) {
                        // Store user data in localStorage for Safari
                        localStorage.setItem('safari_user_backup', JSON.stringify(data.user));
                        console.log('🔧 Safari: User data backed up to localStorage');
                    }
                } catch (e) {
                    // Ignore errors - this is just a backup mechanism
                }
            }
            
            return response;
        };

        // Add session restoration on page load
        window.addEventListener('load', () => {
            this.restoreSessionForSafari();
        });
    }

    async restoreSessionForSafari() {
        try {
            // Check if session is working normally first
            const response = await fetch('/api/auth/user', { credentials: 'include' });
            
            if (!response.ok) {
                // Session failed - try to restore from localStorage
                const backupUser = localStorage.getItem('safari_user_backup');
                if (backupUser) {
                    const userData = JSON.parse(backupUser);
                    console.log('🔧 Safari: Attempting session restoration from localStorage');
                    
                    // Try to re-verify with Firebase
                    const verifyResponse = await fetch('/api/auth/firebase-verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(userData)
                    });
                    
                    if (verifyResponse.ok) {
                        console.log('🔧 Safari: Session restored successfully');
                        // Trigger a page refresh to load authenticated content
                        window.location.reload();
                    }
                }
            }
        } catch (error) {
            console.log('🔧 Safari session restoration error:', error);
        }
    }

    clearBackup() {
        localStorage.removeItem('safari_user_backup');
    }
}

// Initialize Safari session manager
const safariSessionManager = new SafariSessionManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => safariSessionManager.init());
} else {
    safariSessionManager.init();
}

// Export for manual use
window.safariSessionManager = safariSessionManager;
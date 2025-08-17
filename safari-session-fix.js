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
        // Show prominent Safari warning
        this.showSafariWarning();
        
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
    
    showSafariWarning() {
        // Create Safari-specific warning banner
        const banner = document.createElement('div');
        banner.id = 'safari-session-warning';
        banner.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                color: white;
                padding: 12px 20px;
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border-bottom: 3px solid #c0392b;
            ">
                <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 15px;">
                    <span style="font-size: 18px;">⚠️</span>
                    <span>Safari on Mac detected! For best experience, <strong>open this app in a new tab</strong> - sessions may not work properly in the preview pane.</span>
                    <button onclick="window.open(window.location.href, '_blank')" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                        padding: 6px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 600;
                        margin-left: 10px;
                    ">Open in New Tab</button>
                    <button onclick="this.closest('#safari-session-warning').remove()" style="
                        background: transparent;
                        border: none;
                        color: white;
                        cursor: pointer;
                        font-size: 16px;
                        padding: 4px 8px;
                        margin-left: 5px;
                    ">×</button>
                </div>
            </div>
        `;
        
        // Add to body
        document.body.insertBefore(banner, document.body.firstChild);
        
        // Add body padding to account for banner
        document.body.style.paddingTop = '60px';
    }

    async restoreSessionForSafari() {
        try {
            // Check if session is working normally first
            const response = await fetch('/api/auth/user', { 
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!response.ok || response.status === 401) {
                // Session failed - try to restore from localStorage
                const backupUser = localStorage.getItem('safari_user_backup');
                if (backupUser) {
                    const userData = JSON.parse(backupUser);
                    console.log('🔧 Safari: Attempting session restoration from localStorage');
                    
                    // Clear any existing broken session first
                    document.cookie = 'connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    
                    // Try to re-verify with Firebase
                    const verifyResponse = await fetch('/api/auth/firebase-verify', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                        credentials: 'include',
                        body: JSON.stringify(userData)
                    });
                    
                    if (verifyResponse.ok) {
                        console.log('🔧 Safari: Session restored successfully');
                        // Wait a moment for session to be established
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Verify session works before reloading
                        const testResponse = await fetch('/api/auth/user', { 
                            credentials: 'include',
                            headers: { 'Cache-Control': 'no-cache' }
                        });
                        
                        if (testResponse.ok) {
                            console.log('🔧 Safari: Session verification successful, reloading page');
                            window.location.reload();
                        } else {
                            console.log('🔧 Safari: Session still not working after restoration');
                        }
                    } else {
                        console.log('🔧 Safari: Session restoration failed');
                    }
                }
            } else {
                console.log('🔧 Safari: Session is working normally');
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
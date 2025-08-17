// Replit Preview Pane Fix
// Detects if running in Replit's iframe preview and shows user-friendly message

function detectReplitIframe() {
    try {
        // Check if we're in an iframe
        const inIframe = window !== window.top;
        
        // Check if parent is Replit's preview pane
        const isReplitPreview = inIframe && (
            window.location.hostname.includes('replit.dev') ||
            window.location.hostname.includes('replit.app') ||
            document.referrer.includes('replit.com')
        );
        
        if (isReplitPreview) {
            console.log('🔧 Detected Replit preview pane - session cookies may not work properly');
            
            // Show user-friendly message after auth attempts fail
            setTimeout(() => {
                if (document.querySelector('.auth-div:not([style*="none"])')) {
                    showReplitPreviewMessage();
                }
            }, 5000);
        }
        
        return isReplitPreview;
    } catch (error) {
        console.log('Frame detection error:', error);
        return false;
    }
}

function showReplitPreviewMessage() {
    const existingMessage = document.getElementById('replit-preview-notice');
    if (existingMessage) return; // Don't show multiple times
    
    const message = document.createElement('div');
    message.id = 'replit-preview-notice';
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2a2a2a;
        color: #f0f0f0;
        padding: 20px;
        border-radius: 8px;
        border: 2px solid #d4af37;
        max-width: 350px;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    message.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #d4af37;">
            🔧 Replit Preview Issue
        </div>
        <div style="margin-bottom: 15px;">
            Session cookies don't work properly in Replit's preview pane. 
        </div>
        <button onclick="window.open(window.location.href, '_blank'); this.parentElement.remove();" 
                style="background: #d4af37; color: black; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">
            Open in New Tab
        </button>
        <button onclick="this.parentElement.remove();" 
                style="background: transparent; color: #999; border: 1px solid #666; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 10px;">
            Dismiss
        </button>
    `;
    
    document.body.appendChild(message);
}

// Initialize detection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectReplitIframe);
} else {
    detectReplitIframe();
}
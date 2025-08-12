// Avatar Utility Functions - Prevent 404 errors and provide fallbacks
class AvatarUtils {
    static generateInitialsAvatar(name, size = 40) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = size;
        canvas.height = size;
        
        // Background color based on name hash
        const hash = this.simpleHash(name);
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        const bgColor = colors[hash % colors.length];
        
        // Fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        
        // Add initials
        const initials = this.getInitials(name);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${size * 0.4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, size / 2, size / 2);
        
        return canvas.toDataURL();
    }
    
    static getInitials(name) {
        if (!name) return '?';
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }
    
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    
    static createAvatarElement(user, size = 40) {
        const img = document.createElement('img');
        img.className = 'user-avatar';
        img.width = size;
        img.height = size;
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        
        // Use photo URL if available, otherwise generate initials
        if (user.photoURL && !user.photoURL.includes('gravatar.com')) {
            img.src = user.photoURL;
            img.onerror = () => {
                img.src = this.generateInitialsAvatar(user.displayName || user.email, size);
            };
        } else {
            img.src = this.generateInitialsAvatar(user.displayName || user.email, size);
        }
        
        return img;
    }
    
    static replaceGravatarImages() {
        // Find all gravatar images and replace them with fallbacks
        const gravatarImages = document.querySelectorAll('img[src*="gravatar.com"]');
        gravatarImages.forEach(img => {
            const userName = img.alt || img.getAttribute('data-user') || 'User';
            img.src = this.generateInitialsAvatar(userName, img.width || 40);
            img.onerror = null; // Remove error handler to prevent loops
        });
    }
    
    static preventGravatarErrors() {
        // Global error handler for gravatar images
        document.addEventListener('error', (e) => {
            if (e.target.tagName === 'IMG' && e.target.src.includes('gravatar.com')) {
                const userName = e.target.alt || e.target.getAttribute('data-user') || 'User';
                e.target.src = this.generateInitialsAvatar(userName, e.target.width || 40);
                e.target.onerror = null; // Prevent error loops
            }
        }, true);
    }
}

// Initialize on page load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        AvatarUtils.preventGravatarErrors();
        AvatarUtils.replaceGravatarImages();
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AvatarUtils;
} else if (typeof window !== 'undefined') {
    window.AvatarUtils = AvatarUtils;
}
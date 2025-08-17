// Iframe Authentication Fix
// This script bypasses the session cookie issue in iframe contexts

// Store authentication token in multiple places for redundancy
function storeAuthToken(userData) {
    const authData = {
        ...userData,
        timestamp: Date.now(),
        token: btoa(JSON.stringify(userData)) // Simple encoding
    };
    
    localStorage.setItem('photoapp_auth_token', JSON.stringify(authData));
    sessionStorage.setItem('photoapp_auth_token', JSON.stringify(authData));
    
    // Also store in a global variable for immediate access
    window.PhotoAppAuth = authData;
    
    console.log('Auth token stored for iframe compatibility');
}

// Retrieve authentication token
function getAuthToken() {
    try {
        // Try global first (fastest)
        if (window.PhotoAppAuth && isTokenValid(window.PhotoAppAuth)) {
            return window.PhotoAppAuth;
        }
        
        // Try localStorage
        const localAuth = localStorage.getItem('photoapp_auth_token');
        if (localAuth) {
            const parsed = JSON.parse(localAuth);
            if (isTokenValid(parsed)) {
                window.PhotoAppAuth = parsed; // Cache it
                return parsed;
            }
        }
        
        // Try sessionStorage
        const sessionAuth = sessionStorage.getItem('photoapp_auth_token');
        if (sessionAuth) {
            const parsed = JSON.parse(sessionAuth);
            if (isTokenValid(parsed)) {
                window.PhotoAppAuth = parsed; // Cache it
                return parsed;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error retrieving auth token:', error);
        return null;
    }
}

// Check if token is still valid (24 hours)
function isTokenValid(authData) {
    if (!authData || !authData.timestamp) return false;
    const age = Date.now() - authData.timestamp;
    return age < (24 * 60 * 60 * 1000); // 24 hours
}

// Clear authentication token
function clearAuthToken() {
    localStorage.removeItem('photoapp_auth_token');
    sessionStorage.removeItem('photoapp_auth_token');
    delete window.PhotoAppAuth;
    console.log('Auth token cleared');
}

// Enhanced fetch function that includes authentication
async function authenticatedFetch(url, options = {}) {
    const authToken = getAuthToken();
    
    if (authToken) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${authToken.token}`,
            'X-Auth-UID': authToken.uid,
            'X-Auth-Email': authToken.email
        };
    }
    
    options.credentials = 'include'; // Still try cookies as backup
    
    return fetch(url, options);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.IframeAuth = {
        storeAuthToken,
        getAuthToken,
        clearAuthToken,
        authenticatedFetch,
        isTokenValid
    };
}
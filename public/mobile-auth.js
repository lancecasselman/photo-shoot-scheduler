/**
 * Mobile-specific Firebase authentication handler
 * Handles iOS Safari and mobile browser authentication flows
 */

class MobileAuthHandler {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isCapacitor = window.Capacitor !== undefined;
        console.log('Mobile auth handler initialized:', { isMobile: this.isMobile, isCapacitor: this.isCapacitor });
    }

    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isAndroid = /Android/i.test(userAgent);
        const isCapacitor = window.Capacitor !== undefined;
        
        console.log('🔍 MOBILE DETECTION:', { 
            userAgent, 
            isMobile, 
            isAndroid, 
            isCapacitor 
        });
        
        return isMobile;
    }

    detectAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    async initializeAuth() {
        if (!window.firebaseAuth) {
            console.error('❌ Firebase auth not initialized');
            return false;
        }

        // Configure auth for mobile with enhanced Android support
        if (this.isMobile) {
            try {
                const isAndroid = this.detectAndroid();
                
                console.log('📱 MOBILE AUTH INIT:', { 
                    isMobile: this.isMobile, 
                    isAndroid, 
                    isCapacitor: this.isCapacitor 
                });

                // Enable persistence for mobile
                await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                
                // Use device language
                firebase.auth().useDeviceLanguage();
                
                // Android-specific configuration
                if (isAndroid) {
                    console.log('🤖 ANDROID: Applying Android-specific auth settings');
                    
                    // Set additional timeout for Android
                    firebase.auth().timeout = 30000;
                }
                
                console.log('✅ Mobile Firebase auth configured successfully');
                return true;
            } catch (error) {
                console.error('❌ Error configuring mobile auth:', error);
                return false;
            }
        }
        
        return true;
    }

    async signInWithGoogle() {
        if (!window.firebaseAuth) {
            throw new Error('Firebase auth not initialized');
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');

        try {
            // For mobile devices, prefer redirect over popup
            if (this.isMobile || this.isCapacitor) {
                console.log('Using redirect method for mobile authentication');
                await firebase.auth().signInWithRedirect(provider);
                return { success: true, method: 'redirect' };
            } else {
                // Desktop - try popup first, fallback to redirect
                try {
                    const result = await firebase.auth().signInWithPopup(provider);
                    return { success: true, method: 'popup', user: result.user };
                } catch (popupError) {
                    console.log('Popup blocked, falling back to redirect');
                    await firebase.auth().signInWithRedirect(provider);
                    return { success: true, method: 'redirect' };
                }
            }
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    async handleRedirectResult() {
        if (!window.firebaseAuth) {
            console.error('Firebase auth not initialized');
            return null;
        }

        try {
            const result = await firebase.auth().getRedirectResult();
            if (result && result.user) {
                console.log('Redirect authentication successful:', result.user.email);
                return result.user;
            }
            return null;
        } catch (error) {
            console.error('Error handling redirect result:', error);
            throw error;
        }
    }

    onAuthStateChanged(callback) {
        if (!window.firebaseAuth) {
            console.error('Firebase auth not initialized');
            return;
        }

        return firebase.auth().onAuthStateChanged(callback);
    }

    async signOut() {
        if (!window.firebaseAuth) {
            console.error('Firebase auth not initialized');
            return;
        }

        try {
            await firebase.auth().signOut();
            console.log('User signed out successfully');
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    }
}

// Initialize mobile auth handler
window.mobileAuth = new MobileAuthHandler();

// Wait for Firebase to be ready, then initialize
function waitForFirebaseAndInitialize() {
    if (window.firebaseInitialized && window.firebaseAuth) {
        window.mobileAuth.initializeAuth();
        
        // Handle redirect result on page load
        window.mobileAuth.handleRedirectResult().then(user => {
            if (user) {
                console.log('Redirect authentication completed for:', user.email);
                // Redirect to main app or refresh page
                if (window.location.pathname.includes('auth.html')) {
                    window.location.href = '/';
                }
            }
        }).catch(error => {
            console.error('Error handling redirect result:', error);
        });
    } else {
        // Wait a bit more for Firebase to initialize
        setTimeout(waitForFirebaseAndInitialize, 100);
    }
}

// Start initialization
waitForFirebaseAndInitialize();
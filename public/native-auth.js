// Native Authentication Handler for iOS
// Handles authentication for both web and native iOS environments

class NativeAuthHandler {
    constructor() {
        this.isCapacitor = this.detectCapacitor();
        this.isIOS = this.detectIOS();
        this.currentUser = null;
        this.sessionCheckInterval = null;
        
        console.log('NativeAuthHandler initialized:', {
            isCapacitor: this.isCapacitor,
            isIOS: this.isIOS,
            userAgent: navigator.userAgent
        });
    }

    detectCapacitor() {
        return window.Capacitor !== undefined;
    }

    detectIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    // Initialize authentication system
    async initialize() {
        try {
            // For iOS/Capacitor, use native authentication flow
            if (this.isCapacitor || this.isIOS) {
                console.log('Initializing iOS native authentication...');
                await this.initializeNativeAuth();
            } else {
                console.log('Initializing web authentication...');
                await this.initializeWebAuth();
            }
            
            // Set up session monitoring
            this.startSessionMonitoring();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize authentication:', error);
            return false;
        }
    }

    // Native iOS authentication using Firebase
    async initializeNativeAuth() {
        try {
            // Initialize Firebase with environment variables
            const firebaseConfig = {
                apiKey: window.VITE_FIREBASE_API_KEY || 'AIzaSyDUrKzJb_0wt4KRhR1vBLCB1Jyb5gEWSJ4',
                authDomain: 'photoshcheduleapp.firebaseapp.com',
                projectId: window.VITE_FIREBASE_PROJECT_ID || 'photoshcheduleapp',
                storageBucket: 'photoshcheduleapp.appspot.com',
                messagingSenderId: '1080892259604',
                appId: window.VITE_FIREBASE_APP_ID || '1:1080892259604:web:8198de9d7da81c684c1601'
            };

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            // Listen for authentication state changes
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('Native iOS user authenticated:', user.email);
                    await this.handleNativeUserLogin(user);
                } else {
                    console.log('No native iOS user signed in');
                    this.currentUser = null;
                }
            });

            // Check for existing session
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                await this.handleNativeUserLogin(currentUser);
            }
        } catch (error) {
            console.error('Native auth initialization failed:', error);
            throw error;
        }
    }

    // Web authentication flow
    async initializeWebAuth() {
        try {
            // Check for existing session via API
            const response = await fetch('/api/auth/session', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.user) {
                    this.currentUser = data.user;
                    console.log('Web session restored:', data.user.email);
                }
            }
        } catch (error) {
            console.error('Web auth check failed:', error);
        }
    }

    // Handle native iOS user login
    async handleNativeUserLogin(firebaseUser) {
        try {
            // Get the ID token
            const idToken = await firebaseUser.getIdToken();
            
            // Create session on backend
            const response = await fetch('/api/auth/mobile-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    isIOS: true
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                console.log('Native iOS session created successfully');
                
                // Store token locally for iOS
                if (this.isCapacitor) {
                    await this.storeNativeToken(idToken);
                }
                
                return true;
            } else {
                console.error('Failed to create native session:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Native user login handling failed:', error);
            return false;
        }
    }

    // Store authentication token for native iOS
    async storeNativeToken(token) {
        try {
            // Use localStorage as fallback for now
            localStorage.setItem('ios_auth_token', token);
            localStorage.setItem('ios_auth_timestamp', Date.now().toString());
            console.log('Native token stored');
        } catch (error) {
            console.error('Failed to store native token:', error);
        }
    }

    // Retrieve stored native token
    async getNativeToken() {
        try {
            const token = localStorage.getItem('ios_auth_token');
            const timestamp = localStorage.getItem('ios_auth_timestamp');
            
            if (token && timestamp) {
                // Check if token is less than 1 hour old
                const age = Date.now() - parseInt(timestamp);
                if (age < 3600000) { // 1 hour in milliseconds
                    return token;
                }
            }
            
            // Try to refresh token
            const user = firebase.auth().currentUser;
            if (user) {
                const newToken = await user.getIdToken(true);
                await this.storeNativeToken(newToken);
                return newToken;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get native token:', error);
            return null;
        }
    }

    // Sign in with Google (native iOS)
    async signInWithGoogle() {
        try {
            if (this.isCapacitor || this.isIOS) {
                console.log('Starting native iOS Google sign-in...');
                
                // Use Firebase Google provider
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');
                
                // For iOS, use signInWithRedirect or signInWithPopup
                if (this.isIOS) {
                    // iOS Safari handles redirects better
                    await firebase.auth().signInWithRedirect(provider);
                } else {
                    // Desktop browsers can use popup
                    const result = await firebase.auth().signInWithPopup(provider);
                    await this.handleNativeUserLogin(result.user);
                }
                
                return true;
            } else {
                // Web authentication flow
                window.location.href = '/auth.html';
                return true;
            }
        } catch (error) {
            console.error('Google sign-in failed:', error);
            throw error;
        }
    }

    // Sign out
    async signOut() {
        try {
            // Sign out from Firebase
            if (firebase.auth().currentUser) {
                await firebase.auth().signOut();
            }
            
            // Clear native tokens
            if (this.isCapacitor || this.isIOS) {
                localStorage.removeItem('ios_auth_token');
                localStorage.removeItem('ios_auth_timestamp');
            }
            
            // Clear backend session
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            this.currentUser = null;
            console.log('User signed out successfully');
            
            // Redirect to login
            window.location.href = '/auth.html';
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Make authenticated API request
    async makeAuthenticatedRequest(url, options = {}) {
        try {
            // Add authentication headers for iOS
            if (this.isCapacitor || this.isIOS) {
                const token = await this.getNativeToken();
                if (token) {
                    options.headers = {
                        ...options.headers,
                        'Authorization': `Bearer ${token}`
                    };
                }
            }
            
            // Always include credentials for session cookies
            options.credentials = 'include';
            
            const response = await fetch(url, options);
            
            // Handle authentication errors
            if (response.status === 401) {
                console.log('Authentication expired, refreshing...');
                
                if (this.isCapacitor || this.isIOS) {
                    // Try to refresh Firebase token
                    const user = firebase.auth().currentUser;
                    if (user) {
                        await this.handleNativeUserLogin(user);
                        // Retry request
                        return this.makeAuthenticatedRequest(url, options);
                    }
                }
                
                // Redirect to login
                this.signOut();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('Authenticated request failed:', error);
            throw error;
        }
    }

    // Monitor session status
    startSessionMonitoring() {
        // Check session every 5 minutes
        this.sessionCheckInterval = setInterval(async () => {
            try {
                if (this.isCapacitor || this.isIOS) {
                    // Check Firebase auth state
                    const user = firebase.auth().currentUser;
                    if (!user) {
                        console.log('iOS session expired');
                        this.currentUser = null;
                    }
                } else {
                    // Check web session
                    const response = await fetch('/api/auth/session', {
                        credentials: 'include'
                    });
                    
                    if (!response.ok) {
                        console.log('Web session expired');
                        this.currentUser = null;
                    }
                }
            } catch (error) {
                console.error('Session check failed:', error);
            }
        }, 300000); // 5 minutes
    }

    // Stop session monitoring
    stopSessionMonitoring() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
    }
}

// Create global instance
window.nativeAuth = new NativeAuthHandler();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NativeAuthHandler;
}
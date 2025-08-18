// iOS Authentication Bridge
// Handles authentication flow between iOS WebView and Firebase

(function() {
    // Detect iOS WebView environment
    const isIOSWebView = () => {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /iPhone|iPad|iPod/i.test(userAgent) && 
               /AppleWebKit/i.test(userAgent) && 
               !/Safari/i.test(userAgent);
    };

    // Initialize authentication on iOS
    async function initIOSAuth() {
        console.log('Initializing iOS authentication bridge...');
        
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded yet, waiting...');
            setTimeout(initIOSAuth, 100);
            return;
        }

        // Initialize Firebase with environment variables
        const firebaseConfig = {
            apiKey: 'AIzaSyDUrKzJb_0wt4KRhR1vBLCB1Jyb5gEWSJ4',
            authDomain: 'photoshcheduleapp.firebaseapp.com',
            projectId: 'photoshcheduleapp',
            storageBucket: 'photoshcheduleapp.appspot.com',
            messagingSenderId: '1080892259604',
            appId: '1:1080892259604:web:8198de9d7da81c684c1601'
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Listen for authentication state changes
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                console.log('iOS user authenticated:', user.email);
                
                // Get ID token for backend authentication
                const idToken = await user.getIdToken();
                
                // Create session on backend
                const response = await fetch('/api/auth/mobile-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        isIOS: true
                    }),
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('iOS session created successfully:', data);
                    
                    // Store session info for later use
                    sessionStorage.setItem('iosAuthenticated', 'true');
                    sessionStorage.setItem('iosUserEmail', user.email);
                    
                    // Redirect to main app if on auth page
                    if (window.location.pathname === '/auth.html') {
                        window.location.href = '/';
                    } else {
                        // Reload to apply authentication
                        window.location.reload();
                    }
                } else {
                    console.error('Failed to create iOS session:', response.status);
                }
            } else {
                console.log('iOS user signed out');
                sessionStorage.removeItem('iosAuthenticated');
                sessionStorage.removeItem('iosUserEmail');
            }
        });

        // Check for redirect result (for Google Sign-In)
        try {
            const result = await firebase.auth().getRedirectResult();
            if (result.user) {
                console.log('iOS redirect sign-in successful:', result.user.email);
            }
        } catch (error) {
            if (error.code !== 'auth/no-auth-event') {
                console.error('iOS redirect result error:', error);
            }
        }
    }

    // iOS-specific sign in with Google
    window.iOSSignInWithGoogle = async function() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            // Use redirect for iOS WebView
            await firebase.auth().signInWithRedirect(provider);
            
            // Show loading state
            if (document.getElementById('googleSignInBtn')) {
                document.getElementById('googleSignInBtn').innerHTML = 
                    '<span class="spinner"></span> Redirecting...';
            }
            
            return true;
        } catch (error) {
            console.error('iOS Google sign-in failed:', error);
            alert('Sign-in failed. Please try again.');
            return false;
        }
    };

    // iOS-specific sign out
    window.iOSSignOut = async function() {
        try {
            await firebase.auth().signOut();
            
            // Clear backend session
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            // Clear session storage
            sessionStorage.clear();
            localStorage.clear();
            
            // Redirect to auth page
            window.location.href = '/auth.html';
        } catch (error) {
            console.error('iOS sign out failed:', error);
        }
    };

    // iOS-specific authenticated fetch
    window.iOSAuthenticatedFetch = async function(url, options = {}) {
        try {
            // Get current user
            const user = firebase.auth().currentUser;
            if (!user) {
                throw new Error('No authenticated user');
            }
            
            // Get fresh ID token
            const idToken = await user.getIdToken();
            
            // Add authorization header
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${idToken}`
            };
            
            // Always include credentials
            options.credentials = 'include';
            
            const response = await fetch(url, options);
            
            // Handle authentication errors
            if (response.status === 401) {
                console.log('iOS authentication expired, signing out...');
                await window.iOSSignOut();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('iOS authenticated fetch failed:', error);
            throw error;
        }
    };

    // Initialize on load
    if (isIOSWebView() || /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initIOSAuth);
        } else {
            initIOSAuth();
        }
    }
})();
// Authentication Bridge for Website Builder
// Ensures Firebase client authentication matches backend session

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing authentication bridge...');
    
    try {
        // Check if user is authenticated with backend
        const response = await fetch('/api/auth/user');
        if (!response.ok) {
            console.log('No backend authentication found');
            return;
        }
        
        const userData = await response.json();
        console.log('Backend user data:', userData);
        
        // Wait for Firebase to be ready
        await waitForFirebase();
        
        // Check Firebase auth state
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            console.log('Firebase user already authenticated:', currentUser.email);
            return;
        }
        
        // Sign in to Firebase using the backend session data
        console.log('Signing in to Firebase...');
        await signInToFirebase(userData);
        
    } catch (error) {
        console.error('Authentication bridge error:', error);
    }
});

// Wait for Firebase to be fully loaded
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            resolve();
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkFirebase = () => {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                resolve();
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkFirebase, 100);
            } else {
                reject(new Error('Firebase failed to load'));
            }
        };
        
        checkFirebase();
    });
}

// Sign in to Firebase using backend user data
async function signInToFirebase(userData) {
    try {
        // For users authenticated via backend, we need to sign them into Firebase
        // This is a bit tricky since we don't have their password
        // We'll use a custom token approach or silent sign-in
        
        // First, try to get a custom token from the backend
        const tokenResponse = await fetch('/api/auth/firebase-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uid: userData.uid })
        });
        
        if (tokenResponse.ok) {
            const { customToken } = await tokenResponse.json();
            await firebase.auth().signInWithCustomToken(customToken);
            console.log('Firebase authentication successful via custom token');
        } else {
            // Fallback: Try anonymous sign-in with claims
            console.log('Custom token not available, attempting alternative auth...');
            
            // For now, we'll create a temporary solution
            // In production, you'd want to implement proper custom token generation
            throw new Error('Custom token authentication not available');
        }
        
    } catch (error) {
        console.error('Firebase sign-in failed:', error);
        throw error;
    }
}
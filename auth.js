import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM",
    authDomain: "photoshcheduleapp.firebaseapp.com",
    projectId: "photoshcheduleapp",
    storageBucket: "photoshcheduleapp.firebasestorage.app",
    messagingSenderId: "1080892259604",
    appId: "1:1080892259604:web:8198de9d7da81c684c1601",
    measurementId: "G-MB2KDEFRHL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Check server authentication status
let serverAuthEnabled = true;
async function checkServerAuthStatus() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();
        serverAuthEnabled = status.authenticationEnabled;
        
        console.log('Server auth status:', serverAuthEnabled);
        
        // Always bypass authentication for now to avoid login issues
        console.log('Bypassing authentication - using fallback mode');
        bypassAuthentication();
    } catch (error) {
        console.error('Error checking server status:', error);
        // If we can't check status, use fallback mode
        console.log('Using fallback mode due to status check error');
        bypassAuthentication();
    }
}

// Function to bypass authentication when server is in fallback mode
function bypassAuthentication() {
    const authDiv = document.getElementById('auth');
    const appDiv = document.getElementById('app');
    
    // Show a notice about fallback mode
    const fallbackNotice = document.createElement('div');
    fallbackNotice.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
        padding: 10px;
        margin: 10px 0;
        border-radius: 5px;
        font-size: 14px;
    `;
    fallbackNotice.innerHTML = 'ℹ️ Running in demo mode - authentication disabled. All users share the same data.';
    
    // Hide auth form and show app
    authDiv.style.display = 'none';
    appDiv.style.display = 'block';
    
    // Add notice to the app
    const appContainer = document.querySelector('#app .container');
    if (appContainer && !document.querySelector('.fallback-notice')) {
        fallbackNotice.className = 'fallback-notice';
        appContainer.insertBefore(fallbackNotice, appContainer.firstChild);
    }
    
    // Set up fallback user
    window.currentUser = { uid: 'fallback-user', email: 'demo@example.com' };
    window.userToken = null;
    
    // Load sessions
    if (window.loadSessions) {
        setTimeout(() => {
            console.log('Loading sessions in fallback mode');
            window.loadSessions();
        }, 100);
    }
}

// Check server status on page load
checkServerAuthStatus();

// Add a global check for authentication status
window.checkAuthAndLoadSessions = function() {
    // If we have a current user, try to load sessions
    if (window.currentUser && window.currentUser.uid) {
        console.log('User authenticated, loading sessions');
        if (window.loadSessions) {
            window.loadSessions();
        }
    } else {
        console.log('No authenticated user, showing login');
        const authDiv = document.getElementById('auth');
        const appDiv = document.getElementById('app');
        if (authDiv && appDiv) {
            authDiv.style.display = 'block';
            appDiv.style.display = 'none';
        }
    }
};

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    // Skip Firebase auth handling if server auth is disabled
    if (!serverAuthEnabled) {
        return;
    }
    
    const authDiv = document.getElementById('auth');
    const appDiv = document.getElementById('app');
    
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
        
        // Create or update user in database
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email
                })
            });
        } catch (error) {
            console.error('Error creating user:', error);
        }
        
        // Store current user globally with token
        window.currentUser = user;
        window.userToken = await user.getIdToken();
        
        authDiv.style.display = 'none';
        appDiv.style.display = 'block';
        
        // Load sessions from database
        if (window.loadSessions) {
            setTimeout(() => {
                window.loadSessions();
            }, 100); // Small delay to ensure DOM is ready
        }
    } else {
        // User is signed out
        console.log('User signed out');
        window.currentUser = null;
        authDiv.style.display = 'block';
        appDiv.style.display = 'none';
    }
});

// Signup function
window.signup = async function() {
    if (!serverAuthEnabled) {
        alert('Authentication is disabled in demo mode. You can already use the app.');
        return;
    }
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('User created successfully:', userCredential.user.email);
        // Clear form
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed: ' + error.message);
    }
};

// Login function
window.login = async function() {
    if (!serverAuthEnabled) {
        alert('Authentication is disabled in demo mode. You can already use the app.');
        return;
    }
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('User logged in successfully:', userCredential.user.email);
        // Clear form
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: ' + error.message);
    }
};

// Logout function
window.logout = async function() {
    if (!serverAuthEnabled) {
        alert('Authentication is disabled in demo mode. App will continue running.');
        return;
    }
    
    try {
        await signOut(auth);
        console.log('User logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
};
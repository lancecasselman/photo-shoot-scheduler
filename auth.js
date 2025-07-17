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
    apiKey: "AIzaSyBQzM-FCocsuR850TbVBqcF-X4HuQ-BSrM",
    authDomain: "photography-schedule-f08eb.firebaseapp.com",
    projectId: "photography-schedule-f08eb",
    storageBucket: "photography-schedule-f08eb.firebasestorage.app",
    messagingSenderId: "655615133280",
    appId: "1:655615133280:web:d8cf2ccfe5a8f6b6e3a505"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Auth state observer
onAuthStateChanged(auth, async (user) => {
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
        
        // Store current user globally
        window.currentUser = user;
        
        authDiv.style.display = 'none';
        appDiv.style.display = 'block';
        
        // Load sessions from database
        if (window.loadSessions) {
            window.loadSessions();
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
    try {
        await signOut(auth);
        console.log('User logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
};
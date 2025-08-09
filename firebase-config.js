// Firebase Configuration - Using latest service account credentials
const firebaseConfig = {
    apiKey: "AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM",
    authDomain: "photoshcheduleapp.firebaseapp.com", 
    projectId: "photoshcheduleapp",
    storageBucket: "photoshcheduleapp.appspot.com",
    messagingSenderId: "1080892259604",
    appId: "1:1080892259604:web:8198de9d7da81c684c1601",
    measurementId: "G-MB2KDEFRHL"
};

// Initialize Firebase with improved error handling and duplicate prevention
(function() {
    try {
        // Prevent multiple initialization warnings by checking for existing Firebase apps
        if (window.firebaseInitialized === true || (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0)) {
            console.log('Firebase already initialized, skipping duplicate initialization');
            if (!window.firebaseAuth && firebase.auth) {
                window.firebaseAuth = firebase.auth();
                // Firebase storage removed - using R2 exclusively
            }
            return;
        }
        
        // Check if Firebase is already loaded globally
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded. Please ensure Firebase scripts are included.');
            return;
        }
        
        // Check if Firebase app is already initialized
        if (firebase.apps && firebase.apps.length > 0) {
            console.log('Firebase already initialized, using existing instance');
            window.firebaseInitialized = true;
            
            // Set global references for compatibility
            window.firebaseAuth = firebase.auth();
            // Firebase storage removed - using R2 exclusively
        } else {
            // Initialize Firebase for the first time
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase client initialized with storage bucket:', firebaseConfig.storageBucket);
            
            // Set global references for compatibility
            window.firebaseAuth = firebase.auth();
            // Firebase storage removed - using R2 exclusively
            window.firebaseInitialized = true;
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
        window.firebaseInitialized = false;
    }
})();
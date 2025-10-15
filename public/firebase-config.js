// CENTRALIZED Firebase Configuration
// All pages should import this single source of truth

export const firebaseConfig = {
    apiKey: "AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM",
    authDomain: "photoshcheduleapp.firebaseapp.com",
    projectId: "photoshcheduleapp",
    storageBucket: "photoshcheduleapp.appspot.com",
    messagingSenderId: "1080892259604",
    appId: "1:1080892259604:web:8198de9d7da81c684c1601"
};

// Firebase SDK versions to use consistently
export const FIREBASE_SDK_VERSION = "10.7.1";

export const FIREBASE_CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

// Firebase modules
export const FIREBASE_MODULES = {
    app: `${FIREBASE_CDN_BASE}/firebase-app.js`,
    auth: `${FIREBASE_CDN_BASE}/firebase-auth.js`,
    firestore: `${FIREBASE_CDN_BASE}/firebase-firestore.js`,
    storage: `${FIREBASE_CDN_BASE}/firebase-storage.js`
};

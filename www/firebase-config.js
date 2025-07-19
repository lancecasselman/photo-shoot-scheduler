// Firebase Configuration and Storage Setup
// This file initializes Firebase Storage for photo uploads

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    listAll 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// Initialize Firebase Storage when DOM is loaded
async function initializeFirebaseStorage() {
    try {
        console.log('Initializing Firebase Storage...');
        
        // Check if Firebase credentials are available
        if (!window.VITE_FIREBASE_API_KEY || !window.VITE_FIREBASE_PROJECT_ID || !window.VITE_FIREBASE_APP_ID) {
            console.log('Firebase credentials not available, photo upload will be disabled');
            return false;
        }

        // Firebase configuration
        const firebaseConfig = {
            apiKey: window.VITE_FIREBASE_API_KEY,
            authDomain: `${window.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
            projectId: window.VITE_FIREBASE_PROJECT_ID,
            storageBucket: `${window.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
            appId: window.VITE_FIREBASE_APP_ID,
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        
        // Initialize Firebase Storage
        const storage = getStorage(app);
        
        // Make Firebase Storage functions available globally
        window.firebaseStorage = storage;
        window.firebaseRef = ref;
        window.firebaseUploadBytes = uploadBytes;
        window.firebaseGetDownloadURL = getDownloadURL;
        window.firebaseListAll = listAll;
        
        console.log('Firebase Storage initialized successfully');
        console.log('Available Firebase functions:', {
            storage: !!window.firebaseStorage,
            ref: !!window.firebaseRef,
            uploadBytes: !!window.firebaseUploadBytes,
            getDownloadURL: !!window.firebaseGetDownloadURL,
            listAll: !!window.firebaseListAll
        });
        
        // Enable photo upload functionality
        const photoUploadSection = document.querySelector('.photo-upload-section');
        if (photoUploadSection) {
            photoUploadSection.style.display = 'block';
            console.log('Photo upload section enabled');
        }
        
        return true;
        
    } catch (error) {
        console.error('Error initializing Firebase Storage:', error);
        
        // Disable photo upload functionality
        const photoUploadSection = document.querySelector('.photo-upload-section');
        if (photoUploadSection) {
            photoUploadSection.style.display = 'none';
        }
        
        // Show error message
        const uploadHelper = document.querySelector('.photo-upload-helper');
        if (uploadHelper) {
            uploadHelper.textContent = 'Photo upload unavailable - Firebase Storage not configured';
            uploadHelper.style.color = '#e53e3e';
        }
        
        return false;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeFirebaseStorage);

// Also expose the initialization function globally
window.initializeFirebaseStorage = initializeFirebaseStorage;

// Export for module usage
export { initializeApp };
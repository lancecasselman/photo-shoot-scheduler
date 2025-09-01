const admin = require("firebase-admin");

// Initialize Firebase Admin SDK with service account from environment
let serviceAccount;
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
        console.warn('FIREBASE_SERVICE_ACCOUNT environment variable not found - using minimal initialization');
        serviceAccount = null;
    } else {
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('Firebase Admin SDK: Service account loaded successfully');
    }
} catch (error) {
    console.error('Firebase Admin SDK: Error parsing service account:', error.message);
    console.warn('Falling back to minimal Firebase initialization');
    serviceAccount = null;
}

// Initialize Firebase Admin if not already initialized  
if (!admin.apps.length) {
    try {
        const config = {
            projectId: 'photoshcheduleapp',
            storageBucket: 'photoshcheduleapp.appspot.com'
        };

        // Add service account credentials if available
        if (serviceAccount) {
            config.credential = admin.credential.cert(serviceAccount);
            console.log('Firebase Admin SDK: Using service account credentials');
        } else {
            console.log('Firebase Admin SDK: Using minimal configuration (no service account)');
        }

        admin.initializeApp(config);
        console.log('Firebase Admin SDK initialized successfully for photoshcheduleapp');
    } catch (error) {
        console.error('Firebase Admin SDK: Initialization failed:', error.message);
        // Continue without admin features if initialization fails
        console.warn('⚠️ Firebase Admin features may be limited due to initialization failure');
    }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };

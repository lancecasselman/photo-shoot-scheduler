const admin = require("firebase-admin");

// Initialize Firebase Admin SDK with service account from environment
let serviceAccount;
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not found');
    }
    serviceAccount = JSON.parse(serviceAccountJson);
    console.log('Firebase Admin SDK: Service account loaded successfully');
} catch (error) {
    console.error('Firebase Admin SDK: Error parsing service account:', error.message);
    throw error;
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: serviceAccount.project_id + ".appspot.com", // Use project_id from service account
        });
        console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
        console.error('Firebase Admin SDK: Initialization failed:', error.message);
        throw error;
    }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };

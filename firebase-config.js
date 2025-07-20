// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: window.FIREBASE_CONFIG?.apiKey || '',
    authDomain: `${window.FIREBASE_CONFIG?.projectId || ''}.firebaseapp.com`,
    projectId: window.FIREBASE_CONFIG?.projectId || '',
    storageBucket: `${window.FIREBASE_CONFIG?.projectId || ''}.firebasestorage.app`,
    appId: window.FIREBASE_CONFIG?.appId || ''
};

let app, storage, firestore;

try {
    app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    firestore = getFirestore(app);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization failed:', error);
}

// Generate secure access token for gallery
export function generateAccessToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Upload photos to Firebase Storage
export async function uploadPhotosToFirebase(sessionId, files) {
    if (!storage) throw new Error('Firebase Storage not initialized');
    
    const uploadPromises = files.map(async (file) => {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.name}`;
        const storageRef = ref(storage, `sessions/${sessionId}/photos/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return {
            id: Math.random().toString(36).substring(2),
            fileName,
            originalName: file.name,
            url: downloadURL,
            size: file.size,
            uploadedAt: new Date().toISOString()
        };
    });
    
    return Promise.all(uploadPromises);
}

// Get all photos for a session from Firebase Storage
export async function getSessionPhotos(sessionId) {
    if (!storage) throw new Error('Firebase Storage not initialized');
    
    const photosRef = ref(storage, `sessions/${sessionId}/photos/`);
    const result = await listAll(photosRef);
    
    const photoPromises = result.items.map(async (itemRef) => {
        const downloadURL = await getDownloadURL(itemRef);
        return {
            id: itemRef.name,
            fileName: itemRef.name,
            url: downloadURL,
            fullPath: itemRef.fullPath
        };
    });
    
    return Promise.all(photoPromises);
}

// Store session access token in Firestore
export async function storeSessionToken(sessionId, accessToken, sessionData) {
    if (!firestore) throw new Error('Firestore not initialized');
    
    const sessionRef = doc(firestore, 'gallery-access', sessionId);
    await setDoc(sessionRef, {
        sessionId,
        accessToken,
        clientName: sessionData.clientName,
        sessionType: sessionData.sessionType,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });
    
    return accessToken;
}

// Verify session access token
export async function verifySessionToken(sessionId, accessToken) {
    if (!firestore) throw new Error('Firestore not initialized');
    
    const sessionRef = doc(firestore, 'gallery-access', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
        throw new Error('Gallery not found');
    }
    
    const data = sessionSnap.data();
    if (data.accessToken !== accessToken) {
        throw new Error('Invalid access token');
    }
    
    if (new Date() > new Date(data.expiresAt)) {
        throw new Error('Gallery access has expired');
    }
    
    return data;
}

export { storage, firestore };
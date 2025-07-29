// Firebase Configuration for Advanced Website Builder

// Firebase configuration
const firebaseConfig = {
    // This will be populated from existing Firebase config
    apiKey: "AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM",
    authDomain: "photoshcheduleapp.firebaseapp.com",
    projectId: "photoshcheduleapp",
    storageBucket: "photoshcheduleapp.appspot.com",
    messagingSenderId: "1080892259604",
    appId: "1:1080892259604:web:your-app-id"
};

// Initialize Firebase if available
if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

class FirebaseService {
    constructor() {
        this.auth = null;
        this.firestore = null;
        this.storage = null;
        this.user = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Check if Firebase is loaded and initialize if needed
            if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
                firebase.initializeApp(firebaseConfig);
            }
            
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                this.auth = firebase.auth();
                this.firestore = firebase.firestore();
                // Check if storage is available
                if (firebase.storage) {
                    this.storage = firebase.storage();
                } else {
                    console.warn('Firebase Storage not available - storage features disabled');
                    this.storage = null;
                }
                
                // Listen for auth state changes
                this.auth.onAuthStateChanged((user) => {
                    this.user = user;
                    this.onAuthStateChanged(user);
                });
                
                console.log('Firebase services initialized successfully');
            } else {
                console.warn('Firebase not available - using local storage fallback');
                this.initLocalFallback();
            }
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            this.initLocalFallback();
        }
    }
    
    initLocalFallback() {
        // Fallback to localStorage when Firebase is not available
        this.user = { uid: 'local-user', email: 'user@example.com' };
        this.onAuthStateChanged(this.user);
    }
    
    onAuthStateChanged(user) {
        if (user) {
            console.log('User authenticated:', user.email);
            this.loadUserSite();
        } else {
            console.log('User not authenticated');
            // Could redirect to login or use demo mode
        }
    }
    
    async saveSite(siteData) {
        try {
            if (this.firestore && this.user) {
                const docRef = this.firestore.collection('websites').doc(this.user.uid);
                await docRef.set({
                    ...siteData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: this.user.uid,
                    userEmail: this.user.email
                });
                
                console.log('Site saved to Firestore');
                return { success: true };
            } else {
                // Local storage fallback
                localStorage.setItem('builder_site_data', JSON.stringify(siteData));
                console.log('Site saved to localStorage');
                return { success: true };
            }
        } catch (error) {
            console.error('Error saving site:', error);
            throw error;
        }
    }
    
    async loadUserSite() {
        try {
            if (this.firestore && this.user) {
                const docRef = this.firestore.collection('websites').doc(this.user.uid);
                const doc = await docRef.get();
                
                if (doc.exists) {
                    const siteData = doc.data();
                    console.log('Site loaded from Firestore');
                    return siteData;
                } else {
                    console.log('No existing site found');
                    return null;
                }
            } else {
                // Local storage fallback
                const siteData = localStorage.getItem('builder_site_data');
                if (siteData) {
                    console.log('Site loaded from localStorage');
                    return JSON.parse(siteData);
                }
                return null;
            }
        } catch (error) {
            console.error('Error loading site:', error);
            return null;
        }
    }
    
    async publishSite(siteData, username) {
        try {
            if (this.firestore) {
                // Save published site data
                const publishedSite = {
                    ...siteData,
                    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    username: username || this.user.uid,
                    isPublished: true
                };
                
                await this.firestore.collection('published_sites').doc(username || this.user.uid).set(publishedSite);
                
                // Also update main site record
                await this.saveSite({ ...siteData, isPublished: true, publishedAt: new Date() });
                
                console.log('Site published successfully');
                return { 
                    success: true, 
                    url: `${window.location.origin}/site/${username || this.user.uid}` 
                };
            } else {
                // Local publish simulation
                localStorage.setItem('published_site_' + (username || 'local-user'), JSON.stringify(siteData));
                console.log('Site published locally');
                return { 
                    success: true, 
                    url: `${window.location.origin}/site/${username || 'local-user'}` 
                };
            }
        } catch (error) {
            console.error('Error publishing site:', error);
            throw error;
        }
    }
    
    async uploadImage(file) {
        try {
            if (this.storage && this.user) {
                const fileName = `${Date.now()}_${file.name}`;
                const storageRef = this.storage.ref(`website_images/${this.user.uid}/${fileName}`);
                
                const snapshot = await storageRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                
                console.log('Image uploaded to Firebase Storage');
                return downloadURL;
            } else {
                // Local upload simulation - convert to data URL
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }
    
    async getPublishedSite(username) {
        try {
            if (this.firestore) {
                const doc = await this.firestore.collection('published_sites').doc(username).get();
                
                if (doc.exists) {
                    return doc.data();
                } else {
                    return null;
                }
            } else {
                const siteData = localStorage.getItem('published_site_' + username);
                return siteData ? JSON.parse(siteData) : null;
            }
        } catch (error) {
            console.error('Error getting published site:', error);
            return null;
        }
    }
}

// Create global instance
const firebaseService = new FirebaseService();
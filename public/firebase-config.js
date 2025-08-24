// Firebase Configuration for Photography Management System
// This file ensures consistent Firebase configuration across all platforms

export const firebaseConfig = {
    apiKey: "AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM",
    authDomain: "photoshcheduleapp.firebaseapp.com",
    projectId: "photoshcheduleapp", 
    storageBucket: "photoshcheduleapp.appspot.com",
    messagingSenderId: "1080892259604",
    appId: "1:1080892259604:web:8198de9d7da81c684c1601",
    measurementId: "G-MB2KDEFRHL"
};

// Android-specific authentication configuration
export const androidAuthConfig = {
    // Enable persistence for Android apps
    persistence: true,
    
    // Enhanced debugging for Android
    enableLogging: true,
    
    // Android-specific timeout settings
    timeoutMs: 30000,
    
    // Custom claims for Android authentication
    customClaims: {
        platform: 'android',
        app_version: '1.0'
    }
};

// Initialize Firebase for Android with proper configuration
export async function initializeFirebaseForAndroid() {
    try {
        // Check if running in Capacitor environment
        const isCapacitor = window.Capacitor !== undefined;
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        console.log('🔥 FIREBASE INIT:', { isCapacitor, isAndroid });
        
        if (isAndroid || isCapacitor) {
            console.log('📱 ANDROID: Initializing Firebase with Android-specific configuration');
            
            // Android-specific initialization
            return {
                ...firebaseConfig,
                ...androidAuthConfig,
                android: {
                    // Package name must match android/app/build.gradle
                    packageName: 'com.thelegacyphotography.photomanager',
                    // Enable automatic verification
                    autoVerify: true,
                    // Custom scheme for deep linking
                    customScheme: 'photomanager'
                }
            };
        }
        
        return firebaseConfig;
        
    } catch (error) {
        console.error('❌ FIREBASE INIT ERROR:', error);
        throw error;
    }
}

// Test Firebase connectivity for Android
export async function testFirebaseConnectivity() {
    try {
        console.log('🧪 TESTING: Firebase connectivity...');
        
        // Test Firebase auth connectivity
        const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
        const testResponse = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                returnSecureToken: true
            })
        });
        
        if (testResponse.status === 400) {
            // Expected error for test request - Firebase is reachable
            console.log('✅ FIREBASE: Connectivity test passed');
            return true;
        }
        
        console.log('⚠️ FIREBASE: Unexpected response:', testResponse.status);
        return false;
        
    } catch (error) {
        console.error('❌ FIREBASE: Connectivity test failed:', error);
        return false;
    }
}
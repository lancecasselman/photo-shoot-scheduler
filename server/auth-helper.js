const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'photoshcheduleapp',
    });
}

// Google OAuth2 client for server-side verification
const googleClient = new OAuth2Client();

/**
 * Server-assisted Google authentication for mobile browsers
 * This bypasses client-side OAuth redirect issues
 */
async function handleGoogleAuthServer(req, res) {
    try {
        const { idToken } = req.body;
        
        if (!idToken) {
            return res.status(400).json({ 
                success: false, 
                error: 'No ID token provided' 
            });
        }

        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: '1080892259604-YOUR-CLIENT-ID.apps.googleusercontent.com', // Replace with actual client ID
        });
        
        const payload = ticket.getPayload();
        const uid = payload['sub'];
        const email = payload['email'];
        const name = payload['name'];
        
        // Create or update Firebase user
        let firebaseUser;
        try {
            firebaseUser = await admin.auth().getUser(uid);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                firebaseUser = await admin.auth().createUser({
                    uid: uid,
                    email: email,
                    displayName: name,
                    emailVerified: true,
                });
            } else {
                throw error;
            }
        }
        
        // Create custom token for client-side authentication
        const customToken = await admin.auth().createCustomToken(uid);
        
        res.json({
            success: true,
            customToken: customToken,
            user: {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
            }
        });
    } catch (error) {
        console.error('Server Google auth error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}

/**
 * Alternative: Direct email/password authentication helper
 * For when Google OAuth fails on mobile
 */
async function createSessionToken(req, res) {
    try {
        const { uid } = req.body;
        
        if (!uid) {
            return res.status(400).json({ 
                success: false, 
                error: 'No UID provided' 
            });
        }
        
        // Create a session cookie that lasts for 5 days
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await admin.auth().createSessionCookie(uid, { expiresIn });
        
        res.json({
            success: true,
            sessionCookie: sessionCookie,
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}

module.exports = {
    handleGoogleAuthServer,
    createSessionToken,
};
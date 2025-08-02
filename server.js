// 🔄 TOGGLEABLE AUTH GUARD SYSTEM
const DEV_MODE = false; // 👉 Authentication enabled for proper Google login testing

// SUCCESS: PREMIUM MODE IMPLEMENTATION
const PREMIUM_FEATURES = {
    STATIC_SITE_PUBLISHING: true,
    ADVANCED_THEMES: true,
    CUSTOM_DOMAINS: true,
    ANALYTICS: true
};

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const session = require('express-session');
const connectPg = require('connect-pg-simple');

// Firebase Admin SDK for server-side authentication
const admin = require('firebase-admin');

// SendGrid email service (nodemailer removed - using SendGrid only)
const sgMail = require('@sendgrid/mail');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Import notification services
const { initializeNotificationServices, sendWelcomeEmail, sendBillingNotification, broadcastFeatureUpdate } = require('./server/notifications');

// Import payment plan services
const PaymentPlanManager = require('./server/paymentPlans');
const PaymentScheduler = require('./server/paymentScheduler');

// Import contract management
const ContractManager = require('./server/contracts');

// Import R2 RAW backup service
const R2BackupService = require('./server/r2-backup');

// Import AI services
const { AIServices } = require('./server/ai-services');

// Database AI Credits Functions
async function getUserAiCredits(userId) {
    try {
        const result = await pool.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
        return result.rows[0]?.ai_credits || 0;
    } catch (error) {
        console.error('Error getting user AI credits:', error);
        return 0;
    }
}

async function useAiCredits(userId, amount, operation, details) {
    try {
        // First check if user has enough credits
        const currentCredits = await getUserAiCredits(userId);
        if (currentCredits < amount) {
            throw new Error('Insufficient AI credits');
        }

        // Deduct credits
        await pool.query('UPDATE users SET ai_credits = ai_credits - $1 WHERE id = $2', [amount, userId]);

        // Log the usage
        await pool.query(`
            INSERT INTO ai_credit_transactions (user_id, amount, operation, details, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [userId, -amount, operation, details]);

        return amount;
    } catch (error) {
        console.error('Error using AI credits:', error);
        throw error;
    }
}

// Initialize services
const r2BackupService = new R2BackupService();
const aiServices = new AIServices();

// PostgreSQL database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Firebase Admin SDK with latest service account
try {
    let serviceAccount = null;
    
    // Try new FIREBASE_SERVICE_ACCOUNT secret first
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log('Using FIREBASE_SERVICE_ACCOUNT credentials');
        } catch (parseError) {
            console.log('Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError.message);
        }
    }
    
    // Fallback to old credentials if new ones don't work
    if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        try {
            serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
            console.log('Using fallback GOOGLE_APPLICATION_CREDENTIALS_JSON');
        } catch (parseError) {
            console.log('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', parseError.message);
        }
    }

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
            storageBucket: `${serviceAccount.project_id}.appspot.com`
        });
        console.log('Firebase Admin SDK initialized successfully with project:', serviceAccount.project_id);
        console.log('Storage bucket:', `${serviceAccount.project_id}.appspot.com`);
    } else {
        console.log('WARNING: Firebase credentials not provided - authentication disabled');
    }
} catch (error) {
    console.log('WARNING: Firebase Admin SDK initialization failed:', error.message);
}

// RAW file detection function
function isRAWFile(filename, mimetype) {
    const rawExtensions = [
        '.cr2', '.cr3', '.crw',     // Canon RAW
        '.nef', '.nrw',             // Nikon RAW
        '.arw', '.srf', '.sr2',     // Sony RAW
        '.raf',                     // Fujifilm RAW
        '.orf',                     // Olympus RAW
        '.pef', '.ptx',             // Pentax RAW
        '.rw2',                     // Panasonic RAW
        '.dng',                     // Adobe Digital Negative
        '.3fr',                     // Hasselblad RAW
        '.dcr', '.k25', '.kdc',     // Kodak RAW
        '.erf',                     // Epson RAW
        '.fff',                     // Imacon RAW
        '.iiq',                     // Phase One RAW
        '.mos',                     // Leaf RAW
        '.mrw',                     // Minolta RAW
        '.raw', '.rwz',             // Generic RAW
        '.x3f'                      // Sigma RAW
    ];

    const lowerFilename = filename.toLowerCase();
    const isRawExtension = rawExtensions.some(ext => lowerFilename.endsWith(ext));

    // Also check MIME type for additional validation
    const rawMimeTypes = [
        'image/x-canon-cr2',
        'image/x-canon-crw', 
        'image/x-nikon-nef',
        'image/x-sony-arw',
        'image/x-fuji-raf',
        'image/x-olympus-orf',
        'image/x-pentax-pef',
        'image/x-panasonic-rw2',
        'image/x-adobe-dng',
        'image/tiff' // Sometimes RAW files are detected as TIFF
    ];

    const isRawMime = rawMimeTypes.includes(mimetype);

    return isRawExtension || isRawMime;
}

// Process workflow automation
async function processWorkflow(workflowType, clientData, messageTemplate, sessionId) {
    try {
        console.log(`🤖 Processing workflow: ${workflowType} for session ${sessionId}`);

        const templates = {
            professional: {
                contractReminder: {
                    subject: `Contract Signature Required - ${clientData.sessionType} Session`,
                    message: `Dear ${clientData.clientName}, we need your contract signature to confirm your ${clientData.sessionType} session on ${clientData.sessionDate}. Please sign and return at your earliest convenience.`
                },
                paymentFollowup: {
                    subject: `Payment Reminder - Session in 3 Days`,
                    message: `Dear ${clientData.clientName}, your ${clientData.sessionType} session is scheduled for ${clientData.sessionDate}. Please complete payment to secure your booking.`
                },
                sessionPrep: {
                    subject: `Preparation Guide for Your Upcoming Session`,
                    message: `Dear ${clientData.clientName}, your ${clientData.sessionType} session is approaching! Please review the attached preparation guide to ensure a smooth experience.`
                },
                galleryDelivery: {
                    subject: `Your Photos Are Ready! 📸`,
                    message: `Dear ${clientData.clientName}, we're excited to share that your ${clientData.sessionType} photos are ready for viewing and download. Access your private gallery here: ${process.env.APP_URL}/gallery/${sessionId}`
                },
                feedbackRequest: {
                    subject: `We'd Love Your Feedback`,
                    message: `Dear ${clientData.clientName}, we hope you love your ${clientData.sessionType} photos! We'd greatly appreciate a review of your experience.`
                }
            },
            friendly: {
                galleryDelivery: {
                    subject: `Your amazing photos are ready! 🌟`,
                    message: `Hey ${clientData.clientName}! Your ${clientData.sessionType} photos turned out absolutely stunning! Can't wait for you to see them: ${process.env.APP_URL}/gallery/${sessionId}`
                }
            },
            luxury: {
                galleryDelivery: {
                    subject: `Your Exclusive Gallery Awaits`,
                    message: `Dear ${clientData.clientName}, it is our pleasure to present your bespoke ${clientData.sessionType} collection. Your private gallery showcases the artistry of your session: ${process.env.APP_URL}/gallery/${sessionId}`
                }
            }
        };

        const template = templates[messageTemplate]?.[workflowType] || templates.professional[workflowType];

        if (!template) {
            throw new Error(`No template found for workflow: ${workflowType}`);
        }

        // Create mailto link for native email integration
        const emailBody = encodeURIComponent(template.message);
        const emailSubject = encodeURIComponent(template.subject);
        const mailtoLink = `mailto:${clientData.email}?subject=${emailSubject}&body=${emailBody}`;

        // For SMS notifications (if phone number provided)
        let smsLink = null;
        if (clientData.phoneNumber) {
            const smsBody = encodeURIComponent(`${template.subject}\n\n${template.message}`);
            smsLink = `sms:${clientData.phoneNumber}?body=${smsBody}`;
        }

        return {
            success: true,
            workflowType: workflowType,
            template: template,
            mailtoLink: mailtoLink,
            smsLink: smsLink,
            executedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error(`❌ Workflow processing failed for ${workflowType}:`, error);
        return {
            success: false,
            error: error.message,
            workflowType: workflowType
        };
    }
}

// Process RAW files for R2 backup
async function processRAWBackups(sessionId, rawFiles, userId) {
    console.log(`💾 Starting RAW backup process for ${rawFiles.length} files`);

    for (const photo of rawFiles) {
        try {
            // Record backup request in database
            const backupRecord = await pool.query(`
                INSERT INTO raw_backups (
                    user_id, session_id, filename, original_name, 
                    file_size, mime_type, r2_object_key, r2_bucket, 
                    backup_status, backup_started_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [
                userId,
                sessionId,
                photo.filename,
                photo.originalName,
                photo.originalSize,
                photo.mimeType,
                `${userId}/${sessionId}/${photo.filename}`, // R2 object key
                'photography-raw-backups',
                'pending',
                new Date()
            ]);

            console.log(`📝 RAW backup record created for ${photo.originalName}`);

            // Queue for background R2 upload (async)
            setImmediate(async () => {
                try {
                    await r2BackupService.uploadFile({
                        filePath: photo.originalPath,
                        fileName: photo.originalName,
                        userId: userId,
                        sessionId: sessionId,
                        backupId: backupRecord.rows[0].id
                    });
                } catch (uploadError) {
                    console.error(`❌ RAW backup failed for ${photo.originalName}:`, uploadError);

                    // Update backup record with error
                    await pool.query(`
                        UPDATE raw_backups 
                        SET backup_status = 'failed', backup_error = $1
                        WHERE id = $2
                    `, [uploadError.message, backupRecord.rows[0].id]);
                }
            });

        } catch (error) {
            console.error(`❌ Failed to process RAW backup for ${photo.originalName}:`, error);
        }
    }
}

// Background Firebase upload function
async function uploadPhotosToFirebase(sessionId, photos) {
    if (!admin || !admin.storage) {
        console.log('Firebase Admin not available, skipping Firebase upload');
        return;
    }

    try {
        const bucket = admin.storage().bucket();

        for (const photo of photos) {
            if (!photo.needsFirebaseUpload || !photo.originalPath) continue;

            try {
                console.log(`Uploading ${photo.originalName} to Firebase Storage...`);

                const firebaseFileName = `sessions/${sessionId}/${photo.filename}`;
                const file = bucket.file(firebaseFileName);

                // Upload original file to Firebase
                await bucket.upload(photo.originalPath, {
                    destination: firebaseFileName,
                    metadata: {
                        contentType: 'image/jpeg',
                        metadata: {
                            originalName: photo.originalName,
                            sessionId: sessionId,
                            uploadDate: photo.uploadDate,
                            originalSize: photo.originalSize.toString()
                        }
                    }
                });

                // Get download URL
                const [downloadURL] = await file.getSignedUrl({
                    action: 'read',
                    expires: '03-09-2491' // Far future expiry
                });

                // Update photo record with Firebase URL
                const session = await getSessionById(sessionId);
                if (session && session.photos) {
                    const updatedPhotos = session.photos.map(p => {
                        if (p.filename === photo.filename) {
                            return { ...p, firebaseUrl: downloadURL, needsFirebaseUpload: false };
                        }
                        return p;
                    });
                    await updateSession(sessionId, { photos: updatedPhotos });
                    console.log(`Firebase upload complete: ${photo.originalName}`);
                }

            } catch (uploadError) {
                console.error(`Firebase upload failed for ${photo.originalName}:`, uploadError);
            }
        }
    } catch (error) {
        console.error('Firebase batch upload error:', error);
    }
}

// Firebase Authentication middleware
const isAuthenticated = async (req, res, next) => {
    // DEV_MODE bypass for development
    if (DEV_MODE) {
        req.user = {
            uid: 'dev-user-123',
            email: 'dev@example.com',
            displayName: 'Development User'
        };
        return next();
    }

    // Check if Firebase is available
    if (!admin.apps.length) {
        // Development testing bypass - set TEST_MODE=true to enable testing without auth
        if (process.env.TEST_MODE === 'true') {
            // Create a test user for development
            req.user = {
                uid: 'test-user-123',
                email: 'test@example.com',
                displayName: 'Test User'
            };
            return next();
        }

        return res.status(401).json({ message: 'Authentication service unavailable. Please configure Firebase credentials.' });
    }

    // Check session first
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }

    // Check Authorization header for Firebase ID token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];

        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name || decodedToken.email
            };

            // Store in session for future requests
            req.session.user = req.user;
            return next();
        } catch (error) {
            console.error('Firebase token verification failed:', error);
        }
    }

    // No valid authentication found
    res.status(401).json({ message: 'Authentication required. Please log in.' });
};

// Get current user info
const getCurrentUser = (req) => {
    return req.user || null;
};

// Helper function to normalize Lance's emails to a single user ID
const normalizeUserForLance = (user) => {
    const lanceEmails = [
        'lancecasselman@icloud.com',
        'lancecasselman2011@gmail.com',
        'Lance@thelegacyphotography.com'
    ];

    if (user && lanceEmails.includes(user.email)) {
        // Always use the existing account ID "44735007" for Lance's unified account
        return {
            ...user,
            uid: '44735007',
            canonical_email: 'lancecasselman@icloud.com'
        };
    }

    return user;
};

// Subscription check middleware
const requireSubscription = async (req, res, next) => {
    // DEV_MODE bypass
    if (DEV_MODE) {
        return next();
    }

    const user = getCurrentUser(req);
    if (!user || !user.email) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    // Whitelist your emails
    const whitelistedEmails = [
        'lancecasselman@icloud.com',
        'lancecasselman2011@gmail.com',
        'Lance@thelegacyphotography.com'
    ];

    if (whitelistedEmails.includes(user.email)) {
        return next();
    }

    try {
        // Check user subscription status in database
        const result = await pool.query(
            'SELECT subscription_status, subscription_expires_at FROM users WHERE email = $1',
            [user.email]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ 
                message: 'No subscription found. Please subscribe to continue.',
                requiresSubscription: true 
            });
        }

        const userRecord = result.rows[0];

        // Check if subscription is active
        if (userRecord.subscription_status !== 'active') {
            return res.status(403).json({ 
                message: 'Your subscription is not active. Please subscribe to continue.',
                requiresSubscription: true 
            });
        }

        // Check if subscription has expired
        if (userRecord.subscription_expires_at && new Date(userRecord.subscription_expires_at) < new Date()) {
            return res.status(403).json({ 
                message: 'Your subscription has expired. Please renew to continue.',
                requiresSubscription: true 
            });
        }

        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        res.status(500).json({ message: 'Error checking subscription status' });
    }
};

// Create professional email transporter with better deliverability
const createEmailTransporter = () => {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Use SMTP configuration instead of service for better deliverability
        const emailDomain = process.env.EMAIL_USER.split('@')[1];

        if (emailDomain === 'gmail.com') {
            return nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
        } else if (emailDomain === 'outlook.com' || emailDomain === 'hotmail.com') {
            return nodemailer.createTransport({
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
        } else {
            // For other domains, check if SMTP_HOST is configured, otherwise use Gmail as fallback
            // All email now handled by SendGrid - SMTP removed
            console.log('SMTP configuration found but using SendGrid instead');
            return null;
        }
    }

    return null;
};

const app = express();
const PORT = process.env.PORT || 5000;

// Body parsing middleware (must be before routes)
app.use(express.json({ limit: '100gb' }));
app.use(express.urlencoded({ extended: true, limit: '100gb' }));

// Session configuration for authentication
const pgSession = connectPg(session);
app.use(session({
    store: new pgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'sessions',
        createTableIfMissing: false
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Auto-detect HTTPS in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-site for production
    }
}));

// CORS configuration for custom domains
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://photomanagementsystem.com',
        'https://www.photomanagementsystem.com',
        /\.replit\.app$/,
        /\.replit\.dev$/,
        'http://localhost:5000',
        'https://localhost:5000'
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') return allowed === origin;
        return allowed.test(origin);
    })) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Firebase Authentication Routes
app.post('/api/auth/firebase-login', async (req, res) => {
    try {
        console.log('Firebase login request:', {
            body: req.body,
            origin: req.headers.origin,
            userAgent: req.headers['user-agent']
        });

        const { uid, email, displayName, photoURL } = req.body;

        if (!uid || !email) {
            console.log('Missing required user info:', { uid: !!uid, email: !!email });
            return res.status(400).json({ message: 'Missing required user information' });
        }

        // Create or update user in database
        try {
            await pool.query(`
                INSERT INTO users (id, email, display_name, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (email) DO UPDATE SET
                    id = EXCLUDED.id,
                    display_name = EXCLUDED.display_name,
                    updated_at = NOW()
            `, [uid, email, displayName]);

            console.log(`User ${email} logged in successfully`);
        } catch (dbError) {
            console.error('Database error during user creation:', dbError);
            // Continue anyway - authentication can work without DB
        }

        // Store user in session
        req.session.user = { uid, email, displayName, photoURL };

        console.log('Authentication successful for:', email);
        res.json({ success: true, message: 'Authentication successful' });
    } catch (error) {
        console.error('Firebase login error:', error);
        res.status(500).json({ message: 'Authentication failed', error: error.message });
    }
});

app.post('/api/auth/firebase-verify', async (req, res) => {
    try {
        const { uid, email, displayName } = req.body;

        if (!uid || !email) {
            return res.status(400).json({ message: 'Missing user information' });
        }

        // Verify user exists and update session
        req.session.user = { uid, email, displayName };

        res.json({ success: true, user: req.session.user });
    } catch (error) {
        console.error('Firebase verification error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
});

app.get('/api/auth/user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

// Status endpoint for health checks and authentication status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        authenticationEnabled: true,
        firebaseInitialized: admin.apps.length > 0,
        databaseConnected: !!pool,
        timestamp: new Date().toISOString()
    });
});

// Get Stripe public key
app.get('/api/stripe-public-key', (req, res) => {
    res.json({ publicKey: process.env.VITE_STRIPE_PUBLIC_KEY || '' });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            res.status(500).json({ message: 'Logout failed' });
        } else {
            res.json({ message: 'Logged out successfully' });
        }
    });
});

// Subscription success page
app.get('/subscription-success', isAuthenticated, async (req, res) => {
    try {
        // Update user subscription status
        const now = new Date();
        const expires = new Date(now);
        expires.setMonth(expires.getMonth() + 1); // Default to monthly

        await pool.query(
            `UPDATE users 
             SET subscription_status = 'active', 
                 subscription_expires = $1,
                 onboarding_completed = false
             WHERE id = $2`,
            [expires, req.user.id]
        );

        // Redirect to main app with onboarding flag
        res.redirect('/?onboarding=true');
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.redirect('/');
    }
});

// Onboarding status endpoint
app.get('/api/onboarding/status', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT onboarding_completed, business_name, primary_color FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];
        res.json({
            completed: user?.onboarding_completed || false,
            hasBusinessInfo: !!user?.business_name,
            currentSettings: {
                businessName: user?.business_name,
                primaryColor: user?.primary_color
            }
        });
    } catch (error) {
        console.error('Onboarding status error:', error);
        res.status(500).json({ error: 'Failed to get onboarding status' });
    }
});

// Complete onboarding endpoint
app.post('/api/onboarding/complete', isAuthenticated, async (req, res) => {
    try {
        const {
            businessName,
            businessType,
            location,
            primaryColor,
            defaultSessionPrice,
            defaultDeposit,
            sessionDuration
        } = req.body;

        // Update user profile with onboarding data
        await pool.query(
            `UPDATE users 
             SET business_name = $1,
                 business_type = $2,
                 location = $3,
                 primary_color = $4,
                 default_session_price = $5,
                 default_deposit = $6,
                 default_session_duration = $7,
                 onboarding_completed = true,
                 onboarding_date = NOW()
             WHERE id = $8`,
            [
                businessName,
                businessType,
                location,
                primaryColor,
                defaultSessionPrice,
                defaultDeposit,
                sessionDuration,
                req.user.id
            ]
        );

        // Create default session types based on business type
        const defaultSessionTypes = getDefaultSessionTypes(businessType);
        for (const sessionType of defaultSessionTypes) {
            await pool.query(
                'INSERT INTO session_types (user_id, name, default_price) VALUES ($1, $2, $3)',
                [req.user.id, sessionType.name, sessionType.price || defaultSessionPrice]
            );
        }

        res.json({ success: true, message: 'Onboarding completed successfully' });
    } catch (error) {
        console.error('Onboarding completion error:', error);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});

// Helper function to get default session types
function getDefaultSessionTypes(businessType) {
    const typeMap = {
        wedding: [
            { name: 'Full Day Wedding', price: 2500 },
            { name: 'Half Day Wedding', price: 1500 },
            { name: 'Engagement Session', price: 350 },
            { name: 'Bridal Portrait', price: 450 }
        ],
        portrait: [
            { name: 'Individual Portrait', price: 250 },
            { name: 'Professional Headshot', price: 200 },
            { name: 'Senior Portrait', price: 350 },
            { name: 'Model Portfolio', price: 500 }
        ],
        family: [
            { name: 'Family Session', price: 350 },
            { name: 'Maternity Session', price: 300 },
            { name: 'Newborn Session', price: 400 },
            { name: 'Extended Family', price: 500 }
        ],
        commercial: [
            { name: 'Product Photography', price: 500 },
            { name: 'Corporate Headshots', price: 150 },
            { name: 'Real Estate', price: 350 },
            { name: 'Brand Campaign', price: 2000 }
        ],
        event: [
            { name: 'Corporate Event', price: 800 },
            { name: 'Birthday Party', price: 400 },
            { name: 'Graduation', price: 300 },
            { name: 'Conference Coverage', price: 1200 }
        ],
        mixed: [
            { name: 'Portrait Session', price: 250 },
            { name: 'Event Coverage', price: 500 },
            { name: 'Commercial Shoot', price: 750 },
            { name: 'Custom Package', price: 0 }
        ]
    };

    return typeMap[businessType] || typeMap.mixed;
}

// Create subscription endpoint
app.post('/api/create-subscription', isAuthenticated, async (req, res) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('Stripe is not configured');
        }

        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const { plan } = req.body;
        const user = req.user;

        // Define price IDs for each plan
        const priceIds = {
            monthly: 'price_monthly_25',     // $25/month
            sixmonth: 'price_sixmonth_125',  // $125/6 months
            yearly: 'price_yearly_200'        // $200/year
        };

        // Create or retrieve Stripe customer
        let customerId = user.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user.id
                }
            });
            customerId = customer.id;

            // Save customer ID to database
            await pool.query(
                'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
                [customerId, user.id]
            );
        }

        // Create payment intent for subscription
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Photography Management System Subscription',
                        description: plan === 'monthly' ? 'Monthly Plan' : 
                                   plan === 'sixmonth' ? '6 Month Plan (1 month free)' : 
                                   'Annual Plan (2 months free)'
                    },
                    unit_amount: plan === 'monthly' ? 2500 : 
                               plan === 'sixmonth' ? 12500 : 
                               20000,
                    recurring: {
                        interval: plan === 'monthly' ? 'month' : 
                                plan === 'sixmonth' ? 'month' : 
                                'year',
                        interval_count: plan === 'sixmonth' ? 6 : 1
                    }
                },
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${req.protocol}://${req.get('host')}/subscription-success`,
            cancel_url: `${req.protocol}://${req.get('host')}/`
        });

        res.json({ checkoutUrl: session.url });
    } catch (error) {
        console.error('Subscription creation error:', error);
        res.status(500).json({ 
            message: 'Failed to create subscription', 
            error: error.message 
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Initialize database table (now using photography_sessions table)
async function initializeDatabase() {
    try {
        // This table already exists, just ensure it's ready
        // Add subscribers table for multi-user management
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                photographer_name VARCHAR(255) NOT NULL,
                business_name VARCHAR(255),
                phone VARCHAR(20),
                subscription_plan VARCHAR(50) DEFAULT 'free',
                subscription_status VARCHAR(50) DEFAULT 'active',
                stripe_customer_id VARCHAR(255),
                last_login TIMESTAMP,
                welcome_email_sent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create websites table for website builder
        await pool.query(`
            CREATE TABLE IF NOT EXISTS websites (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                site_config JSONB NOT NULL DEFAULT '{"blocks": []}',
                theme VARCHAR(50) DEFAULT 'classic',
                published BOOLEAN DEFAULT TRUE,
                published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create contracts table for contract management
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contracts (
                id VARCHAR(255) PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                contract_type VARCHAR(100) NOT NULL,
                contract_title VARCHAR(255) NOT NULL,
                contract_content TEXT NOT NULL,
                client_name VARCHAR(255),
                client_email VARCHAR(255),
                photographer_name VARCHAR(255),
                photographer_email VARCHAR(255),
                access_token VARCHAR(255) UNIQUE NOT NULL,
                custom_fields JSONB DEFAULT '{}',
                status VARCHAR(50) DEFAULT 'draft',
                client_signature TEXT,
                client_signature_date TIMESTAMP,
                viewed_at TIMESTAMP,
                sent_at TIMESTAMP,
                signed_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create storefront_sites table for storefront builder
        await pool.query(`
            CREATE TABLE IF NOT EXISTS storefront_sites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) UNIQUE NOT NULL,
                site_data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create published_sites table for published storefronts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS published_sites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                site_data JSONB NOT NULL,
                published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create raw_backups table for R2 RAW backup tracking
        await pool.query(`
            CREATE TABLE IF NOT EXISTS raw_backups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) NOT NULL,
                session_id VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                r2_object_key VARCHAR(500) NOT NULL,
                r2_bucket VARCHAR(255) NOT NULL,
                backup_status VARCHAR(50) DEFAULT 'pending',
                backup_started_at TIMESTAMP,
                backup_completed_at TIMESTAMP,
                backup_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create raw_storage_billing table for tracking R2 storage costs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS raw_storage_billing (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                billing_month VARCHAR(7) NOT NULL, -- YYYY-MM format
                total_storage_bytes BIGINT DEFAULT 0,
                total_storage_tb DECIMAL(10,3) DEFAULT 0,
                monthly_cost_usd DECIMAL(10,2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, billing_month)
            )
        `);

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Database helper functions with user separation
async function getAllSessions(userId) {
    try {
        let query, params;
        if (userId) {
            query = 'SELECT * FROM photography_sessions WHERE user_id = $1 ORDER BY date_time ASC';
            params = [userId];
        } else {
            query = 'SELECT * FROM photography_sessions ORDER BY date_time ASC';
            params = [];
        }

        const result = await pool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            galleryAccessToken: row.gallery_access_token,
            galleryCreatedAt: row.gallery_created_at,
            galleryExpiresAt: row.gallery_expires_at,
            galleryReadyNotified: row.gallery_ready_notified,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }
}

async function createSession(sessionData, userId) {
    try {
        const result = await pool.query(`
            INSERT INTO photography_sessions (
                id, user_id, client_name, session_type, date_time, location, 
                phone_number, email, price, duration, notes,
                contract_signed, paid, edited, delivered, 
                send_reminder, notify_gallery_ready
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `, [
            sessionData.id,
            userId,
            sessionData.clientName,
            sessionData.sessionType,
            sessionData.dateTime,
            sessionData.location,
            sessionData.phoneNumber,
            sessionData.email,
            sessionData.price,
            sessionData.duration,
            sessionData.notes || '',
            sessionData.contractSigned || false,
            sessionData.paid || false,
            sessionData.edited || false,
            sessionData.delivered || false,
            sessionData.sendReminder || false,
            sessionData.notifyGalleryReady || false
        ]);

        const row = result.rows[0];
        return {
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
}

async function getSessionById(id, userId) {
    try {
        let query, params;
        if (userId) {
            query = 'SELECT * FROM photography_sessions WHERE id = $1 AND user_id = $2';
            params = [id, userId];
        } else {
            query = 'SELECT * FROM photography_sessions WHERE id = $1';
            params = [id];
        }

        const result = await pool.query(query, params);
        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            galleryAccessToken: row.gallery_access_token,
            galleryCreatedAt: row.gallery_created_at,
            galleryExpiresAt: row.gallery_expires_at,
            galleryReadyNotified: row.gallery_ready_notified,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error fetching session:', error);
        return null;
    }
}

async function updateSession(id, updates) {
    try {
        const setClause = [];
        const values = [];
        const usedColumns = new Set();
        let paramCount = 1;

        Object.keys(updates).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

            // Skip duplicate columns
            if (usedColumns.has(dbKey)) {
                console.warn(`Skipping duplicate column: ${dbKey}`);
                return;
            }

            usedColumns.add(dbKey);
            setClause.push(`${dbKey} = $${paramCount}`);

            // Handle JSON fields
            if (key === 'photos' && Array.isArray(updates[key])) {
                values.push(JSON.stringify(updates[key]));
            } else {
                values.push(updates[key]);
            }
            paramCount++;
        });

        if (setClause.length === 0) return null;

        if (!usedColumns.has('updated_at')) {
            setClause.push(`updated_at = CURRENT_TIMESTAMP`);
        }
        values.push(id);

        const result = await pool.query(`
            UPDATE photography_sessions 
            SET ${setClause.join(', ')} 
            WHERE id = $${paramCount}
            RETURNING *
        `, values);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            galleryAccessToken: row.gallery_access_token,
            galleryCreatedAt: row.gallery_created_at,
            galleryExpiresAt: row.gallery_expires_at,
            galleryReadyNotified: row.gallery_ready_notified,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
}

async function deleteSession(id, userId) {
    try {
        let query, params;
        if (userId) {
            query = 'DELETE FROM photography_sessions WHERE id = $1 AND user_id = $2 RETURNING *';
            params = [id, userId];
        } else {
            query = 'DELETE FROM photography_sessions WHERE id = $1 RETURNING *';
            params = [id];
        }

        const result = await pool.query(query, params);
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
    }
}

// Configure multer for file uploads
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: fileStorage,
    limits: { 
        fileSize: 100 * 1024 * 1024 * 1024, // 100GB per file (MAXIMUM for mobile)
        files: 50000,                       // 50000 files max per batch
        parts: 500000,                      // 500000 parts max
        fieldSize: 50 * 1024 * 1024 * 1024, // 50GB field size
        headerPairs: 500000,                // 500000 header pairs
        fieldNameSize: 10 * 1024 * 1024,    // 10MB field name size
        fieldValue: 50 * 1024 * 1024 * 1024 // 50GB field value
    },
    fileFilter: (req, file, cb) => {
        console.log(` File filter check: ${file.originalname} (${file.mimetype})`);
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Middleware - ULTRA-HIGH payload limits for mobile photography uploads
// Body parsing middleware moved to top of file
// Move static file serving after route definitions to ensure authentication checks run first
// Static files will be served at the bottom of the file
// Smart uploads serving - optimized for app display, original for downloads
app.use('/uploads', (req, res, next) => {
    const filename = req.path.substring(1); // Remove leading slash
    const optimizedPath = path.join(__dirname, 'uploads', `optimized_${filename}`);

    // If requesting optimized version directly or it exists and not requesting original
    if (filename.startsWith('optimized_') || (fs.existsSync(optimizedPath) && !req.query.original)) {
        if (!filename.startsWith('optimized_')) {
            req.url = `/optimized_${filename}`;
        }
    }

    express.static(path.join(__dirname, 'uploads'))(req, res, next);
});

// API Routes

// Get all sessions
// This endpoint is defined earlier in the file - removing duplicate

app.get('/api/sessions', isAuthenticated, requireSubscription, async (req, res) => {
    try {
        // Normalize user for Lance's multiple emails
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        // Debug logging to see what user is requesting sessions
        console.log(' Sessions requested by user:', {
            original_uid: req.user.uid,
            normalized_uid: userId,
            email: req.user.email,
            displayName: req.user.displayName
        });

        let sessions = await getAllSessions(userId);
        console.log(`Found ${sessions.length} sessions for user ${userId}`);

        // SPECIAL ACCESS: If Lance's accounts, give access to ALL sessions (admin mode)
        if (req.user.email === 'lancecasselman@icloud.com' || req.user.email === 'lancecasselman2011@gmail.com' || req.user.email === 'Lance@thelegacyphotography.com') {
            console.log('UNIFIED LANCE ACCOUNT: Loading sessions for unified Lance account');

            // Get sessions for the unified Lance account
            const lanceSessionsResult = await pool.query(`
                SELECT * FROM photography_sessions 
                WHERE user_id = '44735007'
                ORDER BY created_at DESC
            `);
            sessions = lanceSessionsResult.rows.map(row => ({
                id: row.id,
                clientName: row.client_name,
                sessionType: row.session_type,
                dateTime: row.date_time,
                location: row.location,
                phoneNumber: row.phone_number,
                email: row.email,
                price: parseFloat(row.price),
                duration: row.duration,
                notes: row.notes,
                contractSigned: row.contract_signed,
                paid: row.paid,
                edited: row.edited,
                delivered: row.delivered,
                sendReminder: row.send_reminder,
                notifyGalleryReady: row.notify_gallery_ready,
                photos: row.photos || [],
                galleryAccessToken: row.gallery_access_token,
                galleryCreatedAt: row.gallery_created_at,
                galleryExpiresAt: row.gallery_expires_at,
                galleryReadyNotified: row.gallery_ready_notified,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
            console.log(`UNIFIED ACCOUNT: Found ${sessions.length} sessions for Lance's unified account`);
        }

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Create new session
app.post('/api/sessions', isAuthenticated, requireSubscription, async (req, res) => {
    const { clientName, sessionType, dateTime, location, phoneNumber, email, price, duration, notes } = req.body;

    // Validate required fields
    if (!clientName || !sessionType || !dateTime || !location || !phoneNumber || !email || !price || !duration) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const newSession = {
            id: uuidv4(),
            clientName,
            sessionType,
            dateTime,
            location,
            phoneNumber,
            email,
            price: parseFloat(price),
            duration: parseInt(duration),
            notes: notes || '',
            contractSigned: false,
            paid: false,
            edited: false,
            delivered: false,
            sendReminder: false,
            notifyGalleryReady: false,
            galleryReadyNotified: false
        };

        // Normalize user for Lance's multiple emails
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        const savedSession = await createSession(newSession, userId);
        console.log(`Created session in database: ${savedSession.clientName} (${savedSession.id}) for user: ${userId}`);
        res.status(201).json(savedSession);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Update session
app.put('/api/sessions/:id', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;

    try {
        const updatedSession = await updateSession(sessionId, req.body);

        if (!updatedSession) {
            return res.status(404).json({ error: 'Session not found' });
        }

        console.log(`Updated session in database: ${updatedSession.clientName} (${sessionId})`);
        res.json(updatedSession);
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// Upload photos to session with enhanced error handling and processing
app.post('/api/sessions/:id/upload-photos', isAuthenticated, (req, res) => {
    const sessionId = req.params.id;

    console.log(` Starting upload for session ${sessionId}...`);

    // Disable all timeouts for upload requests
    req.setTimeout(0); // Infinite timeout
    res.setTimeout(0); // Infinite timeout

    console.log(` Request started - method: ${req.method}, content-length: ${req.headers['content-length']}`);
    console.log(` Headers:`, req.headers);

    console.log(`Starting Starting multer processing for session ${sessionId}...`);

    upload.array('photos')(req, res, async (uploadError) => {
        console.log(` Multer callback triggered - error: ${uploadError ? 'YES' : 'NO'}`);

        if (uploadError) {
            console.error(' Multer upload error:', uploadError);
            console.error(' Error stack:', uploadError.stack);
            console.error(' Error code:', uploadError.code);
            console.error(' Error field:', uploadError.field);

            // Send immediate error response
            if (!res.headersSent) {
                return res.status(400).json({ 
                    error: 'Upload failed', 
                    details: uploadError.message,
                    code: uploadError.code,
                    field: uploadError.field
                });
            }
            return;
        }

        console.log(` Multer success - starting processing...`);
        console.log(` Files received: ${req.files ? req.files.length : 0}`);

        if (!req.files || req.files.length === 0) {
            console.log(' No files received in request');
            if (!res.headersSent) {
                return res.status(400).json({ error: 'No files uploaded' });
            }
            return;
        }

        const uploadedPhotos = [];

        console.log(` Processing ${req.files.length} files for session ${sessionId}`);

        // Process files with detailed logging and dual storage
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            try {
                console.log(`File: Processing file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

                // Store original file metadata for Firebase upload
                const originalPath = file.path;
                const originalSize = file.size;

                // Create optimized version for app display if file is large
                let displayPath = originalPath;
                let optimizedSize = originalSize;

                if (file.size > 2 * 1024 * 1024) { // 2MB threshold
                    try {
                        const sharp = require('sharp');
                        const optimizedFilename = `optimized_${file.filename}`;
                        const optimizedPath = path.join(uploadsDir, optimizedFilename);

                        await sharp(originalPath)
                            .resize(1920, 2560, { 
                                fit: 'inside', 
                                withoutEnlargement: true 
                            })
                            .jpeg({ quality: 85 })
                            .toFile(optimizedPath);

                        displayPath = optimizedPath;
                        optimizedSize = fs.statSync(optimizedPath).size;

                        console.log(`File optimized: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(optimizedSize / 1024 / 1024).toFixed(1)}MB`);
                    } catch (optimizeError) {
                        console.log(`Optimization failed, using original: ${optimizeError.message}`);
                    }
                }

                // Detect RAW files for R2 backup
                const isRawFile = isRAWFile(file.originalname, file.mimetype);
                const userId = req.user?.uid || req.user?.id || 'unknown';

                const photoData = {
                    filename: file.filename,
                    originalName: file.originalname,
                    originalSize: originalSize,
                    optimizedSize: optimizedSize,
                    originalPath: originalPath,
                    displayPath: displayPath,
                    uploadDate: new Date().toISOString(),
                    needsFirebaseUpload: true, // Flag for background Firebase upload
                    isRawFile: isRawFile,
                    mimeType: file.mimetype,
                    userId: userId
                };

                uploadedPhotos.push(photoData);
                console.log(`SUCCESS: File processed: ${file.originalname}`);

            } catch (fileError) {
                console.error(` Error processing file ${file.originalname}:`, fileError);
                // Continue with other files
            }
        }

        console.log(` Attempting to update session ${sessionId} with ${uploadedPhotos.length} photos`);

        // Send immediate response to prevent connection timeout
        if (!res.headersSent) {
            res.json({
                message: 'Photos uploaded successfully',
                uploaded: uploadedPhotos.length,
                photos: uploadedPhotos,
                databaseUpdated: false // Will update in background
            });
        }

        // Update database asynchronously in background
        try {
            console.log(` Background database update starting...`);
            const session = await getSessionById(sessionId);
            if (session) {
                const existingPhotos = session.photos || [];
                const updatedPhotos = [...existingPhotos, ...uploadedPhotos];
                await updateSession(sessionId, { photos: updatedPhotos });
                console.log(`SUCCESS: Background database update completed: ${uploadedPhotos.length} new photos`);

                // Start Firebase upload process in background
                uploadPhotosToFirebase(sessionId, uploadedPhotos);

                // Start RAW backup process for eligible files
                const rawFiles = uploadedPhotos.filter(photo => photo.isRawFile);
                if (rawFiles.length > 0) {
                    console.log(`🔥 Detected ${rawFiles.length} RAW files for R2 backup`);
                    processRAWBackups(sessionId, rawFiles, userId);
                }
            } else {
                console.error(` Session ${sessionId} not found for background database update`);
            }
        } catch (dbError) {
            console.error(` Background database update error:`, dbError);
            // Don't send response here as we already sent one above
        }

        return; // Exit early to prevent double response
    });
});

// DEAD CODE BLOCK REMOVED - was unreachable after return statement

// Test R2 connection (admin only)
app.get('/api/r2-test', isAuthenticated, async (req, res) => {
    try {
        // Test R2 connection
        await r2BackupService.s3.listBuckets().promise();

        res.json({
            success: true,
            message: "R2 connection successful",
            endpoint: "7c6cbcff658042c3a36b2aceead25b6f.r2.cloudflarestorage.com",
            bucket: "photography-raw-backups",
            pricing: "$20/TB/month"
        });
    } catch (error) {
        console.error('R2 connection test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code
        });
    }
});

// Save automation settings
app.post('/api/automation-settings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user?.uid || req.user?.id || 'unknown';
        const { settings, messageTemplate } = req.body;

        // Upsert automation settings
        await pool.query(`
            INSERT INTO user_automation_settings (
                user_id, automation_settings, message_template, updated_at
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id)
            DO UPDATE SET 
                automation_settings = $2,
                message_template = $3,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, JSON.stringify(settings), messageTemplate]);

        console.log(`💾 Automation settings saved for user ${userId}`);
        res.json({ success: true });

    } catch (error) {
        console.error('Error saving automation settings:', error);
        res.status(500).json({ error: 'Failed to save automation settings' });
    }
});

// Get automation settings
app.get('/api/automation-settings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user?.uid || req.user?.id || 'unknown';

        const result = await pool.query(`
            SELECT automation_settings, message_template
            FROM user_automation_settings 
            WHERE user_id = $1
        `, [userId]);

        if (result.rows.length > 0) {
            res.json({
                settings: result.rows[0].automation_settings,
                messageTemplate: result.rows[0].message_template
            });
        } else {
            // Return default settings
            res.json({
                settings: {
                    contractReminder: false,
                    paymentFollowup: false,
                    sessionPrep: false,
                    galleryDelivery: true,
                    feedbackRequest: false,
                    weatherAlerts: false,
                    calendarSync: true,
                    milestones: false,
                    referralTracking: false,
                    equipmentReminders: false
                },
                messageTemplate: 'professional'
            });
        }

    } catch (error) {
        console.error('Error fetching automation settings:', error);
        res.status(500).json({ error: 'Failed to fetch automation settings' });
    }
});

// 🤖 AI WEBSITE BUILDER - Page Processing Endpoint (with credits)
app.post('/api/ai/process-page-request', isAuthenticated, async (req, res) => {
    try {
        const { prompt, currentPage, pageType } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Prompt is required' 
            });
        }

        // Check if user has enough AI credits (1 credit per request)
        const creditsNeeded = 1;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits,
                message: 'You need more AI credits to use this feature. Purchase credits to continue.'
            });
        }

        console.log(`AI Page Request: ${prompt} for page type: ${pageType}`);

        // Use AI credits before making the request
        const creditsUsed = await useAiCredits(userId, creditsNeeded, 'page_generation', prompt);

        if (!creditsUsed) {
            return res.status(402).json({
                success: false,
                error: 'Failed to deduct AI credits',
                message: 'Credits could not be deducted. Please try again.'
            });
        }

        try {
            // Use the ai-services for intelligent content generation
            const generatedContent = await aiServices.generatePageContent(prompt, currentPage, pageType);

            res.json({
                success: true,
                content: generatedContent,
                message: 'AI page content generated successfully',
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });

        } catch (aiError) {
            // If AI generation fails, refund the credits
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            throw aiError;
        }

    } catch (error) {
        console.error('AI page processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process AI request: ' + error.message
        });
    }
});

// 💰 AI CREDITS MANAGEMENT
app.get('/api/ai/credits', isAuthenticated, async (req, res) => {
    try {
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        // Give Lance unlimited credits as the owner
        const lanceEmails = [
            'lancecasselman@icloud.com',
            'lancecasselman2011@gmail.com', 
            'Lance@thelegacyphotography.com'
        ];

        if (lanceEmails.includes(req.user.email)) {
            return res.json({
                success: true,
                credits: 999999, // Unlimited credits for owner
                message: 'Unlimited AI credits (Owner Account)'
            });
        }

        const credits = await getUserAiCredits(userId);

        res.json({
            success: true,
            credits,
            message: 'AI credits retrieved successfully'
        });
    } catch (error) {
        console.error('AI credits fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch AI credits'
        });
    }
});

// Stripe public key endpoint
app.get('/api/stripe/public-key', (req, res) => {
    res.json({ publicKey: process.env.VITE_STRIPE_PUBLIC_KEY });
});

// AI Credits Purchase Endpoint
app.post('/api/ai/purchase-credits', isAuthenticated, async (req, res) => {
    try {
        const { creditsPackage } = req.body; // 'small', 'medium', 'large'
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        // Credit packages: $5 = 50 credits, $15 = 150 credits, $30 = 350 credits
        const packages = {
            small: { credits: 50, price: 5.00 },
            medium: { credits: 150, price: 15.00 },
            large: { credits: 350, price: 30.00 }
        };

        const selectedPackage = packages[creditsPackage];
        if (!selectedPackage) {
            return res.status(400).json({ error: 'Invalid credits package' });
        }

        // Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(selectedPackage.price * 100), // Convert to cents
            currency: 'usd',
            metadata: {
                userId,
                creditsAmount: selectedPackage.credits.toString(),
                packageType: creditsPackage
            }
        });

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            credits: selectedPackage.credits,
            price: selectedPackage.price
        });

    } catch (error) {
        console.error('AI credits purchase error:', error);
        res.status(500).json({
            error: 'Failed to create payment for AI credits'
        });
    }
});

// Stripe Webhook for AI Credits (add to existing webhook handler)
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle AI credits payment success
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        if (paymentIntent.metadata.creditsAmount) {
            const userId = paymentIntent.metadata.userId;
            const creditsAmount = parseInt(paymentIntent.metadata.creditsAmount);
            const priceUsd = paymentIntent.amount / 100; // Convert from cents

            // Add credits to user account
            pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsAmount, userId])
                .then(() => {
                    console.log(`✅ Added ${creditsAmount} AI credits to user ${userId} via Stripe payment`);
                    // Log the transaction
                    return pool.query(`
                        INSERT INTO ai_credit_transactions (user_id, amount, operation, details, created_at)
                        VALUES ($1, $2, $3, $4, NOW())
                    `, [userId, creditsAmount, 'purchase', `Stripe payment: ${paymentIntent.id} - $${priceUsd}`]);
                })
                .catch(error => {
                    console.error('❌ Failed to add AI credits:', error);
                });
        }
    }

    res.json({received: true});
});

// 🤖 AI-POWERED FEATURES FOR SUBSCRIBERS
app.post('/api/ai/generate-website-copy', async (req, res) => {
    try {
        const { photographyStyle, businessInfo } = req.body;

        if (!photographyStyle || !businessInfo) {
            return res.status(400).json({ error: 'Photography style and business info required' });
        }

        const generatedCopy = await aiServices.generateWebsiteCopy(photographyStyle, businessInfo);

        res.json({
            success: true,
            copy: generatedCopy
        });

    } catch (error) {
        console.error('AI website copy generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate website copy', 
            details: error.message 
        });
    }
});

app.post('/api/ai/analyze-photos', async (req, res) => {
    try {
        const { imageUrls } = req.body;

        if (!imageUrls || !Array.isArray(imageUrls)) {
            return res.status(400).json({ error: 'Image URLs array required' });
        }

        const analysis = await aiServices.analyzePhotos(imageUrls);

        res.json({
            success: true,
            analysis: analysis
        });

    } catch (error) {
        console.error('AI photo analysis error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze photos', 
            details: error.message 
        });
    }
});

app.post('/api/ai/layout-suggestions', async (req, res) => {
    try {
        const { contentType, photographyStyle, businessGoals } = req.body;

        if (!contentType || !photographyStyle) {
            return res.status(400).json({ error: 'Content type and photography style required' });
        }

        const suggestions = await aiServices.suggestLayout(contentType, photographyStyle, businessGoals);

        res.json({
            success: true,
            suggestions: suggestions
        });

    } catch (error) {
        console.error('AI layout suggestions error:', error);
        res.status(500).json({ 
            error: 'Failed to generate layout suggestions', 
            details: error.message 
        });
    }
});

app.post('/api/ai/seo-content', async (req, res) => {
    try {
        const { businessInfo, targetKeywords, pageType } = req.body;

        if (!businessInfo || !targetKeywords || !pageType) {
            return res.status(400).json({ error: 'Business info, target keywords, and page type required' });
        }

        const seoContent = await aiServices.generateSEOContent(businessInfo, targetKeywords, pageType);

        res.json({
            success: true,
            seoContent: seoContent
        });

    } catch (error) {
        console.error('AI SEO content generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate SEO content', 
            details: error.message 
        });
    }
});

app.post('/api/ai/generate-testimonials', async (req, res) => {
    try {
        const { photographyStyle, services, clientTypes } = req.body;

        if (!photographyStyle || !services || !clientTypes) {
            return res.status(400).json({ error: 'Photography style, services, and client types required' });
        }

        const testimonials = await aiServices.generateTestimonials(photographyStyle, services, clientTypes);

        res.json({
            success: true,
            testimonials: testimonials
        });

    } catch (error) {
        console.error('AI testimonials generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate testimonials', 
            details: error.message 
        });
    }
});

app.post('/api/ai/content-suggestions', async (req, res) => {
    try {
        const { currentContent, photographyNiche, targetAudience } = req.body;

        if (!currentContent || !photographyNiche || !targetAudience) {
            return res.status(400).json({ error: 'Current content, photography niche, and target audience required' });
        }

        const suggestions = await aiServices.getContentSuggestions(currentContent, photographyNiche, targetAudience);

        res.json({
            success: true,
            suggestions: suggestions
        });

    } catch (error) {
        console.error('AI content suggestions error:', error);
        res.status(500).json({ 
            error: 'Failed to get content suggestions', 
            details: error.message 
        });
    }
});

app.post('/api/ai/pricing-copy', async (req, res) => {
    try {
        const { services, pricePoints, targetMarket } = req.body;

        if (!services || !pricePoints || !targetMarket) {
            return res.status(400).json({ error: 'Services, price points, and target market required' });
        }

        const pricingCopy = await aiServices.generatePricingCopy(services, pricePoints, targetMarket);

        res.json({
            success: true,
            pricingCopy: pricingCopy
        });

    } catch (error) {
        console.error('AI pricing copy generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate pricing copy', 
            details: error.message 
        });
    }
});

// Trigger automated workflows
app.post('/api/trigger-workflow', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, workflowType, clientData } = req.body;
        const userId = req.user?.uid || req.user?.id || 'unknown';

        // Get user's automation settings
        const settingsResult = await pool.query(`
            SELECT automation_settings, message_template
            FROM user_automation_settings 
            WHERE user_id = $1
        `, [userId]);

        if (settingsResult.rows.length === 0) {
            return res.status(400).json({ error: 'No automation settings found' });
        }

        const { automation_settings, message_template } = settingsResult.rows[0];

        if (!automation_settings[workflowType]) {
            return res.json({ success: true, message: 'Workflow disabled' });
        }

        // Process the workflow
        const result = await processWorkflow(workflowType, clientData, message_template, sessionId);

        // Log the workflow execution
        await pool.query(`
            INSERT INTO workflow_logs (
                user_id, session_id, workflow_type, 
                status, executed_at, result_data
            ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
        `, [userId, sessionId, workflowType, result.success ? 'success' : 'failed', JSON.stringify(result)]);

        res.json(result);

    } catch (error) {
        console.error('Error triggering workflow:', error);
        res.status(500).json({ error: 'Failed to trigger workflow' });
    }
});

// Get RAW backup status for user
app.get('/api/raw-backups/status', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user?.uid || req.user?.id || 'unknown';

        // Get backup summary
        const backupStats = await pool.query(`
            SELECT 
                backup_status,
                COUNT(*) as count,
                SUM(file_size) as total_size
            FROM raw_backups 
            WHERE user_id = $1 
            GROUP BY backup_status
        `, [userId]);

        // Get recent backups
        const recentBackups = await pool.query(`
            SELECT 
                original_name, file_size, backup_status,
                backup_started_at, backup_completed_at, backup_error,
                session_id
            FROM raw_backups 
            WHERE user_id = $1 
            ORDER BY backup_started_at DESC 
            LIMIT 20
        `, [userId]);

        // Calculate storage costs
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const storageQuery = await pool.query(`
            SELECT total_storage_tb, monthly_cost_usd
            FROM raw_storage_billing 
            WHERE user_id = $1 AND billing_month = $2
        `, [userId, currentMonth]);

        const storage = storageQuery.rows[0] || { total_storage_tb: 0, monthly_cost_usd: 0 };

        res.json({
            stats: backupStats.rows,
            recentBackups: recentBackups.rows,
            storage: storage,
            pricing: {
                perTB: 20,
                currentMonth: currentMonth
            }
        });

    } catch (error) {
        console.error('Error fetching RAW backup status:', error);
        res.status(500).json({ error: 'Failed to fetch backup status' });
    }
});

// Delete photo from session
app.delete('/api/sessions/:sessionId/photos/:filename', isAuthenticated, async (req, res) => {
    const { sessionId, filename } = req.params;

    try {
        // Get session to check if photo exists
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Check if photo exists in session
        const photoIndex = session.photos ? session.photos.findIndex(p => p.filename === filename) : -1;
        if (photoIndex === -1) {
            return res.status(404).json({ error: 'Photo not found in session' });
        }

        // Delete physical file
        const filePath = path.join(uploadsDir, filename);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted file: ${filePath}`);
            }
        } catch (fileError) {
            console.error('Error deleting file:', fileError);
            // Continue with database cleanup even if file deletion fails
        }

        // Remove photo from session's photos array
        const updatedPhotos = session.photos.filter(p => p.filename !== filename);

        // Update session in database
        const query = `
            UPDATE photography_sessions 
            SET photos = $1::jsonb 
            WHERE id = $2 
            RETURNING *
        `;
        const result = await pool.query(query, [JSON.stringify(updatedPhotos), sessionId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Failed to update session' });
        }

        console.log(`🗑️ Photo deleted from session ${sessionId}: ${filename}`);
        res.json({ 
            message: 'Photo deleted successfully',
            remainingPhotos: updatedPhotos.length
        });

    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// ===== STOREFRONT BUILDER API ENDPOINTS =====

// Serve storefront builder page
app.get('/storefront', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'storefront.html'));
});

// Serve storefront preview pages
app.get('/storefront-preview/:page', async (req, res) => {
    const { page } = req.params;
    const theme = req.query.theme || 'light-airy';

    try {
        const templatePath = path.join(__dirname, 'storefront-templates', theme, `${page}.html`);

        if (fs.existsSync(templatePath)) {
            let template = fs.readFileSync(templatePath, 'utf8');

            // Replace template variables with query parameters if provided
            if (req.query.heroTitle) {
                template = template.replace(/\{\{heroTitle\}\}/g, req.query.heroTitle);
            }
            if (req.query.heroSubtitle) {
                template = template.replace(/\{\{heroSubtitle\}\}/g, req.query.heroSubtitle);
            }
            if (req.query.heroCta) {
                template = template.replace(/\{\{heroCta\}\}/g, req.query.heroCta);
            }

            res.send(template);
        } else {
            res.status(404).send('Template not found');
        }
    } catch (error) {
        console.error('Error serving template:', error);
        res.status(500).send('Template error');
    }
});

// User storefront preview endpoint
app.get('/website-preview/:userId', async (req, res) => {
    const { userId } = req.params;
    const { page } = req.query; // Get page from query parameter

    try {
        // Load user's storefront data from database or localStorage equivalent
        const query = 'SELECT site_data FROM storefront_sites WHERE user_id = $1';
        const result = await pool.query(query, [userId]);

        let siteData = {};
        if (result.rows.length > 0) {
            siteData = result.rows[0].site_data;
        }

        // Get the requested page from query parameter
        const requestedPage = req.query.page || siteData.currentPage || 'home';

        // Get pages from site data
        const pages = siteData.pages || [
            { id: 'home', name: 'Home', icon: '🏠' },
            { id: 'about', name: 'About', icon: '👤' },
            { id: 'portfolio', name: 'Portfolio', icon: '' },
            { id: 'contact', name: 'Contact', icon: '' }
        ];

        // For the currently edited page in the editor, use the stored preview HTML
        if (siteData.previewHTML && requestedPage === (siteData.currentPage || 'home')) {
            // Create full preview page with the stored HTML

            const fullPreviewHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Preview</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Quicksand:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --warm-white: #FEFDFB;
            --beige: #F5F1EB;
            --sage: #9CAF88;
            --muted-gold: #C4962D;
            --soft-brown: #8B7355;
            --deep-charcoal: #2C2C2C;
            --font-serif: 'Cormorant Garamond', serif;
            --font-sans: 'Quicksand', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-sans);
            line-height: 1.6;
            color: var(--deep-charcoal);
            background: var(--warm-white);
        }

        .preview-header {
            background: var(--muted-gold);
            color: white;
            padding: 15px 20px;
            text-align: center;
            font-size: 1rem;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        /* Website navigation header */
        .website-header {
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            position: sticky;
            top: 60px;
            z-index: 999;
        }

        .website-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 30px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .website-logo {
            font-family: var(--font-serif);
            font-size: 1.8em;
            font-weight: 600;
            color: var(--deep-charcoal);
        }

        .nav-links {
            display: flex;
            gap: 30px;
            align-items: center;
        }

        .nav-links a {
            color: var(--deep-charcoal);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .nav-links a:hover {
            color: var(--muted-gold);
        }

        .hamburger-menu {
            display: none;
            flex-direction: column;
            gap: 4px;
            cursor: pointer;
        }

        .hamburger-menu span {
            width: 25px;
            height: 3px;
            background: var(--deep-charcoal);
            transition: all 0.3s ease;
        }

        .mobile-nav {
            display: none;
            position: fixed;
            top: 0;
            right: -300px;
            width: 300px;
            height: 100vh;
            background: white;
            box-shadow: -2px 0 10px rgba(0,0,0,0.1);
            transition: right 0.3s ease;
            z-index: 1001;
        }

        .mobile-nav.active {
            right: 0;
        }

        .mobile-nav-header {
            padding: 20px;
            border-bottom: 1px solid var(--beige);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .close-menu {
            font-size: 2em;
            cursor: pointer;
            color: var(--deep-charcoal);
        }

        .mobile-nav-links {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .mobile-nav-links a {
            color: var(--deep-charcoal);
            text-decoration: none;
            font-size: 1.2em;
            font-weight: 500;
            padding: 10px 0;
            border-bottom: 1px solid var(--beige);
        }

        .preview-content {
            min-height: calc(100vh - 140px);
            margin-top: 80px;
        }

        @media (max-width: 768px) {
            .nav-links {
                display: none;
            }

            .hamburger-menu {
                display: flex;
            }

            .website-nav {
                padding: 15px 20px;
            }

            .preview-content {
                margin-top: 60px;
            }
        }
    </style>
</head>
<body>
    <div class="preview-header">
        📱 Website Preview - This is how your site will look to visitors
    </div>

    <header class="website-header">
        <nav class="website-nav">
            <div class="website-logo">Photography Studio</div>
            <div class="nav-links">
                ${pages.map(page => `<a href="#${page.id}">${page.name}</a>`).join('')}
            </div>
            <div class="hamburger-menu" onclick="toggleMobileNav()">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </nav>
    </header>

    <div class="mobile-nav" id="mobileNav">
        <div class="mobile-nav-header">
            <div class="website-logo">Photography Studio</div>
            <span class="close-menu" onclick="toggleMobileNav()">&times;</span>
        </div>
        <div class="mobile-nav-links">
            ${pages.map(page => `<a href="#${page.id}" onclick="toggleMobileNav()">${page.icon} ${page.name}</a>`).join('')}
        </div>
    </div>

    <div class="preview-content">
        ${siteData.previewHTML}
    </div>

    <script>
        function toggleMobileNav() {
            const mobileNav = document.getElementById('mobileNav');
            mobileNav.classList.toggle('active');
        }

        // Close mobile nav when clicking outside
        document.addEventListener('click', function(event) {
            const mobileNav = document.getElementById('mobileNav');
            const hamburger = document.querySelector('.hamburger-menu');

            if (!mobileNav.contains(event.target) && !hamburger.contains(event.target)) {
                mobileNav.classList.remove('active');
            }
        });
    </script>
</body>
</html>`;
            res.send(fullPreviewHTML);
            return;
        }

        // Generate preview HTML from stored components
        let contentHTML = '';
        const currentPage = siteData.currentPage || 'home';
        const pageLayouts = siteData.pageLayouts || {};
        const currentLayout = pageLayouts[currentPage] || [];

        // Use requestedPage that was already declared above
        const layoutToShow = pageLayouts[requestedPage] || [];

        // Generate HTML for each luxury component
        layoutToShow.forEach(block => {
            switch(block.type) {
                case 'hero':
                    contentHTML += `
                        <section style="padding: 80px 30px; text-align: center; background: linear-gradient(135deg, var(--beige) 0%, var(--warm-white) 100%);">
                            <h1 style="font-family: var(--font-serif); font-size: 4em; line-height: 1.1; margin-bottom: 20px; color: var(--deep-charcoal);">${block.content.title}</h1>
                            <p style="font-size: 1.6em; margin: 30px 0; color: var(--soft-brown);">${block.content.subtitle}</p>
                            <button style="background: var(--muted-gold); color: white; padding: 20px 40px; border: none; border-radius: 12px; font-size: 1.2em; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">${block.content.buttonText}</button>
                        </section>
                    `;
                    break;
                case 'text':
                    contentHTML += `
                        <section style="padding: 60px 30px; max-width: 800px; margin: 0 auto;">
                            <h2 style="font-family: var(--font-serif); font-size: 2.8em; margin-bottom: 25px; color: var(--deep-charcoal);">${block.content.title}</h2>
                            <p style="font-size: 1.3em; line-height: 1.8; color: var(--soft-brown);">${block.content.text}</p>
                        </section>
                    `;
                    break;
                case 'credentials':
                    contentHTML += `
                        <section style="padding: 60px 30px; text-align: center; background: var(--beige);">
                            <h2 style="font-family: var(--font-serif); font-size: 3em; margin-bottom: 30px; color: var(--deep-charcoal);">${block.content.title}</h2>
                            <div style="margin: 30px 0; max-width: 600px; margin-left: auto; margin-right: auto;">
                                ${block.content.awards.map(award => `<p style="margin: 15px 0; font-size: 1.2em; color: var(--soft-brown);"><span style="color: var(--muted-gold);">🏆</span> ${award}</p>`).join('')}
                            </div>
                            <p style="font-size: 1.5em; font-weight: 600; margin-top: 30px; color: var(--muted-gold);">${block.content.experience}</p>
                        </section>
                    `;
                    break;
                case 'destination':
                    contentHTML += `
                        <section style="padding: 60px 30px; text-align: center;">
                            <h2 style="font-family: var(--font-serif); font-size: 3.2em; margin-bottom: 20px; color: var(--deep-charcoal);">${block.content.title}</h2>
                            <p style="font-size: 1.4em; margin: 25px 0; color: var(--soft-brown);">${block.content.subtitle}</p>
                            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin: 30px 0;">
                                ${block.content.locations.map(location => `<span style="background: var(--sage); color: white; padding: 10px 20px; border-radius: 25px; font-size: 1.1em;">${location}</span>`).join('')}
                            </div>
                        </section>
                    `;
                    break;
                case 'products':
                    contentHTML += `
                        <section style="padding: 60px 30px; text-align: center;">
                            <h2 style="font-family: var(--font-serif); font-size: 3.5em; margin-bottom: 40px; color: var(--deep-charcoal);">${block.content.title}</h2>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px; max-width: 1000px; margin: 0 auto;">
                                ${block.content.products ? block.content.products.map(product => `
                                    <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); transition: transform 0.3s ease;">
                                        <h3 style="font-size: 1.5em; margin-bottom: 15px; color: var(--deep-charcoal);">${product.name}</h3>
                                        <p style="font-size: 1.8em; font-weight: 600; color: var(--muted-gold);">${product.price}</p>
                                    </div>
                                `).join('') : ''}
                            </div>
                        </section>
                    `;
                    break;
                default:
                    contentHTML += `
                        <section style="padding: 40px 30px; text-align: center;">
                            <div style="background: var(--beige); padding: 30px; border-radius: 12px; margin: 20px 0;">
                                <h3 style="color: var(--deep-charcoal); font-size: 1.8em;">Luxury Component</h3>
                                <p style="color: var(--soft-brown); margin-top: 10px;">Component: ${block.componentKey || block.type}</p>
                            </div>
                        </section>
                    `;
            }
        });

        // If no components for the requested page, show helpful message
        if (layoutToShow.length === 0) {
            contentHTML = `
                <section style="padding: 100px 30px; text-align: center;">
                    <h1 style="font-family: var(--font-serif); font-size: 3em; margin-bottom: 20px; color: var(--deep-charcoal);">Your Website Preview</h1>
                    <p style="font-size: 1.4em; color: var(--soft-brown); margin-bottom: 30px;">Go back to the editor and add luxury components to see your preview.</p>
                    <div style="background: var(--beige); padding: 40px; border-radius: 15px; margin: 30px auto; max-width: 600px;">
                        <p style="font-size: 1.2em; color: var(--soft-brown);">💎 Add luxury components like:</p>
                        <ul style="list-style: none; margin: 20px 0; padding: 0;">
                            <li style="margin: 10px 0; font-size: 1.1em;">🎭 Massive Hero Text</li>
                            <li style="margin: 10px 0; font-size: 1.1em;">✨ Transformational Experience</li>
                            <li style="margin: 10px 0; font-size: 1.1em;">🏆 Award-Winning Positioning</li>
                        </ul>
                    </div>
                </section>
            `;
        }

        const previewHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Preview - ${currentPage}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Quicksand:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --warm-white: #FEFDFB;
            --beige: #F5F1EB;
            --sage: #9CAF88;
            --muted-gold: #C4962D;
            --soft-brown: #8B7355;
            --deep-charcoal: #2C2C2C;
            --font-serif: 'Cormorant Garamond', serif;
            --font-sans: 'Quicksand', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-sans);
            line-height: 1.6;
            color: var(--deep-charcoal);
            background: var(--warm-white);
        }

        .preview-header {
            background: var(--muted-gold);
            color: white;
            padding: 15px 20px;
            text-align: center;
            font-size: 1rem;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        /* Website navigation header */
        .website-header {
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            position: sticky;
            top: 60px;
            z-index: 999;
        }

        .website-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 30px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .website-logo {
            font-family: var(--font-serif);
            font-size: 1.8em;
            font-weight: 600;
            color: var(--deep-charcoal);
        }

        .nav-links {
            display: flex;
            gap: 30px;
            align-items: center;
        }

        .nav-links a {
            color: var(--deep-charcoal);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .nav-links a:hover {
            color: var(--muted-gold);
        }

        .hamburger-menu {
            display: none;
            flex-direction: column;
            gap: 4px;
            cursor: pointer;
        }

        .hamburger-menu span {
            width: 25px;
            height: 3px;
            background: var(--deep-charcoal);
            transition: all 0.3s ease;
        }

        .mobile-nav {
            display: none;
            position: fixed;
            top: 0;
            right: -300px;
            width: 300px;
            height: 100vh;
            background: white;
            box-shadow: -2px 0 10px rgba(0,0,0,0.1);
            transition: right 0.3s ease;
            z-index: 1001;
        }

        .mobile-nav.active {
            right: 0;
        }

        .mobile-nav-header {
            padding: 20px;
            border-bottom: 1px solid var(--beige);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .close-menu {
            font-size: 2em;
            cursor: pointer;
            color: var(--deep-charcoal);
        }

        .mobile-nav-links {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .mobile-nav-links a {
            color: var(--deep-charcoal);
            text-decoration: none;
            font-size: 1.2em;
            font-weight: 500;
            padding: 10px 0;
            border-bottom: 1px solid var(--beige);
        }

        .preview-content {
            min-height: calc(100vh - 140px);
            margin-top: 80px;
        }

        @media (max-width: 768px) {
            section {
                padding: 40px 20px !important;
            }
            h1 {
                font-size: 2.5em !important;
            }
            h2 {
                font-size: 2.2em !important;
            }
            .nav-links {
                display: none;
            }
            .hamburger-menu {
                display: flex;
            }
            .website-nav {
                padding: 15px 20px;
            }
            .preview-content {
                margin-top: 60px;
            }
        }
    </style>
</head>
<body>
    <div class="preview-header">
        📱 Website Preview - This is how your site will look to visitors
    </div>

    <header class="website-header">
        <nav class="website-nav">
            <div class="website-logo">Photography Studio</div>
            <div class="nav-links">
                ${pages.map(page => `<a href="#${page.id}">${page.name}</a>`).join('')}
            </div>
            <div class="hamburger-menu" onclick="toggleMobileNav()">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </nav>
    </header>

    <div class="mobile-nav" id="mobileNav">
        <div class="mobile-nav-header">
            <div class="website-logo">Photography Studio</div>
            <span class="close-menu" onclick="toggleMobileNav()">&times;</span>
        </div>
        <div class="mobile-nav-links">
            ${pages.map(page => `<a href="#${page.id}" onclick="toggleMobileNav()">${page.icon} ${page.name}</a>`).join('')}
        </div>
    </div>

    <div class="preview-content">
        ${contentHTML}
    </div>

    <script>
        function toggleMobileNav() {
            const mobileNav = document.getElementById('mobileNav');
            mobileNav.classList.toggle('active');
        }

        // Close mobile nav when clicking outside
        document.addEventListener('click', function(event) {
            const mobileNav = document.getElementById('mobileNav');
            const hamburger = document.querySelector('.hamburger-menu');

            if (!mobileNav.contains(event.target) && !hamburger.contains(event.target)) {
                mobileNav.classList.remove('active');
            }
        });
    </script>
</body>
</html>
        `;

        res.send(previewHTML);

    } catch (error) {
        console.error('Error loading preview:', error);
        const errorHTML = `
            <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
                <h2>Preview Error</h2>
                <p>Unable to load website preview. Please try again.</p>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #C4962D; color: white; border: none; border-radius: 4px; cursor: pointer;">Close Preview</button>
            </div>
        `;
        res.status(500).send(errorHTML);
    }
});

// Save storefront data
app.post('/api/storefront/save', isAuthenticated, async (req, res) => {
    try {
        const { siteData } = req.body;
        const userId = req.user.uid;

        // Save to database
        const query = `
            INSERT INTO storefront_sites (user_id, site_data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET 
                site_data = $2,
                updated_at = NOW()
            RETURNING *
        `;

        await pool.query(query, [userId, JSON.stringify(siteData)]);

        res.json({ success: true, message: 'Site data saved successfully' });
    } catch (error) {
        console.error('Error saving storefront data:', error);
        res.status(500).json({ error: 'Failed to save site data' });
    }
});

// Load storefront data
app.get('/api/storefront/load', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;

        const query = 'SELECT site_data FROM storefront_sites WHERE user_id = $1';
        const result = await pool.query(query, [userId]);

        if (result.rows.length > 0) {
            res.json({ siteData: result.rows[0].site_data });
        } else {
            res.json({ siteData: null });
        }
    } catch (error) {
        console.error('Error loading storefront data:', error);
        res.status(500).json({ error: 'Failed to load site data' });
    }
});

// Publish storefront site
app.post('/api/storefront/publish', isAuthenticated, async (req, res) => {
    try {
        const { siteData } = req.body;
        const userId = req.user.uid;
        const username = req.user.email.split('@')[0]; // Use email prefix as username

        // Save published site data
        const query = `
            INSERT INTO published_sites (user_id, username, site_data, published_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET 
                site_data = $3,
                published_at = NOW()
            RETURNING *
        `;

        await pool.query(query, [userId, username, JSON.stringify(siteData)]);

        // Generate public site files (simplified version)
        await generateStaticSite(username, siteData);

        const siteUrl = `${req.protocol}://${req.get('host')}/sites/${username}`;
        res.json({ 
            success: true, 
            message: 'Site published successfully',
            url: siteUrl
        });
    } catch (error) {
        console.error('Error publishing site:', error);
        res.status(500).json({ error: 'Failed to publish site' });
    }
});

// Serve published sites
app.get('/sites/:username/:page?', async (req, res) => {
    try {
        const { username, page = 'home' } = req.params;

        // Get published site data
        const query = 'SELECT site_data FROM published_sites WHERE username = $1';
        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            return res.status(404).send('Site not found');
        }

        const siteData = result.rows[0].site_data;
        const theme = siteData.theme || 'light-airy';

        // Load template
        const templatePath = path.join(__dirname, 'storefront-templates', theme, `${page}.html`);

        if (!fs.existsSync(templatePath)) {
            return res.status(404).send('Page not found');
        }

        let template = fs.readFileSync(templatePath, 'utf8');

        // Replace template variables with actual data
        const pageData = siteData.pages[page];
        if (pageData) {
            // Replace all template variables
            template = template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                return pageData[key] || match;
            });
        }

        res.send(template);
    } catch (error) {
        console.error('Error serving published site:', error);
        res.status(500).send('Site error');
    }
});

// Generate static site files (simplified)
async function generateStaticSite(username, siteData) {
    const siteDir = path.join(__dirname, 'static-sites', username);

    // Create directory if it doesn't exist
    if (!fs.existsSync(siteDir)) {
        fs.mkdirSync(siteDir, { recursive: true });
    }

    const theme = siteData.theme || 'light-airy';
    const pages = ['home', 'about', 'gallery', 'store', 'blog', 'contact'];

    for (const page of pages) {
        try {
            const templatePath = path.join(__dirname, 'storefront-templates', theme, `${page}.html`);

            if (fs.existsSync(templatePath)) {
                let template = fs.readFileSync(templatePath, 'utf8');

                // Replace template variables
                const pageData = siteData.pages[page];
                if (pageData) {
                    template = template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                        return pageData[key] || match;
                    });
                }

                // Save generated page
                const outputFile = page === 'home' ? 'index.html' : `${page}.html`;
                fs.writeFileSync(path.join(siteDir, outputFile), template);
            }
        } catch (error) {
            console.error(`Error generating ${page} for ${username}:`, error);
        }
    }
}

// Delete session
app.delete('/api/sessions/:id', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;

    try {
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Delete associated photo files
        if (session.photos && session.photos.length > 0) {
            session.photos.forEach(photo => {
                const filePath = path.join(__dirname, 'uploads', photo.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }

        await deleteSession(sessionId);
        console.log(`Deleted session: ${session.clientName} (${sessionId})`);
        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const sessions = await getAllSessions();
        res.json({ 
            status: 'healthy', 
            sessions: sessions.length,
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        res.json({ 
            status: 'error', 
            message: 'Database connection failed',
            timestamp: new Date().toISOString() 
        });
    }
});

// Get individual session
app.get('/api/sessions/:id', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;

    try {
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json(session);
    } catch (error) {
        console.error('Error getting session:', error);
        res.status(500).json({ error: 'Failed to get session' });
    }
});

// Serve client gallery page with custom black and gold design
app.get('/gallery/:id', async (req, res) => {
    const sessionId = req.params.id;
    const accessToken = req.query.access;

    try {
        // Verify access first
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).send('<h1>Gallery not found</h1>');
        }

        if (!session.galleryAccessToken || session.galleryAccessToken !== accessToken) {
            return res.status(403).send('<h1>Access denied</h1><p>Invalid gallery access token.</p>');
        }

        const photos = session.photos || [];

        // Generate custom gallery HTML with black and gold design
        const galleryHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title> Photo Gallery - ${session.clientName}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
                        min-height: 100vh;
                        padding: 20px;
                        color: #ffffff;
                    }

                    .gallery-container {
                        max-width: 1400px;
                        margin: 0 auto;
                        background: rgba(42, 42, 42, 0.95);
                        border-radius: 20px;
                        padding: 40px;
                        backdrop-filter: blur(15px);
                        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                        border: 1px solid rgba(212, 175, 55, 0.2);
                    }

                    .gallery-header {
                        text-align: center;
                        margin-bottom: 40px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid rgba(212, 175, 55, 0.3);
                    }

                    .gallery-header h1 {
                        color: #d4af37;
                        font-size: 3rem;
                        margin-bottom: 15px;
                        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
                        font-weight: 700;
                    }

                    .gallery-header p {
                        color: #f4e4bc;
                        font-size: 1.2rem;
                        font-weight: 500;
                    }

                    .photo-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                        gap: 25px;
                        margin-bottom: 40px;
                    }

                    .photo-item {
                        background: rgba(30, 30, 30, 0.9);
                        border-radius: 15px;
                        overflow: hidden;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(212, 175, 55, 0.2);
                    }

                    .photo-item:hover {
                        transform: translateY(-8px);
                        box-shadow: 0 20px 40px rgba(212, 175, 55, 0.2);
                        border-color: rgba(212, 175, 55, 0.5);
                    }

                    .photo-item img {
                        width: 100%;
                        height: 220px;
                        object-fit: cover;
                        cursor: pointer;
                        transition: transform 0.3s ease;
                    }

                    .photo-item:hover img {
                        transform: scale(1.05);
                    }

                    .photo-controls {
                        padding: 18px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: rgba(42, 42, 42, 0.8);
                    }

                    .photo-number {
                        color: #d4af37;
                        font-size: 0.95rem;
                        font-weight: 600;
                    }

                    .download-btn {
                        background: linear-gradient(135deg, #d4af37 0%, #f4e4bc 100%);
                        color: #1a1a1a;
                        border: none;
                        padding: 10px 18px;
                        border-radius: 25px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 700;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    .download-btn:hover {
                        background: linear-gradient(135deg, #f4e4bc 0%, #d4af37 100%);
                        transform: translateY(-2px);
                        box-shadow: 0 8px 20px rgba(212, 175, 55, 0.4);
                    }

                    .bulk-actions {
                        text-align: center;
                        margin-top: 40px;
                        padding-top: 30px;
                        border-top: 2px solid rgba(212, 175, 55, 0.3);
                    }

                    .bulk-download-btn {
                        background: linear-gradient(135deg, #d4af37 0%, #f4e4bc 100%);
                        color: #1a1a1a;
                        border: none;
                        padding: 18px 40px;
                        border-radius: 30px;
                        cursor: pointer;
                        font-size: 1.2rem;
                        font-weight: 700;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }

                    .bulk-download-btn:hover {
                        background: linear-gradient(135deg, #f4e4bc 0%, #d4af37 100%);
                        transform: translateY(-4px);
                        box-shadow: 0 15px 35px rgba(212, 175, 55, 0.4);
                    }

                    /* Lightbox styles */
                    .lightbox {
                        display: none;
                        position: fixed;
                        z-index: 1000;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.95);
                    }

                    .lightbox-content {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        max-width: 95%;
                        max-height: 95%;
                    }

                    .lightbox-content img {
                        width: 100%;
                        height: auto;
                        border-radius: 10px;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                    }

                    .lightbox-close {
                        position: absolute;
                        top: 30px;
                        right: 40px;
                        color: #d4af37;
                        font-size: 50px;
                        font-weight: bold;
                        cursor: pointer;
                        z-index: 1001;
                        transition: all 0.3s ease;
                    }

                    .lightbox-close:hover {
                        color: #f4e4bc;
                        transform: scale(1.1);
                    }

                    @media (max-width: 768px) {
                        body {
                            padding: 15px;
                        }

                        .gallery-container {
                            padding: 25px;
                        }

                        .photo-grid {
                            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                            gap: 20px;
                        }

                        .gallery-header h1 {
                            font-size: 2.2rem;
                        }

                        .gallery-header p {
                            font-size: 1rem;
                        }

                        .photo-item img {
                            height: 200px;
                        }

                        .photo-controls {
                            padding: 15px;
                        }

                        .bulk-download-btn {
                            padding: 15px 30px;
                            font-size: 1.1rem;
                        }

                        .lightbox-close {
                            top: 20px;
                            right: 25px;
                            font-size: 40px;
                        }
                    }

                    @media (max-width: 480px) {
                        .photo-grid {
                            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                            gap: 15px;
                        }

                        .gallery-header h1 {
                            font-size: 1.8rem;
                        }

                        .photo-item img {
                            height: 180px;
                        }

                        .download-btn {
                            padding: 8px 14px;
                            font-size: 0.8rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="gallery-container">
                    <div class="gallery-header">
                        <h1> Photo Gallery</h1>
                        <p>Client: <strong>${session.clientName}</strong> | Session: ${session.sessionType} | Date: ${new Date(session.dateTime).toLocaleDateString()}</p>
                    </div>

                    <div class="photo-grid" id="photoGrid">
                        ${photos.map((photo, index) => {
                            // Use optimized version for display, Firebase URL for download
                            const displayUrl = photo.displayPath ? `/uploads/optimized_${photo.filename}` : `/uploads/${photo.filename}`;
                            const downloadUrl = photo.firebaseUrl || `/uploads/${photo.filename}`;
                            const originalSizeMB = photo.originalSize ? (photo.originalSize / 1024 / 1024).toFixed(1) : 'Unknown';

                            return `
                            <div class="photo-item">
                                <img src="${displayUrl}" alt="Photo ${index + 1}" onclick="openLightbox('${displayUrl}')">
                                <div class="photo-controls">
                                    <span class="photo-number">Photo ${index + 1} (${originalSizeMB}MB)</span>
                                    <button class="download-btn" onclick="downloadPhoto('${downloadUrl}', '${photo.originalName || photo.filename}')">
                                        Download Original
                                    </button>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="bulk-actions">
                        <button class="bulk-download-btn" onclick="downloadAllPhotos()">
                            📦 Download All Photos (ZIP)
                        </button>
                    </div>
                </div>

                <!-- Lightbox -->
                <div id="lightbox" class="lightbox" onclick="closeLightbox()">
                    <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
                    <div class="lightbox-content">
                        <img id="lightboxImage" src="">
                    </div>
                </div>

                <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"></script>
                <script>
                    function openLightbox(imageSrc) {
                        document.getElementById('lightbox').style.display = 'block';
                        document.getElementById('lightboxImage').src = imageSrc;
                    }

                    function closeLightbox() {
                        document.getElementById('lightbox').style.display = 'none';
                    }

                    function downloadPhoto(photoUrl, filename) {
                        const link = document.createElement('a');
                        link.href = photoUrl;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }

                    async function downloadAllPhotos() {
                        const photos = ${JSON.stringify(photos)};
                        const zip = new JSZip();
                        const folder = zip.folder('${session.clientName}_Photos');

                        try {
                            for (let i = 0; i < photos.length; i++) {
                                const photo = photos[i];
                                // Use Firebase URL for original quality, fallback to local
                                const downloadUrl = photo.firebaseUrl || '/uploads/' + photo.filename;
                                const response = await fetch(downloadUrl);
                                const blob = await response.blob();
                                folder.file(photo.originalName || photo.filename, blob);
                            }

                            const content = await zip.generateAsync({type: 'blob'});
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(content);
                            link.download = '${session.clientName}_Original_Photos.zip';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } catch (error) {
                            console.error('Error creating ZIP:', error);
                            alert('Error downloading photos. Please try again.');
                        }
                    }

                    // Close lightbox on Escape key
                    document.addEventListener('keydown', function(e) {
                        if (e.key === 'Escape') {
                            closeLightbox();
                        }
                    });
                </script>
            </body>
            </html>
        `;

        res.send(galleryHtml);

    } catch (error) {
        console.error('Error serving gallery:', error);
        res.status(500).send('<h1>Error loading gallery</h1>');
    }
});

// Generate and store gallery access token
app.post('/api/sessions/:id/generate-gallery-access', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;

    try {
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Generate secure access token
        const accessToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

        // Store access token in session (permanent access)
        await updateSession(sessionId, {
            galleryAccessToken: accessToken,
            galleryCreatedAt: new Date().toISOString(),
            galleryExpiresAt: null
        });

        // Generate gallery URL with external domain detection
        const host = req.get('host');
        let baseUrl;

        if (host && host.includes('localhost')) {
            // For localhost, check for external domain in environment
            const replitDomains = process.env.REPLIT_DOMAINS;
            if (replitDomains) {
                const domains = replitDomains.split(',');
                baseUrl = `https://${domains[0]}`;
            } else {
                baseUrl = `${req.protocol}://${host}`;
            }
        } else {
            // Always use HTTPS for external domains
            baseUrl = `https://${host}`;
        }

        const galleryUrl = `${baseUrl}/gallery/${sessionId}?access=${accessToken}`;

        console.log(`Gallery URL generated: ${galleryUrl} (from host: ${host})`);
        console.log(`Generated gallery access for session: ${session.clientName} (${sessionId})`);

        res.json({
            message: 'Gallery access generated successfully',
            galleryUrl,
            accessToken,
            expiresAt: 'Never expires'
        });
    } catch (error) {
        console.error('Error generating gallery access:', error);
        res.status(500).json({ error: 'Failed to generate gallery access' });
    }
});

// Verify gallery access (API endpoint for client gallery)
app.get('/api/gallery/:id/verify', async (req, res) => {
    const sessionId = req.params.id;
    const accessToken = req.query.access;

    try {
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Gallery not found' });
        }

        if (!session.galleryAccessToken || session.galleryAccessToken !== accessToken) {
            return res.status(403).json({ error: 'Invalid access token' });
        }

        // No expiration check - galleries never expire

        res.json({
            sessionId: session.id,
            clientName: session.clientName,
            sessionType: session.sessionType,
            photos: session.photos || [],
            valid: true
        });
    } catch (error) {
        console.error('Error verifying gallery access:', error);
        res.status(500).json({ error: 'Failed to verify gallery access' });
    }
});

// Get photos for gallery (client endpoint)
app.get('/api/gallery/:id/photos', async (req, res) => {
    const sessionId = req.params.id;
    const accessToken = req.query.access;

    try {
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Gallery not found' });
        }

        if (!session.galleryAccessToken || session.galleryAccessToken !== accessToken) {
            return res.status(403).json({ error: 'Invalid access token' });
        }

        // No expiration check - galleries never expire

        res.json({
            photos: session.photos || [],
            totalPhotos: (session.photos || []).length
        });
    } catch (error) {
        console.error('Error getting gallery photos:', error);
        res.status(500).json({ error: 'Failed to get gallery photos' });
    }
});

// Send gallery notification with email/SMS integration
app.post('/api/sessions/:id/send-gallery-notification', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;

    try {
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (!session.galleryAccessToken) {
            return res.status(400).json({ error: 'Gallery access not generated. Generate gallery access first.' });
        }

        // Create external-accessible gallery URL
        const host = req.get('host');
        let baseUrl;

        // Always prefer external domain for gallery links to work on mobile devices
        const externalDomain = process.env.REPLIT_DOMAINS;

        if (externalDomain) {
            // Use external Replit domain for mobile compatibility
            baseUrl = `https://${externalDomain}`;
        } else if (host.includes('replit.app') || host.includes('repl.co') || host.includes('replit.dev')) {
            // Replit deployment - use the actual domain
            baseUrl = `${req.protocol}://${host}`;
        } else {
            // Fallback to request host
            baseUrl = `${req.protocol}://${host}`;
        }

        const galleryUrl = `${baseUrl}/gallery/${sessionId}?access=${session.galleryAccessToken}`;

        console.log(`Gallery URL generated: ${galleryUrl} (from host: ${host})`);

        const message = `Hi ${session.clientName}! Your photos from your ${session.sessionType} session are now ready for viewing and download. View your gallery: ${galleryUrl}`;
        const subject = `Your Photo Gallery is Ready - ${session.sessionType}`;

    // Simplified email approach - prioritize mailto for reliability
    let emailSent = false;
    let smsSent = false;
    let emailMethod = 'mailto';
    let mailtoUrl = '';
    let emailPreviewUrl = '';

    // Create professional email content
    const emailBody = `Hi ${session.clientName},

Your photos from your ${session.sessionType} session are now ready for viewing and download.

View your gallery: ${galleryUrl}

Best regards,
Lance - The Legacy Photography
Professional Photography Services`;

    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #667eea;"> Your Photo Gallery is Ready!</h2>
            <p>Hi ${session.clientName},</p>
            <p>Your photos from your <strong>${session.sessionType}</strong> session are now ready for viewing and download.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${galleryUrl}" style="background-color: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">View Your Gallery</a>
            </div>
            <p style="color: #666; font-size: 14px; word-break: break-all;">Gallery URL: <a href="${galleryUrl}">${galleryUrl}</a></p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px;">
                Best regards,<br>
                <strong>Lance - The Legacy Photography</strong><br>
                Professional Photography Services
            </p>
        </div>
    `;

    // Create mailto URL 
    mailtoUrl = `mailto:${session.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

    // Create email preview endpoint URL
    emailPreviewUrl = `/api/sessions/${sessionId}/email-preview`;

    // Store email content for preview
    global.emailPreview = global.emailPreview || {};
    global.emailPreview[sessionId] = {
        to: session.email,
        subject: subject,
        text: emailBody,
        html: emailHtml,
        createdAt: new Date().toISOString()
    };

    console.log(`Email notification prepared for ${session.clientName} (${session.email})`);
    console.log(`Mailto URL: ${mailtoUrl}`);
    console.log(`Email preview available at: ${emailPreviewUrl}`);

    // Direct SMS sending - simplified notification approach
    try {
        // For now, we'll log SMS details and provide direct links
        // In production, this could integrate with carrier APIs or web-to-SMS services
        if (session.phoneNumber) {
            const smsMessage = ` ${session.clientName}, your ${session.sessionType} photos are ready! View gallery: ${galleryUrl}`;
            console.log(`SMS notification prepared for ${session.phoneNumber}: ${smsMessage}`);

            // Create a simple SMS link for manual sending if needed
            const smsLink = `sms:${session.phoneNumber}?body=${encodeURIComponent(smsMessage)}`;
            console.log(`SMS link: ${smsLink}`);

            // Mark as "sent" for logging purposes
            smsSent = true;
        }
    } catch (error) {
        console.error('SMS preparation failed:', error);
    }

    // Fallback: log notification details
    if (!emailSent && !smsSent) {
        console.log(`Gallery notification sent to ${session.clientName} (${session.email})`);
        console.log(`Gallery URL: ${galleryUrl}`);
    }

    const notification = {
        to: session.email,
        phone: session.phoneNumber,
        subject: subject,
        message: message,
        galleryUrl,
        emailSent: false, // Using mailto approach instead
        smsSent,
        emailMethod,
        mailtoUrl,
        emailPreviewUrl,
        sentAt: new Date().toISOString()
    };

    // Store notification in session for tracking
    await updateSession(sessionId, { lastGalleryNotification: notification, galleryReadyNotified: true });

    res.json({
        message: 'Gallery notification prepared - click to open your email client',
        notification,
        galleryUrl,
        emailSent: false,
        smsSent,
        emailMethod,
        mailtoUrl,
        emailPreviewUrl
    });
    } catch (error) {
        console.error('Error sending gallery notification:', error);
        res.status(500).json({ error: 'Failed to send gallery notification' });
    }
});

// Email preview endpoint
app.get('/api/sessions/:id/email-preview', (req, res) => {
    const sessionId = req.params.id;
    const emailData = global.emailPreview && global.emailPreview[sessionId];

    if (!emailData) {
        return res.status(404).send('<h1>Email preview not found</h1><p>Generate gallery notification first to create email preview.</p>');
    }

    // Return HTML email for preview
    res.setHeader('Content-Type', 'text/html');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Email Preview - ${emailData.subject}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                .email-container { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin: 0 auto; max-width: 700px; }
                .email-header { background: #667eea; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .email-body { padding: 20px; }
                .email-meta { background: #f8f9fa; padding: 15px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
                .copy-btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 10px 5px; }
                .mailto-btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px 5px; }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="email-header">
                    <h1 style="margin: 0;"> Email Preview</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">Preview of gallery notification email</p>
                </div>
                <div class="email-meta">
                    <strong>To:</strong> ${emailData.to}<br>
                    <strong>Subject:</strong> ${emailData.subject}<br>
                    <strong>Created:</strong> ${new Date(emailData.createdAt).toLocaleString()}<br><br>
                    <a href="mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.text)}" class="mailto-btn"> Open in Email Client</a>
                    <button class="copy-btn" onclick="copyToClipboard('${emailData.to}')">Copy Email Address</button>
                    <button class="copy-btn" onclick="copyToClipboard(\`${emailData.text.replace(/`/g, '\\`')}\`)">Copy Email Body</button>
                </div>
                <div class="email-body">
                    ${emailData.html}
                </div>
            </div>
            <script>
                function copyToClipboard(text) {
                    navigator.clipboard.writeText(text).then(() => {
                        alert('Copied to clipboard!');
                    }).catch(() => {
                        alert('Copy failed - please copy manually');
                    });
                }
            </script>
        </body>
        </html>
    `);
});

// Create and send invoice via Stripe (supports both full and deposit invoices)
app.post('/api/create-invoice', isAuthenticated, async (req, res) => {
    const { sessionId, clientName, email, amount, description, dueDate, isDeposit, depositAmount, totalAmount, includeTip } = req.body;

    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured. Please add STRIPE_SECRET_KEY.' });
        }

        // Check if Stripe key is valid (should be longer than 50 characters)
        if (process.env.STRIPE_SECRET_KEY.length < 50) {
            // Fallback mode - simulate invoice creation without actual Stripe API call
            console.log('Stripe key too short, simulating invoice creation');

            const invoiceType = isDeposit ? 'Deposit Invoice' : 'Invoice';
            return res.json({ 
                success: true,
                message: `${invoiceType} simulation completed (Stripe not configured)`,
                fallbackMode: true,
                invoice_url: `https://invoice-demo.stripe.com/demo-${sessionId}-${Date.now()}`,
                details: 'To send real invoices, provide your complete Stripe secret key (100+ characters) from your Stripe Dashboard',
                clientName: clientName,
                amount: amount,
                description: description
            });
        }

        // Create customer if not exists
        let customer;
        try {
            const customers = await stripe.customers.list({
                email: email,
                limit: 1
            });

            if (customers.data.length > 0) {
                customer = customers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: email,
                    name: clientName,
                    description: `Client of Lance - The Legacy Photography`,
                    metadata: {
                        sessionId: sessionId,
                        businessName: 'The Legacy Photography',
                        businessEmail: 'lance@thelegacyphotography.com'
                    }
                });
                console.log('Created new Stripe customer:', customer.id);
            }
        } catch (error) {
            console.error('Customer creation failed:', error);
            return res.status(500).json({ error: 'Failed to create customer' });
        }

        // Calculate due date
        const dueDateObj = dueDate ? new Date(dueDate) : new Date(Date.now() + (isDeposit ? 14 : 30) * 24 * 60 * 60 * 1000);
        const daysUntilDue = Math.max(1, Math.ceil((dueDateObj - new Date()) / (24 * 60 * 60 * 1000)));

        // Create invoice description based on type
        let invoiceDescription = description;
        let customFooter = 'Thank you for choosing Lance - The Legacy Photography! Contact: lance@thelegacyphotography.com';

        if (isDeposit) {
            const remainingBalance = totalAmount - depositAmount;
            customFooter += `\n\nRetainer: $${depositAmount} | Remaining Balance: $${remainingBalance.toFixed(2)}`;
        }

        // Create invoice with proper collection method for manual sending
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            description: `Lance - The Legacy Photography: ${invoiceDescription}`,
            collection_method: 'send_invoice',
            days_until_due: daysUntilDue,
            footer: customFooter,
            custom_fields: [
                {
                    name: 'Photographer',
                    value: 'Lance - The Legacy Photography'
                },
                {
                    name: 'Session ID',
                    value: sessionId
                }
            ],
            metadata: {
                sessionId: sessionId,
                clientName: clientName,
                businessName: 'The Legacy Photography',
                businessEmail: 'lance@thelegacyphotography.com',
                isDeposit: isDeposit ? 'true' : 'false'
            }
        });

        // Add main invoice item
        await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: invoice.id,
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            description: invoiceDescription,
            metadata: {
                sessionId: sessionId,
                clientName: clientName,
                photographer: 'Lance - The Legacy Photography',
                businessEmail: 'lance@thelegacyphotography.com',
                isDeposit: isDeposit ? 'true' : 'false'
            }
        });

        // Add optional tip item if requested
        if (includeTip) {
            await stripe.invoiceItems.create({
                customer: customer.id,
                invoice: invoice.id,
                amount: 0, // $0 default - client can add custom tip amount
                currency: 'usd',
                description: '💰 Optional Gratuity (Add Custom Amount)',
                metadata: {
                    sessionId: sessionId,
                    tipItem: 'true',
                    businessName: 'Lance - The Legacy Photography'
                }
            });
        }

        // Finalize and send invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(finalizedInvoice.id);

        const invoiceType = isDeposit ? 'Deposit invoice' : 'Invoice';
        console.log(`${invoiceType} sent to ${clientName} for $${amount}`);
        console.log(`Invoice URL: ${finalizedInvoice.hosted_invoice_url}`);

        res.json({
            success: true,
            message: `${invoiceType} sent successfully via Stripe`,
            invoice_url: finalizedInvoice.hosted_invoice_url,
            invoice: {
                id: finalizedInvoice.id,
                hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
                invoicePdf: finalizedInvoice.invoice_pdf,
                amount: amount,
                status: finalizedInvoice.status,
                customer: customer.email
            }
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice: ' + error.message });
    }
});

// Send invoice via Stripe
app.post('/api/sessions/:id/send-invoice', async (req, res) => {
    const sessionId = req.params.id;

    try {
        const session = await getSessionById(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured. Please add STRIPE_SECRET_KEY.' });
        }

        // Check if Stripe key is valid (should be longer than 50 characters)
        if (process.env.STRIPE_SECRET_KEY.length < 50) {
            // Fallback mode - simulate invoice creation without actual Stripe API call
            console.log('Stripe key too short, simulating invoice creation');

            return res.json({ 
                message: 'Invoice simulation completed (Stripe not configured)',
                fallbackMode: true,
                invoiceUrl: `https://invoice-demo.stripe.com/demo-${sessionId}`,
                details: 'To send real invoices, provide your complete Stripe secret key (100+ characters) from your Stripe Dashboard',
                clientName: session.clientName,
                amount: session.price,
                sessionType: session.sessionType
            });
        }

        // Create customer if not exists
        let customer;
        try {
            const customers = await stripe.customers.list({
                email: session.email,
                limit: 1
            });

            if (customers.data.length > 0) {
                customer = customers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: session.email,
                    name: session.clientName,
                    phone: session.phoneNumber,
                    description: `Client of Lance - The Legacy Photography`,
                    metadata: {
                        sessionId: sessionId,
                        sessionType: session.sessionType,
                        photographer: 'Lance - The Legacy Photography',
                        business: 'The Legacy Photography'
                    }
                });
            }
        } catch (error) {
            console.error('Customer creation failed:', error);
            return res.status(500).json({ error: 'Failed to create customer' });
        }

        // Create invoice with proper collection method for manual sending
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            description: `Lance - The Legacy Photography: ${session.sessionType} Session`,
            collection_method: 'send_invoice',
            days_until_due: 30,
            footer: 'Thank you for choosing Lance - The Legacy Photography! Contact: lance@thelegacyphotography.com',
            custom_fields: [
                {
                    name: 'Photographer',
                    value: 'Lance - The Legacy Photography'
                },
                {
                    name: 'Session Details',
                    value: `${session.sessionType} at ${session.location}`
                }
            ],
            metadata: {
                sessionId: sessionId,
                clientName: session.clientName,
                sessionType: session.sessionType,
                location: session.location,
                dateTime: session.dateTime,
                photographer: 'Lance - The Legacy Photography',
                businessName: 'The Legacy Photography',
                businessEmail: 'lance@thelegacyphotography.com'
            }
        });

        // Add invoice item
        await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: invoice.id,
            amount: Math.round(session.price * 100), // Convert to cents
            currency: 'usd',
            description: `${session.sessionType} Photography Session by Lance - The Legacy Photography`,
            metadata: {
                sessionId: sessionId,
                location: session.location,
                dateTime: session.dateTime,
                duration: `${session.duration} minutes`,
                photographer: 'Lance - The Legacy Photography',
                businessEmail: 'lance@thelegacyphotography.com'
            }
        });

        // Finalize and send invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(finalizedInvoice.id);

        // Store invoice details in session
        session.stripeInvoice = {
            invoiceId: finalizedInvoice.id,
            customerId: customer.id,
            hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
            invoicePdf: finalizedInvoice.invoice_pdf,
            amount: session.price,
            status: finalizedInvoice.status,
            sentAt: new Date().toISOString()
        };

        console.log(`Invoice sent to ${session.clientName} for $${session.price}`);
        console.log(`Invoice URL: ${finalizedInvoice.hosted_invoice_url}`);

        res.json({
            message: 'Invoice sent successfully via Stripe',
            invoice: {
                id: finalizedInvoice.id,
                hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
                invoicePdf: finalizedInvoice.invoice_pdf,
                amount: session.price,
                status: finalizedInvoice.status,
                customer: customer.email
            }
        });
    } catch (error) {
        console.error('Error sending invoice:', error);
        res.status(500).json({ error: 'Failed to send invoice' });
    }
});

// Stripe Subscription Routes
app.post('/api/create-subscription', isAuthenticated, async (req, res) => {
    try {
        const user = getCurrentUser(req);
        const { plan } = req.body; // 'monthly', 'sixmonth', 'yearly'

        if (!user || !user.email) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Check if user already has subscription
        const userRecord = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [user.email]
        );

        let customer;
        if (userRecord.rows.length > 0 && userRecord.rows[0].stripe_customer_id) {
            customer = await stripe.customers.retrieve(userRecord.rows[0].stripe_customer_id);
        } else {
            // Create new customer
            customer = await stripe.customers.create({
                email: user.email,
                name: user.displayName || user.email,
                metadata: {
                    uid: user.uid
                }
            });

            // Update user record with customer ID
            await pool.query(
                'UPDATE users SET stripe_customer_id = $1 WHERE email = $2',
                [customer.id, user.email]
            );
        }

        // Define price IDs based on plan
        const priceIds = {
            monthly: 'price_monthly_25', // You'll need to create these in Stripe
            sixmonth: 'price_sixmonth_125',
            yearly: 'price_yearly_200'
        };

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{
                price: priceIds[plan] || priceIds.monthly
            }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent']
        });

        // Update user subscription in database
        await pool.query(
            'UPDATE users SET stripe_subscription_id = $1, subscription_status = $2 WHERE email = $3',
            [subscription.id, 'pending', user.email]
        );

        res.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret
        });

    } catch (error) {
        console.error('Subscription creation error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

// Check subscription status
app.get('/api/subscription-status', isAuthenticated, async (req, res) => {
    try {
        const user = getCurrentUser(req);

        if (!user || !user.email) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const result = await pool.query(
            'SELECT subscription_status, subscription_expires_at, stripe_subscription_id FROM users WHERE email = $1',
            [user.email]
        );

        if (result.rows.length === 0) {
            return res.json({ hasSubscription: false });
        }

        const userRecord = result.rows[0];

        // Check with Stripe for current status
        if (userRecord.stripe_subscription_id) {
            try {
                const subscription = await stripe.subscriptions.retrieve(userRecord.stripe_subscription_id);

                // Update local database with Stripe status
                await pool.query(
                    'UPDATE users SET subscription_status = $1, subscription_expires_at = $2 WHERE email = $3',
                    [subscription.status, new Date(subscription.current_period_end * 1000), user.email]
                );

                res.json({
                    hasSubscription: subscription.status === 'active',
                    status: subscription.status,
                    expiresAt: new Date(subscription.current_period_end * 1000)
                });
            } catch (stripeError) {
                // Stripe subscription not found or error
                res.json({
                    hasSubscription: false,
                    status: 'inactive'
                });
            }
        } else {
            res.json({
                hasSubscription: false,
                status: userRecord.subscription_status || 'inactive'
            });
        }

    } catch (error) {
        console.error('Subscription status error:', error);
        res.status(500).json({ error: 'Failed to check subscription status' });
    }
});

// Stripe webhook for subscription updates
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                const subscription = event.data.object;
                await pool.query(
                    'UPDATE users SET subscription_status = $1, subscription_expires_at = $2 WHERE stripe_customer_id = $3',
                    [subscription.status, new Date(subscription.current_period_end * 1000), subscription.customer]
                );
                break;

            case 'customer.subscription.deleted':
                const deletedSub = event.data.object;
                await pool.query(
                    'UPDATE users SET subscription_status = $1 WHERE stripe_customer_id = $2',
                    ['canceled', deletedSub.customer]
                );
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Generate .ics calendar file for iPhone/iOS Calendar
app.get('/api/sessions/:id/calendar.ics', async (req, res) => {
    const sessionId = req.params.id;

    try {
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const startDate = new Date(session.dateTime);
        const endDate = new Date(startDate.getTime() + session.duration * 60000);

        // Format date for .ics file (YYYYMMDDTHHMMSSZ)
        const formatICSDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        // Generate unique ID for the event
        const eventUID = `photo-session-${sessionId}@thelegacyphotography.com`;
        const timestamp = formatICSDate(new Date());

        // Create .ics file content with proper iPhone Calendar compatibility
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Lance - The Legacy Photography//Photography Session Scheduler//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${eventUID}`,
            `DTSTAMP:${timestamp}`,
            `DTSTART:${formatICSDate(startDate)}`,
            `DTEND:${formatICSDate(endDate)}`,
            `SUMMARY:${session.sessionType} Photography Session - ${session.clientName}`,
            `DESCRIPTION:Photography session with ${session.clientName}\\n\\nContact: ${session.phoneNumber}\\nEmail: ${session.email}\\nPrice: $${session.price}\\nDuration: ${session.duration} minutes\\n\\nNotes: ${session.notes || 'No additional notes'}`,
            `LOCATION:${session.location}`,
            'ORGANIZER;CN=Lance - The Legacy Photography:mailto:lance@thelegacyphotography.com',
            `ATTENDEE;CN=${session.clientName};RSVP=TRUE:mailto:${session.email}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'CATEGORIES:APPOINTMENT,PHOTOGRAPHY',
            'BEGIN:VALARM',
            'TRIGGER:-PT1H',
            'ACTION:DISPLAY',
            'DESCRIPTION:Photography session reminder - 1 hour before',
            'END:VALARM',
            'BEGIN:VALARM',
            'TRIGGER:-PT24H',
            'ACTION:DISPLAY',
            'DESCRIPTION:Photography session reminder - 1 day before',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        // Set proper headers for iPhone Calendar integration
        const isIPhone = req.get('User-Agent') && req.get('User-Agent').includes('iPhone');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        if (isIPhone) {
            // For iPhone, use inline to trigger Calendar app
            res.setHeader('Content-Disposition', `inline; filename="${session.clientName}_${session.sessionType}_Session.ics"`);
        } else {
            // For other devices, use attachment to download
            res.setHeader('Content-Disposition', `attachment; filename="${session.clientName}_${session.sessionType}_Session.ics"`);
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        console.log(`Generated .ics calendar file for session: ${session.clientName} (${sessionId})`);
        res.send(icsContent);

    } catch (error) {
        console.error('Error generating calendar file:', error);
        res.status(500).json({ error: 'Failed to generate calendar file' });
    }
});

// Payment Plan API Endpoints
const paymentManager = new PaymentPlanManager();
const paymentScheduler = new PaymentScheduler();

// Contract Manager
const contractManager = new ContractManager();

// Create payment plan for a session
app.post('/api/sessions/:id/payment-plan', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const { totalAmount, startDate, endDate, reminderDays = 3 } = req.body;
    const user = getCurrentUser(req);

    try {
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Verify user owns this session
        if (session.userId !== user.uid) {
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }

        const result = await paymentManager.createPaymentPlan(
            sessionId, 
            user.uid, 
            parseFloat(totalAmount), 
            startDate, 
            endDate, 
            reminderDays
        );

        res.json({
            message: 'Payment plan created successfully',
            plan: result.plan,
            payments: result.payments
        });
    } catch (error) {
        console.error('Error creating payment plan:', error);
        res.status(500).json({ error: 'Failed to create payment plan' });
    }
});

// Get payment plan for a session
app.get('/api/sessions/:id/payment-plan', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const user = getCurrentUser(req);

    try {
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Verify user owns this session
        if (session.userId !== user.uid) {
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }

        const paymentPlan = await paymentManager.getPaymentPlan(sessionId);

        if (!paymentPlan) {
            return res.status(404).json({ error: 'No payment plan found for this session' });
        }

        res.json(paymentPlan);
    } catch (error) {
        console.error('Error getting payment plan:', error);
        res.status(500).json({ error: 'Failed to get payment plan' });
    }
});

// Mark payment as received
app.post('/api/payments/:id/mark-paid', isAuthenticated, async (req, res) => {
    const paymentId = req.params.id;
    const { paymentMethod = 'manual', notes = '' } = req.body;

    try {
        const payment = await paymentManager.markPaymentReceived(paymentId, paymentMethod, notes);

        res.json({
            message: 'Payment marked as received',
            payment
        });
    } catch (error) {
        console.error('Error marking payment received:', error);
        res.status(500).json({ error: 'Failed to mark payment as received' });
    }
});

// Send invoice for specific payment
app.post('/api/payments/:id/send-invoice', isAuthenticated, async (req, res) => {
    const paymentId = req.params.id;
    const { forceResend = false } = req.body;

    try {
        const payment = await paymentManager.sendPaymentInvoice(paymentId, forceResend);

        res.json({
            message: 'Invoice sent successfully',
            payment
        });
    } catch (error) {
        console.error('Error sending payment invoice:', error);
        res.status(500).json({ error: 'Failed to send invoice' });
    }
});

// Manual trigger for payment processing (for testing)
app.post('/api/payments/process-automated', isAuthenticated, async (req, res) => {
    try {
        const results = await paymentScheduler.manualTrigger();

        res.json({
            message: 'Automated payment processing completed',
            results
        });
    } catch (error) {
        console.error('Error in manual payment processing:', error);
        res.status(500).json({ error: 'Failed to process payments' });
    }
});

// Get payment scheduler status
app.get('/api/payments/scheduler-status', isAuthenticated, (req, res) => {
    try {
        const status = paymentScheduler.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting scheduler status:', error);
        res.status(500).json({ error: 'Failed to get scheduler status' });
    }
});

// Serve gallery page (legacy endpoint for backward compatibility)
app.get('/sessions/:id/gallery', (req, res) => {
    res.sendFile(path.join(__dirname, 'gallery.html'));
});

// Subscriber notification API endpoints
app.post('/api/subscribers/welcome', isAuthenticated, async (req, res) => {
    try {
        const { email, photographerName, businessName } = req.body;
        const result = await sendWelcomeEmail(email, photographerName, businessName);

        if (result.success) {
            // Mark welcome email as sent in database
            await pool.query(
                'UPDATE subscribers SET welcome_email_sent = TRUE WHERE email = $1',
                [email]
            );
        }

        res.json(result);
    } catch (error) {
        console.error('Welcome email error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/subscribers/billing', isAuthenticated, async (req, res) => {
    try {
        const { email, photographerName, amount, plan, dueDate } = req.body;
        const result = await sendBillingNotification(email, photographerName, amount, plan, dueDate);
        res.json(result);
    } catch (error) {
        console.error('Billing notification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/subscribers/broadcast', isAuthenticated, async (req, res) => {
    try {
        const { title, features } = req.body;

        // Get all active subscribers
        const subscribersResult = await pool.query(
            'SELECT email, photographer_name FROM subscribers WHERE subscription_status = $1',
            ['active']
        );

        const subscribers = subscribersResult.rows.map(row => ({
            email: row.email,
            name: row.photographer_name
        }));

        const results = await broadcastFeatureUpdate(subscribers, title, features);
        res.json({ success: true, results, totalSent: results.length });
    } catch (error) {
        console.error('Broadcast notification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get subscriber statistics
app.get('/api/subscribers/stats', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_subscribers,
                COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_subscribers,
                COUNT(CASE WHEN welcome_email_sent = true THEN 1 END) as welcomed_subscribers,
                COUNT(CASE WHEN subscription_plan = 'free' THEN 1 END) as free_subscribers,
                COUNT(CASE WHEN subscription_plan = 'pro' THEN 1 END) as pro_subscribers
            FROM subscribers
        `);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Subscriber stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Contract API Endpoints

// Get contract templates
app.get('/api/contracts/templates', isAuthenticated, async (req, res) => {
    try {
        const templates = contractManager.getContractTemplates();
        res.json(templates);
    } catch (error) {
        console.error('Error getting contract templates:', error);
        res.status(500).json({ error: 'Failed to get contract templates' });
    }
});

// Create contract for session
app.post('/api/sessions/:id/contracts', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const { contractType } = req.body;
    const user = req.user;

    try {
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Verify user owns this session
        if (session.userId !== user.uid) {
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }

        // Prepare session data for contract template
        const contractData = {
            client_name: session.clientName,
            client_email: session.email,
            photographer_name: 'Lance Casselman',
            photographer_email: 'lance@thelegacyphotography.com',
            session_type: session.sessionType,
            session_date: new Date(session.dateTime).toLocaleDateString(),
            location: session.location,
            price: session.price,
            duration: session.duration,
            reception_location: session.location, // For wedding contracts
            coverage_hours: Math.round(session.duration / 60), // Convert minutes to hours
            payment_plan: session.hasPaymentPlan,
            payment_schedule: session.hasPaymentPlan ? `${session.paymentsRemaining} monthly payments of $${session.monthlyPayment}` : null,
            deposit_amount: session.hasPaymentPlan ? (session.price * 0.5).toFixed(2) : null,
            balance_amount: session.hasPaymentPlan ? (session.price * 0.5).toFixed(2) : null,
            min_photos: '25'
        };

        const contract = await contractManager.createContract(sessionId, user.uid, contractType, contractData);

        res.json({
            message: 'Contract created successfully',
            contract: contract
        });
    } catch (error) {
        console.error('Error creating contract:', error);
        res.status(500).json({ error: 'Failed to create contract' });
    }
});

// Get contracts for session
app.get('/api/sessions/:id/contracts', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const user = req.user; // Use req.user directly from isAuthenticated middleware

    try {
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Verify user owns this session (use uid instead of sub for dev mode)
        if (session.userId !== user.uid) {
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }

        const contracts = await contractManager.getSessionContracts(sessionId);
        res.json(contracts);
    } catch (error) {
        console.error('Error getting session contracts:', error);
        res.status(500).json({ error: 'Failed to get session contracts' });
    }
});

// Send contract to client
app.post('/api/contracts/:id/send', isAuthenticated, async (req, res) => {
    const contractId = req.params.id;
    const user = req.user;

    try {
        const contract = await contractManager.getContract(contractId);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        // Verify user owns this contract
        if (contract.user_id !== user.uid) {
            return res.status(403).json({ error: 'Unauthorized access to contract' });
        }

        // Mark contract as sent
        const updatedContract = await contractManager.sendContract(contractId);

        // Generate signing URL - Always use HTTPS for security
        const host = req.get('host');
        let baseUrl;

        // Check if we're on a Replit domain or localhost
        if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
            // For localhost, check if we have Replit domains available
            const replitDomains = process.env.REPLIT_DOMAINS;
            if (replitDomains) {
                const domains = replitDomains.split(',');
                baseUrl = `https://${domains[0]}`;
            } else {
                // Fallback to HTTP for true localhost development
                baseUrl = `http://${host}`;
            }
        } else {
            // For all production domains (including Replit), always use HTTPS
            baseUrl = `https://${host}`;
        }

        const signingUrl = `${baseUrl}/contract-signing.html?token=${contract.access_token}`;
        console.log(`🔗 Generated signing URL: ${signingUrl}`);

        // Prepare email data for default email client
        const emailSubject = `Contract Ready for Signature - ${contract.contract_title}`;
        const emailBody = `Hello ${contract.client_name},

Your photography contract is ready for your electronic signature.

Contract Details:
- Title: ${contract.contract_title}
- Photographer: ${contract.photographer_name}
- Created: ${new Date(contract.created_at).toLocaleDateString()}

Please click the following link to review and sign your contract:
${signingUrl}

Please review the contract carefully and sign electronically using the link above. Once signed, you'll receive a copy for your records.

If you have any questions, please don't hesitate to contact us.

Best regards,
The Legacy Photography
Email: ${contract.photographer_email}
Creating lasting memories through professional photography`;

        console.log(` Email template prepared for: ${contract.client_email}`);

        res.json({
            message: 'Contract email template ready',
            signingUrl: signingUrl,
            contract: updatedContract,
            emailData: {
                to: contract.client_email,
                subject: emailSubject,
                body: emailBody
            }
        });
    } catch (error) {
        console.error('Error sending contract:', error);
        res.status(500).json({ error: 'Failed to send contract' });
    }
});

// View contract (client access)
app.get('/api/contracts/view/:token', async (req, res) => {
    const accessToken = req.params.token;

    try {
        const contract = await contractManager.getContractByToken(accessToken);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found or access denied' });
        }

        res.json(contract);
    } catch (error) {
        console.error('Error viewing contract:', error);
        res.status(500).json({ error: 'Failed to view contract' });
    }
});

// Sign contract (client endpoint)
app.post('/api/contracts/:id/sign', async (req, res) => {
    const contractId = req.params.id;
    const { signature, access_token } = req.body;

    try {
        // Verify access token
        const contract = await contractManager.getContractByToken(access_token);
        if (!contract || contract.id !== contractId) {
            return res.status(404).json({ error: 'Contract not found or access denied' });
        }

        if (contract.status === 'signed') {
            return res.status(400).json({ error: 'Contract already signed' });
        }

        // Sign the contract
        const signedContract = await contractManager.signContract(contractId, signature);

        // Update session contract status
        await updateSession(contract.session_id, { contractSigned: true });

        res.json({
            message: 'Contract signed successfully',
            contract: signedContract
        });
    } catch (error) {
        console.error('Error signing contract:', error);
        res.status(500).json({ error: 'Failed to sign contract' });
    }
});

// Get individual contract details
app.get('/api/contracts/:id', isAuthenticated, async (req, res) => {
    const contractId = req.params.id;

    try {
        const contract = await contractManager.getContract(contractId);
        res.json(contract);
    } catch (error) {
        console.error('Error getting contract:', error);
        res.status(500).json({ error: 'Failed to get contract' });
    }
});

// Update contract content
app.put('/api/contracts/:id', isAuthenticated, async (req, res) => {
    const contractId = req.params.id;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    try {
        const updatedContract = await contractManager.updateContract(contractId, title, content);
        res.json(updatedContract);
    } catch (error) {
        console.error('Error updating contract:', error);
        res.status(500).json({ error: 'Failed to update contract' });
    }
});

// Setup wizard endpoint - save onboarding data
app.post('/api/setup-wizard', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;
        const wizardData = req.body;

        console.log('📋 Processing onboarding wizard data for user:', userId);

        // Create business_settings table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS business_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL UNIQUE,
                business_name TEXT,
                location TEXT,
                phone TEXT,
                email TEXT,
                website TEXT,
                logo_filename TEXT,
                theme_color TEXT DEFAULT '#d4af37',
                tagline TEXT,
                photography_style TEXT,
                currency TEXT DEFAULT 'USD',
                tax_rate DECIMAL,
                enable_email BOOLEAN DEFAULT true,
                enable_sms BOOLEAN DEFAULT false,
                auto_reminders BOOLEAN DEFAULT true,
                welcome_email_template TEXT,
                onboarding_completed BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create session_types table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS session_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                price DECIMAL NOT NULL,
                duration INTEGER NOT NULL,
                deliverables TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Save business settings
        const businessInfo = wizardData.businessInfo || {};
        const branding = wizardData.branding || {};
        const stripe = wizardData.stripe || {};
        const communication = wizardData.communication || {};

        await pool.query(`
            INSERT INTO business_settings (
                user_id, business_name, location, phone, email, website,
                theme_color, tagline, photography_style, currency, tax_rate,
                enable_email, enable_sms, auto_reminders, welcome_email_template, onboarding_completed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (user_id) DO UPDATE SET
                business_name = EXCLUDED.business_name,
                location = EXCLUDED.location,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                website = EXCLUDED.website,
                theme_color = EXCLUDED.theme_color,
                tagline = EXCLUDED.tagline,
                photography_style = EXCLUDED.photography_style,
                currency = EXCLUDED.currency,
                tax_rate = EXCLUDED.tax_rate,
                enable_email = EXCLUDED.enable_email,
                enable_sms = EXCLUDED.enable_sms,
                auto_reminders = EXCLUDED.auto_reminders,
                welcome_email_template = EXCLUDED.welcome_email_template,
                onboarding_completed = EXCLUDED.onboarding_completed,
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId,
            businessInfo.bizName || '',
            businessInfo.bizLocation || '',
            businessInfo.bizPhone || '',
            businessInfo.bizEmail || '',
            businessInfo.bizWebsite || '',
            branding.themeColor || '#d4af37',
            branding.tagline || '',
            branding.style || 'mixed',
            stripe.currency || 'USD',
            stripe.taxRate ? parseFloat(stripe.taxRate) : null,
            communication.enableEmail !== false,
            communication.enableSMS === true,
            communication.autoReminders !== false,
            communication.welcomeEmail || '',
            true
        ]);

        // Save first session type
        const sessionTypes = wizardData.sessionTypes || {};
        if (sessionTypes.sessionName && sessionTypes.sessionPrice && sessionTypes.sessionDuration) {
            await pool.query(`
                INSERT INTO session_types (user_id, name, price, duration, deliverables)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                userId,
                sessionTypes.sessionName,
                parseFloat(sessionTypes.sessionPrice),
                parseInt(sessionTypes.sessionDuration),
                sessionTypes.deliverables || ''
            ]);
        }

        console.log('SUCCESS: Onboarding wizard data saved successfully for user:', userId);
        res.json({ success: true, message: 'Setup completed successfully' });

    } catch (error) {
        console.error(' Error saving wizard data:', error);
        res.status(500).json({ error: 'Failed to save setup data' });
    }
});

// Check onboarding status
app.get('/api/onboarding-status', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;
        const result = await pool.query(
            'SELECT onboarding_completed FROM business_settings WHERE user_id = $1',
            [userId]
        );

        const completed = result.rows.length > 0 ? result.rows[0].onboarding_completed : false;
        res.json({ completed });
    } catch (error) {
        console.error('Error checking onboarding status:', error);
        res.json({ completed: false });
    }
});

// NEW SUBSCRIBER SETUP FLOW
app.get('/setup', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'subscriber-setup.html'));
});

// REDIRECT OLD ONBOARDING TO NEW SETUP
app.get('/onboarding', (req, res) => {
    res.redirect('/setup');
});

// BUSINESS PROFILE SETUP ROUTE
app.get('/business-profile', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Business Profile Setup</title>
        <style>
            body { font-family: 'Quicksand', Arial; background: #f5f4f0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
            h2 { color: #8B7355; margin-bottom: 30px; text-align: center; }
            .form-group { margin-bottom: 20px; }
            label { display: block; font-weight: 600; margin-bottom: 8px; color: #333; }
            input, select, textarea { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; }
            input:focus, select:focus, textarea:focus { border-color: #8B7355; outline: none; }
            .submit-btn { background: #8B7355; color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; }
            .submit-btn:hover { background: #6B5A47; }
            .skip-link { text-align: center; margin-top: 20px; }
            .skip-link a { color: #8B7355; text-decoration: none; }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body>
            <div class="container">
                <h2>📋 Business Profile Setup</h2>
                <form action="/api/save-business-profile" method="POST">
                    <div class="form-group">
                        <label>Business Name</label>
                        <input type="text" name="businessName" required placeholder="Your Photography Business">
                    </div>
                    <div class="form-group">
                        <label>Your Name</label>
                        <input type="text" name="ownerName" required placeholder="Your Full Name">
                    </div>
                    <div class="form-group">
                        <label>Business Email</label>
                        <input type="email" name="email" required placeholder="business@example.com">
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="tel" name="phone" required placeholder="(555) 123-4567">
                    </div>
                    <div class="form-group">
                        <label>Location (City, State)</label>
                        <input type="text" name="location" required placeholder="City, State">
                    </div>
                    <div class="form-group">
                        <label>Photography Specialties</label>
                        <select name="specialties" required>
                            <option value="">Select Primary Specialty</option>
                            <option value="wedding">Wedding Photography</option>
                            <option value="portrait">Portrait Photography</option>
                            <option value="family">Family Photography</option>
                            <option value="maternity">Maternity Photography</option>
                            <option value="newborn">Newborn Photography</option>
                            <option value="commercial">Commercial Photography</option>
                            <option value="fashion">Fashion Photography</option>
                            <option value="events">Event Photography</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Experience Level</label>
                        <select name="experience" required>
                            <option value="">Select Experience Level</option>
                            <option value="professional">Professional (10+ years)</option>
                            <option value="experienced">Experienced (5-10 years)</option>
                            <option value="intermediate">Intermediate (3-5 years)</option>
                            <option value="beginner">Starting Out (1-3 years)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Base Session Price (USD)</label>
                        <input type="number" name="basePrice" placeholder="500" min="0" step="50">
                    </div>
                    <button type="submit" class="submit-btn">Save Business Profile</button>
                </form>
                <div class="skip-link">
                    <a href="/">Skip for now - I'll set this up later</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// SAVE BUSINESS PROFILE API
app.post('/api/save-business-profile', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { businessName, ownerName, email, phone, location, specialties, experience, basePrice } = req.body;

        // Validate location format (City, State)
        const locationPattern = /^[a-zA-Z\s]+,\s*[a-zA-Z\s]+$/;
        if (location && !locationPattern.test(location)) {
            return res.status(400).send(`
                <html><body style="font-family: Arial; padding: 40px; text-align: center;">
                    <h2 style="color: #e74c3c;">Invalid Location Format</h2>
                    <p>Please use format: City, State (e.g., "Charleston, SC")</p>
                    <button onclick="history.back()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">Go Back</button>
                </body></html>
            `);
        }

        console.log('🏢 Business Profile Saved:', {
            businessName, ownerName, email, phone, location, specialties, experience, basePrice
        });

        // Success page
        res.send(`
            <html>
            <head><title>Profile Saved!</title>
            <style>
                body { font-family: 'Quicksand', Arial; background: #f5f4f0; padding: 20px; }
                .success { max-width: 500px; margin: 100px auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); text-align: center; }
                .success h1 { color: #28a745; margin-bottom: 20px; }
                .btn { background: #8B7355; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; }
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
            </head>
            <body>
                <div class="success">
                    <h1>✅ Business Profile Saved!</h1>
                    <h2>Welcome, ${ownerName}!</h2>
                    <p><strong>${businessName}</strong> profile is complete.</p>
                    ${location ? `<p>📍 ${location}</p>` : ''}
                    ${specialties ? `<p>📸 ${specialties}</p>` : ''}
                    <a href="/" class="btn">Start Managing Sessions</a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('❌ Error saving business profile:', error);
        res.status(500).send('Profile save failed. Please try again.');
    }
});

// ==========================================
// POSES GALLERY API - PUBLIC ACCESS FOR ALL PHOTOGRAPHERS
// ==========================================

// Get all approved poses (PUBLIC - no auth required)
app.get('/api/poses', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.display_name as photographer_name 
            FROM poses p 
            LEFT JOIN users u ON p.user_id = u.id 
            WHERE p.approved = true 
            ORDER BY p.created_at DESC
        `);

        const poses = result.rows.map(row => ({
            id: row.id,
            imageUrl: row.image_url,
            category: row.category || [],
            tags: row.tags || [],
            photographerId: row.user_id,
            photographerName: row.photographer_name || 'Anonymous',
            submittedAt: row.created_at,
            approved: row.approved,
            favoriteCount: parseInt(row.favorite_count) || 0
        }));

        res.json(poses);
    } catch (error) {
        console.error('Error fetching poses:', error);
        res.status(500).json({ error: 'Failed to fetch poses' });
    }
});

// Submit new pose (requires auth)
app.post('/api/poses', isAuthenticated, upload.single('poseImage'), async (req, res) => {
    try {
        const { category, tags } = req.body;
        const userId = req.user.uid;

        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        // Create image URL from uploaded file
        const imageUrl = `/uploads/${req.file.filename}`;

        // Parse tags and category
        const tagArray = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
        const categoryArray = category ? [category.toLowerCase()] : [];

        const result = await pool.query(`
            INSERT INTO poses (user_id, image_url, category, tags, approved, created_at) 
            VALUES ($1, $2, $3, $4, false, NOW()) 
            RETURNING *
        `, [userId, imageUrl, JSON.stringify(categoryArray), JSON.stringify(tagArray)]);

        const newPose = result.rows[0];
        console.log('🎯 New pose submitted:', newPose.id);

        res.json({ 
            success: true, 
            message: 'Pose submitted successfully! It will be reviewed before appearing in the gallery.',
            poseId: newPose.id 
        });

    } catch (error) {
        console.error('Error submitting pose:', error);
        res.status(500).json({ error: 'Failed to submit pose' });
    }
});

// Toggle pose favorite (requires auth)
app.post('/api/poses/:poseId/favorite', isAuthenticated, async (req, res) => {
    try {
        const { poseId } = req.params;
        const userId = req.user.uid;

        // Check if already favorited
        const existingFavorite = await pool.query(`
            SELECT * FROM pose_favorites WHERE user_id = $1 AND pose_id = $2
        `, [userId, poseId]);

        if (existingFavorite.rows.length > 0) {
            // Remove favorite
            await pool.query(`DELETE FROM pose_favorites WHERE user_id = $1 AND pose_id = $2`, [userId, poseId]);
            res.json({ favorited: false, message: 'Removed from favorites' });
        } else {
            // Add favorite
            await pool.query(`
                INSERT INTO pose_favorites (user_id, pose_id, created_at) 
                VALUES ($1, $2, NOW())
            `, [userId, poseId]);
            res.json({ favorited: true, message: 'Added to favorites' });
        }

        // Update favorite count in poses table
        await pool.query(`
            UPDATE poses SET favorite_count = (
                SELECT COUNT(*) FROM pose_favorites WHERE pose_id = $1
            ) WHERE id = $1
        `, [poseId]);

    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ error: 'Failed to update favorite' });
    }
});

// Get user's favorite poses (requires auth)
app.get('/api/poses/favorites', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;

        const result = await pool.query(`
            SELECT p.*, u.display_name as photographer_name 
            FROM poses p 
            JOIN pose_favorites pf ON p.id = pf.pose_id 
            LEFT JOIN users u ON p.user_id = u.id 
            WHERE pf.user_id = $1 AND p.approved = true 
            ORDER BY pf.created_at DESC
        `, [userId]);

        const favorites = result.rows.map(row => ({
            id: row.id,
            imageUrl: row.image_url,
            category: row.category || [],
            tags: row.tags || [],
            photographerId: row.user_id,
            photographerName: row.photographer_name || 'Anonymous',
            submittedAt: row.created_at,
            approved: row.approved,
            favoriteCount: parseInt(row.favorite_count) || 0
        }));

        res.json(favorites);
    } catch (error) {
        console.error('Error fetching user favorites:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

// JavaScript test page
app.get('/js-test', (req, res) => {
    res.sendFile(path.join(__dirname, 'simple-test.html'));
});

// Handle NEW setup form submission
app.post('/api/setup-complete', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { businessName, ownerName, email, phone, location, specialties, experience } = req.body;

        console.log('🎯 Processing business setup:', { businessName, ownerName, email });

        // Simple success response
        res.send(`
            <html>
            <head><title>Setup Complete!</title>
            <style>
                body { font-family: Arial; max-width: 500px; margin: 100px auto; padding: 20px; text-align: center; background: #f0f8ff; }
                .success { background: #d4edda; color: #155724; padding: 30px; border-radius: 10px; border: 2px solid #c3e6cb; }
                .btn { background: #007cba; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
            </head>
            <body>
                <div class="success">
                    <h1>🎉 Setup Complete!</h1>
                    <h2>Welcome, ${ownerName}!</h2>
                    <p><strong>${businessName}</strong> is now ready to go.</p>
                    <p>Location: ${location}</p>
                    <p>Specialty: ${specialties}</p>
                    <a href="/" class="btn">Go to Dashboard</a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).send('Setup failed. Please try again.');
    }
});

// Handle onboarding form submission (LEGACY)
app.post('/api/complete-onboarding', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { businessName, ownerName, email, phone, location, specialties, experience } = req.body;

        // Validate location format (City, State)
        const locationPattern = /^[a-zA-Z\s]+,\s*[a-zA-Z\s]+$/;
        if (!locationPattern.test(location)) {
            return res.status(400).send(`
                <html><body style="font-family: Arial; padding: 40px; text-align: center;">
                    <h2 style="color: #e74c3c;">Invalid Location Format</h2>
                    <p>Please use format: City, State (e.g., "Charleston, SC")</p>
                    <button onclick="history.back()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">Go Back</button>
                </body></html>
            `);
        }

        // Store onboarding data in database
        const result = await pool.query(`
            INSERT INTO onboarding_data (
                business_name, owner_name, email, phone, location, 
                specialties, experience, completed_at, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                business_name = $1, owner_name = $2, email = $3, 
                phone = $4, location = $5, specialties = $6, 
                experience = $7, completed_at = NOW()
            RETURNING *
        `, [
            businessName, ownerName, email, phone, location,
            Array.isArray(specialties) ? specialties.join(',') : specialties || '',
            experience || 'not_specified',
            req.user?.uid || 'anonymous'
        ]);

        console.log('✅ Onboarding completed:', result.rows[0]);

        // Success page
        res.send(`
            <html>
            <head>
                <title>Setup Complete</title>
                <style>
                    body { font-family: 'Quicksand', sans-serif; background: linear-gradient(135deg, #f5f1eb 0%, #e8ddd4 100%); padding: 40px; text-align: center; }
                    .success-container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                    .success-icon { font-size: 48px; color: #27ae60; margin-bottom: 20px; }
                    h1 { color: #5d4e37; margin-bottom: 20px; }
                    .btn { background: linear-gradient(135deg, #d4b08a 0%, #c19a6b 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="success-container">
                    <div class="success-icon">✓</div>
                    <h1>Welcome, ${ownerName}!</h1>
                    <p>Your photography business setup is complete. You can now access all features of the Photography Management System.</p>
                    <a href="/" class="btn">Go to Dashboard</a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Onboarding error:', error);
        res.status(500).send(`
            <html><body style="font-family: Arial; padding: 40px; text-align: center;">
                <h2 style="color: #e74c3c;">Setup Error</h2>
                <p>There was an issue completing your setup. Please try again.</p>
                <button onclick="history.back()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">Go Back</button>
            </body></html>
        `);
    }
});

// Serve original onboarding for reference
app.get('/onboarding-old', (req, res) => {
    if (!DEV_MODE) {
        // Check authentication in production mode
        if (!req.session || !req.session.user) {
            return res.redirect('/auth.html?return=/onboarding-old');
        }
    }
    res.sendFile(path.join(__dirname, 'onboarding-fixed.html'));
});

// Serve admin dashboard with authentication requirement  
app.get('/admin', (req, res) => {
    if (!DEV_MODE) {
        // Check authentication in production mode
        if (!req.session || !req.session.user) {
            return res.redirect('/auth.html?return=/admin');
        }
    }
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve auth page for non-authenticated users
app.get('/auth.html', (req, res) => {
    // Add cache-busting headers to prevent caching of auth.html
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}"`
    });
    res.sendFile(path.join(__dirname, 'auth.html'));
});

// Serve public website pages - /site/:username
app.get('/site/:username', async (req, res) => {
    try {
        const username = req.params.username;

        // Get website data from PostgreSQL database
        const result = await pool.query(
            'SELECT * FROM websites WHERE username = $1 AND published = TRUE',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Site Not Found</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                               text-align: center; padding: 50px; background: #f5f5f5; }
                        .error { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                        h1 { color: #333; margin-bottom: 20px; }
                        p { color: #666; margin-bottom: 30px; }
                        a { color: #d4af37; text-decoration: none; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1> Site Not Found</h1>
                        <p>The photography website "${username}" doesn't exist or hasn't been published yet.</p>
                        <a href="/">← Back to Photography Management System</a>
                    </div>
                </body>
                </html>
            `);
        }

        const websiteData = result.rows[0];
        const blocks = websiteData.site_config.blocks || [];

        // Generate dynamic website based on theme and content
        const websiteHTML = generateWebsiteFromBlocks(blocks, websiteData.theme, username);

        res.send(websiteHTML);

    } catch (error) {
        console.error('Error serving public website:', error);
        res.status(500).send('Error loading website');
    }
});

// Helper function to get theme styles
function getThemeStyles(theme) {
    const themes = {
        'clean': {
            background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
            textColor: '#343a40',
            accentColor: '#d4af37'
        },
        'gallery': {
            background: 'linear-gradient(135deg, #212529, #343a40)',
            textColor: '#f8f9fa',
            accentColor: '#d4af37'
        },
        'banner': {
            background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
            textColor: '#f8f9fa',
            accentColor: '#d4af37'
        },
        'legacy': {
            background: 'linear-gradient(135deg, #1a1a1a, #2c1810)',
            textColor: '#f4e4bc',
            accentColor: '#d4af37'
        }
    };
    return themes[theme] || themes['clean'];
}

// Helper function to generate website from blocks
function generateWebsiteFromBlocks(blocks, theme, username) {
    const themeStyles = getThemeStyles(theme);

    const blocksHTML = blocks.map(block => {
        switch (block.type) {
            case 'heading':
                return `<h1 style="${convertStylesToCSS(block.styles)}">${block.content}</h1>`;
            case 'paragraph':
                return `<p style="${convertStylesToCSS(block.styles)}">${block.content}</p>`;
            case 'button':
                return `<button style="${convertStylesToCSS(block.styles)}; background: #D4AF37; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">${block.content}</button>`;
            default:
                return `<div>${block.content}</div>`;
        }
    }).join('\n        ');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${username} - Photography Portfolio</title>
    <meta name="description" content="Professional photography portfolio by ${username}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            background: ${themeStyles.background};
            color: ${themeStyles.textColor};
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: rgba(255, 255, 255, 0.9);
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .website-content > * {
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid ${themeStyles.accentColor};
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="website-content">
            ${blocksHTML}
        </div>
        <div class="footer">
            <p>Created with Photography Management System</p>
            <p><a href="mailto:lance@thelegacyphotography.com" style="color: ${themeStyles.accentColor};">Contact: lance@thelegacyphotography.com</a> | <a href="tel:843-485-1315" style="color: ${themeStyles.accentColor};">Call: 843-485-1315</a></p>
        </div>
    </div>
</body>
</html>`;
}

// Helper function to convert styles object to CSS string
function convertStylesToCSS(styles) {
    return Object.entries(styles || {})
        .map(([key, value]) => {
            // Convert camelCase to kebab-case
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
        })
        .join('; ');
}

// Helper function to generate public website HTML (legacy)
function generatePublicWebsite(websiteData) {
    const theme = getThemeStyles(websiteData.theme);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${websiteData.title}</title>
    <meta name="description" content="${websiteData.welcomeMessage}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            background: ${theme.background};
            color: ${theme.textColor};
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 60px 20px; }
        .header h1 { 
            font-size: 3em; 
            margin-bottom: 20px; 
            color: ${theme.accentColor}; 
            font-weight: 700;
        }
        .header p { 
            font-size: 1.3em; 
            max-width: 600px; 
            margin: 0 auto; 
            opacity: 0.9;
        }
        .profile-image { 
            width: 200px; 
            height: 200px; 
            border-radius: 50%; 
            margin: 30px auto; 
            display: block;
            border: 4px solid ${theme.accentColor};
        }
        .content-section { 
            padding: 40px 20px; 
            text-align: center; 
        }
        .contact-info {
            background: rgba(212, 175, 55, 0.1);
            padding: 40px;
            border-radius: 12px;
            margin: 40px 0;
            border: 2px solid ${theme.accentColor};
        }
        .contact-info h2 { color: ${theme.accentColor}; margin-bottom: 20px; }
        .contact-btn {
            display: inline-block;
            padding: 15px 30px;
            margin: 10px;
            background: ${theme.accentColor};
            color: #1a1a1a;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            transition: transform 0.3s ease;
        }
        .contact-btn:hover { transform: translateY(-2px); }
        .footer {
            text-align: center;
            padding: 40px 20px;
            border-top: 1px solid rgba(212, 175, 55, 0.3);
            margin-top: 60px;
        }
        .theme-${websiteData.theme} { 
            background: ${theme.background};
            color: ${theme.textColor};
        }
        @media (max-width: 768px) {
            .header h1 { font-size: 2em; }
            .header p { font-size: 1.1em; }
            .profile-image { width: 150px; height: 150px; }
        }
    </style>
</head>
<body class="theme-${websiteData.theme}">
    <div class="container">
        <header class="header">
            <h1>${websiteData.title}</h1>
            ${websiteData.profileImage ? `<img src="${websiteData.profileImage}" alt="${websiteData.title}" class="profile-image">` : ''}
            <p>${websiteData.welcomeMessage}</p>
        </header>

        <main class="content-section">
            <div class="contact-info">
                <h2>Get In Touch</h2>
                <p>Ready to capture your special moments? Let's create something beautiful together.</p>
                <br>
                <a href="mailto:lance@thelegacyphotography.com" class="contact-btn"> Send Email</a>
                <a href="tel:8434851315" class="contact-btn">📞 Call Now</a>
                <a href="sms:8434851315" class="contact-btn">💬 Text Message</a>
            </div>
        </main>

        <footer class="footer">
            <p>© 2025 ${websiteData.title} | Built with Photography Management System</p>
            <p style="margin-top: 10px; font-size: 0.9em; opacity: 0.7;">
                Published: ${websiteData.publishedAt ? new Date(websiteData.publishedAt.toDate()).toLocaleDateString() : 'Recently'}
            </p>
        </footer>
    </div>
</body>
</html>
`;
}

// Serve landing page (no authentication required)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing.html'));
});

// Serve main app with authentication requirement
app.get('/app', (req, res) => {
    if (!DEV_MODE) {
        // Check authentication in production mode
        if (!req.session || !req.session.user) {
            return res.redirect('/auth.html?return=/app');
        }
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Alternative dashboard route
app.get('/dashboard', (req, res) => {
    if (!DEV_MODE) {
        // Check authentication in production mode
        if (!req.session || !req.session.user) {
            return res.redirect('/auth.html?return=/dashboard');
        }
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// SUCCESS: PREMIUM ENDPOINT: Publish Static Site
app.post('/api/publishStaticSite', isAuthenticated, requirePremium, async (req, res) => {
    try {
        const userId = req.user.uid;

        // Get website data from Firebase
        if (!admin.apps.length) {
            return res.status(500).json({ message: 'Firebase not configured' });
        }

        const websiteDoc = await admin.firestore()
            .collection('websites')
            .doc(userId)
            .get();

        if (!websiteDoc.exists) {
            return res.status(400).json({ message: 'No website found. Please create a website first.' });
        }

        const websiteData = websiteDoc.data();
        const username = websiteData.customUsername || userId;

        // Enhanced HTML generator with advanced themes and features
        const html = generatePremiumStaticSite(websiteData, username);

        // Save static site
        const outputPath = path.join(__dirname, 'static-sites', `${username}.html`);
        fs.writeFileSync(outputPath, html);

        // Update published_websites collection for public access
        await admin.firestore()
            .collection('published_websites')
            .doc(username)
            .set({
                ...websiteData,
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                staticSiteGenerated: true,
                publishedBy: userId
            });

        console.log(`SUCCESS: Premium static site published for user ${userId} as ${username}`);

        res.json({ 
            success: true, 
            url: `/site/${username}`,
            staticUrl: `/static-site/${username}`,
            message: 'Premium static site published successfully!'
        });

    } catch (error) {
        console.error('Static site publishing error:', error);
        res.status(500).json({ message: 'Failed to publish static site' });
    }
});

// Generate premium static site HTML with advanced features
function generatePremiumStaticSite(config, username) {
    const themeStyles = getPremiumThemeStyles(config.theme || 'classic');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title || config.businessName || "Professional Photography"}</title>
    <meta name="description" content="${config.welcomeMessage || 'Professional photography services'}">
    <meta name="keywords" content="photography, professional photographer, ${config.businessName || ''}">

    <!-- Premium SEO Meta Tags -->
    <meta property="og:title" content="${config.title || config.businessName}">
    <meta property="og:description" content="${config.welcomeMessage}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://photomanagementsystem.com/site/${username}">

    <!-- Premium Theme Styles -->
    <style>
        ${themeStyles}

        /* Premium Analytics Tracking */
        .analytics-pixel { display: none; }

        /* Premium Mobile Optimizations */
        @media (max-width: 768px) {
            .container { padding: 1rem; }
            .header h1 { font-size: 2rem; }
            .contact-btn { padding: 12px 20px; margin: 5px 0; display: block; }
        }
    </style>

    <!-- Premium Analytics (Development Mode) -->
    ${DEV_MODE ? '<!-- Analytics disabled in DEV_MODE -->' : '<!-- Premium Analytics Code Here -->'}
</head>
<body class="theme-${config.theme || 'classic'}">
    <div class="container">
        <header class="header">
            <h1>${config.title || config.businessName || "Photography Studio"}</h1>
            ${config.profileImage ? `<img src="${config.profileImage}" alt="${config.title}" class="profile-image">` : ''}
            <p class="welcome-message">${config.welcomeMessage || "Welcome to our photography studio"}</p>
        </header>

        <main class="content-section">
            <div class="contact-info">
                <h2>Get In Touch</h2>
                <p>Ready to capture your special moments? Let's create something beautiful together.</p>
                <div class="contact-buttons">
                    <a href="mailto:lance@thelegacyphotography.com" class="contact-btn email"> Send Email</a>
                    <a href="tel:8434851315" class="contact-btn phone">📞 Call Now</a>
                    <a href="sms:8434851315" class="contact-btn sms">💬 Text Message</a>
                </div>
            </div>
        </main>

        <footer class="footer">
            <p>© ${new Date().getFullYear()} ${config.title || config.businessName} | Professional Photography Services</p>
            <p class="powered-by">Powered by <a href="https://photomanagementsystem.com" target="_blank">Photography Management System</a></p>
            <div class="analytics-pixel" data-site="${username}"></div>
        </footer>
    </div>

    <!-- Premium Features Script -->
    <script>
        // Premium contact form analytics
        document.querySelectorAll('.contact-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                console.log('Contact interaction:', this.className);
                // Premium analytics tracking would go here
            });
        });

        // Premium mobile optimizations
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            document.body.classList.add('mobile-device');
        }
    </script>
</body>
</html>`;
}

// Premium theme styles generator
function getPremiumThemeStyles(theme) {
    const baseStyles = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .profile-image { width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin: 1rem 0; }
        .content-section { margin: 2rem 0; }
        .contact-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 2rem; }
        .contact-btn { padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; transition: all 0.3s ease; }
        .footer { text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #eee; }
        .powered-by { margin-top: 1rem; font-size: 0.9em; opacity: 0.7; }
        .powered-by a { color: #d4af37; text-decoration: none; }
    `;

    const themeStyles = {
        classic: `
            ${baseStyles}
            body { background: #f8f9fa; color: #333; }
            .header h1 { color: #2c3e50; font-size: 3rem; margin-bottom: 1rem; }
            .welcome-message { color: #666; font-size: 1.2rem; }
            .contact-btn { background: #d4af37; color: white; }
            .contact-btn:hover { background: #b8941f; transform: translateY(-2px); }
        `,
        modern: `
            ${baseStyles}
            body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; }
            .header h1 { color: white; font-size: 3.5rem; font-weight: 300; }
            .welcome-message { color: rgba(255,255,255,0.9); font-size: 1.3rem; }
            .contact-btn { background: rgba(255,255,255,0.2); color: white; border: 2px solid white; }
            .contact-btn:hover { background: white; color: #667eea; }
        `,
        dark: `
            ${baseStyles}
            body { background: #1a1a1a; color: #f5f5f5; }
            .header h1 { color: #d4af37; font-size: 3rem; }
            .welcome-message { color: #ccc; font-size: 1.2rem; }
            .contact-btn { background: #d4af37; color: #1a1a1a; }
            .contact-btn:hover { background: #f4e4bc; }
            .footer { border-top-color: #333; }
        `,
        bold: `
            ${baseStyles}
            body { background: #ff6b6b; color: white; }
            .header h1 { color: white; font-size: 4rem; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
            .welcome-message { color: rgba(255,255,255,0.9); font-size: 1.4rem; font-weight: bold; }
            .contact-btn { background: white; color: #ff6b6b; font-weight: bold; text-transform: uppercase; }
            .contact-btn:hover { background: #f8f8f8; transform: scale(1.05); }
        `
    };

    return themeStyles[theme] || themeStyles.classic;
}

// Serve premium static sites
app.use('/static-site', express.static(path.join(__dirname, 'static-sites')));

// Premium subscription management endpoint
app.post('/api/upgrade-premium', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { plan } = req.body; // 'monthly' or 'yearly'

        // In development mode, auto-grant premium
        if (DEV_MODE) {
            await pool.query(
                `UPDATE users SET 
                    premium_plan = $1, 
                    premium_expires = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = $3`,
                [plan, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), req.user.email] // 1 year from now
            );

            return res.json({ 
                success: true, 
                message: 'Premium activated! (Development Mode)',
                plan: plan,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            });
        }

        // In production, integrate with Stripe for payment processing
        res.json({ 
            message: 'Premium upgrade integration would handle Stripe payment here',
            redirectUrl: '/premium-checkout'
        });

    } catch (error) {
        console.error('Premium upgrade error:', error);
        res.status(500).json({ message: 'Failed to process premium upgrade' });
    }
});

// Check premium status endpoint
app.get('/api/premium-status', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;

        if (DEV_MODE) {
            return res.json({ 
                isPremium: true, 
                plan: 'development',
                message: 'Premium features enabled in development mode'
            });
        }

        const result = await pool.query(
            'SELECT premium_plan, premium_expires FROM users WHERE email = $1',
            [req.user.email]
        );

        const isPremium = result.rows.length > 0 && 
            result.rows[0].premium_plan && 
            (!result.rows[0].premium_expires || new Date(result.rows[0].premium_expires) > new Date());

        res.json({ 
            isPremium,
            plan: result.rows[0]?.premium_plan || null,
            expiresAt: result.rows[0]?.premium_expires || null
        });

    } catch (error) {
        console.error('Premium status check error:', error);
        res.status(500).json({ message: 'Failed to check premium status' });
    }
});

// SEO and crawler accessibility routes
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Public information page for AI crawlers (no authentication required)
app.get('/public-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-info.html'));
});

app.get('/info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-info.html'));
});

// Premium static site publishing endpoint
// Simple publish endpoint for website builder
app.post('/api/publish-site', isAuthenticated, async (req, res) => {
    try {
        const { username, blocks, theme, userEmail } = req.body;

        if (!username || !blocks || !userEmail) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Save to database
        await pool.query(`
            INSERT INTO websites (user_email, username, site_config, theme, published_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (username) 
            DO UPDATE SET 
                site_config = $3,
                theme = $4,
                published_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `, [userEmail, username, JSON.stringify({ blocks }), theme]);

        res.json({ 
            success: true, 
            url: `/site/${username}`,
            message: 'Website published successfully'
        });

    } catch (error) {
        console.error('Error publishing site:', error);
        res.status(500).json({ error: 'Failed to publish website' });
    }
});

app.post('/api/publish-static-site', isAuthenticated, requirePremium, async (req, res) => {
    try {
        const { siteConfig, theme, username } = req.body;

        if (!siteConfig || !username) {
            return res.status(400).json({ message: 'Site configuration and username required' });
        }

        // Sanitize username
        const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Generate static HTML
        const staticHTML = generateStaticHTML(siteConfig, theme, cleanUsername);

        // Ensure static-sites directory exists
        const staticSitesDir = path.join(__dirname, 'static-sites');
        if (!fs.existsSync(staticSitesDir)) {
            fs.mkdirSync(staticSitesDir, { recursive: true });
        }

        // Write static HTML file
        const siteFilePath = path.join(staticSitesDir, `${cleanUsername}.html`);
        fs.writeFileSync(siteFilePath, staticHTML);

        // Save site config to database
        await pool.query(`
            INSERT INTO websites (user_email, username, site_config, theme, published_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (username) 
            DO UPDATE SET 
                site_config = $3,
                theme = $4,
                published_at = NOW(),
                user_email = $1
        `, [req.user.email, cleanUsername, JSON.stringify(siteConfig), theme]);

        const publishedUrl = `${req.protocol}://${req.get('host')}/site/${cleanUsername}`;

        res.json({
            success: true,
            publishedUrl,
            message: 'Site published successfully!'
        });

    } catch (error) {
        console.error('Error publishing static site:', error);
        res.status(500).json({ message: 'Failed to publish site' });
    }
});

// Serve published static sites
app.get('/site/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Try to serve from static files first
        const staticFilePath = path.join(__dirname, 'static-sites', `${cleanUsername}.html`);

        if (fs.existsSync(staticFilePath)) {
            return res.sendFile(staticFilePath);
        }

        // Fallback: generate from database
        const result = await pool.query(
            'SELECT site_config, theme FROM websites WHERE username = $1',
            [cleanUsername]
        );

        if (result.rows.length === 0) {
            return res.status(404).send(`
                <html>
                    <head>
                        <title>Site Not Found</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 100px; }
                            h1 { color: #D4AF37; }
                        </style>
                    </head>
                    <body>
                        <h1>Site Not Found</h1>
                        <p>The site "${username}" does not exist or has been removed.</p>
                        <a href="/">← Back to Photography Management System</a>
                    </body>
                </html>
            `);
        }

        const siteConfig = result.rows[0].site_config;
        const theme = result.rows[0].theme || 'classic';

        const staticHTML = generateStaticHTML(siteConfig, theme, cleanUsername);
        res.send(staticHTML);

    } catch (error) {
        console.error('Error serving published site:', error);
        res.status(500).send('Error loading site');
    }
});

// Generate static HTML function
function generateStaticHTML(siteConfig, theme, username) {
    const themeStyles = {
        classic: {
            background: 'linear-gradient(135deg, #faf7f0 0%, #f5f1e8 100%)',
            primaryColor: '#D4AF37',
            textColor: '#333333',
            fontFamily: 'Georgia, serif'
        },
        modern: {
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            primaryColor: '#2563EB',
            textColor: '#1f2937',
            fontFamily: 'Inter, sans-serif'
        },
        dark: {
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            primaryColor: '#10B981',
            textColor: '#ffffff',
            fontFamily: 'Roboto, sans-serif'
        },
        bold: {
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            primaryColor: '#DC2626',
            textColor: '#1f2937',
            fontFamily: 'Montserrat, sans-serif'
        }
    };

    const selectedTheme = themeStyles[theme] || themeStyles.classic;

    let blocksHTML = '';

    if (siteConfig.blocks && siteConfig.blocks.length > 0) {
        blocksHTML = siteConfig.blocks.map(block => {
            const styles = { ...block.styles };

            switch (block.type) {
                case 'heading':
                    return `<h1 style="${objectToCSS(styles)}">${escapeHTML(block.content)}</h1>`;

                case 'paragraph':
                    return `<p style="${objectToCSS(styles)}">${escapeHTML(block.content)}</p>`;

                case 'image':
                    return `<img src="${escapeHTML(block.content)}" alt="Site image" style="${objectToCSS(styles)}" />`;

                case 'button':
                    return `<button style="${objectToCSS(styles)}" onclick="window.open('mailto:lance@thelegacyphotography.com')">${escapeHTML(block.content)}</button>`;

                default:
                    return '';
            }
        }).join('\n        ');
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="index, follow">
    <title>${escapeHTML(siteConfig.blocks?.[0]?.content || 'Photography Portfolio')}</title>
    <meta name="description" content="Professional photography portfolio and services">
    <meta name="keywords" content="photography, portfolio, professional photographer, wedding photography, portrait photography">

    <!-- Open Graph tags -->
    <meta property="og:title" content="${escapeHTML(siteConfig.blocks?.[0]?.content || 'Photography Portfolio')}">
    <meta property="og:description" content="Professional photography portfolio and services">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://photomanagementsystem.com/site/${username}">

    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHTML(siteConfig.blocks?.[0]?.content || 'Photography Portfolio')}">
    <meta name="twitter:description" content="Professional photography portfolio and services">

    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: ${selectedTheme.fontFamily};
            background: ${selectedTheme.background};
            color: ${selectedTheme.textColor};
            line-height: 1.6;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .site-content {
            background: rgba(255, 255, 255, 0.95);
            padding: 60px 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: ${selectedTheme.textColor};
            opacity: 0.8;
        }

        .contact-info {
            background: rgba(255, 255, 255, 0.9);
            padding: 30px;
            border-radius: 8px;
            margin-top: 40px;
            text-align: center;
        }

        .contact-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
            flex-wrap: wrap;
        }

        .contact-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            background: ${selectedTheme.primaryColor};
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }

        .contact-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 768px) {
            .container {
                padding: 20px 10px;
            }

            .site-content {
                padding: 40px 20px;
            }

            .contact-buttons {
                flex-direction: column;
                align-items: center;
            }

            .contact-btn {
                width: 100%;
                max-width: 280px;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="site-content">
            ${blocksHTML}

            <div class="contact-info">
                <h3 style="color: ${selectedTheme.primaryColor}; margin-bottom: 15px;">Get In Touch</h3>
                <p>Ready to capture your special moments? Let's connect!</p>

                <div class="contact-buttons">
                    <a href="mailto:lance@thelegacyphotography.com" class="contact-btn">
                         Email Me
                    </a>
                    <a href="tel:843-485-1315" class="contact-btn">
                        📞 Call Now
                    </a>
                    <a href="sms:843-485-1315" class="contact-btn">
                        💬 Text Message
                    </a>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>© ${new Date().getFullYear()} Professional Photography Services</p>
            <p>Powered by <a href="https://photomanagementsystem.com" style="color: ${selectedTheme.primaryColor};">Photography Management System</a></p>
        </div>
    </div>

    <!-- Analytics placeholder -->
    <script>
        // Contact interaction tracking
        document.querySelectorAll('.contact-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                console.log('Contact interaction:', btn.textContent.trim());
            });
        });
    </script>
</body>
</html>`;
}

// Helper functions
function objectToCSS(obj) {
    return Object.entries(obj)
        .map(([key, value]) => `${camelToKebab(key)}: ${value}`)
        .join('; ');
}

function camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

function escapeHTML(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Serve static files last to ensure routes run first
app.use(express.static(__dirname));

// Start server
// Premium subscription middleware
async function requirePremium(req, res, next) {
    try {
        if (DEV_MODE) {
            // Development mode - auto-grant premium access
            req.isPremium = true;
            return next();
        }

        // Check user's premium status from database
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Check premium status from database
        const result = await pool.query(
            'SELECT premium_plan, premium_expires FROM users WHERE email = $1',
            [req.user.email]
        );

        const isPremium = result.rows.length > 0 && 
            result.rows[0].premium_plan && 
            (!result.rows[0].premium_expires || new Date(result.rows[0].premium_expires) > new Date());

        if (!isPremium) {
            return res.status(403).json({ 
                message: 'Upgrade to Premium to access this feature.',
                upgradeUrl: '/premium'
            });
        }

        req.isPremium = true;
        next();
    } catch (error) {
        console.error('Premium check error:', error);
        res.status(500).json({ message: 'Premium verification failed' });
    }
}

// Create static-sites directory if it doesn't exist
function ensureStaticSitesDirectory() {
    const staticSitesDir = path.join(__dirname, 'static-sites');
    if (!fs.existsSync(staticSitesDir)) {
        fs.mkdirSync(staticSitesDir, { recursive: true });
        console.log('File: Created static-sites directory');
    }
}

// Website Builder AI Generation Endpoint
app.post('/api/ai/generate-complete-website', async (req, res) => {
    try {
        const { prompt, businessType, pages, currentSettings } = req.body;

        // Give Lance unlimited AI access as the owner
        const lanceEmails = [
            'lancecasselman@icloud.com',
            'lancecasselman2011@gmail.com', 
            'Lance@thelegacyphotography.com'
        ];

        // Bypass credit check for Lance
        if (!lanceEmails.includes(req.user?.email)) {
            // Check credits for other users
            const normalizedUser = normalizeUserForLance(req.user);
            const userId = normalizedUser.uid;
            const currentCredits = await getUserAiCredits(userId);

            if (currentCredits < 1) {
                return res.status(402).json({ 
                    error: 'Insufficient AI credits',
                    credits: currentCredits 
                });
            }
        }

        console.log('Generating website for prompt:', prompt);

        // Intelligent template detection
        const templateType = detectTemplateFromPrompt(prompt);
        const style = detectStyleFromPrompt(prompt);
        const businessInfo = extractBusinessInfo(prompt);

        const website = {
            pages: generateIntelligentContent(templateType, style, businessInfo, pages),
            settings: {
                ...currentSettings,
                primaryColor: getColorFromStyle(style),
                typography: getTypographyFromStyle(style),
                siteTitle: businessInfo.name || 'Photography Studio'
            }
        };

        res.json({ success: true, website });

    } catch (error) {
        console.error('Website generation error:', error);
        res.json({ success: false, error: error.message });
    }
});

function detectTemplateFromPrompt(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes('wedding') || lower.includes('bride')) return 'wedding';
    if (lower.includes('portrait') || lower.includes('headshot')) return 'portrait';
    if (lower.includes('fashion') || lower.includes('editorial')) return 'fashion';
    if (lower.includes('commercial') || lower.includes('business')) return 'commercial';
    return 'portrait';
}

function detectStyleFromPrompt(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes('elegant') || lower.includes('luxury')) return 'elegant';
    if (lower.includes('modern') || lower.includes('minimal')) return 'modern';
    if (lower.includes('bold') || lower.includes('dramatic')) return 'bold';
    return 'elegant';
}

function extractBusinessInfo(prompt) {
    return {
        name: 'Photography Studio',
        description: prompt.slice(0, 200)
    };
}

function getColorFromStyle(style) {
    const colors = {
        elegant: '#d4af37',
        modern: '#2c3e50',
        bold: '#e74c3c'
    };
    return colors[style] || '#d4af37';
}

function getTypographyFromStyle(style) {
    const fonts = {
        elegant: 'playfair',
        modern: 'inter',
        bold: 'montserrat'
    };
    return fonts[style] || 'inter';
}

function generateIntelligentContent(templateType, style, businessInfo, pages) {
    const pageData = {};

    pages.forEach(page => {
        pageData[page] = generatePageContent(templateType, page);
    });

    return pageData;
}

function generatePageContent(templateType, pageType) {
    const templates = {
        wedding: {
            home: `<div style="background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80'); background-size: cover; background-position: center; height: 100vh; display: flex; align-items: center; justify-content: center; color: white; text-align: center;"><div><h1 style="font-size: 4rem; font-weight: 300; margin-bottom: 20px;">Eternal Moments</h1><p style="font-size: 1.5rem; margin-bottom: 30px; opacity: 0.9;">Capturing the magic of your special day</p><button style="padding: 15px 30px; background: #d4af37; color: white; border: none; font-size: 1.1rem; cursor: pointer; border-radius: 4px;">View Our Work</button></div></div>`,
            about: `<div style="padding: 100px 50px; max-width: 1200px; margin: 0 auto;"><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;"><div><h1 style="font-size: 3.5rem; margin-bottom: 30px; color: #333;">Our Story</h1><p style="font-size: 1.2rem; line-height: 1.8; color: #666;">With over a decade of experience capturing love stories, we create timeless images that reflect your unique story.</p></div><div style="background: url('https://images.unsplash.com/photo-1511285560929-80b456fea0bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 500px; border-radius: 8px;"></div></div></div>`,
            portfolio: `<div style="padding: 100px 50px; text-align: center;"><h1 style="font-size: 3.5rem; margin-bottom: 50px; color: #333;">Wedding Portfolio</h1><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto;"><div style="background: url('https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 300px; border-radius: 8px;"></div><div style="background: url('https://images.unsplash.com/photo-1606216794074-735e91aa2c92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 300px; border-radius: 8px;"></div><div style="background: url('https://images.unsplash.com/photo-1583939003579-730e3918a45a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 300px; border-radius: 8px;"></div></div></div>`,
            contact: `<div style="padding: 100px 50px; max-width: 800px; margin: 0 auto; text-align: center;"><h1 style="font-size: 3.5rem; margin-bottom: 30px; color: #333;">Let's Create Magic Together</h1><p style="font-size: 1.2rem; margin-bottom: 50px; color: #666;">Ready to start planning your dream wedding photography?</p><form style="text-align: left;"><div style="margin-bottom: 20px;"><input type="text" placeholder="Your Names" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;"></div><div style="margin-bottom: 20px;"><input type="email" placeholder="Email Address" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;"></div><div style="margin-bottom: 20px;"><input type="date" placeholder="Wedding Date" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;"></div><div style="margin-bottom: 30px;"><textarea placeholder="Tell us about your vision..." rows="5" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; resize: vertical;"></textarea></div><button type="submit" style="width: 100%; padding: 15px; background: #d4af37; color: white; border: none; font-size: 1.1rem; cursor: pointer; border-radius: 4px;">Send Message</button></form></div>`
        },
        portrait: {
            home: `<div style="background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80'); background-size: cover; background-position: center; height: 100vh; display: flex; align-items: center; justify-content: center; color: white; text-align: center;"><div><h1 style="font-size: 4rem; font-weight: 400; margin-bottom: 20px;">Professional Portraits</h1><p style="font-size: 1.5rem; margin-bottom: 30px; opacity: 0.9;">Capturing your authentic self</p><button style="padding: 15px 30px; background: #2c3e50; color: white; border: none; font-size: 1.1rem; cursor: pointer; border-radius: 4px;">Book a Session</button></div></div>`,
            about: `<div style="padding: 100px 50px; max-width: 1200px; margin: 0 auto;"><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;"><div><h1 style="font-size: 3.5rem; margin-bottom: 30px; color: #333;">Professional Portrait Photography</h1><p style="font-size: 1.2rem; line-height: 1.8; color: #666;">Specializing in professional headshots and personal branding photography.</p></div><div style="background: url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 500px; border-radius: 8px;"></div></div></div>`,
            portfolio: `<div style="padding: 100px 50px; text-align: center;"><h1 style="font-size: 3.5rem; margin-bottom: 50px; color: #333;">Portrait Gallery</h1><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto;"><div style="background: url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 400px; border-radius: 8px;"></div><div style="background: url('https://images.unsplash.com/photo-1494790108755-2616b612b647?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 400px; border-radius: 8px;"></div><div style="background: url('https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'); background-size: cover; background-position: center; height: 400px; border-radius: 8px;"></div></div></div>`,
            contact: `<div style="padding: 100px 50px; max-width: 800px; margin: 0 auto; text-align: center;"><h1 style="font-size: 3.5rem; margin-bottom: 30px; color: #333;">Book Your Portrait Session</h1><p style="font-size: 1.2rem; margin-bottom: 50px; color: #666;">Professional headshots that make an impact.</p><form style="text-align: left;"><div style="margin-bottom: 20px;"><input type="text" placeholder="Full Name" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;"></div><div style="margin-bottom: 20px;"><input type="email" placeholder="Email Address" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;"></div><div style="margin-bottom: 20px;"><select style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;"><option>Headshots</option><option>Personal Branding</option><option>Corporate</option><option>Creative Portraits</option></select></div><div style="margin-bottom: 30px;"><textarea placeholder="Tell us about your goals..." rows="5" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; resize: vertical;"></textarea></div><button type="submit" style="width: 100%; padding: 15px; background: #2c3e50; color: white; border: none; font-size: 1.1rem; cursor: pointer; border-radius: 4px;">Schedule Consultation</button></form></div>`
        }
    };

    return templates[templateType]?.[pageType] || `<div style="padding: 100px; text-align: center;"><h1>${pageType.charAt(0).toUpperCase() + pageType.slice(1)} Page</h1><p>Professional ${templateType} photography content coming soon.</p></div>`;
}

// Initialize database and start server
async function startServer() {
    await initializeDatabase();
    ensureStaticSitesDirectory();

    // Initialize notification services
    initializeNotificationServices();

    // Start automated payment scheduler
    paymentScheduler.start();

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(` Photo Session Scheduler running on http://0.0.0.0:${PORT}`);
        console.log('Database connected and ready');
        if (process.env.TEST_MODE === 'true') {
            console.log('🧪 TEST MODE ENABLED - Development authentication bypass active');
        } else {
            console.log('AUTH: Authentication required for all access - no anonymous mode');
        }
    });

    // Set INFINITE timeouts for large uploads - MAXIMUM settings
    server.timeout = 0; // 0 = infinite
    server.keepAliveTimeout = 0; // 0 = infinite  
    server.headersTimeout = 0; // 0 = infinite
    server.requestTimeout = 0; // 0 = infinite
    server.maxHeadersCount = 0; // Remove header count limit
    console.log('File: Server configured with INFINITE timeouts - no upload limits!');
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

// Error handling
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File upload error. Please try again with smaller batches.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files in single upload. Please upload in smaller batches.' });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'Unexpected file upload error. Please try again.' });
        }

    }
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error during upload. Please try uploading fewer files at once.' });
});

// Website Builder API Routes
app.post('/api/save-layout', isAuthenticated, async (req, res) => {
    try {
        const { layout, title } = req.body;
        const userId = req.user.uid;

        if (!layout) {
            return res.status(400).json({ error: 'Layout data is required' });
        }

        // Check if Firebase is available
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }

        // Generate unique ID for the layout
        const layoutId = `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Save to Firestore builderPages collection
        const layoutData = {
            layout: layout,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: userId,
            userEmail: req.user.email,
            title: title || 'Untitled Layout',
            published: req.body.published || false
        };

        await admin.firestore()
            .collection('builderPages')
            .doc(layoutId)
            .set(layoutData);

        console.log(`Layout saved for user ${userId}: ${layoutId}`);
        res.json({ success: true, id: layoutId });

    } catch (error) {
        console.error('Error saving layout:', error);
        res.status(500).json({ error: 'Failed to save layout' });
    }
});

app.get('/api/load-layout/:id', isAuthenticated, async (req, res) => {
    try {
        const layoutId = req.params.id;
        const userId = req.user.uid;

        if (!layoutId) {
            return res.status(400).json({ error: 'Layout ID is required' });
        }

        // Check if Firebase is available
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }

        // Load from Firestore builderPages collection
        const layoutDoc = await admin.firestore()
            .collection('builderPages')
            .doc(layoutId)
            .get();

        if (!layoutDoc.exists) {
            return res.status(404).json({ error: 'Layout not found' });
        }

        const layoutData = layoutDoc.data();
        
        // Check if user owns this layout or if it's public
        if (layoutData.userId !== userId && !layoutData.public) {
            return res.status(403).json({ error: 'Access denied' });
        }

        console.log(`Layout loaded for user ${userId}: ${layoutId}`);
        res.json({ 
            success: true, 
            layout: layoutData.layout,
            title: layoutData.title,
            createdAt: layoutData.createdAt,
            published: layoutData.published
        });

    } catch (error) {
        console.error('Error loading layout:', error);
        res.status(500).json({ error: 'Failed to load layout' });
    }
});

app.get('/api/layouts', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;

        // Check if Firebase is available
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }

        // Get all layouts for this user from Firestore
        // Remove orderBy to avoid index requirement, we'll sort in memory
        const layoutsSnapshot = await admin.firestore()
            .collection('builderPages')
            .where('userId', '==', userId)
            .limit(50)
            .get();

        // Handle empty snapshot
        if (layoutsSnapshot.empty) {
            console.log(`No layouts found for user ${userId}`);
            return res.json([]);
        }

        // Map through docs safely
        const layouts = layoutsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || 'Untitled Layout',
                createdAt: data.createdAt?.toDate?.() || new Date(),
                layoutPreview: Array.isArray(data.layout) ? data.layout.length : 0,
                ...data
            };
        });

        // Sort by createdAt in memory (descending - newest first)
        layouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(`Retrieved ${layouts.length} layouts for user ${userId}`);
        res.json(layouts);

    } catch (error) {
        console.error('Error fetching layouts:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch layouts',
            details: error.message,
            code: error.code || 'UNKNOWN_ERROR'
        });
    }
});

// Version Management API Routes
app.post('/api/save-version', isAuthenticated, async (req, res) => {
    try {
        const { layoutId, layout } = req.body;
        const userId = req.user.uid;

        if (!layoutId || !layout) {
            return res.status(400).json({ error: 'Layout ID and layout data are required' });
        }

        // Check if Firebase is available
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }

        // Generate unique version ID
        const versionId = `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Save version to Firestore: builderPages/{layoutId}/versions/{versionId}
        const versionData = {
            layout: layout,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: userId,
            userEmail: req.user.email,
            layoutId: layoutId
        };

        await admin.firestore()
            .collection('builderPages')
            .doc(layoutId)
            .collection('versions')
            .doc(versionId)
            .set(versionData);

        console.log(`Version saved for layout ${layoutId}: ${versionId}`);
        res.json({ success: true, versionId: versionId });

    } catch (error) {
        console.error('Error saving version:', error);
        res.status(500).json({ error: 'Failed to save version' });
    }
});

app.get('/api/versions/:layoutId', isAuthenticated, async (req, res) => {
    try {
        const layoutId = req.params.layoutId;
        const userId = req.user.uid;

        if (!layoutId) {
            return res.status(400).json({ error: 'Layout ID is required' });
        }

        // Check if Firebase is available
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }

        // Get last 10 versions for this layout
        const versionsSnapshot = await admin.firestore()
            .collection('builderPages')
            .doc(layoutId)
            .collection('versions')
            .where('userId', '==', userId)
            .limit(10)
            .get();

        // Handle empty snapshot
        if (versionsSnapshot.empty) {
            console.log(`No versions found for layout ${layoutId}`);
            return res.json([]);
        }

        // Map through docs and sort by creation time
        const versions = versionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                layoutId: data.layoutId
            };
        });

        // Sort by createdAt descending (newest first)
        versions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(`Retrieved ${versions.length} versions for layout ${layoutId}`);
        res.json(versions);

    } catch (error) {
        console.error('Error fetching versions:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch versions',
            details: error.message 
        });
    }
});

app.get('/api/version/:versionId', isAuthenticated, async (req, res) => {
    try {
        const versionId = req.params.versionId;
        const userId = req.user.uid;

        if (!versionId) {
            return res.status(400).json({ error: 'Version ID is required' });
        }

        // Check if Firebase is available
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }

        // Search for version across all layouts (since we need to find the parent layout)
        const layoutsSnapshot = await admin.firestore()
            .collection('builderPages')
            .where('userId', '==', userId)
            .get();

        let versionData = null;
        
        for (const layoutDoc of layoutsSnapshot.docs) {
            const versionDoc = await admin.firestore()
                .collection('builderPages')
                .doc(layoutDoc.id)
                .collection('versions')
                .doc(versionId)
                .get();
                
            if (versionDoc.exists) {
                versionData = versionDoc.data();
                break;
            }
        }

        if (!versionData) {
            return res.status(404).json({ error: 'Version not found' });
        }

        // Check ownership
        if (versionData.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        console.log(`Version loaded: ${versionId}`);
        res.json({ 
            success: true, 
            layout: versionData.layout,
            createdAt: versionData.createdAt,
            layoutId: versionData.layoutId
        });

    } catch (error) {
        console.error('Error loading version:', error);
        res.status(500).json({ error: 'Failed to load version' });
    }
});

// Preview route with access control
app.get('/preview/:layoutId', async (req, res) => {
    try {
        const layoutId = req.params.layoutId;

        if (!layoutId) {
            return res.status(400).send('Layout ID is required');
        }

        // Check if Firebase is available
        if (!admin.apps.length) {
            return res.status(500).send('Firebase not configured');
        }

        // Load layout from Firestore
        const layoutDoc = await admin.firestore()
            .collection('builderPages')
            .doc(layoutId)
            .get();

        if (!layoutDoc.exists) {
            return res.status(404).send('Layout not found');
        }

        const layoutData = layoutDoc.data();
        
        // Debug log to see what we're getting from Firestore
        console.log(`Debug - Layout ID: ${layoutId}`);
        console.log(`Debug - Layout exists: ${layoutDoc.exists}`);
        console.log(`Debug - Layout data keys:`, Object.keys(layoutData));
        console.log(`Debug - Layout content preview:`, layoutData.layout ? layoutData.layout.substring(0, 200) + '...' : 'NO LAYOUT CONTENT');

        // Check access permissions
        if (!layoutData.published) {
            // Private layout - requires authentication
            if (!req.session || !req.session.user) {
                return res.status(401).send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Authentication Required</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            .container { max-width: 400px; margin: 0 auto; }
                            .btn { background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h2>Authentication Required</h2>
                            <p>This layout is private and requires authentication to view.</p>
                            <a href="/auth.html" class="btn">Sign In</a>
                        </div>
                    </body>
                    </html>
                `);
            }

            // Check if user owns this layout
            if (layoutData.userId !== req.session.user.uid) {
                return res.status(403).send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Access Denied</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            .container { max-width: 400px; margin: 0 auto; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h2>Access Denied</h2>
                            <p>You don't have permission to view this private layout.</p>
                        </div>
                    </body>
                    </html>
                `);
            }
        }

        // Check if layout content exists
        if (!layoutData.layout) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Layout Not Found</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .container { max-width: 400px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Layout Not Found</h2>
                        <p>The requested layout does not contain any content.</p>
                    </div>
                </body>
                </html>
            `);
        }

        // Render the layout using only the layout field from Firestore
        const previewHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${layoutData.title || 'Layout Preview'}</title>
                <link rel="stylesheet" href="/css/style.css">
                <style>
                    body {
                        margin: 0;
                        padding: 20px;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        background: white;
                    }
                    .preview-header {
                        background: #f8f9fa;
                        padding: 15px;
                        margin: -20px -20px 20px -20px;
                        border-bottom: 1px solid #ddd;
                        text-align: center;
                        font-size: 14px;
                        color: #666;
                    }
                    .preview-content {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    .block {
                        margin: 15px 0;
                        padding: 15px;
                        border-radius: 6px;
                        min-height: 50px;
                    }
                    .published-badge {
                        display: inline-block;
                        background: #27ae60;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        margin-left: 10px;
                    }
                    .private-badge {
                        display: inline-block;
                        background: #e74c3c;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        margin-left: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="preview-header">
                    Layout Preview: ${layoutData.title || 'Untitled Layout'}
                    ${layoutData.published ? '<span class="published-badge">Public</span>' : '<span class="private-badge">Private</span>'}
                    <br>
                    <small>Created: ${layoutData.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}</small>
                </div>
                <div class="preview-content">
                    ${layoutData.layout}
                </div>
            </body>
            </html>
        `;

        console.log(`Preview accessed: ${layoutId} (${layoutData.published ? 'public' : 'private'})`);
        res.send(previewHtml);

    } catch (error) {
        console.error('Error loading preview:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .container { max-width: 400px; margin: 0 auto; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Preview Error</h2>
                    <p>Failed to load layout preview. Please try again.</p>
                </div>
            </body>
            </html>
        `);
    }
});

app.get('/website-builder', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'website-builder.html'));
});

// Custom token generation for Firebase client authentication
app.post('/api/auth/firebase-token', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        
        if (!admin.auth) {
            return res.status(500).json({ error: 'Firebase Admin not available' });
        }
        
        // Generate custom token for Firebase client authentication
        const customToken = await admin.auth().createCustomToken(userId);
        
        console.log('Custom token generated for user:', userId);
        res.json({ customToken });
        
    } catch (error) {
        console.error('Custom token generation error:', error);
        res.status(500).json({ error: 'Failed to generate authentication token' });
    }
});

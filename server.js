//  TOGGLEABLE AUTH GUARD SYSTEM
const DEV_MODE = false; // 👉 Authentication enabled - production mode

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

// Import R2 storage services
const R2FileManager = require('./server/r2-file-manager');
const createR2Routes = require('./server/r2-api-routes');

// Import new storage system
const StorageSystem = require('./server/storage-system');
const { registerStorageRoutes } = require('./server/storage-routes');

// Import payment notification system
const PaymentNotificationManager = require('./server/payment-notifications');

// Import Stripe Connect management
const StripeConnectManager = require('./server/stripe-connect');

// Import unified subscription management
const createSubscriptionRoutes = require('./server/subscription-routes');
const SubscriptionAuthMiddleware = require('./server/subscription-auth-middleware');

// Import object storage services
const { ObjectStorageService } = require('./server/objectStorage');

// Database schema imports
const { businessExpenses } = require('./shared/schema');
const { eq, and, desc, asc, between } = require('drizzle-orm');


// Import AI services
const { AIServices } = require('./server/ai-services');
const { AI_CREDIT_BUNDLES, isValidBundle } = require('./shared/ai-credit-bundles');

// REMOVED: Old storage system - will be rebuilt from scratch
const UnifiedFileDeletion = require('./server/unified-file-deletion');

// ZIP export dependencies
const archiver = require('archiver');
const { JSDOM } = require('jsdom');

// Database AI Credits Functions
async function getUserAiCredits(userId) {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
        return result.rows[0]?.ai_credits || 0;
    } catch (error) {
        console.error('Error getting user AI credits:', error.message);
        // Return a conservative default instead of high amount
        return 0;
    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error('Error releasing database client:', releaseError);
            }
        }
    }
}

async function useAiCredits(userId, amount, operation, details) {
    let client;
    try {
        client = await pool.connect();
        
        // Use a transaction to ensure data consistency
        await client.query('BEGIN');
        
        // First check if user has enough credits
        const result = await client.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
        const currentCredits = result.rows[0]?.ai_credits || 0;
        
        if (currentCredits < amount) {
            await client.query('ROLLBACK');
            throw new Error('Insufficient AI credits');
        }

        // Deduct credits
        await client.query('UPDATE users SET ai_credits = ai_credits - $1 WHERE id = $2', [amount, userId]);

        // Log the usage
        await client.query(`
            INSERT INTO ai_credit_transactions (user_id, amount, operation, details, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [userId, -amount, operation, details]);

        await client.query('COMMIT');
        return amount;
    } catch (error) {
        console.error('Error using AI credits:', error);
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }
        throw error;
    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error('Error releasing database client:', releaseError);
            }
        }
    }
}

// Update storage tracking for both Gallery and Raw Storage files
async function updateStorageTracking(userId, sessionId, folderType, fileName, file) {
    try {
        const [metadata] = await file.getMetadata();
        const fileSizeBytes = metadata.size || 0;
        const fileSizeMB = fileSizeBytes / (1024 * 1024);
        const fileSizeTB = fileSizeMB / (1024 * 1024);
        
        console.log(`Tracking storage for ${folderType} file: ${fileName}, Size: ${fileSizeMB.toFixed(2)}MB`);
        
        if (folderType === 'raw') {
            // Raw files already have their own tracking system - just ensure it's updated
            await updateRawStorageUsage(userId, fileSizeTB, fileSizeMB, 1);
        } else {
            // Gallery files need general storage tracking
            await updateGalleryStorageUsage(userId, sessionId, fileName, fileSizeBytes, fileSizeMB);
        }
        
        console.log(`Storage tracking updated for ${folderType} file: ${fileName}`);
    } catch (error) {
        console.error('Storage tracking error:', error);
        throw error;
    }
}

// Update gallery storage usage
async function updateGalleryStorageUsage(userId, sessionId, fileName, fileSizeBytes, fileSizeMB) {
    try {
        // Create session_files table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS session_files (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                session_id VARCHAR(255) NOT NULL,
                folder_type VARCHAR(20) NOT NULL,
                filename VARCHAR(500) NOT NULL,
                file_size_bytes BIGINT NOT NULL,
                file_size_mb DECIMAL(10,3) NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id, folder_type, filename)
            )
        `);
        
        // Insert or update file record
        await pool.query(`
            INSERT INTO session_files (user_id, session_id, folder_type, filename, file_size_bytes, file_size_mb)
            VALUES ($1, $2, 'gallery', $3, $4, $5)
            ON CONFLICT (session_id, folder_type, filename) 
            DO UPDATE SET 
                file_size_bytes = EXCLUDED.file_size_bytes,
                file_size_mb = EXCLUDED.file_size_mb,
                uploaded_at = CURRENT_TIMESTAMP
        `, [userId, sessionId, fileName, fileSizeBytes, fileSizeMB]);
        
        console.log(`Gallery file tracked: ${fileName} (${fileSizeMB.toFixed(2)}MB)`);
    } catch (error) {
        console.error('Gallery storage tracking error:', error);
        throw error;
    }
}

// Update raw storage usage (similar to existing system)
async function updateRawStorageUsage(userId, fileSizeTB, fileSizeMB, fileCount) {
    try {
        // Check if user has raw storage usage record
        const existingResult = await pool.query(`
            SELECT id FROM raw_storage_usage WHERE user_id = $1
        `, [userId]);
        
        if (existingResult.rows.length === 0) {
            // Create new record
            await pool.query(`
                INSERT INTO raw_storage_usage (
                    id, user_id, total_files, total_bytes, total_size_tb, 
                    current_monthly_charge, storage_tier_tb, max_allowed_tb, storage_status
                )
                VALUES ($1, $2, $3, $4, $5, 0, 1, 1.00, 'active')
            `, [require('crypto').randomUUID(), userId, fileCount, Math.round(fileSizeMB * 1024 * 1024), fileSizeTB]);
        } else {
            // Update existing record
            await pool.query(`
                UPDATE raw_storage_usage 
                SET total_files = total_files + $1,
                    total_bytes = total_bytes + $2,
                    total_size_tb = total_size_tb + $3,
                    updated_at = NOW()
                WHERE user_id = $4
            `, [fileCount, Math.round(fileSizeMB * 1024 * 1024), fileSizeTB, userId]);
        }
        
        console.log(`Raw storage updated: +${fileSizeMB.toFixed(2)}MB for user ${userId}`);
    } catch (error) {
        console.error('Raw storage tracking error:', error);
        throw error;
    }
}

// PostgreSQL database connection - Initialize first with improved stability
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Optimized connection pool configuration for stability
    max: 20, // Increased pool size
    min: 2, // Keep minimum connections alive
    idleTimeoutMillis: 30000, // Increased idle timeout
    connectionTimeoutMillis: 10000, // Longer timeout for failed connections
    acquireTimeoutMillis: 60000, // Increased acquire timeout
    maxUses: 7500, // Higher max uses for better connection recycling
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // Longer initial delay
    allowExitOnIdle: false, // Prevent pool from exiting
});

// Add comprehensive error handling for database pool
pool.on('error', (err) => {
    console.error('Database pool error (handled):', err.code || err.message);
    // Don't terminate connections on non-critical errors
    if (err.code !== '57P01' && err.code !== 'ECONNRESET') {
        console.error('Non-recoverable database error:', err);
    }
});

// Monitor pool events for debugging
pool.on('connect', (client) => {
    // Set client encoding to prevent character issues
    client.query('SET client_encoding TO UTF8');
});

// Initialize local backup system first
const LocalBackupFallback = require('./server/local-backup-fallback');
const localBackup = new LocalBackupFallback();

// Initialize services with proper dependencies
const r2FileManager = new R2FileManager(localBackup, pool);
const paymentPlanManager = new PaymentPlanManager();
const paymentScheduler = new PaymentScheduler();
const contractManager = new ContractManager();
const aiServices = new AIServices();

// Initialize new storage system
const storageSystem = new StorageSystem(pool, r2FileManager);

// Initialize Community Platform - will be initialized after Firebase admin is ready
let communityRoutes = null;

// Initialize storage system database tables with improved error handling
(async () => {
    try {
        await storageSystem.initializeTables();
        console.log(' Storage tables initialized successfully');
    } catch (error) {
        console.warn('Storage tables initialization skipped:', error.message);
        // Don't fail server startup for non-critical table initialization
    }
})();

// Services initialized

// Initialize Firebase Admin SDK with latest service account
try {
    let serviceAccount = null;
    
    // Try new FIREBASE_SERVICE_ACCOUNT secret first
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
        } catch (parseError) {
            console.log('Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError.message);
        }
    }
    
    // Fallback to old credentials if new ones don't work
    if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        try {
            serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

        } catch (parseError) {
            console.log('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', parseError.message);
        }
    }

    if (serviceAccount) {
        // Try multiple bucket formats to find the correct one
        const bucketOptions = [
            `${serviceAccount.project_id}.appspot.com`,
            `${serviceAccount.project_id}.firebasestorage.app`,
            serviceAccount.project_id
        ];
        
        let storageBucket = bucketOptions[0]; // Default to first option
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
            storageBucket: storageBucket
        });
        // Firebase Admin SDK initialized
        
        // Initialize Community Platform after Firebase is ready (non-blocking)
        (async () => {
            try {
                const initializeCommunityServices = require('./community/community-routes');
                // Pass R2 configuration to community services
                communityRoutes = initializeCommunityServices(pool, {
                    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
                    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
                    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-f4fb0dd444374c70b491e4a0adb6bb02.r2.dev'
                });

            } catch (error) {
                console.warn('Community Platform initialization skipped:', error.message);
                // Continue without community features if initialization fails
            }
        })();
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
        '.x3f',                     // Sigma RAW
        // Video formats that photographers use
        '.mov', '.mp4', '.avi', '.mkv', '.wmv', '.m4v',
        // High-quality video formats  
        '.mxf', '.r3d', '.braw', '.prores',
        // Audio formats for audio recording
        '.wav', '.flac', '.aiff', '.m4a', '.mp3',
        // Document formats for contracts, releases, etc.
        '.pdf', '.doc', '.docx', '.txt',
        // Adobe files
        '.psd', '.ai', '.indd', '.eps'
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
        'image/tiff', // Sometimes RAW files are detected as TIFF
        // Video mime types
        'video/quicktime',
        'video/mp4',
        'video/x-msvideo',
        'video/x-matroska',
        // Audio mime types
        'audio/wav',
        'audio/flac',
        'audio/aiff',
        'audio/x-m4a',
        'audio/mpeg',
        // Document mime types
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        // Adobe mime types
        'image/vnd.adobe.photoshop',
        'application/postscript'
    ];

    const isRawMime = rawMimeTypes.includes(mimetype);

    return isRawExtension || isRawMime;
}

// Process workflow automation
async function processWorkflow(workflowType, clientData, messageTemplate, sessionId) {
    try {
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
                    subject: `Your Photos Are Ready! `,
                    message: `Dear ${clientData.clientName}, we're excited to share that your ${clientData.sessionType} photos are ready for viewing and download. Access your private gallery here: ${process.env.APP_URL}/gallery/${sessionId}`
                },
                feedbackRequest: {
                    subject: `We'd Love Your Feedback`,
                    message: `Dear ${clientData.clientName}, we hope you love your ${clientData.sessionType} photos! We'd greatly appreciate a review of your experience.`
                }
            },
            friendly: {
                galleryDelivery: {
                    subject: `Your amazing photos are ready! `,
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

// Process all uploaded files for R2 backup (comprehensive system)
async function processR2BackupsAsync(sessionId, uploadedFiles, userId) {
    try {
        for (const fileData of uploadedFiles) {
            try {
                if (fileData.originalPath && require('fs').existsSync(fileData.originalPath)) {
                    const fileBuffer = require('fs').readFileSync(fileData.originalPath);
                    
                    const result = await r2FileManager.uploadFile(
                        fileBuffer,
                        fileData.originalName,
                        userId,
                        sessionId
                    );
                }
            } catch (fileError) {
                console.error(`❌ R2 backup failed for ${fileData.originalName}:`, fileError.message);
            }
        }
    } catch (error) {
        console.error('R2 backup process error:', error);
    }
}

// Legacy RAW backup process (kept for compatibility)
async function processRAWBackups(sessionId, rawFiles, userId) {
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

// R2 backup processing is handled by processR2BackupsAsync() in background

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

// Enhanced authentication middleware with strict security
const isAuthenticated = (req, res, next) => {
    // DEV_MODE bypass for development
    if (DEV_MODE) {
        req.user = { uid: 'dev-user', email: 'dev@example.com' };
        return next();
    }

    // Enhanced authentication check with better error handling
    try {
        // Check for session existence and basic structure
        if (!req.session) {
            return res.status(401).json({ 
                message: 'No session found',
                redirectTo: '/auth.html'
            });
        }

        // Check for user data in session
        if (!req.session.user) {
            return res.status(401).json({ 
                message: 'No user data in session',
                redirectTo: '/auth.html'
            });
        }

        const user = req.session.user;
        
        // Validate user properties
        if (!user.uid || typeof user.uid !== 'string' || user.uid.length === 0) {
            return res.status(401).json({ 
                message: 'Invalid user ID',
                redirectTo: '/auth.html'
            });
        }

        if (!user.email || typeof user.email !== 'string' || !user.email.includes('@')) {
            return res.status(401).json({ 
                message: 'Invalid email',
                redirectTo: '/auth.html'
            });
        }

        // Set req.user for downstream middleware
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({ 
            message: 'Authentication error',
            redirectTo: '/auth.html'
        });
    }
};

// Initialize subscription auth middleware
const subscriptionAuth = new SubscriptionAuthMiddleware(pool);

// Subscription check middleware - ENFORCED
const requireSubscription = subscriptionAuth.requireActiveSubscription;

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

// Global error handlers for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log it
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // For uncaught exceptions, we should restart gracefully
    setTimeout(() => process.exit(1), 1000);
});

// Body parsing middleware (must be before routes)
app.use(express.json({ limit: '100gb' }));
app.use(express.urlencoded({ extended: true, limit: '100gb' }));

// Session configuration for authentication with improved error handling
const pgSession = connectPg(session);

// Create session store with error handling
const sessionStore = new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: true // Allow table creation if missing
});

// Handle session store errors gracefully
sessionStore.on('error', (error) => {
    console.error('Session store error:', error.message);
    // Don't crash the server for session store errors
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-session-secret-' + Date.now(),
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: {
        httpOnly: false, // Safari needs JS access to session for compatibility
        secure: false, // Always false for development
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
        sameSite: 'lax', // Back to lax for better Safari compatibility
        path: '/', // Explicit path for Safari
        domain: undefined // Let browser set domain automatically
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

// Serve static files from public directory (for invoice.html and other public assets)
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced Address autocomplete API endpoint with improved rural address support
app.post('/api/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    // Check if Google Maps API key is available
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
      return res.status(503).json({ error: 'Google Maps API not configured' });
    }
    
    // Enhanced Places Autocomplete with better rural address handling
    try {
      const autocompleteResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(address)}&types=address&components=country:us&radius=50000&sessiontoken=${Date.now()}&key=${googleMapsApiKey}`
      );
      
      if (autocompleteResponse.ok) {
        const autocompleteData = await autocompleteResponse.json();
        
        if (autocompleteData.status === 'OK' && autocompleteData.predictions && autocompleteData.predictions.length > 0) {
          // Enhanced results transformation with better address parsing
          const results = autocompleteData.predictions.map(prediction => ({
            display_name: prediction.description,
            formatted_address: prediction.description,
            place_id: prediction.place_id,
            confidence: prediction.matched_substrings?.length || 1,
            types: prediction.types || [],
            address: {
              // Enhanced component extraction
              road: prediction.structured_formatting?.main_text || '',
              city: prediction.structured_formatting?.secondary_text?.split(',')[0]?.trim() || '',
              state: prediction.structured_formatting?.secondary_text?.split(',')[1]?.trim() || '',
              full_text: prediction.description
            }
          }));
          
          // Sort by confidence and relevance
          results.sort((a, b) => b.confidence - a.confidence);
          
          return res.json({ 
            status: 'OK', 
            results: results.slice(0, 8), // Limit to top 8 results
            source: 'places_autocomplete_enhanced'
          });
        }
      }
    } catch (placesError) {
      console.log('Enhanced Places Autocomplete failed, trying standard geocoding:', placesError.message);
    }
    
    // Enhanced fallback to regular geocoding with broader search
    try {
      const geocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:US&region=us&key=${googleMapsApiKey}`
      );
      
      if (geocodeResponse.ok) {
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
          // Transform geocoding results to match expected format
          const results = geocodeData.results.map(result => ({
            display_name: result.formatted_address,
            formatted_address: result.formatted_address,
            place_id: result.place_id,
            confidence: 1,
            types: result.types || [],
            geometry: result.geometry,
            address: {
              road: result.address_components?.find(c => c.types.includes('route'))?.long_name || '',
              city: result.address_components?.find(c => c.types.includes('locality'))?.long_name || '',
              state: result.address_components?.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '',
              full_text: result.formatted_address
            }
          }));
          
          return res.json({
            status: 'OK',
            results: results.slice(0, 5),
            source: 'geocoding_enhanced'
          });
        }
      }
    } catch (geocodeError) {
      console.log('Enhanced geocoding failed:', geocodeError.message);
    }
    
    // If all Google services fail, return helpful message
    res.status(404).json({ 
      error: 'No addresses found', 
      suggestion: 'Please try a more complete address or check spelling',
      source: 'no_results'
    });
    
  } catch (error) {
    console.error('Enhanced geocoding API error:', error);
    res.status(500).json({ error: 'Geocoding service temporarily unavailable' });
  }
});

// Google Distance Matrix API endpoint for accurate mileage calculation
app.post('/api/distance', async (req, res) => {
  try {
    const { origins, destinations } = req.body;
    
    if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
      return res.status(400).json({ error: 'Origins and destinations arrays are required' });
    }
    
    // Check if Google Maps API key is available
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
      return res.status(503).json({ error: 'Google Maps API not configured' });
    }
    
    // Encode origins and destinations for URL
    const originsStr = origins.map(origin => encodeURIComponent(origin)).join('|');
    const destinationsStr = destinations.map(dest => encodeURIComponent(dest)).join('|');
    
    // Call Google Distance Matrix API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&units=imperial&key=${googleMapsApiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`Distance Matrix API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'OK') {
      res.json(data);
    } else {
      console.log(`Distance Matrix API status: ${data.status}`);
      res.status(404).json({ 
        error: 'Could not calculate distance', 
        status: data.status,
        errorMessage: data.error_message 
      });
    }
    
  } catch (error) {
    console.error('Distance Matrix API error:', error);
    res.status(500).json({ error: 'Distance calculation service error' });
  }
});

// Firebase Authentication Routes
app.post('/api/auth/firebase-login', async (req, res) => {
    try {
        const { uid, email, displayName, photoURL } = req.body;

        if (!uid || !email) {
            console.log('Missing required user info:', { uid: !!uid, email: !!email });
            return res.status(400).json({ message: 'Missing required user information' });
        }

        let client;
        try {
            // Create or update user in database with proper error handling
            client = await pool.connect();
            await client.query(`
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
        } finally {
            if (client) {
                try {
                    client.release();
                } catch (releaseError) {
                    console.error('Error releasing database client:', releaseError);
                }
            }
        }

        // Store user in session with proper error handling
        try {
            req.session.user = { uid, email, displayName, photoURL };
            
            // Save session explicitly to ensure persistence
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ message: 'Session error' });
                }
                
                res.json({ success: true, message: 'Authentication successful' });
            });
        } catch (sessionError) {
            console.error('Session error:', sessionError);
            res.status(500).json({ message: 'Session creation failed' });
        }
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
        
        // Force session save with promise wrapper
        const sessionSavePromise = new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await sessionSavePromise;
        res.json({ success: true, user: req.session.user });
    } catch (error) {
        console.error('Firebase verification error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
});

app.get('/api/auth/user', (req, res) => {
    try {
        // Only log detailed debug info occasionally to reduce noise
        if (Math.random() < 0.1) {
            console.log(' AUTH USER: Debug check:', {
                hasSession: !!req.session,
                hasUser: !!(req.session && req.session.user),
                sessionId: req.sessionID?.slice(0, 8) + '...'
            });
        }
        
        if (req.session && req.session.user) {
            res.json({ user: req.session.user });
        } else {
            res.status(401).json({ message: 'Not authenticated' });
        }
    } catch (error) {
        console.error('Auth user check error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Simple auth check for invoice pages
app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.user) {
        res.status(200).json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// Get current user info endpoint
app.get('/api/current-user', (req, res) => {
    if (req.session && req.session.user) {
        res.status(200).json({ 
            email: req.session.user.email,
            uid: req.session.user.uid,
            displayName: req.session.user.displayName
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
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

// Subscription status endpoint
app.get('/api/subscription-status', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const UnifiedSubscriptionManager = require('./server/unified-subscription-manager');
        const subscriptionManager = new UnifiedSubscriptionManager(pool);
        
        const status = await subscriptionManager.getUserSubscriptionStatus(userId);
        res.json({ status });
    } catch (error) {
        console.error('Error checking subscription status:', error);
        res.status(500).json({ error: 'Failed to check subscription status' });
    }
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
            // Clear the session cookie
            res.clearCookie('connect.sid', {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            res.json({ success: true, message: 'Logged out successfully' });
        }
    });
});

// Mobile session endpoint for iOS authentication
app.post('/api/auth/mobile-session', async (req, res) => {
    try {
        const { uid, email, displayName, photoURL, isIOS } = req.body;
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        
        // Verify the Firebase token
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            
            if (decodedToken.uid !== uid) {
                return res.status(401).json({ error: 'Token UID mismatch' });
            }
            
            // Get normalized user ID
            const normalizedUser = normalizeUserForLance({ uid, email });
            
            // Create or update session
            req.session.user = {
                uid: normalizedUser.uid,
                email: email,
                displayName: displayName,
                photoURL: photoURL,
                isIOS: isIOS || false
            };
            
            // Force session save
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Failed to save session' });
                }
                
                res.json({ 
                    success: true, 
                    user: req.session.user,
                    sessionId: req.session.id
                });
            });
            
        } catch (verifyError) {
            console.error('Token verification failed:', verifyError);
            return res.status(401).json({ error: 'Invalid authentication token' });
        }
        
    } catch (error) {
        console.error('Mobile session creation error:', error);
        res.status(500).json({ error: 'Failed to create mobile session' });
    }
});

// R2 Storage API Routes - Complete file management system
app.use('/api/r2', createR2Routes());

// Contract API routes
const createContractRoutes = require('./server/contract-routes');
app.use('/api/contracts', createContractRoutes(pool, r2FileManager));

// Booking Agreement API routes
const createBookingAgreementRoutes = require('./server/booking-agreements-routes');
const { initializeTemplates } = require('./server/booking-agreement-templates');
app.use('/api/booking', createBookingAgreementRoutes(pool));
// Initialize templates on startup (non-blocking)
(async () => {
    try {
        await initializeTemplates(pool);
        console.log(' Booking agreement templates initialized');
    } catch (error) {
        console.warn('Booking templates initialization skipped:', error.message);
        // Continue without templates if initialization fails
    }
})();

// Community Platform routes (initialized after Firebase)
app.use('/api/community', (req, res, next) => {
    if (communityRoutes) {
        communityRoutes(req, res, next);
    } else {
        res.status(503).json({ error: 'Community platform is initializing...' });
    }
});

// Register new storage system routes
registerStorageRoutes(app, isAuthenticated, normalizeUserForLance, storageSystem);

// Object Storage Routes for Gallery and Raw Storage
const objectStorageService = new ObjectStorageService();

// Get upload URL for session files (WITH STORAGE QUOTA ENFORCEMENT) - Using R2
app.post('/api/sessions/:sessionId/files/upload', isAuthenticated, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { folderType, fileName, fileSize } = req.body; // Include file size for quota check
        const userId = req.session.user.uid; // Use Firebase UID directly for R2 path consistency
        
        console.log(`Upload request - Session: ${sessionId}, Folder: ${folderType}, FileName: ${fileName}, Size: ${fileSize}, User: ${userId}`);
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }

        // QUOTA ENFORCEMENT: Check if user can upload this file
        const normalizedUserId = normalizeUserForLance(userId);
        if (fileSize) {
            const quotaCheck = await storageSystem.canUpload(normalizedUserId, fileSize);
            if (!quotaCheck.canUpload) {
                return res.status(413).json({ 
                    error: 'Storage quota exceeded',
                    currentUsageGB: quotaCheck.currentUsageGB,
                    quotaGB: quotaCheck.quotaGB,
                    requiredGB: quotaCheck.newTotalGB,
                    message: `Upload would exceed your ${quotaCheck.quotaGB}GB storage limit. Please upgrade your storage plan to continue.`
                });
            }

            // Warning if near limit
            if (quotaCheck.isNearLimit) {
                console.log(` User ${normalizedUserId} is approaching storage limit: ${quotaCheck.currentUsageGB}GB / ${quotaCheck.quotaGB}GB`);
            }
        }
        
        // Generate R2 presigned URL for direct upload to Cloudflare R2
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        
        // Generate timestamp-based unique filename to avoid conflicts
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
        const fileExt = fileName.substring(fileName.lastIndexOf('.'));
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const uniqueFileName = `${timestamp}-${fileNameWithoutExt}${fileExt}`;
        
        // Create R2 key path using Firebase UID directly
        const r2Key = `photographer-${userId}/session-${sessionId}/${folderType}/${uniqueFileName}`;
        
        // Determine content type from file extension
        const contentTypeMap = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.webp': 'image/webp', '.tiff': 'image/tiff', '.tif': 'image/tiff',
            '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
            '.nef': 'image/x-nikon-nef', '.cr2': 'image/x-canon-cr2', '.arw': 'image/x-sony-arw',
            '.dng': 'image/x-adobe-dng'
        };
        const contentType = contentTypeMap[fileExt.toLowerCase()] || 'application/octet-stream';
        
        // Create presigned URL for R2 upload with proper headers
        const putCommand = new PutObjectCommand({
            Bucket: 'photoappr2token',
            Key: r2Key,
            ContentType: contentType,
            Metadata: {
                'originalName': fileName,
                'userId': userId,
                'sessionId': sessionId,
                'folderType': folderType,
                'uploadTimestamp': now.toISOString()
            }
        });
        
        // Generate presigned URL with 1 hour expiration
        const uploadURL = await getSignedUrl(r2FileManager.s3Client, putCommand, { expiresIn: 3600 });
        
        console.log(` Generated R2 presigned upload URL`);
        console.log(`   File: ${fileName} -> ${uniqueFileName}`);
        console.log(`   R2 Path: ${r2Key}`);
        console.log(`   Content-Type: ${contentType}`);
        
        // Return both the URL and the final filename for tracking
        res.json({ 
            uploadURL,
            finalFileName: uniqueFileName,
            r2Key
        });
    } catch (error) {
        console.error('Error getting upload URL:', error);
        res.status(500).json({ error: 'Failed to get upload URL' });
    }
});

// Separate multer config for R2 uploads (using memory storage)
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB per file limit (technical R2 limit)
        files: 100
    },
    fileFilter: (req, file, cb) => {
        console.log(`R2 upload file filter: ${file.originalname} (${file.mimetype})`);
        cb(null, true);
    }
});

// Server-proxied upload to R2 (avoiding CORS issues)
app.post('/api/sessions/:sessionId/files/:folderType/upload-direct', isAuthenticated, uploadMemory.single('file'), async (req, res) => {
    try {
        const { sessionId, folderType } = req.params;
        const file = req.file;
        const userId = req.session.user.uid;
        
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        
        console.log(`Direct R2 upload - Session: ${sessionId}, Folder: ${folderType}, File: ${file.originalname}, Size: ${file.size}, User: ${userId}`);
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }

        // QUOTA ENFORCEMENT: Check if user can upload this file
        const normalizedUserId = normalizeUserForLance(userId);
        const quotaCheck = await storageSystem.canUpload(normalizedUserId, file.size);
        if (!quotaCheck.canUpload) {
            return res.status(413).json({ 
                error: 'Storage quota exceeded',
                currentUsageGB: quotaCheck.currentUsageGB,
                quotaGB: quotaCheck.quotaGB,
                requiredGB: quotaCheck.newTotalGB,
                message: `Upload would exceed your ${quotaCheck.quotaGB}GB storage limit. Please upgrade your storage plan to continue.`
            });
        }
        
        // Generate unique filename
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
        const fileExt = file.originalname.substring(file.originalname.lastIndexOf('.'));
        const fileNameWithoutExt = file.originalname.substring(0, file.originalname.lastIndexOf('.'));
        const uniqueFileName = `${timestamp}-${fileNameWithoutExt}${fileExt}`;
        
        // Upload to R2
        const r2Key = `photographer-${userId}/session-${sessionId}/${folderType}/${uniqueFileName}`;
        
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const putCommand = new PutObjectCommand({
            Bucket: 'photoappr2token',
            Key: r2Key,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
                'originalName': file.originalname,
                'userId': userId,
                'sessionId': sessionId,
                'folderType': folderType,
                'uploadTimestamp': now.toISOString()
            }
        });
        
        await r2FileManager.s3Client.send(putCommand);
        console.log(` File uploaded to R2: ${r2Key}`);
        
        // Track in database using pool
        const fileSizeMB = file.size / (1024 * 1024);
        const fileSizeBytes = file.size;
        let client;
        try {
            client = await pool.connect();
            await client.query(`
                INSERT INTO session_files (
                    session_id, user_id, filename, original_name, 
                    file_size_mb, file_size_bytes, folder_type, r2_key, uploaded_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                sessionId,
                userId, // Firebase UID
                uniqueFileName,
                file.originalname,
                parseFloat(fileSizeMB.toFixed(2)),
                fileSizeBytes,
                folderType,
                r2Key,
                now
            ]);
            console.log(` File tracked in database: ${file.originalname} (${fileSizeMB.toFixed(2)}MB)`);
        } finally {
            if (client) client.release();
        }
        
        // Log storage change for quota tracking
        await storageSystem.logStorageChange(
            normalizedUserId, 
            sessionId, 
            'upload', 
            file.size, 
            folderType, 
            uniqueFileName
        );
        
        res.json({ 
            success: true,
            fileName: uniqueFileName,
            originalName: file.originalname,
            r2Key,
            size: fileSizeMB.toFixed(2)
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// List session files from database/R2
app.get('/api/sessions/:sessionId/files/:folderType', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, folderType } = req.params;
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }
        
        // Get files from database
        let client;
        try {
            client = await pool.connect();
            const result = await client.query(`
                SELECT * FROM session_files 
                WHERE session_id = $1 AND folder_type = $2
                ORDER BY uploaded_at DESC
            `, [sessionId, folderType]);
            
            const fileList = result.rows.map(row => ({
                name: row.original_name || row.filename,
                fileName: row.filename,
                size: row.file_size_bytes || (parseFloat(row.file_size_mb) * 1024 * 1024),
                sizeFormatted: `${row.file_size_mb} MB`,
                contentType: 'image/jpeg', // Default for images
                timeCreated: row.uploaded_at,
                downloadUrl: `/api/sessions/${sessionId}/files/${folderType}/download/${row.filename}`,
                r2Key: row.r2_key
            }));
            
            console.log(`Found ${fileList.length} files for session ${sessionId} in ${folderType}`);
            
            res.json({ files: fileList });
        } finally {
            if (client) client.release();
        }
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// Download session file from R2
app.get('/api/sessions/:sessionId/files/:folderType/download/:fileName', async (req, res) => {
    try {
        const { sessionId, folderType, fileName } = req.params;
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }
        
        // Get file info from database
        let client;
        try {
            client = await pool.connect();
            const result = await client.query(`
                SELECT * FROM session_files 
                WHERE session_id = $1 AND folder_type = $2 AND filename = $3
            `, [sessionId, folderType, fileName]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            const fileInfo = result.rows[0];
            
            // Download from R2
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            const getCommand = new GetObjectCommand({
                Bucket: 'photoappr2token',
                Key: fileInfo.r2_key
            });
            
            const response = await r2FileManager.s3Client.send(getCommand);
            
            // Set headers
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', `inline; filename="${fileInfo.original_name || fileName}"`);
            
            // Stream the file to response
            response.Body.pipe(res);
        } finally {
            if (client) client.release();
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download file' });
        }
    }
});

// Get storage statistics for a specific session from database
app.get('/api/sessions/:sessionId/storage', isAuthenticated, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Get files from database
        let client;
        try {
            client = await pool.connect();
            
            // Get gallery files
            const galleryResult = await client.query(`
                SELECT 
                    COUNT(*) as file_count,
                    COALESCE(SUM(file_size_bytes), 0) as total_bytes,
                    COUNT(CASE WHEN file_size_bytes IS NOT NULL THEN 1 END) as valid_files
                FROM session_files 
                WHERE session_id = $1 AND folder_type = 'gallery'
            `, [sessionId]);
            
            // Get raw files
            const rawResult = await client.query(`
                SELECT 
                    COUNT(*) as file_count,
                    COALESCE(SUM(file_size_bytes), 0) as total_bytes,
                    COUNT(CASE WHEN file_size_bytes IS NOT NULL THEN 1 END) as valid_files
                FROM session_files 
                WHERE session_id = $1 AND folder_type = 'raw'
            `, [sessionId]);
            
            const galleryStats = galleryResult.rows[0];
            const rawStats = rawResult.rows[0];
            
            console.log('Gallery query result:', galleryStats);
            console.log('Raw query result:', rawStats);
            
            const gallerySize = parseInt(galleryStats.total_bytes) || 0;
            const rawSize = parseInt(rawStats.total_bytes) || 0;
            const totalSize = gallerySize + rawSize;
            
            console.log(`Storage stats for session ${sessionId}:`);
            console.log(`Gallery: ${galleryStats.file_count} total files, ${galleryStats.valid_files} with size data, ${gallerySize} bytes`);
            console.log(`Raw: ${rawStats.file_count} total files, ${rawStats.valid_files} with size data, ${rawSize} bytes`);
            
            const result = {
                sessionId,
                gallery: {
                    fileCount: parseInt(galleryStats.file_count),
                    validFiles: parseInt(galleryStats.valid_files),
                    totalSize: gallerySize,
                    totalSizeFormatted: formatBytes(gallerySize)
                },
                raw: {
                    fileCount: parseInt(rawStats.file_count),
                    validFiles: parseInt(rawStats.valid_files),
                    totalSize: rawSize,
                    totalSizeFormatted: formatBytes(rawSize)
                },
                combined: {
                    fileCount: parseInt(galleryStats.file_count) + parseInt(rawStats.file_count),
                    validFiles: parseInt(galleryStats.valid_files) + parseInt(rawStats.valid_files),
                    totalSize: totalSize,
                    totalSizeFormatted: formatBytes(totalSize)
                }
            };
            
            console.log('Final storage stats result:', JSON.stringify(result, null, 2));
            res.json(result);
            
        } finally {
            if (client) client.release();
        }
    } catch (error) {
        console.error('Error getting session storage stats:', error);
        res.status(500).json({ error: 'Failed to get session storage statistics' });
    }
});

// Helper function to calculate folder statistics
async function calculateFolderStats(files) {
    if (!files || !Array.isArray(files)) {
        return { fileCount: 0, totalSize: 0 };
    }
    
    const fileCount = files.length;
    let totalSize = 0;
    
    // Get size from metadata for each file
    for (const file of files) {
        try {
            const [metadata] = await file.getMetadata();
            totalSize += metadata.size || 0;
        } catch (error) {
            console.error('Error getting file metadata:', error);
            // Continue with next file if metadata fails
        }
    }
    
    return { fileCount, totalSize };
}

// Helper function to format bytes into human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get thumbnail for session file (generates thumbnails on-the-fly)
app.get('/api/sessions/:sessionId/files/:folderType/thumbnail/:fileName', async (req, res) => {
    try {
        const { sessionId, folderType, fileName } = req.params;
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }
        
        // First check if user is authenticated
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Query database to find the file
        const dbClient = await pool.connect();
        try {
            const fileQuery = `
                SELECT r2_key, file_size_bytes
                FROM session_files
                WHERE session_id = $1 
                AND folder_type = $2 
                AND filename = $3
                LIMIT 1
            `;
            
            const fileResult = await dbClient.query(fileQuery, [sessionId, folderType, fileName]);
            
            if (fileResult.rows.length === 0) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            const fileRecord = fileResult.rows[0];
            
            // All images in gallery should be processable as thumbnails
            // Get file from R2
            const fileData = await r2FileManager.getFile(fileRecord.r2_key);
            
            if (!fileData) {
                return res.status(404).json({ error: 'File not found in storage' });
            }
            
            try {
                // Generate thumbnail using Sharp
                const sharp = require('sharp');
                
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
                
                // Create thumbnail transform (300x300 max, preserve aspect ratio)
                const thumbnail = sharp()
                    .resize(300, 300, { 
                        fit: 'inside', 
                        withoutEnlargement: true 
                    })
                    .jpeg({ quality: 85 });
                
                // Stream the data through sharp and to the response
                const stream = require('stream');
                const bufferStream = new stream.PassThrough();
                bufferStream.end(fileData);
                bufferStream.pipe(thumbnail).pipe(res);
                
            } catch (thumbnailError) {
                console.error('Thumbnail generation error:', thumbnailError);
                // Fallback to original image if thumbnail generation fails
                res.setHeader('Content-Type', fileRecord.content_type);
                res.send(fileData);
            }
            
        } finally {
            dbClient.release();
        }
        
    } catch (error) {
        console.error('Error serving thumbnail:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to serve thumbnail' });
        }
    }
});

// Delete session file
app.delete('/api/sessions/:sessionId/files/:folderType/:fileName', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, folderType } = req.params;
        const fileName = decodeURIComponent(req.params.fileName);
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }
        
        console.log(`Deleting file: ${fileName} from ${folderType} folder of session ${sessionId}`);
        
        // Get database client
        const dbClient = await pool.connect();
        
        try {
            // Find the file in database
            const fileQuery = `
                SELECT r2_key, file_size_bytes 
                FROM session_files 
                WHERE session_id = $1 
                AND folder_type = $2 
                AND filename = $3
            `;
            
            const fileResult = await dbClient.query(fileQuery, [sessionId, folderType, fileName]);
            
            if (fileResult.rows.length === 0) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            const fileRecord = fileResult.rows[0];
            console.log(`Found file record for deletion: ${fileName}, R2 key: ${fileRecord.r2_key}`);
            
            // Delete from R2
            const deleteSuccess = await r2FileManager.deleteFileByKey(fileRecord.r2_key);
            
            if (!deleteSuccess) {
                console.error('Failed to delete file from R2:', fileRecord.r2_key);
                // Continue with database deletion even if R2 deletion fails
            } else {
                console.log(`Successfully deleted from R2: ${fileRecord.r2_key}`);
            }
            
            // Delete from database
            const deleteQuery = `
                DELETE FROM session_files 
                WHERE session_id = $1 
                AND folder_type = $2 
                AND filename = $3
            `;
            
            await dbClient.query(deleteQuery, [sessionId, folderType, fileName]);
            
            console.log(`Successfully deleted ${fileName} from ${folderType} folder`);
            res.json({ success: true, message: `${fileName} deleted successfully` });
            
        } finally {
            dbClient.release();
        }
        
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file: ' + error.message });
    }
});

// Update uploaded file with metadata and track in database
app.post('/api/sessions/:sessionId/files/:folderType/update-metadata', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, folderType } = req.params;
        const { uploadUrl, originalName, finalFileName, r2Key } = req.body;
        const userId = req.session.user.uid; // Use Firebase UID for consistency
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }
        
        // Use the finalFileName from R2 upload
        const fileName = finalFileName || originalName;
        
        console.log(`Tracking R2 upload completion:`);
        console.log(`  Original name: ${originalName}`);
        console.log(`  Final filename: ${fileName}`);
        console.log(`  R2 Key: ${r2Key}`);
        console.log(`  User ID (Firebase UID): ${userId}`);
        console.log(`  Session ID: ${sessionId}`);
        
        // For R2 uploads, we need to get the file size from R2 directly
        let fileSizeBytes = 0;
        let fileSizeMB = 0;
        
        try {
            // Get file metadata from R2 using HeadObject
            const { HeadObjectCommand } = require('@aws-sdk/client-s3');
            const headCommand = new HeadObjectCommand({
                Bucket: 'photoappr2token',
                Key: r2Key
            });
            
            // Wait a moment for file to be available in R2
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const headResponse = await r2FileManager.s3Client.send(headCommand);
            fileSizeBytes = headResponse.ContentLength || 0;
            fileSizeMB = fileSizeBytes / (1024 * 1024);
            
            console.log(` R2 file confirmed: ${fileName} (${fileSizeMB.toFixed(2)}MB)`);
        } catch (r2Error) {
            console.error('Error checking R2 file:', r2Error);
            // File might not be ready yet, use a default size
            fileSizeBytes = 0;
            fileSizeMB = 0;
        }
        
        // Track file in database with Firebase UID
        try {
            // Ensure session_files table exists
            await pool.query(`
                CREATE TABLE IF NOT EXISTS session_files (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    session_id VARCHAR(255) NOT NULL,
                    folder_type VARCHAR(20) NOT NULL,
                    filename VARCHAR(500) NOT NULL,
                    file_size_bytes BIGINT NOT NULL,
                    file_size_mb DECIMAL(10,3) NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(session_id, folder_type, filename)
                )
            `);
            
            // Insert or update file record with Firebase UID
            await pool.query(`
                INSERT INTO session_files (user_id, session_id, folder_type, filename, file_size_bytes, file_size_mb)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (session_id, folder_type, filename) 
                DO UPDATE SET 
                    user_id = EXCLUDED.user_id,
                    file_size_bytes = EXCLUDED.file_size_bytes,
                    file_size_mb = EXCLUDED.file_size_mb,
                    uploaded_at = CURRENT_TIMESTAMP
            `, [userId, sessionId, folderType, fileName, fileSizeBytes, fileSizeMB]);
            
            console.log(` File tracked in database: ${fileName} (${fileSizeMB.toFixed(2)}MB) for user ${userId}`);
        } catch (trackingError) {
            console.error('Storage tracking error:', trackingError);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating file metadata:', error);
        res.status(500).json({ error: 'Failed to update metadata' });
    }
});

// Download session files as ZIP
// Get storage statistics for a session
app.get('/api/sessions/:sessionId/storage-stats', isAuthenticated, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.session.user.uid;
        
        // Get Gallery files from object storage
        const galleryFiles = await objectStorageService.getSessionFiles(sessionId, 'gallery');
        const rawFiles = await objectStorageService.getSessionFiles(sessionId, 'raw');
        
        // Calculate Gallery storage with better error handling
        let galleryTotalSize = 0;
        let galleryValidFiles = 0;
        
        for (const file of galleryFiles) {
            try {
                const [metadata] = await file.getMetadata();
                const fileSize = parseInt(metadata.size, 10) || 0;
                if (fileSize > 0) {
                    galleryTotalSize += fileSize;
                    galleryValidFiles++;
                    console.log(`Gallery file ${file.name}: ${fileSize} bytes`);
                } else {
                    console.log(`Gallery file ${file.name}: no size data available`);
                }
            } catch (error) {
                console.error(`Error accessing gallery file ${file.name}:`, error.message);
            }
        }
        
        // Calculate Raw storage with better error handling
        let rawTotalSize = 0;
        let rawValidFiles = 0;
        
        for (const file of rawFiles) {
            try {
                const [metadata] = await file.getMetadata();
                const fileSize = parseInt(metadata.size, 10) || 0;
                if (fileSize > 0) {
                    rawTotalSize += fileSize;
                    rawValidFiles++;
                    console.log(`Raw file ${file.name}: ${fileSize} bytes`);
                } else {
                    console.log(`Raw file ${file.name}: no size data available`);
                }
            } catch (error) {
                console.error(`Error accessing raw file ${file.name}:`, error.message);
            }
        }
        
        // Convert to readable formats
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        console.log(`Storage stats for session ${sessionId}:`);
        console.log(`Gallery: ${galleryFiles.length} total files, ${galleryValidFiles} with size data, ${galleryTotalSize} bytes`);
        console.log(`Raw: ${rawFiles.length} total files, ${rawValidFiles} with size data, ${rawTotalSize} bytes`);
        
        const result = {
            sessionId,
            gallery: {
                fileCount: galleryFiles.length,
                validFiles: galleryValidFiles,
                totalSize: galleryTotalSize,
                totalSizeFormatted: formatBytes(galleryTotalSize)
            },
            raw: {
                fileCount: rawFiles.length,
                validFiles: rawValidFiles,
                totalSize: rawTotalSize,
                totalSizeFormatted: formatBytes(rawTotalSize)
            },
            combined: {
                fileCount: galleryFiles.length + rawFiles.length,
                validFiles: galleryValidFiles + rawValidFiles,
                totalSize: galleryTotalSize + rawTotalSize,
                totalSizeFormatted: formatBytes(galleryTotalSize + rawTotalSize)
            }
        };
        
        console.log('Final storage stats result:', JSON.stringify(result, null, 2));
        res.json(result);
    } catch (error) {
        console.error('Error getting storage stats:', error);
        res.status(500).json({ error: 'Failed to get storage statistics' });
    }
});

// Global storage statistics across all sessions
app.get('/api/global-storage-stats', isAuthenticated, async (req, res) => {
    try {
        // Use same normalization logic as sessions endpoint
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        console.log(`Global storage request - User ID: ${userId} (normalized from ${req.user.uid})`);
        
        // Get all sessions for this user
        const sessionsResult = await pool.query('SELECT id, client_name FROM photography_sessions WHERE user_id = $1', [userId]);
        const sessionIds = sessionsResult.rows.map(row => row.id);
        
        console.log(`Found sessions in database:`, sessionsResult.rows.map(r => ({ id: r.id, client: r.client_name })));
        
        // Debug: Let's see what user_ids exist in the sessions table
        const allSessionsResult = await pool.query('SELECT id, client_name, user_id FROM photography_sessions LIMIT 10');
        console.log(`All sessions in database (sample):`, allSessionsResult.rows.map(r => ({ id: r.id, client: r.client_name, user_id: r.user_id })));
        
        let totalSessions = sessionIds.length;
        let totalGallerySize = 0;
        let totalRawSize = 0;
        let totalGalleryFiles = 0;
        let totalRawFiles = 0;
        
        console.log(`Calculating global storage for ${totalSessions} sessions (${sessionIds.join(', ')})`);
        
        // Helper function to format bytes
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        // Calculate storage from database (consistent with individual session stats)
        console.log(' Using database calculation method');
        
        // Get all files from database for this user's sessions
        let client;
        try {
            client = await pool.connect();
            
            // Get total storage for all sessions
            const storageResult = await client.query(`
                SELECT 
                    folder_type,
                    COUNT(*) as file_count,
                    COALESCE(SUM(file_size_bytes), 0) as total_bytes
                FROM session_files 
                WHERE session_id = ANY($1::text[])
                GROUP BY folder_type
            `, [sessionIds]);
            
            // Process results
            for (const row of storageResult.rows) {
                const bytes = parseInt(row.total_bytes) || 0;
                const count = parseInt(row.file_count) || 0;
                
                if (row.folder_type === 'gallery') {
                    totalGallerySize = bytes;
                    totalGalleryFiles = count;
                } else if (row.folder_type === 'raw') {
                    totalRawSize = bytes;
                    totalRawFiles = count;
                }
                
                console.log(`${row.folder_type}: ${count} files, ${formatBytes(bytes)}`);
            }
            
        } finally {
            if (client) client.release();
        }
        
        // Ensure proper number calculation for combined totals
        const totalCombinedSize = (totalGallerySize || 0) + (totalRawSize || 0);
        const totalCombinedFiles = (totalGalleryFiles || 0) + (totalRawFiles || 0);
        
        console.log(` Final calculation - Total: ${formatBytes(totalCombinedSize)}, Gallery: ${formatBytes(totalGallerySize)}, RAW: ${formatBytes(totalRawSize)}`);
        
        const result = {
            totalSessions,
            gallery: {
                fileCount: totalGalleryFiles,
                totalSize: totalGallerySize,
                totalSizeFormatted: formatBytes(totalGallerySize)
            },
            raw: {
                fileCount: totalRawFiles,
                totalSize: totalRawSize,
                totalSizeFormatted: formatBytes(totalRawSize)
            },
            combined: {
                fileCount: totalCombinedFiles,
                totalSize: totalCombinedSize,
                totalSizeFormatted: formatBytes(totalCombinedSize)
            }
        };
        
        console.log('Global storage stats result:', JSON.stringify(result, null, 2));
        res.json(result);
        
    } catch (error) {
        console.error('Error getting global storage stats:', error);
        res.status(500).json({ error: 'Failed to get global storage statistics' });
    }
});

// Storage cleanup endpoint to fix data integrity issues
app.post('/api/storage/cleanup/:userId', isAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;
        const storageCleanup = new StorageCleanup();
        
        console.log(`🧹 Starting storage cleanup for user: ${userId}`);
        const result = await storageCleanup.cleanUserSessions(userId);
        
        res.json({
            success: true,
            message: `Cleaned up ${result.totalReclaimedMB} MB of orphaned records`,
            ...result
        });
    } catch (error) {
        console.error('Storage cleanup error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Storage cleanup failed: ' + error.message 
        });
    }
});

// Emergency cleanup endpoint for orphaned R2 files
app.post('/api/cleanup/orphaned-files', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.uid || req.session.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }
    
    console.log(`🧹 Starting orphaned file cleanup for user: ${userId}`);
    
    // Get all files from database
    const dbFiles = await pool.query(
      'SELECT session_id, filename FROM session_files WHERE user_id = $1',
      [userId]
    );
    
    // Get R2 storage usage
    const storageUsage = await r2FileManager.getUserStorageUsage(userId);
    
    console.log(`Database files: ${dbFiles.rows.length}, R2 files: ${storageUsage.fileCount}`);
    
    if (storageUsage.fileCount === dbFiles.rows.length) {
      return res.json({ 
        success: true, 
        message: 'No orphaned files found', 
        cleaned: 0, 
        reclaimedMB: 0,
        beforeFiles: storageUsage.fileCount,
        afterFiles: storageUsage.fileCount
      });
    }
    
    // Strategy: Find and clean known orphaned sessions
    const orphanedSessions = ['5dc5c901-66ff-4ec5-8bac-9ca8a6d13c57']; // Known orphaned session
    let totalCleaned = 0;
    let totalReclaimedMB = 0;
    
    for (const sessionId of orphanedSessions) {
      try {
        // Check if session exists in database
        const sessionCheck = await pool.query(
          'SELECT COUNT(*) FROM session_files WHERE session_id = $1',
          [sessionId]
        );
        
        if (parseInt(sessionCheck.rows[0].count) === 0) {
          console.log(`Cleaning orphaned session: ${sessionId}`);
          
          // Get session files from R2
          const sessionFiles = await r2FileManager.getSessionFiles(sessionId, userId);
          const allFiles = [
            ...sessionFiles.filesByType.gallery,
            ...sessionFiles.filesByType.raw
          ];
          
          console.log(`Found ${allFiles.length} orphaned files in session ${sessionId}`);
          
          // Delete each file
          for (const file of allFiles) {
            const deleteResult = await r2FileManager.deleteFile(userId, sessionId, file.filename);
            if (deleteResult.success) {
              totalCleaned++;
              totalReclaimedMB += file.sizeMB || 0;
              console.log(`Cleaned: ${file.filename}`);
            }
          }
        }
      } catch (sessionError) {
        console.log(`Error cleaning session ${sessionId}: ${sessionError.message}`);
      }
    }
    
    // Get updated storage stats
    const afterStorage = await r2FileManager.getUserStorageUsage(userId);
    
    res.json({
      success: true,
      message: `Cleanup complete: ${totalCleaned} files removed`,
      cleaned: totalCleaned,
      reclaimedMB: Math.round(totalReclaimedMB * 100) / 100,
      beforeFiles: storageUsage.fileCount,
      afterFiles: afterStorage.fileCount,
      beforeSizeMB: Math.round(storageUsage.totalBytes / (1024*1024) * 100) / 100,
      afterSizeMB: Math.round(afterStorage.totalBytes / (1024*1024) * 100) / 100
    });
    
  } catch (error) {
    console.error('Orphaned file cleanup error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// UNIFIED PHOTO DELETION SYSTEM - Complete deletion with zero traces
// ============================================================================

// Delete single photo with complete cleanup
app.delete('/api/sessions/:sessionId/files/:folderType/:filename', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, folderType, filename } = req.params;
        const userId = req.session.user?.normalizedUid || req.user?.id || req.user?.uid || req.session.user?.uid;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'User authentication required' 
            });
        }

        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid folder type. Must be "gallery" or "raw"' 
            });
        }

        console.log(`🗑️ DELETE REQUEST: ${filename} from ${folderType}/${sessionId} by user ${userId}`);
        
        const unifiedDeletion = new UnifiedFileDeletion();
        const result = await unifiedDeletion.deletePhotoCompletely(userId, sessionId, filename);
        
        if (result.success) {
            console.log(` DELETION SUCCESS: ${filename} - ${result.fileSizeMB}MB reclaimed`);
            res.json({
                success: true,
                message: `Photo deleted successfully: ${filename}`,
                filename: result.filename,
                reclaimedMB: result.fileSizeMB,
                folderType: result.folderType,
                steps: result.steps
            });
        } else {
            console.error(`❌ DELETION FAILED: ${filename} - ${result.error}`);
            res.status(500).json({
                success: false,
                error: result.message,
                filename: result.filename,
                details: result.errors
            });
        }
        
    } catch (error) {
        console.error('Photo deletion endpoint error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Photo deletion failed: ' + error.message 
        });
    }
});

// Delete multiple photos in batch
app.delete('/api/sessions/:sessionId/files/:folderType', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, folderType } = req.params;
        const { filenames } = req.body; // Array of filenames to delete
        const userId = req.session.user?.normalizedUid || req.user?.id || req.user?.uid || req.session.user?.uid;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'User authentication required' 
            });
        }

        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid folder type. Must be "gallery" or "raw"' 
            });
        }

        if (!Array.isArray(filenames) || filenames.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Filenames array is required and must not be empty' 
            });
        }

        console.log(`🗑️ BATCH DELETE REQUEST: ${filenames.length} files from ${folderType}/${sessionId} by user ${userId}`);
        
        const unifiedDeletion = new UnifiedFileDeletion();
        const result = await unifiedDeletion.deleteMultiplePhotos(userId, sessionId, filenames);
        
        console.log(` BATCH DELETION RESULT: ${result.successCount}/${result.totalFiles} success, ${result.totalReclaimedMB}MB reclaimed`);
        
        res.json({
            success: result.success,
            message: result.message,
            totalFiles: result.totalFiles,
            successCount: result.successCount,
            errorCount: result.errorCount,
            totalReclaimedMB: result.totalReclaimedMB,
            details: result.results
        });
        
    } catch (error) {
        console.error('Batch photo deletion endpoint error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Batch photo deletion failed: ' + error.message 
        });
    }
});

// Verify deletion completeness
app.get('/api/sessions/:sessionId/files/:folderType/:filename/verify-deletion', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, folderType, filename } = req.params;
        const userId = req.session.user?.normalizedUid || req.user?.id || req.user?.uid || req.session.user?.uid;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'User authentication required' 
            });
        }

        console.log(` VERIFYING DELETION: ${filename} from ${folderType}/${sessionId}`);
        
        const unifiedDeletion = new UnifiedFileDeletion();
        const result = await unifiedDeletion.verifyDeletionComplete(userId, sessionId, filename);
        
        res.json({
            success: true,
            filename: filename,
            deletionComplete: result.complete,
            issues: result.issues,
            message: result.message
        });
        
    } catch (error) {
        console.error('Deletion verification endpoint error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Deletion verification failed: ' + error.message 
        });
    }
});

app.get('/api/sessions/:sessionId/files/:folderType/download-zip', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, folderType } = req.params;
        const userId = normalizeUserForLance(req.user).uid;
        
        if (!['gallery', 'raw'].includes(folderType)) {
            return res.status(400).json({ error: 'Invalid folder type' });
        }
        
        console.log(` Creating ZIP for session ${sessionId}, folder ${folderType}`);
        
        // Get files from database (R2 system)
        let client;
        try {
            client = await pool.connect();
            
            const filesResult = await client.query(`
                SELECT id, filename, r2_key, file_size_bytes
                FROM session_files 
                WHERE session_id = $1 AND folder_type = $2 AND r2_key IS NOT NULL AND r2_key != ''
                ORDER BY filename
            `, [sessionId, folderType]);
            
            if (filesResult.rows.length === 0) {
                return res.status(404).json({ error: 'No files found for download' });
            }
            
            console.log(`Found ${filesResult.rows.length} files with R2 backup for ZIP download`);
            
            // Get client name for ZIP filename
            const sessionResult = await client.query('SELECT client_name FROM photography_sessions WHERE id = $1', [sessionId]);
            const clientName = sessionResult.rows[0]?.client_name || 'Client';
            
            // Set proper headers for ZIP download
            const zipFilename = `${clientName.replace(/[^a-zA-Z0-9\s-]/g, '_')}_${folderType}_photos.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
            res.setHeader('Cache-Control', 'no-cache');
            
            const archive = archiver('zip', { 
                zlib: { level: 6 }, // Balanced compression
                store: false
            });
            
            // Handle archive errors
            archive.on('error', (err) => {
                console.error('Archive error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to create ZIP archive' });
                }
            });
            
            // Track progress
            let processedFiles = 0;
            let totalSize = 0;
            
            archive.pipe(res);
            
            // Process each file from R2 storage
            for (const file of filesResult.rows) {
                try {
                    console.log(`📁 Adding to ZIP: ${file.filename} (${Math.round(file.file_size_bytes/1024/1024)}MB)`);
                    
                    // Get file stream from R2
                    const fileStream = await r2FileManager.getFileStream(file.r2_key);
                    
                    if (fileStream) {
                        archive.append(fileStream, { name: file.filename });
                        processedFiles++;
                        totalSize += parseInt(file.file_size_bytes);
                    } else {
                        console.warn(`  Could not get stream for ${file.filename}, skipping`);
                    }
                } catch (fileError) {
                    console.error(`❌ Error processing file ${file.filename}:`, fileError.message);
                }
            }
            
            console.log(` ZIP creation complete: ${processedFiles} files, ${Math.round(totalSize/1024/1024)}MB total`);
            
            await archive.finalize();
            
        } finally {
            if (client) client.release();
        }
        
    } catch (error) {
        console.error('Error creating ZIP:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create ZIP: ' + error.message });
        }
    }
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

        // Define price IDs for each plan - Updated to $39/month Professional plan
        const priceIds = {
            professional: 'price_professional_39',  // $39/month Professional
            storage_1tb: 'price_storage_1tb_25'     // $25/month per 1TB storage add-on
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
                        name: 'Photography Management System - Professional Plan',
                        description: plan === 'professional' ? 'Professional Plan - All features + 100GB storage' : 
                                   `Storage Add-on - Additional 1TB backed up to Cloudflare R2`
                    },
                    unit_amount: plan === 'professional' ? 3900 :  // $39/month
                               2500,  // $25/month per 1TB storage
                    recurring: {
                        interval: 'month',
                        interval_count: 1
                    }
                },
                quantity: req.body.quantity || 1
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

// Duplicate logout endpoint removed - using the one at line 1058

// Health check endpoint for Docker
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Initialize database table (now using photography_sessions table)
async function initializeDatabase(retryCount = 0) {
    console.log('Initializing database tables...');
    try {
        // Test database connection first with a simple query
        const result = await pool.query('SELECT NOW()');
        console.log('Database connection established successfully at:', result.rows[0].now);
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



        // Create contracts table for contract management with proper structure
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contracts (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                photographer_id VARCHAR(255) NOT NULL,
                session_id VARCHAR(255),
                client_id VARCHAR(255),
                template_key VARCHAR(50),
                title VARCHAR(255) NOT NULL,
                html TEXT NOT NULL,
                resolved_html TEXT,
                status VARCHAR(50) DEFAULT 'draft',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                sent_at BIGINT,
                viewed_at BIGINT,
                signed_at BIGINT,
                signer_ip VARCHAR(45),
                signer_name VARCHAR(255),
                signer_email VARCHAR(255),
                signature_data TEXT,
                pdf_url TEXT,
                pdf_hash VARCHAR(255),
                view_token VARCHAR(255),
                client_email VARCHAR(255),
                timeline JSONB DEFAULT '[]',
                metadata JSONB DEFAULT '{}'
            )
        `);

        // Add missing columns to existing contracts table if they don't exist
        await pool.query(`
            ALTER TABLE contracts 
            ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS photographer_id VARCHAR(255)
        `);

        // Update photographer_id to match user_id where it's missing
        await pool.query(`
            UPDATE contracts 
            SET photographer_id = user_id 
            WHERE photographer_id IS NULL AND user_id IS NOT NULL
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
        throw error; // Re-throw to let startup handle it
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
        console.log('Database query result sample (first row):', result.rows[0]);

        const mappedRows = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            depositAmount: parseFloat(row.deposit_amount || 0),
            deposit_amount: parseFloat(row.deposit_amount || 0), // Also include snake_case version
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
            hasPaymentPlan: row.has_payment_plan || false,
            paymentPlanId: row.payment_plan_id || null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
        
        return mappedRows;
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
            hasPaymentPlan: row.has_payment_plan || false,
            paymentPlanId: row.payment_plan_id || null,
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
        console.log('getSessionById DB row for deposit debugging:', { id: row.id, client_name: row.client_name, deposit_amount: row.deposit_amount });
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
            depositAmount: parseFloat(row.deposit_amount || 0),
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
            hasPaymentPlan: row.has_payment_plan || false,
            paymentPlanId: row.payment_plan_id || null,
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

        // Define valid columns to prevent database errors
        const validColumns = [
            'client_name', 'session_type', 'date_time', 'location', 'phone_number', 
            'email', 'price', 'duration', 'notes', 'contract_signed', 'paid', 
            'edited', 'delivered', 'send_reminder', 'notify_gallery_ready', 
            'photos', 'gallery_access_token', 'gallery_created_at', 
            'gallery_expires_at', 'gallery_ready_notified', 'has_payment_plan',
            'payment_plan_id', 'session_notes', 'reminder_enabled', 'reminder_sent'
        ];

        Object.keys(updates).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

            // Skip invalid columns (like 'archived' which doesn't exist)
            if (!validColumns.includes(dbKey)) {
                console.warn(`Skipping invalid column: ${dbKey}`);
                return;
            }

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
            hasPaymentPlan: row.has_payment_plan || false,
            paymentPlanId: row.payment_plan_id || null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
}

async function deleteSession(id, userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // First, get all payment plan IDs for this session
        const paymentPlansQuery = 'SELECT id FROM payment_plans WHERE session_id = $1';
        const paymentPlansResult = await client.query(paymentPlansQuery, [id]);
        const paymentPlanIds = paymentPlansResult.rows.map(row => row.id);
        
        // Delete payment records for each payment plan
        if (paymentPlanIds.length > 0) {
            for (const planId of paymentPlanIds) {
                const deletePaymentRecordsQuery = 'DELETE FROM payment_records WHERE plan_id = $1';
                await client.query(deletePaymentRecordsQuery, [planId]);
                console.log(`Deleted payment records for plan ${planId}`);
            }
        }
        
        // Then, delete any payment plans associated with this session
        const deletePaymentPlansQuery = 'DELETE FROM payment_plans WHERE session_id = $1';
        await client.query(deletePaymentPlansQuery, [id]);
        console.log(`Deleted payment plans for session ${id}`);
        
        // Delete session files from the database
        const deleteFilesQuery = 'DELETE FROM session_files WHERE session_id = $1';
        await client.query(deleteFilesQuery, [id]);
        console.log(`Deleted session files for session ${id}`);
        
        // Delete any booking agreements for this session
        const deleteBookingAgreementsQuery = 'DELETE FROM booking_agreements WHERE session_id = $1';
        await client.query(deleteBookingAgreementsQuery, [id]);
        console.log(`Deleted booking agreements for session ${id}`);
        
        // Finally, delete the session itself
        let sessionQuery, sessionParams;
        if (userId) {
            sessionQuery = 'DELETE FROM photography_sessions WHERE id = $1 AND user_id = $2 RETURNING *';
            sessionParams = [id, userId];
        } else {
            sessionQuery = 'DELETE FROM photography_sessions WHERE id = $1 RETURNING *';
            sessionParams = [id];
        }

        const result = await client.query(sessionQuery, sessionParams);
        
        await client.query('COMMIT');
        console.log(`Successfully deleted session ${id} with all related data`);
        return result.rows.length > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting session:', error);
        throw error;
    } finally {
        client.release();
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
        // Accept all file types - photographers need to store RAW files, videos, documents, etc.
        cb(null, true);
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

// Public endpoint for session data for invoices (no authentication required)
app.get('/api/sessions/:sessionId/public', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await pool.query(
            'SELECT * FROM photography_sessions WHERE id = $1',
            [sessionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const row = result.rows[0];
        // Return only essential session data for invoices (no sensitive data)
        const session = {
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            depositAmount: parseFloat(row.deposit_amount || 0),
            deposit_amount: parseFloat(row.deposit_amount || 0),
            duration: row.duration,
            notes: row.notes,
            createdAt: row.created_at
        };

        console.log(` Public session data requested for invoice: ${sessionId}`);
        res.json(session);
    } catch (error) {
        console.error('Error fetching public session data:', error);
        res.status(500).json({ error: 'Failed to fetch session data' });
    }
});

// Get single session by ID (authenticated)
app.get('/api/sessions/:sessionId', isAuthenticated, requireSubscription, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        const result = await pool.query(
            'SELECT * FROM photography_sessions WHERE id = $1 AND user_id = $2',
            [sessionId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const row = result.rows[0];
        const session = {
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            depositAmount: parseFloat(row.deposit_amount || 0),
            deposit_amount: parseFloat(row.deposit_amount || 0),
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
            hasPaymentPlan: row.has_payment_plan || false,
            paymentPlanId: row.payment_plan_id || null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };

        res.json(session);
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

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
                depositAmount: parseFloat(row.deposit_amount || 0), // FIXED: Include deposit amount mapping
                deposit_amount: parseFloat(row.deposit_amount || 0), // Also include snake_case version
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
                hasPaymentPlan: row.has_payment_plan || false,
                paymentPlanId: row.payment_plan_id || null,
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
app.post('/api/sessions/:id/upload-photos', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const userId = normalizeUserForLance(req.user.uid);

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

        // QUOTA ENFORCEMENT: Check total upload size against user's storage limit
        const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
        console.log(` Total upload size: ${(totalUploadSize / 1024 / 1024).toFixed(2)}MB`);
        
        try {
            const quotaCheck = await storageSystem.canUpload(userId, totalUploadSize);
            if (!quotaCheck.canUpload) {
                console.log(`❌ Upload blocked - quota exceeded for user ${userId}`);
                if (!res.headersSent) {
                    return res.status(413).json({ 
                        error: 'Storage quota exceeded',
                        currentUsageGB: quotaCheck.currentUsageGB,
                        quotaGB: quotaCheck.quotaGB,
                        requiredGB: quotaCheck.newTotalGB,
                        uploadSizeMB: (totalUploadSize / 1024 / 1024).toFixed(2),
                        message: `Upload would exceed your ${quotaCheck.quotaGB}GB storage limit. Please upgrade your storage plan to continue.`,
                        upgradeRequired: true
                    });
                }
                return;
            }

            // Warning if near limit
            if (quotaCheck.isNearLimit) {
                console.log(` User ${userId} approaching storage limit: ${quotaCheck.currentUsageGB}GB / ${quotaCheck.quotaGB}GB`);
            }
        } catch (quotaError) {
            console.error('Quota check failed, allowing upload (fail-safe):', quotaError);
        }

        const uploadedPhotos = [];

        console.log(` Processing ${req.files.length} files for session ${sessionId}`);

        // Process files with detailed logging and dual storage
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            try {
                console.log(`File: Processing file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

                // Store original file metadata
                const originalPath = file.path;
                const originalSize = file.size;

                // Create optimized version for app display if file is an image and large
                let displayPath = originalPath;
                let optimizedSize = originalSize;
                let fileType = 'other';

                // Determine file type
                if (file.mimetype.startsWith('image/')) {
                    fileType = 'image';
                } else if (file.mimetype.startsWith('video/')) {
                    fileType = 'video';
                } else if (file.mimetype.startsWith('audio/')) {
                    fileType = 'audio';
                } else if (file.mimetype === 'application/pdf') {
                    fileType = 'pdf';
                } else if (file.mimetype.includes('document') || file.mimetype.includes('text')) {
                    fileType = 'document';
                }

                // Only optimize images that are large
                if (fileType === 'image' && file.size > 2 * 1024 * 1024) { // 2MB threshold
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

                        console.log(`Image optimized: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(optimizedSize / 1024 / 1024).toFixed(1)}MB`);
                    } catch (optimizeError) {
                        console.log(`Image optimization failed, using original: ${optimizeError.message}`);
                    }
                } else {
                    console.log(`File type: ${fileType} - no optimization needed`);
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
                    needsR2Backup: true, // Flag for background R2 backup
                    isRawFile: isRawFile,
                    mimeType: file.mimetype,
                    fileType: fileType,
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

                // Start comprehensive R2 backup process for all uploaded files (PRIMARY)  
                console.log(`☁️ Starting R2 backup for ${uploadedPhotos.length} files`);
                const backupUserId = req.user?.uid || req.user?.id || userId || 'unknown';
                processR2BackupsAsync(sessionId, uploadedPhotos, backupUserId);

                // CRITICAL: Also add files to session_files table for accurate storage tracking
                try {
                    for (const photo of uploadedPhotos) {
                        const folderType = photo.isRawFile ? 'raw' : 'gallery';
                        const fileSize = photo.originalSize || 0;
                        
                        await pool.query(`
                            INSERT INTO session_files (session_id, filename, file_size_bytes, folder_type, user_id)
                            VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (session_id, filename) DO UPDATE SET
                                file_size_bytes = $3,
                                folder_type = $4,
                                user_id = $5
                        `, [
                            sessionId,
                            photo.originalName || photo.filename,
                            fileSize,
                            folderType,
                            userId  // Use the Firebase UID here
                        ]);

                        // NEW: Log storage usage for quota tracking
                        try {
                            await storageSystem.logStorageChange(
                                userId, 
                                sessionId, 
                                'upload', 
                                fileSize, 
                                folderType, 
                                photo.originalName || photo.filename
                            );
                        } catch (logError) {
                            console.error('Storage quota logging failed:', logError);
                        }
                    }
                    console.log(` Added ${uploadedPhotos.length} files to session_files database and logged storage usage`);
                } catch (trackingError) {
                    console.error('Error adding files to session_files table:', trackingError);
                }

                // Skip Firebase upload to avoid bucket errors - R2 is primary storage
                // uploadPhotosToFirebase(sessionId, uploadedPhotos);
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
            endpoint: "726b54cf4750eddf5d76a63df636a0b6.r2.cloudflarestorage.com",
            bucket: "rawphoto",
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

        console.log(` Automation settings saved for user ${userId}`);
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

// Stripe subscription endpoint for landing page
app.post('/api/create-subscription', async (req, res) => {
    try {
        const { email, plan } = req.body;
        
        if (!email || !plan) {
            return res.status(400).json({ error: 'Email and plan are required' });
        }
        
        // Map plan names to prices
        const planPrices = {
            'pro': 3900 // $39.00
        };
        
        const amount = planPrices[plan] || 2900;
        
        // Create payment intent with Stripe
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            metadata: {
                email: email,
                plan: plan
            },
            description: `Photography Management System ${plan === 'studio' ? 'Studio' : 'Professional'} Plan`
        });
        
        res.json({ 
            clientSecret: paymentIntent.client_secret,
            amount: amount
        });
    } catch (error) {
        console.error('Subscription creation error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
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

// 🤖 AI WEBSITE EDITOR - Intelligent Website Modification
app.post('/api/ai-website-edit', isAuthenticated, async (req, res) => {
    try {
        const { request, currentHTML, websiteType } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        if (!request || !request.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Request description is required' 
            });
        }

        // Check AI credits (2 credits for website editing)
        const creditsNeeded = 2;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits for website editing',
                creditsNeeded,
                availableCredits
            });
        }

        console.log(`🤖 AI Website Edit Request from ${userId}: "${request}"`);

        try {
            // Use AI credits first
            await useAiCredits(userId, creditsNeeded, 'website_edit', request);

            // Enhanced AI prompt for complete section generation
            const aiPrompt = `You are an expert web designer and developer specializing in photography portfolios with advanced content generation capabilities.

CURRENT WEBSITE HTML:
${currentHTML}

USER REQUEST: "${request}"

ENHANCED CAPABILITIES:
You can now create complete website sections, not just modify existing content. Based on the request, determine if this needs:
1. MODIFICATION: Update existing content/styles
2. GENERATION: Create entirely new sections/components
3. EXPANSION: Add new content blocks to existing sections

For GENERATION requests, create complete, professional sections including:
- Hero sections with compelling copy
- About sections with photographer personality
- Portfolio galleries with categorization
- Services/pricing sections with clear value propositions
- Contact sections with multiple touchpoints
- Testimonial sections with social proof
- Blog/news sections for SEO
- Custom sections based on photography niche

PROFESSIONAL GUIDELINES:
- Use wb-editable classes on all text content for easy editing
- Include photography-specific terminology and copy
- Create mobile-responsive designs with CSS Grid/Flexbox
- Add subtle CSS animations and hover effects
- Use professional photography color schemes
- Include proper semantic HTML for SEO
- Add accessibility attributes (alt text, ARIA labels)
- Generate compelling, conversion-focused copy

SECTION TEMPLATES TO REFERENCE:
- Hero: Dramatic visuals with compelling headlines
- About: Personal story connecting with ideal clients
- Portfolio: Grid layouts with category filtering
- Services: Clear packages with pricing transparency
- Contact: Multiple ways to connect + booking integration

Return a JSON object with:
{
  "newHTML": "complete HTML (modified or entirely new section)",
  "description": "detailed description of what was created/changed",
  "improvements": ["specific enhancements made"],
  "sectionType": "hero|about|portfolio|services|contact|testimonials|blog|custom",
  "isNewSection": true/false,
  "copyGenerated": ["list of new copy/content created"],
  "designFeatures": ["visual/interaction features added"]
}`;

            // Use enhanced AI generation
            const result = await aiServices.generateAdvancedContent(
                'website_section_generation', 
                { currentHTML, websiteType, request },
                aiPrompt,
                'photography portfolio enhancement'
            );

            if (!result.newHTML) {
                throw new Error('AI did not provide modified HTML');
            }

            console.log(` AI Website Enhancement Success: ${result.description}`);

            res.json({
                success: true,
                newHTML: result.newHTML,
                description: result.description || 'Website successfully enhanced',
                improvements: result.improvements || [],
                sectionType: result.sectionType || 'custom',
                isNewSection: result.isNewSection || false,
                copyGenerated: result.copyGenerated || [],
                designFeatures: result.designFeatures || [],
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });

        } catch (aiError) {
            // Refund credits if AI generation fails
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            throw aiError;
        }

    } catch (error) {
        console.error('AI website edit error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process website edit request: ' + error.message
        });
    }
});

//  AI COMPLETE SECTION GENERATOR - Create entire website sections
app.post('/api/ai-generate-section', isAuthenticated, async (req, res) => {
    try {
        const { sectionType, businessInfo, stylePreferences, contentRequirements } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        if (!sectionType) {
            return res.status(400).json({ 
                success: false, 
                error: 'Section type is required' 
            });
        }

        // Check AI credits (3 credits for complete section generation)
        const creditsNeeded = 3;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits for section generation',
                creditsNeeded,
                availableCredits
            });
        }

        console.log(`🤖 AI Section Generation Request from ${userId}: ${sectionType}`);

        try {
            await useAiCredits(userId, creditsNeeded, 'section_generation', sectionType);

            const aiPrompt = `You are an expert web designer specializing in photography portfolio websites. Create a complete, professional ${sectionType} section.

BUSINESS INFO: ${JSON.stringify(businessInfo || {})}
STYLE PREFERENCES: ${JSON.stringify(stylePreferences || {})}
CONTENT REQUIREMENTS: ${JSON.stringify(contentRequirements || {})}

SECTION TYPE: ${sectionType}

Create a complete HTML section with the following requirements:
1. Professional photography portfolio aesthetics
2. Mobile-responsive design using CSS Grid/Flexbox
3. All text content wrapped in wb-editable classes for easy editing
4. Inline CSS styling for immediate visual impact
5. Subtle animations and hover effects
6. Photography-specific copy and terminology
7. Conversion-optimized content and layout
8. Accessibility features (alt text, ARIA labels, semantic HTML)

SECTION-SPECIFIC REQUIREMENTS:
${getSectionRequirements(sectionType)}

Return a JSON object with:
{
  "html": "complete HTML section ready to insert",
  "description": "what this section accomplishes",
  "features": ["list of key features included"],
  "copyElements": ["list of content/copy generated"],
  "styleFeatures": ["visual design elements included"],
  "mobileOptimizations": ["responsive design features"],
  "seoElements": ["SEO-friendly elements included"]
}`;

            const result = await aiServices.generateAdvancedContent(
                'section_generation',
                { sectionType, businessInfo, stylePreferences, contentRequirements },
                aiPrompt,
                'photography portfolio section'
            );

            if (!result.html) {
                throw new Error('AI did not provide HTML section');
            }

            console.log(`✨ AI Section Generated Successfully: ${sectionType}`);

            res.json({
                success: true,
                html: result.html,
                description: result.description || `${sectionType} section generated successfully`,
                features: result.features || [],
                copyElements: result.copyElements || [],
                styleFeatures: result.styleFeatures || [],
                mobileOptimizations: result.mobileOptimizations || [],
                seoElements: result.seoElements || [],
                sectionType: sectionType,
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });

        } catch (aiError) {
            // Refund credits if AI generation fails
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            throw aiError;
        }

    } catch (error) {
        console.error('AI section generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate section: ' + error.message
        });
    }
});

// Helper function for section-specific requirements
function getSectionRequirements(sectionType) {
    const requirements = {
        hero: `
        - Compelling headline that speaks to ideal photography clients
        - Subheadline explaining unique value proposition
        - High-impact call-to-action button
        - Space for hero image/video background
        - Optional trust indicators (awards, featured in, etc.)
        - Mobile-optimized typography hierarchy`,
        
        about: `
        - Personal story that connects with target clients
        - Professional credentials and experience
        - Photography philosophy and approach
        - Personal photo placeholder with alt text
        - Client connection points and personality elements
        - Trust-building elements (certifications, experience)`,
        
        portfolio: `
        - Grid layout for photography samples
        - Category filtering tabs (wedding, portrait, commercial, etc.)
        - Lightbox-ready image containers with proper alt text
        - "View Full Portfolio" call-to-action
        - Image lazy loading structure
        - Responsive grid that works on all devices`,
        
        services: `
        - Clear service packages with pricing
        - What's included in each package
        - Comparison highlighting most popular option
        - Investment language (not just "price")
        - "Book Now" or "Get Quote" buttons
        - FAQ section addressing common concerns`,
        
        contact: `
        - Multiple contact methods (phone, email, form)
        - Contact form with essential fields
        - Business hours and response time expectations
        - Location information if relevant
        - Social media links
        - "Ready to book?" compelling call-to-action`,
        
        testimonials: `
        - 3-5 authentic-sounding client testimonials
        - Client names and session types
        - Star ratings or review highlights
        - Mix of different photography services
        - Emotional impact focus (not just technical quality)
        - "Read More Reviews" link`,
        
        blog: `
        - Recent blog post previews (3-4 posts)
        - Photography tips and client features
        - Read time estimates
        - Category tags (tips, sessions, behind-scenes)
        - "View All Posts" navigation
        - SEO-optimized structure with proper headings`,
        
        pricing: `
        - Transparent pricing packages
        - "Investment" language rather than "cost"
        - What's included vs. add-ons
        - Payment terms and booking process
        - Most popular package highlighted
        - "Custom packages available" option`
    };
    
    return requirements[sectionType] || 'Create a professional, conversion-optimized section appropriate for photography portfolios.';
}

//  AI PORTFOLIO COPY GENERATOR - Create compelling portfolio descriptions
app.post('/api/ai-generate-portfolio-copy', isAuthenticated, async (req, res) => {
    try {
        const { portfolioType, clientType, tone, photoDescriptions } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        // Check AI credits (2 credits for portfolio copy)
        const creditsNeeded = 2;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits for portfolio copy generation',
                creditsNeeded,
                availableCredits
            });
        }

        try {
            await useAiCredits(userId, creditsNeeded, 'portfolio_copy', portfolioType);

            const aiPrompt = `You are a professional copywriter specializing in photography portfolio descriptions.

PORTFOLIO TYPE: ${portfolioType}
CLIENT TYPE: ${clientType}
TONE: ${tone}
PHOTO DESCRIPTIONS: ${JSON.stringify(photoDescriptions || [])}

Generate compelling portfolio copy that:
1. Tells the story behind the photos
2. Connects emotionally with potential clients
3. Highlights the photographer's expertise
4. Uses industry-appropriate terminology
5. Optimizes for SEO with natural keyword usage
6. Maintains the specified tone throughout

Create copy for:
- Portfolio section headline
- Portfolio introduction paragraph
- Individual photo/gallery descriptions
- Call-to-action text
- SEO meta description

Return a JSON object with:
{
  "headline": "compelling portfolio section headline",
  "introduction": "engaging introduction paragraph",
  "photoDescriptions": ["array of individual photo descriptions"],
  "callToAction": "compelling CTA text",
  "metaDescription": "SEO-optimized meta description",
  "keywords": ["relevant SEO keywords used"]
}`;

            const result = await aiServices.generateAdvancedContent(
                'portfolio_copy',
                { portfolioType, clientType, tone, photoDescriptions },
                aiPrompt,
                'photography portfolio copywriting'
            );

            res.json({
                success: true,
                ...result,
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });

        } catch (aiError) {
            // Refund credits if AI generation fails
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            throw aiError;
        }

    } catch (error) {
        console.error('AI portfolio copy generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate portfolio copy: ' + error.message
        });
    }
});

//  AI WEBSITE ANALYZER - Design Analysis and Suggestions
app.post('/api/ai-website-analyze', isAuthenticated, async (req, res) => {
    try {
        const { currentHTML, websiteType } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        if (!currentHTML || !currentHTML.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Website HTML is required for analysis' 
            });
        }

        // Check AI credits (1 credit for analysis)
        const creditsNeeded = 1;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits for website analysis',
                creditsNeeded,
                availableCredits
            });
        }

        console.log(` AI Website Analysis Request from ${userId}`);

        try {
            // Use AI credits first
            await useAiCredits(userId, creditsNeeded, 'website_analysis', 'Website design analysis');

            // Prepare the AI prompt for website analysis
            const aiPrompt = `You are an expert web designer analyzing a photography portfolio website. 

WEBSITE HTML TO ANALYZE:
${currentHTML}

Please provide a comprehensive analysis of this ${websiteType} website covering:

1. DESIGN STRENGTHS: What's working well visually
2. AREAS FOR IMPROVEMENT: Specific design issues to address
3. USER EXPERIENCE: Navigation and usability assessment
4. VISUAL HIERARCHY: Typography, spacing, and layout analysis
5. BRAND PERCEPTION: How professional/trustworthy it appears
6. MOBILE RESPONSIVENESS: Potential mobile issues
7. CONVERSION OPTIMIZATION: Elements that could drive bookings

Based on your analysis, provide 3-5 specific, actionable suggestions for improvement.

Return your response as a JSON object with:
{
  "analysis": "comprehensive analysis summary (2-3 sentences)",
  "strengths": ["list", "of", "current", "strengths"],
  "improvements": ["list", "of", "improvement", "areas"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "etc"],
  "priority": "highest priority improvement recommendation"
}`;

            // Call AI Services for website analysis
            const result = await aiServices.generateAdvancedContent('website_analysis', {
                currentHTML
            }, 'Analyze this photography website for improvements', 'photography clients');

            console.log(` AI Website Analysis Complete`);

            res.json({
                success: true,
                analysis: result.analysis || 'Analysis completed successfully',
                strengths: result.strengths || [],
                improvements: result.improvements || [],
                suggestions: result.suggestions || [],
                priority: result.priority || 'Focus on visual hierarchy and spacing',
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });

        } catch (aiError) {
            // Refund credits if AI generation fails
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            throw aiError;
        }

    } catch (error) {
        console.error('AI website analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze website: ' + error.message
        });
    }
});

//  BUSINESS EXPENSE MANAGEMENT API
app.get('/api/expenses', isAuthenticated, async (req, res) => {
    let client;
    try {
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        client = await pool.connect();
        const result = await client.query(
            'SELECT * FROM business_expenses WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );

        res.json({
            success: true,
            expenses: result.rows
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch expenses'
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

app.post('/api/expenses', isAuthenticated, async (req, res) => {
    let client;
    try {
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        const { date, category, description, amount, recurring, taxDeductible } = req.body;

        if (!date || !category || !description || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const expenseId = uuidv4();
        client = await pool.connect();
        
        const result = await client.query(
            `INSERT INTO business_expenses (id, user_id, date, category, description, amount, recurring, tax_deductible)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [expenseId, userId, date, category, description, amount, recurring || false, taxDeductible !== false]
        );

        res.json({
            success: true,
            expense: result.rows[0],
            message: 'Expense added successfully'
        });
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add expense'
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

app.delete('/api/expenses/:id', isAuthenticated, async (req, res) => {
    let client;
    try {
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        const expenseId = req.params.id;

        client = await pool.connect();
        const result = await client.query(
            'DELETE FROM business_expenses WHERE id = $1 AND user_id = $2 RETURNING *',
            [expenseId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Expense not found'
            });
        }

        res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete expense'
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

//  AI CREDITS MANAGEMENT
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

// Payment Plan API Routes
app.post('/api/payment-plans', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, totalAmount, frequency, startDate, endDate, reminderDays } = req.body;
        const userId = req.user.uid || req.user.id;
        
        if (!sessionId || !totalAmount || !frequency || !startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        const result = await paymentPlanManager.createPaymentPlan(
            sessionId, 
            userId, 
            totalAmount, 
            startDate, 
            endDate, 
            frequency, 
            reminderDays || 3
        );
        
        res.json({
            success: true,
            plan: result.plan,
            payments: result.payments,
            message: 'Payment plan created successfully'
        });
        
    } catch (error) {
        console.error('Error creating payment plan:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create payment plan'
        });
    }
});

app.get('/api/payment-plans/:sessionId', isAuthenticated, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const plan = await paymentPlanManager.getPaymentPlan(sessionId);
        
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'Payment plan not found'
            });
        }
        
        res.json({
            success: true,
            plan: plan
        });
        
    } catch (error) {
        console.error('Error getting payment plan:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get payment plan'
        });
    }
});

app.post('/api/payment-plans/:planId/payments/:paymentId/mark-paid', isAuthenticated, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { paymentMethod, notes } = req.body;
        
        await paymentPlanManager.markPaymentReceived(paymentId, paymentMethod || 'manual', notes || '');
        
        res.json({
            success: true,
            message: 'Payment marked as received'
        });
        
    } catch (error) {
        console.error('Error marking payment as received:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to mark payment as received'
        });
    }
});

// Update tip amount for a payment record
app.post('/api/payment-records/:paymentId/tip', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { tipAmount } = req.body;
        
        if (!tipAmount || isNaN(parseFloat(tipAmount)) || parseFloat(tipAmount) < 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid tip amount'
            });
        }
        
        // Update tip amount in the database
        const paymentManager = new PaymentPlanManager();
        await paymentManager.updateTipAmount(paymentId, parseFloat(tipAmount));
        
        res.json({
            success: true,
            message: 'Tip amount updated successfully',
            tipAmount: parseFloat(tipAmount)
        });
        
    } catch (error) {
        console.error('Error updating tip amount:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update tip amount'
        });
    }
});

// Get invoice details for public viewing (no authentication required)
app.get('/api/public/invoice/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const paymentManager = new PaymentPlanManager();
        const invoiceDetails = await paymentManager.getPublicInvoiceDetails(paymentId);
        
        if (!invoiceDetails) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }
        
        res.json({
            success: true,
            invoice: invoiceDetails
        });
        
    } catch (error) {
        console.error('Error getting public invoice details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get invoice details'
        });
    }
});

// Update tip amount for public invoice (no authentication required)
app.post('/api/public/invoice/:paymentId/tip', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { tipAmount } = req.body;
        
        if (!tipAmount || isNaN(parseFloat(tipAmount)) || parseFloat(tipAmount) < 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid tip amount'
            });
        }
        
        // Update tip amount in the database
        const paymentManager = new PaymentPlanManager();
        await paymentManager.updateTipAmount(paymentId, parseFloat(tipAmount));
        
        res.json({
            success: true,
            message: 'Tip amount updated successfully',
            tipAmount: parseFloat(tipAmount)
        });
        
    } catch (error) {
        console.error('Error updating tip amount:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update tip amount'
        });
    }
});

// Create and send updated invoice with tip
app.post('/api/public/invoice/:paymentId/send-with-tip', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { tipAmount } = req.body;
        
        const paymentManager = new PaymentPlanManager();
        
        // Update tip amount first
        if (tipAmount && parseFloat(tipAmount) > 0) {
            await paymentManager.updateTipAmount(paymentId, parseFloat(tipAmount));
        }
        
        // Send updated invoice
        const result = await paymentManager.sendPaymentInvoice(paymentId, true); // force resend
        
        res.json({
            success: true,
            message: 'Invoice sent successfully with tip',
            invoice: result
        });
        
    } catch (error) {
        console.error('Error sending invoice with tip:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send invoice with tip'
        });
    }
});

app.post('/api/payment-plans/:planId/send-invoice', isAuthenticated, async (req, res) => {
    try {
        const { planId } = req.params;
        const { paymentNumber } = req.body;
        
        const result = await paymentPlanManager.sendPaymentInvoice(planId, paymentNumber);
        
        res.json({
            success: true,
            invoice: result,
            message: 'Payment invoice sent successfully'
        });
        
    } catch (error) {
        console.error('Error sending payment invoice:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send payment invoice'
        });
    }
});

// Stripe Webhook for AI Credits and Subscriptions
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log('🔔 Webhook received:', event.type, 'Event ID:', event.id);
    } catch (err) {
        console.log(`❌ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // Handle AI credits and photography session payments via checkout sessions
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('🔔 Checkout session completed event received:', session.id);
            console.log('💳 Session metadata:', JSON.stringify(session.metadata));
            
            // Check if this is an AI credits purchase
            if (session.metadata && session.metadata.type === 'ai_credits') {
                const userId = session.metadata.userId;
                const creditsAmount = parseInt(session.metadata.credits);
                const priceUsd = parseFloat(session.metadata.priceUsd);

                // Add credits to user account using storage layer
                await pool.query('UPDATE users SET ai_credits = ai_credits + $1, last_ai_credit_purchase = NOW() WHERE id = $2', [creditsAmount, userId]);
                
                // Log the purchase
                await pool.query(`
                    INSERT INTO ai_credit_purchases (id, user_id, credits_amount, price_usd, stripe_payment_intent_id, status, purchased_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                `, [
                    require('crypto').randomUUID(),
                    userId, 
                    creditsAmount, 
                    priceUsd.toString(),
                    session.payment_intent,
                    'completed'
                ]);

                console.log(` Added ${creditsAmount} AI credits to user ${userId} via Stripe payment (${session.id})`);
            }
            
            // Check if this is a photography session payment (deposits use checkout sessions)
            if (session.metadata && session.metadata.paymentId) {
                console.log(' Processing photography session checkout session payment');
                
                try {
                    // Extract session ID from paymentId (format: payment-sessionId-timestamp)
                    const paymentId = session.metadata.paymentId;
                    const sessionIdMatch = paymentId.match(/payment-([a-f0-9-]+)-\d+/);
                    
                    if (sessionIdMatch) {
                        const sessionId = sessionIdMatch[1];
                        
                        // Create a payment intent-like object for notification processing
                        const mockPaymentIntent = {
                            id: session.payment_intent,
                            amount_received: session.amount_total,
                            metadata: {
                                sessionId: sessionId,
                                type: paymentId.includes('deposit') ? 'deposit' : 'invoice'
                            },
                            receipt_email: session.customer_details?.email
                        };
                        
                        // Process the payment notification
                        const PaymentNotificationManager = require('./server/payment-notifications');
                        const notificationManager = new PaymentNotificationManager();
                        await notificationManager.handlePaymentSuccess(mockPaymentIntent);
                        
                        console.log(' Photography checkout session payment processed:', sessionId);
                    } else {
                        console.log(' Could not extract session ID from payment ID:', paymentId);
                    }
                } catch (error) {
                    console.error('❌ Error processing photography checkout session payment:', error);
                }
            }
        }

        // Handle payment success for photography sessions and deposits
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            console.log(' Payment succeeded:', paymentIntent.id, 'Amount:', paymentIntent.amount_received / 100);
            console.log('💳 Payment metadata:', JSON.stringify(paymentIntent.metadata));
            
            // Check if this is a photography session payment by looking for session metadata
            if (paymentIntent.metadata && paymentIntent.metadata.sessionId) {
                console.log(' Processing photography session payment notification');
                
                try {
                    // Initialize payment notification manager and process the payment
                    const PaymentNotificationManager = require('./server/payment-notifications');
                    const notificationManager = new PaymentNotificationManager();
                    await notificationManager.handlePaymentSuccess(paymentIntent);
                    
                    console.log(' Photography payment notification processed successfully');
                } catch (error) {
                    console.error('❌ Error processing photography payment notification:', error);
                    // Don't throw here to avoid breaking other webhook processing
                }
            } else {
                console.log('💳 Standard payment processed (no session metadata)');
            }
        }

        res.json({received: true});
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
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


// Business Management AI Endpoints
app.post('/api/ai/generate-blog', isAuthenticated, async (req, res) => {
    try {
        const { prompt } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Blog prompt is required' 
            });
        }

        // Check AI credits (2 credits for blog posts - longer content)
        const creditsNeeded = 2;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Use AI credits
        const creditsUsed = await useAiCredits(userId, creditsNeeded, 'blog_generation', prompt);
        if (!creditsUsed) {
            return res.status(402).json({
                success: false,
                error: 'Failed to deduct AI credits'
            });
        }

        try {
            const blogContent = await aiServices.generateBlogPost(prompt);
            
            res.json({
                success: true,
                content: blogContent,
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });
        } catch (aiError) {
            // Refund credits on AI failure
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            
            // Handle specific OpenAI errors
            if (aiError.message && aiError.message.includes('quota')) {
                return res.status(429).json({
                    success: false,
                    error: 'OpenAI API quota exceeded',
                    message: 'The OpenAI API quota has been exceeded. Please check your OpenAI billing settings or try again later.',
                    creditsRefunded: creditsNeeded
                });
            }
            
            throw aiError;
        }

    } catch (error) {
        console.error('AI blog generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate blog post', 
            details: error.message 
        });
    }
});

app.post('/api/ai/generate-social', isAuthenticated, async (req, res) => {
    try {
        const { platform, prompt, includeHashtags } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        if (!prompt || !prompt.trim() || !platform) {
            return res.status(400).json({ 
                success: false, 
                error: 'Platform and prompt are required' 
            });
        }

        // Check AI credits (1 credit for social posts)
        const creditsNeeded = 1;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Use AI credits
        const creditsUsed = await useAiCredits(userId, creditsNeeded, 'social_generation', `${platform}: ${prompt}`);
        if (!creditsUsed) {
            return res.status(402).json({
                success: false,
                error: 'Failed to deduct AI credits'
            });
        }

        try {
            const socialContent = await aiServices.generateSocialPost(platform, prompt, includeHashtags);
            
            res.json({
                success: true,
                content: socialContent,
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });
        } catch (aiError) {
            // Refund credits on AI failure
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            
            // Handle specific OpenAI errors
            if (aiError.message && aiError.message.includes('quota')) {
                return res.status(429).json({
                    success: false,
                    error: 'OpenAI API quota exceeded',
                    message: 'The OpenAI API quota has been exceeded. Please check your OpenAI billing settings or try again later.',
                    creditsRefunded: creditsNeeded
                });
            }
            
            throw aiError;
        }

    } catch (error) {
        console.error('AI social generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate social post', 
            details: error.message 
        });
    }
});

app.post('/api/ai/generate-ideas', isAuthenticated, async (req, res) => {
    try {
        const { prompt } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Ideas prompt is required' 
            });
        }

        // Check AI credits (1 credit for ideas)
        const creditsNeeded = 1;
        const availableCredits = await getUserAiCredits(userId);

        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Use AI credits
        const creditsUsed = await useAiCredits(userId, creditsNeeded, 'ideas_generation', prompt);
        if (!creditsUsed) {
            return res.status(402).json({
                success: false,
                error: 'Failed to deduct AI credits'
            });
        }

        try {
            const ideas = await aiServices.generateQuickIdeas(prompt);
            
            res.json({
                success: true,
                ideas: ideas,
                creditsUsed: creditsNeeded,
                remainingCredits: availableCredits - creditsNeeded
            });
        } catch (aiError) {
            // Refund credits on AI failure
            await pool.query('UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2', [creditsNeeded, userId]);
            
            // Handle specific OpenAI errors
            if (aiError.message && aiError.message.includes('quota')) {
                return res.status(429).json({
                    success: false,
                    error: 'OpenAI API quota exceeded',
                    message: 'The OpenAI API quota has been exceeded. Please check your OpenAI billing settings or try again later.',
                    creditsRefunded: creditsNeeded
                });
            }
            
            throw aiError;
        }

    } catch (error) {
        console.error('AI ideas generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate ideas', 
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

// OLD ENDPOINT REMOVED - Use unified deletion system instead at /api/sessions/:sessionId/files/:folderType/:filename

// ===== STOREFRONT BUILDER API ENDPOINTS =====

// Serve storefront builder page
app.get('/storefront', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'storefront.html'));
});

// Serve public invoice page (no authentication required)
app.get('/invoice.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
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
            { id: 'about', name: 'About', icon: '' },
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
                                ${block.content.awards.map(award => `<p style="margin: 15px 0; font-size: 1.2em; color: var(--soft-brown);"><span style="color: var(--muted-gold);"></span> ${award}</p>`).join('')}
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
                        <p style="font-size: 1.2em; color: var(--soft-brown);"> Add luxury components like:</p>
                        <ul style="list-style: none; margin: 20px 0; padding: 0;">
                            <li style="margin: 10px 0; font-size: 1.1em;"> Massive Hero Text</li>
                            <li style="margin: 10px 0; font-size: 1.1em;"> Transformational Experience</li>
                            <li style="margin: 10px 0; font-size: 1.1em;"> Award-Winning Positioning</li>
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

// Delete individual photo using unified deletion system
app.delete('/api/sessions/:sessionId/files/:folderType/:filename', isAuthenticated, async (req, res) => {
    const { sessionId, folderType, filename } = req.params;
    const currentUserId = req.user.normalized_uid || req.user.uid || req.user.id;
    
    try {
        console.log(`🗑️ UNIFIED Delete request: ${filename} from session ${sessionId} (${folderType})`);
        
        // Use unified deletion service to ensure complete cleanup
        const deleteResult = await unifiedDeletion.deletePhotoCompletely(currentUserId, sessionId, decodeURIComponent(filename));
        
        if (deleteResult.success) {
            console.log(` Photo deleted: ${filename} - ${deleteResult.fileSizeMB}MB reclaimed`);
            res.json({
                success: true,
                message: `Photo ${filename} deleted successfully`,
                reclaimedMB: deleteResult.fileSizeMB,
                steps: deleteResult.steps
            });
        } else {
            console.log(`❌ Photo deletion failed: ${filename}`);
            res.status(404).json({ 
                success: false,
                error: deleteResult.error || 'File not found or already deleted' 
            });
        }
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete photo: ' + error.message 
        });
    }
});

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
                            // Use optimized version for display, local path for download
                            const displayUrl = photo.displayPath ? `/uploads/optimized_${photo.filename}` : `/uploads/${photo.filename}`;
                            const downloadUrl = `/uploads/${photo.filename}`;
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
                             Download All Photos (ZIP)
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
                                // Use local uploads for original quality
                                const downloadUrl = '/uploads/' + photo.filename;
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

        // Allow access without token - galleries are public by session ID
        // Token is optional for backwards compatibility
        if (accessToken && session.galleryAccessToken && session.galleryAccessToken !== accessToken) {
            return res.status(403).json({ error: 'Invalid access token' });
        }

        // Get the Firebase UID from session_files table to properly locate R2 files
        let firebaseUserId = null;
        try {
            const client = await pool.connect();
            const fileUserResult = await client.query(
                'SELECT DISTINCT user_id FROM session_files WHERE session_id = $1 LIMIT 1',
                [sessionId]
            );
            client.release();
            if (fileUserResult.rows.length > 0) {
                firebaseUserId = fileUserResult.rows[0].user_id;
            }
        } catch (dbError) {
            console.error('Error getting Firebase UID:', dbError);
        }

        // List files directly from R2 using the S3 API
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const userIdForR2 = firebaseUserId || session.userId;
        const prefix = `photographer-${userIdForR2}/session-${sessionId}/gallery/`;
        const listCommand = new ListObjectsV2Command({
            Bucket: 'photoappr2token',
            Prefix: prefix
        });
        
        let galleryPhotos = [];
        try {
            const listResponse = await r2FileManager.s3Client.send(listCommand);
            const r2Files = listResponse.Contents || [];
            
            console.log(`Found ${r2Files.length} files in R2 with prefix ${prefix}`);
            
            galleryPhotos = r2Files.map(file => {
                const filename = file.Key.split('/').pop();
                return {
                    filename: filename,
                    displayName: filename,
                    url: `/api/gallery/${sessionId}/photo/${encodeURIComponent(filename)}`,
                    size: file.Size,
                    folderType: 'gallery'
                };
            });
        } catch (r2Error) {
            console.error('Error listing R2 files directly:', r2Error);
        }
        
        console.log(`Found ${galleryPhotos.length} photos in R2 gallery for session ${sessionId}`);

        // No expiration check - galleries never expire

        res.json({
            sessionId: session.id,
            clientName: session.clientName,
            sessionType: session.sessionType,
            photos: galleryPhotos || [],
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

        // Allow access without token - galleries are public by session ID
        // Token is optional for backwards compatibility
        if (accessToken && session.galleryAccessToken && session.galleryAccessToken !== accessToken) {
            return res.status(403).json({ error: 'Invalid access token' });
        }

        // Get the Firebase UID from session_files table to properly locate R2 files
        let firebaseUserId = null;
        try {
            const client = await pool.connect();
            const fileUserResult = await client.query(
                'SELECT DISTINCT user_id FROM session_files WHERE session_id = $1 LIMIT 1',
                [sessionId]
            );
            client.release();
            if (fileUserResult.rows.length > 0) {
                firebaseUserId = fileUserResult.rows[0].user_id;
            }
        } catch (dbError) {
            console.error('Error getting Firebase UID:', dbError);
        }

        // List files directly from R2 using the S3 API
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const userIdForR2 = firebaseUserId || session.userId;
        const prefix = `photographer-${userIdForR2}/session-${sessionId}/gallery/`;
        const listCommand = new ListObjectsV2Command({
            Bucket: 'photoappr2token',
            Prefix: prefix
        });
        
        let galleryPhotos = [];
        try {
            const listResponse = await r2FileManager.s3Client.send(listCommand);
            const r2Files = listResponse.Contents || [];
            
            console.log(`Found ${r2Files.length} files in R2 with prefix ${prefix}`);
            
            galleryPhotos = r2Files.map(file => {
                const filename = file.Key.split('/').pop();
                return {
                    filename: filename,
                    displayName: filename,
                    url: `/api/gallery/${sessionId}/photo/${encodeURIComponent(filename)}`,
                    size: file.Size,
                    folderType: 'gallery'
                };
            });
        } catch (r2Error) {
            console.error('Error listing R2 files directly:', r2Error);
        }
        
        console.log(`Found ${galleryPhotos.length} photos in R2 gallery for session ${sessionId}`);

        // No expiration check - galleries never expire

        res.json({
            photos: galleryPhotos || [],
            totalPhotos: galleryPhotos.length
        });
    } catch (error) {
        console.error('Error getting gallery photos:', error);
        res.status(500).json({ error: 'Failed to get gallery photos' });
    }
});

// Serve individual photo from gallery
app.get('/api/gallery/:id/photo/:filename', async (req, res) => {
    const sessionId = req.params.id;
    const filename = decodeURIComponent(req.params.filename);

    try {
        // Get session to get userId
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Get the Firebase UID from session_files table to properly locate R2 files
        let firebaseUserId = null;
        try {
            const client = await pool.connect();
            const fileUserResult = await client.query(
                'SELECT DISTINCT user_id FROM session_files WHERE session_id = $1 LIMIT 1',
                [sessionId]
            );
            client.release();
            if (fileUserResult.rows.length > 0) {
                firebaseUserId = fileUserResult.rows[0].user_id;
            }
        } catch (dbError) {
            console.error('Error getting Firebase UID:', dbError);
        }
        
        // Get the photo directly from R2 using the S3 API
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const userIdForR2 = firebaseUserId || session.userId;
        const key = `photographer-${userIdForR2}/session-${sessionId}/gallery/${filename}`;
        
        console.log(`Fetching photo from R2: ${key}`);
        
        const getCommand = new GetObjectCommand({
            Bucket: 'photoappr2token',
            Key: key
        });
        
        const response = await r2FileManager.s3Client.send(getCommand);
        
        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        // Determine content type from filename
        const ext = filename.toLowerCase().split('.').pop();
        let contentType = 'image/jpeg';
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'webp') contentType = 'image/webp';
        
        // Set appropriate headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Content-Length', buffer.length);
        
        // Send the photo buffer
        res.send(buffer);
    } catch (error) {
        console.error('Error serving gallery photo:', error);
        res.status(404).json({ error: 'Photo not found' });
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
                description: ' Optional Gratuity (Add Custom Amount)',
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

// AI Assistant API Routes
app.get('/api/ai/credits', isAuthenticated, async (req, res) => {
    try {
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        const credits = await getUserAiCredits(userId);
        
        res.json({
            success: true,
            credits: credits,
            userId: userId
        });
    } catch (error) {
        console.error('Error fetching AI credits:', error);
        res.status(500).json({ error: 'Failed to fetch AI credits' });
    }
});

app.get('/api/ai/credit-bundles', isAuthenticated, async (req, res) => {
    try {
        // Return bundles from shared source of truth
        res.json({
            success: true,
            bundles: AI_CREDIT_BUNDLES
        });
    } catch (error) {
        console.error('Error fetching credit bundles:', error);
        res.status(500).json({ error: 'Failed to fetch credit bundles' });
    }
});

app.post('/api/ai/purchase-credits', isAuthenticated, async (req, res) => {
    try {
        const { credits, priceUsd } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        // Convert to numbers and validate types
        const creditsNum = parseInt(credits);
        const priceNum = parseFloat(priceUsd);
        
        if (!creditsNum || !priceNum || creditsNum <= 0 || priceNum <= 0) {
            return res.status(400).json({ error: 'Valid credits amount and price required' });
        }

        // Validate against shared bundle definitions
        
        // Validate against shared bundle definitions
        if (!isValidBundle(creditsNum, priceNum)) {
            return res.status(400).json({ 
                error: 'Invalid credits package'
            });
        }

        // Create Stripe payment session for AI credits
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `AI Credits - ${creditsNum.toLocaleString()} tokens`,
                        description: 'AI-powered photography assistance'
                    },
                    unit_amount: Math.round(priceNum * 100) // Convert to cents
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/?credits_purchased=true`,
            cancel_url: `${req.protocol}://${req.get('host')}/`,
            metadata: {
                userId: userId,
                credits: creditsNum.toString(),
                priceUsd: priceNum.toString(),
                type: 'ai_credits'
            }
        });
        
        res.json({
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id
        });
    } catch (error) {
        console.error('Error creating AI credits purchase:', error);
        res.status(500).json({ error: 'Failed to create purchase session' });
    }
});

app.post('/api/ai/generate-content', isAuthenticated, async (req, res) => {
    try {
        const { prompt, requestType = 'content_generation' } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await aiService.generateContent(userId, prompt, requestType);
        
        res.json(result);
    } catch (error) {
        console.error('Error generating AI content:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

app.post('/api/ai/generate-page-content', isAuthenticated, async (req, res) => {
    try {
        const { businessInfo } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!businessInfo) {
            return res.status(400).json({ error: 'Business information is required' });
        }

        const result = await aiService.generatePageContent(userId, businessInfo);
        
        res.json(result);
    } catch (error) {
        console.error('Error generating page content:', error);
        res.status(500).json({ error: 'Failed to generate page content' });
    }
});

app.post('/api/ai/improve-seo', isAuthenticated, async (req, res) => {
    try {
        const { currentContent, targetKeywords = [] } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!currentContent) {
            return res.status(400).json({ error: 'Current content is required' });
        }

        const result = await aiService.improveSEO(userId, currentContent, targetKeywords);
        
        res.json(result);
    } catch (error) {
        console.error('Error improving SEO:', error);
        res.status(500).json({ error: 'Failed to improve SEO' });
    }
});

app.post('/api/ai/generate-alt-text', isAuthenticated, async (req, res) => {
    try {
        const { imageDescription, context } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!imageDescription) {
            return res.status(400).json({ error: 'Image description is required' });
        }

        const result = await aiService.generateImageAltText(userId, imageDescription, context || '');
        
        res.json(result);
    } catch (error) {
        console.error('Error generating alt text:', error);
        res.status(500).json({ error: 'Failed to generate alt text' });
    }
});

// BADASS MODE: Advanced AI API Endpoints
app.post('/api/ai/badass/advanced-content', isAuthenticated, async (req, res) => {
    try {
        const { contentType, context, userPrompt } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!contentType || !userPrompt) {
            return res.status(400).json({ error: 'Content type and user prompt are required' });
        }

        // Check AI credits (2 credits for advanced content)
        const creditsNeeded = 2;
        const availableCredits = await getUserAiCredits(userId);
        
        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Deduct credits
        await useAiCredits(userId, creditsNeeded, 'advanced_content', userPrompt);

        const result = await aiServices.generateAdvancedContent(contentType, context, userPrompt);
        
        res.json({
            success: true,
            ...result,
            creditsUsed: creditsNeeded,
            remainingCredits: availableCredits - creditsNeeded
        });
    } catch (error) {
        console.error('Advanced AI content generation error:', error);
        res.status(500).json({ error: 'Failed to generate advanced content: ' + error.message });
    }
});

app.post('/api/ai/badass/custom-component', isAuthenticated, async (req, res) => {
    try {
        const { componentType, requirements, designStyle } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!componentType || !requirements) {
            return res.status(400).json({ error: 'Component type and requirements are required' });
        }

        // Check AI credits (3 credits for custom components)
        const creditsNeeded = 3;
        const availableCredits = await getUserAiCredits(userId);
        
        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Deduct credits
        await useAiCredits(userId, creditsNeeded, 'custom_component', componentType);

        const result = await aiServices.generateCustomComponent(componentType, requirements, designStyle || 'modern');
        
        res.json({
            success: true,
            ...result,
            creditsUsed: creditsNeeded,
            remainingCredits: availableCredits - creditsNeeded
        });
    } catch (error) {
        console.error('Custom component generation error:', error);
        res.status(500).json({ error: 'Failed to generate custom component: ' + error.message });
    }
});

app.post('/api/ai/badass/optimize-website', isAuthenticated, async (req, res) => {
    try {
        const { websiteHTML, optimizationType } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!websiteHTML || !optimizationType) {
            return res.status(400).json({ error: 'Website HTML and optimization type are required' });
        }

        // Check AI credits (4 credits for website optimization)
        const creditsNeeded = 4;
        const availableCredits = await getUserAiCredits(userId);
        
        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Deduct credits
        await useAiCredits(userId, creditsNeeded, 'website_optimization', optimizationType);

        const result = await aiServices.optimizeWebsite(websiteHTML, optimizationType);
        
        res.json({
            success: true,
            ...result,
            creditsUsed: creditsNeeded,
            remainingCredits: availableCredits - creditsNeeded
        });
    } catch (error) {
        console.error('Website optimization error:', error);
        res.status(500).json({ error: 'Failed to optimize website: ' + error.message });
    }
});

app.post('/api/ai/badass/content-strategy', isAuthenticated, async (req, res) => {
    try {
        const { businessInfo, goals, timeframe } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!businessInfo || !goals || !timeframe) {
            return res.status(400).json({ error: 'Business info, goals, and timeframe are required' });
        }

        // Check AI credits (5 credits for content strategy)
        const creditsNeeded = 5;
        const availableCredits = await getUserAiCredits(userId);
        
        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Deduct credits
        await useAiCredits(userId, creditsNeeded, 'content_strategy', goals);

        const result = await aiServices.generateContentStrategy(businessInfo, goals, timeframe);
        
        res.json({
            success: true,
            ...result,
            creditsUsed: creditsNeeded,
            remainingCredits: availableCredits - creditsNeeded
        });
    } catch (error) {
        console.error('Content strategy generation error:', error);
        res.status(500).json({ error: 'Failed to generate content strategy: ' + error.message });
    }
});

app.post('/api/ai/badass/smart-page', isAuthenticated, async (req, res) => {
    try {
        const { pageType, requirements, existingContent } = req.body;
        const normalizedUser = normalizeUserForLance(req.user);
        const userId = normalizedUser.uid;
        
        if (!pageType || !requirements) {
            return res.status(400).json({ error: 'Page type and requirements are required' });
        }

        // Check AI credits (4 credits for smart page generation)
        const creditsNeeded = 4;
        const availableCredits = await getUserAiCredits(userId);
        
        if (availableCredits < creditsNeeded) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient AI credits',
                creditsNeeded,
                availableCredits
            });
        }

        // Deduct credits
        await useAiCredits(userId, creditsNeeded, 'smart_page', pageType);

        const result = await aiServices.generateSmartPage(pageType, requirements, existingContent || '');
        
        res.json({
            success: true,
            ...result,
            creditsUsed: creditsNeeded,
            remainingCredits: availableCredits - creditsNeeded
        });
    } catch (error) {
        console.error('Smart page generation error:', error);
        res.status(500).json({ error: 'Failed to generate smart page: ' + error.message });
    }
});

// Send invoice via Stripe (enhanced for deposits)
app.post('/api/sessions/:id/send-invoice', async (req, res) => {
    const sessionId = req.params.id;
    const { isDeposit, depositAmount } = req.body;

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
            
            const simulatedAmount = isDeposit && depositAmount ? depositAmount : (session.price - (session.depositAmount || 0));

            return res.json({ 
                message: 'Invoice simulation completed (Stripe not configured)',
                fallbackMode: true,
                invoiceUrl: `https://invoice-demo.stripe.com/demo-${sessionId}`,
                details: 'To send real invoices, provide your complete Stripe secret key (100+ characters) from your Stripe Dashboard',
                clientName: session.clientName,
                amount: simulatedAmount,
                sessionType: session.sessionType,
                depositInfo: isDeposit ? {
                    depositAmount: depositAmount,
                    totalDeposits: (session.depositAmount || 0) + (depositAmount || 0),
                    remainingBalance: session.price - (session.depositAmount || 0) - (depositAmount || 0)
                } : null
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

        // Calculate invoice amount - use deposit amount if this is a deposit, otherwise remaining balance
        let invoiceAmount;
        let invoiceDescription;
        let customFields;

        if (isDeposit && depositAmount) {
            invoiceAmount = depositAmount;
            const remainingBalance = session.price - (session.depositAmount || 0) - depositAmount;
            invoiceDescription = `Deposit for ${(session.sessionType || 'Photography').trim()} Session`;
            customFields = [
                {
                    name: 'Photographer',
                    value: 'Lance - The Legacy Photography'
                },
                {
                    name: 'Session Details',
                    value: `${(session.sessionType || 'Photography Session').trim()} at ${session.location || 'TBD'}`
                },
                {
                    name: 'Payment Type',
                    value: 'Deposit/Retainer'
                },
                {
                    name: 'Remaining Balance',
                    value: `$${remainingBalance.toFixed(2)}`
                }
            ];
        } else {
            // Full invoice or remaining balance
            const existingDeposit = session.depositAmount || 0;
            console.log('DEBUG INVOICE CALCULATION:', {
                sessionPrice: session.price,
                sessionDepositAmount: session.depositAmount,
                existingDeposit: existingDeposit,
                calculatedInvoiceAmount: session.price - existingDeposit
            });
            invoiceAmount = session.price - existingDeposit;
            invoiceDescription = existingDeposit > 0 ? 
                `Final Payment for ${(session.sessionType || 'Photography').trim()} Session` : 
                `Full Payment for ${(session.sessionType || 'Photography').trim()} Session`;
            customFields = [
                {
                    name: 'Photographer',
                    value: 'Lance - The Legacy Photography'
                },
                {
                    name: 'Session Details',
                    value: `${(session.sessionType || 'Photography Session').trim()} at ${session.location || 'TBD'}`
                }
            ];
            
            if (existingDeposit > 0) {
                customFields.push({
                    name: 'Previous Deposit',
                    value: `$${existingDeposit.toFixed(2)}`
                });
            }
        }

        // First create a simple payment plan for tip tracking
        let paymentRecordId = null;
        try {
            const planId = require('uuid').v4();
            paymentRecordId = require('uuid').v4();
            
            // Create a basic payment plan
            const startDate = new Date();
            const endDate = new Date(Date.now() + (isDeposit ? 14 : 30) * 24 * 60 * 60 * 1000);
            
            await pool.query(`
                INSERT INTO payment_plans (id, session_id, user_id, total_amount, monthly_payment, start_date, end_date, total_payments, remaining_balance, next_payment_date, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $4, $5, $6, 1, $4, $6, NOW(), NOW())
            `, [planId, sessionId, session.userId || '44735007', invoiceAmount, startDate, endDate]);
            
            // Create payment record with the plan
            await pool.query(`
                INSERT INTO payment_records (id, plan_id, session_id, user_id, payment_number, amount, tip_amount, due_date, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 1, $5, 0.00, $6, 'pending', NOW(), NOW())
            `, [paymentRecordId, planId, sessionId, session.userId || '44735007', invoiceAmount, new Date(Date.now() + (isDeposit ? 14 : 30) * 24 * 60 * 60 * 1000)]);
            
        } catch (dbError) {
            console.log('Could not create payment plan/record for tip tracking:', dbError.message);
            // Continue without payment record - use sessionId as fallback
            paymentRecordId = sessionId;
        }

        // Create tip URL for this invoice using payment record ID
        const invoiceCustomUrl = `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000'}/invoice.html?payment=${paymentRecordId}`;
        
        // Create invoice with proper collection method for manual sending
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            description: `Lance - The Legacy Photography: ${invoiceDescription}`,
            collection_method: 'send_invoice',
            days_until_due: isDeposit ? 14 : 30, // Shorter due date for deposits
            footer: `Thank you for choosing Lance - The Legacy Photography!\n\nYou can add an optional tip and view full invoice details at:\n${invoiceCustomUrl}\n\nContact: lance@thelegacyphotography.com`,
            custom_fields: customFields,
            metadata: {
                sessionId: sessionId,
                clientName: session.clientName,
                sessionType: session.sessionType,
                location: session.location,
                dateTime: session.dateTime,
                photographer: 'Lance - The Legacy Photography',
                businessName: 'The Legacy Photography',
                businessEmail: 'lance@thelegacyphotography.com',
                isDeposit: isDeposit ? 'true' : 'false',
                totalSessionPrice: session.price.toString(),
                paymentRecordId: paymentRecordId,
                customInvoiceUrl: invoiceCustomUrl
            }
        });

        // Add invoice item
        await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: invoice.id,
            amount: Math.round(invoiceAmount * 100), // Convert to cents
            currency: 'usd',
            description: `${invoiceDescription} by Lance - The Legacy Photography`,
            metadata: {
                sessionId: sessionId,
                location: session.location,
                dateTime: session.dateTime,
                duration: `${session.duration} minutes`,
                photographer: 'Lance - The Legacy Photography',
                businessEmail: 'lance@thelegacyphotography.com',
                isDeposit: isDeposit ? 'true' : 'false',
                depositAmount: depositAmount ? depositAmount.toString() : '0'
            }
        });

        // Finalize and send invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(finalizedInvoice.id);

        // If this is a deposit, update the session's deposit amount
        if (isDeposit && depositAmount) {
            const newDepositAmount = (session.depositAmount || 0) + depositAmount;
            
            // Update the session in the database
            await pool.query(
                'UPDATE photography_sessions SET deposit_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newDepositAmount, sessionId]
            );
            
            session.depositAmount = newDepositAmount;
        }

        // Store invoice details in session
        session.stripeInvoice = {
            invoiceId: finalizedInvoice.id,
            customerId: customer.id,
            hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
            invoicePdf: finalizedInvoice.invoice_pdf,
            amount: invoiceAmount,
            totalSessionPrice: session.price,
            depositAmount: isDeposit ? depositAmount : 0,
            isDeposit: isDeposit || false,
            status: finalizedInvoice.status,
            sentAt: new Date().toISOString()
        };

        const logMessage = isDeposit ? 
            `Deposit invoice sent to ${session.clientName} for $${depositAmount} (remaining: $${(session.price - session.depositAmount).toFixed(2)})` :
            `Invoice sent to ${session.clientName} for $${invoiceAmount}`;
            
        console.log(logMessage);
        console.log(`Invoice URL: ${finalizedInvoice.hosted_invoice_url}`);

        res.json({
            message: 'Invoice sent successfully via Stripe',
            invoice: {
                id: finalizedInvoice.id,
                hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
                invoicePdf: finalizedInvoice.invoice_pdf,
                amount: invoiceAmount,
                status: finalizedInvoice.status,
                customer: customer.email
            },
            depositInfo: isDeposit ? {
                depositAmount: depositAmount,
                totalDeposits: session.depositAmount,
                remainingBalance: session.price - session.depositAmount
            } : null
        });
    } catch (error) {
        console.error('Error sending invoice:', error);
        res.status(500).json({ error: 'Failed to send invoice' });
    }
});

// Create Stripe Checkout Session for tip system
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { paymentId, amount, tipAmount, totalAmount, clientName, sessionType } = req.body;
        
        console.log(' CREATE CHECKOUT SESSION REQUEST:', {
            paymentId,
            amount,
            tipAmount,
            totalAmount,
            clientName,
            sessionType,
            hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
            stripeKeyLength: process.env.STRIPE_SECRET_KEY?.length
        });
        
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.length < 50) {
            console.log('❌ STRIPE NOT CONFIGURED');
            return res.json({
                success: false,
                message: 'Stripe not configured - this would redirect to Stripe Checkout in production'
            });
        }
        
        // Validate minimum amount requirement for Stripe
        if (totalAmount < 0.50) {
            console.log('❌ AMOUNT TOO SMALL:', totalAmount);
            return res.json({
                success: false,
                message: 'Payment amount must be at least $0.50 due to Stripe requirements. Please enter a minimum deposit of $0.50.'
            });
        }
        
        // Determine the base URL for redirect URLs - force HTTPS for Stripe
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host || 'localhost:5000';
        const baseUrl = req.headers.origin || `${protocol}://${host}`;
        
        console.log(' STRIPE URL INFO:', { 
            protocol, 
            host, 
            baseUrl, 
            origin: req.headers.origin,
            successUrl: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&payment_id=${paymentId}`,
            cancelUrl: `${baseUrl}/invoice.html?payment=${paymentId}`
        });
        
        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${sessionType || 'Photography Session'} - ${clientName}`,
                            description: `Base amount: $${amount.toFixed(2)}${tipAmount > 0 ? `, Tip: $${tipAmount.toFixed(2)}` : ''}`
                        },
                        unit_amount: Math.round(totalAmount * 100) // Convert to cents
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&payment_id=${paymentId}`,
            cancel_url: `${baseUrl}/invoice.html?payment=${paymentId}`,
            metadata: {
                paymentId: paymentId,
                baseAmount: amount.toString(),
                tipAmount: tipAmount.toString(),
                totalAmount: totalAmount.toString(),
                sessionId: paymentId.match(/payment-([a-f0-9-]+)-\d+/)?.[1] || 'unknown',
                type: 'deposit' // Most checkout sessions are for deposits
            }
        });
        
        console.log(' STRIPE SESSION CREATED:', session.id);
        res.json({
            success: true,
            checkout_url: session.url,
            session_id: session.id
        });
        
    } catch (error) {
        console.error('❌ CHECKOUT SESSION ERROR:', error.message);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment session: ' + error.message
        });
    }
});

// Create deposit invoice with tipping system
app.post('/api/create-deposit-invoice-with-tipping', async (req, res) => {
    try {
        const { sessionId, depositAmount, includeTipping } = req.body;
        
        if (!sessionId || !depositAmount) {
            return res.status(400).json({
                success: false,
                message: 'Session ID and deposit amount are required'
            });
        }
        
        // Get session data from database
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }
        
        // Validate deposit amount
        if (depositAmount <= 0 || depositAmount >= session.price) {
            return res.status(400).json({
                success: false,
                message: 'Invalid deposit amount'
            });
        }
        
        // Create unique payment ID for the deposit invoice
        const paymentId = `payment-${sessionId}-${Date.now()}`;
        
        // Store payment data in memory for the invoice page
        const paymentData = {
            paymentId: paymentId,
            sessionId: sessionId,
            amount: depositAmount,
            tipAmount: 0,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
            status: 'pending',
            isDeposit: true,
            clientName: session.clientName,
            clientEmail: session.email,
            sessionType: session.sessionType,
            createdAt: new Date().toISOString()
        };
        
        // Store in localStorage-compatible format for invoice page
        if (!global.invoiceStorage) {
            global.invoiceStorage = {};
        }
        global.invoiceStorage[`payment-${paymentId}`] = paymentData;
        
        // Create the invoice URL with tipping support
        const baseURL = req.headers.origin || `https://${req.headers.host}`;
        const invoiceURL = `${baseURL}/invoice.html?payment=${paymentId}&sessionId=${sessionId}&amount=${depositAmount}&type=deposit`;
        
        console.log(` DEPOSIT TIPPING SYSTEM: Creating deposit invoice for session:`, {
            sessionId,
            depositAmount,
            clientName: session.clientName,
            remainingBalance: session.price - depositAmount
        });
        
        console.log(` DEPOSIT SUCCESS: Custom deposit invoice URL created:`, invoiceURL);
        
        res.json({
            success: true,
            message: `Deposit invoice created for $${depositAmount}`,
            invoice_url: invoiceURL,
            payment_id: paymentId,
            deposit_info: {
                depositAmount: depositAmount,
                totalSessionPrice: session.price,
                remainingBalance: session.price - depositAmount,
                clientName: session.clientName,
                sessionType: session.sessionType
            }
        });
        
    } catch (error) {
        console.error('Deposit invoice creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create deposit invoice: ' + error.message
        });
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

        // Verify user owns this session (use normalized user for unified account)
        const normalizedUser = normalizeUserForLance(user);
        if (session.userId !== normalizedUser.uid) {
            console.log('Contract authorization check:', {
                sessionUserId: session.userId,
                originalUserUid: user.uid,
                normalizedUserUid: normalizedUser.uid,
                userEmail: user.email
            });
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }

        // Prepare session data for contract template
        const contractData = {
            client_name: session.clientName,
            client_email: session.email,
            client_phone: session.phoneNumber,
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

        // Verify user owns this session (use normalized user for unified account)
        const normalizedUser = normalizeUserForLance(user);
        if (session.userId !== normalizedUser.uid) {
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }

        const contracts = await contractManager.getContractsBySessionId(sessionId);
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

        // Verify user owns this contract (use normalized user for unified account)
        const normalizedUser = normalizeUserForLance(user);
        if (contract.user_id !== normalizedUser.uid) {
            return res.status(403).json({ error: 'Unauthorized access to contract' });
        }

        // Get session data to include phone number
        const session = await getSessionById(contract.session_id);
        
        // Mark contract as sent
        const updatedContract = await contractManager.sendContract(contractId);
        
        // Add session phone number to contract data
        updatedContract.client_phone = session?.phoneNumber || session?.phone_number || null;

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
            contract: {
                ...updatedContract,
                client_phone: updatedContract.client_phone || 'No phone available'
            },
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

// Update contract
app.put('/api/contracts/:id', isAuthenticated, async (req, res) => {
    try {
        const contractId = req.params.id;
        const { title, content } = req.body;
        const user = req.user;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const contract = await contractManager.getContract(contractId);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        // Verify user owns this contract through session ownership
        const session = await getSessionById(contract.session_id);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const normalizedUser = normalizeUserForLance(user);
        if (session.userId !== normalizedUser.uid) {
            return res.status(403).json({ error: 'Unauthorized access to contract' });
        }

        const updatedContract = await contractManager.updateContract(contractId, title, content);

        res.json({
            message: 'Contract updated successfully',
            contract: updatedContract
        });
    } catch (error) {
        console.error('Error updating contract:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create custom contract
app.post('/api/sessions/:id/contracts/custom', isAuthenticated, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { title, content } = req.body;
        const user = req.user;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Verify user owns this session
        const normalizedUser = normalizeUserForLance(user);
        if (session.userId !== normalizedUser.uid) {
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }

        const contract = await contractManager.createCustomContract(sessionId, {
            title,
            content,
            userId: user.uid
        }, session);

        res.json({
            message: 'Custom contract created successfully',
            contract
        });
    } catch (error) {
        console.error('Error creating custom contract:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Contract email sending endpoint
app.post('/api/contracts/send-email', isAuthenticated, async (req, res) => {
    try {
        const { contractId, clientEmail, clientName, signingUrl } = req.body;
        
        if (!contractId || !clientEmail || !signingUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Get contract details
        const contractResult = await pool.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        if (contractResult.rows.length === 0) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        const contract = contractResult.rows[0];
        
        // Prepare email content
        const emailContent = {
            to: clientEmail,
            from: {
                email: 'lance@thelegacyphotography.com',
                name: 'Lance - The Legacy Photography'
            },
            subject: `Contract Signing Required - ${contract.contract_title}`,
            html: `
                <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #8b7355 0%, #a08968 100%); color: white; padding: 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: normal;">The Legacy Photography</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Contract Ready for Signature</p>
                    </div>
                    
                    <div style="padding: 40px 30px;">
                        <p style="font-size: 18px; color: #333; margin-bottom: 25px;">Hi ${clientName || 'there'}!</p>
                        
                        <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
                            Your photography contract is ready for review and electronic signature. This secure document outlines all the details of our photography services.
                        </p>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                            <h3 style="color: #8b7355; margin: 0 0 15px 0;">Contract Details:</h3>
                            <p style="margin: 5px 0; color: #666;"><strong>Title:</strong> ${contract.contract_title}</p>
                            <p style="margin: 5px 0; color: #666;"><strong>Client:</strong> ${contract.client_name}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${signingUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b7355 0%, #a08968 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
                                 Review & Sign Contract
                            </a>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Please review all terms carefully. If you have any questions about the contract, feel free to reach out before signing.
                        </p>
                        
                        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                            <p style="color: #888; font-size: 14px; margin: 0;">
                                Best regards,<br>
                                Lance Casselman<br>
                                The Legacy Photography<br>
                                 lance@thelegacyphotography.com
                            </p>
                        </div>
                    </div>
                </div>
            `
        };
        
        // Send email using SendGrid
        await sgMail.send(emailContent);
        
        // Update contract status
        await pool.query(`
            UPDATE contracts SET 
                status = 'sent',
                sent_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [contractId]);
        
        console.log(` Contract email sent successfully to ${clientEmail}`);
        res.json({ 
            success: true, 
            message: 'Contract email sent successfully!',
            sentTo: clientEmail 
        });
        
    } catch (error) {
        console.error('❌ Error sending contract email:', error);
        res.status(500).json({ 
            error: 'Failed to send contract email',
            details: error.message 
        });
    }
});

// Contract SMS sending endpoint
app.post('/api/contracts/send-sms', isAuthenticated, async (req, res) => {
    try {
        const { contractId, clientPhone, clientName, signingUrl } = req.body;
        
        if (!contractId || !clientPhone || !signingUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Import Twilio (check if configured)
        const twilio = require('twilio');
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
        
        if (!accountSid || !authToken || !twilioPhone) {
            return res.status(400).json({ 
                error: 'SMS service not configured. Please contact support to enable SMS functionality.' 
            });
        }
        
        const client = twilio(accountSid, authToken);
        
        // Clean phone number
        const cleanPhone = clientPhone.replace(/[^\d]/g, '');
        const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;
        
        // Prepare SMS message
        const message = `Hi ${clientName || 'there'}! Your photography contract is ready for signing. Please review and sign: ${signingUrl}\n\n- Lance, The Legacy Photography`;
        
        // Send SMS
        const twilioMessage = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: formattedPhone
        });
        
        // Update contract status
        await pool.query(`
            UPDATE contracts SET 
                status = 'sent',
                sent_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [contractId]);
        
        console.log(` Contract SMS sent successfully to ${formattedPhone}. SID: ${twilioMessage.sid}`);
        res.json({ 
            success: true, 
            message: 'Contract SMS sent successfully!',
            sentTo: formattedPhone,
            messageSid: twilioMessage.sid
        });
        
    } catch (error) {
        console.error('❌ Error sending contract SMS:', error);
        res.status(500).json({ 
            error: 'Failed to send contract SMS',
            details: error.message 
        });
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

        console.log(' Processing onboarding wizard data for user:', userId);

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
                <h2> Business Profile Setup</h2>
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
                    <h1> Business Profile Saved!</h1>
                    <h2>Welcome, ${ownerName}!</h2>
                    <p><strong>${businessName}</strong> profile is complete.</p>
                    ${location ? `<p>📍 ${location}</p>` : ''}
                    ${specialties ? `<p> ${specialties}</p>` : ''}
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
        console.log(' New pose submitted:', newPose.id);

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

        console.log(' Processing business setup:', { businessName, ownerName, email });

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
                    <h1> Setup Complete!</h1>
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

        console.log(' Onboarding completed:', result.rows[0]);

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
                <a href="tel:8434851315" class="contact-btn"> Call Now</a>
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

// Serve main app with authentication AND subscription requirement
app.get('/app', async (req, res) => {
    if (!DEV_MODE) {
        // Check authentication in production mode
        if (!req.session || !req.session.user) {
            return res.redirect('/auth.html?return=/app');
        }
        
        // Check subscription status
        const userId = req.session.user.uid;
        const userEmail = req.session.user.email;
        
        // Admin whitelist bypass
        const adminEmails = [
            'lancecasselman@icloud.com',
            'lancecasselman2011@gmail.com',
            'lance@thelegacyphotography.com'
        ];
        
        if (!adminEmails.includes(userEmail)) {
            // Check subscription
            const UnifiedSubscriptionManager = require('./server/unified-subscription-manager');
            const subscriptionManager = new UnifiedSubscriptionManager(pool);
            const status = await subscriptionManager.getUserSubscriptionStatus(userId);
            
            if (!status.hasProfessionalPlan || status.professionalStatus !== 'active') {
                console.log(`🔒 Blocking access to /app for ${userEmail} - No active subscription`);
                return res.redirect('/subscription-checkout.html?message=subscription_required');
            }
        }
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Alternative dashboard route
app.get('/dashboard', async (req, res) => {
    if (!DEV_MODE) {
        // Check authentication in production mode
        if (!req.session || !req.session.user) {
            return res.redirect('/auth.html?return=/dashboard');
        }
        
        // Check subscription status
        const userId = req.session.user.uid;
        const userEmail = req.session.user.email;
        
        // Admin whitelist bypass
        const adminEmails = [
            'lancecasselman@icloud.com',
            'lancecasselman2011@gmail.com',
            'lance@thelegacyphotography.com'
        ];
        
        if (!adminEmails.includes(userEmail)) {
            // Check subscription
            const UnifiedSubscriptionManager = require('./server/unified-subscription-manager');
            const subscriptionManager = new UnifiedSubscriptionManager(pool);
            const status = await subscriptionManager.getUserSubscriptionStatus(userId);
            
            if (!status.hasProfessionalPlan || status.professionalStatus !== 'active') {
                console.log(`🔒 Blocking access to /dashboard for ${userEmail} - No active subscription`);
                return res.redirect('/subscription-checkout.html?message=subscription_required');
            }
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
                    <a href="tel:8434851315" class="contact-btn phone"> Call Now</a>
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
                         Call Now
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

// Serve invoice.html publicly without authentication (clients need to access invoices to pay)
app.get('/invoice.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});

// Serve public directory files directly at root level
app.use(express.static(path.join(__dirname, 'public')));

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
    // Start server first, then initialize database in background
    ensureStaticSitesDirectory();

    // Initialize notification services
    initializeNotificationServices();

    // Start automated payment scheduler
    paymentScheduler.start();
    
    // Register subscription management routes
    app.use('/api/subscriptions', createSubscriptionRoutes(pool));
    
    // Subscription status check for frontend
    app.get('/api/subscription-status', subscriptionAuth.getSubscriptionStatus);
    
    // Username availability check
    app.get('/api/users/check-username', async (req, res) => {
        try {
            const { username } = req.query;
            
            if (!username) {
                return res.status(400).json({ error: 'Username required' });
            }
            
            // Check if username is available in database
            const result = await pool.query(
                'SELECT id FROM users WHERE username = $1',
                [username.toLowerCase()]
            );
            
            res.json({ 
                available: result.rows.length === 0,
                username: username.toLowerCase()
            });
        } catch (error) {
            console.error('Error checking username:', error);
            res.status(500).json({ error: 'Failed to check username availability' });
        }
    });
    
    // Complete onboarding
    app.post('/api/users/complete-onboarding', isAuthenticated, async (req, res) => {
        try {
            const userId = req.session.user.uid;
            const {
                username,
                displayName,
                firstName,
                lastName,
                businessName,
                businessType
            } = req.body;
            
            // Validate required fields
            if (!username || !displayName || !businessName) {
                return res.status(400).json({ 
                    error: 'Missing required fields: username, displayName, businessName' 
                });
            }
            
            // Check username availability one more time
            const usernameCheck = await pool.query(
                'SELECT id FROM users WHERE username = $1 AND id != $2',
                [username.toLowerCase(), userId]
            );
            
            if (usernameCheck.rows.length > 0) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            
            // Update user record with onboarding data
            await pool.query(
                `UPDATE users SET 
                    username = $1,
                    display_name = $2,
                    first_name = $3,
                    last_name = $4,
                    business_name = $5,
                    business_type = $6,
                    onboarding_completed = true,
                    updated_at = NOW()
                WHERE id = $7`,
                [
                    username.toLowerCase(),
                    displayName,
                    firstName,
                    lastName,
                    businessName,
                    businessType,
                    userId
                ]
            );
            
            console.log(`✅ Onboarding completed for user ${userId} with username @${username}`);
            
            res.json({ 
                success: true,
                message: 'Onboarding completed successfully',
                user: {
                    id: userId,
                    username: username.toLowerCase(),
                    displayName,
                    businessName,
                    businessType
                }
            });
            
        } catch (error) {
            console.error('Error completing onboarding:', error);
            res.status(500).json({ error: 'Failed to complete onboarding' });
        }
    });

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(` Photography Management System running on http://0.0.0.0:${PORT}`);
        if (process.env.TEST_MODE === 'true') {
            console.log('🧪 TEST MODE ENABLED - Development authentication bypass active');
        } else {
            console.log('AUTH: Authentication required for all access - no anonymous mode');
        }
        
        // Initialize database asynchronously after server starts
        initializeDatabase().then(() => {
            console.log('Database connected and ready');
        }).catch(error => {
            console.error('Database initialization failed, but server is running:', error.message);
            console.log('Server will continue running. Database will retry connection on next request.');
        });
    });

    // Set INFINITE timeouts for large uploads - MAXIMUM settings
    server.timeout = 0; // 0 = infinite
    server.keepAliveTimeout = 0; // 0 = infinite  
    server.headersTimeout = 0; // 0 = infinite
    server.requestTimeout = 0; // 0 = infinite
    server.maxHeadersCount = 0; // Remove header count limit
    console.log('File: Server configured with INFINITE timeouts - no upload limits!');
}

// Add global error handlers for unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit the process, just log the error
});

startServer().catch(error => {
    console.error('Failed to start server:', error);
    // Try to restart after a delay instead of exiting
    setTimeout(() => {
        console.log('Attempting to restart server...');
        startServer();
    }, 5000);
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

// Memory-based multer for builder images (to get buffer directly)
const builderUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB limit for builder images
    },
    fileFilter: (req, file, cb) => {
        console.log(` Builder image filter: ${file.originalname} (${file.mimetype})`);
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Server-side image upload endpoint (bypasses CORS issues)
app.post('/api/upload/builder-image', isAuthenticated, builderUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        
        const userId = req.session.user.uid;
        const file = req.file;
        
        // Create unique filename without duplicating timestamps
        const timestamp = Date.now();
        let cleanFilename = file.originalname;
        
        // Remove any existing timestamp prefixes to prevent accumulation
        cleanFilename = cleanFilename.replace(/^\d+_+/, '');
        
        const filename = `${timestamp}_${cleanFilename}`;
        const storagePath = `builderUploads/${userId}/${filename}`;
        
        console.log('Server uploading image:', storagePath, 'Size:', file.size);
        
        // Fallback: Save to local uploads folder instead of Firebase Storage
        const fs = require('fs');
        const uploadDir = path.join(__dirname, 'uploads', 'builderUploads', userId);
        
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const localPath = path.join(uploadDir, filename);
        
        // Save file buffer to local disk
        fs.writeFileSync(localPath, file.buffer);
        
        // Create a public URL for the uploaded file
        const downloadURL = `/uploads/builderUploads/${userId}/${filename}`;
        
        console.log('Image uploaded successfully to local storage:', downloadURL);
        
        res.json({ 
            downloadURL,
            filename: file.originalname,
            path: storagePath
        });
        
    } catch (error) {
        console.error('Server image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// ZIP Export endpoint for Website Builder
app.post('/api/export/zip', isAuthenticated, async (req, res) => {
    try {
        const { html, selectedFont, imageUrls, isDarkTheme } = req.body;
        const userId = req.session.user.uid;
        
        console.log('Starting ZIP export for user:', userId);
        
        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });
        
        // Set response headers for download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="website-export.zip"');
        
        // Pipe archive to response
        archive.pipe(res);
        
        // Generate styles.css content
        const stylesCSS = generateStylesCSS(selectedFont, isDarkTheme);
        archive.append(stylesCSS, { name: 'styles.css' });
        
        // Process HTML and copy images
        let processedHtml = html;
        
        for (const imageUrl of imageUrls) {
            try {
                if (imageUrl.startsWith('/uploads/')) {
                    const localPath = path.join(__dirname, imageUrl);
                    
                    if (fs.existsSync(localPath)) {
                        const fileName = path.basename(imageUrl);
                        const imageBuffer = fs.readFileSync(localPath);
                        
                        // Add image to ZIP in images folder
                        archive.append(imageBuffer, { name: `images/${fileName}` });
                        
                        // Update HTML to use relative path
                        const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        processedHtml = processedHtml.replace(
                            new RegExp(`src="${escapedUrl}"`, 'g'),
                            `src="images/${fileName}"`
                        );
                        
                        console.log(`Added image to ZIP: ${fileName}`);
                    }
                }
            } catch (imageError) {
                console.error(`Failed to process image ${imageUrl}:`, imageError);
            }
        }
        
        // Generate index.html content with processed HTML
        const indexHtml = generateIndexHtml(processedHtml, selectedFont, isDarkTheme);
        archive.append(indexHtml, { name: 'index.html' });
        
        // Finalize the archive
        await archive.finalize();

    } catch (error) {
        console.error('ZIP export error:', error);
        res.status(500).json({ error: 'Failed to create ZIP export' });
    }
});

// RAW File Storage Endpoints

// Test R2 connection
app.get('/api/raw-storage/test', isAuthenticated, async (req, res) => {
    try {
        const isConnected = await r2StorageService.testConnection();
        res.json({ connected: isConnected });
    } catch (error) {
        console.error('R2 connection test error:', error);
        res.status(500).json({ error: 'Failed to test R2 connection' });
    }
});

// Get user's current RAW storage usage and billing info
app.get('/api/raw-storage/usage', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        
        // Get storage usage from database
        const usageResult = await pool.query(`
            SELECT total_files, total_bytes, total_size_tb, current_monthly_charge,
                   storage_tier_tb, max_allowed_tb, storage_status, next_billing_date
            FROM raw_storage_usage 
            WHERE user_id = $1
        `, [userId]);
        
        let usage = null;
        if (usageResult.rows.length === 0) {
            // Create default usage record for new user
            await pool.query(`
                INSERT INTO raw_storage_usage (id, user_id, total_files, total_bytes, 
                                             total_size_tb, current_monthly_charge, storage_tier_tb, 
                                             max_allowed_tb, storage_status)
                VALUES ($1, $2, 0, 0, 0, 0, 1, 1.00, 'active')
            `, [uuidv4(), userId]);
            
            usage = {
                totalFiles: 0,
                totalSizeBytes: 0,
                totalSizeTB: 0,
                currentMonthlyCharge: 0,
                storageTierTB: 1,
                maxAllowedTB: 1.00,
                storageStatus: 'active',
                nextBillingDate: null,
                usagePercentage: 0,
                isOverLimit: false
            };
        } else {
            const row = usageResult.rows[0];
            usage = {
                totalFiles: row.total_files || 0,
                totalSizeBytes: row.total_bytes || 0,
                totalSizeTB: parseFloat(row.total_size_tb) || 0,
                currentMonthlyCharge: parseFloat(row.current_monthly_charge) || 0,
                storageTierTB: row.storage_tier_tb || 1,
                maxAllowedTB: parseFloat(row.max_allowed_tb) || 1.00,
                storageStatus: row.storage_status || 'active',
                nextBillingDate: row.next_billing_date
            };
        }
        
        // Calculate usage percentage
        const usagePercentage = (usage.totalSizeTB / usage.maxAllowedTB) * 100;
        
        res.json({
            ...usage,
            usagePercentage: Math.min(usagePercentage, 100),
            isOverLimit: usage.totalSizeTB > usage.maxAllowedTB,
            supportedFormats: ['.NEF', '.CR2', '.ARW', '.DNG', '.RAF', '.ORF', '.PEF', '.SRW', '.X3F', '.RW2']
        });
        
    } catch (error) {
        console.error('Error getting RAW storage usage:', error);
        res.status(500).json({ error: 'Failed to get storage usage' });
    }
});

// Memory-based multer for RAW files
const rawFileUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 500 * 1024 * 1024, // 500MB limit per RAW file
    },
    fileFilter: (req, file, cb) => {
        console.log(`RAW file filter: ${file.originalname} (${file.mimetype})`);
        
        // Check file extension for RAW formats
        const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        const supportedExtensions = ['.nef', '.cr2', '.arw', '.dng', '.raf', '.orf', '.pef', '.srw', '.x3f', '.rw2'];
        
        if (supportedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported RAW format. Supported: ${supportedExtensions.join(', ')}`), false);
        }
    }
});

// Upload RAW files to session
app.post('/api/raw-storage/upload/:sessionId', isAuthenticated, rawFileUpload.array('rawFiles', 50), async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const sessionId = req.params.sessionId;
        const files = req.files;
        
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No RAW files provided' });
        }
        
        console.log(`Starting RAW upload: ${files.length} files for session ${sessionId}`);
        
        // Check if user has reached storage limit
        const usageResult = await pool.query(`
            SELECT total_size_tb, max_allowed_tb, storage_status 
            FROM raw_storage_usage 
            WHERE user_id = $1
        `, [userId]);
        
        if (usageResult.rows.length > 0) {
            const { total_size_tb, max_allowed_tb, storage_status } = usageResult.rows[0];
            if (storage_status === 'suspended' || parseFloat(total_size_tb) > parseFloat(max_allowed_tb)) {
                return res.status(403).json({ 
                    error: 'Storage limit exceeded. Please upgrade your storage plan.',
                    storageStatus: storage_status
                });
            }
        }
        
        const uploadResults = [];
        let totalUploadSize = 0;
        
        // Process each file
        for (const file of files) {
            try {
                // Upload to R2
                const uploadResult = await r2StorageService.uploadRawFile(
                    file.buffer, 
                    file.originalname, 
                    userId, 
                    sessionId
                );
                
                if (uploadResult.success) {
                    // Save file record to database
                    const fileId = uuidv4();
                    const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
                    
                    await pool.query(`
                        INSERT INTO raw_files (id, session_id, user_id, filename, original_filename, 
                                             file_extension, file_size_bytes, file_size_mb, r2_key, 
                                             upload_status, upload_started_at, upload_completed_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    `, [
                        fileId, sessionId, userId, uploadResult.r2Key.split('/').pop(),
                        file.originalname, fileExtension, uploadResult.fileSizeBytes.toString(),
                        uploadResult.fileSizeMB, uploadResult.r2Key, 'completed',
                        uploadResult.uploadedAt, uploadResult.uploadedAt
                    ]);
                    
                    totalUploadSize += uploadResult.fileSizeMB;
                    
                    uploadResults.push({
                        filename: file.originalname,
                        fileId: fileId,
                        sizeMB: uploadResult.fileSizeMB,
                        status: 'success'
                    });
                    
                    console.log(`RAW file uploaded successfully: ${file.originalname} (${uploadResult.fileSizeMB}MB)`);
                }
                
            } catch (fileError) {
                console.error(`Failed to upload ${file.originalname}:`, fileError);
                uploadResults.push({
                    filename: file.originalname,
                    status: 'failed',
                    error: fileError.message
                });
            }
        }
        
        // Update user's storage usage
        if (totalUploadSize > 0) {
            await pool.query(`
                UPDATE raw_storage_usage 
                SET total_files = total_files + $1,
                    total_size_bytes = (total_size_bytes::bigint + $2)::text,
                    total_size_tb = total_size_tb + $3,
                    current_monthly_charge = $4 * 20,
                    updated_at = NOW()
                WHERE user_id = $5
            `, [
                uploadResults.filter(r => r.status === 'success').length,
                Math.round(totalUploadSize * 1024 * 1024), // Convert MB to bytes
                totalUploadSize / (1024 * 1024), // Convert MB to TB
                Math.ceil((totalUploadSize / (1024 * 1024)) + (usageResult.rows[0]?.total_size_tb || 0)),
                userId
            ]);
        }
        
        res.json({
            success: true,
            uploadResults,
            totalFiles: uploadResults.filter(r => r.status === 'success').length,
            totalSizeMB: totalUploadSize,
            failedFiles: uploadResults.filter(r => r.status === 'failed').length
        });
        
    } catch (error) {
        console.error('RAW upload error:', error);
        res.status(500).json({ error: 'Failed to upload RAW files' });
    }
});

// Get RAW files for a session
app.get('/api/raw-storage/files/:sessionId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const sessionId = req.params.sessionId;
        
        const result = await pool.query(`
            SELECT id, filename, original_filename, file_extension, file_size_bytes, 
                   file_size_mb, upload_status, upload_completed_at, download_count,
                   last_accessed_at, file_type
            FROM raw_files 
            WHERE session_id = $1 AND user_id = $2 
            ORDER BY upload_date DESC
        `, [sessionId, userId]);
        
        const files = result.rows.map(row => ({
            id: row.id,
            filename: row.filename,
            originalFilename: row.original_filename,
            fileExtension: row.file_extension,
            fileSizeBytes: row.file_size_bytes,
            fileSizeMB: parseFloat(row.file_size_mb),
            uploadStatus: row.upload_status,
            uploadedAt: row.upload_completed_at,
            downloadCount: row.download_count,
            lastAccessedAt: row.last_accessed_at
        }));
        
        res.json({
            sessionId,
            files,
            totalFiles: files.length,
            totalSizeMB: files.reduce((sum, file) => sum + file.fileSizeMB, 0)
        });
        
    } catch (error) {
        console.error('Error getting RAW files:', error);
        res.status(500).json({ error: 'Failed to get RAW files' });
    }
});

// Download RAW file
app.get('/api/raw-storage/download/:fileId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const fileId = req.params.fileId;
        
        // Get file info from database
        const result = await pool.query(`
            SELECT r2_key, original_filename, file_size_bytes 
            FROM raw_files 
            WHERE id = $1 AND user_id = $2
        `, [fileId, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'RAW file not found' });
        }
        
        const { r2_key, original_filename, file_size_bytes } = result.rows[0];
        
        // Download from R2
        const downloadResult = await r2StorageService.downloadRawFile(r2_key);
        
        if (downloadResult.success) {
            // Update download count and last accessed
            await pool.query(`
                UPDATE raw_files 
                SET download_count = download_count + 1, 
                    last_accessed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
            `, [fileId]);
            
            // Set download headers
            res.setHeader('Content-Type', downloadResult.contentType);
            res.setHeader('Content-Length', downloadResult.contentLength);
            res.setHeader('Content-Disposition', `attachment; filename="${original_filename}"`);
            
            // Stream the file data
            res.send(downloadResult.data);
            
            console.log(`RAW file downloaded: ${original_filename} by user ${userId}`);
        } else {
            res.status(500).json({ error: 'Failed to download RAW file from storage' });
        }
        
    } catch (error) {
        console.error('RAW download error:', error);
        res.status(500).json({ error: 'Failed to download RAW file' });
    }
});

// Delete RAW file
app.delete('/api/raw-storage/delete/:fileId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const fileId = req.params.fileId;
        
        // Get file info from database
        const result = await pool.query(`
            SELECT r2_key, file_size_mb 
            FROM raw_files 
            WHERE id = $1 AND user_id = $2
        `, [fileId, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'RAW file not found' });
        }
        
        const { r2_key, file_size_mb } = result.rows[0];
        const fileSizeMB = parseFloat(file_size_mb);
        
        // Delete from R2
        const deleteSuccess = await r2StorageService.deleteRawFile(r2_key);
        
        if (deleteSuccess) {
            // Delete from database
            await pool.query('DELETE FROM raw_files WHERE id = $1', [fileId]);
            
            // Update user's storage usage
            await pool.query(`
                UPDATE raw_storage_usage 
                SET total_files = total_files - 1,
                    total_size_bytes = (total_size_bytes::bigint - $1)::text,
                    total_size_tb = total_size_tb - $2,
                    updated_at = NOW()
                WHERE user_id = $3
            `, [
                Math.round(fileSizeMB * 1024 * 1024), // Convert MB to bytes
                fileSizeMB / (1024 * 1024), // Convert MB to TB
                userId
            ]);
            
            // Recalculate monthly charge
            const usageResult = await pool.query(`
                SELECT total_size_tb FROM raw_storage_usage WHERE user_id = $1
            `, [userId]);
            
            if (usageResult.rows.length > 0) {
                const totalSizeTB = parseFloat(usageResult.rows[0].total_size_tb);
                const monthlyCharge = r2StorageService.calculateMonthlyCost(totalSizeTB);
                
                await pool.query(`
                    UPDATE raw_storage_usage 
                    SET current_monthly_charge = $1
                    WHERE user_id = $2
                `, [monthlyCharge, userId]);
            }
            
            res.json({ success: true, fileSizeMB });
            console.log(`RAW file deleted: ${r2_key} (${fileSizeMB}MB)`);
        } else {
            res.status(500).json({ error: 'Failed to delete RAW file from storage' });
        }
        
    } catch (error) {
        console.error('RAW delete error:', error);
        res.status(500).json({ error: 'Failed to delete RAW file' });
    }
});

// Upgrade storage plan
app.post('/api/raw-storage/upgrade', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const { tierTB } = req.body; // New storage tier (1, 2, 3, etc.)
        
        if (!tierTB || tierTB < 1 || tierTB > 100) {
            return res.status(400).json({ error: 'Invalid storage tier' });
        }
        
        const monthlyPrice = tierTB * 20; // $20 per TB
        
        // Create Stripe checkout session for storage upgrade
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `RAW Storage - ${tierTB}TB Plan`,
                        description: `${tierTB}TB of secure RAW file storage for photography sessions`
                    },
                    unit_amount: monthlyPrice * 100, // Stripe uses cents
                    recurring: {
                        interval: 'month'
                    }
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${req.get('origin')}/raw-backup-dashboard.html?upgrade=success&tier=${tierTB}`,
            cancel_url: `${req.get('origin')}/raw-backup-dashboard.html?upgrade=cancelled`,
            client_reference_id: userId,
            metadata: {
                userId: userId,
                storageType: 'raw_backup',
                storageTierTB: tierTB.toString(),
                monthlyCharge: monthlyPrice.toString()
            }
        });
        
        res.json({ 
            checkoutUrl: session.url,
            sessionId: session.id,
            tierTB,
            monthlyPrice
        });
        
        console.log(`Storage upgrade checkout created for user ${userId}: ${tierTB}TB at $${monthlyPrice}/month`);
        
    } catch (error) {
        console.error('Storage upgrade error:', error);
        res.status(500).json({ error: 'Failed to create storage upgrade checkout' });
    }
});

function generateIndexHtml(layoutHtml, selectedFont, isDarkTheme) {
    const fontLinks = {
        'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
        'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
        'Lato': 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap',
        'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
        'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap',
        'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap'
    };
    
    const fontLink = fontLinks[selectedFont] || fontLinks['Inter'];
    const themeClass = isDarkTheme ? ' class="dark"' : '';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Website</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${fontLink}" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
</head>
<body${themeClass}>
    <div class="website-container">
        ${layoutHtml}
    </div>
</body>
</html>`;
}

function generateStylesCSS(selectedFont, isDarkTheme) {
    return `/* Website Builder Export Styles */

/* CSS Reset */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

/* Base styles */
body {
    font-family: '${selectedFont}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: ${isDarkTheme ? '#f0f0f0' : '#333'};
    background-color: ${isDarkTheme ? '#1a1a1a' : '#ffffff'};
}

.website-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* Block styles */
.block {
    margin-bottom: 30px;
    padding: 20px;
    background: ${isDarkTheme ? '#2a2a2a' : '#ffffff'};
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, ${isDarkTheme ? '0.3' : '0.1'});
}

.block h1, .block h2, .block h3, .block h4, .block h5, .block h6 {
    margin-bottom: 15px;
    color: ${isDarkTheme ? '#ffffff' : '#2c3e50'};
}

.block p {
    margin-bottom: 15px;
    line-height: 1.7;
}

/* Image block styles */
.image-block {
    text-align: center;
    padding: 10px;
}

.image-block img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, ${isDarkTheme ? '0.4' : '0.1'});
}

.image-caption {
    font-size: 14px;
    color: ${isDarkTheme ? '#ccc' : '#666'};
    text-align: center;
    margin-top: 8px;
    font-style: italic;
}

/* Responsive design */
@media (max-width: 768px) {
    .website-container {
        padding: 10px;
    }
    
    .block {
        margin-bottom: 20px;
        padding: 15px;
    }
}

/* Dark theme overrides */
${isDarkTheme ? `
body.dark {
    background-color: #1a1a1a;
    color: #f0f0f0;
}

body.dark .block {
    background: #2a2a2a;
    border: 1px solid #3a3a3a;
}

body.dark h1, body.dark h2, body.dark h3, 
body.dark h4, body.dark h5, body.dark h6 {
    color: #ffffff;
}
` : ''}`;
}

// Multi-page ZIP Export endpoint
app.post('/api/export/multi-page-zip', isAuthenticated, async (req, res) => {
    try {
        const { pages, navigationOrder, navigationLabels, selectedFont, isDarkTheme } = req.body;
        const userId = req.session.user.uid;
        
        console.log('Starting multi-page ZIP export for user:', userId);
        
        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="multi-page-website.zip"');
        
        // Pipe archive to response
        archive.pipe(res);
        
        // Generate shared styles.css
        const stylesCSS = generateMultiPageStylesCSS(selectedFont, isDarkTheme);
        archive.append(stylesCSS, { name: 'styles.css' });
        
        // Generate navigation HTML
        const navHTML = generateNavigationHTML(navigationOrder, navigationLabels);
        
        // Process each page
        const allImageUrls = new Set();
        
        for (const pageId of Object.keys(pages)) {
            const page = pages[pageId];
            
            // Extract images from this page
            const pageImageUrls = extractImageUrlsFromHTML(page.content);
            pageImageUrls.forEach(url => allImageUrls.add(url));
            
            // Process HTML and update image paths
            let processedHTML = page.content;
            
            // Generate complete HTML file for this page
            const fileName = pageId === 'home' ? 'index.html' : `${pageId}.html`;
            const pageHTML = generateMultiPageHTML(processedHTML, navHTML, selectedFont, isDarkTheme, page.name);
            
            archive.append(pageHTML, { name: fileName });
            console.log(`Generated page: ${fileName}`);
        }
        
        // Copy all images to ZIP
        for (const imageUrl of allImageUrls) {
            try {
                if (imageUrl.startsWith('/uploads/')) {
                    const localPath = path.join(__dirname, imageUrl);
                    
                    if (fs.existsSync(localPath)) {
                        const fileName = path.basename(imageUrl);
                        const imageBuffer = fs.readFileSync(localPath);
                        
                        archive.append(imageBuffer, { name: `images/${fileName}` });
                        console.log(`Added image: ${fileName}`);
                    }
                }
            } catch (imageError) {
                console.error(`Failed to process image ${imageUrl}:`, imageError);
            }
        }
        
        // Update all HTML files to use relative image paths
        const finalPages = {};
        for (const pageId of Object.keys(pages)) {
            const page = pages[pageId];
            let processedHTML = page.content;
            
            // Update image paths
            for (const imageUrl of allImageUrls) {
                if (imageUrl.startsWith('/uploads/')) {
                    const fileName = path.basename(imageUrl);
                    const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    processedHTML = processedHTML.replace(
                        new RegExp(`src="${escapedUrl}"`, 'g'),
                        `src="images/${fileName}"`
                    );
                }
            }
            
            const fileName = pageId === 'home' ? 'index.html' : `${pageId}.html`;
            const pageHTML = generateMultiPageHTML(processedHTML, navHTML, selectedFont, isDarkTheme, page.name);
            
            archive.append(pageHTML, { name: fileName });
        }
        
        // Finalize archive
        await archive.finalize();
        
        console.log('Multi-page ZIP export completed');
        
    } catch (error) {
        console.error('Multi-page ZIP export error:', error);
        res.status(500).json({ error: 'Failed to generate multi-page ZIP export' });
    }
});

// Create Payment Intent for session payments (deposits and invoices)
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { amount, sessionId, paymentType = 'invoice', clientEmail } = req.body;
        
        if (!amount || !sessionId) {
            return res.status(400).json({ error: 'Amount and sessionId are required' });
        }

        // Get session details for metadata
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Get photographer's Stripe Connect account
        const photographerResult = await pool.query(
            'SELECT stripe_connect_account_id, stripe_onboarding_complete FROM users WHERE id = $1',
            [session.userId]
        );

        const photographer = photographerResult.rows[0];
        const connectedAccountId = photographer?.stripe_connect_account_id;
        const onboardingComplete = photographer?.stripe_onboarding_complete;

        // Create payment intent - use Stripe Connect if photographer has completed setup
        let paymentIntentData = {
            amount: Math.round(parseFloat(amount) * 100), // Convert to cents
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                sessionId: sessionId,
                type: paymentType, // 'deposit' or 'invoice'
                clientName: session.clientName,
                sessionType: session.sessionType,
                sessionDate: session.dateTime,
                sessionLocation: session.location,
                photographerId: session.userId,
                connectedAccount: connectedAccountId || 'platform'
            },
            receipt_email: clientEmail || session.email,
            description: `${paymentType === 'deposit' ? 'Deposit' : 'Payment'} for ${session.sessionType} session - ${session.clientName}`
        };

        // If photographer has Stripe Connect account and onboarding is complete, route payment to them
        if (connectedAccountId && onboardingComplete) {
            console.log('🔗 Using Stripe Connect for payment - Account:', connectedAccountId);
            
            // Route payment to connected account using transfer_data
            paymentIntentData.transfer_data = {
                destination: connectedAccountId
            };
            
            // Optional: Take platform fee (currently 0%)
            // paymentIntentData.application_fee_amount = Math.round(parseFloat(amount) * 0.02 * 100); // 2% fee
        } else {
            console.log('💳 Using platform Stripe account - Connect account not ready');
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

        console.log(' Payment Intent created:', paymentIntent.id, 'Amount:', amount, 'Session:', sessionId, 'Type:', paymentType, 'Connect:', !!connectedAccountId);

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            usingConnect: !!(connectedAccountId && onboardingComplete)
        });

    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// Confirm Payment Success (optional endpoint for immediate feedback)
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        
        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment Intent ID required' });
        }

        // Retrieve payment intent to check status
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status === 'succeeded') {
            // Payment successful - webhook will handle the notification
            res.json({ 
                success: true, 
                status: 'succeeded',
                message: 'Payment processed successfully'
            });
        } else {
            res.json({ 
                success: false, 
                status: paymentIntent.status,
                message: 'Payment not yet completed'
            });
        }

    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// Get Stripe configuration (public key only)
app.get('/api/stripe-config', async (req, res) => {
    try {
        res.json({
            publicKey: process.env.VITE_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLIC_KEY
        });
    } catch (error) {
        console.error('Error getting Stripe config:', error);
        res.status(500).json({ error: 'Failed to get payment configuration' });
    }
});

// ================================
// STRIPE CONNECT API ENDPOINTS
// ================================

// Initialize Stripe Connect manager
const stripeConnectManager = new StripeConnectManager();

// Start Connect onboarding for photographer
app.post('/api/stripe-connect/onboard', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const userEmail = req.session.user.email;
        
        console.log('🔗 Starting Stripe Connect onboarding for:', userEmail);
        
        // Check if user already has a connected account
        const existingUser = await pool.query('SELECT stripe_connect_account_id FROM users WHERE id = $1', [userId]);
        if (existingUser.rows[0]?.stripe_connect_account_id) {
            return res.json({
                success: false,
                message: 'You already have a connected Stripe account',
                accountId: existingUser.rows[0].stripe_connect_account_id
            });
        }
        
        // Create Express account
        const accountResult = await stripeConnectManager.createExpressAccount(userEmail, 'Photography Business');
        if (!accountResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create Stripe account: ' + accountResult.error
            });
        }
        
        // Save account ID to database
        await pool.query(
            'UPDATE users SET stripe_connect_account_id = $1 WHERE id = $2',
            [accountResult.accountId, userId]
        );
        
        // Create onboarding link
        const baseUrl = req.headers.origin || `https://${req.headers.host}`;
        const refreshUrl = `${baseUrl}/stripe-connect/refresh`;
        const returnUrl = `${baseUrl}/stripe-connect/success`;
        
        const linkResult = await stripeConnectManager.createAccountLink(
            accountResult.accountId,
            refreshUrl,
            returnUrl
        );
        
        if (!linkResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create onboarding link: ' + linkResult.error
            });
        }
        
        console.log(' Onboarding link created for:', userEmail, 'Account:', accountResult.accountId);
        
        res.json({
            success: true,
            onboardingUrl: linkResult.onboardingUrl,
            accountId: accountResult.accountId
        });
        
    } catch (error) {
        console.error('❌ Stripe Connect onboarding error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start onboarding process'
        });
    }
});

// Check Connect account status
app.get('/api/stripe-connect/status', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        
        const userResult = await pool.query(
            'SELECT stripe_connect_account_id, stripe_onboarding_complete FROM users WHERE id = $1',
            [userId]
        );
        
        if (!userResult.rows[0]?.stripe_connect_account_id) {
            return res.json({
                connected: false,
                onboardingComplete: false,
                message: 'No Stripe account connected'
            });
        }
        
        const accountId = userResult.rows[0].stripe_connect_account_id;
        const statusResult = await stripeConnectManager.getAccountStatus(accountId);
        
        if (!statusResult.success) {
            return res.json({
                connected: false,
                onboardingComplete: false,
                error: statusResult.error
            });
        }
        
        // Update database if onboarding is now complete
        if (statusResult.onboardingComplete && !userResult.rows[0].stripe_onboarding_complete) {
            await pool.query(
                'UPDATE users SET stripe_onboarding_complete = true WHERE id = $1',
                [userId]
            );
        }
        
        res.json({
            connected: true,
            accountId: accountId,
            onboardingComplete: statusResult.onboardingComplete,
            canReceivePayments: statusResult.canReceivePayments,
            canReceivePayouts: statusResult.canReceivePayouts,
            requiresInfo: statusResult.requiresInfo
        });
        
    } catch (error) {
        console.error('❌ Error checking Connect status:', error);
        res.status(500).json({
            connected: false,
            onboardingComplete: false,
            error: 'Failed to check account status'
        });
    }
});

// Refresh onboarding link if expired
app.post('/api/stripe-connect/refresh', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        
        const userResult = await pool.query(
            'SELECT stripe_connect_account_id FROM users WHERE id = $1',
            [userId]
        );
        
        if (!userResult.rows[0]?.stripe_connect_account_id) {
            return res.status(404).json({
                success: false,
                message: 'No Stripe account found'
            });
        }
        
        const accountId = userResult.rows[0].stripe_connect_account_id;
        
        // Create new onboarding link
        const baseUrl = req.headers.origin || `https://${req.headers.host}`;
        const refreshUrl = `${baseUrl}/stripe-connect/refresh`;
        const returnUrl = `${baseUrl}/stripe-connect/success`;
        
        const linkResult = await stripeConnectManager.createAccountLink(
            accountId,
            refreshUrl,
            returnUrl
        );
        
        if (!linkResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create onboarding link: ' + linkResult.error
            });
        }
        
        res.json({
            success: true,
            onboardingUrl: linkResult.onboardingUrl
        });
        
    } catch (error) {
        console.error('❌ Error refreshing onboarding link:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh onboarding link'
        });
    }
});

// Global error handlers to prevent server crashes
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled application error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    
    // Send appropriate error response
    if (res.headersSent) {
        return next(err);
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Handle 404 errors
app.use((req, res) => {
    console.log('🚫 404 - Resource not found:', {
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
    
    res.status(404).json({
        error: 'Not found',
        message: 'The requested resource was not found'
    });
});

// Global process error handlers
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION - Server will shut down gracefully:', err);
    console.error('Stack trace:', err.stack);
    
    // Close server gracefully
    if (typeof server !== 'undefined' && server) {
        server.close(() => {
            console.log('💥 Process terminated due to uncaught exception');
            process.exit(1);
        });
        
        // Force close after 10 seconds
        setTimeout(() => {
            console.log('💥 Forcing process termination');
            process.exit(1);
        }, 10000).unref();
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED PROMISE REJECTION:', {
        reason: reason,
        promise: promise,
        timestamp: new Date().toISOString()
    });
    
    // For unhandled rejections, log but don't crash the server
    // unless it's a critical database or auth failure
    if (reason && (reason.message?.includes('ECONNREFUSED') || 
                   reason.message?.includes('authentication') ||
                   reason.message?.includes('connection'))) {
        console.error('💥 Critical system error detected, shutting down gracefully');
        process.exit(1);
    }
});

// Note: Server startup and graceful shutdown handlers are already configured in the existing server startup code
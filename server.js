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

// Direct email service using nodemailer
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Import notification services
const { initializeNotificationServices, sendWelcomeEmail, sendBillingNotification, broadcastFeatureUpdate } = require('./server/notifications');

// Import payment plan services
const PaymentPlanManager = require('./server/paymentPlans');
const PaymentScheduler = require('./server/paymentScheduler');

// Import contract management
const ContractManager = require('./server/contracts');

// PostgreSQL database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Firebase Admin SDK
try {
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON 
        ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        : null;
        
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
        console.log('Firebase Admin SDK initialized successfully');
    } else {
        console.log('⚠️ Firebase credentials not provided - authentication disabled');
    }
} catch (error) {
    console.log('⚠️ Firebase Admin SDK initialization failed:', error.message);
}

// Firebase Authentication middleware
const isAuthenticated = async (req, res, next) => {
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
            if (process.env.SMTP_HOST) {
                return nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                });
            } else {
                // Fallback to Gmail SMTP if no SMTP_HOST specified
                console.log(`Email domain ${emailDomain} doesn't have built-in SMTP config, using Gmail as fallback`);
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
            }
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
        let paramCount = 1;
        
        Object.keys(updates).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
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
        
        setClause.push(`updated_at = CURRENT_TIMESTAMP`);
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
const storage = multer.diskStorage({
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
    storage: storage,
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
        console.log(`🔍 File filter check: ${file.originalname} (${file.mimetype})`);
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes

// Get all sessions
// This endpoint is defined earlier in the file - removing duplicate

app.get('/api/sessions', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Debug logging to see what user is requesting sessions
        console.log('🔍 Sessions requested by user:', {
            uid: userId,
            email: req.user.email,
            displayName: req.user.displayName
        });
        
        const sessions = await getAllSessions(userId);
        console.log(`📋 Found ${sessions.length} sessions for user ${userId}`);
        
        if (sessions.length === 0) {
            console.log('⚠️ No sessions found. Checking if user should have access to existing sessions...');
            
            // Check if this user should have access to the lancecasselman@icloud.com sessions
            if (req.user.email === 'lancecasselman@icloud.com' || req.user.email === 'lancecasselman2011@gmail.com') {
                console.log('🔧 User should have access to sessions. Checking raw database...');
                const debugResult = await pool.query('SELECT user_id, client_name FROM photography_sessions LIMIT 5');
                console.log('📋 Sample sessions in database:', debugResult.rows);
            }
        }
        
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Create new session
app.post('/api/sessions', isAuthenticated, async (req, res) => {
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
        
        const userId = req.user.uid;
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
    
    console.log(`🔍 Starting upload for session ${sessionId}...`);
    
    // Disable all timeouts for upload requests
    req.setTimeout(0); // Infinite timeout
    res.setTimeout(0); // Infinite timeout
    
    console.log(`📊 Request started - method: ${req.method}, content-length: ${req.headers['content-length']}`);
    console.log(`📊 Headers:`, req.headers);
    
    console.log(`🚀 Starting multer processing for session ${sessionId}...`);
    
    upload.array('photos')(req, res, async (uploadError) => {
        console.log(`📊 Multer callback triggered - error: ${uploadError ? 'YES' : 'NO'}`);
        
        if (uploadError) {
            console.error('❌ Multer upload error:', uploadError);
            console.error('❌ Error stack:', uploadError.stack);
            console.error('❌ Error code:', uploadError.code);
            console.error('❌ Error field:', uploadError.field);
            
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
        
        console.log(`📊 Multer success - starting processing...`);
        console.log(`📊 Files received: ${req.files ? req.files.length : 0}`);
        
        if (!req.files || req.files.length === 0) {
            console.log('❌ No files received in request');
            if (!res.headersSent) {
                return res.status(400).json({ error: 'No files uploaded' });
            }
            return;
        }

        const uploadedPhotos = [];
        
        console.log(`📸 Processing ${req.files.length} files for session ${sessionId}`);

        // Process files with detailed logging
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            try {
                console.log(`📁 Processing file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
                
                const photoData = {
                    filename: file.filename,
                    originalName: file.originalname,
                    size: file.size,
                    uploadDate: new Date().toISOString()
                };
                
                uploadedPhotos.push(photoData);
                console.log(`✅ File processed: ${file.originalname}`);
                
            } catch (fileError) {
                console.error(`❌ Error processing file ${file.originalname}:`, fileError);
                // Continue with other files
            }
        }

        console.log(`📊 Attempting to update session ${sessionId} with ${uploadedPhotos.length} photos`);

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
            console.log(`📊 Background database update starting...`);
            const session = await getSessionById(sessionId);
            if (session) {
                const existingPhotos = session.photos || [];
                const updatedPhotos = [...existingPhotos, ...uploadedPhotos];
                await updateSession(sessionId, { photos: updatedPhotos });
                console.log(`✅ Background database update completed: ${uploadedPhotos.length} new photos`);
            } else {
                console.error(`❌ Session ${sessionId} not found for background database update`);
            }
        } catch (dbError) {
            console.error(`❌ Background database update error:`, dbError);
            // Don't send response here as we already sent one above
        }

        return; // Exit early to prevent double response
    });
});

// DEAD CODE BLOCK REMOVED - was unreachable after return statement

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
                <title>📸 Photo Gallery - ${session.clientName}</title>
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
                        <h1>📸 Photo Gallery</h1>
                        <p>Client: <strong>${session.clientName}</strong> | Session: ${session.sessionType} | Date: ${new Date(session.dateTime).toLocaleDateString()}</p>
                    </div>
                    
                    <div class="photo-grid" id="photoGrid">
                        ${photos.map((photo, index) => `
                            <div class="photo-item">
                                <img src="/uploads/${photo.filename}" alt="Photo ${index + 1}" onclick="openLightbox('/uploads/${photo.filename}')">
                                <div class="photo-controls">
                                    <span class="photo-number">📷 Photo ${index + 1}</span>
                                    <button class="download-btn" onclick="downloadPhoto('/uploads/${photo.filename}', '${photo.filename}')">
                                        💾 Download
                                    </button>
                                </div>
                            </div>
                        `).join('')}
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
                                const response = await fetch('/uploads/' + photo.filename);
                                const blob = await response.blob();
                                folder.file(photo.filename, blob);
                            }
                            
                            const content = await zip.generateAsync({type: 'blob'});
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(content);
                            link.download = '${session.clientName}_Photos.zip';
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
            <h2 style="color: #667eea;">📸 Your Photo Gallery is Ready!</h2>
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
            const smsMessage = `📸 ${session.clientName}, your ${session.sessionType} photos are ready! View gallery: ${galleryUrl}`;
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
                    <h1 style="margin: 0;">📧 Email Preview</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">Preview of gallery notification email</p>
                </div>
                <div class="email-meta">
                    <strong>To:</strong> ${emailData.to}<br>
                    <strong>Subject:</strong> ${emailData.subject}<br>
                    <strong>Created:</strong> ${new Date(emailData.createdAt).toLocaleString()}<br><br>
                    <a href="mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.text)}" class="mailto-btn">📧 Open in Email Client</a>
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
        if (session.userId !== user.sub) {
            return res.status(403).json({ error: 'Unauthorized access to session' });
        }
        
        const result = await paymentManager.createPaymentPlan(
            sessionId, 
            user.sub, 
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
        if (session.userId !== user.sub) {
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
    const user = getCurrentUser(req);
    
    try {
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Verify user owns this session
        if (session.userId !== user.sub) {
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
        
        const contract = await contractManager.createContract(sessionId, user.sub, contractType, contractData);
        
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
    const user = getCurrentUser(req);
    
    try {
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Verify user owns this session
        if (session.userId !== user.sub) {
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
    const user = getCurrentUser(req);
    
    try {
        const contract = await contractManager.getContract(contractId);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // Verify user owns this contract
        if (contract.user_id !== user.sub) {
            return res.status(403).json({ error: 'Unauthorized access to contract' });
        }
        
        // Mark contract as sent
        const updatedContract = await contractManager.sendContract(contractId);
        
        // Generate signing URL
        const host = req.get('host');
        let baseUrl;
        
        if (host && host.includes('localhost')) {
            const replitDomains = process.env.REPLIT_DOMAINS;
            if (replitDomains) {
                const domains = replitDomains.split(',');
                baseUrl = `https://${domains[0]}`;
            } else {
                baseUrl = `${req.protocol}://${host}`;
            }
        } else {
            baseUrl = `https://${host}`;
        }
        
        const signingUrl = `${baseUrl}/contract-signing.html?token=${contract.access_token}`;
        
        // Send email notification to client
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = createEmailTransporter();
                const emailSubject = `📝 Contract Ready for Signature - ${contract.contract_title}`;
                const emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                            <h1>📝 Contract Ready for Signature</h1>
                            <h2>The Legacy Photography</h2>
                        </div>
                        
                        <div style="padding: 30px; background: #f9f9f9;">
                            <h3>Hello ${contract.client_name},</h3>
                            
                            <p>Your photography contract is ready for your electronic signature.</p>
                            
                            <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
                                <h4>${contract.contract_title}</h4>
                                <p><strong>Photographer:</strong> ${contract.photographer_name}</p>
                                <p><strong>Created:</strong> ${new Date(contract.created_at).toLocaleDateString()}</p>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${signingUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                    📝 Sign Contract Now
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px;">
                                Please review the contract carefully and sign electronically using the link above. 
                                Once signed, you'll receive a copy for your records.
                            </p>
                            
                            <p style="color: #666; font-size: 14px;">
                                If you have any questions, please don't hesitate to contact us.
                            </p>
                        </div>
                        
                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p>The Legacy Photography<br>
                            Email: ${contract.photographer_email}<br>
                            Creating lasting memories through professional photography</p>
                        </div>
                    </div>
                `;
                
                await transporter.sendMail({
                    from: `"The Legacy Photography" <${process.env.EMAIL_USER}>`,
                    to: contract.client_email,
                    subject: emailSubject,
                    html: emailBody
                });
                
                console.log(`✅ Contract email sent to: ${contract.client_email}`);
            } catch (emailError) {
                console.error('Error sending contract email:', emailError);
            }
        }
        
        res.json({
            message: 'Contract sent successfully',
            signingUrl: signingUrl,
            contract: updatedContract
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
        
        console.log('✅ Onboarding wizard data saved successfully for user:', userId);
        res.json({ success: true, message: 'Setup completed successfully' });
        
    } catch (error) {
        console.error('❌ Error saving wizard data:', error);
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

// Serve onboarding wizard
app.get('/onboarding', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth.html?return=/onboarding');
    }
    res.sendFile(path.join(__dirname, 'onboarding.html'));
});

// Serve admin dashboard with authentication requirement  
app.get('/admin', (req, res) => {
    if (!req.session || !req.session.user) {
        // Redirect to new login page to bypass cache issues
        return res.redirect('/auth.html?return=/admin');
    }
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve auth page for non-authenticated users
app.get('/auth.html', (req, res) => {
    // Add cache-busting headers to prevent caching of auth.html
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.sendFile(path.join(__dirname, 'auth.html'));
});

// Serve public website pages - /site/:username
app.get('/site/:username', async (req, res) => {
    try {
        const username = req.params.username;
        
        // Get website data from Firestore
        const websiteDoc = await admin.firestore()
            .collection('published_websites')
            .doc(username)
            .get();
            
        if (!websiteDoc.exists) {
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
                        <h1>📸 Site Not Found</h1>
                        <p>The photography website "${username}" doesn't exist or hasn't been published yet.</p>
                        <a href="/">← Back to Photography Management System</a>
                    </div>
                </body>
                </html>
            `);
        }
        
        const websiteData = websiteDoc.data();
        
        // Generate dynamic website based on theme and content
        const themeStyles = getThemeStyles(websiteData.theme);
        const websiteHTML = generatePublicWebsite(websiteData);
        
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

// Helper function to generate public website HTML
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
                <a href="mailto:lance@thelegacyphotography.com" class="contact-btn">📧 Send Email</a>
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
    if (!req.session || !req.session.user) {
        // Redirect to new login page to bypass cache issues
        return res.redirect('/auth.html?return=/app');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Alternative dashboard route
app.get('/dashboard', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/auth.html?return=/dashboard');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files last to ensure routes run first
app.use(express.static(__dirname));

// Start server
// Initialize database and start server
async function startServer() {
    await initializeDatabase();
    
    // Initialize notification services
    initializeNotificationServices();
    
    // Start automated payment scheduler
    paymentScheduler.start();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`📸 Photo Session Scheduler running on http://0.0.0.0:${PORT}`);
        console.log('Database connected and ready');
        if (process.env.TEST_MODE === 'true') {
            console.log('🧪 TEST MODE ENABLED - Development authentication bypass active');
        } else {
            console.log('🔐 Authentication required for all access - no anonymous mode');
        }
    });
    
    // Set INFINITE timeouts for large uploads - MAXIMUM settings
    server.timeout = 0; // 0 = infinite
    server.keepAliveTimeout = 0; // 0 = infinite  
    server.headersTimeout = 0; // 0 = infinite
    server.requestTimeout = 0; // 0 = infinite
    server.maxHeadersCount = 0; // Remove header count limit
    console.log('📁 Server configured with INFINITE timeouts - no upload limits!');
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

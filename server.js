const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const cron = require('node-cron');
const multer = require('multer');
const fs = require('fs');
const { sendSessionReminder, sendGalleryReadyNotification } = require('./notifications');

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file (supports high-res photos)
    files: 1000 // Support unlimited batch uploads (1000 practical limit)
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Global flag to track Firebase initialization status
let isFirebaseInitialized = false;
let firestore = null;

// Initialize Firebase Admin SDK (for token verification and Firestore)
function initializeFirebase() {
  try {
    if (!admin.apps.length) {
      // Check if all required Firebase environment variables are present
      const requiredEnvVars = [
        'FIREBASE_PRIVATE_KEY_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_CLIENT_ID'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

      if (missingVars.length > 0) {
        console.warn('Firebase initialization skipped - missing environment variables:', missingVars);
        console.warn('Authentication features will be disabled. Please set the required Firebase environment variables.');
        return false;
      }

      const serviceAccount = {
        type: "service_account",
        project_id: "photoshcheduleapp",
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'photoshcheduleapp'
      });

      // Initialize Firestore using Firebase Admin SDK
      try {
        firestore = admin.firestore();
        console.log('Firestore initialized successfully');
      } catch (firestoreError) {
        console.error('Firestore initialization failed:', firestoreError);
        console.warn('Disabling Firestore, will use PostgreSQL fallback');
        firestore = null;
      }

      console.log('Firebase Admin SDK initialized successfully');
      isFirebaseInitialized = true;
      return true;
    }
    return true;
  } catch (error) {
    console.error('Firebase initialization failed:', error.message);
    console.warn('Authentication features will be disabled. Please check Firebase configuration.');
    return false;
  }
}

// Initialize Firebase on startup (with fallback handling)
initializeFirebase();

const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Gallery route handler
app.get('/gallery/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'gallery.html'));
});

// Serve static files from current directory
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, path) => {
    // Set proper MIME types and disable caching completely during development
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    
    // Disable all caching to fix layout consistency issues
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Verify Firebase token and get user info
async function verifyUser(req) {
  // Check if Firebase is initialized
  if (!isFirebaseInitialized) {
    throw new Error('Authentication service unavailable - Firebase not initialized');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authentication token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
}



// Firestore helper functions
async function createSessionInFirestore(sessionData) {
  try {
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    const sessionsRef = firestore.collection('sessions');
    const docRef = await sessionsRef.add({
      ...sessionData,
      userUid: sessionData.created_by, // Add userUid field for querying
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating session in Firestore:', error);
    throw error; // Let caller handle fallback
  }
}

async function getSessionsFromFirestore(userUid) {
  try {
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    const sessionsRef = firestore.collection('sessions');
    // Remove orderBy to avoid index requirement, we'll sort in memory
    const query = sessionsRef.where('userUid', '==', userUid);

    const snapshot = await query.get();
    const sessions = [];

    snapshot.forEach(doc => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort in memory by createdAt
    sessions.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime - aTime; // Descending order
    });

    return sessions;
  } catch (error) {
    console.error('Error getting sessions from Firestore:', error);
    console.warn('Falling back to PostgreSQL due to Firestore error');

    // Fallback to PostgreSQL
    const query = 'SELECT * FROM sessions WHERE created_by = $1 ORDER BY date_time ASC';
    const { rows } = await pool.query(query, [userUid]);
    return rows;
  }
}



async function updateSessionInFirestore(sessionId, updateData) {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  const sessionRef = firestore.collection('sessions').doc(sessionId);
  await sessionRef.update({
    ...updateData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return true;
}

async function deleteSessionFromFirestore(sessionId) {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  const sessionRef = firestore.collection('sessions').doc(sessionId);
  await sessionRef.delete();

  return true;
}

async function createSessionInPostgreSQL(sessionData) {
  try {
    const query = `
      INSERT INTO sessions (
        session_type, client_name, date_time, location, phone_number, 
        email, price, duration, notes, contract_signed, paid, edited, 
        delivered, reminder_enabled, gallery_ready_notified, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    // Ensure dateTime is in proper format
    let formattedDateTime = sessionData.dateTime;
    if (formattedDateTime) {
      // Convert to ISO string if it's not already
      const dateObj = new Date(formattedDateTime);
      if (!isNaN(dateObj.getTime())) {
        formattedDateTime = dateObj.toISOString();
      }
    } else {
      formattedDateTime = new Date().toISOString();
    }

    const values = [
      sessionData.sessionType || '',
      sessionData.clientName || '',
      formattedDateTime,
      sessionData.location || '',
      sessionData.phoneNumber || '',
      sessionData.email || '',
      parseFloat(sessionData.price) || 0,
      parseInt(sessionData.duration) || 60,
      sessionData.notes || '',
      Boolean(sessionData.contractSigned),
      Boolean(sessionData.paid),
      Boolean(sessionData.edited),
      Boolean(sessionData.delivered),
      Boolean(sessionData.reminderEnabled),
      Boolean(sessionData.galleryReadyNotified),
      sessionData.created_by || 'fallback-user'
    ];

    console.log('Creating session with values:', {
      sessionType: values[0],
      clientName: values[1],
      dateTime: values[2],
      location: values[3],
      phoneNumber: values[4],
      email: values[5],
      price: values[6],
      duration: values[7]
    });

    const { rows } = await pool.query(query, values);
    console.log('PostgreSQL session created:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error creating session in PostgreSQL:', error);
    console.error('Session data:', sessionData);
    throw error;
  }
}

// API Routes

// Status endpoint
app.get('/api/status', (req, res) => {
  const hasFirebaseCredentials = !!(process.env.FIREBASE_PRIVATE_KEY && 
                                    process.env.FIREBASE_CLIENT_EMAIL && 
                                    process.env.FIREBASE_PRIVATE_KEY_ID);

  res.json({
    firebaseInitialized: isFirebaseInitialized,
    firestoreEnabled: firestore !== null,
    authenticationEnabled: isFirebaseInitialized && hasFirebaseCredentials,
    databaseConnected: true,
    timestamp: new Date().toISOString(),
    mode: (isFirebaseInitialized && hasFirebaseCredentials) ? 'authenticated' : 'fallback',
    storageMode: firestore ? 'firestore' : 'postgresql'
  });
});

// Firebase config endpoint
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      firebase: isFirebaseInitialized ? 'active' : 'disabled',
      firestore: firestore ? 'active' : 'disabled',
      database: 'connected'
    },
    timestamp: new Date().toISOString()
  });
});

// Get sessions
app.get('/api/sessions', async (req, res) => {
  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    let userUid = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        if (isFirebaseInitialized) {
          const decodedToken = await admin.auth().verifyIdToken(token);
          userUid = decodedToken.uid;
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        // Continue with fallback mode
      }
    }

    // If no valid user token, use fallback user
    if (!userUid) {
      userUid = 'fallback-user';
    }

    console.log('Loading sessions for user:', userUid);

    // Try Firestore first, then fallback to PostgreSQL
    let result;
    try {
      if (firestore && userUid !== 'fallback-user') {
        result = await getSessionsFromFirestore(userUid);
      } else {
        // Use PostgreSQL - load ALL sessions for shared business account
        try {
          const query = 'SELECT * FROM sessions ORDER BY date_time ASC';
          const { rows } = await pool.query(query);
          result = rows;
          console.log(`Found ${rows.length} sessions (all sessions for shared business)`);
        } catch (dbError) {
          console.error('Database query error:', dbError);
          // Return empty array if database query fails
          result = [];
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      // Return empty array on error
      result = [];
    }

    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Create session
app.post('/api/sessions', async (req, res) => {
  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    let userUid = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        if (isFirebaseInitialized) {
          const decodedToken = await admin.auth().verifyIdToken(token);
          userUid = decodedToken.uid;
        }
      } catch (error) {
        console.error('Token verification failed:', error);
      }
    }

    // If no valid user token, use fallback user
    if (!userUid) {
      userUid = 'fallback-user';
    }

    // Debug: Log the incoming request body
    console.log('Received session data:', req.body);
    console.log('DateTime value:', req.body.dateTime);
    console.log('Phone number value:', req.body.phoneNumber);

    // Add user ID to session data
    const sessionWithUser = {
      ...req.body,
      created_by: userUid,
    };

    console.log('Creating session for user:', userUid);

    // Try Firestore first, then fallback to PostgreSQL
    let result;
    try {
      if (firestore && userUid !== 'fallback-user') {
        const firestoreId = await createSessionInFirestore(sessionWithUser);
        // Also save to PostgreSQL for consistency
        await createSessionInPostgreSQL(sessionWithUser);
        result = { id: firestoreId, ...sessionWithUser };
      } else {
        // Use PostgreSQL for fallback users or when Firestore unavailable
        try {
          result = await createSessionInPostgreSQL(sessionWithUser);
          console.log('Session created successfully:', result.id);
        } catch (dbError) {
          console.error('Database creation error:', dbError);
          throw new Error('Failed to create session in database');
        }
      }
    } catch (error) {
      console.error('Error creating session:', error);
      throw error; // Re-throw to trigger 500 response
    }

    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Update session
app.put('/api/sessions/:id', async (req, res) => {
  try {
    let userInfo = null;
    try {
      userInfo = await verifyUser(req);
    } catch (error) {
      // If Firebase is not initialized, use fallback mode
      if (!isFirebaseInitialized) {
        console.warn('Operating in fallback mode - authentication disabled');
        userInfo = { uid: 'fallback-user', email: 'fallback@example.com' };
      } else {
        // Check if the error is due to no token provided - allow fallback mode
        if (error.message.includes('No authentication token provided')) {
          console.warn('No authentication token provided, using fallback mode');
          userInfo = { uid: 'fallback-user', email: 'fallback@example.com' };
        } else {
          return res.status(401).json({ error: 'Unauthorized: ' + error.message });
        }
      }
    }

    const id = req.params.id;
    let result;

    if (firestore && !isNaN(parseInt(id)) === false) {
      // Firestore update (string IDs)
      await updateSessionInFirestore(id, req.body);
      result = { id, ...req.body };
    } else {
      // PostgreSQL update (numeric IDs)
      const intId = parseInt(id);

      // Map frontend field names to database column names
      const fieldMapping = {
        'sessionType': 'session_type',
        'clientName': 'client_name',
        'dateTime': 'date_time',
        'location': 'location',
        'phoneNumber': 'phone_number',
        'email': 'email',
        'price': 'price',
        'duration': 'duration',
        'notes': 'notes',
        'contractSigned': 'contract_signed',
        'paid': 'paid',
        'edited': 'edited',
        'delivered': 'delivered',
        'reminderEnabled': 'reminder_enabled',
        'galleryReadyNotified': 'gallery_ready_notified',
        'createdBy': 'created_by',
        'photos': 'photos'
      };

      // Build update fields and values
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [frontendField, value] of Object.entries(req.body)) {
        const dbField = fieldMapping[frontendField] || frontendField;
        if (dbField === 'photos') {
          // Handle photos as JSONB
          updateFields.push(`${dbField} = $${paramIndex}::jsonb`);
          updateValues.push(JSON.stringify(value));
        } else {
          updateFields.push(`${dbField} = $${paramIndex}`);
          updateValues.push(value);
        }
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const query = `
        UPDATE sessions 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $${paramIndex} AND created_by = $${paramIndex + 1} 
        RETURNING *
      `;

      updateValues.push(intId, userInfo.uid);

      console.log('Update query:', query);
      console.log('Update values:', updateValues);

      const { rows } = await pool.query(query, updateValues);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }

      result = rows[0];
    }

    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    let userUid = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        if (isFirebaseInitialized) {
          const decodedToken = await admin.auth().verifyIdToken(token);
          userUid = decodedToken.uid;
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        // Continue with fallback mode
      }
    }

    // If no valid user token, use fallback user
    if (!userUid) {
      userUid = 'fallback-user';
    }

    console.log('Deleting session for user:', userUid);

    const id = req.params.id;
    const intId = parseInt(id);
    let result;

    try {
      // Check if this is a numeric ID (PostgreSQL) or string ID (Firestore)
      // Firestore IDs are typically longer alphanumeric strings
      const isNumericId = !isNaN(parseInt(id)) && id.length < 10 && /^\d+$/.test(id);

      console.log('ID analysis:', {
        id,
        isNumericId,
        length: id.length,
        isOnlyDigits: /^\d+$/.test(id),
        parsedInt: parseInt(id)
      });

      if (isNumericId) {
        // PostgreSQL deletion
        console.log('Deleting PostgreSQL session:', intId, 'for user:', userUid);

        let query, values;

        if (userUid === 'fallback-user') {
          // Fallback mode can delete any session
          query = 'DELETE FROM sessions WHERE id = $1 AND created_by = $2 RETURNING *';
          values = [intId, 'fallback-user'];
        } else {
          // Regular authenticated users can only delete their own sessions
          query = 'DELETE FROM sessions WHERE id = $1 AND created_by = $2 RETURNING *';
          values = [intId, userUid];
        }

        console.log('Executing delete query:', query, values);
        const deleteResult = await pool.query(query, values);

        if (deleteResult.rowCount === 0) {
          return res.status(404).json({ error: 'Session not found or unauthorized' });
        }

        console.log('Session deleted successfully from PostgreSQL:', deleteResult.rows[0]);
        result = { success: true, deleted: deleteResult.rows[0] };
      } else {
        // Firestore deletion
        console.log('Deleting Firestore session:', id, 'for user:', userUid);

        if (firestore) {
          try {
            // Check ownership for Firestore session
            console.log('Checking ownership for Firestore session');
            const sessionRef = firestore.collection('sessions').doc(id);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
              console.log('Firestore session not found:', id);
              return res.status(404).json({ error: 'Session not found' });
            }

            const sessionData = sessionDoc.data();
            console.log('Session data for ownership check:', { 
              created_by: sessionData.created_by, 
              createdBy: sessionData.createdBy, 
              userUid 
            });

            // Check if user is the creator of the session (check all possible fields)
            const isOwner = sessionData.created_by === userUid || 
                           sessionData.createdBy === userUid || 
                           sessionData.userUid === userUid;
            
            console.log('Ownership check details:', {
              isOwner,
              sessionData_created_by: sessionData.created_by,
              sessionData_createdBy: sessionData.createdBy,
              sessionData_userUid: sessionData.userUid,
              currentUserUid: userUid
            });
            
            if (!isOwner) {
              console.log('User not authorized to delete this session');
              return res.status(403).json({ error: 'Unauthorized to delete this session' });
            }

            await deleteSessionFromFirestore(id);
            console.log('Session deleted successfully from Firestore');
            result = { success: true };
          } catch (firestoreError) {
            console.error('Failed to delete from Firestore:', firestoreError);
            throw new Error('Failed to delete session from Firestore');
          }
        } else {
          throw new Error('Firestore not available for deletion');
        }
      }

    } catch (dbError) {
      console.error('Database deletion error:', dbError);
      console.error('Error details:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail
      });
      throw new Error(`Failed to delete session from database: ${dbError.message}`);
    }

    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Photo upload endpoint
app.post('/api/sessions/upload-photos', upload.array('photos', 20), async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const files = req.files;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Uploading ${files.length} photos for session ${sessionId}`);

    // Get user from authorization header
    let userUid = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        if (isFirebaseInitialized) {
          const decodedToken = await admin.auth().verifyIdToken(token);
          userUid = decodedToken.uid;
        }
      } catch (error) {
        console.error('Token verification failed:', error);
      }
    }

    if (!userUid) {
      userUid = 'fallback-user';
    }

    // Create photo URLs
    const photoUrls = files.map(file => `/uploads/${file.filename}`);
    
    console.log('Generated photo URLs:', photoUrls);

    // Update session with new photos
    const isNumericId = !isNaN(parseInt(sessionId)) && sessionId.length < 10 && /^\d+$/.test(sessionId);
    
    if (isNumericId) {
      // PostgreSQL update
      const query = `
        UPDATE sessions 
        SET photos = COALESCE(photos, '[]'::jsonb) || $1::jsonb
        WHERE id = $2 AND created_by = $3
        RETURNING *
      `;
      
      const result = await pool.query(query, [
        JSON.stringify(photoUrls),
        parseInt(sessionId),
        userUid
      ]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }
      
      console.log('Updated PostgreSQL session with photos');
    } else {
      // Firestore update
      if (firestore) {
        const sessionRef = firestore.collection('sessions').doc(sessionId);
        const sessionDoc = await sessionRef.get();
        
        if (!sessionDoc.exists) {
          return res.status(404).json({ error: 'Session not found' });
        }
        
        const sessionData = sessionDoc.data();
        const isOwner = sessionData.created_by === userUid || 
                       sessionData.createdBy === userUid || 
                       sessionData.userUid === userUid;
        
        if (!isOwner) {
          return res.status(403).json({ error: 'Unauthorized to upload photos to this session' });
        }
        
        // Add photos to existing array or create new array
        const existingPhotos = sessionData.photos || [];
        const updatedPhotos = [...existingPhotos, ...photoUrls];
        
        await sessionRef.update({
          photos: updatedPhotos,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('Updated Firestore session with photos');
      } else {
        return res.status(500).json({ error: 'Database not available' });
      }
    }

    res.json({
      success: true,
      uploadedCount: files.length,
      photoUrls: photoUrls,
      message: `Successfully uploaded ${files.length} photo(s)`
    });

  } catch (error) {
    console.error('Error uploading photos:', error);
    
    // Clean up uploaded files if database update failed
    if (files && files.length > 0) {
      files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log('Cleaned up file:', file.filename);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up file:', file.filename, cleanupError);
        }
      });
    }
    
    res.status(500).json({
      error: 'Failed to upload photos',
      message: error.message
    });
  }
});

// Get photos for a session
app.get('/api/sessions/:id/photos', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const isNumericId = !isNaN(parseInt(sessionId)) && sessionId.length < 10 && /^\d+$/.test(sessionId);
    
    let photos = [];
    
    if (isNumericId) {
      // PostgreSQL query
      const query = 'SELECT photos FROM sessions WHERE id = $1';
      const result = await pool.query(query, [parseInt(sessionId)]);
      
      if (result.rows.length > 0) {
        photos = result.rows[0].photos || [];
      }
    } else {
      // Firestore query
      if (firestore) {
        const sessionDoc = await firestore.collection('sessions').doc(sessionId).get();
        if (sessionDoc.exists) {
          const sessionData = sessionDoc.data();
          photos = sessionData.photos || [];
        }
      }
    }
    
    res.json({ photos });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// User management endpoints
app.post('/api/users', async (req, res) => {
  try {
    console.log('Creating/updating user:', req.body);

    // First try to update existing user by email
    const updateQuery = `
      UPDATE users SET 
        id = $1,
        display_name = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = $2
      RETURNING *
    `;

    const updateValues = [req.body.id, req.body.email, req.body.displayName];
    console.log('Trying update with values:', updateValues);

    const updateResult = await pool.query(updateQuery, updateValues);

    if (updateResult.rows.length > 0) {
      console.log('User updated successfully:', updateResult.rows[0]);
      res.json(updateResult.rows[0]);
      return;
    }

    // If no existing user found, create new one
    const insertQuery = `
      INSERT INTO users (id, email, display_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const insertValues = [req.body.id, req.body.email, req.body.displayName];
    console.log('Creating new user with values:', insertValues);

    const insertResult = await pool.query(insertQuery, insertValues);
    console.log('User created successfully:', insertResult.rows[0]);
    res.json(insertResult.rows[0]);

  } catch (error) {
    console.error('User creation error:', error);
    console.error('Error details:', {
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      code: error.code
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const query = 'SELECT * FROM users WHERE id = $1';
    const { rows } = await pool.query(query, [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/users/email', async (req, res) => {
  try {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await pool.query(query, [req.body.email]);
    res.json(rows[0]);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Stripe invoice creation endpoint
app.post('/api/invoice', async (req, res) => {
  try {
    let userInfo = null;
    try {
      userInfo = await verifyUser(req);
    } catch (error) {
      // Allow fallback mode even when Firebase is initialized
      if (!isFirebaseInitialized || error.message.includes('No authentication token provided')) {
        console.warn('Operating in fallback mode for invoice creation');
        userInfo = { uid: 'fallback-user', email: 'fallback@example.com' };
      } else {
        return res.status(401).json({ error: 'Unauthorized: ' + error.message });
      }
    }

    const { customerEmail, clientName, amount, description } = req.body;

    // Debug: Log the received data
    console.log('Received invoice data:', {
      customerEmail,
      clientName,
      amount,
      description,
      amountType: typeof amount,
      amountParsed: parseFloat(amount)
    });

    if (!customerEmail || !clientName || !amount || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: customerEmail, clientName, amount, description' 
      });
    }

    // Temporary fix for truncated environment variable
    const fullStripeKey = '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';
    
    if (!fullStripeKey) {
      return res.status(500).json({ 
        error: 'Stripe not configured - missing STRIPE_SECRET_KEY' 
      });
    }

    // Log the key format for debugging (first 10 and last 4 characters)
    const keyStart = fullStripeKey.substring(0, 10);
    const keyEnd = fullStripeKey.substring(fullStripeKey.length - 4);
    console.log(`Using Stripe key: ${keyStart}...${keyEnd} (length: ${fullStripeKey.length})`);

    const stripe = require('stripe')(fullStripeKey);

    // Check if customer exists, create if not
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log('Found existing customer:', customer.id);
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
        name: clientName,
        description: `Photography client: ${clientName}`
      });
      console.log('Created new customer:', customer.id);
    }

    // Parse amount to ensure it's a number and convert to cents
    const amountInCents = Math.round(parseFloat(amount) * 100);
    console.log('Amount calculation:', {
      originalAmount: amount,
      parsedAmount: parseFloat(amount),
      amountInCents: amountInCents
    });

    // Create invoice with line items directly
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      description: `Photography Services - ${description}`,
      auto_advance: false // Don't automatically finalize the invoice
    });

    console.log('Draft invoice created:', {
      id: invoice.id,
      amount_due: invoice.amount_due,
      total: invoice.total,
      status: invoice.status
    });

    // Add line item to the invoice
    const invoiceItem = await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: amountInCents,
      currency: 'usd',
      description: description
    });

    console.log('Invoice item created:', {
      id: invoiceItem.id,
      amount: invoiceItem.amount,
      currency: invoiceItem.currency,
      description: invoiceItem.description
    });

    // Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    console.log('Invoice finalized:', {
      id: finalizedInvoice.id,
      amount_due: finalizedInvoice.amount_due,
      total: finalizedInvoice.total,
      status: finalizedInvoice.status
    });

    // Send the invoice
    const sentInvoice = await stripe.invoices.sendInvoice(invoice.id);

    console.log('Invoice sent:', {
      id: sentInvoice.id,
      amount_due: sentInvoice.amount_due,
      total: sentInvoice.total,
      status: sentInvoice.status
    });

    res.json({
      success: true,
      message: 'Invoice created and sent successfully',
      invoice: {
        id: sentInvoice.id,
        number: sentInvoice.number,
        amount: sentInvoice.amount_due / 100,
        currency: sentInvoice.currency,
        status: sentInvoice.status,
        customer: customer.email,
        hosted_invoice_url: sentInvoice.hosted_invoice_url,
        invoice_pdf: sentInvoice.invoice_pdf
      }
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ 
      error: 'Failed to create invoice',
      message: error.message 
    });
  }
});

// Manual trigger for testing gallery notifications
app.post('/api/admin/test-gallery-notifications', async (req, res) => {
  try {
    let userInfo = null;
    try {
      userInfo = await verifyUser(req);
    } catch (error) {
      if (!isFirebaseInitialized) {
        userInfo = { uid: 'fallback-user', email: 'fallback@example.com' };
      } else {
        return res.status(401).json({ error: 'Unauthorized: ' + error.message });
      }
    }

    // Send test notification
    res.json({
      success: true,
      message: 'Test gallery notifications endpoint'
    });

  } catch (error) {
    console.error('Error testing gallery notifications:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Notification endpoints
app.post('/api/sessions/:id/send-gallery-notification', async (req, res) => {
  try {
    let userInfo = null;
    try {
      userInfo = await verifyUser(req);
    } catch (error) {
      if (!isFirebaseInitialized) {
        userInfo = { uid: 'fallback-user', email: 'fallback@example.com' };
      } else {
        return res.status(401).json({ error: 'Unauthorized: ' + error.message });
      }
    }

    const sessionId = parseInt(req.params.id);

    // Get session details
    const sessionQuery = 'SELECT * FROM sessions WHERE id = $1';
    const { rows } = await pool.query(sessionQuery, [sessionId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = rows[0];

    // Send gallery ready notification
    const results = await sendGalleryReadyNotification(session);

    // Update session to mark gallery ready notification as sent
    const updateQuery = 'UPDATE sessions SET gallery_ready_notified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *';
    const updateResult = await pool.query(updateQuery, [sessionId]);

    res.json({
      success: true,
      session: updateResult.rows[0],
      notifications: results
    });

  } catch (error) {
    console.error('Error sending gallery notification:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Cron job to send session reminders (runs daily at 9 AM)
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily reminder check...');

  try {
    // Find sessions that are 24 hours away and need reminders
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const query = `
      SELECT * FROM sessions 
      WHERE reminder_enabled = true 
      AND reminder_sent = false 
      AND date_time >= $1 
      AND date_time < $2
    `;

    const { rows } = await pool.query(query, [tomorrow.toISOString(), dayAfterTomorrow.toISOString()]);

    console.log(`Found ${rows.length} sessions requiring reminders`);

    for (const session of rows) {
      try {
        console.log(`Sending reminder for session ${session.id} - ${session.client_name}`);

        const results = await sendSessionReminder(session);

        // Mark reminder as sent
        await pool.query(
          'UPDATE sessions SET reminder_sent = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [session.id]
        );

        console.log(`Reminder sent for session ${session.id}:`, results);

      } catch (error) {
        console.error(`Error sending reminder for session ${session.id}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in reminder cron job:', error);
  }
});

// Manual trigger for testing reminders
app.post('/api/admin/test-reminders', async (req, res) => {
  try {
    let userInfo = null;
    try {
      userInfo = await verifyUser(req);
    } catch (error) {
      if (!isFirebaseInitialized) {
        userInfo = { uid: 'fallback-user', email: 'fallback@example.com' };
      } else {
        return res.status(401).json({ error: 'Unauthorized: ' + error.message });
      }
    }

    // Find sessions that need reminders (for testing, check next 7 days)
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const query = `
      SELECT * FROM sessions 
      WHERE reminder_enabled = true 
      AND reminder_sent = false 
      AND date_time >= $1 
      AND date_time <= $2
      LIMIT 5
    `;

    const { rows } = await pool.query(query, [now.toISOString(), nextWeek.toISOString()]);

    const results = [];

    for (const session of rows) {
      try {
        const reminderResults = await sendSessionReminder(session);

        // Don't mark as sent for testing
        // await pool.query('UPDATE sessions SET reminder_sent = true WHERE id = $1', [session.id]);

        results.push({
          sessionId: session.id,
          clientName: session.client_name,
          results: reminderResults
        });

      } catch (error) {
        results.push({
          sessionId: session.id,
          clientName: session.client_name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Tested reminders for ${results.length} sessions`,
      results
    });

  } catch (error) {
    console.error('Error testing reminders:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Photography Scheduler running on http://0.0.0.0:${PORT}`);
  console.log('Database connected and ready');
  console.log(`Firebase Admin SDK: ${isFirebaseInitialized ? 'Initialized' : 'Not initialized (fallback mode)'}`);
  console.log(`Authentication: ${isFirebaseInitialized ? 'Enabled' : 'Disabled (fallback mode)'}`);
  console.log('Server ready for requests');

  // Display helpful information about the current state
  if (!isFirebaseInitialized) {
    console.log('\n⚠️  NOTICE: Firebase authentication is disabled');
    console.log('   All users will share the same session data');
    console.log('   To enable authentication, provide Firebase environment variables:');
    console.log('   - FIREBASE_PRIVATE_KEY_ID');
    console.log('   - FIREBASE_PRIVATE_KEY');
    console.log('   - FIREBASE_CLIENT_EMAIL'); 
    console.log('   - FIREBASE_CLIENT_ID\n');
  }
});

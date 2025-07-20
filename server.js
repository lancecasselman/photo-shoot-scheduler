const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const cron = require('node-cron');

const app = express();

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
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'photoshcheduleapp'
      });

      // Initialize Firestore
      firestore = admin.firestore();
      isFirebaseInitialized = true;
      console.log('Firestore initialized successfully');
      console.log('Firebase Admin SDK initialized successfully');
      return true;
    }
    return true;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    console.warn('Firebase initialization failed. Authentication features will be disabled.');
    isFirebaseInitialized = false;
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
    
    const docRef = await firestore.collection('sessions').add({
      ...sessionData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Session created in Firestore with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating session in Firestore:', error);
    throw error;
  }
}

async function getSessionsFromFirestore(userId = null) {
  try {
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }
    
    let query = firestore.collection('sessions');
    
    // If userId is provided, filter by user; otherwise get all sessions
    if (userId) {
      query = query.where('userUid', '==', userId);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    
    const sessions = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      });
    });
    
    console.log(`Retrieved ${sessions.length} sessions from Firestore${userId ? ` for user ${userId}` : ' (all sessions)'}`);
    return sessions;
  } catch (error) {
    console.error('Error getting sessions from Firestore:', error);
    throw error;
  }
}

async function updateSessionInFirestore(sessionId, updateData) {
  try {
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }
    
    await firestore.collection('sessions').doc(sessionId).update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Session updated in Firestore:', sessionId);
    return true;
  } catch (error) {
    console.error('Error updating session in Firestore:', error);
    throw error;
  }
}

async function deleteSessionFromFirestore(sessionId) {
  try {
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }
    
    await firestore.collection('sessions').doc(sessionId).delete();
    console.log('Session deleted from Firestore:', sessionId);
    return true;
  } catch (error) {
    console.error('Error deleting session from Firestore:', error);
    throw error;
  }
}

// PostgreSQL helper functions
async function createUserIfNotExists(uid, email, displayName = null) {
  try {
    // First try to update the user
    const updateQuery = `
      UPDATE users 
      SET email = $2, display_name = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const displayNameValue = displayName || email;
    console.log('Trying update with values:', [uid, email, displayNameValue]);
    
    const updateResult = await pool.query(updateQuery, [uid, email, displayNameValue]);
    
    if (updateResult.rows.length > 0) {
      console.log('User updated successfully:', updateResult.rows[0]);
      return updateResult.rows[0];
    }

    // If update didn't affect any rows, user doesn't exist, so create them
    const insertQuery = `
      INSERT INTO users (id, email, display_name, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    console.log('User not found, creating new user with values:', [uid, email, displayNameValue]);
    const insertResult = await pool.query(insertQuery, [uid, email, displayNameValue]);
    console.log('User created successfully:', insertResult.rows[0]);
    return insertResult.rows[0];
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

async function createSessionInPG(sessionData) {
  const query = `
    INSERT INTO sessions (
      session_type, client_name, date_time, location, phone_number, email, 
      price, duration, notes, contract_signed, paid, edited, 
      delivered, reminder_enabled, gallery_ready_notified, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *
  `;
  
  const values = [
    sessionData.sessionType,
    sessionData.clientName,
    sessionData.dateTime,
    sessionData.location,
    sessionData.phoneNumber,
    sessionData.email,
    sessionData.price,
    sessionData.duration,
    sessionData.notes,
    sessionData.contractSigned,
    sessionData.paid,
    sessionData.edited,
    sessionData.delivered,
    sessionData.reminderEnabled,
    sessionData.galleryReadyNotified,
    sessionData.createdBy
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getSessionsFromPG() {
  const query = `
    SELECT * FROM sessions 
    ORDER BY created_at DESC
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function updateSessionInPG(sessionId, sessionData) {
  const query = `
    UPDATE sessions SET
      session_type = $2,
      client_name = $3,
      date_time = $4,
      location = $5,
      phone_number = $6,
      email = $7,
      price = $8,
      duration = $9,
      notes = $10,
      contract_signed = $11,
      paid = $12,
      edited = $13,
      delivered = $14,
      reminder_enabled = $15,
      gallery_ready_notified = $16,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  
  const values = [
    sessionId,
    sessionData.sessionType,
    sessionData.clientName,
    sessionData.dateTime,
    sessionData.location,
    sessionData.phoneNumber,
    sessionData.email,
    sessionData.price,
    sessionData.duration,
    sessionData.notes,
    sessionData.contractSigned,
    sessionData.paid,
    sessionData.edited,
    sessionData.delivered,
    sessionData.reminderEnabled,
    sessionData.galleryReadyNotified
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function deleteSessionFromPG(sessionId) {
  const query = 'DELETE FROM sessions WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [sessionId]);
  return result.rows[0];
}

// Main route handlers
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoints
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    firebase: isFirebaseInitialized ? 'initialized' : 'not initialized',
    database: 'connected'
  };
  
  res.json(health);
});

app.get('/api/status', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    
    res.json({
      status: 'ok',
      database: 'connected',
      firebase: isFirebaseInitialized ? 'initialized' : 'not initialized',
      authentication: isFirebaseInitialized ? 'enabled' : 'disabled (fallback mode)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'error',
      firebase: isFirebaseInitialized ? 'initialized' : 'not initialized',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    let user = null;
    let userId = 'fallback-user';
    
    // Try to verify user if authentication is available
    if (isFirebaseInitialized) {
      try {
        user = await verifyUser(req);
        userId = user.uid;
        console.log('Authenticated user:', userId);
        
        // Create or update user in database
        await createUserIfNotExists(user.uid, user.email, user.displayName || user.email);
      } catch (authError) {
        console.log('Authentication failed, using fallback mode:', authError.message);
        userId = 'fallback-user';
      }
    }
    
    console.log('Loading sessions for user:', userId);
    
    let sessions = [];
    
    // Try Firestore first, then PostgreSQL fallback
    if (isFirebaseInitialized) {
      try {
        // Load all sessions for shared business (don't filter by user)
        sessions = await getSessionsFromFirestore();
        console.log('Found', sessions.length, 'sessions (all sessions for shared business)');
      } catch (firestoreError) {
        console.error('Firestore error, falling back to PostgreSQL:', firestoreError);
        sessions = await getSessionsFromPG();
      }
    } else {
      sessions = await getSessionsFromPG();
    }
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions: ' + error.message });
  }
});

// Create new session
app.post('/api/sessions', async (req, res) => {
  try {
    let user = null;
    let userId = 'anonymous';
    
    // Try to verify user if authentication is available
    if (isFirebaseInitialized) {
      try {
        user = await verifyUser(req);
        userId = user.uid;
        
        // Create or update user in database
        await createUserIfNotExists(user.uid, user.email, user.displayName || user.email);
      } catch (authError) {
        console.log('Authentication failed, creating session anonymously:', authError.message);
        userId = 'anonymous';
      }
    }
    
    const sessionData = {
      ...req.body,
      userUid: userId,
      userEmail: user?.email || 'anonymous@example.com',
      createdBy: userId,
      reminderSent: false
    };
    
    console.log('Creating session:', sessionData);
    
    let newSession;
    
    // Try Firestore first, then PostgreSQL fallback
    if (isFirebaseInitialized) {
      try {
        const sessionId = await createSessionInFirestore(sessionData);
        newSession = { id: sessionId, ...sessionData };
      } catch (firestoreError) {
        console.error('Firestore error, falling back to PostgreSQL:', firestoreError);
        newSession = await createSessionInPG(sessionData);
      }
    } else {
      newSession = await createSessionInPG(sessionData);
    }
    
    console.log('Session created successfully:', newSession.id);
    res.json(newSession);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session: ' + error.message });
  }
});

// Update session
app.put('/api/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const sessionData = req.body;
    
    console.log('Updating session:', sessionId, sessionData);
    
    let updatedSession;
    
    // Try Firestore first, then PostgreSQL fallback
    if (isFirebaseInitialized) {
      try {
        await updateSessionInFirestore(sessionId, sessionData);
        updatedSession = { id: sessionId, ...sessionData };
      } catch (firestoreError) {
        console.error('Firestore error, falling back to PostgreSQL:', firestoreError);
        updatedSession = await updateSessionInPG(sessionId, sessionData);
      }
    } else {
      updatedSession = await updateSessionInPG(sessionId, sessionData);
    }
    
    console.log('Session updated successfully:', sessionId);
    res.json(updatedSession);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session: ' + error.message });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    console.log('Deleting session:', sessionId);
    
    let deletedSession;
    
    // Try Firestore first, then PostgreSQL fallback
    if (isFirebaseInitialized) {
      try {
        await deleteSessionFromFirestore(sessionId);
        deletedSession = { id: sessionId };
      } catch (firestoreError) {
        console.error('Firestore error, falling back to PostgreSQL:', firestoreError);
        deletedSession = await deleteSessionFromPG(sessionId);
      }
    } else {
      deletedSession = await deleteSessionFromPG(sessionId);
    }
    
    console.log('Session deleted successfully:', sessionId);
    res.json({ message: 'Session deleted successfully', session: deletedSession });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session: ' + error.message });
  }
});

// Invoice creation endpoint
app.post('/api/create-invoice', async (req, res) => {
  try {
    const { sessionId, clientName, email, amount, description, dueDate } = req.body;
    
    // For now, return a placeholder response
    // In a real implementation, this would integrate with Stripe or another payment processor
    const invoiceUrl = `https://example.com/invoice/${sessionId}`;
    
    res.json({
      success: true,
      invoice_url: invoiceUrl,
      message: 'Invoice creation feature is not yet implemented'
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create invoice: ' + error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error: ' + error.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('Photography Scheduler running on http://0.0.0.0:' + PORT);
  console.log('Database connected and ready');
  console.log('Firebase Admin SDK:', isFirebaseInitialized ? 'Initialized' : 'Not initialized (fallback mode)');
  console.log('Authentication:', isFirebaseInitialized ? 'Enabled' : 'Disabled (fallback mode)');
  console.log('Server ready for requests');
});
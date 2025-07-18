const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const admin = require('firebase-admin');

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

// Serve static files from current directory
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, path) => {
    // Set proper MIME types
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
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

// Check if user is admin
function isAdminUser(email) {
  const adminEmails = ['lancecasselman@icloud.com']; // Add your admin email here
  return adminEmails.includes(email);
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
    const query = sessionsRef.where('userUid', '==', userUid).orderBy('createdAt', 'desc');

    const snapshot = await query.get();
    const sessions = [];

    snapshot.forEach(doc => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
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

async function getAllSessionsFromFirestore() {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  const sessionsRef = firestore.collection('sessions');
  const snapshot = await sessionsRef.orderBy('createdAt', 'desc').get();

  const sessions = [];

  snapshot.forEach(doc => {
    sessions.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return sessions;
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
        delivered, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        // Use PostgreSQL for fallback users or when Firestore unavailable
        try {
          const query = 'SELECT * FROM sessions WHERE created_by = $1 ORDER BY date_time ASC';
          const { rows } = await pool.query(query, [userUid]);
          result = rows;
          console.log(`Found ${rows.length} sessions for user ${userUid}`);
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

    if (firestore) {
      await updateSessionInFirestore(id, req.body);
      result = { id, ...req.body };
    } else {
      // Fallback to PostgreSQL
      const intId = parseInt(id);
      const updates = Object.keys(req.body).map((key, index) => `${key} = $${index + 1}`).join(', ');
      const query = `UPDATE sessions SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = $${Object.keys(req.body).length + 1} AND created_by = $${Object.keys(req.body).length + 2} RETURNING *`;
      const values = [...Object.values(req.body), intId, userInfo.uid];
      const { rows } = await pool.query(query, values);
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
      // Use PostgreSQL for deletion (primary storage)
      let query, values;
      
      // In fallback mode, allow deletion of sessions owned by fallback-user
      // Admin users can delete any session
      if (userUid === 'fallback-user') {
        query = 'DELETE FROM sessions WHERE id = $1 AND created_by = $2';
        values = [intId, 'fallback-user'];
      } else {
        // Regular authenticated users can only delete their own sessions
        query = 'DELETE FROM sessions WHERE id = $1 AND created_by = $2';
        values = [intId, userUid];
      }

      console.log('Executing delete query:', query, values);
      const deleteResult = await pool.query(query, values);
      
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }
      
      // Also try to delete from Firestore if available (cleanup)
      if (firestore) {
        try {
          await deleteSessionFromFirestore(id);
        } catch (firestoreError) {
          console.warn('Failed to delete from Firestore:', firestoreError);
          // Don't fail the request if Firestore delete fails
        }
      }
      
      result = { success: true };
    } catch (dbError) {
      console.error('Database deletion error:', dbError);
      throw new Error('Failed to delete session from database');
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

// Admin endpoint to get all sessions
app.get('/api/admin/sessions', async (req, res) => {
  try {
    let userInfo = null;
    try {
      userInfo = await verifyUser(req);
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized: ' + error.message });
    }

    if (!isAdminUser(userInfo.email)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    let result;
    if (firestore) {
      result = await getAllSessionsFromFirestore();
    } else {
      // Fallback to PostgreSQL
      const query = `
        SELECT s.*, u.email as user_email, u.display_name as user_display_name
        FROM sessions s
        LEFT JOIN users u ON s.created_by = u.id
        ORDER BY s.date_time ASC
      `;
      const { rows } = await pool.query(query);
      result = rows;
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

// User management endpoints
app.post('/api/users', async (req, res) => {
  try {
    const query = `
      INSERT INTO users (id, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [req.body.id, req.body.email, req.body.displayName];
    const { rows } = await pool.query(query, values);
    res.json(rows[0]);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
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

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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
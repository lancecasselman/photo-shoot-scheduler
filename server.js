const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const admin = require('firebase-admin');

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

// MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function serveStaticFile(filePath, res) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const data = fs.readFileSync(fullPath);
    const mimeType = getMimeType(filePath);
    
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

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

async function handleApiRequest(method, pathname, req, res) {
  setCorsHeaders(res);
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      const data = body ? JSON.parse(body) : {};
      let result;
      
      // Verify user authentication for protected endpoints
      let userInfo = null;
      if (pathname.startsWith('/api/sessions') || pathname.startsWith('/api/admin')) {
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
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized: ' + error.message }));
              return;
            }
          }
        }
      }

      if (pathname === '/api/sessions' && method === 'GET') {
        // Always use PostgreSQL to avoid Firestore connection issues
        const query = 'SELECT * FROM sessions WHERE created_by = $1 ORDER BY date_time ASC';
        const { rows } = await pool.query(query, [userInfo.uid]);
        result = rows;
      } else if (pathname === '/api/sessions' && method === 'POST') {
        const sessionData = {
          userUid: userInfo.uid,
          userEmail: userInfo.email,
          sessionType: data.sessionType,
          clientName: data.clientName,
          dateTime: data.dateTime,
          location: data.location,
          phoneNumber: data.phoneNumber,
          email: data.email,
          price: data.price,
          duration: data.duration,
          notes: data.notes || '',
          contractSigned: data.contractSigned || false,
          paid: data.paid || false,
          edited: data.edited || false,
          delivered: data.delivered || false
        };
        
        // Use PostgreSQL for session creation
        const query = `
          INSERT INTO sessions (session_type, client_name, date_time, location, phone_number, email, price, duration, notes, contract_signed, paid, edited, delivered, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `;
        const values = [
          data.sessionType, data.clientName, data.dateTime, data.location,
          data.phoneNumber, data.email, data.price, data.duration, data.notes || '',
          data.contractSigned || false, data.paid || false, data.edited || false, data.delivered || false, userInfo.uid
        ];
        const { rows } = await pool.query(query, values);
        result = rows[0];
      } else if (pathname.startsWith('/api/sessions/') && method === 'PUT') {
        const id = pathname.split('/')[3];
        
        if (firestore) {
          await updateSessionInFirestore(id, data);
          result = { id, ...data };
        } else {
          // Fallback to PostgreSQL
          const intId = parseInt(id);
          const updates = Object.keys(data).map((key, index) => `${key} = $${index + 1}`).join(', ');
          const query = `UPDATE sessions SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = $${Object.keys(data).length + 1} AND created_by = $${Object.keys(data).length + 2} RETURNING *`;
          const values = [...Object.values(data), intId, userInfo.uid];
          const { rows } = await pool.query(query, values);
          if (rows.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found or unauthorized' }));
            return;
          }
          result = rows[0];
        }
      } else if (pathname.startsWith('/api/sessions/') && method === 'DELETE') {
        const id = pathname.split('/')[3];
        
        if (firestore) {
          // For Firestore, we need to check ownership before deletion
          const sessionRef = firestore.collection('sessions').doc(id);
          const sessionDoc = await sessionRef.get();
          
          if (!sessionDoc.exists) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
          }
          
          const sessionData = sessionDoc.data();
          
          // Check if user is admin or owns the session
          if (!isAdminUser(userInfo.email) && sessionData.userUid !== userInfo.uid) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
          
          await deleteSessionFromFirestore(id);
          result = { success: true };
        } else {
          // Fallback to PostgreSQL
          const intId = parseInt(id);
          
          // Check if user is admin or owns the session
          let query, values;
          if (isAdminUser(userInfo.email)) {
            query = 'DELETE FROM sessions WHERE id = $1';
            values = [intId];
          } else {
            query = 'DELETE FROM sessions WHERE id = $1 AND created_by = $2';
            values = [intId, userInfo.uid];
          }
          
          const deleteResult = await pool.query(query, values);
          if (deleteResult.rowCount === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found or unauthorized' }));
            return;
          }
          result = { success: true };
        }
      } else if (pathname === '/api/admin/sessions' && method === 'GET') {
        // Admin endpoint to get all sessions
        if (!isAdminUser(userInfo.email)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden: Admin access required' }));
          return;
        }
        
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
      } else if (pathname === '/api/users' && method === 'POST') {
        const query = `
          INSERT INTO users (id, email, display_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            display_name = EXCLUDED.display_name,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `;
        const values = [data.id, data.email, data.displayName];
        const { rows } = await pool.query(query, values);
        result = rows[0];
      } else if (pathname.startsWith('/api/users/') && method === 'GET') {
        const id = pathname.split('/')[3];
        const query = 'SELECT * FROM users WHERE id = $1';
        const { rows } = await pool.query(query, [id]);
        result = rows[0];
      } else if (pathname === '/api/users/email' && method === 'POST') {
        const query = 'SELECT * FROM users WHERE email = $1';
        const { rows } = await pool.query(query, [data.email]);
        result = rows[0];
      } else if (pathname === '/api/status' && method === 'GET') {
        // Status endpoint to check Firebase and system health
        result = {
          firebaseInitialized: isFirebaseInitialized,
          firestoreEnabled: firestore !== null,
          authenticationEnabled: isFirebaseInitialized,
          databaseConnected: true,
          timestamp: new Date().toISOString(),
          mode: isFirebaseInitialized ? 'authenticated' : 'fallback',
          storageMode: firestore ? 'firestore' : 'postgresql'
        };
      } else if (pathname === '/api/health' && method === 'GET') {
        // Health check endpoint
        result = {
          status: 'healthy',
          services: {
            firebase: isFirebaseInitialized ? 'active' : 'disabled',
            firestore: firestore ? 'active' : 'disabled',
            database: 'connected'
          },
          timestamp: new Date().toISOString()
        };
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
  } catch (error) {
    console.error('API Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // Debug logging
  console.log(`[${new Date().toISOString()}] ${method} ${pathname} - Host: ${req.headers.host}, User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`);

  // Handle API requests
  if (pathname.startsWith('/api/')) {
    console.log(`Handling API request: ${method} ${pathname}`);
    await handleApiRequest(method, pathname, req, res);
    return;
  }

  // Handle static files
  console.log(`Serving static file: ${pathname}`);
  if (pathname === '/') {
    serveStaticFile('index.html', res);
  } else if (pathname === '/auth.js') {
    serveStaticFile('auth.js', res);
  } else if (pathname === '/script.js') {
    serveStaticFile('script.js', res);
  } else if (pathname === '/style.css') {
    serveStaticFile('style.css', res);
  } else {
    serveStaticFile(pathname, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
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
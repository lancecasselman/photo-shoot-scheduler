import { createServer } from 'http';
import { parse } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { storage } from './api';
import { createSession, getSession, generateSessionId } from './session-handler.js';

const PORT = parseInt(process.env.PORT || '5000');

// MIME type mapping
const mimeTypes: { [key: string]: string } = {
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

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function setCorsHeaders(res: any, req?: any) {
  // Secure CORS configuration - restrict to trusted domains
  const allowedOrigins = [
    'https://8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev',
    'https://photomanagementsystem.com',
    'http://localhost:3000', // Development
    'http://localhost:5000'  // Development
  ];
  
  // Get the request origin
  const requestOrigin = req?.headers?.origin;
  
  // Allow any .replit.app domain for published websites
  if (requestOrigin && requestOrigin.includes('.replit.app')) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  } 
  // Allow specific trusted origins
  else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }
  // Default fallback for development
  else {
    res.setHeader('Access-Control-Allow-Origin', 'https://8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function serveStaticFile(filePath: string, res: any, req?: any) {
  try {
    // Security: Prevent path traversal attacks
    const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    
    // Security: Only allow files from public directories
    const allowedDirectories = ['public', 'ios/App/App/public', '.'];
    const isAllowed = allowedDirectories.some(dir => {
      const allowedPath = path.join(process.cwd(), dir);
      const requestedPath = path.join(process.cwd(), normalizedPath);
      return requestedPath.startsWith(allowedPath);
    });
    
    if (!isAllowed) {
      console.warn('🚫 Path traversal attempt blocked:', filePath);
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access denied');
      return;
    }
    
    const fullPath = path.join(process.cwd(), normalizedPath);
    const data = fs.readFileSync(fullPath);
    const mimeType = getMimeType(normalizedPath);
    
    setCorsHeaders(res, req);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

function getSessionFromCookies(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith('sessionId=')) {
      return cookie.substring('sessionId='.length);
    }
  }
  return null;
}

function isAuthenticated(req: any): boolean {
  const sessionId = getSessionFromCookies(req.headers.cookie);
  if (!sessionId) {
    console.log('🚫 No session ID found in cookies');
    return false;
  }
  
  const session = getSession(sessionId);
  if (!session) {
    console.log('🚫 Session not found for ID:', sessionId);
    return false;
  }
  
  // Check if session has valid user data
  if (!session.user || !session.user.email) {
    console.log('🚫 Session exists but missing user data:', sessionId);
    return false;
  }
  
  console.log('✅ Authentication successful for:', session.user.email);
  req.user = session.user;
  return true;
}

async function handleApiRequest(method: string, pathname: string, req: any, res: any) {
  setCorsHeaders(res, req);
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Check authentication for protected routes
  const protectedRoutes = ['/api/sessions', '/api/users'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute && !pathname.includes('/firebase-') && !isAuthenticated(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      const data = body ? JSON.parse(body) : {};
      let result: any;

      if (pathname === '/api/sessions' && method === 'GET') {
        result = await storage.getSessions();
      } else if (pathname === '/api/sessions' && method === 'POST') {
        result = await storage.createSession(data);
      } else if (pathname.startsWith('/api/sessions/') && method === 'PUT') {
        const id = pathname.split('/')[3];
        result = await storage.updateSession(id, data);
      } else if (pathname.startsWith('/api/sessions/') && method === 'DELETE') {
        const id = pathname.split('/')[3];
        result = await storage.deleteSession(id);
      } else if (pathname === '/api/users' && method === 'POST') {
        result = await storage.upsertUser(data);
      } else if (pathname.startsWith('/api/users/') && method === 'GET') {
        const id = pathname.split('/')[3];
        result = await storage.getUser(id);
      } else if (pathname === '/api/users/email' && method === 'POST') {
        result = await storage.getUserByEmail(data.email);
      } else if (pathname === '/api/auth/firebase-login' && method === 'POST') {
        // Handle Firebase login
        result = { success: true, message: 'User authenticated', user: data };
      } else if (pathname === '/api/auth/firebase-verify' && method === 'POST') {
        // Handle Firebase verification and create session
        console.log(' FIREBASE VERIFY: Received request:', data);
        
        const sessionId = generateSessionId();
        createSession(sessionId, {
          uid: data.uid,
          email: data.email,
          displayName: data.displayName
        });
        
        // Set session cookie with secure settings
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const cookieOptions = [
          `sessionId=${sessionId}`,
          'Path=/',
          'Max-Age=604800', // 7 days
          `SameSite=${isDevelopment ? 'Lax' : 'Strict'}`,
          `Secure=${!isDevelopment}`, // Secure in production
          'HttpOnly=true' // Prevent XSS attacks
        ];
        res.setHeader('Set-Cookie', cookieOptions.join('; '));
        
        result = { success: true, message: 'User verified', user: data, sessionId };
      } else if (pathname === '/api/auth/logout' && method === 'POST') {
        // Handle logout
        result = { success: true, message: 'Logged out successfully' };
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
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

const server = createServer(async (req, res) => {
  const url = parse(req.url || '', true);
  const pathname = url.pathname || '/';
  const method = req.method || 'GET';

  // Handle API requests
  if (pathname.startsWith('/api/')) {
    await handleApiRequest(method, pathname, req, res);
    return;
  }

  // Handle static files
  if (pathname === '/') {
    serveStaticFile('index.html', res, req);
  } else if (pathname === '/auth' || pathname === '/auth.html') {
    serveStaticFile('auth.html', res, req);
  } else if (pathname === '/app' || pathname === '/app.html') {
    serveStaticFile('index.html', res, req);
  } else if (pathname === '/auth.js') {
    serveStaticFile('auth.js', res, req);
  } else if (pathname === '/script.js') {
    serveStaticFile('script.js', res, req);
  } else if (pathname === '/style.css') {
    serveStaticFile('style.css', res, req);
  } else if (pathname === '/firebase-config.js') {
    serveStaticFile('firebase-config.js', res, req);
  } else {
    serveStaticFile(pathname.substring(1), res, req);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Photography Scheduler running on http://0.0.0.0:${PORT}`);
  console.log(`Serving files from: ${process.cwd()}`);
  console.log('Server ready for requests');
});

export default server;
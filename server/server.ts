import { createServer } from 'http';
import { parse } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { storage } from './api';

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

function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function serveStaticFile(filePath: string, res: any) {
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

async function handleApiRequest(method: string, pathname: string, req: any, res: any) {
  setCorsHeaders(res);
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
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
        const id = parseInt(pathname.split('/')[3]);
        result = await storage.updateSession(id, data);
      } else if (pathname.startsWith('/api/sessions/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3]);
        result = await storage.deleteSession(id);
      } else if (pathname === '/api/users' && method === 'POST') {
        result = await storage.createUser(data);
      } else if (pathname.startsWith('/api/users/') && method === 'GET') {
        const id = pathname.split('/')[3];
        result = await storage.getUser(id);
      } else if (pathname === '/api/users/email' && method === 'POST') {
        result = await storage.getUserByEmail(data.email);
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
  console.log(`Serving files from: ${process.cwd()}`);
  console.log('Server ready for requests');
});

export default server;
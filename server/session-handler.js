
const sessions = new Map();

export function createSession(sessionId, userData) {
  sessions.set(sessionId, {
    user: userData,
    createdAt: Date.now(),
    lastAccess: Date.now()
  });
  console.log('✅ Session created:', sessionId, userData);
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastAccess = Date.now();
    return session;
  }
  return null;
}

export function destroySession(sessionId) {
  sessions.delete(sessionId);
}

export function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Clean up old sessions (older than 7 days)
setInterval(() => {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastAccess > maxAge) {
      sessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

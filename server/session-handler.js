
import { randomUUID } from 'crypto';

const sessions = new Map();

export function createSession(sessionId, userData) {
  // Validate userData
  if (!userData || !userData.email) {
    console.error('❌ Invalid user data for session creation:', userData);
    return false;
  }
  
  sessions.set(sessionId, {
    user: userData,
    createdAt: Date.now(),
    lastAccess: Date.now()
  });
  console.log('✅ Session created:', sessionId, {
    email: userData.email,
    uid: userData.uid
  });
  return true;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastAccess = Date.now();
    console.log('📋 Session retrieved:', sessionId, {
      email: session.user?.email,
      uid: session.user?.uid,
      hasUser: !!session.user
    });
    return session;
  }
  console.log('❌ Session not found:', sessionId, 'Active sessions:', sessions.size);
  return null;
}

export function destroySession(sessionId) {
  sessions.delete(sessionId);
}

export function generateSessionId() {
  // Use cryptographically secure random UUID
  return randomUUID();
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

/**
 * Content Management Authentication Middleware
 * Provides secure admin-only access for landing page content editing
 */

const admin = require('firebase-admin');

// Admin email whitelist - only these emails can edit content
const ADMIN_EMAILS = [
  'lance@photomanagementsystem.com',
  'admin@photomanagementsystem.com',
  'support@photomanagementsystem.com'
];

/**
 * Middleware to verify admin authentication for content editing
 */
async function requireContentAdminAuth(req, res, next) {
  try {
    console.log('🔐 CONTENT ADMIN: Checking authentication for content editing');
    
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ CONTENT ADMIN: No valid authorization header');
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Admin authentication required for content editing',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    // Extract Firebase ID token
    const idToken = authHeader.split(' ')[1];
    
    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userEmail = decodedToken.email;
    
    console.log(`🔍 CONTENT ADMIN: Verifying admin access for: ${userEmail}`);
    
    // Check if user is in admin whitelist
    if (!ADMIN_EMAILS.includes(userEmail)) {
      console.log(`❌ CONTENT ADMIN: Access denied for non-admin: ${userEmail}`);
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Admin privileges required for content editing',
        code: 'ADMIN_PRIVILEGES_REQUIRED'
      });
    }

    // Add admin info to request
    req.admin = {
      uid: decodedToken.uid,
      email: userEmail,
      displayName: decodedToken.name || userEmail,
      isContentAdmin: true
    };

    console.log(`✅ CONTENT ADMIN: Access granted for admin: ${userEmail}`);
    next();

  } catch (error) {
    console.error('❌ CONTENT ADMIN: Authentication error:', error);
    
    // Handle specific Firebase auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token Expired', 
        message: 'Authentication token has expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        error: 'Token Revoked', 
        message: 'Authentication token has been revoked. Please log in again.',
        code: 'TOKEN_REVOKED'
      });
    }

    return res.status(401).json({ 
      error: 'Authentication Failed', 
      message: 'Invalid authentication credentials',
      code: 'AUTH_FAILED'
    });
  }
}

/**
 * Middleware to check if user has basic admin access (read-only)
 */
async function checkAdminAccess(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.isAdmin = false;
      return next();
    }

    const idToken = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userEmail = decodedToken.email;
    
    // Set admin status
    req.isAdmin = ADMIN_EMAILS.includes(userEmail);
    req.userEmail = userEmail;
    
    if (req.isAdmin) {
      req.admin = {
        uid: decodedToken.uid,
        email: userEmail,
        displayName: decodedToken.name || userEmail,
        isContentAdmin: true
      };
    }

    next();

  } catch (error) {
    console.error('⚠️  CONTENT ADMIN: Error checking admin access:', error);
    req.isAdmin = false;
    next();
  }
}

/**
 * Validate content input for security
 */
function validateContentInput(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Content must be a non-empty string');
  }

  // Basic length validation
  if (content.length > 10000) {
    throw new Error('Content exceeds maximum length of 10,000 characters');
  }

  // Check for potentially dangerous content
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      throw new Error('Content contains potentially dangerous elements');
    }
  }

  return true;
}

/**
 * Sanitize HTML content for safe storage
 */
function sanitizeContent(content, contentType = 'text') {
  if (contentType === 'text') {
    // For plain text, just escape HTML entities
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (contentType === 'html') {
    // For HTML content, allow basic formatting tags only
    const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span'];
    const tagRegex = /<\/?(\w+)[^>]*>/g;
    
    return content.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match;
      }
      return ''; // Remove disallowed tags
    });
  }

  // For other types (image_url, json), basic validation
  return content.trim();
}

/**
 * Log content changes for audit trail
 */
function logContentChange(action, contentKey, oldValue, newValue, adminEmail) {
  console.log(`📝 CONTENT AUDIT: ${action} - ${contentKey} by ${adminEmail}`);
  console.log(`   Old: ${oldValue ? oldValue.substring(0, 100) + '...' : 'null'}`);
  console.log(`   New: ${newValue ? newValue.substring(0, 100) + '...' : 'null'}`);
}

module.exports = {
  requireContentAdminAuth,
  checkAdminAccess,
  validateContentInput,
  sanitizeContent,
  logContentChange,
  ADMIN_EMAILS
};
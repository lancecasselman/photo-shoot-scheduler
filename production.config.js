// Production Configuration
module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    host: '0.0.0.0',
    trustProxy: true,
    compression: true,
    helmet: true
  },

  // Security Configuration
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    secureCookies: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },

  // CORS Configuration
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // List of trusted domains (including production deployment URLs)
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'https://photo-shoot-scheduler-lancecasselman.replit.app',
        'https://yourdomain.com'
      ];
      
      // Check if origin is in the allowed list or is a Replit dev URL
      if (allowedOrigins.includes(origin) || 
          origin.includes('.replit.dev') || 
          origin.includes('replit.app')) {
        callback(null, origin); // Echo back the requesting origin
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Rate Limiting - Multi-photographer platform configuration
  rateLimit: {
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 500, // Higher limit for multiple photographers per IP
    message: 'Too many requests from this IP, please try again later.',
    // Skip rate limiting for authenticated photographers during peak usage
    skip: (req) => req.path.includes('/api/system/') // Skip for health checks
  },

  // File Upload Limits
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '100MB',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/raw'],
    tempDir: '/tmp/uploads'
  },

  // Cache Configuration
  cache: {
    staticFiles: {
      maxAge: 31536000, // 1 year for static assets
      etag: true,
      lastModified: true
    },
    api: {
      maxAge: 300, // 5 minutes for API responses
      staleWhileRevalidate: 600 // 10 minutes
    }
  },

  // Database Configuration - Multi-photographer SaaS platform
  database: {
    pool: {
      min: 10,  // Higher minimum for hundreds of photographers
      max: 100, // Support concurrent usage from many photographers
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 15000,
      acquireTimeoutMillis: 120000,
      maxUses: 10000,
      statementTimeout: 30000,
      queryTimeout: 25000
    },
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Multi-tenant optimizations
    enableQueryLogging: false, // Disable in production for performance
    enableConnectionMetrics: true
  },

  // Logging Configuration
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    format: 'combined',
    enableRequestLogging: true
  },

  // Performance Monitoring
  monitoring: {
    enableMetrics: true,
    healthCheckEndpoint: '/health',
    metricsEndpoint: '/metrics'
  }
};
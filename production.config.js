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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Rate Limiting
  rateLimit: {
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
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

  // Database Configuration
  database: {
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    },
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
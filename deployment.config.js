// Production Deployment Configuration for Replit
module.exports = {
  // Replit Deployment Settings
  replit: {
    name: "photography-management-system",
    description: "Professional photography business management platform",
    version: "1.0.0",
    
    // Environment configuration
    environment: {
      NODE_ENV: "production",
      PORT: 5000
    },
    
    // Build configuration
    build: {
      command: "npm run build:prod",
      outputDir: "./",
      skipInstall: false
    },
    
    // Runtime configuration
    runtime: {
      engine: "nodejs",
      version: "20"
    },
    
    // Health checks
    healthCheck: {
      path: "/health",
      interval: "30s",
      timeout: "10s",
      retries: 3
    },
    
    // Scaling configuration
    scaling: {
      minInstances: 1,
      maxInstances: 3,
      targetCpu: 70
    },
    
    // Resources
    resources: {
      memory: "1GB",
      cpu: "0.5 vCPU"
    }
  },

  // Custom Domain Configuration
  domain: {
    // User should configure their custom domain here
    // Example: "photomanagement.com"
    custom: null,
    ssl: true,
    redirectWww: true
  },

  // Database Configuration
  database: {
    // Production database URL should be set in secrets
    ssl: true,
    poolSize: {
      min: 2,
      max: 10
    },
    backups: {
      enabled: true,
      schedule: "daily",
      retention: "30 days"
    }
  },

  // File Storage Configuration
  storage: {
    provider: "cloudflare-r2",
    backup: true,
    cdn: true,
    compression: true
  },

  // Security Configuration
  security: {
    helmet: true,
    cors: {
      enabled: true,
      allowedOrigins: ["https://yourdomain.com"]
    },
    rateLimit: {
      windowMs: 900000, // 15 minutes
      max: 100
    },
    sessionSecurity: {
      secure: true,
      httpOnly: true,
      sameSite: "strict"
    }
  },

  // Monitoring Configuration
  monitoring: {
    healthChecks: true,
    metrics: true,
    logging: {
      level: "warn",
      format: "json"
    },
    alerts: {
      enabled: true,
      email: "admin@yourdomain.com"
    }
  },

  // Performance Configuration
  performance: {
    compression: true,
    caching: {
      staticFiles: "1y",
      apiResponses: "5m"
    },
    optimization: {
      minifyJs: true,
      minifyCss: true,
      optimizeImages: true
    }
  }
};
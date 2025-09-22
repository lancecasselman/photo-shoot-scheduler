const Redis = require('redis');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');

/**
 * Professional-grade rate limiting for photography galleries
 * Based on industry standards from Pixieset, ShootProof, and PhotoDeck
 */
class GalleryRateLimiter {
  constructor() {
    // Use Redis in production, memory in development
    this.redisClient = process.env.REDIS_URL ? 
      Redis.createClient({ url: process.env.REDIS_URL }) : 
      null;

    // Download rate limiting (Pixieset standard: 10/hour per user)
    this.downloadLimiter = this.redisClient ? 
      new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'gallery_download',
        points: 10, // Number of downloads
        duration: 3600, // Per hour
        blockDuration: 3600, // Block for 1 hour when exceeded
      }) :
      new RateLimiterMemory({
        keyPrefix: 'gallery_download',
        points: 10,
        duration: 3600,
        blockDuration: 3600,
      });

    // Token request limiting (prevent token farming)
    this.tokenLimiter = this.redisClient ?
      new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'gallery_token',
        points: 100, // Token requests
        duration: 3600, // Per hour
        blockDuration: 600, // Block for 10 minutes
      }) :
      new RateLimiterMemory({
        keyPrefix: 'gallery_token',
        points: 100,
        duration: 3600,
        blockDuration: 600,
      });

    // Gallery access limiting (prevent brute force)
    this.accessLimiter = this.redisClient ?
      new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'gallery_access',
        points: 50, // Gallery visits
        duration: 3600, // Per hour
        blockDuration: 300, // Block for 5 minutes
      }) :
      new RateLimiterMemory({
        keyPrefix: 'gallery_access',
        points: 50,
        duration: 3600,
        blockDuration: 300,
      });
  }

  /**
   * Rate limit download requests by client identifier
   */
  async limitDownloads(clientIdentifier) {
    try {
      await this.downloadLimiter.consume(clientIdentifier);
      return { allowed: true };
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      return {
        allowed: false,
        retryAfter: secs,
        limit: 10,
        remaining: rejRes.remainingPoints || 0,
        resetTime: new Date(Date.now() + rejRes.msBeforeNext)
      };
    }
  }

  /**
   * Rate limit token generation requests
   */
  async limitTokenRequests(clientIdentifier) {
    try {
      await this.tokenLimiter.consume(clientIdentifier);
      return { allowed: true };
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      return {
        allowed: false,
        retryAfter: secs,
        limit: 100,
        remaining: rejRes.remainingPoints || 0
      };
    }
  }

  /**
   * Rate limit gallery access attempts
   */
  async limitGalleryAccess(clientIdentifier) {
    try {
      await this.accessLimiter.consume(clientIdentifier);
      return { allowed: true };
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      return {
        allowed: false,
        retryAfter: secs,
        limit: 50,
        remaining: rejRes.remainingPoints || 0
      };
    }
  }

  /**
   * Get current rate limit status for a client
   */
  async getStatus(type, clientIdentifier) {
    const limiter = type === 'download' ? this.downloadLimiter :
                   type === 'token' ? this.tokenLimiter :
                   this.accessLimiter;

    try {
      const res = await limiter.get(clientIdentifier);
      return {
        limit: limiter.points,
        remaining: res ? limiter.points - res.totalHits : limiter.points,
        resetTime: res ? new Date(res.msBeforeNext + Date.now()) : null
      };
    } catch (error) {
      console.error('Rate limiter status error:', error);
      return { limit: 0, remaining: 0, resetTime: null };
    }
  }
}

// Express middleware factories
const rateLimiter = new GalleryRateLimiter();

/**
 * Middleware for download rate limiting
 */
const limitDownloads = async (req, res, next) => {
  const clientId = req.body.clientKey || req.query.clientKey || req.ip;
  const result = await rateLimiter.limitDownloads(clientId);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'Download rate limit exceeded',
      retryAfter: result.retryAfter,
      limit: result.limit,
      remaining: result.remaining,
      resetTime: result.resetTime
    });
  }
  
  // Add rate limit headers (industry standard)
  res.set({
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': result.remaining || '9',
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + 3600
  });
  
  next();
};

/**
 * Middleware for token request rate limiting
 */
const limitTokenRequests = async (req, res, next) => {
  const clientId = req.body.galleryAccessToken || req.ip;
  const result = await rateLimiter.limitTokenRequests(clientId);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'Token request rate limit exceeded',
      retryAfter: result.retryAfter
    });
  }
  
  next();
};

/**
 * Middleware for gallery access rate limiting
 */
const limitGalleryAccess = async (req, res, next) => {
  const clientId = req.params.token || req.ip;
  const result = await rateLimiter.limitGalleryAccess(clientId);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'Gallery access rate limit exceeded',
      retryAfter: result.retryAfter
    });
  }
  
  next();
};

module.exports = {
  GalleryRateLimiter,
  limitDownloads,
  limitTokenRequests,
  limitGalleryAccess,
  rateLimiter
};
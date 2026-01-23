const rateLimit = require('express-rate-limit');

/**
 * Rate limiting configuration
 * Limits: 100 requests per 15 minutes per IP
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit in development
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for certain IPs (optional)
  skip: (req) => {
    // Skip rate limiting in development entirely
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
});

module.exports = rateLimiter;

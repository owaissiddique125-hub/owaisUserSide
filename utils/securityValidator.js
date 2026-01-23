/**
 * Security Validation Utility
 * Validates security configurations and best practices
 */

const validateSecurityConfig = () => {
  const issues = [];
  const warnings = [];

  // 1. Check HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.FORCE_HTTPS) {
      warnings.push('FORCE_HTTPS not set - ensure HTTPS is enforced at load balancer/proxy level');
    }
  }

  // 2. Check required environment variables
  const requiredEnvVars = [
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'MONGODB_URI',
    'FRONTEND_URL'
  ];

  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      issues.push(`Missing required environment variable: ${varName}`);
    }
  });

  // 3. Check FRONTEND_URL is not wildcard
  if (process.env.FRONTEND_URL === '*') {
    issues.push('FRONTEND_URL should not be wildcard (*) - specify exact domain');
  }

  // 4. Check MongoDB URI doesn't expose credentials in logs
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('@')) {
    // This is fine, just ensure we don't log it
    console.log('✅ MongoDB URI configured (credentials hidden)');
  }

  // 5. Validate Clerk keys format
  if (process.env.CLERK_SECRET_KEY && !process.env.CLERK_SECRET_KEY.startsWith('sk_')) {
    warnings.push('CLERK_SECRET_KEY should start with sk_');
  }

  if (process.env.CLERK_WEBHOOK_SECRET && !process.env.CLERK_WEBHOOK_SECRET.startsWith('whsec_')) {
    warnings.push('CLERK_WEBHOOK_SECRET should start with whsec_');
  }

  // 6. Check NODE_ENV is set
  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV not set - defaulting to development');
  }

  return { issues, warnings };
};

/**
 * Sanitize sensitive data from logs
 */
const sanitizeForLogging = (data) => {
  if (!data) return data;

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apikey',
    'api_key',
    'authorization',
    'cookie',
    'session',
    'mongoUri',
    'mongodb_uri'
  ];

  if (typeof data === 'object') {
    const sanitized = { ...data };
    
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeForLogging(sanitized[key]);
      }
    });

    return sanitized;
  }

  return data;
};

/**
 * Check if request contains sensitive data
 */
const hasSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') return false;

  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /credit[_-]?card/i,
    /ssn/i,
    /social[_-]?security/i
  ];

  const checkObject = (o) => {
    for (const key in o) {
      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        return true;
      }
      if (typeof o[key] === 'object' && o[key] !== null) {
        if (checkObject(o[key])) return true;
      }
    }
    return false;
  };

  return checkObject(obj);
};

module.exports = {
  validateSecurityConfig,
  sanitizeForLogging,
  hasSensitiveData
};

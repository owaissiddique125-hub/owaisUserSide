require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const testConnection = require('./config/database');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { validateSecurityConfig } = require('./utils/securityValidator');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate security configuration on startup
//console.log('🔒 Validating security configuration...');
//const { issues, warnings } = validateSecurityConfig();

//if (issues.length > 0) {
 // console.error('❌ Security configuration issues:');
 // issues.forEach(issue => console.error(`  - ${issue}`));
  //if (process.env.NODE_ENV === 'production') {
   // console.error('⚠️  Cannot start server with security issues in production');
   // process.exit(1);
 // }
//}

//if (warnings.length > 0) {
  //console.warn('⚠️  Security warnings:');
 // warnings.forEach(warning => console.warn(`  - ${warning}`));
//}

//console.log('✅ Security validation complete');

// Test Supabase connection
testConnection();

// HTTPS Enforcement in Production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'HTTPS_REQUIRED',
          message: 'HTTPS is required for all API requests'
        }
      });
    }
    next();
  });
}

// Security Middleware - Enhanced Helmet Configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));

// CORS Configuration - Strict origin validation
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:8081'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Blocked CORS request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Rate Limiting
app.use('/api/', rateLimiter);

// Body Parsing - Increase limit for base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Ali Food API is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/items', require('./routes/items'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

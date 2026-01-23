const { sanitizeForLogging } = require('../utils/securityValidator');

/**
 * Centralized error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Sanitize request data before logging
  const sanitizedBody = sanitizeForLogging(req.body);
  const sanitizedQuery = sanitizeForLogging(req.query);
  
  // Log error for debugging (without sensitive data)
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    body: sanitizedBody,
    query: sanitizedQuery,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let errorResponse = {
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Something went wrong!'
    }
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      stack: err.stack,
      path: req.path,
      method: req.method
    };
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Validation failed';
    errorResponse.error.details = Object.values(err.errors).map(e => e.message);
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    errorResponse.error.code = 'INVALID_ID';
    errorResponse.error.message = 'Invalid ID format';
  }

  if (err.code === 11000) {
    statusCode = 409;
    errorResponse.error.code = 'DUPLICATE_ENTRY';
    errorResponse.error.message = 'Resource already exists';
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;

const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * Middleware to verify Clerk session token and attach user info to request
 */
const clerkAuth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required. Please provide a valid token.'
        }
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Clerk
    const sessionClaims = await clerkClient.verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    // Attach user info to request
    req.auth = {
      userId: sessionClaims.sub, // Clerk user ID
      sessionId: sessionClaims.sid,
      claims: sessionClaims
    };

    next();
  } catch (error) {
    // Log error without exposing token details
    console.error('Clerk auth error:', {
      message: error.message,
      type: error.name,
      timestamp: new Date().toISOString()
      // Note: Do NOT log the actual token
    });
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: 'Invalid or expired authentication token.'
      }
    });
  }
};

module.exports = clerkAuth;

const clerkAuth = require('../middleware/clerkAuth');

// Mock @clerk/clerk-sdk-node
jest.mock('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    verifyToken: jest.fn()
  }
}));

const { clerkClient } = require('@clerk/clerk-sdk-node');

describe('clerkAuth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('should return 401 if no authorization header', async () => {
    await clerkAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. Please provide a valid token.'
      }
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if authorization header does not start with Bearer', async () => {
    req.headers.authorization = 'InvalidToken';

    await clerkAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. Please provide a valid token.'
      }
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should verify token and attach user info to request', async () => {
    const mockToken = 'valid_token';
    const mockClaims = {
      sub: 'user_123',
      sid: 'session_456'
    };

    req.headers.authorization = `Bearer ${mockToken}`;
    clerkClient.verifyToken.mockResolvedValue(mockClaims);

    await clerkAuth(req, res, next);

    expect(clerkClient.verifyToken).toHaveBeenCalledWith(mockToken, {
      secretKey: process.env.CLERK_SECRET_KEY
    });
    expect(req.auth).toEqual({
      userId: 'user_123',
      sessionId: 'session_456',
      claims: mockClaims
    });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 401 if token verification fails', async () => {
    req.headers.authorization = 'Bearer invalid_token';
    clerkClient.verifyToken.mockRejectedValue(new Error('Invalid token'));

    await clerkAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: 'Invalid or expired authentication token.'
      }
    });
    expect(next).not.toHaveBeenCalled();
  });
});

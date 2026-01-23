const request = require('supertest');
const express = require('express');
const usersRouter = require('../routes/users');
const User = require('../models/User');
const clerkAuth = require('../middleware/clerkAuth');

// Mock dependencies
jest.mock('../models/User');
jest.mock('../middleware/clerkAuth');

describe('Users API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock clerkAuth middleware to pass through with mock user
    clerkAuth.mockImplementation((req, res, next) => {
      req.auth = {
        userId: 'user_123',
        sessionId: 'session_456'
      };
      next();
    });
  });

  describe('GET /api/users/profile', () => {
    test('should return user profile successfully', async () => {
      const mockUser = {
        clerkId: 'user_123',
        email: 'test@example.com',
        name: 'John Doe',
        toPublicJSON: jest.fn().mockReturnValue({
          id: 'user_123',
          email: 'test@example.com',
          name: 'John Doe'
        })
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(User.findOne).toHaveBeenCalledWith({
        clerkId: 'user_123',
        isDeleted: false
      });
    });

    test('should return 404 if user not found', async () => {
      User.findOne = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/users/profile', () => {
    test('should update user profile successfully', async () => {
      const mockUser = {
        clerkId: 'user_123',
        email: 'test@example.com',
        name: 'Jane Doe',
        toPublicJSON: jest.fn().mockReturnValue({
          id: 'user_123',
          email: 'test@example.com',
          name: 'Jane Doe'
        })
      };

      User.findOneAndUpdate = jest.fn().mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/users/profile')
        .send({
          name: 'Jane Doe',
          phoneNumber: '+1234567890'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(User.findOneAndUpdate).toHaveBeenCalled();
    });

    test('should return 400 for invalid input', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({
          name: 'A', // Too short
          phoneNumber: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should return 404 if user not found', async () => {
      User.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put('/api/users/profile')
        .send({
          name: 'Jane Doe'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/users/profile/image', () => {
    test('should update profile image successfully', async () => {
      const mockUser = {
        clerkId: 'user_123',
        profileImage: 'https://example.com/new-image.jpg',
        toPublicJSON: jest.fn().mockReturnValue({
          id: 'user_123',
          profileImage: 'https://example.com/new-image.jpg'
        })
      };

      User.findOneAndUpdate = jest.fn().mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users/profile/image')
        .send({
          profileImage: 'https://example.com/new-image.jpg'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile image updated successfully');
    });

    test('should return 400 for invalid image URL', async () => {
      const response = await request(app)
        .post('/api/users/profile/image')
        .send({
          profileImage: 'not-a-url'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

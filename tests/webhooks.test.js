const request = require('supertest');
const express = require('express');
const webhooksRouter = require('../routes/webhooks');
const User = require('../models/User');

// Mock dependencies
jest.mock('svix');
jest.mock('../models/User');

const { Webhook } = require('svix');

describe('Webhooks API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/webhooks', webhooksRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/webhooks/clerk', () => {
    test('should return 400 if webhook headers are missing', async () => {
      const response = await request(app)
        .post('/api/webhooks/clerk')
        .send({ type: 'user.created' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_HEADERS');
    });

    test('should return 400 if webhook signature is invalid', async () => {
      const mockVerify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      Webhook.mockImplementation(() => ({
        verify: mockVerify
      }));

      const response = await request(app)
        .post('/api/webhooks/clerk')
        .set('svix-id', 'test-id')
        .set('svix-timestamp', '1234567890')
        .set('svix-signature', 'invalid-signature')
        .send({ type: 'user.created' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    test('should handle user.created event successfully', async () => {
      const mockUserData = {
        id: 'user_123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: 'John',
        last_name: 'Doe',
        phone_numbers: [{ phone_number: '+1234567890' }],
        image_url: 'https://example.com/image.jpg'
      };

      const mockVerify = jest.fn().mockReturnValue({
        type: 'user.created',
        data: mockUserData
      });

      Webhook.mockImplementation(() => ({
        verify: mockVerify
      }));

      const mockSave = jest.fn().mockResolvedValue({});
      User.mockImplementation(() => ({
        save: mockSave
      }));

      const response = await request(app)
        .post('/api/webhooks/clerk')
        .set('svix-id', 'test-id')
        .set('svix-timestamp', '1234567890')
        .set('svix-signature', 'valid-signature')
        .send({ type: 'user.created', data: mockUserData });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });

    test('should handle user.updated event successfully', async () => {
      const mockUserData = {
        id: 'user_123',
        email_addresses: [{ email_address: 'updated@example.com' }],
        first_name: 'Jane',
        last_name: 'Doe',
        phone_numbers: [{ phone_number: '+9876543210' }],
        image_url: 'https://example.com/new-image.jpg'
      };

      const mockVerify = jest.fn().mockReturnValue({
        type: 'user.updated',
        data: mockUserData
      });

      Webhook.mockImplementation(() => ({
        verify: mockVerify
      }));

      User.findOneAndUpdate = jest.fn().mockResolvedValue({
        clerkId: 'user_123',
        email: 'updated@example.com'
      });

      const response = await request(app)
        .post('/api/webhooks/clerk')
        .set('svix-id', 'test-id')
        .set('svix-timestamp', '1234567890')
        .set('svix-signature', 'valid-signature')
        .send({ type: 'user.updated', data: mockUserData });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(User.findOneAndUpdate).toHaveBeenCalled();
    });

    test('should handle user.deleted event successfully', async () => {
      const mockUserData = {
        id: 'user_123'
      };

      const mockVerify = jest.fn().mockReturnValue({
        type: 'user.deleted',
        data: mockUserData
      });

      Webhook.mockImplementation(() => ({
        verify: mockVerify
      }));

      User.findOneAndUpdate = jest.fn().mockResolvedValue({
        clerkId: 'user_123',
        isDeleted: true
      });

      const response = await request(app)
        .post('/api/webhooks/clerk')
        .set('svix-id', 'test-id')
        .set('svix-timestamp', '1234567890')
        .set('svix-signature', 'valid-signature')
        .send({ type: 'user.deleted', data: mockUserData });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { clerkId: 'user_123' },
        { isDeleted: true },
        { new: true }
      );
    });
  });
});

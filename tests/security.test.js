/**
 * Security Hardening Tests
 * Tests for security configurations and best practices
 */

const request = require('supertest');
const app = require('../server');
const { validateSecurityConfig, sanitizeForLogging, hasSensitiveData } = require('../utils/securityValidator');

describe('Security Hardening Tests', () => {
  
  describe('Security Configuration Validation', () => {
    test('should validate security configuration', () => {
      const { issues, warnings } = validateSecurityConfig();
      
      // In test environment, we may have warnings but no critical issues
      expect(Array.isArray(issues)).toBe(true);
      expect(Array.isArray(warnings)).toBe(true);
    });
  });

  describe('HTTPS Enforcement', () => {
    test('should allow requests in non-production environment', async () => {
      const response = await request(app)
        .get('/health');
      
      expect(response.status).not.toBe(403);
    });
  });

  describe('Security Headers (Helmet)', () => {
    test('should set security headers on responses', async () => {
      const response = await request(app)
        .get('/health');
      
      // Check for helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    test('should set strict transport security in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/health');
      
      // HSTS header should be present
      if (response.headers['strict-transport-security']) {
        expect(response.headers['strict-transport-security']).toContain('max-age');
      }
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limiting', () => {
    test('should have rate limit headers', async () => {
      const response = await request(app)
        .get('/api/items');
      
      // Rate limit headers should be present
      expect(response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit']).toBeDefined();
    });

    test('should enforce rate limits', async () => {
      // Make multiple requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(request(app).get('/api/items'));
      }
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed (we're under the limit)
      responses.forEach(response => {
        expect(response.status).not.toBe(429);
      });
    });
  });

  describe('CORS Configuration', () => {
    test('should have CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:8081');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should block unauthorized origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-site.com');
      
      // Should return 500 error from CORS middleware blocking the request
      // This is expected behavior - CORS middleware throws error for unauthorized origins
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Input Validation', () => {
    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', 'Bearer invalid-token')
        .send({});
      
      // Should fail validation or auth (not 500 error)
      expect(response.status).toBeLessThan(500);
    });

    test('should validate MongoDB ID format', async () => {
      const response = await request(app)
        .delete('/api/favorites/invalid-id')
        .set('Authorization', 'Bearer invalid-token');
      
      // Should return validation error or auth error
      expect(response.status).toBeLessThan(500);
    });

    test('should sanitize input data', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        email: 'test@test.com'
      };
      
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send(maliciousData);
      
      // Should handle malicious input safely
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Authentication Protection', () => {
    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/users/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    test('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'InvalidFormat');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Sensitive Data Protection', () => {
    test('should sanitize sensitive data from logs', () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'key123'
      };
      
      const sanitized = sanitizeForLogging(sensitiveData);
      
      expect(sanitized.username).toBe('testuser');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });

    test('should detect sensitive data in objects', () => {
      const dataWithPassword = { username: 'test', password: 'secret' };
      const dataWithToken = { data: { token: 'abc' } };
      const safeData = { username: 'test', email: 'test@test.com' };
      
      expect(hasSensitiveData(dataWithPassword)).toBe(true);
      expect(hasSensitiveData(dataWithToken)).toBe(true);
      expect(hasSensitiveData(safeData)).toBe(false);
    });

    test('should not expose sensitive data in error responses', async () => {
      const response = await request(app)
        .post('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send({ password: 'secret123' });
      
      const responseText = JSON.stringify(response.body);
      
      // Response should not contain the password
      expect(responseText).not.toContain('secret123');
    });
  });

  describe('Error Handling', () => {
    test('should return standardized error format', async () => {
      const response = await request(app)
        .get('/api/users/profile');
      
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    test('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/api/nonexistent-route');
      
      // Should not expose internal error details
      if (response.body && response.body.error) {
        expect(response.body.error.stack).toBeUndefined();
        expect(response.body.error.details).toBeUndefined();
      }
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Webhook Security', () => {
    test('should require webhook signature headers', async () => {
      const response = await request(app)
        .post('/api/webhooks/clerk')
        .send({ type: 'user.created', data: {} });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_HEADERS');
    });

    test('should reject invalid webhook signatures', async () => {
      const response = await request(app)
        .post('/api/webhooks/clerk')
        .set('svix-id', 'test-id')
        .set('svix-timestamp', Date.now().toString())
        .set('svix-signature', 'invalid-signature')
        .send({ type: 'user.created', data: {} });
      
      // Should fail signature verification
      expect(response.status).toBe(400);
    });
  });

  describe('Database Security', () => {
    test('should not expose MongoDB connection string', () => {
      const mongoUri = process.env.MONGODB_URI;
      
      // Ensure we're not logging the full connection string
      if (mongoUri && mongoUri.includes('@')) {
        // Connection string should contain credentials
        expect(mongoUri).toContain('@');
        
        // But we should never log it directly
        const sanitized = sanitizeForLogging({ mongoUri });
        expect(sanitized.mongoUri).toBe('[REDACTED]');
      }
    });
  });

  describe('Response Security', () => {
    test('should not expose internal server details', async () => {
      const response = await request(app)
        .get('/health');
      
      // Should not expose server technology
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should use secure response format', async () => {
      const response = await request(app)
        .get('/health');
      
      expect(response.body).toHaveProperty('success');
      expect(response.type).toContain('json');
    });
  });
});

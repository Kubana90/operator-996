/**
 * operator-996 Platform - API Integration Tests
 * @description Integration tests for API routes
 */

import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test_jwt_secret';

// Create a test app with mock routes
const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());

  // Mock request ID middleware
  app.use((req: Request, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });

  // Mock authentication middleware
  const mockAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing authorization header' });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid authorization format' });
      return;
    }

    try {
      const decoded = jwt.verify(parts[1], JWT_SECRET) as {
        userId: string;
        username: string;
        role: string;
      };
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
  };

  // Public route
  app.get('/api/status', (_req, res) => {
    res.json({
      api: 'operator-996',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Protected route
  app.get('/api/users/me', mockAuth, (req: Request, res: Response) => {
    res.json({
      id: req.user?.userId,
      username: req.user?.username,
      role: req.user?.role,
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  return app;
};

// Generate test JWT token
const generateTestToken = (payload: { userId: string; username: string; role: string }): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

describe('API Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/status', () => {
    it('should return API status without authentication', async () => {
      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('api', 'operator-996');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/users/me', () => {
    it('should return 401 without authorization header', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid token format', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return user data with valid token', async () => {
      const testUser = {
        userId: 'test-user-id',
        username: 'testuser',
        role: 'user',
      };
      const token = generateTestToken(testUser);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testUser.userId);
      expect(response.body).toHaveProperty('username', testUser.username);
      expect(response.body).toHaveProperty('role', testUser.role);
    });
  });
});

describe('JWT Token Generation', () => {
  it('should generate valid JWT token', () => {
    const payload = {
      userId: 'user-123',
      username: 'testuser',
      role: 'admin',
    };

    const token = generateTestToken(payload);
    const decoded = jwt.verify(token, JWT_SECRET) as typeof payload;

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.username).toBe(payload.username);
    expect(decoded.role).toBe(payload.role);
  });

  it('should include expiration in token', () => {
    const payload = {
      userId: 'user-123',
      username: 'testuser',
      role: 'user',
    };

    const token = generateTestToken(payload);
    const decoded = jwt.decode(token) as { exp: number };

    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

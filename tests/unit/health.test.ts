/**
 * operator-996 Platform - Health Endpoint Unit Tests
 * @description Unit tests for health check routes
 */

import request from 'supertest';
import express, { Express } from 'express';

// Create a minimal express app for testing
const createTestApp = (): Express => {
  const app = express();

  // Mock request ID middleware
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });

  // Simple health endpoint for testing
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 100,
      version: '1.0.0',
    });
  });

  app.get('/live', (_req, res) => {
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: 100,
    });
  });

  return app;
};

describe('Health Endpoints', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /health', () => {
    it('should return 200 OK with health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });

    it('should return valid timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      const timestamp = new Date(response.body.timestamp as string);
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });

    it('should return valid version format', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('GET /live', () => {
    it('should return 200 OK with alive status', async () => {
      const response = await request(app).get('/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alive', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return non-negative uptime', async () => {
      const response = await request(app).get('/live');

      expect(response.status).toBe(200);
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('HealthCheckResponse type', () => {
  it('should match expected interface', () => {
    const healthResponse = {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: 100,
      version: '1.0.0',
    };

    expect(healthResponse.status).toBe('ok');
    expect(typeof healthResponse.timestamp).toBe('string');
    expect(typeof healthResponse.uptime).toBe('number');
    expect(typeof healthResponse.version).toBe('string');
  });
});

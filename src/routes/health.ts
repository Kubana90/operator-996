/**
 * operator-996 Platform - Health Check Routes
 * @description Health, readiness, and liveness endpoints
 */

import { Router, Request, Response } from 'express';
import { checkConnection as checkDbConnection, getLatency as getDbLatency } from '../db/client';
import {
  checkConnection as checkRedisConnection,
  getLatency as getRedisLatency,
} from '../db/redis';
import { HealthCheckResponse, ReadinessResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const startTime = Date.now();
const version = process.env['npm_package_version'] ?? '1.0.0';

/**
 * GET /health
 * Basic health check endpoint for load balancers
 */
router.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version,
  };

  res.status(200).json(response);
});

/**
 * GET /ready
 * Readiness probe - checks if app is ready to receive traffic
 */
router.get('/ready', async (req: Request, res: Response) => {
  const [dbConnected, redisConnected, dbLatency, redisLatency] = await Promise.all([
    checkDbConnection(),
    checkRedisConnection(),
    getDbLatency(),
    getRedisLatency(),
  ]);

  const response: ReadinessResponse = {
    ready: dbConnected && redisConnected,
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        connected: dbConnected,
        latencyMs: dbLatency ?? undefined,
      },
      redis: {
        connected: redisConnected,
        latencyMs: redisLatency ?? undefined,
      },
    },
  };

  if (!response.ready) {
    logger.warn('Readiness check failed', {
      database: dbConnected,
      redis: redisConnected,
      requestId: req.requestId,
    });
  }

  res.status(response.ready ? 200 : 503).json(response);
});

/**
 * GET /live
 * Liveness probe - checks if app is running
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

/**
 * GET /health/detailed
 * Detailed health check with all dependencies
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  const [dbConnected, redisConnected, dbLatency, redisLatency] = await Promise.all([
    checkDbConnection(),
    checkRedisConnection(),
    getDbLatency(),
    getRedisLatency(),
  ]);

  const status =
    dbConnected && redisConnected ? 'ok' : dbConnected || redisConnected ? 'degraded' : 'error';

  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version,
    checks: {
      database: dbConnected,
      redis: redisConnected,
    },
  };

  const details = {
    ...response,
    latency: {
      database: dbLatency,
      redis: redisLatency,
    },
    memory: process.memoryUsage(),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  logger.debug('Detailed health check', {
    status,
    database: dbConnected,
    redis: redisConnected,
    requestId: req.requestId,
  });

  const statusCode = status === 'ok' ? 200 : status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(details);
});

export default router;

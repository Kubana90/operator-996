/**
 * operator-996 Platform - API Routes
 * @description Main API routes for the platform
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import biofeedbackService from '../services/biofeedback';
import { query } from '../db/client';
import { ApiError, PaginatedResponse, User, KPI, Event } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = Router();

/**
 * Create API error response
 */
function createApiError(
  statusCode: number,
  error: string,
  message: string,
  req: Request
): ApiError {
  return {
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.requestId,
  };
}

/**
 * Parse pagination parameters
 */
function getPaginationParams(req: Request): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * GET /api/status
 * API status endpoint
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    api: 'operator-996',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      biofeedback: config.enableBiofeedback,
      analytics: config.enableAnalytics,
    },
  });
});

// ============================================
// PROTECTED ROUTES
// ============================================

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get(
  '/users',
  authenticate,
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, offset } = getPaginationParams(req);

      const [usersResult, countResult] = await Promise.all([
        query<User>(
          `SELECT id, username, email, full_name, role, is_active, created_at, updated_at, last_login_at
           FROM users
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
      ]);

      const total = parseInt(countResult.rows[0]?.count ?? '0');
      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<User> = {
        data: usersResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/users/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<User>(
      `SELECT id, username, email, full_name, role, is_active, created_at, updated_at, last_login_at
       FROM users WHERE id = $1`,
      [req.user?.userId]
    );

    if (result.rows.length === 0) {
      const error = createApiError(404, 'Not Found', 'User not found', req);
      res.status(404).json(error);
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================
// BIOFEEDBACK ROUTES
// ============================================

/**
 * POST /api/biofeedback
 * Submit biofeedback metric
 */
router.post(
  '/biofeedback',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.enableBiofeedback) {
        const error = createApiError(
          503,
          'Service Unavailable',
          'Biofeedback feature disabled',
          req
        );
        res.status(503).json(error);
        return;
      }

      const { metricType, value, qualityScore, deviceId, context } = req.body as {
        metricType: string;
        value: number;
        qualityScore?: number;
        deviceId?: string;
        context?: Record<string, unknown>;
      };

      if (!metricType || value === undefined) {
        const error = createApiError(400, 'Bad Request', 'metricType and value are required', req);
        res.status(400).json(error);
        return;
      }

      const validTypes = ['heart_rate', 'stress_level', 'focus_score'];
      if (!validTypes.includes(metricType)) {
        const error = createApiError(
          400,
          'Bad Request',
          `Invalid metricType. Must be one of: ${validTypes.join(', ')}`,
          req
        );
        res.status(400).json(error);
        return;
      }

      const metric = await biofeedbackService.createMetric(
        req.user!.userId,
        metricType as 'heart_rate' | 'stress_level' | 'focus_score',
        value,
        { qualityScore, deviceId, context }
      );

      logger.debug('Biofeedback metric created', {
        userId: req.user?.userId,
        metricType,
        requestId: req.requestId,
      });

      res.status(201).json(metric);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/biofeedback
 * Get biofeedback metrics for current user
 */
router.get(
  '/biofeedback',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.enableBiofeedback) {
        const error = createApiError(
          503,
          'Service Unavailable',
          'Biofeedback feature disabled',
          req
        );
        res.status(503).json(error);
        return;
      }

      const { limit } = getPaginationParams(req);
      const metricType = req.query['type'] as string | undefined;
      const startTime = req.query['startTime']
        ? new Date(req.query['startTime'] as string)
        : undefined;
      const endTime = req.query['endTime'] ? new Date(req.query['endTime'] as string) : undefined;

      const metrics = await biofeedbackService.getMetricsByUser(req.user!.userId, {
        metricType: metricType as 'heart_rate' | 'stress_level' | 'focus_score' | undefined,
        startTime,
        endTime,
        limit,
      });

      res.json({ data: metrics });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/biofeedback/stats
 * Get biofeedback statistics for current user
 */
router.get(
  '/biofeedback/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.enableBiofeedback) {
        const error = createApiError(
          503,
          'Service Unavailable',
          'Biofeedback feature disabled',
          req
        );
        res.status(503).json(error);
        return;
      }

      const metricType = req.query['type'] as string;
      const timeRange = (req.query['range'] as '1h' | '24h' | '7d' | '30d') || '24h';

      if (!metricType) {
        const error = createApiError(400, 'Bad Request', 'type parameter is required', req);
        res.status(400).json(error);
        return;
      }

      const stats = await biofeedbackService.getMetricStats(
        req.user!.userId,
        metricType as 'heart_rate' | 'stress_level' | 'focus_score',
        timeRange
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// KPI ROUTES
// ============================================

/**
 * GET /api/kpis
 * Get all KPIs
 */
router.get('/kpis', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const category = req.query['category'] as string | undefined;

    let whereClause = 'WHERE is_active = true';
    const params: unknown[] = [limit, offset];

    if (category) {
      whereClause += ' AND category = $3';
      params.push(category);
    }

    const [kpisResult, countResult] = await Promise.all([
      query<KPI>(
        `SELECT * FROM kpis ${whereClause} ORDER BY category, name LIMIT $1 OFFSET $2`,
        params
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM kpis ${whereClause}`,
        params.slice(2)
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0');
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<KPI> = {
      data: kpisResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// ============================================
// EVENTS ROUTES
// ============================================

/**
 * POST /api/events
 * Track an event
 */
router.post('/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.enableAnalytics) {
      const error = createApiError(503, 'Service Unavailable', 'Analytics feature disabled', req);
      res.status(503).json(error);
      return;
    }

    const { eventType, eventName, eventData, source, sessionId } = req.body as {
      eventType: string;
      eventName: string;
      eventData?: Record<string, unknown>;
      source?: string;
      sessionId?: string;
    };

    if (!eventType || !eventName) {
      const error = createApiError(400, 'Bad Request', 'eventType and eventName are required', req);
      res.status(400).json(error);
      return;
    }

    const result = await query<Event>(
      `INSERT INTO events (user_id, event_type, event_name, event_data, source, ip_address, user_agent, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user!.userId,
        eventType,
        eventName,
        JSON.stringify(eventData ?? {}),
        source ?? 'api',
        req.ip,
        req.headers['user-agent'] ?? null,
        sessionId ?? null,
      ]
    );

    logger.debug('Event tracked', {
      userId: req.user?.userId,
      eventType,
      eventName,
      requestId: req.requestId,
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/events
 * Get events for current user
 */
router.get('/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.enableAnalytics) {
      const error = createApiError(503, 'Service Unavailable', 'Analytics feature disabled', req);
      res.status(503).json(error);
      return;
    }

    const { page, limit, offset } = getPaginationParams(req);
    const eventType = req.query['type'] as string | undefined;

    let whereClause = 'WHERE user_id = $3';
    const params: unknown[] = [limit, offset, req.user!.userId];

    if (eventType) {
      whereClause += ' AND event_type = $4';
      params.push(eventType);
    }

    const [eventsResult, countResult] = await Promise.all([
      query<Event>(
        `SELECT * FROM events ${whereClause} ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
        params
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM events ${whereClause}`,
        params.slice(2)
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0');
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<Event> = {
      data: eventsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// ============================================
// ERROR HANDLER
// ============================================

/**
 * Global error handler for API routes
 */
router.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.requestId,
  });

  const error = createApiError(500, 'Internal Server Error', 'An unexpected error occurred', req);
  res.status(500).json(error);
});

export default router;

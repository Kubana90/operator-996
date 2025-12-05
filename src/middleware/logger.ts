/**
 * operator-996 Platform - Request Logger Middleware
 * @description HTTP request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, logRequest } from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

/**
 * Request logging middleware
 * Adds request ID and logs request/response details
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate or use existing request ID
  req.requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
  req.startTime = Date.now();

  // Set request ID in response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log request on completion
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logRequest(req.method, req.path, res.statusCode, duration, req.requestId);
  });

  next();
}

/**
 * Error logging middleware
 */
export function errorLogger(err: Error, req: Request, _res: Response, next: NextFunction): void {
  logger.error('Request error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  });

  next(err);
}

export default { requestLogger, errorLogger };

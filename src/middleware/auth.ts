/**
 * operator-996 Platform - JWT Authentication Middleware
 * @description JWT-based authentication and authorization
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload, ApiError } from '../types';
import { logger } from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

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
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    const error = createApiError(401, 'Unauthorized', 'Missing authorization header', req);
    res.status(401).json(error);
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    const error = createApiError(401, 'Unauthorized', 'Invalid authorization format', req);
    res.status(401).json(error);
    return;
  }

  const token = parts[1];
  if (!token) {
    const error = createApiError(401, 'Unauthorized', 'Missing token', req);
    res.status(401).json(error);
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = decoded;

    logger.debug('User authenticated', {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      requestId: req.requestId,
    });

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      const error = createApiError(401, 'Unauthorized', 'Token expired', req);
      res.status(401).json(error);
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      const error = createApiError(401, 'Unauthorized', 'Invalid token', req);
      res.status(401).json(error);
      return;
    }

    logger.error('Authentication error', {
      error: err instanceof Error ? err.message : 'Unknown error',
      requestId: req.requestId,
    });

    const error = createApiError(500, 'Internal Server Error', 'Authentication failed', req);
    res.status(500).json(error);
  }
}

/**
 * Optional authentication middleware
 * Validates JWT if present, but doesn't require it
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(parts[1], config.jwt.secret) as JWTPayload;
    req.user = decoded;
  } catch {
    // Token invalid, but we continue without user
  }

  next();
}

/**
 * Role-based authorization middleware
 * Requires authentication middleware to run first
 */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const error = createApiError(401, 'Unauthorized', 'Authentication required', req);
      res.status(401).json(error);
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: roles,
        requestId: req.requestId,
      });

      const error = createApiError(403, 'Forbidden', 'Insufficient permissions', req);
      res.status(403).json(error);
      return;
    }

    next();
  };
}

/**
 * Generate JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry as string,
  } as jwt.SignOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  } catch {
    return null;
  }
}

export default { authenticate, optionalAuth, authorize, generateToken, verifyToken };

/**
 * operator-996 Platform - Main Application Entry Point
 * @description Express server setup and initialization
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Registry, collectDefaultMetrics } from 'prom-client';

import { config, isProduction } from './config';
import { logger, logError } from './utils/logger';
import { requestLogger, errorLogger } from './middleware/logger';
import { initializePool, closePool } from './db/client';
import { initializeRedis, close as closeRedis } from './db/redis';

import healthRoutes from './routes/health';
import apiRoutes from './routes/api';

// Initialize Prometheus metrics
const register = new Registry();
collectDefaultMetrics({ register });

// Create Express app
const app = express();

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: isProduction(),
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  })
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Trust proxy for correct client IP
app.set('trust proxy', 1);

// ============================================
// ROUTES
// ============================================

// Health check routes (no prefix)
app.use('/', healthRoutes);

// API routes
app.use('/api', apiRoutes);

// Prometheus metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end();
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logError(err, { path: req.path, method: req.method, requestId: req.requestId });

  const statusCode = 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Error',
    message: isProduction() ? 'An error occurred' : err.message,
    statusCode,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    ...(isProduction() ? {} : { stack: err.stack }),
  });
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer(): Promise<void> {
  try {
    logger.info('Initializing operator-996 platform...');

    // Initialize database connection pool
    logger.info('Connecting to database...');
    initializePool();

    // Initialize Redis
    logger.info('Connecting to Redis...');
    initializeRedis();

    // Start HTTP server
    const server = app.listen(config.app.port, config.app.host, () => {
      logger.info(`Server started successfully`, {
        host: config.app.host,
        port: config.app.port,
        environment: config.app.nodeEnv,
        features: {
          biofeedback: config.enableBiofeedback,
          analytics: config.enableAnalytics,
          debugRoutes: config.enableDebugRoutes,
        },
      });
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await Promise.all([closePool(), closeRedis()]);

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          process.exit(1);
        }
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Start the server
void startServer();

export { app };

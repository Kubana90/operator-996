import express, { Application, Request, Response, NextFunction } from 'express';
import config from './config';
import logger from './utils/logger';
import healthRoutes from './routes/health';
import smartFrequencyRoutes from './routes/smartFrequency';

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/', healthRoutes);
if (config.features.enableBiofeedback) {
  app.use('/', smartFrequencyRoutes);
} else {
  app.use(
    ['/smart-frequency', '/smart-frequency/*'],
    (_req: Request, res: Response) => {
      res.status(503).json({ error: 'SmartFrequency feature is disabled' });
    }
  );
}

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'operator-996',
    version: '1.0.0',
    description: 'Advanced DevOps Infrastructure Platform',
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const { port, host } = config.app;

app.listen(port, host, () => {
  logger.info(`Server running on http://${host}:${port}`);
  logger.info(`Environment: ${config.app.nodeEnv}`);
});

export default app;

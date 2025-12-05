import { Router, Request, Response } from 'express';

const router = Router();

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

router.get('/health', (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };
  res.json(response);
});

router.get('/ready', (_req: Request, res: Response) => {
  res.json({ ready: true });
});

router.get('/live', (_req: Request, res: Response) => {
  res.json({ live: true });
});

export default router;

import { Router, Request, Response } from 'express';

const router = Router();

export interface FrequencyMeasurement {
  userId: string;
  frequencyHz: number;
  signalType: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface FrequencyAnalytics {
  averageHz: number;
  minHz: number;
  maxHz: number;
  sampleCount: number;
  signalType: string;
  windowMinutes: number;
}

// In-memory store for measurements (replaced by DB in production)
const measurements: FrequencyMeasurement[] = [];

router.get('/smart-frequency/status', (_req: Request, res: Response) => {
  res.json({
    status: 'active',
    feature: 'SmartFrequency',
    timestamp: new Date().toISOString(),
    measurementCount: measurements.length,
  });
});

router.get('/smart-frequency/measurements', (req: Request, res: Response) => {
  const { userId, signalType } = req.query as {
    userId?: string;
    signalType?: string;
  };

  const filtered = measurements.filter(
    (m) =>
      (userId === undefined || m.userId === userId) &&
      (signalType === undefined || m.signalType === signalType)
  );

  res.json({ measurements: filtered, total: filtered.length });
});

router.post('/smart-frequency/measurements', (req: Request, res: Response) => {
  const { userId, frequencyHz, signalType, metadata } =
    req.body as FrequencyMeasurement;

  if (
    !userId ||
    !userId.trim() ||
    frequencyHz === undefined ||
    !signalType ||
    !signalType.trim()
  ) {
    res
      .status(400)
      .json({ error: 'userId, frequencyHz and signalType are required' });
    return;
  }

  if (typeof frequencyHz !== 'number' || frequencyHz < 0) {
    res
      .status(400)
      .json({ error: 'frequencyHz must be a non-negative number' });
    return;
  }

  const measurement: FrequencyMeasurement = {
    userId,
    frequencyHz,
    signalType,
    timestamp: new Date().toISOString(),
    metadata: metadata ?? {},
  };

  measurements.push(measurement);

  res.status(201).json({ success: true, measurement });
});

router.get('/smart-frequency/analytics', (req: Request, res: Response) => {
  const signalType = (req.query.signalType as string) || null;
  const windowMinutes = parseInt(
    (req.query.windowMinutes as string) || '60',
    10
  );

  if (isNaN(windowMinutes) || windowMinutes <= 0 || windowMinutes > 1440) {
    res
      .status(400)
      .json({ error: 'windowMinutes must be a number between 1 and 1440' });
    return;
  }

  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const filtered = measurements.filter(
    (m) =>
      m.timestamp >= cutoff &&
      (signalType === null || m.signalType === signalType)
  );

  if (filtered.length === 0) {
    res.json({
      averageHz: 0,
      minHz: 0,
      maxHz: 0,
      sampleCount: 0,
      signalType: signalType ?? 'all',
      windowMinutes,
    } as FrequencyAnalytics);
    return;
  }

  const frequencies = filtered.map((m) => m.frequencyHz);
  const averageHz = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;

  res.json({
    averageHz: Math.round(averageHz * 1000) / 1000,
    minHz: Math.min(...frequencies),
    maxHz: Math.max(...frequencies),
    sampleCount: filtered.length,
    signalType: signalType ?? 'all',
    windowMinutes,
  } as FrequencyAnalytics);
});

export default router;

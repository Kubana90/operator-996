/**
 * operator-996 Platform - Biofeedback Metrics Service
 * @description Service for handling biofeedback metrics
 */

import { query } from '../db/client';
import { BiofeedbackMetric } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new biofeedback metric
 */
export async function createMetric(
  userId: string,
  metricType: BiofeedbackMetric['metricType'],
  value: number,
  options?: {
    qualityScore?: number;
    deviceId?: string;
    context?: Record<string, unknown>;
  }
): Promise<BiofeedbackMetric> {
  const id = uuidv4();
  const timestamp = new Date();

  const result = await query<BiofeedbackMetric>(
    `INSERT INTO biofeedback_metrics 
     (id, user_id, metric_type, value, quality_score, device_id, context, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      userId,
      metricType,
      value,
      options?.qualityScore ?? null,
      options?.deviceId ?? null,
      JSON.stringify(options?.context ?? {}),
      timestamp,
    ]
  );

  logger.debug('Created biofeedback metric', {
    id,
    userId,
    metricType,
    value,
  });

  return result.rows[0]!;
}

/**
 * Get metrics for a user within a time range
 */
export async function getMetricsByUser(
  userId: string,
  options?: {
    metricType?: BiofeedbackMetric['metricType'];
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }
): Promise<BiofeedbackMetric[]> {
  const conditions: string[] = ['user_id = $1'];
  const params: unknown[] = [userId];
  let paramIndex = 2;

  if (options?.metricType) {
    conditions.push(`metric_type = $${paramIndex}`);
    params.push(options.metricType);
    paramIndex++;
  }

  if (options?.startTime) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(options.startTime);
    paramIndex++;
  }

  if (options?.endTime) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(options.endTime);
    paramIndex++;
  }

  const limit = options?.limit ?? 100;
  params.push(limit);

  const sql = `
    SELECT * FROM biofeedback_metrics
    WHERE ${conditions.join(' AND ')}
    ORDER BY timestamp DESC
    LIMIT $${paramIndex}
  `;

  const result = await query<BiofeedbackMetric>(sql, params);
  return result.rows;
}

/**
 * Get aggregated metrics (5-minute averages)
 */
export async function getAggregatedMetrics(
  userId: string,
  metricType: BiofeedbackMetric['metricType'],
  options?: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }
): Promise<
  Array<{
    bucket: Date;
    avgValue: number;
    minValue: number;
    maxValue: number;
    sampleCount: number;
  }>
> {
  const conditions: string[] = ['user_id = $1', 'metric_type = $2'];
  const params: unknown[] = [userId, metricType];
  let paramIndex = 3;

  if (options?.startTime) {
    conditions.push(`bucket >= $${paramIndex}`);
    params.push(options.startTime);
    paramIndex++;
  }

  if (options?.endTime) {
    conditions.push(`bucket <= $${paramIndex}`);
    params.push(options.endTime);
    paramIndex++;
  }

  const limit = options?.limit ?? 100;
  params.push(limit);

  const sql = `
    SELECT 
      bucket,
      avg_value as "avgValue",
      min_value as "minValue",
      max_value as "maxValue",
      sample_count as "sampleCount"
    FROM biofeedback_5min_avg
    WHERE ${conditions.join(' AND ')}
    ORDER BY bucket DESC
    LIMIT $${paramIndex}
  `;

  const result = await query<{
    bucket: Date;
    avgValue: number;
    minValue: number;
    maxValue: number;
    sampleCount: number;
  }>(sql, params);

  return result.rows;
}

/**
 * Get latest metric for a user
 */
export async function getLatestMetric(
  userId: string,
  metricType: BiofeedbackMetric['metricType']
): Promise<BiofeedbackMetric | null> {
  const result = await query<BiofeedbackMetric>(
    `SELECT * FROM biofeedback_metrics
     WHERE user_id = $1 AND metric_type = $2
     ORDER BY timestamp DESC
     LIMIT 1`,
    [userId, metricType]
  );

  return result.rows[0] ?? null;
}

/**
 * Get metric statistics for a user
 */
export async function getMetricStats(
  userId: string,
  metricType: BiofeedbackMetric['metricType'],
  timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<{
  avg: number;
  min: number;
  max: number;
  count: number;
  stddev: number;
} | null> {
  const intervalMap = {
    '1h': '1 hour',
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
  };

  const result = await query<{
    avg: number;
    min: number;
    max: number;
    count: number;
    stddev: number;
  }>(
    `SELECT 
      AVG(value)::numeric(10,2) as avg,
      MIN(value)::numeric(10,2) as min,
      MAX(value)::numeric(10,2) as max,
      COUNT(*)::integer as count,
      STDDEV(value)::numeric(10,2) as stddev
     FROM biofeedback_metrics
     WHERE user_id = $1 
       AND metric_type = $2
       AND timestamp > NOW() - INTERVAL '${intervalMap[timeRange]}'`,
    [userId, metricType]
  );

  return result.rows[0] ?? null;
}

/**
 * Batch insert biofeedback metrics
 */
export async function batchCreateMetrics(
  metrics: Array<{
    userId: string;
    metricType: BiofeedbackMetric['metricType'];
    value: number;
    qualityScore?: number;
    deviceId?: string;
    context?: Record<string, unknown>;
    timestamp?: Date;
  }>
): Promise<number> {
  if (metrics.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const metric of metrics) {
    const id = uuidv4();
    const timestamp = metric.timestamp ?? new Date();
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
    );
    values.push(
      id,
      metric.userId,
      metric.metricType,
      metric.value,
      metric.qualityScore ?? null,
      metric.deviceId ?? null,
      JSON.stringify(metric.context ?? {}),
      timestamp
    );
    paramIndex += 8;
  }

  const sql = `
    INSERT INTO biofeedback_metrics 
    (id, user_id, metric_type, value, quality_score, device_id, context, timestamp)
    VALUES ${placeholders.join(', ')}
  `;

  const result = await query(sql, values);
  logger.debug('Batch inserted biofeedback metrics', { count: result.rowCount });

  return result.rowCount ?? 0;
}

export default {
  createMetric,
  getMetricsByUser,
  getAggregatedMetrics,
  getLatestMetric,
  getMetricStats,
  batchCreateMetrics,
};

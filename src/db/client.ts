/**
 * operator-996 Platform - PostgreSQL/TimescaleDB Client
 * @description Database connection pool and client management
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * PostgreSQL connection pool
 */
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initializePool(): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl ? { rejectUnauthorized: true } : false,
    min: config.db.poolMin,
    max: config.db.poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('connect', () => {
    logger.debug('Database client connected');
  });

  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err.message });
  });

  logger.info('Database pool initialized', {
    host: config.db.host,
    database: config.db.database,
    poolSize: `${config.db.poolMin}-${config.db.poolMax}`,
  });

  return pool;
}

/**
 * Get the database pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Execute a query on the database
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const dbPool = getPool();
  const start = Date.now();

  try {
    const result = await dbPool.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rowCount: result.rowCount,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Database query failed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const dbPool = getPool();
  return dbPool.connect();
}

/**
 * Check database connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const start = Date.now();
    await query('SELECT 1');
    const duration = Date.now() - start;

    logger.debug('Database health check passed', { latencyMs: duration });
    return true;
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get connection latency
 */
export async function getLatency(): Promise<number | null> {
  try {
    const start = Date.now();
    await query('SELECT 1');
    return Date.now() - start;
  } catch {
    return null;
  }
}

/**
 * Close database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

export default {
  initializePool,
  getPool,
  query,
  getClient,
  checkConnection,
  getLatency,
  closePool,
};

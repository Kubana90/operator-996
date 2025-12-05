/**
 * operator-996 Platform - Redis Cache Client
 * @description Redis connection and cache management
 */

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Redis client instance
 */
let redisClient: Redis | null = null;

/**
 * Initialize Redis client
 */
export function initializeRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    db: config.redis.db,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis connection retry attempt ${times}`, { delay });
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected', {
      host: config.redis.host,
      port: config.redis.port,
    });
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  redisClient.on('ready', () => {
    logger.debug('Redis client ready');
  });

  redisClient.on('close', () => {
    logger.debug('Redis connection closed');
  });

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedis(): Redis {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
}

/**
 * Connect to Redis
 */
export async function connect(): Promise<void> {
  const client = getRedis();
  if (client.status !== 'ready' && client.status !== 'connecting') {
    await client.connect();
  }
}

/**
 * Set a value with optional TTL
 */
export async function set(
  key: string,
  value: string,
  ttl: number = config.redis.ttl
): Promise<void> {
  const client = getRedis();
  await client.set(key, value, 'EX', ttl);
}

/**
 * Get a value by key
 */
export async function get(key: string): Promise<string | null> {
  const client = getRedis();
  return client.get(key);
}

/**
 * Delete a key
 */
export async function del(key: string): Promise<number> {
  const client = getRedis();
  return client.del(key);
}

/**
 * Set JSON value
 */
export async function setJSON<T>(
  key: string,
  value: T,
  ttl: number = config.redis.ttl
): Promise<void> {
  await set(key, JSON.stringify(value), ttl);
}

/**
 * Get JSON value
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  const value = await get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  const client = getRedis();
  const result = await client.exists(key);
  return result === 1;
}

/**
 * Check Redis connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const client = getRedis();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', {
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
    const client = getRedis();
    const start = Date.now();
    await client.ping();
    return Date.now() - start;
  } catch {
    return null;
  }
}

/**
 * Close Redis connection
 */
export async function close(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

export default {
  initializeRedis,
  getRedis,
  connect,
  set,
  get,
  del,
  setJSON,
  getJSON,
  exists,
  checkConnection,
  getLatency,
  close,
};

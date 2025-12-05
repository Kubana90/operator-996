/**
 * operator-996 Platform - Configuration Management
 * @description Centralized configuration from environment variables
 */

import dotenv from 'dotenv';
import { Config, AppConfig, DatabaseConfig, RedisConfig, JWTConfig } from '../types';

// Load environment variables
dotenv.config();

/**
 * Get environment variable with type safety
 */
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Get environment variable as number
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

/**
 * Get environment variable as boolean
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Application configuration
 */
const appConfig: AppConfig = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getEnvNumber('PORT', 3000),
  host: getEnv('HOST', '0.0.0.0'),
  logLevel: getEnv('LOG_LEVEL', 'info'),
};

/**
 * Database configuration
 */
const dbConfig: DatabaseConfig = {
  host: getEnv('DB_HOST', 'localhost'),
  port: getEnvNumber('DB_PORT', 5432),
  database: getEnv('DB_NAME', 'operator996_dev'),
  user: getEnv('DB_USER', 'dev_user'),
  password: getEnv('DB_PASSWORD', 'dev_password'),
  ssl: getEnvBoolean('DB_SSL', false),
  poolMin: getEnvNumber('DB_POOL_MIN', 2),
  poolMax: getEnvNumber('DB_POOL_MAX', 10),
};

/**
 * Redis configuration
 */
const redisConfig: RedisConfig = {
  host: getEnv('REDIS_HOST', 'localhost'),
  port: getEnvNumber('REDIS_PORT', 6379),
  password: getEnv('REDIS_PASSWORD', ''),
  db: getEnvNumber('REDIS_DB', 0),
  ttl: getEnvNumber('REDIS_TTL', 3600),
};

/**
 * JWT configuration
 */
const jwtConfig: JWTConfig = {
  secret: getEnv('JWT_SECRET', 'dev_secret_CHANGE_ME_IN_PRODUCTION'),
  expiry: getEnv('JWT_EXPIRY', '24h'),
};

/**
 * Complete application configuration
 */
export const config: Config = {
  app: appConfig,
  db: dbConfig,
  redis: redisConfig,
  jwt: jwtConfig,
  corsOrigins: getEnv('CORS_ORIGIN', 'http://localhost:3000').split(','),
  rateLimit: getEnvNumber('API_RATE_LIMIT', 1000),
  enableBiofeedback: getEnvBoolean('ENABLE_BIOFEEDBACK', true),
  enableAnalytics: getEnvBoolean('ENABLE_ANALYTICS', true),
  enableDebugRoutes: getEnvBoolean('ENABLE_DEBUG_ROUTES', false),
};

/**
 * Check if running in production
 */
export const isProduction = (): boolean => config.app.nodeEnv === 'production';

/**
 * Check if running in development
 */
export const isDevelopment = (): boolean => config.app.nodeEnv === 'development';

/**
 * Check if running in test
 */
export const isTest = (): boolean => config.app.nodeEnv === 'test';

export default config;

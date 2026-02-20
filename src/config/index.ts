import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  logLevel: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  ttl: number;
}

export interface FeaturesConfig {
  enableBiofeedback: boolean;
  enableAnalytics: boolean;
}

export interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  features: FeaturesConfig;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Helper to get required env vars in production
function getRequiredEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (isProduction && !value) {
    throw new Error(
      `Required environment variable ${key} is not set in production`
    );
  }
  return value || defaultValue;
}

const config: Config = {
  app: {
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'operator996',
    user: process.env.DB_USER || 'postgres',
    password: getRequiredEnv('DB_PASSWORD', ''),
    ssl: process.env.DB_SSL === 'true',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },
  features: {
    enableBiofeedback: process.env.ENABLE_BIOFEEDBACK !== 'false',
    enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
  },
};

export default config;

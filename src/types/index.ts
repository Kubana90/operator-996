/**
 * operator-996 Platform - Type Definitions
 * @description TypeScript type definitions for the platform
 */

/**
 * Application configuration interface
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  logLevel: string;
}

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
}

/**
 * Redis configuration interface
 */
export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  ttl: number;
}

/**
 * JWT configuration interface
 */
export interface JWTConfig {
  secret: string;
  expiry: string;
}

/**
 * Complete configuration interface
 */
export interface Config {
  app: AppConfig;
  db: DatabaseConfig;
  redis: RedisConfig;
  jwt: JWTConfig;
  corsOrigins: string[];
  rateLimit: number;
  enableBiofeedback: boolean;
  enableAnalytics: boolean;
  enableDebugRoutes: boolean;
}

/**
 * User entity interface
 */
export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * JWT Payload interface
 */
export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Health check response interface
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  checks?: {
    database: boolean;
    redis: boolean;
  };
}

/**
 * Readiness check response interface
 */
export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: {
    database: {
      connected: boolean;
      latencyMs?: number;
    };
    redis: {
      connected: boolean;
      latencyMs?: number;
    };
  };
}

/**
 * Biofeedback metric interface
 */
export interface BiofeedbackMetric {
  id: string;
  userId: string;
  metricType: 'heart_rate' | 'stress_level' | 'focus_score';
  value: number;
  qualityScore?: number;
  deviceId?: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Event interface for tracking
 */
export interface Event {
  id: string;
  userId?: string;
  eventType: string;
  eventName: string;
  eventData?: Record<string, unknown>;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: Date;
}

/**
 * KPI interface
 */
export interface KPI {
  id: string;
  name: string;
  category: string;
  description?: string;
  unit?: string;
  targetValue?: number;
  thresholdWarning?: number;
  thresholdCritical?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * KPI Measurement interface
 */
export interface KPIMeasurement {
  id: string;
  kpiId: string;
  value: number;
  dimension1?: string;
  dimension2?: string;
  dimension3?: string;
  tags?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * System metric interface
 */
export interface SystemMetric {
  id: string;
  serviceName: string;
  metricName: string;
  metricValue: number;
  unit?: string;
  hostname?: string;
  environment?: string;
  labels?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * API Error response interface
 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  requestId?: string;
}

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

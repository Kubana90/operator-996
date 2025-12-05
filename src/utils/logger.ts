/**
 * operator-996 Platform - Winston Logger Setup
 * @description Structured logging configuration
 */

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/**
 * Custom log format for development
 */
const devFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
  const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
  return `${String(ts)} [${level}]: ${String(message)} ${metaStr}`;
});

/**
 * Production format (JSON)
 */
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

/**
 * Development format (colored, human-readable)
 */
const devFormatComplete = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  devFormat
);

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  level: config.app.logLevel,
  format: config.app.nodeEnv === 'production' ? prodFormat : devFormatComplete,
  defaultMeta: {
    service: 'operator-996',
    environment: config.app.nodeEnv,
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

/**
 * Log request information
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  requestId?: string
): void {
  logger.info('HTTP Request', {
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    requestId,
  });
}

/**
 * Log error with stack trace
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error(error.message, {
    ...context,
    stack: error.stack,
    name: error.name,
  });
}

export default logger;

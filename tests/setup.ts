/**
 * operator-996 Platform - Test Setup
 * @description Global test configuration and setup
 */

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock environment variables for testing
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3000';
process.env['HOST'] = '0.0.0.0';
process.env['LOG_LEVEL'] = 'error';
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['DB_NAME'] = 'operator996_test';
process.env['DB_USER'] = 'test_user';
process.env['DB_PASSWORD'] = 'test_pass';
process.env['DB_SSL'] = 'false';
process.env['DB_POOL_MIN'] = '2';
process.env['DB_POOL_MAX'] = '10';
process.env['REDIS_HOST'] = 'localhost';
process.env['REDIS_PORT'] = '6379';
process.env['REDIS_PASSWORD'] = '';
process.env['REDIS_DB'] = '0';
process.env['REDIS_TTL'] = '3600';
process.env['JWT_SECRET'] = 'test_jwt_secret_for_testing_only';
process.env['JWT_EXPIRY'] = '1h';
process.env['ENABLE_BIOFEEDBACK'] = 'true';
process.env['ENABLE_ANALYTICS'] = 'true';
process.env['ENABLE_DEBUG_ROUTES'] = 'false';
process.env['API_RATE_LIMIT'] = '1000';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';

// Suppress console logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

export {};

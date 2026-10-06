const path = require('path');

// Load DB host, port and credentials from backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Test-only settings. They override .env so tests behave the same on every machine.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'jest_only_secret_not_used_anywhere_else';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_DAYS = '7';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAMESITE = 'strict';
process.env.MAX_FAILED_LOGINS = '5';
process.env.LOCK_MINUTES = '15';

// Tests ALWAYS use the separate test database, never your real data
process.env.DB_NAME = 'store_rating_test';
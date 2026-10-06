const path = require('path');

// Load DB host, port and credentials from backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Test-only settings
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'jest_only_secret_not_used_anywhere_else';

// Tests ALWAYS use the separate test database, never your real data
process.env.DB_NAME = 'store_rating_test';
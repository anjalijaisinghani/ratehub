const path = require('path');

// Runs ONCE before all integration tests: make sure the test database schema is up to date
module.exports = async () => {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
  process.env.DB_NAME = 'store_rating_test';

  const { runMigrations } = require('../../src/db/migrate');
  await runMigrations({ log: () => {} });
};
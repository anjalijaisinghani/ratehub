// Integration tests: real app + real MySQL test database. Run with: npm run test:integration
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.int.test.js'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  globalSetup: '<rootDir>/tests/integration/globalSetup.js',
  testTimeout: 20000,
  verbose: true,
};
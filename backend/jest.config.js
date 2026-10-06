// Unit tests: no database needed. Run with: npm test
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  verbose: true,
};
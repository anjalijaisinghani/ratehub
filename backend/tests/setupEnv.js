// Runs before every test file. Test-only settings, never real secrets.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'jest_only_secret_not_used_anywhere_else';
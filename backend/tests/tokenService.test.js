const jwt = require('jsonwebtoken');
const tokenService = require('../src/services/tokenService');

describe('tokenService', () => {
  test('access token carries id, role and sid, and expires', () => {
    const token = tokenService.createAccessToken({ id: 4, role: 'OWNER' }, 'family-1');
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    expect(decoded).toMatchObject({ id: 4, role: 'OWNER', sid: 'family-1' });
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  test('refresh tokens are long and different every time', () => {
    const a = tokenService.generateRefreshToken();
    const b = tokenService.generateRefreshToken();
    expect(a).toHaveLength(96);
    expect(a).not.toBe(b);
  });

  test('hashToken is deterministic, 64 hex characters, and not the token itself', () => {
    const token = tokenService.generateRefreshToken();
    const hash = tokenService.hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenService.hashToken(token)).toBe(hash);
    expect(hash).not.toBe(token);
  });

  test('refresh expiry is about 7 days ahead', () => {
    const days = (tokenService.refreshExpiry() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);
  });
});
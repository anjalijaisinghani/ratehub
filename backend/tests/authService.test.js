const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../src/repositories/userRepository');
jest.mock('../src/repositories/refreshTokenRepository');
jest.mock('../src/services/accountService'); // emails are tested in accountService.test.js


const userRepository = require('../src/repositories/userRepository');
const refreshTokenRepository = require('../src/repositories/refreshTokenRepository');
const authService = require('../src/services/authService');
const accountService = require('../src/services/accountService');
const tokenService = require('../src/services/tokenService');
const config = require('../src/config/security');

const signupInput = {
  name: 'Rahul Sharma Test User One',
  email: 'rahul@example.com',
  address: '12 MG Road, Pune',
  password: 'Rahul@1234',
};

const makeUser = async (overrides = {}) => ({
  id: 2,
  name: signupInput.name,
  email: signupInput.email,
  address: signupInput.address,
  role: 'USER',
  status: 'ACTIVE',
  failed_login_attempts: 0,
  locked_until: null,
  password_hash: await bcrypt.hash('Rahul@1234', 4), // low cost = faster tests
  ...overrides,
});

const tokenRow = (overrides = {}) => ({
  id: 10,
  user_id: 2,
  family_id: 'fam-1',
  expires_at: new Date(Date.now() + 3600 * 1000),
  revoked_at: null,
  revoked_reason: null,
  ...overrides,
});

beforeEach(() => jest.resetAllMocks());

describe('signup', () => {
    test('self-signup creates a PENDING account and sends the verification email', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(7);

    await authService.signup(signupInput);

    expect(userRepository.create.mock.calls[0][0].status).toBe('PENDING');
    expect(accountService.sendVerificationEmail).toHaveBeenCalledWith({
      id: 7,
      name: signupInput.name,
      email: signupInput.email,
    });
  });

  test('a duplicate signup sends no email', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: 1 });
    await expect(authService.signup(signupInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(accountService.sendVerificationEmail).not.toHaveBeenCalled();
  });
  test('creates a USER and stores a hashed password', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(7);

    const user = await authService.signup(signupInput);

    expect(user).toEqual({
      id: 7,
      name: signupInput.name,
      email: signupInput.email,
      address: signupInput.address,
      role: 'USER',
    });
    const saved = userRepository.create.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe(signupInput.password);
    expect(saved.passwordHash.startsWith('$2')).toBe(true);
  });

  test('ignores a role sent by the client (no privilege escalation)', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(8);
    await authService.signup({ ...signupInput, role: 'ADMIN' });
    expect(userRepository.create.mock.calls[0][0].role).toBe('USER');
  });

  test('rejects a duplicate email with 409 EMAIL_EXISTS', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: 1 });
    await expect(authService.signup(signupInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_EXISTS',
    });
    expect(userRepository.create).not.toHaveBeenCalled();
  });
});

describe('login', () => {
  test('returns an access token tied to a new session, plus a refresh token', async () => {
    userRepository.findByEmail.mockResolvedValue(await makeUser());

    const result = await authService.login(
      { email: 'rahul@example.com', password: 'Rahul@1234' },
      { ip: '1.2.3.4', userAgent: 'jest' }
    );

    const created = refreshTokenRepository.create.mock.calls[0][0];
    const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({ id: 2, role: 'USER', sid: created.familyId });
    expect(created).toMatchObject({ userId: 2, ip: '1.2.3.4', userAgent: 'jest' });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(userRepository.recordSuccessfulLogin).toHaveBeenCalledWith(2, expect.any(Date));
  });

  test('the database receives only a HASH of the refresh token', async () => {
    userRepository.findByEmail.mockResolvedValue(await makeUser());

    const result = await authService.login({ email: 'rahul@example.com', password: 'Rahul@1234' });

    const created = refreshTokenRepository.create.mock.calls[0][0];
    expect(created.tokenHash).toBe(tokenService.hashToken(result.refreshToken));
    expect(created.tokenHash).not.toBe(result.refreshToken);
  });

  test('unknown email gives 401 INVALID_CREDENTIALS and records nothing', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await expect(
      authService.login({ email: 'nobody@example.com', password: 'Whatever@1' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    expect(userRepository.registerFailedLogin).not.toHaveBeenCalled();
  });

  test('wrong password gives the SAME error and counts a failed attempt', async () => {
    userRepository.findByEmail.mockResolvedValue(await makeUser());

    await expect(
      authService.login({ email: 'rahul@example.com', password: 'Wrong@1234' })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });

    const [id, max, lockUntil] = userRepository.registerFailedLogin.mock.calls[0];
    expect(id).toBe(2);
    expect(max).toBe(config.maxFailedLogins);
    const minutesAhead = (lockUntil - Date.now()) / 60000;
    expect(minutesAhead).toBeGreaterThan(config.lockMinutes - 0.5);
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  test('a locked account gets 429 ACCOUNT_LOCKED, even with the CORRECT password', async () => {
    userRepository.findByEmail.mockResolvedValue(
      await makeUser({ locked_until: new Date(Date.now() + 10 * 60 * 1000) })
    );

    await expect(
      authService.login({ email: 'rahul@example.com', password: 'Rahul@1234' })
    ).rejects.toMatchObject({ statusCode: 429, code: 'ACCOUNT_LOCKED' });
    expect(userRepository.recordSuccessfulLogin).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  test('an expired lock is cleared and login works again', async () => {
    userRepository.findByEmail.mockResolvedValue(
      await makeUser({ failed_login_attempts: 5, locked_until: new Date(Date.now() - 1000) })
    );

    const result = await authService.login({ email: 'rahul@example.com', password: 'Rahul@1234' });

    expect(userRepository.clearLock).toHaveBeenCalledWith(2);
    expect(result.accessToken).toBeDefined();
  });

  test('a suspended account is refused only AFTER the correct password', async () => {
    userRepository.findByEmail.mockResolvedValue(await makeUser({ status: 'SUSPENDED' }));

    await expect(
      authService.login({ email: 'rahul@example.com', password: 'Rahul@1234' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_DISABLED' });

    // wrong password on the same account reveals nothing about the status
    await expect(
      authService.login({ email: 'rahul@example.com', password: 'Wrong@1234' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  test('a PENDING account must verify its email first', async () => {
    userRepository.findByEmail.mockResolvedValue(await makeUser({ status: 'PENDING' }));
    await expect(
      authService.login({ email: 'rahul@example.com', password: 'Rahul@1234' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED' });
  });
});

describe('refresh', () => {
  test('no token gives 401 NO_REFRESH_TOKEN', async () => {
    await expect(authService.refresh(undefined)).rejects.toMatchObject({
      statusCode: 401,
      code: 'NO_REFRESH_TOKEN',
    });
  });

  test('unknown token gives 401', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(null);
    await expect(authService.refresh('abc')).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  test('success rotates the token inside the SAME session', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRow());
    refreshTokenRepository.revokeIfActive.mockResolvedValue(true);
    userRepository.findById.mockResolvedValue(await makeUser());

    const result = await authService.refresh('raw-token');

    expect(refreshTokenRepository.findByHash).toHaveBeenCalledWith(tokenService.hashToken('raw-token'));
    expect(refreshTokenRepository.revokeIfActive).toHaveBeenCalledWith(10, 'rotated', expect.any(Date));
    expect(refreshTokenRepository.create.mock.calls[0][0].familyId).toBe('fam-1');
    expect(jwt.verify(result.accessToken, process.env.JWT_SECRET).sid).toBe('fam-1');
    expect(result.refreshToken).not.toBe('raw-token');
  });

  test('REUSE of an old token (after the grace period) ends the whole session', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(
      tokenRow({ revoked_at: new Date(Date.now() - 60 * 1000), revoked_reason: 'rotated' })
    );

    await expect(authService.refresh('stolen')).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_REUSED',
    });
    expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith('fam-1', 'reuse_detected', expect.any(Date));
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  test('reuse within the grace period is refused but does NOT kill the session', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(
      tokenRow({ revoked_at: new Date(Date.now() - 2000), revoked_reason: 'rotated' })
    );

    await expect(authService.refresh('raced')).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
  });

  test('a token revoked by logout is simply invalid', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(
      tokenRow({ revoked_at: new Date(Date.now() - 60 * 1000), revoked_reason: 'logout' })
    );
    await expect(authService.refresh('old')).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
  });

  test('an expired token gives REFRESH_TOKEN_EXPIRED', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRow({ expires_at: new Date(Date.now() - 1000) }));
    await expect(authService.refresh('old')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_EXPIRED' });
  });

  test('a suspended user cannot refresh, and the session is ended', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRow());
    userRepository.findById.mockResolvedValue(await makeUser({ status: 'SUSPENDED' }));

    await expect(authService.refresh('raw')).rejects.toMatchObject({ statusCode: 401 });
    expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith('fam-1', 'account_disabled', expect.any(Date));
  });

  test('losing the rotation race gives 401 and issues nothing', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRow());
    userRepository.findById.mockResolvedValue(await makeUser());
    refreshTokenRepository.revokeIfActive.mockResolvedValue(false);

    await expect(authService.refresh('raw')).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  test('revokes the whole session of the token', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRow());
    await authService.logout('raw');
    expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith('fam-1', 'logout', expect.any(Date));
  });

  test('works (does nothing) with no token or an unknown token', async () => {
    await expect(authService.logout(undefined)).resolves.toBeUndefined();
    refreshTokenRepository.findByHash.mockResolvedValue(null);
    await expect(authService.logout('unknown')).resolves.toBeUndefined();
    expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
  });

  test('logoutAll revokes every session of the user', async () => {
    await authService.logoutAll(2);
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(2, 'logout_all', expect.any(Date));
  });
});

describe('changePassword', () => {
  test('wrong current password is rejected and nothing is saved or revoked', async () => {
    userRepository.findById.mockResolvedValue(await makeUser());

    await expect(
      authService.changePassword(2, { currentPassword: 'Wrong@1234', newPassword: 'Rahul@5678' }, 'fam-1')
    ).rejects.toMatchObject({ statusCode: 400, code: 'WRONG_CURRENT_PASSWORD' });
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
    expect(refreshTokenRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  test('saves a NEW hash and logs out every OTHER session (keeps the current one)', async () => {
    userRepository.findById.mockResolvedValue(await makeUser());

    await authService.changePassword(2, { currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' }, 'fam-1');

    const [id, newHash] = userRepository.updatePassword.mock.calls[0];
    expect(id).toBe(2);
    expect(await bcrypt.compare('Rahul@5678', newHash)).toBe(true);
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
      2,
      'password_changed',
      expect.any(Date),
      'fam-1'
    );
  });

  test('missing user gives 404 USER_NOT_FOUND', async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(
      authService.changePassword(99, { currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });
});
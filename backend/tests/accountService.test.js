const bcrypt = require('bcryptjs');

jest.mock('../src/repositories/userRepository');
jest.mock('../src/repositories/authTokenRepository');
jest.mock('../src/repositories/refreshTokenRepository');

const userRepository = require('../src/repositories/userRepository');
const authTokenRepository = require('../src/repositories/authTokenRepository');
const refreshTokenRepository = require('../src/repositories/refreshTokenRepository');
const mailService = require('../src/services/mailService');
const tokenService = require('../src/services/tokenService');
const accountService = require('../src/services/accountService');

const user = { id: 5, name: 'Sam Verify Test Account', email: 'sam@example.com', status: 'ACTIVE' };

const tokenRow = (overrides = {}) => ({
  id: 1,
  user_id: 5,
  type: 'EMAIL_VERIFY',
  used_at: null,
  expires_at: new Date(Date.now() + 3600 * 1000),
  ...overrides,
});

const tokenFromMail = (mail) => mail.text.match(/token=([0-9a-f]{64})/)[1];

beforeEach(() => {
  jest.resetAllMocks();
  mailService.clearOutbox();
});

describe('sendVerificationEmail', () => {
  test('stores only the HASH of the token, and emails the raw token', async () => {
    await accountService.sendVerificationEmail(user);

    const created = authTokenRepository.create.mock.calls[0][0];
    const [mail] = mailService.outbox;
    const raw = tokenFromMail(mail);

    expect(mail.to).toBe('sam@example.com');
    expect(mail.text).toContain('http://localhost:5173/verify-email?token=');
    expect(created).toMatchObject({ userId: 5, type: 'EMAIL_VERIFY' });
    expect(created.tokenHash).toBe(tokenService.hashToken(raw));
    expect(created.tokenHash).not.toBe(raw);
    expect(authTokenRepository.invalidateAllForUser).toHaveBeenCalledWith(5, 'EMAIL_VERIFY', expect.any(Date));
  });

  test('never throws, even if the database fails (signup must still succeed)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    authTokenRepository.create.mockRejectedValue(new Error('db down'));

    await expect(accountService.sendVerificationEmail(user)).resolves.toBeUndefined();
    expect(mailService.outbox).toHaveLength(0);
    console.error.mockRestore();
  });
});

describe('resendVerification', () => {
  test('unknown email: nothing happens', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await accountService.resendVerification('nobody@example.com');
    expect(mailService.outbox).toHaveLength(0);
  });

  test('an already verified (ACTIVE) account gets nothing', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    await accountService.resendVerification(user.email);
    expect(mailService.outbox).toHaveLength(0);
  });

  test('a PENDING account within the cooldown gets nothing', async () => {
    userRepository.findByEmail.mockResolvedValue({ ...user, status: 'PENDING' });
    authTokenRepository.findLatest.mockResolvedValue({ created_at: new Date() });
    await accountService.resendVerification(user.email);
    expect(mailService.outbox).toHaveLength(0);
  });

  test('a PENDING account after the cooldown gets a new email', async () => {
    userRepository.findByEmail.mockResolvedValue({ ...user, status: 'PENDING' });
    authTokenRepository.findLatest.mockResolvedValue({ created_at: new Date(Date.now() - 120 * 1000) });
    await accountService.resendVerification(user.email);
    expect(mailService.outbox).toHaveLength(1);
  });
});

describe('forgotPassword', () => {
  test('unknown email: nothing happens and nothing is thrown', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await expect(accountService.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    expect(mailService.outbox).toHaveLength(0);
  });

  test.each(['SUSPENDED', 'DEACTIVATED'])('a %s account gets no email', async (status) => {
    userRepository.findByEmail.mockResolvedValue({ ...user, status });
    await accountService.forgotPassword(user.email);
    expect(mailService.outbox).toHaveLength(0);
  });

  test('an ACTIVE account gets a reset link with a PASSWORD_RESET token', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    authTokenRepository.findLatest.mockResolvedValue(null);

    await accountService.forgotPassword(user.email);

    const [mail] = mailService.outbox;
    expect(mail.text).toContain('http://localhost:5173/reset-password?token=');
    expect(authTokenRepository.create.mock.calls[0][0].type).toBe('PASSWORD_RESET');
  });

  test('the reset link expires in about 60 minutes', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    authTokenRepository.findLatest.mockResolvedValue(null);

    await accountService.forgotPassword(user.email);

    const { expiresAt } = authTokenRepository.create.mock.calls[0][0];
    const minutes = (expiresAt - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThan(61);
  });
});

describe('verifyEmail', () => {
  const raw = 'a'.repeat(64);

  test('unknown token gives INVALID_TOKEN', async () => {
    authTokenRepository.findByHash.mockResolvedValue(null);
    await expect(accountService.verifyEmail(raw)).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TOKEN' });
    expect(authTokenRepository.findByHash).toHaveBeenCalledWith(tokenService.hashToken(raw));
  });

  test('a password-reset token cannot be used to verify an email', async () => {
    authTokenRepository.findByHash.mockResolvedValue(tokenRow({ type: 'PASSWORD_RESET' }));
    await expect(accountService.verifyEmail(raw)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  test('a used token gives TOKEN_USED', async () => {
    authTokenRepository.findByHash.mockResolvedValue(tokenRow({ used_at: new Date() }));
    await expect(accountService.verifyEmail(raw)).rejects.toMatchObject({ code: 'TOKEN_USED' });
  });

  test('an expired token gives TOKEN_EXPIRED', async () => {
    authTokenRepository.findByHash.mockResolvedValue(tokenRow({ expires_at: new Date(Date.now() - 1000) }));
    await expect(accountService.verifyEmail(raw)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(userRepository.markEmailVerified).not.toHaveBeenCalled();
  });

  test('success uses up the token and verifies the user', async () => {
    authTokenRepository.findByHash.mockResolvedValue(tokenRow());
    authTokenRepository.consume.mockResolvedValue(true);

    await accountService.verifyEmail(raw);

    expect(authTokenRepository.consume).toHaveBeenCalledWith(1, expect.any(Date));
    expect(userRepository.markEmailVerified).toHaveBeenCalledWith(5, expect.any(Date));
  });

  test('losing the race (someone used the link a moment earlier) verifies nothing', async () => {
    authTokenRepository.findByHash.mockResolvedValue(tokenRow());
    authTokenRepository.consume.mockResolvedValue(false);

    await expect(accountService.verifyEmail(raw)).rejects.toMatchObject({ code: 'TOKEN_USED' });
    expect(userRepository.markEmailVerified).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  const raw = 'b'.repeat(64);
  const resetRow = (overrides = {}) => tokenRow({ type: 'PASSWORD_RESET', ...overrides });

  test('success: new bcrypt hash, other links cancelled, every session revoked', async () => {
    authTokenRepository.findByHash.mockResolvedValue(resetRow());
    userRepository.findById.mockResolvedValue(user);
    authTokenRepository.consume.mockResolvedValue(true);

    await accountService.resetPassword(raw, 'Brand@New99');

    const [id, hash] = userRepository.resetPassword.mock.calls[0];
    expect(id).toBe(5);
    expect(await bcrypt.compare('Brand@New99', hash)).toBe(true);
    expect(authTokenRepository.invalidateAllForUser).toHaveBeenCalledWith(5, 'PASSWORD_RESET', expect.any(Date));
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(5, 'password_reset', expect.any(Date));
  });

  test('a suspended account is refused and the link is NOT used up', async () => {
    authTokenRepository.findByHash.mockResolvedValue(resetRow());
    userRepository.findById.mockResolvedValue({ ...user, status: 'SUSPENDED' });

    await expect(accountService.resetPassword(raw, 'Brand@New99')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(authTokenRepository.consume).not.toHaveBeenCalled();
    expect(userRepository.resetPassword).not.toHaveBeenCalled();
  });

  test('a verification token cannot reset a password', async () => {
    authTokenRepository.findByHash.mockResolvedValue(tokenRow({ type: 'EMAIL_VERIFY' }));
    await expect(accountService.resetPassword(raw, 'Brand@New99')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(userRepository.resetPassword).not.toHaveBeenCalled();
  });

  test('losing the race changes nothing', async () => {
    authTokenRepository.findByHash.mockResolvedValue(resetRow());
    userRepository.findById.mockResolvedValue(user);
    authTokenRepository.consume.mockResolvedValue(false);

    await expect(accountService.resetPassword(raw, 'Brand@New99')).rejects.toMatchObject({ code: 'TOKEN_USED' });
    expect(userRepository.resetPassword).not.toHaveBeenCalled();
    expect(refreshTokenRepository.revokeAllForUser).not.toHaveBeenCalled();
  });
});
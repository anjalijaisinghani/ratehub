const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const config = require('../config/security');
const { BCRYPT_ROUNDS } = require('../constants/security');
const ROLES = require('../constants/roles');
const USER_STATUS = require('../constants/userStatus');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const tokenService = require('./tokenService');

// Used when the email doesn't exist, so "unknown email" takes as long as
// "wrong password". This stops attackers from discovering which emails exist by timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

// Never send password_hash (or any internal column) to the outside world
const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  address: user.address,
  role: user.role,
});

// Starts a session (or continues one, when familyId is passed during a refresh)
const createSession = async (user, meta = {}, familyId = crypto.randomUUID()) => {
  const refreshToken = tokenService.generateRefreshToken();
  await refreshTokenRepository.create({
    userId: user.id,
    familyId,
    tokenHash: tokenService.hashToken(refreshToken),
    expiresAt: tokenService.refreshExpiry(),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { accessToken: tokenService.createAccessToken(user, familyId), refreshToken };
};

// ---------- Signup (normal users only) ----------
const signup = async ({ name, email, address, password }) => {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw AppError.conflict('Email is already registered', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // The role is ALWAYS USER here. Whatever the client sends is ignored.
  const id = await userRepository.create({
    name,
    email,
    address,
    passwordHash,
    role: ROLES.USER,
  });

  return toPublicUser({ id, name, email, address, role: ROLES.USER });
};

// ---------- Login (all roles) ----------
const login = async ({ email, password }, meta = {}) => {
  const now = new Date();
  let user = await userRepository.findByEmail(email);

  // 1. Is the account temporarily locked?
  if (user && user.locked_until) {
    const lockedUntil = new Date(user.locked_until);
    if (lockedUntil > now) {
      const minutes = Math.ceil((lockedUntil - now) / 60000);
      throw new AppError(
        `Too many failed attempts. Try again in ${minutes} minute(s).`,
        429,
        'ACCOUNT_LOCKED'
      );
    }
    // The lock has expired: start counting from zero again
    await userRepository.clearLock(user.id);
    user = { ...user, failed_login_attempts: 0, locked_until: null };
  }

  // 2. Check the password (always runs bcrypt, even for unknown emails)
  const isMatch = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !isMatch) {
    if (user) {
      const lockUntil = new Date(now.getTime() + config.lockMinutes * 60 * 1000);
      await userRepository.registerFailedLogin(user.id, config.maxFailedLogins, lockUntil);
    }
    // Same error for "no such email" and "wrong password"
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // 3. Right password, but is the account allowed to log in?
  //    (We reveal the status only AFTER the password is correct.)
  if (user.status === USER_STATUS.PENDING) {
    throw AppError.forbidden('Please verify your email before logging in', 'EMAIL_NOT_VERIFIED');
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    throw AppError.forbidden('This account is not active. Please contact support.', 'ACCOUNT_DISABLED');
  }

  // 4. Success
  await userRepository.recordSuccessfulLogin(user.id, now);
  const session = await createSession(user, meta);
  return { ...session, user: toPublicUser(user) };
};

// ---------- Refresh: swap a refresh token for a new access token ----------
// Rotation: every refresh token works ONCE. Using it gives you a new one.
// If an OLD token shows up again, someone copied it, so we end the whole session.
const refresh = async (rawToken, meta = {}) => {
  if (!rawToken) {
    throw AppError.unauthorized('No refresh token', 'NO_REFRESH_TOKEN');
  }

  const row = await refreshTokenRepository.findByHash(tokenService.hashToken(rawToken));
  if (!row) {
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const now = new Date();

  if (row.revoked_at) {
    if (row.revoked_reason === 'rotated') {
      const ageSeconds = (now - new Date(row.revoked_at)) / 1000;
      if (ageSeconds > config.refreshGraceSeconds) {
        await refreshTokenRepository.revokeFamily(row.family_id, 'reuse_detected', now);
        throw AppError.unauthorized('Session ended for your safety. Please log in again.', 'REFRESH_TOKEN_REUSED');
      }
    }
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (new Date(row.expires_at) <= now) {
    throw AppError.unauthorized('Session expired. Please log in again.', 'REFRESH_TOKEN_EXPIRED');
  }

  const user = await userRepository.findById(row.user_id);
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    await refreshTokenRepository.revokeFamily(row.family_id, 'account_disabled', now);
    throw AppError.unauthorized('Session ended. Please log in again.', 'INVALID_REFRESH_TOKEN');
  }

  // Use up the old token. If someone else just did, we lost the race.
  const won = await refreshTokenRepository.revokeIfActive(row.id, 'rotated', now);
  if (!won) {
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const session = await createSession(user, meta, row.family_id);
  return { ...session, user: toPublicUser(user) };
};

// ---------- Logout (this device) ----------
// Always succeeds, even with a missing or unknown token (logging out twice is harmless)
const logout = async (rawToken) => {
  if (!rawToken) return;
  const row = await refreshTokenRepository.findByHash(tokenService.hashToken(rawToken));
  if (row) {
    await refreshTokenRepository.revokeFamily(row.family_id, 'logout', new Date());
  }
};

// ---------- Logout from ALL devices ----------
const logoutAll = async (userId) => {
  await refreshTokenRepository.revokeAllForUser(userId, 'logout_all', new Date());
};

// ---------- Change password (any logged-in user) ----------
// Other devices are logged out. The device that changed it stays logged in.
const changePassword = async (userId, { currentPassword, newPassword }, currentSessionId = null) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw AppError.badRequest('Current password is incorrect', 'WRONG_CURRENT_PASSWORD');
  }

  const now = new Date();
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePassword(userId, newHash, now);
  await refreshTokenRepository.revokeAllForUser(userId, 'password_changed', now, currentSessionId);
};

module.exports = { signup, login, refresh, logout, logoutAll, changePassword };
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const mailConfig = require('../config/mail');
const { BCRYPT_ROUNDS } = require('../constants/security');
const USER_STATUS = require('../constants/userStatus');
const TOKEN_TYPES = require('../constants/tokenTypes');
const userRepository = require('../repositories/userRepository');
const authTokenRepository = require('../repositories/authTokenRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const tokenService = require('./tokenService');
const mailService = require('./mailService');
const emailTemplates = require('./emailTemplates');

const ttlMs = (type) =>
  type === TOKEN_TYPES.EMAIL_VERIFY
    ? mailConfig.verifyHours * 60 * 60 * 1000
    : mailConfig.resetMinutes * 60 * 1000;

// Creates a new link token. Older unused links of the same kind stop working.
// Returns the RAW token (goes into the email). The database gets only its hash.
const issueToken = async (userId, type) => {
  const now = new Date();
  await authTokenRepository.invalidateAllForUser(userId, type, now);

  const raw = tokenService.generateUrlToken();
  await authTokenRepository.create({
    userId,
    type,
    tokenHash: tokenService.hashToken(raw),
    expiresAt: new Date(now.getTime() + ttlMs(type)),
    createdAt: now,
  });
  return raw;
};

// Is it too soon to send another email of this kind to this account?
const isOnCooldown = async (userId, type) => {
  const latest = await authTokenRepository.findLatest(userId, type);
  return !!latest && Date.now() - new Date(latest.created_at).getTime() < mailConfig.cooldownSeconds * 1000;
};

// We do NOT wait for the email server. If we did, "account exists" (slow, sends mail)
// would take longer than "no such account" (instant), and the response time would leak the answer.
const sendInBackground = (message) => {
  const report = (err) => console.error('Email send failed:', err.message); // never log the link
  try {
    mailService.sendMail(message).catch(report);
  } catch (err) {
    report(err);
  }
};

// Never throws: if this fails, signup still succeeded and the user can request a new link
const sendVerificationEmail = async (user) => {
  try {
    const raw = await issueToken(user.id, TOKEN_TYPES.EMAIL_VERIFY);
    sendInBackground({
      to: user.email,
      ...emailTemplates.verificationEmail({
        name: user.name,
        link: `${mailConfig.appUrl}/verify-email?token=${raw}`,
        hours: mailConfig.verifyHours,
      }),
    });
  } catch (err) {
    console.error('Could not create verification email:', err.message);
  }
};

const sendResetEmail = async (user) => {
  try {
    const raw = await issueToken(user.id, TOKEN_TYPES.PASSWORD_RESET);
    sendInBackground({
      to: user.email,
      ...emailTemplates.passwordResetEmail({
        name: user.name,
        link: `${mailConfig.appUrl}/reset-password?token=${raw}`,
        minutes: mailConfig.resetMinutes,
      }),
    });
  } catch (err) {
    console.error('Could not create reset email:', err.message);
  }
};

// Finds and checks a link token. Random 256-bit tokens can't be guessed,
// so telling "used" apart from "expired" leaks nothing and helps the user.
const loadValidToken = async (rawToken, type) => {
  const row = await authTokenRepository.findByHash(tokenService.hashToken(rawToken));

  if (!row || row.type !== type) {
    throw AppError.badRequest('This link is invalid.', 'INVALID_TOKEN');
  }
  if (row.used_at) {
    throw AppError.badRequest('This link was already used or has been replaced by a newer one.', 'TOKEN_USED');
  }
  if (new Date(row.expires_at) <= new Date()) {
    throw AppError.badRequest('This link has expired. Please request a new one.', 'TOKEN_EXPIRED');
  }
  return row;
};

// ---------- Verify email ----------
const verifyEmail = async (rawToken) => {
  const row = await loadValidToken(rawToken, TOKEN_TYPES.EMAIL_VERIFY);
  const now = new Date();

  if (!(await authTokenRepository.consume(row.id, now))) {
    throw AppError.badRequest('This link was already used or has been replaced by a newer one.', 'TOKEN_USED');
  }
  await userRepository.markEmailVerified(row.user_id, now);
};

// ---------- Resend verification email ----------
// Always "succeeds" quietly. Only accounts still waiting for verification get an email.
const resendVerification = async (email) => {
  const user = await userRepository.findByEmail(email);
  if (!user || user.status !== USER_STATUS.PENDING) return;
  if (await isOnCooldown(user.id, TOKEN_TYPES.EMAIL_VERIFY)) return;
  await sendVerificationEmail(user);
};

// ---------- Forgot password ----------
// Always "succeeds" quietly. Suspended and deactivated accounts get nothing.
const forgotPassword = async (email) => {
  const user = await userRepository.findByEmail(email);
  if (!user || ![USER_STATUS.ACTIVE, USER_STATUS.PENDING].includes(user.status)) return;
  if (await isOnCooldown(user.id, TOKEN_TYPES.PASSWORD_RESET)) return;
  await sendResetEmail(user);
};

// ---------- Reset password ----------
const resetPassword = async (rawToken, newPassword) => {
  const row = await loadValidToken(rawToken, TOKEN_TYPES.PASSWORD_RESET);

  // Check the account BEFORE using up the link
  const user = await userRepository.findById(row.user_id);
  if (!user || ![USER_STATUS.ACTIVE, USER_STATUS.PENDING].includes(user.status)) {
    throw AppError.badRequest('This link is invalid.', 'INVALID_TOKEN');
  }

  const now = new Date();
  if (!(await authTokenRepository.consume(row.id, now))) {
    throw AppError.badRequest('This link was already used or has been replaced by a newer one.', 'TOKEN_USED');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.resetPassword(user.id, passwordHash, now);

  await authTokenRepository.invalidateAllForUser(user.id, TOKEN_TYPES.PASSWORD_RESET, now);
  // Whoever had access before the reset (maybe a thief) is logged out everywhere
  await refreshTokenRepository.revokeAllForUser(user.id, 'password_reset', now);
};

module.exports = {
  sendVerificationEmail,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
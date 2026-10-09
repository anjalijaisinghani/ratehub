const authService = require('../services/authService');
const accountService = require('../services/accountService');
const config = require('../config/security');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { setRefreshCookie, clearRefreshCookie } = require('../utils/cookies');

// These two answers are IDENTICAL whether or not the account exists
const RESEND_MESSAGE =
  'If that email belongs to an account waiting for verification, we have sent a new link.';
const FORGOT_MESSAGE =
  'If an account exists for that email, we have sent instructions to reset the password.';

// Who is calling (stored with the session, so devices can be recognised later)
const clientMeta = (req) => ({
  ip: req.ip,
  userAgent: (req.get('user-agent') || '').slice(0, 255),
});

// POST /api/v1/auth/signup
const signup = asyncHandler(async (req, res) => {
  const { name, email, address, password } = req.body;
  const user = await authService.signup({ name, email, address, password });
  sendSuccess(res, { user }, 'Account created. Please check your email to verify it.', 201);
});

// POST /api/v1/auth/login
// The refresh token goes ONLY into the httpOnly cookie, never into the JSON body.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken, user } = await authService.login({ email, password }, clientMeta(req));
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { accessToken, user }, 'Login successful');
});

// POST /api/v1/auth/refresh   (the browser sends the cookie by itself)
const refresh = asyncHandler(async (req, res) => {
  try {
    const result = await authService.refresh(req.cookies[config.cookie.name], clientMeta(req));
    setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, { accessToken: result.accessToken, user: result.user });
  } catch (err) {
    clearRefreshCookie(res); // a bad cookie is useless, so remove it
    throw err;
  }
});

// POST /api/v1/auth/logout
const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies[config.cookie.name]);
  clearRefreshCookie(res);
  sendSuccess(res, null, 'Logged out successfully');
});

// POST /api/v1/auth/logout-all
const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  clearRefreshCookie(res);
  sendSuccess(res, null, 'Logged out from all devices');
});

// PUT /api/v1/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, { currentPassword, newPassword }, req.user.sid);
  sendSuccess(res, null, 'Password updated successfully');
});

// POST /api/v1/auth/verify-email   body: { token }
const verifyEmail = asyncHandler(async (req, res) => {
  await accountService.verifyEmail(req.body.token);
  sendSuccess(res, null, 'Email verified. You can now log in.');
});

// POST /api/v1/auth/resend-verification   body: { email }
const resendVerification = asyncHandler(async (req, res) => {
  await accountService.resendVerification(req.body.email);
  sendSuccess(res, null, RESEND_MESSAGE);
});

// POST /api/v1/auth/forgot-password   body: { email }
const forgotPassword = asyncHandler(async (req, res) => {
  await accountService.forgotPassword(req.body.email);
  sendSuccess(res, null, FORGOT_MESSAGE);
});

// POST /api/v1/auth/reset-password   body: { token, newPassword }
const resetPassword = asyncHandler(async (req, res) => {
  await accountService.resetPassword(req.body.token, req.body.newPassword);
  sendSuccess(res, null, 'Password has been reset. Please log in with your new password.');
});

module.exports = {
  signup,
  login,
  refresh,
  logout,
  logoutAll,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
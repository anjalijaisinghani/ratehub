const authService = require('../services/authService');
const config = require('../config/security');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { setRefreshCookie, clearRefreshCookie } = require('../utils/cookies');

// Who is calling (stored with the session, so devices can be recognised later)
const clientMeta = (req) => ({
  ip: req.ip,
  userAgent: (req.get('user-agent') || '').slice(0, 255),
});

// POST /api/v1/auth/signup
const signup = asyncHandler(async (req, res) => {
  const { name, email, address, password } = req.body;
  const user = await authService.signup({ name, email, address, password });
  sendSuccess(res, { user }, 'Signup successful', 201);
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

module.exports = { signup, login, refresh, logout, logoutAll, changePassword };
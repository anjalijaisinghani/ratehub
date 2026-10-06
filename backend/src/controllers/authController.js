const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

// POST /api/v1/auth/signup
const signup = asyncHandler(async (req, res) => {
  const { name, email, address, password } = req.body;
  const user = await authService.signup({ name, email, address, password });
  sendSuccess(res, { user }, 'Signup successful', 201);
});

// POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  sendSuccess(res, result, 'Login successful');
});

// PUT /api/v1/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, { currentPassword, newPassword });
  sendSuccess(res, null, 'Password updated successfully');
});

module.exports = { signup, login, changePassword };
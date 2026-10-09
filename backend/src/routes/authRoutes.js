const express = require('express');
const {
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
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  loginLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimiters');
const { requireTrustedOrigin } = require('../middleware/origin');
const {
  nameRule,
  emailRule,
  addressRule,
  passwordRule,
  loginPasswordRule,
  tokenRule,
  handleValidation,
} = require('../utils/validators');

const router = express.Router();

router.post(
  '/signup',
  [nameRule, emailRule, addressRule, passwordRule('password'), handleValidation],
  signup
);

router.post('/login', loginLimiter, [emailRule, loginPasswordRule, handleValidation], login);

// Cookie-based: only from our own website
router.post('/refresh', requireTrustedOrigin, refresh);
router.post('/logout', requireTrustedOrigin, logout);

// Needs a valid access token
router.post('/logout-all', authenticate, logoutAll);

router.put(
  '/change-password',
  [authenticate, passwordRule('newPassword'), handleValidation],
  changePassword
);

// ----- Email verification -----
router.post('/verify-email', [tokenRule, handleValidation], verifyEmail);
router.post(
  '/resend-verification',
  resendVerificationLimiter,
  [emailRule, handleValidation],
  resendVerification
);

// ----- Forgot / reset password -----
router.post('/forgot-password', forgotPasswordLimiter, [emailRule, handleValidation], forgotPassword);
router.post(
  '/reset-password',
  [tokenRule, passwordRule('newPassword'), handleValidation],
  resetPassword
);

module.exports = router;
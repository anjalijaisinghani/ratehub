const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');
const config = require('../config/security');

// Builds a limiter that answers with our standard error format.
// "force" is only for tests (they run with limiting switched off).
const createLimiter = ({ windowMs, limit, message, skipSuccessfulRequests = false, force = false }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // sends RateLimit headers so clients can see their budget
    legacyHeaders: false,
    skipSuccessfulRequests,     // true = only FAILED requests count
    skip: () => !force && !config.rateLimit.enabled,
    handler: (req, res, next, options) => {
      res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
      next(new AppError(message, 429, 'RATE_LIMITED'));
    },
  });

// Everything under /api: a generous cap per IP address
const generalLimiter = createLimiter({
  ...config.rateLimit.general,
  message: 'Too many requests. Please slow down and try again later.',
});

// Login: only FAILED attempts count, so normal users are never blocked by successful logins
const loginLimiter = createLimiter({
  ...config.rateLimit.login,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts. Please try again in 15 minutes.',
});

// Forgot-password and resend-verification send emails, so each gets its own tight limit.
// (They have separate counters, so using one never blocks the other.)
const forgotPasswordLimiter = createLimiter({
  ...config.rateLimit.passwordReset,
  message: 'Too many password reset requests. Please try again in an hour.',
});

const resendVerificationLimiter = createLimiter({
  ...config.rateLimit.passwordReset,
  message: 'Too many verification email requests. Please try again in an hour.',
});

// Writing or deleting reviews: a cap per IP per hour, so nobody can flood a store with reviews
const reviewWriteLimiter = createLimiter({
  ...config.rateLimit.reviews,
  message: 'You are posting reviews too quickly. Please try again later.',
});

module.exports = {
  createLimiter,
  generalLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  reviewWriteLimiter,
};
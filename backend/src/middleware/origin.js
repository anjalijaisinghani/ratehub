const AppError = require('../utils/AppError');
const config = require('../config/security');

// Cookie-based endpoints (refresh, logout) must only be called from OUR website.
// Browsers always attach an Origin header to cross-site POSTs, so a malicious page is caught.
// Requests with no Origin (Postman, curl, server-to-server) are allowed.
const requireTrustedOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !config.corsOrigins.includes(origin)) {
    return next(AppError.forbidden('Origin not allowed', 'ORIGIN_NOT_ALLOWED'));
  }
  next();
};

module.exports = { requireTrustedOrigin };
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// Checks that the request has a valid token
const authenticate = (req, res, next) => {
  const header = req.headers.authorization; // "Bearer <token>"

  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Access denied. No token provided.', 'NO_TOKEN'));
  }

  const token = header.split(' ')[1];

  try {
        // Only accept the algorithm we signed with (blocks "alg" confusion attacks)
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); // { id, role, sid }
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.';
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    next(AppError.unauthorized(message, code));
  }
};

// Checks that the logged-in user has one of the allowed roles
// Usage: authorize('ADMIN') or authorize('ADMIN', 'OWNER')
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return next(AppError.forbidden('You do not have permission to do this.'));
  }
  next();
};

module.exports = { authenticate, authorize };
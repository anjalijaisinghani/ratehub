const jwt = require('jsonwebtoken');

// Checks that the request has a valid token
const authenticate = (req, res, next) => {
  const header = req.headers.authorization; // "Bearer <token>"

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Checks that the logged-in user has one of the allowed roles
// Usage: authorize('ADMIN') or authorize('ADMIN', 'OWNER')
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to do this.' });
  }
  next();
};

module.exports = { authenticate, authorize };
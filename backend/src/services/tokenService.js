const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/security');

// Short-lived JWT. "sid" = the session (refresh-token family) it belongs to.
const createAccessToken = (user, sid) =>
  jwt.sign({ id: user.id, role: user.role, sid }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.accessTokenTtl,
  });

// A random, unguessable string. 48 random bytes = 96 hex characters.
const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

// We store only the SHA-256 hash. If the database leaks, the tokens can't be used.
// (A fast hash is fine here because the token is already long and random.
// Passwords are different: they are short and guessable, so they need bcrypt.)
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');


// The random part of an emailed link (verify email / reset password). 32 bytes = 64 hex characters.
const generateUrlToken = () => crypto.randomBytes(32).toString('hex');

const refreshExpiry = () => new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);

module.exports = { createAccessToken, generateRefreshToken, generateUrlToken, hashToken, refreshExpiry };
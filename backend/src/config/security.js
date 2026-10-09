// All security settings in one place. Values come from .env, with safe defaults.
const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const isTest = process.env.NODE_ENV === 'test';
const proxy = process.env.TRUST_PROXY;

const config = {
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: num(process.env.REFRESH_TOKEN_DAYS, 7),
  // A just-rotated refresh token may be sent again within this window without alarm
  // (e.g. two requests racing). After it, reuse is treated as theft.
  refreshGraceSeconds: 10,

  maxFailedLogins: num(process.env.MAX_FAILED_LOGINS, 5),
  lockMinutes: num(process.env.LOCK_MINUTES, 15),

  cookie: {
    name: 'rh_refresh',
    path: '/api/v1/auth', // the browser only sends this cookie to auth endpoints
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'strict',
  },

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Set TRUST_PROXY=1 when running behind a load balancer (needed for correct client IPs)
  trustProxy: proxy === undefined || proxy === '' ? false : Number.isNaN(Number(proxy)) ? proxy : Number(proxy),

  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false' && !isTest,
    general: { windowMs: 15 * 60 * 1000, limit: num(process.env.RATE_LIMIT_GENERAL, 600) },
    login: { windowMs: 15 * 60 * 1000, limit: num(process.env.RATE_LIMIT_LOGIN, 5) },
        passwordReset: { windowMs: 60 * 60 * 1000, limit: num(process.env.RATE_LIMIT_PASSWORD_RESET, 3) },
  },
};

// Called when the server starts: refuse to run with an unsafe secret in production
const assertSecureConfig = () => {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) throw new Error('JWT_SECRET is not set in .env');
  if (secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    console.warn('WARNING: JWT_SECRET is shorter than 32 characters. Generate a long random one.');
  }
};

module.exports = config;
module.exports.assertSecureConfig = assertSecureConfig;
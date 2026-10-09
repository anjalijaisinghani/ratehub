const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = {
  host: process.env.SMTP_HOST || '127.0.0.1',
  port: num(process.env.SMTP_PORT, 1025),
  user: process.env.SMTP_USER || '', // only needed with a real provider
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || 'RateHub <no-reply@ratehub.local>',

  // No trailing slash, so we can safely write `${appUrl}/verify-email`
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),

  verifyHours: num(process.env.VERIFY_TOKEN_HOURS, 24),
  resetMinutes: num(process.env.RESET_TOKEN_MINUTES, 60),

  // Minimum gap between two emails of the same kind for the same account
  cooldownSeconds: 60,
};
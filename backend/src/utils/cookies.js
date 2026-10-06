const config = require('../config/security');

const baseOptions = () => ({
  httpOnly: true,                 // JavaScript in the page can NOT read this cookie
  secure: config.cookie.secure,   // true = only sent over HTTPS
  sameSite: config.cookie.sameSite,
  path: config.cookie.path,
});

const setRefreshCookie = (res, token) =>
  res.cookie(config.cookie.name, token, {
    ...baseOptions(),
    maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000,
  });

const clearRefreshCookie = (res) => res.clearCookie(config.cookie.name, baseOptions());

module.exports = { setRefreshCookie, clearRefreshCookie };
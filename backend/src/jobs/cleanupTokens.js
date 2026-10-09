const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const authTokenRepository = require('../repositories/authTokenRepository');

const SIX_HOURS = 6 * 60 * 60 * 1000;

// Deletes tokens that have expired (refresh tokens and emailed links)
const run = async () => {
  try {
    const now = new Date();
    const sessions = await refreshTokenRepository.deleteExpired(now);
    const links = await authTokenRepository.deleteExpired(now);
    if (sessions + links > 0) {
      console.log(`Cleanup: removed ${sessions} expired session token(s) and ${links} expired email link(s)`);
    }
  } catch (err) {
    console.error('Token cleanup failed:', err.message);
  }
};

const start = () => {
  run();
  const timer = setInterval(run, SIX_HOURS);
  timer.unref(); // don't keep the process alive just for this timer
  return timer;
};

module.exports = { start, run };
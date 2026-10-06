const refreshTokenRepository = require('../repositories/refreshTokenRepository');

const SIX_HOURS = 6 * 60 * 60 * 1000;

// Deletes refresh tokens that have expired
const run = async () => {
  try {
    const removed = await refreshTokenRepository.deleteExpired(new Date());
    if (removed > 0) console.log(`Cleanup: removed ${removed} expired refresh token(s)`);
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
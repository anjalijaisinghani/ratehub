// An invalid timezone name would crash "open now" later, so check it once at startup
const resolveTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return tz;
  } catch {
    console.warn(`WARNING: APP_TIMEZONE "${tz}" is not valid. Using UTC.`);
    return 'UTC';
  }
};

module.exports = {
  // Stores' opening hours are interpreted in this timezone
  timezone: resolveTimezone(process.env.APP_TIMEZONE || 'Asia/Kolkata'),
};
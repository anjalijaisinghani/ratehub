// "What time is it right now in this timezone?" as HH:MM:SS (24-hour).
// hourCycle 'h23' makes midnight "00", not "24".
const nowTimeInZone = (timeZone, date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);

module.exports = { nowTimeInZone };
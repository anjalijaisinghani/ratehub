const { nowTimeInZone } = require('../src/utils/time');

describe('nowTimeInZone', () => {
  test('converts UTC to India time (UTC+5:30)', () => {
    expect(nowTimeInZone('Asia/Kolkata', new Date(Date.UTC(2026, 9, 10, 8, 30, 0)))).toBe('14:00:00');
  });

  test('midnight is 00:00:00, never 24:00:00', () => {
    expect(nowTimeInZone('Asia/Kolkata', new Date(Date.UTC(2026, 9, 10, 18, 30, 0)))).toBe('00:00:00');
  });

  test('UTC stays UTC', () => {
    expect(nowTimeInZone('UTC', new Date(Date.UTC(2026, 0, 1, 23, 59, 59)))).toBe('23:59:59');
  });
});
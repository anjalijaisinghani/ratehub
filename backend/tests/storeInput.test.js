const { normalizeStoreInput } = require('../src/utils/storeInput');

describe('normalizeStoreInput', () => {
  test('empty input gives category OTHER and everything else null', () => {
    expect(normalizeStoreInput({})).toEqual({
      category: 'OTHER',
      description: null,
      phone: null,
      city: null,
      state: null,
      pincode: null,
      website: null,
      imageUrl: null,
      latitude: null,
      longitude: null,
      openingTime: null,
      closingTime: null,
    });
  });

  test('trims text, turns empty text into null, and upper-cases the category', () => {
    const result = normalizeStoreInput({ category: 'cafe', city: '  Pune ', phone: '   ', description: '' });
    expect(result.category).toBe('CAFE');
    expect(result.city).toBe('Pune');
    expect(result.phone).toBeNull();
    expect(result.description).toBeNull();
  });

  test('keeps 0 as a real coordinate (equator / prime meridian)', () => {
    const result = normalizeStoreInput({ latitude: 0, longitude: 0 });
    expect(result.latitude).toBe(0);
    expect(result.longitude).toBe(0);
  });

  test('an unknown category is rejected', () => {
    expect(() => normalizeStoreInput({ category: 'SPACESHIP' })).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'INVALID_CATEGORY' })
    );
  });

  test('opening time without closing time (or the reverse) is rejected', () => {
    expect(() => normalizeStoreInput({ openingTime: '09:00' })).toThrow(
      expect.objectContaining({ code: 'INVALID_HOURS' })
    );
    expect(() => normalizeStoreInput({ closingTime: '21:00' })).toThrow(
      expect.objectContaining({ code: 'INVALID_HOURS' })
    );
    expect(normalizeStoreInput({ openingTime: '09:00', closingTime: '21:00' }).openingTime).toBe('09:00');
  });

  test('half a coordinate pair is rejected', () => {
    expect(() => normalizeStoreInput({ latitude: 18.5 })).toThrow(
      expect.objectContaining({ code: 'INVALID_COORDINATES' })
    );
    expect(() => normalizeStoreInput({ longitude: 73.8 })).toThrow(
      expect.objectContaining({ code: 'INVALID_COORDINATES' })
    );
  });
});
const { boundingBox, parseLocation, MAX_RADIUS_KM } = require('../src/utils/geo');
const { haversineKm, destinationPoint } = require('./helpers/geo');

const inBox = (box, lat, lng) =>
  lat >= box.minLat && lat <= box.maxLat && box.lngRanges.some(([a, b]) => lng >= a && lng <= b);

describe('boundingBox', () => {
  test('a 10 km box around Pune has the expected size', () => {
    const box = boundingBox(18.5204, 73.8567, 10);
    expect(box.minLat).toBeCloseTo(18.4304, 2); // 10 km is about 0.09 degrees of latitude
    expect(box.maxLat).toBeCloseTo(18.6104, 2);
    expect(box.lngRanges).toHaveLength(1);
    expect(box.lngRanges[0][0]).toBeCloseTo(73.7618, 2);
    expect(box.lngRanges[0][1]).toBeCloseTo(73.9516, 2);
  });

  test('a circle crossing the date line (east side) is split into two ranges', () => {
    const box = boundingBox(0, 179.99, 5);
    expect(box.lngRanges).toHaveLength(2);
    expect(box.lngRanges[0][1]).toBe(180);
    expect(box.lngRanges[1][0]).toBe(-180);
  });

  test('a circle crossing the date line (west side) is split into two ranges', () => {
    const box = boundingBox(0, -179.99, 5);
    expect(box.lngRanges).toHaveLength(2);
    expect(box.lngRanges[0][1]).toBe(180);
    expect(box.lngRanges[1][0]).toBe(-180);
  });

  test('a circle that includes a pole has no longitude limit and the latitude is clamped', () => {
    const box = boundingBox(89.95, 10, 20);
    expect(box.maxLat).toBe(90);
    expect(box.lngRanges).toEqual([[-180, 180]]);
    expect(boundingBox(-89.95, 10, 20).minLat).toBe(-90);
  });

  test('the box ALWAYS contains every point of the circle (random points on and inside the edge)', () => {
    let seed = 12345; // a tiny deterministic random generator, so the test never flakes
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const centers = [
      [18.5204, 73.8567], // Pune
      [0, 0], // equator and prime meridian
      [69.6, 18.9], // far north
      [-33.9, 151.2], // southern hemisphere
      [0, 179.99], // next to the date line
      [60, -179.9], // high latitude and the date line
      [88, 40], // near the pole
    ];

    for (const [lat, lng] of centers) {
      for (const radius of [0.5, 5, 50, 100]) {
        const box = boundingBox(lat, lng, radius);
        for (let i = 0; i < 300; i++) {
          const distance = i % 2 === 0 ? radius : rand() * radius; // half exactly on the edge
          const p = destinationPoint(lat, lng, rand() * 360, distance);

          expect(haversineKm(lat, lng, p.lat, p.lng)).toBeCloseTo(distance, 5); // the helper itself is right
          expect(inBox(box, p.lat, p.lng)).toBe(true);
        }
      }
    }
  });
});

describe('parseLocation', () => {
  test('no location gives null (or an error when it is required)', () => {
    expect(parseLocation({})).toBeNull();
    expect(() => parseLocation({}, { required: true })).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'LOCATION_REQUIRED' })
    );
  });

  test('a radius without a location is ignored', () => {
    expect(parseLocation({ radius: '5' })).toBeNull();
    expect(parseLocation({ radius: 'garbage' })).toBeNull();
  });

  test('reads numbers, trims spaces, and applies the default radius', () => {
    expect(parseLocation({ lat: ' 18.5204 ', lng: '73.8567', radius: '10' })).toEqual({
      lat: 18.5204,
      lng: 73.8567,
      radiusKm: 10,
    });
    expect(parseLocation({ lat: '-33.9', lng: '151.2' })).toEqual({ lat: -33.9, lng: 151.2, radiusKm: null });
    expect(parseLocation({ lat: '1', lng: '2' }, { defaultRadiusKm: 5 }).radiusKm).toBe(5);
  });

  test('0 is a valid coordinate, and the maximum radius is accepted', () => {
    expect(parseLocation({ lat: '0', lng: '0', radius: String(MAX_RADIUS_KM) })).toEqual({
      lat: 0,
      lng: 0,
      radiusKm: MAX_RADIUS_KM,
    });
  });

  test.each([
    ['latitude above 90', { lat: '91', lng: '10' }],
    ['latitude below -90', { lat: '-91', lng: '10' }],
    ['longitude above 180', { lat: '10', lng: '181' }],
    ['text', { lat: 'abc', lng: '10' }],
    ['scientific notation', { lat: '1e1', lng: '10' }],
    ['hex', { lat: '0x10', lng: '10' }],
    ['only lat', { lat: '10' }],
    ['only lng', { lng: '10' }],
    ['an array', { lat: ['1'], lng: '2' }],
  ])('rejects %s', (_label, query) => {
    expect(() => parseLocation(query)).toThrow(expect.objectContaining({ statusCode: 400, code: 'INVALID_LOCATION' }));
  });

  test.each(['0', '0.0', '-5', '101', 'abc', '5km', '1e1'])('rejects radius "%s"', (radius) => {
    expect(() => parseLocation({ lat: '10', lng: '10', radius })).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'INVALID_RADIUS' })
    );
  });
});
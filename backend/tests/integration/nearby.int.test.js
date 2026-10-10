const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { resetDb, closeDb, createUser, createStore, loginAs, auth } = require('../helpers/db');
const { haversineKm } = require('../helpers/geo');

const CENTER = { lat: 18.5204, lng: 73.8567 }; // Pune
let alice, tok;

beforeEach(async () => {
  await resetDb();
  alice = await createUser({ label: 'Alice' });
  tok = await loginAs(app, alice);
});
afterAll(closeDb);

// A point exactly `km` north of the centre (1 degree of latitude = 111.195 km)
const north = (km) => ({ latitude: Number((CENTER.lat + km / 111.195).toFixed(6)), longitude: CENTER.lng });

const makeStore = async (opts = {}) => {
  const owner = await createUser({ label: 'Owner', role: 'OWNER' });
  return createStore({ ownerId: owner.id, ...opts });
};

const near = (query = '', center = CENTER) =>
  request(app).get(`/api/v1/stores/nearby?lat=${center.lat}&lng=${center.lng}${query}`).set(auth(tok));
const ids = (res) => res.body.data.map((s) => s.id);

describe('GET /stores/nearby', () => {
  let s1, s3, s6, s20;

  beforeEach(async () => {
    s1 = await makeStore({ label: 'One', ...north(1) });
    s3 = await makeStore({ label: 'Three', ...north(3) });
    s6 = await makeStore({ label: 'Six', ...north(6) });
    s20 = await makeStore({ label: 'Twenty', ...north(20) });
    await makeStore({ label: 'Hidden', status: 'INACTIVE', ...north(0.5) });
    await makeStore({ label: 'NoCoords' });
  });

  test('the default radius is 5 km, and stores are sorted nearest first with their distance', async () => {
    const res = await near();
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([s1.id, s3.id]);
    expect(res.body.data[0].distanceKm).toBeCloseTo(1, 1);
    expect(res.body.data[1].distanceKm).toBeCloseTo(3, 1);
    expect(res.body.pagination.total).toBe(2);
  });

  test('a bigger radius finds more stores, still nearest first', async () => {
    expect(ids(await near('&radius=10'))).toEqual([s1.id, s3.id, s6.id]);
    expect(ids(await near('&radius=25'))).toEqual([s1.id, s3.id, s6.id, s20.id]);
  });

  test('order=desc gives the farthest first', async () => {
    expect(ids(await near('&radius=25&order=desc'))).toEqual([s20.id, s6.id, s3.id, s1.id]);
  });

  test('stores without coordinates and hidden stores never appear, even with the biggest radius', async () => {
    const res = await near('&radius=100');
    expect(res.body.pagination.total).toBe(4);
  });

  test('pagination works on the filtered, sorted result', async () => {
    const p1 = await near('&radius=25&limit=3&page=1');
    const p2 = await near('&radius=25&limit=3&page=2');
    expect(p1.body.pagination).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect([...ids(p1), ...ids(p2)]).toEqual([s1.id, s3.id, s6.id, s20.id]);
  });

  test('stores at exactly the same spot keep a stable order (by id)', async () => {
    const a = await makeStore({ label: 'TwinA', ...north(2) });
    const b = await makeStore({ label: 'TwinB', ...north(2) });
    const res = await near('&radius=2.5');
    expect(ids(res)).toEqual([s1.id, a.id, b.id]);
  });

  test('works together with category, rating, open-now and myRating', async () => {
    const bob = await createUser({ label: 'Bob' });
    const cafe = await makeStore({
      label: 'Cafe',
      category: 'CAFE',
      openingTime: '00:00:00',
      closingTime: '00:00:00', // open 24 hours
      ...north(2),
    });
    await db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, 5), (?, ?, 3)', [
      alice.id,
      cafe.id,
      bob.id,
      cafe.id,
    ]);

    const res = await near('&radius=10&category=CAFE&minRating=4&openNow=true');
    expect(ids(res)).toEqual([cafe.id]);
    expect(res.body.data[0]).toMatchObject({ overallRating: 4, ratingCount: 2, myRating: 5, isOpenNow: true });
    expect(res.body.data[0].distanceKm).toBeCloseTo(2, 1);
  });

  test.each([
    ['latitude above 90', 'lat=91&lng=10', 'INVALID_LOCATION'],
    ['longitude below -180', 'lat=10&lng=-181', 'INVALID_LOCATION'],
    ['text coordinates', 'lat=abc&lng=10', 'INVALID_LOCATION'],
    ['scientific notation', 'lat=1e1&lng=10', 'INVALID_LOCATION'],
    ['only lat', 'lat=10', 'INVALID_LOCATION'],
    ['only lng', 'lng=10', 'INVALID_LOCATION'],
    ['no coordinates at all', '', 'LOCATION_REQUIRED'],
    ['radius 0', 'lat=10&lng=10&radius=0', 'INVALID_RADIUS'],
    ['a negative radius', 'lat=10&lng=10&radius=-5', 'INVALID_RADIUS'],
    ['a radius over 100', 'lat=10&lng=10&radius=101', 'INVALID_RADIUS'],
    ['a radius with units', 'lat=10&lng=10&radius=5km', 'INVALID_RADIUS'],
  ])('rejects %s', async (_label, queryString, code) => {
    const res = await request(app).get(`/api/v1/stores/nearby?${queryString}`).set(auth(tok));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
  });
});

describe('location on the normal store list', () => {
  test('without a location there is no distance', async () => {
    await makeStore({ label: 'Plain', ...north(1) });
    const res = await request(app).get('/api/v1/stores').set(auth(tok));
    expect(res.body.data[0].distanceKm).toBeNull();
  });

  test('without a radius nothing is cut off: far stores and stores without coordinates still show, last', async () => {
    const mumbai = await makeStore({ label: 'Mumbai', latitude: 19.076, longitude: 72.8777 });
    const close = await makeStore({ label: 'Close', ...north(1) });
    const noCoords = await makeStore({ label: 'NoCoords' });

    const res = await request(app)
      .get(`/api/v1/stores?lat=${CENTER.lat}&lng=${CENTER.lng}&sortBy=distance&order=asc`)
      .set(auth(tok));

    expect(ids(res)).toEqual([close.id, mumbai.id, noCoords.id]); // no coordinates = last
    expect(res.body.data[2].distanceKm).toBeNull();

    const desc = await request(app)
      .get(`/api/v1/stores?lat=${CENTER.lat}&lng=${CENTER.lng}&sortBy=distance&order=desc`)
      .set(auth(tok));
    expect(ids(desc)).toEqual([mumbai.id, close.id, noCoords.id]); // still last in descending order
  });

  test('the distance from the database matches an independent calculation (Pune to Mumbai)', async () => {
    const MUMBAI = { lat: 19.076, lng: 72.8777 };
    const mumbai = await makeStore({ label: 'Mumbai', latitude: MUMBAI.lat, longitude: MUMBAI.lng });

    const res = await request(app)
      .get(`/api/v1/stores?lat=${CENTER.lat}&lng=${CENTER.lng}`)
      .set(auth(tok));
    const row = res.body.data.find((s) => s.id === mumbai.id);
    const expected = haversineKm(CENTER.lat, CENTER.lng, MUMBAI.lat, MUMBAI.lng);

    expect(expected).toBeGreaterThan(110);
    expect(expected).toBeLessThan(130);
    expect(Math.abs(row.distanceKm - expected)).toBeLessThan(0.02);
  });

  test('sorting by distance without a location is a 400', async () => {
    const res = await request(app).get('/api/v1/stores?sortBy=distance').set(auth(tok));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LOCATION_REQUIRED');
  });

  test('a radius without a location is ignored', async () => {
    await makeStore({ label: 'Anywhere', ...north(50) });
    const res = await request(app).get('/api/v1/stores?radius=1').set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
  });
});

describe('the date line (longitude +-180)', () => {
  test('stores on both sides of the date line are found, with the right distances', async () => {
    const east = await makeStore({ label: 'East', latitude: 0, longitude: 179.99 });
    const west = await makeStore({ label: 'West', latitude: 0, longitude: -179.99 });
    await makeStore({ label: 'Far', latitude: 0, longitude: 170 });

    const res = await near('&radius=5', { lat: 0, lng: 179.995 });

    expect(ids(res)).toEqual([east.id, west.id]);
    expect(res.body.data[0].distanceKm).toBeCloseTo(0.56, 1); // 0.005 degrees at the equator
    expect(res.body.data[1].distanceKm).toBeCloseTo(1.67, 1); // 0.015 degrees, going around the world
  });
});
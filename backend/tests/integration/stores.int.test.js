const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const storeRepository = require('../../src/repositories/storeRepository');
const { resetDb, closeDb, createUser, createStore, loginAs, auth } = require('../helpers/db');

let admin, alice, bob, tok;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ label: 'Admin', role: 'ADMIN' });
  alice = await createUser({ label: 'Alice' });
  bob = await createUser({ label: 'Bob' });
  tok = { admin: await loginAs(app, admin), alice: await loginAs(app, alice) };
});
afterAll(closeDb);

// A store with its own new owner (one owner = one store)
const makeStore = async (opts = {}) => {
  const owner = await createUser({ label: 'Owner', role: 'OWNER' });
  return createStore({ ownerId: owner.id, ...opts });
};
const rateDirect = (userId, storeId, rating) =>
  db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, ?)', [userId, storeId, rating]);
const list = (token, query = '') => request(app).get(`/api/v1/stores${query}`).set(auth(token));
const ids = (res) => res.body.data.map((s) => s.id);

describe('pagination', () => {
  test('pages never repeat or skip a store, even when every sort value is equal', async () => {
    const created = [];
    for (let i = 0; i < 5; i++) created.push((await makeStore({ label: `Shop${i}` })).id);

    const q = '&sortBy=overallRating&order=desc'; // all unrated, so every store ties
    const p1 = await list(tok.alice, `?limit=2&page=1${q}`);
    const p2 = await list(tok.alice, `?limit=2&page=2${q}`);
    const p3 = await list(tok.alice, `?limit=2&page=3${q}`);

    expect(p1.body.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect([ids(p1).length, ids(p2).length, ids(p3).length]).toEqual([2, 2, 1]);
    expect([...ids(p1), ...ids(p2), ...ids(p3)]).toEqual(created);
  });

  test('a page past the end is empty but still reports the right totals', async () => {
    await makeStore();
    const res = await list(tok.alice, '?page=9&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 9, limit: 5, total: 1, totalPages: 1 });
  });

  test('the limit is capped at 50 and nonsense falls back to defaults', async () => {
    expect((await list(tok.alice, '?limit=1000')).body.pagination.limit).toBe(50);
    expect((await list(tok.alice, '?limit=-5&page=abc')).body.pagination).toMatchObject({ limit: 12, page: 1 });
  });
});

describe('search and filters', () => {
  beforeEach(async () => {
    await makeStore({ label: 'Brew', category: 'CAFE', city: 'Pune' });
    await makeStore({ label: 'Spice', category: 'RESTAURANT', city: 'Mumbai' });
    await makeStore({ label: 'Book', category: 'BOOKSTORE', city: 'Pune', address: '12 Library Lane, Pune' });
  });

  test('category filter (any letter case)', async () => {
    expect((await list(tok.alice, '?category=CAFE')).body.pagination.total).toBe(1);
    expect((await list(tok.alice, '?category=cafe')).body.pagination.total).toBe(1);
  });

  test('city filter is a case-insensitive "contains"', async () => {
    expect((await list(tok.alice, '?city=pune')).body.pagination.total).toBe(2);
  });

  test('one search box matches name, address OR city', async () => {
    expect((await list(tok.alice, '?search=mumbai')).body.pagination.total).toBe(1); // city
    expect((await list(tok.alice, '?search=library')).body.pagination.total).toBe(1); // address
    expect((await list(tok.alice, '?search=brew')).body.pagination.total).toBe(1); // name
  });

  test('the original name and address searches still work', async () => {
    expect((await list(tok.alice, '?name=spice')).body.pagination.total).toBe(1);
    expect((await list(tok.alice, '?address=library')).body.pagination.total).toBe(1);
  });

  test('filters combine (AND)', async () => {
    const res = await list(tok.alice, '?city=pune&category=bookstore');
    expect(res.body.pagination.total).toBe(1);
  });

  test('a literal % in the search is not a wildcard', async () => {
    await makeStore({ label: 'Percent', address: '100% Real Street, Pune' });
    const res = await list(tok.alice, '?search=%25');
    expect(res.body.pagination.total).toBe(1);
  });

  test('an unknown category or a bad minRating is a 400', async () => {
    expect((await list(tok.alice, '?category=SPACESHIP')).body.code).toBe('INVALID_CATEGORY');
    expect((await list(tok.alice, '?minRating=9')).body.code).toBe('INVALID_MIN_RATING');
  });

  test('stores do not expose their email or status to customers', async () => {
    const res = await list(tok.alice);
    expect(res.body.data[0]).not.toHaveProperty('email');
    expect(res.body.data[0]).not.toHaveProperty('status');
  });
});

describe('ratings in discovery', () => {
  let A, B, C;

  beforeEach(async () => {
    A = await makeStore({ label: 'A', createdAt: new Date('2026-01-01T00:00:00Z') });
    B = await makeStore({ label: 'B', createdAt: new Date('2026-03-01T00:00:00Z') });
    C = await makeStore({ label: 'C', createdAt: new Date('2026-02-01T00:00:00Z') });
    await rateDirect(alice.id, A.id, 5);
    await rateDirect(bob.id, A.id, 3); // A: average 4.0 from 2 ratings
    await rateDirect(alice.id, B.id, 3); // B: average 3.0 from 1 rating, C: unrated
  });

  test('minRating keeps only stores at or above it (unrated stores never match)', async () => {
    expect(ids(await list(tok.alice, '?minRating=4'))).toEqual([A.id]);
    expect(ids(await list(tok.alice, '?minRating=3'))).toEqual([A.id, B.id]);
    expect((await list(tok.alice, '?minRating=5')).body.pagination.total).toBe(0);
  });

  test('sorting by rating always puts unrated stores LAST, in both directions', async () => {
    expect(ids(await list(tok.alice, '?sortBy=overallRating&order=desc'))).toEqual([A.id, B.id, C.id]);
    expect(ids(await list(tok.alice, '?sortBy=overallRating&order=asc'))).toEqual([B.id, A.id, C.id]);
  });

  test('sorting by review count and by newest', async () => {
    expect(ids(await list(tok.alice, '?sortBy=ratingCount&order=desc'))).toEqual([A.id, B.id, C.id]);
    expect(ids(await list(tok.alice, '?sortBy=newest&order=desc'))).toEqual([B.id, C.id, A.id]);
  });

  test('every store reports its rating count, and myRating belongs to the logged-in user only', async () => {
    const res = await list(tok.alice);
    const a = res.body.data.find((s) => s.id === A.id);
    expect(a).toMatchObject({ overallRating: 4, ratingCount: 2, myRating: 5 });
    expect(res.body.data.find((s) => s.id === C.id)).toMatchObject({ overallRating: null, ratingCount: 0, myRating: null });
  });
});

describe('hidden (INACTIVE) stores', () => {
  test('customers do not see them and cannot rate them; the admin still sees them', async () => {
    const visible = await makeStore({ label: 'Visible' });
    const hidden = await makeStore({ label: 'Hidden', status: 'INACTIVE' });

    expect(ids(await list(tok.alice))).toEqual([visible.id]);

    const rate = await request(app)
      .post(`/api/v1/stores/${hidden.id}/rating`)
      .set(auth(tok.alice))
      .send({ rating: 4 });
    expect(rate.status).toBe(404);
    expect(rate.body.code).toBe('STORE_NOT_FOUND');

    const adminAll = await request(app).get('/api/v1/admin/stores').set(auth(tok.admin));
    expect(adminAll.body.pagination.total).toBe(2);
    const adminHidden = await request(app).get('/api/v1/admin/stores?status=INACTIVE').set(auth(tok.admin));
    expect(adminHidden.body.data.map((s) => s.id)).toEqual([hidden.id]);
  });
});

describe('"open now" (opening hours)', () => {
  let day, night, allDay, noHours;

  beforeEach(async () => {
    day = await makeStore({ label: 'Day', openingTime: '09:00:00', closingTime: '21:00:00' });
    night = await makeStore({ label: 'Night', openingTime: '20:00:00', closingTime: '02:00:00' }); // past midnight
    allDay = await makeStore({ label: 'AllDay', openingTime: '00:00:00', closingTime: '00:00:00' }); // 24 hours
    noHours = await makeStore({ label: 'NoHours' });
  });

  // Ask the repository with a chosen time of day (the API itself always uses the real clock)
  const openAt = async (nowTime, openNow = true) => {
    const { rows } = await storeRepository.listForUser(
      alice.id,
      { openNow },
      { sortBy: 'name', order: 'asc', limit: 50, offset: 0 },
      nowTime
    );
    return rows;
  };
  const firstWords = (rows) => rows.map((r) => r.name.split(' ')[0]);

  test('during the day', async () => {
    expect(firstWords(await openAt('10:00:00'))).toEqual(['AllDay', 'Day']);
  });

  test('late evening: the overnight store is open, the day store is closed', async () => {
    expect(firstWords(await openAt('23:00:00'))).toEqual(['AllDay', 'Night']);
  });

  test('after midnight: the overnight store is still open', async () => {
    expect(firstWords(await openAt('01:00:00'))).toEqual(['AllDay', 'Night']);
  });

  test('opening time counts as open, closing time as closed', async () => {
    expect(firstWords(await openAt('09:00:00'))).toContain('Day');
    expect(firstWords(await openAt('21:00:00'))).not.toContain('Day');
  });

  test('stores without hours never match "open now"', async () => {
    expect(firstWords(await openAt('12:00:00'))).not.toContain('NoHours');
  });

  test('every row reports isOpenNow: 1 open, 0 closed, null unknown', async () => {
    const rows = await openAt('10:00:00', false);
    const flags = Object.fromEntries(rows.map((r) => [r.name.split(' ')[0], r.isOpenNow]));
    expect(flags).toEqual({ AllDay: 1, Day: 1, Night: 0, NoHours: null });
  });

  test('the real API accepts openNow=true (uses the current time)', async () => {
    const res = await list(tok.alice, '?openNow=true');
    expect(res.status).toBe(200);
    expect(ids(res)).not.toContain(noHours.id);
  });
});

describe('admin: create, read, edit', () => {
  const payload = (ownerId, extra = {}) => ({
    name: 'Brew House Coffee Roasters Pune',
    email: 'brew@example.com',
    address: '5 JM Road, Pune',
    ownerId,
    category: 'CAFE',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411004',
    phone: '+91 20 1234 5678',
    website: 'https://example.com',
    imageUrl: 'https://example.com/photo.jpg',
    description: 'Specialty coffee and fresh pastries.',
    latitude: 18.5204,
    longitude: 73.8567,
    openingTime: '08:00',
    closingTime: '22:00',
    ...extra,
  });

  const createOwner = () => createUser({ label: 'Owner', role: 'OWNER' });
  const storeCount = async () => (await db.query('SELECT COUNT(*) AS n FROM stores'))[0][0].n;

  test('creates a store with all fields, and the admin can read it back', async () => {
    const owner = await createOwner();
    const res = await request(app).post('/api/v1/admin/stores').set(auth(tok.admin)).send(payload(owner.id));
    expect(res.status).toBe(201);
    expect(res.body.data.store).toMatchObject({ category: 'CAFE', city: 'Pune', status: 'ACTIVE' });

    const get = await request(app).get(`/api/v1/admin/stores/${res.body.data.store.id}`).set(auth(tok.admin));
    expect(get.status).toBe(200);
    expect(get.body.data).toMatchObject({
      name: 'Brew House Coffee Roasters Pune',
      category: 'CAFE',
      latitude: 18.5204,
      longitude: 73.8567,
      openingTime: '08:00',
      closingTime: '22:00',
      ownerId: owner.id,
      ownerEmail: owner.email,
    });
  });

  test('a store created with only the old fields still works (category defaults to OTHER)', async () => {
    const owner = await createOwner();
    const res = await request(app)
      .post('/api/v1/admin/stores')
      .set(auth(tok.admin))
      .send({ name: 'Plain Old Store With A Long Name', email: 'plain@example.com', address: 'Pune', ownerId: owner.id });
    expect(res.status).toBe(201);
    expect(res.body.data.store.category).toBe('OTHER');
  });

  test('0 is accepted as a coordinate', async () => {
    const owner = await createOwner();
    const res = await request(app)
      .post('/api/v1/admin/stores')
      .set(auth(tok.admin))
      .send(payload(owner.id, { latitude: 0, longitude: 0 }));
    expect(res.status).toBe(201);
  });

  test.each([
    ['latitude above 90', { latitude: 100 }, 'VALIDATION_ERROR'],
    ['longitude below -180', { longitude: -200 }, 'VALIDATION_ERROR'],
    ['latitude without longitude', { longitude: null }, 'INVALID_COORDINATES'],
    ['opening time without closing time', { closingTime: null }, 'INVALID_HOURS'],
    ['a bad time format', { openingTime: '25:99' }, 'VALIDATION_ERROR'],
    ['a javascript: website link', { website: 'javascript:alert(1)' }, 'VALIDATION_ERROR'],
    ['an image link without http', { imageUrl: 'ftp://example.com/a.jpg' }, 'VALIDATION_ERROR'],
    ['an unknown category', { category: 'SPACESHIP' }, 'VALIDATION_ERROR'],
    ['a phone that is not a phone', { phone: 'call me maybe' }, 'VALIDATION_ERROR'],
    ['a description over 1000 characters', { description: 'x'.repeat(1001) }, 'VALIDATION_ERROR'],
  ])('rejects %s and creates nothing', async (_label, extra, code) => {
    const owner = await createOwner();
    const res = await request(app).post('/api/v1/admin/stores').set(auth(tok.admin)).send(payload(owner.id, extra));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(await storeCount()).toBe(0);
  });

  test('editing changes the fields and keeps the owner; INACTIVE hides it from customers', async () => {
    const owner = await createOwner();
    const store = await createStore({ ownerId: owner.id, label: 'Editable' });

    const res = await request(app)
      .put(`/api/v1/admin/stores/${store.id}`)
      .set(auth(tok.admin))
      .send({
        name: 'Renamed Fitness Studio And Gym',
        email: 'gym@example.com',
        address: '9 Hill Road, Pune',
        category: 'FITNESS',
        city: 'Pune',
        status: 'INACTIVE',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.store).toMatchObject({
      name: 'Renamed Fitness Studio And Gym',
      category: 'FITNESS',
      status: 'INACTIVE',
      ownerId: owner.id,
    });

    expect((await list(tok.alice)).body.data).toEqual([]); // hidden now

    await request(app)
      .put(`/api/v1/admin/stores/${store.id}`)
      .set(auth(tok.admin))
      .send({ name: 'Renamed Fitness Studio And Gym', email: 'gym@example.com', address: 'x', category: 'FITNESS', status: 'ACTIVE' });
    expect((await list(tok.alice)).body.data).toHaveLength(1); // visible again
  });

  test('editing an unknown store is 404; a missing category is 400', async () => {
    const missing = await request(app)
      .put('/api/v1/admin/stores/999999')
      .set(auth(tok.admin))
      .send({ name: 'Some Store With A Long Name', email: 'a@b.com', address: 'x', category: 'CAFE' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('STORE_NOT_FOUND');

    const owner = await createOwner();
    const store = await createStore({ ownerId: owner.id });
    const noCategory = await request(app)
      .put(`/api/v1/admin/stores/${store.id}`)
      .set(auth(tok.admin))
      .send({ name: 'Some Store With A Long Name', email: 'a@b.com', address: 'x' });
    expect(noCategory.status).toBe(400);
  });

  test('extra fields in the body (like ownerId on an edit) are ignored', async () => {
    const owner = await createOwner();
    const other = await createOwner();
    const store = await createStore({ ownerId: owner.id });

    await request(app)
      .put(`/api/v1/admin/stores/${store.id}`)
      .set(auth(tok.admin))
      .send({ name: 'Some Store With A Long Name', email: 'a@b.com', address: 'x', category: 'CAFE', ownerId: other.id });

    const [[row]] = await db.query('SELECT owner_id FROM stores WHERE id = ?', [store.id]);
    expect(row.owner_id).toBe(owner.id);
  });
});

describe('admin store list', () => {
  test('is paginated, filterable and sortable, and rating is a number', async () => {
    const a = await makeStore({ label: 'Alpha', category: 'CAFE' });
    await makeStore({ label: 'Bravo', category: 'CAFE' });
    await makeStore({ label: 'Charlie', category: 'GROCERY' });
    await rateDirect(alice.id, a.id, 4);

    const page2 = await request(app)
      .get('/api/v1/admin/stores?category=CAFE&limit=1&page=2&sortBy=name&order=asc')
      .set(auth(tok.admin));
    expect(page2.status).toBe(200);
    expect(page2.body.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(page2.body.data[0].name.startsWith('Bravo')).toBe(true);

    const all = await request(app).get('/api/v1/admin/stores?sortBy=rating&order=desc').set(auth(tok.admin));
    expect(all.body.data[0]).toMatchObject({ id: a.id, rating: 4, ratingCount: 1 });
    expect(all.body.data[2].rating).toBeNull(); // unrated last
  });

  test('bad filters are rejected', async () => {
    expect((await request(app).get('/api/v1/admin/stores?status=DELETED').set(auth(tok.admin))).body.code).toBe('INVALID_STATUS');
    expect((await request(app).get('/api/v1/admin/stores?category=NOPE').set(auth(tok.admin))).body.code).toBe('INVALID_CATEGORY');
  });
});
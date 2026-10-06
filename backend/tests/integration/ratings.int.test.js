const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { resetDb, closeDb, createUser, createStore, loginAs, auth } = require('../helpers/db');

let admin, owner1, owner2, alice, bob, store1, store2, tok;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ label: 'Admin', role: 'ADMIN' });
  owner1 = await createUser({ label: 'OwnerOne', role: 'OWNER' });
  owner2 = await createUser({ label: 'OwnerTwo', role: 'OWNER' });
  alice = await createUser({ label: 'Alice' });
  bob = await createUser({ label: 'Bob' });
  store1 = await createStore({ ownerId: owner1.id, label: 'Fresh' });
  store2 = await createStore({ ownerId: owner2.id, label: 'Daily' });

  tok = {
    admin: await loginAs(app, admin),
    owner1: await loginAs(app, owner1),
    owner2: await loginAs(app, owner2),
    alice: await loginAs(app, alice),
    bob: await loginAs(app, bob),
  };
});
afterAll(closeDb);

const rate = (token, storeId, rating) =>
  request(app).post(`/api/v1/stores/${storeId}/rating`).set(auth(token)).send({ rating });

const listStores = async (token) =>
  (await request(app).get('/api/v1/stores').set(auth(token))).body.data;

describe('rating flow', () => {
  test('submitting then modifying keeps exactly ONE row per user and store', async () => {
    expect((await rate(tok.alice, store1.id, 4)).status).toBe(200);
    expect((await rate(tok.alice, store1.id, 2)).status).toBe(200);

    const [rows] = await db.query('SELECT rating FROM ratings WHERE user_id = ? AND store_id = ?', [
      alice.id,
      store1.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(2);
  });

  test('overall rating is the average of everyone; myRating is only my own', async () => {
    await rate(tok.alice, store1.id, 5);
    await rate(tok.bob, store1.id, 2);

    const asAlice = (await listStores(tok.alice)).find((s) => s.id === store1.id);
    const asBob = (await listStores(tok.bob)).find((s) => s.id === store1.id);

    expect(Number(asAlice.overallRating)).toBe(3.5);
    expect(asAlice.myRating).toBe(5);
    expect(Number(asBob.overallRating)).toBe(3.5);
    expect(asBob.myRating).toBe(2);
  });

  test('a store nobody rated has null overall and null mine', async () => {
    const row = (await listStores(tok.alice)).find((s) => s.id === store2.id);
    expect(row.overallRating).toBeNull();
    expect(row.myRating).toBeNull();
  });

  test('rating a store that does not exist gives 404', async () => {
    const res = await rate(tok.alice, 999999, 4);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STORE_NOT_FOUND');
  });

  test('an invalid rating is rejected by the API and nothing is saved', async () => {
    const res = await rate(tok.alice, store1.id, 6);
    expect(res.status).toBe(400);
    const [rows] = await db.query('SELECT id FROM ratings');
    expect(rows).toHaveLength(0);
  });
});

describe('owner dashboard and isolation', () => {
  test('owner sees the average and the raters of THEIR store', async () => {
    await rate(tok.alice, store1.id, 4);
    await rate(tok.bob, store1.id, 5);

    const res = await request(app).get('/api/v1/owner/dashboard').set(auth(tok.owner1));

    expect(res.status).toBe(200);
    expect(res.body.data.stores).toHaveLength(1);
    expect(Number(res.body.data.stores[0].averageRating)).toBe(4.5);
    expect(res.body.data.stores[0].totalRatings).toBe(2);
    expect(res.body.data.raters).toHaveLength(2);
  });

  test("another owner never sees these ratings, even when asking for them", async () => {
    await rate(tok.alice, store1.id, 4);

    const res = await request(app)
      .get(`/api/v1/owner/dashboard?ownerId=${owner1.id}&id=${owner1.id}`)
      .set(auth(tok.owner2));

    expect(res.body.data.stores[0].id).toBe(store2.id);
    expect(res.body.data.stores[0].totalRatings).toBe(0);
    expect(res.body.data.raters).toEqual([]);
  });

  test('timestamps are correct (UTC fix): "rated at" is within a minute of now', async () => {
    await rate(tok.alice, store1.id, 4);

    const res = await request(app).get('/api/v1/owner/dashboard').set(auth(tok.owner1));
    const ratedAt = new Date(res.body.data.raters[0].ratedAt).getTime();

    expect(Math.abs(Date.now() - ratedAt)).toBeLessThan(60 * 1000);
  });
});

describe('admin rules', () => {
  test('admin creates an owner and a store through the API', async () => {
    const owner = await request(app)
      .post('/api/v1/admin/users')
      .set(auth(tok.admin))
      .send({
        name: 'Priya Patel Store Owner One',
        email: 'priya@example.com',
        address: '45 FC Road, Pune',
        password: 'Priya@1234',
        role: 'OWNER',
      });
    expect(owner.status).toBe(201);

    const store = await request(app)
      .post('/api/v1/admin/stores')
      .set(auth(tok.admin))
      .send({
        name: 'Fresh Mart Supermarket',
        email: 'freshmart@example.com',
        address: '78 Station Road, Pune',
        ownerId: owner.body.data.user.id,
      });
    expect(store.status).toBe(201);
  });

  test('a second store for the same owner is refused (409), and the DB would refuse it too', async () => {
    const res = await request(app)
      .post('/api/v1/admin/stores')
      .set(auth(tok.admin))
      .send({
        name: 'Second Store For Owner One',
        email: 'second@example.com',
        address: 'Pune',
        ownerId: owner1.id,
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OWNER_HAS_STORE');

    // Bypass the service completely: the database constraint is the real guarantee
    await expect(
      db.query('INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)', [
        'Another Store Same Owner Test',
        'x@example.com',
        'Pune',
        owner1.id,
      ])
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  test('details of an owner include their store rating; a normal user has none', async () => {
    await rate(tok.alice, store1.id, 4);

    const ownerRes = await request(app).get(`/api/v1/admin/users/${owner1.id}`).set(auth(tok.admin));
    expect(Number(ownerRes.body.data.rating)).toBe(4);

    const userRes = await request(app).get(`/api/v1/admin/users/${alice.id}`).set(auth(tok.admin));
    expect(userRes.body.data).not.toHaveProperty('rating');
    expect(userRes.body.data).not.toHaveProperty('password_hash');
  });
});

describe('admin analytics (real SQL)', () => {
  test('totals, distribution, roles, top store and activity match the data', async () => {
    await rate(tok.alice, store1.id, 5);
    await rate(tok.bob, store1.id, 3);
    await rate(tok.alice, store2.id, 4);

    const res = await request(app).get('/api/v1/admin/analytics').set(auth(tok.admin));
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.totals).toMatchObject({ totalUsers: 5, totalStores: 2, totalRatings: 3, averageRating: 4 });
    expect(data.ratingDistribution).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 1 },
      { rating: 4, count: 1 },
      { rating: 5, count: 1 },
    ]);

    const roles = Object.fromEntries(data.usersByRole.map((r) => [r.role, r.count]));
    expect(roles).toEqual({ ADMIN: 1, OWNER: 2, USER: 2 });

    // Both stores average 4.0; the one with MORE ratings ranks first
    expect(data.topStores[0].id).toBe(store1.id);

    expect(data.activity).toHaveLength(7);
    expect(data.activity[6].ratings).toBe(3); // all three were made today (UTC)
    expect(data.recentRatings).toHaveLength(3);
  });
});

describe('admin lists (real SQL)', () => {
  test('role filter and case-insensitive name search', async () => {
    const owners = await request(app).get('/api/v1/admin/users?role=OWNER').set(auth(tok.admin));
    expect(owners.body.data).toHaveLength(2);
    expect(owners.body.data.every((u) => u.role === 'OWNER')).toBe(true);

    const byName = await request(app).get('/api/v1/admin/users?name=ALICE').set(auth(tok.admin));
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].id).toBe(alice.id);
  });

  test('sorting by email descending', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?sortBy=email&order=desc')
      .set(auth(tok.admin));
    const emails = res.body.data.map((u) => u.email);
    expect(emails).toEqual([...emails].sort().reverse());
  });

  test('a literal % in a search matches only addresses that contain a real %', async () => {
    await createUser({ label: 'Percent', address: '100% Real Street, Pune' });

    const res = await request(app).get('/api/v1/admin/users').query({ address: '%' }).set(auth(tok.admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].address).toBe('100% Real Street, Pune');
  });

  test('a prototype-style sort key is safely ignored', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?sortBy=constructor')
      .set(auth(tok.admin));
    expect(res.status).toBe(200);
  });
});
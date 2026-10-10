const db = require('../../src/config/db');
const { resetDb, closeDb, createUser, createStore } = require('../helpers/db');

beforeEach(resetDb);
afterAll(closeDb);

const insertUser = (name, email) =>
  db.query('INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, ?)', [
    name,
    email,
    'hash',
    'Pune',
    'USER',
  ]);

describe('database constraints', () => {
  test('user name under 20 or over 60 characters is rejected', async () => {
    await expect(insertUser('Too Short', 'a@example.com')).rejects.toThrow();
    await expect(insertUser('x'.repeat(61), 'b@example.com')).rejects.toThrow();
    await expect(insertUser('x'.repeat(20), 'c@example.com')).resolves.toBeDefined();
  });

  test('duplicate email is rejected', async () => {
    await insertUser('Valid Name Twenty Chars', 'dup@example.com');
    await expect(insertUser('Another Valid Name Here', 'dup@example.com')).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY',
    });
  });

  test('a rating outside 1 to 5 is rejected by the database', async () => {
    const owner = await createUser({ label: 'Owner', role: 'OWNER' });
    const user = await createUser({ label: 'Rater' });
    const store = await createStore({ ownerId: owner.id });

    for (const bad of [0, 6]) {
      await expect(
        db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, ?)', [user.id, store.id, bad])
      ).rejects.toThrow();
    }
  });

  test('one rating per user per store is enforced', async () => {
    const owner = await createUser({ label: 'Owner', role: 'OWNER' });
    const user = await createUser({ label: 'Rater' });
    const store = await createStore({ ownerId: owner.id });

    await db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, 4)', [user.id, store.id]);
    await expect(
      db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, 5)', [user.id, store.id])
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  test('a rating cannot point at a user or store that does not exist', async () => {
    await expect(
      db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (999998, 999999, 3)')
    ).rejects.toThrow();
  });
});

describe('cascading deletes', () => {
  test('deleting a user removes their ratings', async () => {
    const owner = await createUser({ label: 'Owner', role: 'OWNER' });
    const user = await createUser({ label: 'Rater' });
    const store = await createStore({ ownerId: owner.id });
    await db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, 4)', [user.id, store.id]);

    await db.query('DELETE FROM users WHERE id = ?', [user.id]);

    const [rows] = await db.query('SELECT id FROM ratings');
    expect(rows).toHaveLength(0);
  });

  test('deleting an owner removes their store and the ratings of that store', async () => {
    const owner = await createUser({ label: 'Owner', role: 'OWNER' });
    const user = await createUser({ label: 'Rater' });
    const store = await createStore({ ownerId: owner.id });
    await db.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, 4)', [user.id, store.id]);

    await db.query('DELETE FROM users WHERE id = ?', [owner.id]);

    const [stores] = await db.query('SELECT id FROM stores');
    const [ratings] = await db.query('SELECT id FROM ratings');
    expect(stores).toHaveLength(0);
    expect(ratings).toHaveLength(0);
  });
});


describe('store profile constraints (migration 006)', () => {
  const { STORE_CATEGORIES } = require('../../src/constants/storeCategories');

  const insertStore = async (columns, values) => {
    const owner = await createUser({ label: 'Owner', role: 'OWNER' });
    return db.query(
      `INSERT INTO stores (name, email, address, owner_id, ${columns.join(', ')})
       VALUES (?, ?, ?, ?, ${columns.map(() => '?').join(', ')})`,
      ['Constraint Test Store Name', 'c@example.com', 'Pune', owner.id, ...values]
    );
  };

  test('latitude must be within -90 and 90, longitude within -180 and 180', async () => {
    await expect(insertStore(['latitude', 'longitude'], [91, 10])).rejects.toThrow();
    await expect(insertStore(['latitude', 'longitude'], [-91, 10])).rejects.toThrow();
    await expect(insertStore(['latitude', 'longitude'], [10, 181])).rejects.toThrow();
    await expect(insertStore(['latitude', 'longitude'], [18.5, 73.8])).resolves.toBeDefined();
  });

  test('coordinates come in pairs: half a pair is rejected', async () => {
    await expect(insertStore(['latitude'], [18.5])).rejects.toThrow();
    await expect(insertStore(['longitude'], [73.8])).rejects.toThrow();
  });

  test('opening hours come in pairs: half a pair is rejected', async () => {
    await expect(insertStore(['opening_time'], ['09:00:00'])).rejects.toThrow();
    await expect(insertStore(['closing_time'], ['21:00:00'])).rejects.toThrow();
    await expect(insertStore(['opening_time', 'closing_time'], ['09:00:00', '21:00:00'])).resolves.toBeDefined();
  });

  test('an unknown category is rejected by the database', async () => {
    await expect(insertStore(['category'], ['SPACESHIP'])).rejects.toThrow();
  });

  test('the category ENUM in the database matches the list in the code', async () => {
    const [[col]] = await db.query(
      `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'category'`
    );
    const values = [...col.t.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(values).toEqual(STORE_CATEGORIES);
  });
});
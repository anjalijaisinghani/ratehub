const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { resetDb, closeDb, auth } = require('../helpers/db');

beforeEach(resetDb);
afterAll(closeDb);

const signupBody = (email = 'rahul@example.com') => ({
  name: 'Rahul Sharma Test User One',
  email,
  address: '12 MG Road, Pune',
  password: 'Rahul@1234',
});

const dbUser = async (email) => {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

describe('signup (real database)', () => {
  test('stores a bcrypt hash, never the plain password', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(signupBody());
    expect(res.status).toBe(201);

    const row = await dbUser('rahul@example.com');
    expect(row.password_hash).not.toBe('Rahul@1234');
    expect(row.password_hash.startsWith('$2')).toBe(true);
  });

  test('role is always USER, even if the client asks for ADMIN', async () => {
    await request(app).post('/api/v1/auth/signup').send({ ...signupBody(), role: 'ADMIN' });
    expect((await dbUser('rahul@example.com')).role).toBe('USER');
  });

  test('duplicate email gives 409 and only one row exists', async () => {
    await request(app).post('/api/v1/auth/signup').send(signupBody());
    const res = await request(app).post('/api/v1/auth/signup').send(signupBody());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
    const [rows] = await db.query('SELECT id FROM users');
    expect(rows).toHaveLength(1);
  });

  test('email uniqueness ignores letter case', async () => {
    await request(app).post('/api/v1/auth/signup').send(signupBody('case@example.com'));
    const res = await request(app).post('/api/v1/auth/signup').send(signupBody('CASE@example.com'));
    expect(res.status).toBe(409);
  });
});

describe('login and password change (real database)', () => {
  test('signup then login returns a token that opens a protected route', async () => {
    await request(app).post('/api/v1/auth/signup').send(signupBody());

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Rahul@1234' });
    expect(login.status).toBe(200);
    expect(JSON.stringify(login.body)).not.toContain('password_hash');

    const stores = await request(app).get('/api/v1/stores').set(auth(login.body.data.accessToken));
    expect(stores.status).toBe(200);
    expect(stores.body.data).toEqual([]);
  });

  test('wrong password gives 401 INVALID_CREDENTIALS', async () => {
    await request(app).post('/api/v1/auth/signup').send(signupBody());
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Wrong@1234' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('after changing the password, the old one stops working and the new one works', async () => {
    await request(app).post('/api/v1/auth/signup').send(signupBody());
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Rahul@1234' });

    const change = await request(app)
      .put('/api/v1/auth/change-password')
      .set(auth(login.body.data.accessToken))
      .send({ currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' });
    expect(change.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Rahul@1234' });
    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Rahul@5678' });

    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });
});
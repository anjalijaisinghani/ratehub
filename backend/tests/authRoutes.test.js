const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../src/repositories/userRepository');
jest.mock('../src/repositories/refreshTokenRepository');

const userRepository = require('../src/repositories/userRepository');
const refreshTokenRepository = require('../src/repositories/refreshTokenRepository');
const app = require('../src/app');

const validSignup = {
  name: 'Rahul Sharma Test User One',
  email: 'rahul@example.com',
  address: '12 MG Road, Pune',
  password: 'Rahul@1234',
};

const activeUser = async () => ({
  id: 2,
  name: validSignup.name,
  email: validSignup.email,
  address: validSignup.address,
  role: 'USER',
  status: 'ACTIVE',
  locked_until: null,
  password_hash: await bcrypt.hash('Rahul@1234', 4),
});

beforeEach(() => jest.resetAllMocks());

describe('POST /api/v1/auth/login', () => {
  test('success: access token in the body, refresh token ONLY in an httpOnly cookie', async () => {
    userRepository.findByEmail.mockResolvedValue(await activeUser());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Rahul@1234' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.role).toBe('USER');
    expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('rh_refresh='));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toContain('SameSite=Strict');
  });

  test('wrong password: 401 with the standard error shape and no cookie', async () => {
    userRepository.findByEmail.mockResolvedValue(await activeUser());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Wrong@1234' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('a password in the wrong format is a normal 401, not a 400', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'weak' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('POST /api/v1/auth/signup', () => {
  test('success: 201 and the new user (no password)', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(10);

    const res = await request(app).post('/api/v1/auth/signup').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ id: 10, role: 'USER' });
    expect(JSON.stringify(res.body)).not.toContain('Rahul@1234');
  });

  test('duplicate email: 409 EMAIL_EXISTS', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: 1 });
    const res = await request(app).post('/api/v1/auth/signup').send(validSignup);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  test('short name: 400 VALIDATION_ERROR and nothing is saved', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...validSignup, name: 'Short Name' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(userRepository.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/refresh', () => {
  test('without a cookie: 401 NO_REFRESH_TOKEN', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_REFRESH_TOKEN');
  });

  test('from an untrusted website (Origin header): 403 before anything else happens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://evil.example.com')
      .set('Cookie', 'rh_refresh=abc');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(refreshTokenRepository.findByHash).not.toHaveBeenCalled();
  });

  test('from our own website the origin check passes', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173');
    expect(res.body.code).toBe('NO_REFRESH_TOKEN'); // got past the origin check
  });

  test('a bad cookie is removed from the browser', async () => {
    refreshTokenRepository.findByHash.mockResolvedValue(null);
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', 'rh_refresh=bogus');
    expect(res.status).toBe(401);
    const cleared = res.headers['set-cookie'].find((c) => c.startsWith('rh_refresh='));
    expect(cleared.startsWith('rh_refresh=;')).toBe(true);
  });
});

describe('POST /api/v1/auth/logout and logout-all', () => {
  test('logout always succeeds and clears the cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie'].find((c) => c.startsWith('rh_refresh=;'))).toBeDefined();
  });

  test('logout from an untrusted origin is blocked', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set('Origin', 'http://evil.example.com');
    expect(res.status).toBe(403);
  });

  test('logout-all without a token: 401', async () => {
    const res = await request(app).post('/api/v1/auth/logout-all');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  test('logout-all with a token revokes the sessions of THAT user', async () => {
    const token = jwt.sign({ id: 2, role: 'USER' }, process.env.JWT_SECRET);
    const res = await request(app).post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(2, 'logout_all', expect.any(Date));
  });
});

describe('PUT /api/v1/auth/change-password', () => {
  test('without a token: 401 NO_TOKEN', async () => {
    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .send({ currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  test('with a valid token: 200, and the current session id is kept', async () => {
    userRepository.findById.mockResolvedValue({ id: 2, password_hash: await bcrypt.hash('Rahul@1234', 4) });
    const token = jwt.sign({ id: 2, role: 'USER', sid: 'fam-9' }, process.env.JWT_SECRET);

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Password updated successfully' });
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
      2,
      'password_changed',
      expect.any(Date),
      'fam-9'
    );
  });
});
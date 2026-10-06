const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../src/repositories/userRepository');

const userRepository = require('../src/repositories/userRepository');
const app = require('../src/app');

const validSignup = {
  name: 'Rahul Sharma Test User One',
  email: 'rahul@example.com',
  address: '12 MG Road, Pune',
  password: 'Rahul@1234',
};

beforeEach(() => jest.resetAllMocks());

describe('POST /api/v1/auth/login', () => {
  test('success: standard shape, token present, no password hash anywhere', async () => {
    userRepository.findByEmail.mockResolvedValue({
      id: 2,
      name: validSignup.name,
      email: validSignup.email,
      address: validSignup.address,
      role: 'USER',
      password_hash: await bcrypt.hash('Rahul@1234', 4),
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Rahul@1234' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Login successful');
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.role).toBe('USER');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  test('wrong password: 401 with the standard error shape', async () => {
    userRepository.findByEmail.mockResolvedValue({
      id: 2,
      role: 'USER',
      password_hash: await bcrypt.hash('Rahul@1234', 4),
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@example.com', password: 'Wrong@1234' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
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
    expect(res.body.success).toBe(true);
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
    expect(res.body.message).toBe('Name must be between 20 and 60 characters');
    expect(userRepository.create).not.toHaveBeenCalled();
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

  test('with a valid token: 200 and the password is updated', async () => {
    userRepository.findById.mockResolvedValue({
      id: 2,
      password_hash: await bcrypt.hash('Rahul@1234', 4),
    });
    const token = jwt.sign({ id: 2, role: 'USER' }, process.env.JWT_SECRET);

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Password updated successfully' });
    expect(userRepository.updatePassword).toHaveBeenCalledTimes(1);
  });
});
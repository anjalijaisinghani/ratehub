const request = require('supertest');
const app = require('../src/app');

describe('Foundation: health, errors, versioning', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'UP' });
  });

  test('unknown route returns the standard 404 format', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
    });
  });

  test('protected route without a token returns 401 NO_TOKEN', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  test('garbage token returns 401 INVALID_TOKEN', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  test('broken JSON body returns 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  test('invalid login input returns 400 VALIDATION_ERROR with field details', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors[0]).toHaveProperty('field');
  });

  test('the old /api path still works (backward compatibility)', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });
});
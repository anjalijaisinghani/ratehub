const request = require('supertest');
const jwt = require('jsonwebtoken');

// Replace the services with fakes. Here we test ONLY routing, security and validation.
jest.mock('../src/services/adminService');
jest.mock('../src/services/analyticsService');
jest.mock('../src/services/storeService');
jest.mock('../src/services/ownerService');

const adminService = require('../src/services/adminService');
const storeService = require('../src/services/storeService');
const ownerService = require('../src/services/ownerService');
const app = require('../src/app');

const tokenFor = (role, id = 1) => jwt.sign({ id, role }, process.env.JWT_SECRET);
const ALL_ROLES = ['ADMIN', 'USER', 'OWNER'];

// [method, url, the ONLY role allowed]
const endpoints = [
  ['get', '/api/v1/admin/dashboard', 'ADMIN'],
  ['get', '/api/v1/admin/analytics', 'ADMIN'],
  ['get', '/api/v1/admin/users', 'ADMIN'],
  ['get', '/api/v1/admin/users/1', 'ADMIN'],
  ['get', '/api/v1/admin/stores', 'ADMIN'],
    ['get', '/api/v1/admin/stores/1', 'ADMIN'],
  ['put', '/api/v1/admin/stores/1', 'ADMIN'],
  ['post', '/api/v1/admin/users', 'ADMIN'],
  ['post', '/api/v1/admin/stores', 'ADMIN'],
  ['get', '/api/v1/stores', 'USER'],
  ['post', '/api/v1/stores/1/rating', 'USER'],
  ['get', '/api/v1/owner/dashboard', 'OWNER'],
];

const emptyPage = { items: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  // the list controllers expect { items, pagination } from the service
  storeService.listForUser.mockResolvedValue(emptyPage);
  adminService.listStores.mockResolvedValue(emptyPage);
});

describe.each(endpoints)('%s %s (only %s)', (method, url, allowedRole) => {
  test('no token gives 401', async () => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  test.each(ALL_ROLES.filter((r) => r !== allowedRole))('%s role gives 403', async (role) => {
    const res = await request(app)[method](url).set('Authorization', `Bearer ${tokenFor(role)}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      message: 'You do not have permission to do this.',
      code: 'FORBIDDEN',
    });
  });

  test('the allowed role is not blocked by authentication or authorization', async () => {
    const res = await request(app)[method](url).set('Authorization', `Bearer ${tokenFor(allowedRole)}`);
    expect([401, 403]).not.toContain(res.status);
  });
});

describe('request validation on protected routes', () => {
  const admin = () => `Bearer ${tokenFor('ADMIN')}`;
  const user = () => `Bearer ${tokenFor('USER', 5)}`;

  test('admin add-user with an empty body gives 400 and never reaches the service', async () => {
    const res = await request(app).post('/api/v1/admin/users').set('Authorization', admin()).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(adminService.addUser).not.toHaveBeenCalled();
  });

  test('admin add-user with an invalid role gives 400', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', admin())
      .send({
        name: 'Priya Patel Store Owner One',
        email: 'priya@example.com',
        address: 'Pune',
        password: 'Priya@1234',
        role: 'SUPERMAN',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Role must be ADMIN, USER or OWNER');
  });

  test('admin add-user with valid data returns 201 and calls the service', async () => {
    const body = {
      name: 'Priya Patel Store Owner One',
      email: 'priya@example.com',
      address: 'Pune',
      password: 'Priya@1234',
      role: 'OWNER',
    };
    const res = await request(app).post('/api/v1/admin/users').set('Authorization', admin()).send(body);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(adminService.addUser).toHaveBeenCalledWith(body);
  });

  test('admin add-store with a store name under 20 characters gives 400', async () => {
    const res = await request(app)
      .post('/api/v1/admin/stores')
      .set('Authorization', admin())
      .send({ name: 'Short Store', email: 'a@b.com', address: 'Pune', ownerId: 3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Store name must be between 20 and 60 characters');
  });

  test.each([0, 6, 3.5, 'abc'])('rating %p gives 400 and is never saved', async (rating) => {
    const res = await request(app)
      .post('/api/v1/stores/1/rating')
      .set('Authorization', user())
      .send({ rating });
    expect(res.status).toBe(400);
    expect(storeService.submitRating).not.toHaveBeenCalled();
  });

  test('a valid rating is saved for the user in the TOKEN', async () => {
    const res = await request(app)
      .post('/api/v1/stores/1/rating')
      .set('Authorization', user())
      .send({ rating: 4 });
    expect(res.status).toBe(200);
    expect(storeService.submitRating).toHaveBeenCalledWith(5, '1', 4);
  });
});

describe('data isolation (IDOR protection)', () => {
  test('owner dashboard always uses the id from the token, even if the URL asks for another owner', async () => {
    await request(app)
      .get('/api/v1/owner/dashboard?ownerId=99&id=99')
      .set('Authorization', `Bearer ${tokenFor('OWNER', 7)}`);

    expect(ownerService.getDashboard).toHaveBeenCalledTimes(1);
    expect(ownerService.getDashboard.mock.calls[0][0]).toBe(7);
  });

  test('user store list uses the id from the token', async () => {
    await request(app).get('/api/v1/stores?userId=99').set('Authorization', `Bearer ${tokenFor('USER', 5)}`);

    expect(storeService.listForUser.mock.calls[0][0]).toBe(5);
  });
});
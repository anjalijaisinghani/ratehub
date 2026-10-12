const request = require('supertest');
const jwt = require('jsonwebtoken');

// Replace the services with fakes. Here we test ONLY routing, security and validation.
jest.mock('../src/services/adminService');
jest.mock('../src/services/analyticsService');
jest.mock('../src/services/storeService');
jest.mock('../src/services/ownerService');
jest.mock('../src/services/reviewService');
jest.mock('../src/services/reviewVoteService');
jest.mock('../src/services/replyService');

const adminService = require('../src/services/adminService');
const storeService = require('../src/services/storeService');
const ownerService = require('../src/services/ownerService');
const reviewService = require('../src/services/reviewService');
const reviewVoteService = require('../src/services/reviewVoteService');
const replyService = require('../src/services/replyService');
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
    ['get', '/api/v1/stores/nearby', 'USER'],
      ['get', '/api/v1/stores/1', 'USER'],
  ['get', '/api/v1/stores/1/reviews', 'USER'],
  ['put', '/api/v1/stores/1/review', 'USER'],
  ['delete', '/api/v1/stores/1/review', 'USER'],
    ['put', '/api/v1/stores/1/reviews/1/helpful', 'USER'],
  ['delete', '/api/v1/stores/1/reviews/1/helpful', 'USER'],
  ['get', '/api/v1/owner/reviews', 'OWNER'],
  ['put', '/api/v1/owner/reviews/1/reply', 'OWNER'],
  ['delete', '/api/v1/owner/reviews/1/reply', 'OWNER'],
  ['put', '/api/v1/admin/stores/1/verification', 'ADMIN'],
  ['post', '/api/v1/stores/1/rating', 'USER'],
  ['get', '/api/v1/owner/dashboard', 'OWNER'],
];

const emptyPage = { items: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  // the list controllers expect { items, pagination } from the service
  storeService.listForUser.mockResolvedValue(emptyPage);
    storeService.listNearby.mockResolvedValue(emptyPage);
      reviewService.listReviews.mockResolvedValue(emptyPage);
  reviewService.saveReview.mockResolvedValue({ review: {}, created: true });
    reviewVoteService.setHelpful.mockResolvedValue({ helpfulCount: 1, iVoted: true });
  replyService.listForOwner.mockResolvedValue(emptyPage);
  replyService.saveReply.mockResolvedValue({ reply: {}, created: true });
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


describe('review request validation', () => {
  const asUser = () => `Bearer ${tokenFor('USER', 5)}`;
  const good = 'The staff were friendly and quick.';

  test.each([
    ['text too short', { rating: 4, text: 'Too short' }],
    ['text too long', { rating: 4, text: 'x'.repeat(1001) }],
    ['text missing', { rating: 4 }],
    ['text is not a string', { rating: 4, text: 12345678901 }],
    ['rating missing', { text: good }],
    ['rating 6', { rating: 6, text: good }],
    ['rating 3.5', { rating: 3.5, text: good }],
  ])('%s gives 400 and nothing is saved', async (_label, body) => {
    const res = await request(app).put('/api/v1/stores/1/review').set('Authorization', asUser()).send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(reviewService.saveReview).not.toHaveBeenCalled();
  });

  test('a valid review reaches the service with the user from the TOKEN (a userId in the body is ignored)', async () => {
    const res = await request(app)
      .put('/api/v1/stores/1/review')
      .set('Authorization', asUser())
      .send({ rating: 4, text: good, userId: 99 });
    expect(res.status).toBe(201);
    expect(reviewService.saveReview).toHaveBeenCalledWith(5, '1', { rating: 4, text: good });
  });
});


describe('reply, vote and verification requests', () => {
  const asOwner = () => `Bearer ${tokenFor('OWNER', 7)}`;
  const asUser = () => `Bearer ${tokenFor('USER', 5)}`;
  const asAdmin = () => `Bearer ${tokenFor('ADMIN', 1)}`;

  test.each([
    ['reply too short', { text: 'Hi' }],
    ['reply too long', { text: 'x'.repeat(1001) }],
    ['reply missing', {}],
    ['reply not a string', { text: 123456789 }],
  ])('%s gives 400 and nothing is saved', async (_label, body) => {
    const res = await request(app).put('/api/v1/owner/reviews/3/reply').set('Authorization', asOwner()).send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(replyService.saveReply).not.toHaveBeenCalled();
  });

  test('a valid reply reaches the service with the OWNER from the token', async () => {
    const res = await request(app)
      .put('/api/v1/owner/reviews/3/reply')
      .set('Authorization', asOwner())
      .send({ text: 'Thank you for your feedback!', ownerId: 99 });
    expect(res.status).toBe(201);
    expect(replyService.saveReply).toHaveBeenCalledWith(7, '3', 'Thank you for your feedback!');
  });

  test('the owner review list always uses the owner id from the token', async () => {
    await request(app).get('/api/v1/owner/reviews?ownerId=99').set('Authorization', asOwner());
    expect(replyService.listForOwner.mock.calls[0][0]).toBe(7);
  });

  test('a helpful vote uses the user from the token', async () => {
    const res = await request(app).put('/api/v1/stores/2/reviews/3/helpful').set('Authorization', asUser());
    expect(res.status).toBe(200);
    expect(reviewVoteService.setHelpful).toHaveBeenCalledWith(5, '2', '3', true);

    await request(app).delete('/api/v1/stores/2/reviews/3/helpful').set('Authorization', asUser());
    expect(reviewVoteService.setHelpful).toHaveBeenLastCalledWith(5, '2', '3', false);
  });

  test.each([['yes'], [1], [null], [undefined], ['true']])('verified = %p gives 400 and nothing changes', async (verified) => {
    const res = await request(app)
      .put('/api/v1/admin/stores/4/verification')
      .set('Authorization', asAdmin())
      .send({ verified });
    expect(res.status).toBe(400);
    expect(adminService.setStoreVerification).not.toHaveBeenCalled();
  });

  test('verified true or false reaches the service with the ADMIN from the token', async () => {
    const on = await request(app)
      .put('/api/v1/admin/stores/4/verification')
      .set('Authorization', asAdmin())
      .send({ verified: true });
    expect(on.status).toBe(200);
    expect(adminService.setStoreVerification).toHaveBeenCalledWith('4', true, 1);

    await request(app).put('/api/v1/admin/stores/4/verification').set('Authorization', asAdmin()).send({ verified: false });
    expect(adminService.setStoreVerification).toHaveBeenLastCalledWith('4', false, 1);
  });
});
const express = require('express');
const request = require('supertest');
const { createLimiter } = require('../src/middleware/rateLimiters');
const { errorHandler } = require('../src/middleware/errorHandler');

// A tiny app, just to test the limiter in isolation
const buildApp = (limiterOptions) => {
  const app = express();
  app.use(express.json());
  app.use(createLimiter(limiterOptions));
  app.post('/try', (req, res) => res.status(req.body.ok ? 200 : 401).json({ ok: !!req.body.ok }));
  app.use(errorHandler);
  return app;
};

test('blocks after the limit, using the standard error format', async () => {
  const app = buildApp({ windowMs: 60000, limit: 2, message: 'Slow down', force: true });

  expect((await request(app).post('/try').send({ ok: true })).status).toBe(200);
  expect((await request(app).post('/try').send({ ok: true })).status).toBe(200);

  const blocked = await request(app).post('/try').send({ ok: true });
  expect(blocked.status).toBe(429);
  expect(blocked.body).toEqual({ success: false, message: 'Slow down', code: 'RATE_LIMITED' });
  expect(blocked.headers['retry-after']).toBe('60');
});

test('with skipSuccessfulRequests, only FAILED requests count (the login rule)', async () => {
  const app = buildApp({ windowMs: 60000, limit: 2, message: 'Blocked', skipSuccessfulRequests: true, force: true });

  for (let i = 0; i < 5; i++) {
    expect((await request(app).post('/try').send({ ok: true })).status).toBe(200); // never counted
  }
  expect((await request(app).post('/try').send({ ok: false })).status).toBe(401);
  expect((await request(app).post('/try').send({ ok: false })).status).toBe(401);
  expect((await request(app).post('/try').send({ ok: false })).status).toBe(429); // 3rd failure
});

test('limiting is switched off during tests unless forced', async () => {
  const app = buildApp({ windowMs: 60000, limit: 1, message: 'Blocked' });
  for (let i = 0; i < 4; i++) {
    expect((await request(app).post('/try').send({ ok: true })).status).toBe(200);
  }
});
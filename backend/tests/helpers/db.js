const bcrypt = require('bcryptjs');
const request = require('supertest');
const db = require('../../src/config/db');
const mailService = require('../../src/services/mailService');

const PASSWORD = 'Test@1234';
const COOKIE_NAME = 'rh_refresh';

// Safety net: tests delete data, so they must NEVER run against a real database
const assertTestDatabase = () => {
  if (!/_test$/.test(process.env.DB_NAME || '')) {
    throw new Error(`Refusing to run: "${process.env.DB_NAME}" is not a test database (name must end in _test)`);
  }
};

// Empty all tables (children first, because of foreign keys) and the fake mailbox
const resetDb = async () => {
  assertTestDatabase();
  await db.query('DELETE FROM auth_tokens');
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM ratings');
  await db.query('DELETE FROM stores');
  await db.query('DELETE FROM users');
  mailService.clearOutbox();
};

const closeDb = () => db.end();

let counter = 0;

// Inserts an ACTIVE, verified user directly (fast: low bcrypt cost, no HTTP)
const createUser = async ({ label = 'User', role = 'USER', address = '1 Test Street, Pune' } = {}) => {
  assertTestDatabase();
  counter += 1;
  const email = `${label.toLowerCase()}${counter}@example.com`;
  const name = `${label} Integration Test Account`; // always 20+ characters
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [result] = await db.query(
    'INSERT INTO users (name, email, password_hash, address, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, hash, address, role, new Date()]
  );
  return { id: result.insertId, name, email, address, role, password: PASSWORD };
};

const createStore = async ({ ownerId, label = 'Fresh' }) => {
  assertTestDatabase();
  counter += 1;
  const name = `${label} Integration Test Store`;
  const [result] = await db.query(
    'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
    [name, `store${counter}@example.com`, '78 Station Road, Pune', ownerId]
  );
  return { id: result.insertId, name, ownerId };
};

// Pulls "rh_refresh=<value>" out of a response's Set-Cookie header
const getRefreshCookie = (res) => {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return raw ? raw.split(';')[0] : null;
};

// Logs in through the REAL API. Returns the access token AND the refresh cookie.
const loginFull = async (app, user, password = user.password) => {
  const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password });
  return { res, accessToken: res.body?.data?.accessToken, cookie: getRefreshCookie(res) };
};

const loginAs = async (app, user) => {
  const { res, accessToken } = await loginFull(app, user);
  if (res.status !== 200) throw new Error(`Test login failed for ${user.email}: ${res.status}`);
  return accessToken;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// ----- Fake mailbox helpers -----
const mailsTo = (email) => mailService.outbox.filter((m) => m.to === email);
const tokenFromMail = (mail) => mail.text.match(/token=([0-9a-f]{64})/)[1];

// Pretend the emailed links were created `seconds` ago (to get past the cooldown)
const ageTokens = (seconds) =>
  db.query('UPDATE auth_tokens SET created_at = ?', [new Date(Date.now() - seconds * 1000)]);

module.exports = {
  PASSWORD,
  resetDb,
  closeDb,
  createUser,
  createStore,
  loginAs,
  loginFull,
  getRefreshCookie,
  auth,
  mailsTo,
  tokenFromMail,
  ageTokens,
};
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { resetDb, closeDb, createUser, loginFull, getRefreshCookie, auth } = require('../helpers/db');

let user;

beforeEach(async () => {
  await resetDb();
  user = await createUser({ label: 'Sessioner' });
});
afterAll(closeDb);

const refresh = (cookie) => request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
const dbUser = async () => (await db.query('SELECT * FROM users WHERE id = ?', [user.id]))[0][0];
const tokenRows = async () => (await db.query('SELECT * FROM refresh_tokens ORDER BY id'))[0];

describe('login creates a session', () => {
  test('stores only a hash of the refresh token, and the access token belongs to that session', async () => {
    const { res, accessToken, cookie } = await loginFull(app, user);
    expect(res.status).toBe(200);

    const raw = cookie.split('=')[1];
    const rows = await tokenRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_hash).not.toBe(raw);
    expect(JSON.stringify(rows[0])).not.toContain(raw);

    expect(jwt.decode(accessToken).sid).toBe(rows[0].family_id);
  });

  test('records the last login time', async () => {
    expect((await dbUser()).last_login_at).toBeNull();
    await loginFull(app, user);
    const row = await dbUser();
    expect(Math.abs(Date.now() - new Date(row.last_login_at).getTime())).toBeLessThan(60 * 1000);
  });
});

describe('refresh rotation', () => {
  test('gives a new access token and a NEW cookie; the new token works on a protected route', async () => {
    const { cookie } = await loginFull(app, user);

    const res = await refresh(cookie);
    expect(res.status).toBe(200);
    const newCookie = getRefreshCookie(res);
    expect(newCookie).not.toBe(cookie);

    const stores = await request(app).get('/api/v1/stores').set(auth(res.body.data.accessToken));
    expect(stores.status).toBe(200);
  });

  test('reusing the old token right away is refused, but the new one still works (race protection)', async () => {
    const { cookie } = await loginFull(app, user);
    const first = await refresh(cookie);
    const newCookie = getRefreshCookie(first);

    const again = await refresh(cookie);
    expect(again.status).toBe(401);
    expect(again.body.code).toBe('INVALID_REFRESH_TOKEN');

    expect((await refresh(newCookie)).status).toBe(200);
  });

  test('REUSE after the grace period is treated as theft: the whole session dies', async () => {
    const { cookie } = await loginFull(app, user);
    const first = await refresh(cookie);
    const newCookie = getRefreshCookie(first);

    // Pretend the rotation happened a minute ago
    await db.query("UPDATE refresh_tokens SET revoked_at = ? WHERE revoked_reason = 'rotated'", [
      new Date(Date.now() - 60 * 1000),
    ]);

    const stolen = await refresh(cookie);
    expect(stolen.status).toBe(401);
    expect(stolen.body.code).toBe('REFRESH_TOKEN_REUSED');

    // The legitimate (newest) token is dead too
    expect((await refresh(newCookie)).status).toBe(401);
    const rows = await tokenRows();
    expect(rows.every((r) => r.revoked_at !== null)).toBe(true);
  });

  test('an expired refresh token is rejected', async () => {
    const { cookie } = await loginFull(app, user);
    await db.query('UPDATE refresh_tokens SET expires_at = ?', [new Date(Date.now() - 1000)]);

    const res = await refresh(cookie);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  test('a made-up cookie is rejected', async () => {
    expect((await refresh('rh_refresh=not-a-real-token')).status).toBe(401);
  });
});

describe('logout', () => {
  test('after logout the refresh token no longer works, and the cookie is cleared', async () => {
    const { cookie } = await loginFull(app, user);

    const out = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect(out.headers['set-cookie'].find((c) => c.startsWith('rh_refresh=;'))).toBeDefined();

    expect((await refresh(cookie)).status).toBe(401);
  });

  test('logging out only ends THIS device', async () => {
    const phone = await loginFull(app, user);
    const laptop = await loginFull(app, user);

    await request(app).post('/api/v1/auth/logout').set('Cookie', phone.cookie);

    expect((await refresh(phone.cookie)).status).toBe(401);
    expect((await refresh(laptop.cookie)).status).toBe(200);
  });

  test('logout-all ends every device', async () => {
    const phone = await loginFull(app, user);
    const laptop = await loginFull(app, user);

    const res = await request(app).post('/api/v1/auth/logout-all').set(auth(phone.accessToken));
    expect(res.status).toBe(200);

    expect((await refresh(phone.cookie)).status).toBe(401);
    expect((await refresh(laptop.cookie)).status).toBe(401);
  });
});

describe('change password and sessions', () => {
  test('logs out the OTHER device, keeps the current one, and records the change time', async () => {
    const current = await loginFull(app, user);
    const other = await loginFull(app, user);

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set(auth(current.accessToken))
      .send({ currentPassword: user.password, newPassword: 'Brand@New99' });
    expect(res.status).toBe(200);

    expect((await refresh(other.cookie)).status).toBe(401);
    expect((await refresh(current.cookie)).status).toBe(200);
    expect((await dbUser()).password_changed_at).not.toBeNull();
  });
});

describe('account status', () => {
  test('a suspended user cannot log in (403 ACCOUNT_DISABLED) with the right password', async () => {
    await db.query("UPDATE users SET status = 'SUSPENDED' WHERE id = ?", [user.id]);
    const { res } = await loginFull(app, user);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  test('suspending a logged-in user stops their refresh and ends the session', async () => {
    const { cookie } = await loginFull(app, user);
    await db.query("UPDATE users SET status = 'SUSPENDED' WHERE id = ?", [user.id]);

    expect((await refresh(cookie)).status).toBe(401);
    expect((await tokenRows())[0].revoked_reason).toBe('account_disabled');
  });
});

describe('login lockout', () => {
  const wrong = (email) => request(app).post('/api/v1/auth/login').send({ email, password: 'Wrong@1234' });

  test('5 wrong passwords lock the account, even for the correct password', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await wrong(user.email)).status).toBe(401);
    }

    const row = await dbUser();
    expect(row.failed_login_attempts).toBe(5);
    expect(new Date(row.locked_until).getTime()).toBeGreaterThan(Date.now());

    const { res } = await loginFull(app, user); // CORRECT password
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('after the lock expires the correct password works and the counters reset', async () => {
    for (let i = 0; i < 5; i++) await wrong(user.email);
    await db.query('UPDATE users SET locked_until = ? WHERE id = ?', [new Date(Date.now() - 1000), user.id]);

    const { res } = await loginFull(app, user);
    expect(res.status).toBe(200);

    const row = await dbUser();
    expect(row.failed_login_attempts).toBe(0);
    expect(row.locked_until).toBeNull();
  });

  test('after the lock expires, a wrong password starts counting from 1 (not instantly re-locked)', async () => {
    for (let i = 0; i < 5; i++) await wrong(user.email);
    await db.query('UPDATE users SET locked_until = ? WHERE id = ?', [new Date(Date.now() - 1000), user.id]);

    expect((await wrong(user.email)).status).toBe(401);
    const row = await dbUser();
    expect(row.failed_login_attempts).toBe(1);
    expect(row.locked_until).toBeNull();
  });

  test('a successful login before the limit forgets earlier failures', async () => {
    await wrong(user.email);
    await wrong(user.email);
    expect((await dbUser()).failed_login_attempts).toBe(2);

    const { res } = await loginFull(app, user);
    expect(res.status).toBe(200);
    expect((await dbUser()).failed_login_attempts).toBe(0);
  });

  test('failed attempts on one account never lock another account', async () => {
    const other = await createUser({ label: 'Bystander' });
    for (let i = 0; i < 5; i++) await wrong(user.email);

    const { res } = await loginFull(app, other);
    expect(res.status).toBe(200);
  });
});
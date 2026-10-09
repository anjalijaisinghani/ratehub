const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const mailService = require('../../src/services/mailService');
const {
  resetDb,
  closeDb,
  createUser,
  loginFull,
  mailsTo,
  tokenFromMail,
  ageTokens,
} = require('../helpers/db');

beforeEach(resetDb);
afterAll(closeDb);

const api = (path, body) => request(app).post(`/api/v1/auth/${path}`).send(body);

const signupBody = (email = 'newbie@example.com') => ({
  name: 'Newbie Test User Account',
  email,
  address: '12 MG Road, Pune',
  password: 'Newbie@1234',
});

const dbUser = async (email) => (await db.query('SELECT * FROM users WHERE email = ?', [email]))[0][0];
const tokenRows = async () => (await db.query('SELECT * FROM auth_tokens ORDER BY id'))[0];

describe('email verification', () => {
  test('signup creates a PENDING account and emails ONE link; only a hash is stored', async () => {
    const res = await api('signup', signupBody());
    expect(res.status).toBe(201);

    const row = await dbUser('newbie@example.com');
    expect(row.status).toBe('PENDING');
    expect(row.email_verified_at).toBeNull();

    const mails = mailsTo('newbie@example.com');
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe('Verify your RateHub email');
    const raw = tokenFromMail(mails[0]);

    const tokens = await tokenRows();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('EMAIL_VERIFY');
    expect(tokens[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens[0].token_hash).not.toBe(raw);

    const hours = (new Date(tokens[0].expires_at) - Date.now()) / 3600000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
  });

  test('login is blocked until the email is verified, then works', async () => {
    await api('signup', signupBody());

    const blocked = await api('login', { email: 'newbie@example.com', password: 'Newbie@1234' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(blocked.headers['set-cookie']).toBeUndefined();

    const verify = await api('verify-email', { token: tokenFromMail(mailsTo('newbie@example.com')[0]) });
    expect(verify.status).toBe(200);

    const row = await dbUser('newbie@example.com');
    expect(row.status).toBe('ACTIVE');
    expect(row.email_verified_at).not.toBeNull();

    const ok = await api('login', { email: 'newbie@example.com', password: 'Newbie@1234' });
    expect(ok.status).toBe(200);
  });

  test('a wrong password on a PENDING account reveals nothing about its status', async () => {
    await api('signup', signupBody());
    const res = await api('login', { email: 'newbie@example.com', password: 'Wrong@1234' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('the link works only once', async () => {
    await api('signup', signupBody());
    const token = tokenFromMail(mailsTo('newbie@example.com')[0]);

    expect((await api('verify-email', { token })).status).toBe(200);
    const again = await api('verify-email', { token });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('TOKEN_USED');
  });

  test('an expired link is refused and the account stays PENDING', async () => {
    await api('signup', signupBody());
    const token = tokenFromMail(mailsTo('newbie@example.com')[0]);
    await db.query('UPDATE auth_tokens SET expires_at = ?', [new Date(Date.now() - 1000)]);

    const res = await api('verify-email', { token });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
    expect((await dbUser('newbie@example.com')).status).toBe('PENDING');
  });

  test('malformed tokens are rejected by validation; unknown valid-looking ones by the service', async () => {
    const malformed = await api('verify-email', { token: 'hello' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');

    const unknown = await api('verify-email', { token: 'f'.repeat(64) });
    expect(unknown.status).toBe(400);
    expect(unknown.body.code).toBe('INVALID_TOKEN');
  });

  test('a suspended account does not become active when its link is clicked', async () => {
    await api('signup', signupBody());
    const token = tokenFromMail(mailsTo('newbie@example.com')[0]);
    await db.query("UPDATE users SET status = 'SUSPENDED' WHERE email = 'newbie@example.com'");

    await api('verify-email', { token });
    expect((await dbUser('newbie@example.com')).status).toBe('SUSPENDED');
  });
});

describe('resend verification', () => {
  test('sends a new link, and the old link stops working', async () => {
    await api('signup', signupBody());
    const oldToken = tokenFromMail(mailsTo('newbie@example.com')[0]);
    await ageTokens(120); // get past the 60 second cooldown

    const res = await api('resend-verification', { email: 'newbie@example.com' });
    expect(res.status).toBe(200);

    const mails = mailsTo('newbie@example.com');
    expect(mails).toHaveLength(2);
    const newToken = tokenFromMail(mails[1]);
    expect(newToken).not.toBe(oldToken);

    expect((await api('verify-email', { token: oldToken })).body.code).toBe('TOKEN_USED');
    expect((await api('verify-email', { token: newToken })).status).toBe(200);
  });

  test('the cooldown stops an instant second email (inbox flooding)', async () => {
    await api('signup', signupBody());
    const res = await api('resend-verification', { email: 'newbie@example.com' });
    expect(res.status).toBe(200);
    expect(mailsTo('newbie@example.com')).toHaveLength(1); // only the signup email
  });

  test('gives the IDENTICAL answer for pending, unknown and already-verified accounts', async () => {
    await api('signup', signupBody());
    await ageTokens(120);
    const verified = await createUser({ label: 'Verified' });

    const pending = await api('resend-verification', { email: 'newbie@example.com' });
    const unknown = await api('resend-verification', { email: 'ghost@example.com' });
    const active = await api('resend-verification', { email: verified.email });

    expect(unknown.status).toBe(200);
    expect(active.status).toBe(200);
    expect(unknown.body).toEqual(pending.body);
    expect(active.body).toEqual(pending.body);

    expect(mailsTo('ghost@example.com')).toHaveLength(0);
    expect(mailsTo(verified.email)).toHaveLength(0);
  });
});

describe('forgot password', () => {
  test('gives the IDENTICAL answer whether or not the account exists', async () => {
    const user = await createUser({ label: 'Forgetful' });

    const known = await api('forgot-password', { email: user.email });
    const unknown = await api('forgot-password', { email: 'ghost@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(mailsTo(user.email)).toHaveLength(1);
    expect(mailsTo('ghost@example.com')).toHaveLength(0);
  });

  test('the email holds a link that expires in about an hour; only a hash is stored', async () => {
    const user = await createUser({ label: 'Forgetful' });
    await api('forgot-password', { email: user.email });

    const mail = mailsTo(user.email)[0];
    expect(mail.subject).toBe('Reset your RateHub password');
    expect(mail.text).toContain('/reset-password?token=');

    const [row] = await tokenRows();
    expect(row.type).toBe('PASSWORD_RESET');
    expect(row.token_hash).not.toBe(tokenFromMail(mail));
    const minutes = (new Date(row.expires_at) - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThan(61);
  });

  test('suspended and deactivated accounts get no email, with the same answer', async () => {
    const suspended = await createUser({ label: 'Suspended' });
    const deactivated = await createUser({ label: 'Deactivated' });
    await db.query("UPDATE users SET status = 'SUSPENDED' WHERE id = ?", [suspended.id]);
    await db.query("UPDATE users SET status = 'DEACTIVATED' WHERE id = ?", [deactivated.id]);

    const a = await api('forgot-password', { email: suspended.email });
    const b = await api('forgot-password', { email: deactivated.email });

    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(mailService.outbox).toHaveLength(0);
  });

  test('the cooldown stops a second email right away', async () => {
    const user = await createUser({ label: 'Forgetful' });
    await api('forgot-password', { email: user.email });
    await api('forgot-password', { email: user.email });
    expect(mailsTo(user.email)).toHaveLength(1);
  });

  test('an invalid email format is a 400', async () => {
    expect((await api('forgot-password', { email: 'nope' })).status).toBe(400);
  });
});

describe('reset password', () => {
  const requestReset = async (user) => {
    await api('forgot-password', { email: user.email });
    const mails = mailsTo(user.email);
    return tokenFromMail(mails[mails.length - 1]);
  };

    test('sets the new password, ends every session and clears a lockout', async () => {
    const user = await createUser({ label: 'Resetter' });
    const device = await loginFull(app, user);
    await db.query('UPDATE users SET failed_login_attempts = 5, locked_until = ? WHERE id = ?', [
      new Date(Date.now() + 10 * 60 * 1000),
      user.id,
    ]);

    const token = await requestReset(user);
    const res = await api('reset-password', { token, newPassword: 'Brand@New99' });
    expect(res.status).toBe(200);

    // Check the account state NOW, before any login attempt below can change the counters
    const row = (await db.query('SELECT * FROM users WHERE id = ?', [user.id]))[0][0];
    expect(row.password_changed_at).not.toBeNull();
    expect(row.failed_login_attempts).toBe(0);
    expect(row.locked_until).toBeNull();

    // The new password works (so the lock really is gone); the old one does not
    expect((await loginFull(app, user, 'Brand@New99')).res.status).toBe(200);
    expect((await loginFull(app, user, user.password)).res.status).toBe(401);

    // The device that was logged in before the reset is logged out
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', device.cookie);
    expect(refresh.status).toBe(401);
  });
  
  test('the link works only once', async () => {
    const user = await createUser({ label: 'Resetter' });
    const token = await requestReset(user);

    expect((await api('reset-password', { token, newPassword: 'Brand@New99' })).status).toBe(200);
    const again = await api('reset-password', { token, newPassword: 'Another@Pass1' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('TOKEN_USED');
  });

  test('a weak new password is rejected WITHOUT using up the link', async () => {
    const user = await createUser({ label: 'Resetter' });
    const token = await requestReset(user);

    const weak = await api('reset-password', { token, newPassword: 'weakpass' });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe('VALIDATION_ERROR');

    expect((await api('reset-password', { token, newPassword: 'Brand@New99' })).status).toBe(200);
  });

  test('requesting a newer link cancels the older one', async () => {
    const user = await createUser({ label: 'Resetter' });
    const first = await requestReset(user);
    await ageTokens(120);
    const second = await requestReset(user);
    expect(second).not.toBe(first);

    expect((await api('reset-password', { token: first, newPassword: 'Brand@New99' })).body.code).toBe('TOKEN_USED');
    expect((await api('reset-password', { token: second, newPassword: 'Brand@New99' })).status).toBe(200);
  });

  test('an expired link is refused and the password is unchanged', async () => {
    const user = await createUser({ label: 'Resetter' });
    const token = await requestReset(user);
    await db.query('UPDATE auth_tokens SET expires_at = ?', [new Date(Date.now() - 1000)]);

    const res = await api('reset-password', { token, newPassword: 'Brand@New99' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
    expect((await loginFull(app, user)).res.status).toBe(200); // old password still works
  });

  test('a reset link cannot verify an email, and a verify link cannot reset a password', async () => {
    const user = await createUser({ label: 'Resetter' });
    const resetToken = await requestReset(user);
    expect((await api('verify-email', { token: resetToken })).body.code).toBe('INVALID_TOKEN');

    await api('signup', signupBody());
    const verifyToken = tokenFromMail(mailsTo('newbie@example.com')[0]);
    const res = await api('reset-password', { token: verifyToken, newPassword: 'Brand@New99' });
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  test('an account suspended after the link was sent cannot use it', async () => {
    const user = await createUser({ label: 'Resetter' });
    const token = await requestReset(user);
    await db.query("UPDATE users SET status = 'SUSPENDED' WHERE id = ?", [user.id]);

    const res = await api('reset-password', { token, newPassword: 'Brand@New99' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  test('a PENDING user who resets proves their email and becomes ACTIVE', async () => {
    await api('signup', signupBody());
    await api('forgot-password', { email: 'newbie@example.com' });
    const resetMail = mailsTo('newbie@example.com').find((m) => m.subject.startsWith('Reset'));

    const res = await api('reset-password', { token: tokenFromMail(resetMail), newPassword: 'Brand@New99' });
    expect(res.status).toBe(200);

    const row = await dbUser('newbie@example.com');
    expect(row.status).toBe('ACTIVE');
    expect(row.email_verified_at).not.toBeNull();
  });
});

describe('accounts created by an admin', () => {
  test('are active and verified immediately (no email step)', async () => {
    const admin = await createUser({ label: 'Admin', role: 'ADMIN' });
    const { accessToken } = await loginFull(app, admin);

    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Priya Patel Store Owner One',
        email: 'priya@example.com',
        address: '45 FC Road, Pune',
        password: 'Priya@1234',
        role: 'OWNER',
      });
    expect(res.status).toBe(201);

    const row = await dbUser('priya@example.com');
    expect(row.status).toBe('ACTIVE');
    expect(row.email_verified_at).not.toBeNull();
    expect((await api('login', { email: 'priya@example.com', password: 'Priya@1234' })).status).toBe(200);
  });
});
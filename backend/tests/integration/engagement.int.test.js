const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { resetDb, closeDb, createUser, createStore, createReview, loginAs, auth } = require('../helpers/db');

const GOOD = 'The staff were friendly and the service was quick.';
const REPLY = 'Thank you for visiting us. We are glad you liked it!';

let admin, owner1, owner2, alice, bob, carol, store1, store2, tok;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ label: 'Admin', role: 'ADMIN' });
  owner1 = await createUser({ label: 'OwnerOne', role: 'OWNER' });
  owner2 = await createUser({ label: 'OwnerTwo', role: 'OWNER' });
  alice = await createUser({ label: 'Alice' });
  bob = await createUser({ label: 'Bob' });
  carol = await createUser({ label: 'Carol' });
  store1 = await createStore({ ownerId: owner1.id, label: 'First' });
  store2 = await createStore({ ownerId: owner2.id, label: 'Second' });

  tok = {
    admin: await loginAs(app, admin),
    owner1: await loginAs(app, owner1),
    owner2: await loginAs(app, owner2),
    alice: await loginAs(app, alice),
    bob: await loginAs(app, bob),
    carol: await loginAs(app, carol),
  };
});
afterAll(closeDb);

const vote = (token, storeId, reviewId) =>
  request(app).put(`/api/v1/stores/${storeId}/reviews/${reviewId}/helpful`).set(auth(token));
const unvote = (token, storeId, reviewId) =>
  request(app).delete(`/api/v1/stores/${storeId}/reviews/${reviewId}/helpful`).set(auth(token));
const reviews = (token, storeId, query = '') =>
  request(app).get(`/api/v1/stores/${storeId}/reviews${query}`).set(auth(token));
const ownerList = (token, query = '') => request(app).get(`/api/v1/owner/reviews${query}`).set(auth(token));
const reply = (token, reviewId, text) =>
  request(app).put(`/api/v1/owner/reviews/${reviewId}/reply`).set(auth(token)).send({ text });
const unreply = (token, reviewId) => request(app).delete(`/api/v1/owner/reviews/${reviewId}/reply`).set(auth(token));
const verify = (token, storeId, body) =>
  request(app).put(`/api/v1/admin/stores/${storeId}/verification`).set(auth(token)).send(body);

const voteCount = async () => (await db.query('SELECT COUNT(*) AS n FROM review_votes'))[0][0].n;
const ratingRow = async (id) => (await db.query('SELECT * FROM ratings WHERE id = ?', [id]))[0][0];
const storeRow = async (id) => (await db.query('SELECT * FROM stores WHERE id = ?', [id]))[0][0];
const firstNames = (res) => res.body.data.map((r) => r.reviewerName.split(' ')[0]);

// ========================================================================
describe('helpful votes', () => {
  let aliceReview;

  beforeEach(async () => {
    aliceReview = await createReview({ userId: alice.id, storeId: store1.id, rating: 5, text: GOOD });
  });

  test('marking helpful counts once, and repeating the request changes nothing', async () => {
    const first = await vote(tok.bob, store1.id, aliceReview);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ helpfulCount: 1, iVoted: true });

    const again = await vote(tok.bob, store1.id, aliceReview);
    expect(again.status).toBe(200);
    expect(again.body.data.helpfulCount).toBe(1);
    expect(await voteCount()).toBe(1);
  });

  test('two requests at the same instant still make one vote (UNIQUE key)', async () => {
    await Promise.all([vote(tok.bob, store1.id, aliceReview), vote(tok.bob, store1.id, aliceReview)]);
    expect(await voteCount()).toBe(1);
  });

  test('different users add up, and each sees only their OWN vote as theirs', async () => {
    await vote(tok.bob, store1.id, aliceReview);
    await vote(tok.carol, store1.id, aliceReview);

    const asBob = (await reviews(tok.bob, store1.id)).body.data[0];
    const asAlice = (await reviews(tok.alice, store1.id)).body.data[0];
    expect(asBob).toMatchObject({ helpfulCount: 2, iVoted: true });
    expect(asAlice).toMatchObject({ helpfulCount: 2, iVoted: false, isMine: true });
  });

  test('taking the vote back removes it, and doing it twice is fine', async () => {
    await vote(tok.bob, store1.id, aliceReview);
    await vote(tok.carol, store1.id, aliceReview);

    const removed = await unvote(tok.bob, store1.id, aliceReview);
    expect(removed.body.data).toEqual({ helpfulCount: 1, iVoted: false });
    expect((await unvote(tok.bob, store1.id, aliceReview)).body.data.helpfulCount).toBe(1);
    expect(await voteCount()).toBe(1);
  });

  test('you cannot vote on your own review (403)', async () => {
    const res = await vote(tok.alice, store1.id, aliceReview);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANNOT_VOTE_OWN_REVIEW');
    expect(await voteCount()).toBe(0);
  });

  test('wrong store, unknown review, junk ids, stars-only rating and hidden store are all 404', async () => {
    const starsOnly = await createReview({ userId: carol.id, storeId: store1.id, rating: 3 });
    await db.query("UPDATE stores SET status = 'INACTIVE' WHERE id = ?", [store2.id]);
    const hiddenReview = await createReview({ userId: alice.id, storeId: store2.id, rating: 4, text: GOOD });

    for (const [storeId, reviewId] of [
      [store2.id, aliceReview], // the review is in store 1, not store 2
      [store1.id, 999999],
      [store1.id, 'abc'],
      ['abc', aliceReview],
      [store1.id, starsOnly],
      [store2.id, hiddenReview],
    ]) {
      const res = await vote(tok.bob, storeId, reviewId);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('REVIEW_NOT_FOUND');
    }
    expect(await voteCount()).toBe(0);
  });

  test('"most helpful" sorting', async () => {
    const bobReview = await createReview({ userId: bob.id, storeId: store1.id, rating: 3, text: 'It was an okay experience overall.' });
    const carolReview = await createReview({ userId: carol.id, storeId: store1.id, rating: 4, text: 'Good prices and a clean store.' });

    await vote(tok.alice, store1.id, bobReview);
    await vote(tok.carol, store1.id, bobReview); // Bob: 2 votes
    await vote(tok.alice, store1.id, carolReview); // Carol: 1 vote, Alice: 0 votes

    expect(firstNames(await reviews(tok.alice, store1.id, '?sortBy=helpful'))).toEqual(['Bob', 'Carol', 'Alice']);
    expect(firstNames(await reviews(tok.alice, store1.id, '?sortBy=helpful&order=asc'))).toEqual(['Alice', 'Carol', 'Bob']);
  });

  test('deleting a review removes its votes too', async () => {
    await vote(tok.bob, store1.id, aliceReview);
    expect(await voteCount()).toBe(1);

    await request(app).delete(`/api/v1/stores/${store1.id}/review`).set(auth(tok.alice));
    expect(await voteCount()).toBe(0);
  });

  test('my own review on the store page shows how many found it helpful', async () => {
    await vote(tok.bob, store1.id, aliceReview);
    const page = await request(app).get(`/api/v1/stores/${store1.id}`).set(auth(tok.alice));
    expect(page.body.data.myReview.helpfulCount).toBe(1);
  });
});

// ========================================================================
describe('owner replies', () => {
  let aliceReview, bobReview;

  beforeEach(async () => {
    aliceReview = await createReview({ userId: alice.id, storeId: store1.id, rating: 5, text: GOOD });
    bobReview = await createReview({ userId: bob.id, storeId: store1.id, rating: 2, text: 'Waiting time was far too long.' });
  });

  test('an owner sees the reviews of THEIR store only, with no reviewer email', async () => {
    await createReview({ userId: carol.id, storeId: store2.id, rating: 4, text: 'Nice little shop nearby.' });

    const mine = await ownerList(tok.owner1);
    expect(mine.status).toBe(200);
    expect(mine.body.pagination.total).toBe(2);
    expect(mine.body.data.every((r) => r.storeName === store1.name)).toBe(true);
    expect(JSON.stringify(mine.body)).not.toContain(alice.email);

    const theirs = await ownerList(tok.owner2);
    expect(theirs.body.pagination.total).toBe(1);
    expect(theirs.body.data[0].reviewerName.startsWith('Carol')).toBe(true);
  });

  test('stars-only ratings are not in the owner list', async () => {
    await createReview({ userId: carol.id, storeId: store1.id, rating: 3 });
    expect((await ownerList(tok.owner1)).body.pagination.total).toBe(2);
  });

  test('the first reply is 201, an edit is 200, and "edited" appears only when the text changes', async () => {
    const first = await reply(tok.owner1, aliceReview, REPLY);
    expect(first.status).toBe(201);
    expect(first.body.data.reply).toMatchObject({ text: REPLY, editedAt: null });

    const same = await reply(tok.owner1, aliceReview, REPLY);
    expect(same.status).toBe(200);
    expect(same.body.data.reply.editedAt).toBeNull();

    const changed = await reply(tok.owner1, aliceReview, `${REPLY} See you soon.`);
    expect(changed.status).toBe(200);
    expect(changed.body.data.reply.editedAt).not.toBeNull();

    const row = await ratingRow(aliceReview);
    expect(row.reply_text).toBe(`${REPLY} See you soon.`);
    expect(new Date(row.replied_at).getTime()).toBe(new Date(first.body.data.reply.repliedAt).getTime());
  });

  test('customers see the reply under the review, and never who the owner is', async () => {
    await reply(tok.owner1, aliceReview, REPLY);

    const list = await reviews(tok.carol, store1.id);
    const withReply = list.body.data.find((r) => r.id === aliceReview);
    const without = list.body.data.find((r) => r.id === bobReview);
    expect(withReply.reply).toMatchObject({ text: REPLY, editedAt: null });
    expect(without.reply).toBeNull();

    const json = JSON.stringify(list.body);
    expect(json).not.toContain(owner1.email);
    expect(json).not.toContain(owner1.name);

    const page = await request(app).get(`/api/v1/stores/${store1.id}`).set(auth(tok.alice));
    expect(page.body.data.myReview.reply.text).toBe(REPLY);
  });

  test('ANOTHER owner cannot reply to, change or delete these reviews (404, nothing changes)', async () => {
    await reply(tok.owner1, aliceReview, REPLY);

    const attempt = await reply(tok.owner2, aliceReview, 'I am not the owner of this store!');
    expect(attempt.status).toBe(404);
    expect(attempt.body.code).toBe('REVIEW_NOT_FOUND');

    const removal = await unreply(tok.owner2, aliceReview);
    expect(removal.status).toBe(404);

    expect((await ratingRow(aliceReview)).reply_text).toBe(REPLY);
    expect((await reply(tok.owner2, bobReview, 'Nope, not mine either.')).status).toBe(404);
    expect((await ratingRow(bobReview)).reply_text).toBeNull();
  });

  test('a stars-only rating, an unknown id and a junk id are all 404', async () => {
    const starsOnly = await createReview({ userId: carol.id, storeId: store1.id, rating: 3 });
    for (const id of [starsOnly, 999999, 'abc']) {
      expect((await reply(tok.owner1, id, REPLY)).status).toBe(404);
    }
  });

  test.each([
    ['too short', { text: 'Hi' }],
    ['too long', { text: 'x'.repeat(1001) }],
    ['missing', {}],
    ['not a string', { text: 12345678 }],
  ])('a reply that is %s is a 400 and nothing is saved', async (_label, body) => {
    const res = await request(app)
      .put(`/api/v1/owner/reviews/${aliceReview}/reply`)
      .set(auth(tok.owner1))
      .send(body);
    expect(res.status).toBe(400);
    expect((await ratingRow(aliceReview)).reply_text).toBeNull();
  });

  test('HTML in a reply is stored as plain text, and emoji work', async () => {
    const text = '<b>Thanks</b> <script>alert(1)</script> 🙏 धन्यवाद';
    expect((await reply(tok.owner1, aliceReview, text)).status).toBe(201);
    expect((await reviews(tok.carol, store1.id)).body.data.find((r) => r.id === aliceReview).reply.text).toBe(text);
  });

  test('deleting a reply removes it, and deleting twice is a 404', async () => {
    await reply(tok.owner1, aliceReview, REPLY);

    expect((await unreply(tok.owner1, aliceReview)).status).toBe(200);
    expect((await ratingRow(aliceReview)).reply_text).toBeNull();
    expect((await ratingRow(aliceReview)).replied_at).toBeNull();

    const again = await unreply(tok.owner1, aliceReview);
    expect(again.status).toBe(404);
    expect(again.body.code).toBe('REPLY_NOT_FOUND');
  });

  test('the customer editing their review keeps the reply; deleting the review removes it', async () => {
    await reply(tok.owner1, aliceReview, REPLY);

    await request(app)
      .put(`/api/v1/stores/${store1.id}/review`)
      .set(auth(tok.alice))
      .send({ rating: 4, text: 'Updated: still good, but a little busy.' });
    expect((await ratingRow(aliceReview)).reply_text).toBe(REPLY);

    await request(app).delete(`/api/v1/stores/${store1.id}/review`).set(auth(tok.alice));
    expect((await ownerList(tok.owner1)).body.pagination.total).toBe(1); // only Bob's review is left
  });

  test('an owner can still reply while their store is hidden', async () => {
    await db.query("UPDATE stores SET status = 'INACTIVE' WHERE id = ?", [store1.id]);
    expect((await reply(tok.owner1, aliceReview, REPLY)).status).toBe(201);
  });

  describe('filters, sorting and pages', () => {
    beforeEach(async () => {
      await reply(tok.owner1, aliceReview, REPLY);
    });

    test('"needs a reply" and "already replied"', async () => {
      const open = await ownerList(tok.owner1, '?replied=false');
      expect(open.body.data.map((r) => r.id)).toEqual([bobReview]);

      const done = await ownerList(tok.owner1, '?replied=true');
      expect(done.body.data.map((r) => r.id)).toEqual([aliceReview]);
    });

    test('rating filter combines with the reply filter', async () => {
      expect((await ownerList(tok.owner1, '?rating=2&replied=false')).body.pagination.total).toBe(1);
      expect((await ownerList(tok.owner1, '?rating=2&replied=true')).body.pagination.total).toBe(0);
      expect((await ownerList(tok.owner1, '?rating=5')).body.data.map((r) => r.id)).toEqual([aliceReview]);
    });

    test('sorting by helpful votes and by rating', async () => {
      await vote(tok.carol, store1.id, bobReview);
      expect((await ownerList(tok.owner1, '?sortBy=helpful')).body.data[0].id).toBe(bobReview);
      expect((await ownerList(tok.owner1, '?sortBy=rating&order=asc')).body.data.map((r) => r.id)).toEqual([
        bobReview,
        aliceReview,
      ]);
    });

    test('pagination', async () => {
      const p1 = await ownerList(tok.owner1, '?limit=1&page=1&sortBy=rating&order=desc');
      const p2 = await ownerList(tok.owner1, '?limit=1&page=2&sortBy=rating&order=desc');
      expect(p1.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
      expect([p1.body.data[0].id, p2.body.data[0].id]).toEqual([aliceReview, bobReview]);
    });

    test('bad filters are a 400', async () => {
      expect((await ownerList(tok.owner1, '?replied=maybe')).body.code).toBe('INVALID_REPLIED_FILTER');
      expect((await ownerList(tok.owner1, '?rating=9')).body.code).toBe('INVALID_RATING_FILTER');
    });
  });
});

// ========================================================================
describe('verified stores', () => {
  test('an admin can verify a store: date and admin are recorded', async () => {
    const res = await verify(tok.admin, store1.id, { verified: true });
    expect(res.status).toBe(200);
    expect(res.body.data.store).toMatchObject({ id: store1.id, isVerified: true });
    expect(res.body.data.store.verifiedAt).not.toBeNull();

    const row = await storeRow(store1.id);
    expect(row.verified_by).toBe(admin.id);
    expect(Math.abs(Date.now() - new Date(row.verified_at).getTime())).toBeLessThan(60 * 1000);
  });

  test('verifying again keeps the ORIGINAL date and admin', async () => {
    const otherAdmin = await createUser({ label: 'OtherAdmin', role: 'ADMIN' });
    const otherToken = await loginAs(app, otherAdmin);

    const first = await verify(tok.admin, store1.id, { verified: true });
    const again = await verify(otherToken, store1.id, { verified: true });

    expect(again.body.data.store.verifiedAt).toBe(first.body.data.store.verifiedAt);
    expect((await storeRow(store1.id)).verified_by).toBe(admin.id);
  });

  test('removing verification clears both columns, and doing it twice is fine', async () => {
    await verify(tok.admin, store1.id, { verified: true });

    const off = await verify(tok.admin, store1.id, { verified: false });
    expect(off.status).toBe(200);
    expect(off.body.data.store).toMatchObject({ isVerified: false, verifiedAt: null });

    const row = await storeRow(store1.id);
    expect(row.verified_at).toBeNull();
    expect(row.verified_by).toBeNull();
    expect((await verify(tok.admin, store1.id, { verified: false })).status).toBe(200);
  });

  test.each([['yes'], [1], [null], ['true'], [undefined]])('verified = %p is a 400 and nothing changes', async (verified) => {
    const res = await verify(tok.admin, store1.id, { verified });
    expect(res.status).toBe(400);
    expect((await storeRow(store1.id)).verified_at).toBeNull();
  });

  test('an unknown or junk store id is a 404', async () => {
    expect((await verify(tok.admin, 999999, { verified: true })).status).toBe(404);
    expect((await verify(tok.admin, 'abc', { verified: true })).status).toBe(404);
  });

  test('owners and customers cannot verify stores (403), not even their own', async () => {
    expect((await verify(tok.owner1, store1.id, { verified: true })).status).toBe(403);
    expect((await verify(tok.alice, store1.id, { verified: true })).status).toBe(403);
    expect((await storeRow(store1.id)).verified_at).toBeNull();
  });

  test('customers see the badge, and can filter for verified stores only', async () => {
    await verify(tok.admin, store1.id, { verified: true });

    const all = await request(app).get('/api/v1/stores').set(auth(tok.alice));
    const byId = Object.fromEntries(all.body.data.map((s) => [s.id, s.isVerified]));
    expect(byId).toEqual({ [store1.id]: true, [store2.id]: false });

    const onlyVerified = await request(app).get('/api/v1/stores?verified=true').set(auth(tok.alice));
    expect(onlyVerified.body.data.map((s) => s.id)).toEqual([store1.id]);

    // "verified=false" is not a customer option: it simply shows everything
    const ignored = await request(app).get('/api/v1/stores?verified=false').set(auth(tok.alice));
    expect(ignored.body.pagination.total).toBe(2);

    const page = await request(app).get(`/api/v1/stores/${store1.id}`).set(auth(tok.alice));
    expect(page.body.data.isVerified).toBe(true);
  });

  test('the nearby search also shows the badge', async () => {
    await db.query('UPDATE stores SET latitude = 18.52, longitude = 73.85 WHERE id = ?', [store1.id]);
    await verify(tok.admin, store1.id, { verified: true });

    const res = await request(app).get('/api/v1/stores/nearby?lat=18.52&lng=73.85&radius=5').set(auth(tok.alice));
    expect(res.body.data[0]).toMatchObject({ id: store1.id, isVerified: true });
  });

  test('the admin list shows the badge and can filter verified / not verified', async () => {
    await verify(tok.admin, store1.id, { verified: true });

    const yes = await request(app).get('/api/v1/admin/stores?verified=true').set(auth(tok.admin));
    expect(yes.body.data.map((s) => s.id)).toEqual([store1.id]);
    expect(yes.body.data[0]).toMatchObject({ isVerified: true });
    expect(yes.body.data[0].verifiedAt).not.toBeNull();

    const no = await request(app).get('/api/v1/admin/stores?verified=false').set(auth(tok.admin));
    expect(no.body.data.map((s) => s.id)).toEqual([store2.id]);

    const bad = await request(app).get('/api/v1/admin/stores?verified=maybe').set(auth(tok.admin));
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_VERIFIED_FILTER');
  });

  test('editing a store never changes its verification, even if the body tries', async () => {
    await verify(tok.admin, store1.id, { verified: true });

    const res = await request(app)
      .put(`/api/v1/admin/stores/${store1.id}`)
      .set(auth(tok.admin))
      .send({
        name: 'Renamed Verified Store For Tests',
        email: 'renamed@example.com',
        address: '1 New Road, Pune',
        category: 'CAFE',
        verified: false,
        verifiedAt: null,
        isVerified: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.store.isVerified).toBe(true);
    expect((await storeRow(store1.id)).verified_at).not.toBeNull();
  });

  test('if the admin who verified a store is deleted, the badge stays', async () => {
    const otherAdmin = await createUser({ label: 'Leaving', role: 'ADMIN' });
    const otherToken = await loginAs(app, otherAdmin);
    await verify(otherToken, store1.id, { verified: true });

    await db.query('DELETE FROM users WHERE id = ?', [otherAdmin.id]);

    const row = await storeRow(store1.id);
    expect(row.verified_at).not.toBeNull();
    expect(row.verified_by).toBeNull();
  });
});
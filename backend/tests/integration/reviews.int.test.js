const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { resetDb, closeDb, createUser, createStore, createReview, loginAs, auth } = require('../helpers/db');

let alice, bob, carol, owner, store, tok;

const GOOD = 'The staff were friendly and the service was quick.';

beforeEach(async () => {
  await resetDb();
  alice = await createUser({ label: 'Alice' });
  bob = await createUser({ label: 'Bob' });
  carol = await createUser({ label: 'Carol' });
  owner = await createUser({ label: 'Owner', role: 'OWNER' });
  store = await createStore({ ownerId: owner.id, label: 'Reviewed' });

  tok = {
    alice: await loginAs(app, alice),
    bob: await loginAs(app, bob),
    carol: await loginAs(app, carol),
  };
});
afterAll(closeDb);

const put = (token, body, storeId = store.id) =>
  request(app).put(`/api/v1/stores/${storeId}/review`).set(auth(token)).send(body);
const del = (token, storeId = store.id) =>
  request(app).delete(`/api/v1/stores/${storeId}/review`).set(auth(token));
const list = (token, query = '', storeId = store.id) =>
  request(app).get(`/api/v1/stores/${storeId}/reviews${query}`).set(auth(token));
const details = (token, storeId = store.id) => request(app).get(`/api/v1/stores/${storeId}`).set(auth(token));
const rate = (token, rating) =>
  request(app).post(`/api/v1/stores/${store.id}/rating`).set(auth(token)).send({ rating });

const ratingRows = async () => (await db.query('SELECT * FROM ratings ORDER BY id'))[0];
const firstNames = (res) => res.body.data.map((r) => r.reviewerName.split(' ')[0]);

describe('writing a review', () => {
  test('posting creates ONE row with the rating, the text and the dates (201)', async () => {
    const res = await put(tok.alice, { rating: 4, text: GOOD });
    expect(res.status).toBe(201);
    expect(res.body.data.review).toMatchObject({ rating: 4, text: GOOD, editedAt: null });

    const rows = await ratingRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: alice.id,
      store_id: store.id,
      rating: 4,
      review_text: GOOD,
      review_edited_at: null,
    });
    expect(Math.abs(Date.now() - new Date(rows[0].reviewed_at).getTime())).toBeLessThan(60 * 1000);
  });

  test('editing changes the SAME row; "edited" is set only when the text changes', async () => {
    const first = await put(tok.alice, { rating: 4, text: GOOD });

    const starsOnly = await put(tok.alice, { rating: 5, text: GOOD });
    expect(starsOnly.status).toBe(200);
    expect(starsOnly.body.data.review).toMatchObject({ rating: 5, editedAt: null });

    const edited = await put(tok.alice, { rating: 5, text: `${GOOD} Edit: still great.` });
    expect(edited.status).toBe(200);
    expect(edited.body.data.review.editedAt).not.toBeNull();
    expect(edited.body.data.review.reviewedAt).toBe(first.body.data.review.reviewedAt);

    expect(await ratingRows()).toHaveLength(1);
  });

  test('a stars-only rating can be turned into a review later (stars kept, 201)', async () => {
    await rate(tok.alice, 3);
    const res = await put(tok.alice, { rating: 3, text: GOOD });
    expect(res.status).toBe(201);
    expect(await ratingRows()).toHaveLength(1);
  });

  test('changing the stars through the old rating endpoint keeps the written text', async () => {
    await put(tok.alice, { rating: 4, text: GOOD });
    expect((await rate(tok.alice, 2)).status).toBe(200);

    const rows = await ratingRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rating: 2, review_text: GOOD });

    const reviews = await list(tok.alice);
    expect(reviews.body.data[0]).toMatchObject({ rating: 2, text: GOOD });
  });

  test('the text is cleaned before saving', async () => {
    await put(tok.alice, { rating: 4, text: `  ${GOOD}\r\n\r\n\r\n\r\nSecond paragraph here.  ` });
    expect((await ratingRows())[0].review_text).toBe(`${GOOD}\n\nSecond paragraph here.`);
  });

  test('emoji and non-English text are saved and returned unchanged (utf8mb4)', async () => {
    const text = 'Great coffee ☕😀 बहुत बढ़िया सेवा और स्वादिष्ट खाना';
    expect((await put(tok.alice, { rating: 5, text })).status).toBe(201);
    expect((await list(tok.alice)).body.data[0].text).toBe(text);
  });

  test('HTML is stored and returned as plain text (the page escapes it when showing it)', async () => {
    const text = '<script>alert("x")</script> <b>nice</b> shop';
    await put(tok.alice, { rating: 5, text });
    expect((await list(tok.alice)).body.data[0].text).toBe(text);
  });

  test('the author is always the user in the token (a userId in the body is ignored)', async () => {
    await put(tok.alice, { rating: 4, text: GOOD, userId: bob.id });
    const rows = await ratingRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(alice.id);
  });

  test.each([
    ['text too short', { rating: 4, text: 'Too short' }],
    ['text too long', { rating: 4, text: 'x'.repeat(1001) }],
    ['text missing', { rating: 4 }],
    ['text is not a string', { rating: 4, text: 12345678901 }],
    ['rating missing', { text: GOOD }],
    ['rating 0', { rating: 0, text: GOOD }],
    ['rating 6', { rating: 6, text: GOOD }],
  ])('%s is a 400 and nothing is saved', async (_label, body) => {
    const res = await put(tok.alice, body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await ratingRows()).toHaveLength(0);
  });

  test('an unknown, hidden or non-numeric store is a 404 for every review endpoint', async () => {
    const otherOwner = await createUser({ label: 'Owner', role: 'OWNER' });
    const hidden = await createStore({ ownerId: otherOwner.id, label: 'Hidden', status: 'INACTIVE' });

    for (const id of [999999, 'abc', hidden.id]) {
      expect((await put(tok.alice, { rating: 4, text: GOOD }, id)).status).toBe(404);
      expect((await list(tok.alice, '', id)).status).toBe(404);
      expect((await details(tok.alice, id)).status).toBe(404);
    }
    expect(await ratingRows()).toHaveLength(0);
  });
});

describe('reading reviews', () => {
  test('shows the reviewer name and who wrote what, but never an email or an address', async () => {
    await createReview({ userId: alice.id, storeId: store.id, rating: 5, text: GOOD });
    await createReview({ userId: bob.id, storeId: store.id, rating: 3, text: 'It was an okay experience overall.' });

    const res = await list(tok.alice);
    expect(res.body.data).toHaveLength(2);

    const mine = res.body.data.find((r) => r.reviewerName.startsWith('Alice'));
    const theirs = res.body.data.find((r) => r.reviewerName.startsWith('Bob'));
    expect(mine.isMine).toBe(true);
    expect(theirs.isMine).toBe(false);

    const json = JSON.stringify(res.body);
    expect(json).not.toContain(alice.email);
    expect(json).not.toContain(bob.email);
    expect(json).not.toContain('Test Street');
  });

  test('stars-only ratings are not in the review list, but they count in the totals', async () => {
    await createReview({ userId: alice.id, storeId: store.id, rating: 5, text: GOOD });
    await createReview({ userId: carol.id, storeId: store.id, rating: 3 }); // no text

    const reviews = await list(tok.alice);
    expect(reviews.body.pagination.total).toBe(1);

    const page = await details(tok.alice);
    expect(page.body.data).toMatchObject({ overallRating: 4, ratingCount: 2, reviewCount: 1 });
    expect(page.body.data.distribution).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 1 },
      { rating: 4, count: 0 },
      { rating: 5, count: 1 },
    ]);
  });

  describe('filter, sort and pages', () => {
    beforeEach(async () => {
      await createReview({ userId: alice.id, storeId: store.id, rating: 5, text: GOOD, reviewedAt: new Date('2026-01-01T10:00:00Z') });
      await createReview({ userId: bob.id, storeId: store.id, rating: 3, text: 'It was an okay experience overall.', reviewedAt: new Date('2026-01-02T10:00:00Z') });
      await createReview({ userId: carol.id, storeId: store.id, rating: 4, text: 'Good prices and a clean store.', reviewedAt: new Date('2026-01-03T10:00:00Z') });
    });

    test('newest first is the default; oldest first on request', async () => {
      expect(firstNames(await list(tok.alice))).toEqual(['Carol', 'Bob', 'Alice']);
      expect(firstNames(await list(tok.alice, '?sortBy=newest&order=asc'))).toEqual(['Alice', 'Bob', 'Carol']);
    });

    test('sorting by rating: highest first by default, lowest first with order=asc', async () => {
      expect(firstNames(await list(tok.alice, '?sortBy=rating'))).toEqual(['Alice', 'Carol', 'Bob']);
      expect(firstNames(await list(tok.alice, '?sortBy=rating&order=asc'))).toEqual(['Bob', 'Carol', 'Alice']);
    });

    test('filter by stars', async () => {
      const res = await list(tok.alice, '?rating=4');
      expect(res.body.pagination.total).toBe(1);
      expect(firstNames(res)).toEqual(['Carol']);
      expect((await list(tok.alice, '?rating=1')).body.pagination.total).toBe(0);
    });

    test.each(['0', '6', 'abc', '4.5'])('a bad rating filter "%s" is a 400', async (rating) => {
      const res = await list(tok.alice, `?rating=${rating}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_RATING_FILTER');
    });

    test('pages: no repeats, no gaps, correct totals', async () => {
      const p1 = await list(tok.alice, '?limit=2&page=1');
      const p2 = await list(tok.alice, '?limit=2&page=2');
      expect(p1.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
      expect([...firstNames(p1), ...firstNames(p2)]).toEqual(['Carol', 'Bob', 'Alice']);
    });

    test('a junk sort column is ignored', async () => {
      const res = await list(tok.alice, '?sortBy=constructor');
      expect(res.status).toBe(200);
      expect(firstNames(res)).toEqual(['Carol', 'Bob', 'Alice']);
    });
  });

  test('the store page data: profile, distribution, my review and counts', async () => {
    await db.query('UPDATE stores SET description = ? WHERE id = ?', ['Fresh fruit and vegetables.', store.id]);
    await createReview({ userId: alice.id, storeId: store.id, rating: 5, text: GOOD });
    await createReview({ userId: bob.id, storeId: store.id, rating: 3 }); // stars only

    const asAlice = await details(tok.alice);
    expect(asAlice.status).toBe(200);
    expect(asAlice.body.data).toMatchObject({
      id: store.id,
      description: 'Fresh fruit and vegetables.',
      overallRating: 4,
      ratingCount: 2,
      reviewCount: 1,
      myRating: 5,
    });
    expect(asAlice.body.data.myReview).toMatchObject({ rating: 5, text: GOOD });
    expect(asAlice.body.data).not.toHaveProperty('email');
    expect(asAlice.body.data).not.toHaveProperty('status');

    const asBob = await details(tok.bob);
    expect(asBob.body.data.myReview).toBeNull(); // stars only is not a review
    expect(asBob.body.data.myRating).toBe(3);
  });

  test('the store list shows the review count', async () => {
    await createReview({ userId: alice.id, storeId: store.id, rating: 5, text: GOOD });
    await createReview({ userId: bob.id, storeId: store.id, rating: 3 });

    const res = await request(app).get('/api/v1/stores').set(auth(tok.carol));
    expect(res.body.data[0]).toMatchObject({ ratingCount: 2, reviewCount: 1 });
  });
});

describe('deleting a review', () => {
  test('removes my rating and review, leaves everyone else alone, and the average updates', async () => {
    await put(tok.alice, { rating: 5, text: GOOD });
    await put(tok.bob, { rating: 3, text: 'It was an okay experience overall.' });
    expect((await details(tok.alice)).body.data.overallRating).toBe(4);

    const res = await del(tok.alice);
    expect(res.status).toBe(200);

    const rows = await ratingRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(bob.id);

    const page = await details(tok.alice);
    expect(page.body.data).toMatchObject({ overallRating: 3, ratingCount: 1, myRating: null, myReview: null });
  });

  test('deleting twice: the second time is a 404', async () => {
    await put(tok.alice, { rating: 5, text: GOOD });
    expect((await del(tok.alice)).status).toBe(200);
    const again = await del(tok.alice);
    expect(again.status).toBe(404);
    expect(again.body.code).toBe('REVIEW_NOT_FOUND');
  });

  test('you can only delete your OWN review: someone else\'s stays', async () => {
    await put(tok.alice, { rating: 5, text: GOOD });
    expect((await del(tok.bob)).status).toBe(404); // Bob has no review of his own
    expect(await ratingRows()).toHaveLength(1);
  });

  test('a stars-only rating can be deleted too', async () => {
    await rate(tok.alice, 4);
    expect((await del(tok.alice)).status).toBe(200);
    expect(await ratingRows()).toHaveLength(0);
  });

  test('after deleting, a new review can be posted (201)', async () => {
    await put(tok.alice, { rating: 5, text: GOOD });
    await del(tok.alice);
    expect((await put(tok.alice, { rating: 2, text: 'Second visit was disappointing.' })).status).toBe(201);
    expect(await ratingRows()).toHaveLength(1);
  });
});
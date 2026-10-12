const { toReview, toMyReview, buildDistribution } = require('../src/utils/reviewMapper');

describe('buildDistribution', () => {
  test('always has all 5 stars, zero-filled, with numeric counts', () => {
    expect(buildDistribution([{ rating: 5, count: '3' }, { rating: 2, count: 1 }])).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 1 },
      { rating: 3, count: 0 },
      { rating: 4, count: 0 },
      { rating: 5, count: 3 },
    ]);
  });

  test('no ratings gives five zeros', () => {
    expect(buildDistribution([]).every((d) => d.count === 0)).toBe(true);
  });
});

describe('toReview', () => {
  const row = {
    id: 1,
    rating: 4,
    text: 'Nice place to shop',
    reviewedAt: new Date('2026-01-01T10:00:00Z'),
    editedAt: undefined,
    reviewerName: 'Alice Integration Test Account',
    isMine: 1,
    email: 'secret@example.com', // must never be passed on
    address: 'private address',
  };

  test('turns 1/0 into a boolean and a missing edit date into null', () => {
    expect(toReview(row)).toMatchObject({ isMine: true, editedAt: null });
    expect(toReview({ ...row, isMine: 0 }).isMine).toBe(false);
  });

  test('exposes the reviewer name only: no email, no address, no user id', () => {
    const json = JSON.stringify(toReview(row));
    expect(json).toContain('Alice Integration Test Account');
    expect(json).not.toContain('secret@example.com');
    expect(json).not.toContain('private address');
    expect(toReview(row)).not.toHaveProperty('userId');
  });
});

describe('toMyReview', () => {
  test('maps the raw column names', () => {
    const reviewedAt = new Date('2026-01-01T10:00:00Z');
    expect(
      toMyReview({ id: 3, rating: 5, review_text: 'Loved it, will come back', reviewed_at: reviewedAt, review_edited_at: null })
    ).toEqual({
      id: 3,
      rating: 5,
      text: 'Loved it, will come back',
      reviewedAt,
      editedAt: null,
      helpfulCount: 0,
      reply: null,
    });
  });
});


describe('replies and helpful votes in the mappers', () => {
  const { toOwnerReview } = require('../src/utils/reviewMapper');
  const repliedAt = new Date('2026-02-01T09:00:00Z');

  test('toReview carries the helpful count, my vote and the owner reply', () => {
    const json = toReview({
      id: 1, rating: 4, text: 'Nice', reviewerName: 'Alice', isMine: 0, helpfulCount: '3', iVoted: 1,
      replyText: 'Thank you!', repliedAt, replyEditedAt: null,
    });
    expect(json).toMatchObject({
      helpfulCount: 3,
      iVoted: true,
      reply: { text: 'Thank you!', repliedAt, editedAt: null },
    });
  });

  test('no reply gives null, and a missing count gives 0', () => {
    const json = toReview({ id: 1, rating: 4, text: 'Nice', reviewerName: 'Alice' });
    expect(json.reply).toBeNull();
    expect(json.helpfulCount).toBe(0);
    expect(json.iVoted).toBe(false);
  });

  test('a reply never says who the owner is', () => {
    const json = JSON.stringify(
      toReview({ id: 1, rating: 4, text: 'x', reviewerName: 'A', replyText: 'Thanks', repliedAt, ownerEmail: 'secret@example.com' })
    );
    expect(json).not.toContain('secret@example.com');
  });

  test('toOwnerReview has the store name but no isMine or iVoted', () => {
    const json = toOwnerReview({ id: 1, rating: 2, text: 'Slow', reviewerName: 'Bob', storeName: 'Fresh Mart', helpfulCount: 2 });
    expect(json).toMatchObject({ storeName: 'Fresh Mart', helpfulCount: 2, reply: null });
    expect(json).not.toHaveProperty('isMine');
    expect(json).not.toHaveProperty('iVoted');
  });

  test('toMyReview reads the raw reply columns and the vote count', () => {
    const json = toMyReview({
      id: 5, rating: 5, review_text: 'Great store overall', reviewed_at: new Date(), review_edited_at: null,
      helpful_count: 4, reply_text: 'Come again!', replied_at: repliedAt, reply_edited_at: null,
    });
    expect(json.helpfulCount).toBe(4);
    expect(json.reply).toEqual({ text: 'Come again!', repliedAt, editedAt: null });
  });
});
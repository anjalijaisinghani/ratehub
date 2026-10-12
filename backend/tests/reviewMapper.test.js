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
    ).toEqual({ id: 3, rating: 5, text: 'Loved it, will come back', reviewedAt, editedAt: null });
  });
});
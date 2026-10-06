const { buildAdminAnalytics } = require('../src/services/analyticsService');

const emptyRaw = {
  totalUsers: 0,
  totalStores: 0,
  totalRatings: 0,
  averageRating: null,
  distributionRows: [],
  roleRows: [],
  topStoreRows: [],
  ratingDayRows: [],
  userDayRows: [],
  recentRows: [],
};

// A fixed date, so the test gives the same result every day
const now = new Date(Date.UTC(2026, 9, 6, 12, 0, 0)); // 6 October 2026, noon UTC

describe('buildAdminAnalytics', () => {
  test('rating distribution always has all 5 stars, zero-filled', () => {
    const result = buildAdminAnalytics(
      { ...emptyRaw, distributionRows: [{ rating: 5, count: 3 }, { rating: 2, count: 1 }] },
      now
    );
    expect(result.ratingDistribution).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 1 },
      { rating: 3, count: 0 },
      { rating: 4, count: 0 },
      { rating: 5, count: 3 },
    ]);
  });

  test('activity covers exactly the last 7 days and fills missing days with 0', () => {
    const result = buildAdminAnalytics(
      {
        ...emptyRaw,
        ratingDayRows: [{ day: '2026-10-05', count: 3 }],
        userDayRows: [{ day: '2026-10-06', count: 2 }],
      },
      now
    );
    expect(result.activity).toHaveLength(7);
    expect(result.activity[0].day).toBe('2026-09-30');
    expect(result.activity[6].day).toBe('2026-10-06');
    expect(result.activity[5]).toEqual({ day: '2026-10-05', ratings: 3, newUsers: 0 });
    expect(result.activity[6]).toEqual({ day: '2026-10-06', ratings: 0, newUsers: 2 });
  });

  test('average is null with no ratings, and a number otherwise', () => {
    expect(buildAdminAnalytics(emptyRaw, now).totals.averageRating).toBeNull();
    expect(buildAdminAnalytics({ ...emptyRaw, averageRating: '4.25' }, now).totals.averageRating).toBe(4.25);
  });

  test('top stores have numeric averages', () => {
    const result = buildAdminAnalytics(
      { ...emptyRaw, topStoreRows: [{ id: 1, name: 'Fresh Mart Supermarket', averageRating: '4.5', totalRatings: 2 }] },
      now
    );
    expect(result.topStores[0].averageRating).toBe(4.5);
  });
});
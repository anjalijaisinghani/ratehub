const analyticsRepository = require('../repositories/analyticsRepository');

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Pure function (no database): turns raw rows into the shape the charts need.
// "now" can be passed in, which makes it easy to test.
const buildAdminAnalytics = (raw, now = new Date()) => {
  // Every star value 1..5 must appear, even with 0 votes
  const ratingDistribution = [1, 2, 3, 4, 5].map((star) => {
    const found = raw.distributionRows.find((r) => r.rating === star);
    return { rating: star, count: found ? found.count : 0 };
  });

  // The last 7 days must all appear, even with 0 activity
  const activity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    activity.push({
      day: key,
      ratings: (raw.ratingDayRows.find((r) => r.day === key) || { count: 0 }).count,
      newUsers: (raw.userDayRows.find((r) => r.day === key) || { count: 0 }).count,
    });
  }

  return {
    totals: {
      totalUsers: raw.totalUsers,
      totalStores: raw.totalStores,
      totalRatings: raw.totalRatings,
      averageRating: raw.averageRating !== null ? Number(raw.averageRating) : null,
    },
    ratingDistribution,
    usersByRole: raw.roleRows,
    topStores: raw.topStoreRows.map((s) => ({
      id: s.id,
      name: s.name,
      averageRating: Number(s.averageRating),
      totalRatings: s.totalRatings,
    })),
    activity,
    recentRatings: raw.recentRows,
  };
};

const getAdminAnalytics = async () => buildAdminAnalytics(await analyticsRepository.fetchAdminAnalytics());

module.exports = { getAdminAnalytics, buildAdminAnalytics };
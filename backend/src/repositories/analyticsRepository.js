const db = require('../config/db');

const getTotals = async () => {
  const [[users], [stores], [ratings]] = await Promise.all([
    db.query('SELECT COUNT(*) AS total FROM users'),
    db.query('SELECT COUNT(*) AS total FROM stores'),
    db.query('SELECT COUNT(*) AS total FROM ratings'),
  ]);
  return {
    totalUsers: users[0].total,
    totalStores: stores[0].total,
    totalRatings: ratings[0].total,
  };
};

// Raw rows for the admin dashboard charts. The service shapes them.
const fetchAdminAnalytics = async () => {
  // Run all queries at the same time (faster than one after another)
  const [
    [[users]],
    [[stores]],
    [[ratings]],
    [[avg]],
    [distributionRows],
    [roleRows],
    [topStoreRows],
    [ratingDayRows],
    [userDayRows],
    [recentRows],
  ] = await Promise.all([
    db.query('SELECT COUNT(*) AS total FROM users'),
    db.query('SELECT COUNT(*) AS total FROM stores'),
    db.query('SELECT COUNT(*) AS total FROM ratings'),
    db.query('SELECT ROUND(AVG(rating), 2) AS average FROM ratings'),
    db.query('SELECT rating, COUNT(*) AS count FROM ratings GROUP BY rating'),
    db.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role'),
    db.query(
      `SELECT s.id, s.name,
              ROUND(AVG(r.rating), 1) AS averageRating,
              COUNT(r.id) AS totalRatings
       FROM stores s
       JOIN ratings r ON r.store_id = s.id
       GROUP BY s.id
       ORDER BY AVG(r.rating) DESC, COUNT(r.id) DESC
       LIMIT 5`
    ),
    db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
       FROM ratings
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY day`
    ),
    db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY day`
    ),
    db.query(
      `SELECT r.id, u.name AS userName, s.name AS storeName, r.rating, r.updated_at AS ratedAt
       FROM ratings r
       JOIN users u  ON u.id = r.user_id
       JOIN stores s ON s.id = r.store_id
       ORDER BY r.updated_at DESC
       LIMIT 8`
    ),
  ]);

  return {
    totalUsers: users.total,
    totalStores: stores.total,
    totalRatings: ratings.total,
    averageRating: avg.average,
    distributionRows,
    roleRows,
    topStoreRows,
    ratingDayRows,
    userDayRows,
    recentRows,
  };
};

module.exports = { getTotals, fetchAdminAnalytics };
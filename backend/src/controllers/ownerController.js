const db = require('../config/db');

// GET /api/owner/dashboard?sortBy=name&order=asc
const getOwnerDashboard = async (req, res) => {
  try {
    const ownerId = req.user.id; // from the token
    const { sortBy, order } = req.query;

    // Find the store(s) that belong to this owner, with average rating
    const [stores] = await db.query(
      `SELECT s.id, s.name, s.email, s.address,
              ROUND(AVG(r.rating), 1) AS averageRating,
              COUNT(r.id) AS totalRatings
       FROM stores s
       LEFT JOIN ratings r ON r.store_id = s.id
       WHERE s.owner_id = ?
       GROUP BY s.id`,
      [ownerId]
    );

    if (stores.length === 0) {
      return res.json({ stores: [], raters: [] });
    }

    // Only these columns can be used for sorting (prevents SQL injection)
    const sortableColumns = { name: 'u.name', email: 'u.email', rating: 'r.rating', date: 'r.updated_at' };
    const sortColumn = sortableColumns[sortBy] || 'u.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Users who rated this owner's store(s)
    const [raters] = await db.query(
      `SELECT u.id, u.name, u.email, u.address,
              r.rating, r.updated_at AS ratedAt,
              s.name AS storeName
       FROM ratings r
       JOIN users  u ON u.id = r.user_id
       JOIN stores s ON s.id = r.store_id
       WHERE s.owner_id = ?
       ORDER BY ${sortColumn} ${sortOrder}`,
      [ownerId]
    );

    res.json({ stores, raters });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getOwnerDashboard };
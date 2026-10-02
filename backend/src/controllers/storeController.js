const db = require('../config/db');

// ---------- 1. List stores for a normal user ----------
// GET /api/stores?name=&address=&sortBy=name&order=asc
const listStoresForUser = async (req, res) => {
  try {
    const { name, address, sortBy, order } = req.query;
    const userId = req.user.id; // from the token

    const sortableColumns = ['name', 'address', 'overallRating', 'myRating'];
    const sortColumn = sortableColumns.includes(sortBy) ? sortBy : 'name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // overallRating = average of everyone's ratings
    // myRating      = the rating given by the logged-in user (null if none)
    let sql = `
      SELECT s.id, s.name, s.address,
             ROUND(AVG(r.rating), 1) AS overallRating,
             (SELECT rating FROM ratings
              WHERE store_id = s.id AND user_id = ?) AS myRating
      FROM stores s
      LEFT JOIN ratings r ON r.store_id = s.id
      WHERE 1=1`;
    const params = [userId];

    if (name) {
      sql += ' AND s.name LIKE ?';
      params.push(`%${name}%`);
    }
    if (address) {
      sql += ' AND s.address LIKE ?';
      params.push(`%${address}%`);
    }

    const orderBy =
      sortColumn === 'overallRating' || sortColumn === 'myRating'
        ? sortColumn
        : `s.${sortColumn}`;
    sql += ` GROUP BY s.id ORDER BY ${orderBy} ${sortOrder}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- 2. Submit or modify a rating ----------
// POST /api/stores/:storeId/rating   body: { "rating": 4 }
const submitRating = async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const userId = req.user.id;
    const { rating } = req.body;

    const [stores] = await db.query('SELECT id FROM stores WHERE id = ?', [storeId]);
    if (stores.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // If a rating already exists for this user + store, it is updated.
    // Otherwise a new row is inserted. (UNIQUE key on user_id + store_id)
    await db.query(
      `INSERT INTO ratings (user_id, store_id, rating)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
      [userId, storeId, rating]
    );

    res.json({ message: 'Rating saved successfully', storeId: Number(storeId), rating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { listStoresForUser, submitRating };
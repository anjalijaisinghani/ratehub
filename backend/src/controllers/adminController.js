const bcrypt = require('bcryptjs');
const db = require('../config/db');

// ---------- 1. Dashboard ----------
// GET /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const [[users]] = await db.query('SELECT COUNT(*) AS total FROM users');
    const [[stores]] = await db.query('SELECT COUNT(*) AS total FROM stores');
    const [[ratings]] = await db.query('SELECT COUNT(*) AS total FROM ratings');

    res.json({
      totalUsers: users.total,
      totalStores: stores.total,
      totalRatings: ratings.total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- 2. Add user ----------
// POST /api/admin/users
const addUser = async (req, res) => {
  try {
    const { name, email, address, password, role } = req.body;

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, address, role]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: { id: result.insertId, name, email, address, role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- 3. Add store ----------
// POST /api/admin/stores
const addStore = async (req, res) => {
  try {
    const { name, email, address, ownerId } = req.body;

    // The owner must exist and must have the OWNER role
    const [owners] = await db.query('SELECT id, role FROM users WHERE id = ?', [ownerId]);
    if (owners.length === 0) {
      return res.status(404).json({ message: 'Owner user not found' });
    }
    if (owners[0].role !== 'OWNER') {
      return res.status(400).json({ message: 'Selected user is not a Store Owner' });
    }

    const [result] = await db.query(
      'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
      [name, email, address, ownerId]
    );

    res.status(201).json({
      message: 'Store created successfully',
      store: { id: result.insertId, name, email, address, ownerId },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- 4. List users (filter + sort) ----------
// GET /api/admin/users?name=&email=&address=&role=&sortBy=name&order=asc
const listUsers = async (req, res) => {
  try {
    const { name, email, address, role, sortBy, order } = req.query;

    // Only these columns are allowed for sorting (prevents SQL injection)
    const sortableColumns = ['name', 'email', 'address', 'role'];
    const sortColumn = sortableColumns.includes(sortBy) ? sortBy : 'name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    let sql = 'SELECT id, name, email, address, role FROM users WHERE 1=1';
    const params = [];

    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    if (email) {
      sql += ' AND email LIKE ?';
      params.push(`%${email}%`);
    }
    if (address) {
      sql += ' AND address LIKE ?';
      params.push(`%${address}%`);
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    sql += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- 5. List stores (filter + sort) ----------
// GET /api/admin/stores?name=&email=&address=&sortBy=name&order=asc
const listStores = async (req, res) => {
  try {
    const { name, email, address, sortBy, order } = req.query;

    const sortableColumns = ['name', 'email', 'address', 'rating'];
    const sortColumn = sortableColumns.includes(sortBy) ? sortBy : 'name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // "s." and "r." are short names (aliases) for the tables
    let sql = `
      SELECT s.id, s.name, s.email, s.address,
             ROUND(AVG(r.rating), 1) AS rating
      FROM stores s
      LEFT JOIN ratings r ON r.store_id = s.id
      WHERE 1=1`;
    const params = [];

    if (name) {
      sql += ' AND s.name LIKE ?';
      params.push(`%${name}%`);
    }
    if (email) {
      sql += ' AND s.email LIKE ?';
      params.push(`%${email}%`);
    }
    if (address) {
      sql += ' AND s.address LIKE ?';
      params.push(`%${address}%`);
    }

    // "rating" is a calculated column, so we sort by its alias
    const orderBy = sortColumn === 'rating' ? 'rating' : `s.${sortColumn}`;
    sql += ` GROUP BY s.id ORDER BY ${orderBy} ${sortOrder}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- 6. User details ----------
// GET /api/admin/users/:id
const getUserDetails = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, address, role FROM users WHERE id = ?',
      [req.params.id]
    );
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If the user is a Store Owner, also show their store's average rating
    if (user.role === 'OWNER') {
      const [[result]] = await db.query(
        `SELECT ROUND(AVG(r.rating), 1) AS rating
         FROM stores s
         LEFT JOIN ratings r ON r.store_id = s.id
         WHERE s.owner_id = ?`,
        [user.id]
      );
      user.rating = result.rating; // null if no ratings yet
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// module.exports = {
//   getDashboard,
//   addUser,
//   addStore,
//   listUsers,
//   listStores,
//   getUserDetails,
// };

// ---------- 7. Analytics for the dashboard charts ----------
// GET /api/admin/analytics
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getAnalytics = async (req, res) => {
  try {
    // Run all queries at the same time (faster than one after another)
    const [
      [[users]],
      [[stores]],
      [[ratings]],
      [[avg]],
      [distRows],
      [roleRows],
      [topStores],
      [ratingDays],
      [userDays],
      [recent],
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

    // Make sure every rating 1..5 appears, even with 0 votes
    const ratingDistribution = [1, 2, 3, 4, 5].map((star) => {
      const found = distRows.find((r) => r.rating === star);
      return { rating: star, count: found ? found.count : 0 };
    });

    // Make sure the last 7 days all appear, even with 0 activity
    const activity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      activity.push({
        day: key,
        ratings: (ratingDays.find((r) => r.day === key) || { count: 0 }).count,
        newUsers: (userDays.find((r) => r.day === key) || { count: 0 }).count,
      });
    }

    res.json({
      totals: {
        totalUsers: users.total,
        totalStores: stores.total,
        totalRatings: ratings.total,
        averageRating: avg.average !== null ? Number(avg.average) : null,
      },
      ratingDistribution,
      usersByRole: roleRows,
      topStores: topStores.map((s) => ({
        id: s.id,
        name: s.name,
        averageRating: Number(s.averageRating),
        totalRatings: s.totalRatings,
      })),
      activity,
      recentRatings: recent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboard,
  getAnalytics,
  addUser,
  addStore,
  listUsers,
  listStores,
  getUserDetails,
};
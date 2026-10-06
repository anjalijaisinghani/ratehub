const db = require('../config/db');
const { resolveSort, likePattern } = require('../utils/sql');

const ADMIN_SORT = { name: 's.name', email: 's.email', address: 's.address', rating: 'rating' };
const USER_SORT = {
  name: 's.name',
  address: 's.address',
  overallRating: 'overallRating',
  myRating: 'myRating',
};

const create = async ({ name, email, address, ownerId }) => {
  const [result] = await db.query(
    'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
    [name, email, address, ownerId]
  );
  return result.insertId;
};

const findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM stores WHERE id = ?', [id]);
  return rows[0] || null;
};

const countByOwner = async (ownerId) => {
  const [[row]] = await db.query('SELECT COUNT(*) AS total FROM stores WHERE owner_id = ?', [ownerId]);
  return row.total;
};

// Admin list: Name, Email, Address, average Rating
const listForAdmin = async ({ name, email, address, sortBy, order }) => {
  const { column, direction } = resolveSort(sortBy, order, ADMIN_SORT, 'name');

  let sql = `
    SELECT s.id, s.name, s.email, s.address,
           ROUND(AVG(r.rating), 1) AS rating
    FROM stores s
    LEFT JOIN ratings r ON r.store_id = s.id
    WHERE 1=1`;
  const params = [];

  if (name) { sql += ' AND s.name LIKE ?'; params.push(likePattern(name)); }
  if (email) { sql += ' AND s.email LIKE ?'; params.push(likePattern(email)); }
  if (address) { sql += ' AND s.address LIKE ?'; params.push(likePattern(address)); }

  sql += ` GROUP BY s.id ORDER BY ${column} ${direction}`;

  const [rows] = await db.query(sql, params);
  return rows;
};

// Normal-user list: overall rating plus THIS user's own rating
const listForUser = async (userId, { name, address, sortBy, order }) => {
  const { column, direction } = resolveSort(sortBy, order, USER_SORT, 'name');

  let sql = `
    SELECT s.id, s.name, s.address,
           ROUND(AVG(r.rating), 1) AS overallRating,
           (SELECT rating FROM ratings
            WHERE store_id = s.id AND user_id = ?) AS myRating
    FROM stores s
    LEFT JOIN ratings r ON r.store_id = s.id
    WHERE 1=1`;
  const params = [userId];

  if (name) { sql += ' AND s.name LIKE ?'; params.push(likePattern(name)); }
  if (address) { sql += ' AND s.address LIKE ?'; params.push(likePattern(address)); }

  sql += ` GROUP BY s.id ORDER BY ${column} ${direction}`;

  const [rows] = await db.query(sql, params);
  return rows;
};

// An owner's store(s) with average rating and rating count
const findWithStatsByOwner = async (ownerId) => {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.email, s.address,
            ROUND(AVG(r.rating), 1) AS averageRating,
            COUNT(r.id) AS totalRatings
     FROM stores s
     LEFT JOIN ratings r ON r.store_id = s.id
     WHERE s.owner_id = ?
     GROUP BY s.id`,
    [ownerId]
  );
  return rows;
};

// Used by the admin "user details" for Store Owners. null if no ratings yet.
const getAverageRatingForOwner = async (ownerId) => {
  const [[row]] = await db.query(
    `SELECT ROUND(AVG(r.rating), 1) AS rating
     FROM stores s
     LEFT JOIN ratings r ON r.store_id = s.id
     WHERE s.owner_id = ?`,
    [ownerId]
  );
  return row.rating;
};

module.exports = {
  create,
  findById,
  countByOwner,
  listForAdmin,
  listForUser,
  findWithStatsByOwner,
  getAverageRatingForOwner,
};
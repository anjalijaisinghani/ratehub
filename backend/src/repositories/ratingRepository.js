const db = require('../config/db');
const { resolveSort } = require('../utils/sql');

const RATER_SORT = {
  name: 'u.name',
  email: 'u.email',
  rating: 'r.rating',
  date: 'r.updated_at',
};

const REVIEW_SORT = { newest: 'r.reviewed_at', rating: 'r.rating' };

// Insert a new rating, or update it if this user already rated this store.
// Works because of UNIQUE(user_id, store_id) in the table.
// Only the stars change: a written review on the same row is left alone.
const upsert = async ({ userId, storeId, rating }) => {
  await db.query(
    `INSERT INTO ratings (user_id, store_id, rating)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
    [userId, storeId, rating]
  );
};

// Everyone who rated any store owned by this owner
const findRatersByOwner = async (ownerId, sortBy, order) => {
  const { column, direction } = resolveSort(sortBy, order, RATER_SORT, 'name');

  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.address,
            r.rating, r.updated_at AS ratedAt,
            s.name AS storeName
     FROM ratings r
     JOIN users  u ON u.id = r.user_id
     JOIN stores s ON s.id = r.store_id
     WHERE s.owner_id = ?
     ORDER BY ${column} ${direction}`,
    [ownerId]
  );
  return rows;
};

// ---------- Reviews ----------

const findByUserAndStore = async (userId, storeId) => {
  const [rows] = await db.query('SELECT * FROM ratings WHERE user_id = ? AND store_id = ?', [userId, storeId]);
  return rows[0] || null;
};

// Create or replace this user's review of this store (stars + text + dates, in one statement)
const saveReview = async ({ userId, storeId, rating, text, reviewedAt, editedAt }) => {
  await db.query(
    `INSERT INTO ratings (user_id, store_id, rating, review_text, reviewed_at, review_edited_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rating = VALUES(rating),
       review_text = VALUES(review_text),
       reviewed_at = VALUES(reviewed_at),
       review_edited_at = VALUES(review_edited_at)`,
    [userId, storeId, rating, text, reviewedAt, editedAt]
  );
};

// Removes the user's rating AND review for a store. Returns true if something was deleted.
const deleteByUserAndStore = async (userId, storeId) => {
  const [result] = await db.query('DELETE FROM ratings WHERE user_id = ? AND store_id = ?', [userId, storeId]);
  return result.affectedRows > 0;
};

// How many ratings of each star value (all ratings, with or without text)
const getDistribution = async (storeId) => {
  const [rows] = await db.query(
    'SELECT rating, COUNT(*) AS count FROM ratings WHERE store_id = ? GROUP BY rating',
    [storeId]
  );
  return rows;
};

// Written reviews of a store, one page at a time. Only rows that HAVE text are reviews.
const listReviews = async (storeId, viewerId, { rating, sortBy, order, limit, offset }) => {
  const sort = resolveSort(sortBy, order, REVIEW_SORT, 'newest');

  let where = 'WHERE r.store_id = ? AND r.review_text IS NOT NULL';
  const params = [storeId];
  if (rating) {
    where += ' AND r.rating = ?';
    params.push(rating);
  }

  // Parameter order = the order the ? appear: SELECT (isMine) -> WHERE -> LIMIT
  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.review_text AS text, r.reviewed_at AS reviewedAt,
            r.review_edited_at AS editedAt, u.name AS reviewerName,
            (r.user_id = ?) AS isMine
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY ${sort.column} ${sort.direction}, r.reviewed_at DESC, r.id ASC
       LIMIT ? OFFSET ?`,
    [viewerId, ...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ratings r ${where}`, params);
  return { rows, total };
};

module.exports = {
  upsert,
  findRatersByOwner,
  findByUserAndStore,
  saveReview,
  deleteByUserAndStore,
  getDistribution,
  listReviews,
};
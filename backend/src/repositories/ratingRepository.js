const db = require('../config/db');
const { resolveSort } = require('../utils/sql');

const RATER_SORT = {
  name: 'u.name',
  email: 'u.email',
  rating: 'r.rating',
  date: 'r.updated_at',
};

// "helpfulCount" is the alias of the vote-counting sub-query in the SELECT list
const REVIEW_SORT = { newest: 'r.reviewed_at', rating: 'r.rating', helpful: 'helpfulCount' };

const HELPFUL_COUNT_SQL = '(SELECT COUNT(*) FROM review_votes v WHERE v.rating_id = r.id)';

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

// The user's own row, plus how many helpful votes it has
const findByUserAndStore = async (userId, storeId) => {
  const [rows] = await db.query(
    `SELECT r.*, ${HELPFUL_COUNT_SQL} AS helpful_count
       FROM ratings r
      WHERE r.user_id = ? AND r.store_id = ?`,
    [userId, storeId]
  );
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

// Removes the user's rating AND review (and its reply and votes) for a store.
// Returns true if something was deleted.
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

  // Parameter order = the order the ? appear: SELECT (isMine, iVoted) -> WHERE -> LIMIT
  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.review_text AS text, r.reviewed_at AS reviewedAt,
            r.review_edited_at AS editedAt, u.name AS reviewerName,
            r.reply_text AS replyText, r.replied_at AS repliedAt, r.reply_edited_at AS replyEditedAt,
            (r.user_id = ?) AS isMine,
            ${HELPFUL_COUNT_SQL} AS helpfulCount,
            EXISTS(SELECT 1 FROM review_votes v WHERE v.rating_id = r.id AND v.user_id = ?) AS iVoted
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY ${sort.column} ${sort.direction}, r.reviewed_at DESC, r.id ASC
       LIMIT ? OFFSET ?`,
    [viewerId, viewerId, ...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ratings r ${where}`, params);
  return { rows, total };
};

// ---------- Owner side: reviews of MY store, and replies ----------

// Reviews of the stores owned by this owner. The "s.owner_id = ?" in the join is the
// ownership check: another owner's reviews can never appear here.
const listReviewsForOwner = async (ownerId, { rating, replied, sortBy, order, limit, offset }) => {
  const sort = resolveSort(sortBy, order, REVIEW_SORT, 'newest');

  let where = 'WHERE s.owner_id = ? AND r.review_text IS NOT NULL';
  const params = [ownerId];
  if (rating) {
    where += ' AND r.rating = ?';
    params.push(rating);
  }
  if (replied === true) where += ' AND r.reply_text IS NOT NULL';
  if (replied === false) where += ' AND r.reply_text IS NULL';

  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.review_text AS text, r.reviewed_at AS reviewedAt,
            r.review_edited_at AS editedAt, u.name AS reviewerName, s.name AS storeName,
            r.reply_text AS replyText, r.replied_at AS repliedAt, r.reply_edited_at AS replyEditedAt,
            ${HELPFUL_COUNT_SQL} AS helpfulCount
       FROM ratings r
       JOIN users  u ON u.id = r.user_id
       JOIN stores s ON s.id = r.store_id
       ${where}
       ORDER BY ${sort.column} ${sort.direction}, r.reviewed_at DESC, r.id ASC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM ratings r JOIN stores s ON s.id = r.store_id ${where}`,
    params
  );
  return { rows, total };
};

// One review, but ONLY if it belongs to a store owned by this owner (and has text)
const findReviewForOwner = async (ownerId, reviewId) => {
  const [rows] = await db.query(
    `SELECT r.*
       FROM ratings r
       JOIN stores s ON s.id = r.store_id
      WHERE r.id = ? AND s.owner_id = ? AND r.review_text IS NOT NULL`,
    [reviewId, ownerId]
  );
  return rows[0] || null;
};

const saveReply = async (reviewId, text, repliedAt, editedAt) => {
  await db.query(
    'UPDATE ratings SET reply_text = ?, replied_at = ?, reply_edited_at = ? WHERE id = ?',
    [text, repliedAt, editedAt, reviewId]
  );
};

const clearReply = async (reviewId) => {
  await db.query(
    'UPDATE ratings SET reply_text = NULL, replied_at = NULL, reply_edited_at = NULL WHERE id = ?',
    [reviewId]
  );
};

module.exports = {
  upsert,
  findRatersByOwner,
  findByUserAndStore,
  saveReview,
  deleteByUserAndStore,
  getDistribution,
  listReviews,
  listReviewsForOwner,
  findReviewForOwner,
  saveReply,
  clearReply,
};
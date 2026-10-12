const db = require('../config/db');

// A review that can be voted on, with the status of its store
const findVotable = async (reviewId, storeId) => {
  const [rows] = await db.query(
    `SELECT r.id, r.user_id, r.review_text, s.status AS store_status
       FROM ratings r
       JOIN stores s ON s.id = r.store_id
      WHERE r.id = ? AND r.store_id = ?`,
    [reviewId, storeId]
  );
  return rows[0] || null;
};

// INSERT IGNORE + UNIQUE(rating_id, user_id): voting twice, even at the same instant, adds one row
const add = async (userId, reviewId, now) => {
  await db.query('INSERT IGNORE INTO review_votes (rating_id, user_id, created_at) VALUES (?, ?, ?)', [
    reviewId,
    userId,
    now,
  ]);
};

const remove = async (userId, reviewId) => {
  await db.query('DELETE FROM review_votes WHERE rating_id = ? AND user_id = ?', [reviewId, userId]);
};

const count = async (reviewId) => {
  const [[row]] = await db.query('SELECT COUNT(*) AS total FROM review_votes WHERE rating_id = ?', [reviewId]);
  return Number(row.total);
};

module.exports = { findVotable, add, remove, count };
const db = require('../config/db');

const create = async ({ userId, type, tokenHash, expiresAt, createdAt }) => {
  await db.query(
    'INSERT INTO auth_tokens (user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, type, tokenHash, expiresAt, createdAt]
  );
};

const findByHash = async (tokenHash) => {
  const [rows] = await db.query('SELECT * FROM auth_tokens WHERE token_hash = ?', [tokenHash]);
  return rows[0] || null;
};

// The newest token of this kind for this user (used for the cooldown)
const findLatest = async (userId, type) => {
  const [rows] = await db.query(
    'SELECT created_at FROM auth_tokens WHERE user_id = ? AND type = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    [userId, type]
  );
  return rows[0] || null;
};

// Marks a token as used, but only if nobody used it first. Returns true if WE used it.
// Two people clicking the same link at the same instant: only one gets "true".
const consume = async (id, now) => {
  const [result] = await db.query('UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL', [now, id]);
  return result.affectedRows === 1;
};

// Cancels every unused link of this kind (so only the newest link works)
const invalidateAllForUser = async (userId, type, now) => {
  await db.query('UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND type = ? AND used_at IS NULL', [
    now,
    userId,
    type,
  ]);
};

const deleteExpired = async (now) => {
  const [result] = await db.query('DELETE FROM auth_tokens WHERE expires_at < ?', [now]);
  return result.affectedRows;
};

module.exports = { create, findByHash, findLatest, consume, invalidateAllForUser, deleteExpired };
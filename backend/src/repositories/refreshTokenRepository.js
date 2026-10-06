const db = require('../config/db');

const create = async ({ userId, familyId, tokenHash, expiresAt, ip, userAgent }) => {
  await db.query(
    `INSERT INTO refresh_tokens
       (user_id, family_id, token_hash, expires_at, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, familyId, tokenHash, expiresAt, ip || null, userAgent || null, new Date()]
  );
};

const findByHash = async (tokenHash) => {
  const [rows] = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
  return rows[0] || null;
};

// Revokes ONE token, but only if it is still active. Returns true if WE revoked it.
// Two requests racing with the same token: only one gets "true".
const revokeIfActive = async (id, reason, now) => {
  const [result] = await db.query(
    'UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL',
    [now, reason, id]
  );
  return result.affectedRows === 1;
};

// Ends a whole session (every token in the family)
const revokeFamily = async (familyId, reason, now) => {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = ? WHERE family_id = ? AND revoked_at IS NULL',
    [now, reason, familyId]
  );
};

// Ends every session of a user, optionally keeping one (the current device)
const revokeAllForUser = async (userId, reason, now, exceptFamilyId = null) => {
  let sql = 'UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL';
  const params = [now, reason, userId];
  if (exceptFamilyId) {
    sql += ' AND family_id <> ?';
    params.push(exceptFamilyId);
  }
  await db.query(sql, params);
};

// Housekeeping: expired tokens are useless, so delete them
const deleteExpired = async (now) => {
  const [result] = await db.query('DELETE FROM refresh_tokens WHERE expires_at < ?', [now]);
  return result.affectedRows;
};

module.exports = { create, findByHash, revokeIfActive, revokeFamily, revokeAllForUser, deleteExpired };
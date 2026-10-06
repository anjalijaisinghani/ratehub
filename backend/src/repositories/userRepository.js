const db = require('../config/db');
const { resolveSort, likePattern } = require('../utils/sql');

const SORT_COLUMNS = { name: 'name', email: 'email', address: 'address', role: 'role' };

const findByEmail = async (email) => {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
};

const findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

// Same as findById but WITHOUT password_hash, safe to send to the admin UI
const findPublicById = async (id) => {
  const [rows] = await db.query(
    'SELECT id, name, email, address, role FROM users WHERE id = ?',
    [id]
  );
  return rows[0] || null;
};

// Returns the id of the new row
const create = async ({ name, email, passwordHash, address, role }) => {
  const [result] = await db.query(
    'INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, address, role]
  );
  return result.insertId;
};

const updatePassword = async (id, passwordHash) => {
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
};

// Filters arrive already cleaned by the service
const list = async ({ name, email, address, role, sortBy, order }) => {
  const { column, direction } = resolveSort(sortBy, order, SORT_COLUMNS, 'name');

  let sql = 'SELECT id, name, email, address, role FROM users WHERE 1=1';
  const params = [];

  if (name) { sql += ' AND name LIKE ?'; params.push(likePattern(name)); }
  if (email) { sql += ' AND email LIKE ?'; params.push(likePattern(email)); }
  if (address) { sql += ' AND address LIKE ?'; params.push(likePattern(address)); }
  if (role) { sql += ' AND role = ?'; params.push(role); }

  // column and direction come from our own whitelist, never from the user
  sql += ` ORDER BY ${column} ${direction}`;

  const [rows] = await db.query(sql, params);
  return rows;
};

module.exports = { findByEmail, findById, findPublicById, create, updatePassword, list };
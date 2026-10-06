const db = require('../config/db');
const { resolveSort } = require('../utils/sql');

const RATER_SORT = {
  name: 'u.name',
  email: 'u.email',
  rating: 'r.rating',
  date: 'r.updated_at',
};

// Insert a new rating, or update it if this user already rated this store.
// Works because of UNIQUE(user_id, store_id) in the table.
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

module.exports = { upsert, findRatersByOwner };
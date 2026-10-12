const db = require('../config/db');
const { resolveSort, likePattern } = require('../utils/sql');
const { boundingBox } = require('../utils/geo');

// Average rating and number of ratings per store, calculated once in a sub-query


const RATING_STATS = `
  LEFT JOIN (
    SELECT
      store_id,
      AVG(rating) AS avg_rating,
      COUNT(*) AS rating_count,
      COUNT(review_text) AS review_count
    FROM ratings
    GROUP BY store_id
  ) rs ON rs.store_id = s.id`;

// Is the store open at the given time of day? 1 = open, 0 = closed, NULL = no opening hours.
// Handles overnight hours (20:00 to 02:00). Opening = closing means "open 24 hours".
// It has 4 placeholders: pass openNowParams(time).
const OPEN_NOW_SQL = `(CASE
    WHEN s.opening_time IS NULL OR s.closing_time IS NULL THEN NULL
    WHEN s.opening_time = s.closing_time THEN 1
    WHEN s.opening_time < s.closing_time
         AND CAST(? AS TIME) >= s.opening_time AND CAST(? AS TIME) < s.closing_time THEN 1
    WHEN s.opening_time > s.closing_time
         AND (CAST(? AS TIME) >= s.opening_time OR CAST(? AS TIME) < s.closing_time) THEN 1
    ELSE 0
  END)`;
const openNowParams = (time) => [time, time, time, time];

// Straight-line ("as the crow flies") distance in km between the store and a point on the
// globe: the Haversine formula. LEAST(1, ...) protects ASIN from tiny floating-point errors
// that could push the value just above 1 (ASIN would then return NULL and drop the store).
// Stores without coordinates give NULL. It has 3 placeholders: pass distanceParams(location).
const DISTANCE_SQL = `(6371 * 2 * ASIN(SQRT(LEAST(1,
    POWER(SIN(RADIANS(s.latitude - ?) / 2), 2)
    + COS(RADIANS(?)) * COS(RADIANS(s.latitude)) * POWER(SIN(RADIANS(s.longitude - ?) / 2), 2)
  ))))`;
const distanceParams = ({ lat, lng }) => [lat, lat, lng];

const PUBLIC_COLUMNS = `
  s.id, s.name, s.address, s.city, s.state, s.pincode, s.category, s.phone, s.website,
  s.image_url AS imageUrl, s.latitude, s.longitude,
  s.opening_time AS openingTime, s.closing_time AS closingTime`;
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, s.email, s.status, s.created_at AS createdAt`;

// Public names -> real SQL (only these can be used for sorting)
const USER_SORT = {
  name: 's.name',
  address: 's.address',
  city: 's.city',
  overallRating: 'rs.avg_rating',
  myRating: 'mine.rating',
  ratingCount: 'COALESCE(rs.rating_count, 0)',
  newest: 's.created_at',
  distance: 'distanceKm', // the alias from the SELECT list
};
const ADMIN_SORT = {
  name: 's.name',
  email: 's.email',
  address: 's.address',
  city: 's.city',
  category: 's.category',
  status: 's.status',
  rating: 'rs.avg_rating',
  ratingCount: 'COALESCE(rs.rating_count, 0)',
  newest: 's.created_at',
};
// Unrated stores (NULL) and stores without coordinates always go to the END, in both directions
const NULLABLE_SORTS = new Set(['overallRating', 'myRating', 'rating', 'distance']);

// Builds the WHERE part once. It is used by BOTH the page query and the count query.
// Every ? is added to "params" in the same order as its clause, so the order always matches.
const buildWhere = (f, nowTime, publicOnly) => {
  const clauses = [];
  const params = [];

  if (publicOnly) clauses.push("s.status = 'ACTIVE'");

  const like = (column, value) => {
    clauses.push(`${column} LIKE ?`);
    params.push(likePattern(value));
  };
  if (f.name) like('s.name', f.name);
  if (f.email) like('s.email', f.email);
  if (f.address) like('s.address', f.address);
  if (f.city) like('s.city', f.city);

  if (f.search) {
    clauses.push('(s.name LIKE ? OR s.address LIKE ? OR s.city LIKE ?)');
    const p = likePattern(f.search);
    params.push(p, p, p);
  }
  if (f.category) {
    clauses.push('s.category = ?');
    params.push(f.category);
  }
  if (f.status) {
    clauses.push('s.status = ?');
    params.push(f.status);
  }
  if (f.minRating) {
    clauses.push('rs.avg_rating >= ?');
    params.push(f.minRating);
  }
  if (f.openNow) {
    clauses.push(`${OPEN_NOW_SQL} = 1`);
    params.push(...openNowParams(nowTime));
  }

  // Radius search, in two steps: 1) cheap box (can use the index), 2) exact distance
  if (f.location && f.location.radiusKm) {
    const { lat, lng, radiusKm } = f.location;
    const box = boundingBox(lat, lng, radiusKm);
    const lngSql = box.lngRanges.map(() => 's.longitude BETWEEN ? AND ?').join(' OR ');

    clauses.push(`s.latitude BETWEEN ? AND ? AND (${lngSql})`);
    params.push(box.minLat, box.maxLat, ...box.lngRanges.flat());

    clauses.push(`${DISTANCE_SQL} <= ?`);
    params.push(...distanceParams(f.location), radiusKm);
  }

  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

// "ORDER BY ..." with a unique tie-breaker (s.id), so pages never repeat or skip a store
const buildOrderBy = (sortBy, order, allowed) => {
  const sort = resolveSort(sortBy, order, allowed, 'name');
  const nullsLast = NULLABLE_SORTS.has(sort.key) ? `${sort.column} IS NULL, ` : '';
  return `ORDER BY ${nullsLast}${sort.column} ${sort.direction}, s.id ASC`;
};

const FIELDS_SQL = `name, email, address, category, description, phone, city, state, pincode,
  website, image_url, latitude, longitude, opening_time, closing_time`;

const create = async (s) => {
  const [result] = await db.query(
    `INSERT INTO stores (owner_id, ${FIELDS_SQL}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.ownerId, s.name, s.email, s.address, s.category, s.description, s.phone, s.city, s.state,
      s.pincode, s.website, s.imageUrl, s.latitude, s.longitude, s.openingTime, s.closingTime,
    ]
  );
  return result.insertId;
};

// Full update of the editable fields (the owner cannot be changed here)
const update = async (id, s) => {
  await db.query(
    `UPDATE stores SET name = ?, email = ?, address = ?, category = ?, description = ?, phone = ?,
            city = ?, state = ?, pincode = ?, website = ?, image_url = ?, latitude = ?, longitude = ?,
            opening_time = ?, closing_time = ?, status = ?
      WHERE id = ?`,
    [
      s.name, s.email, s.address, s.category, s.description, s.phone, s.city, s.state, s.pincode,
      s.website, s.imageUrl, s.latitude, s.longitude, s.openingTime, s.closingTime, s.status, id,
    ]
  );
};

const findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM stores WHERE id = ?', [id]);
  return rows[0] || null;
};

// A store plus its owner's name and email (admin edit page)
const findDetailsById = async (id) => {
  const [rows] = await db.query(
    `SELECT ${ADMIN_COLUMNS}, s.description, s.owner_id AS ownerId,
            u.name AS ownerName, u.email AS ownerEmail
       FROM stores s
       JOIN users u ON u.id = s.owner_id
      WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const countByOwner = async (ownerId) => {
  const [[row]] = await db.query('SELECT COUNT(*) AS total FROM stores WHERE owner_id = ?', [ownerId]);
  return row.total;
};

// Admin table: every store (also INACTIVE ones), one page at a time
const listForAdmin = async (filters, { sortBy, order, limit, offset }) => {
  const where = buildWhere(filters, null, false);

  const [rows] = await db.query(
    `SELECT ${ADMIN_COLUMNS},
            ROUND(rs.avg_rating, 1) AS rating,
            COALESCE(rs.rating_count, 0) AS ratingCount
       FROM stores s
       ${RATING_STATS}
       ${where.sql}
       ${buildOrderBy(sortBy, order, ADMIN_SORT)}
       LIMIT ? OFFSET ?`,
    [...where.params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM stores s ${RATING_STATS} ${where.sql}`,
    where.params
  );
  return { rows, total };
};

// Store discovery for a normal user: only ACTIVE stores, with the user's own rating.
// "nowTime" (HH:MM:SS in the app timezone) is passed in, so tests can use any time of day.
// filters.location = { lat, lng, radiusKm } is optional.
const listForUser = async (userId, filters, { sortBy, order, limit, offset }, nowTime) => {
  const where = buildWhere(filters, nowTime, true);
  const location = filters.location || null;

  const distanceSelect = location ? `ROUND(${DISTANCE_SQL}, 2)` : 'NULL';
  const distanceSelectParams = location ? distanceParams(location) : [];

  // Parameter order = the order the ? appear in the SQL text:
  // SELECT (open-now, distance) -> JOIN (user id) -> WHERE -> LIMIT
  const [rows] = await db.query(
    `SELECT ${PUBLIC_COLUMNS},
            ${OPEN_NOW_SQL} AS isOpenNow,
            ${distanceSelect} AS distanceKm,
            ROUND(rs.avg_rating, 1) AS overallRating,
            COALESCE(rs.rating_count, 0) AS ratingCount,
            COALESCE(rs.review_count, 0) AS reviewCount,
            mine.rating AS myRating
       FROM stores s
       ${RATING_STATS}
       LEFT JOIN ratings mine ON mine.store_id = s.id AND mine.user_id = ?
       ${where.sql}
       ${buildOrderBy(sortBy, order, USER_SORT)}
       LIMIT ? OFFSET ?`,
    [...openNowParams(nowTime), ...distanceSelectParams, userId, ...where.params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM stores s ${RATING_STATS} ${where.sql}`,
    where.params
  );
  return { rows, total };
};

// One ACTIVE store for the store page: profile, rating stats and the viewer's own rating.
// Returns null if the store does not exist or is hidden (INACTIVE).
const findActiveWithStats = async (userId, storeId, nowTime) => {
  const [rows] = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, s.description,
            ${OPEN_NOW_SQL} AS isOpenNow,
            NULL AS distanceKm,
            ROUND(rs.avg_rating, 1) AS overallRating,
            COALESCE(rs.rating_count, 0) AS ratingCount,
            COALESCE(rs.review_count, 0) AS reviewCount,
            mine.rating AS myRating
       FROM stores s
       ${RATING_STATS}
       LEFT JOIN ratings mine ON mine.store_id = s.id AND mine.user_id = ?
      WHERE s.id = ? AND s.status = 'ACTIVE'`,
    [...openNowParams(nowTime), userId, storeId]
  );
  return rows[0] || null;
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
  update,
  findById,
  findDetailsById,
  countByOwner,
  listForAdmin,
  listForUser,
  findActiveWithStats,
  findWithStatsByOwner,
  getAverageRatingForOwner,
};
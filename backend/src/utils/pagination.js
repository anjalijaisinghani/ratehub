// Turns ?page=2&limit=10 into safe numbers. Bad input falls back to defaults.
const toInt = (value, fallback, min, max) => {
  const n = Number.parseInt(typeof value === 'string' ? value : undefined, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.min(n, max);
};

const parsePagination = (query, { defaultLimit = 12, maxLimit = 50 } = {}) => {
  const page = toInt(query.page, 1, 1, 1000000);
  const limit = toInt(query.limit, defaultLimit, 1, maxLimit);
  return { page, limit, offset: (page - 1) * limit };
};

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

module.exports = { parsePagination, buildPagination };
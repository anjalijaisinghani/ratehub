const AppError = require('../utils/AppError');
const { cleanString } = require('../utils/sql');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { parseId } = require('../utils/ids');
const { nowTimeInZone } = require('../utils/time');
const { toPublicStore } = require('../utils/storeMapper');
const { STORE_CATEGORIES, STORE_STATUS } = require('../constants/storeCategories');
const appConfig = require('../config/app');
const storeRepository = require('../repositories/storeRepository');
const ratingRepository = require('../repositories/ratingRepository');

const isTrue = (v) => v === 'true' || v === '1';

// Store discovery: search + filters + sorting + pages
const listForUser = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);

  const category = cleanString(query.category).toUpperCase();
  if (category && !STORE_CATEGORIES.includes(category)) {
    throw AppError.badRequest('Invalid category', 'INVALID_CATEGORY');
  }

  let minRating = null;
  const minRatingText = cleanString(query.minRating);
  if (minRatingText) {
    const n = Number(minRatingText);
    if (!(n >= 1 && n <= 5)) {
      throw AppError.badRequest('minRating must be between 1 and 5', 'INVALID_MIN_RATING');
    }
    minRating = n;
  }

  const filters = {
    name: cleanString(query.name),
    address: cleanString(query.address),
    search: cleanString(query.search),
    city: cleanString(query.city),
    category,
    minRating,
    openNow: isTrue(cleanString(query.openNow)),
  };

  const nowTime = nowTimeInZone(appConfig.timezone);
  const { rows, total } = await storeRepository.listForUser(
    userId,
    filters,
    { sortBy: query.sortBy, order: query.order, limit, offset },
    nowTime
  );

  return { items: rows.map(toPublicStore), pagination: buildPagination(page, limit, total) };
};

// Submit a new rating, or modify the existing one (one rating per user per store)
const submitRating = async (userId, storeId, rating) => {
  const id = parseId(storeId);
  if (!id) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }

  // A hidden (INACTIVE) store behaves as if it did not exist
  const store = await storeRepository.findById(id);
  if (!store || store.status !== STORE_STATUS.ACTIVE) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }

  await ratingRepository.upsert({ userId, storeId: id, rating });
  return { storeId: id, rating };
};

module.exports = { listForUser, submitRating };
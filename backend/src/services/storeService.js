const AppError = require('../utils/AppError');
const { cleanString } = require('../utils/sql');
const storeRepository = require('../repositories/storeRepository');
const ratingRepository = require('../repositories/ratingRepository');

const listForUser = (userId, query) =>
  storeRepository.listForUser(userId, {
    name: cleanString(query.name),
    address: cleanString(query.address),
    sortBy: query.sortBy,
    order: query.order,
  });

// Submit a new rating, or modify the existing one (one rating per user per store)
const submitRating = async (userId, storeId, rating) => {
  const id = Number(storeId);
  if (!Number.isInteger(id) || id < 1) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }

  const store = await storeRepository.findById(id);
  if (!store) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }

  await ratingRepository.upsert({ userId, storeId: id, rating });
  return { storeId: id, rating };
};

module.exports = { listForUser, submitRating };
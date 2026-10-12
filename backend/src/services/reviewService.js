const AppError = require('../utils/AppError');
const { cleanString } = require('../utils/sql');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { parseId } = require('../utils/ids');
const { nowTimeInZone } = require('../utils/time');
const { normalizeReviewText } = require('../utils/reviewText');
const { toPublicStore } = require('../utils/storeMapper');
const { toReview, toMyReview, buildDistribution } = require('../utils/reviewMapper');
const { STORE_STATUS } = require('../constants/storeCategories');
const appConfig = require('../config/app');
const storeRepository = require('../repositories/storeRepository');
const ratingRepository = require('../repositories/ratingRepository');

const RATING_FILTER = /^[1-5]$/;

const storeNotFound = () => AppError.notFound('Store not found', 'STORE_NOT_FOUND');

// Returns the id of an ACTIVE store, or throws 404 (hidden stores behave as if they did not exist)
const requireActiveStore = async (storeId) => {
  const id = parseId(storeId);
  if (!id) throw storeNotFound();

  const store = await storeRepository.findById(id);
  if (!store || store.status !== STORE_STATUS.ACTIVE) throw storeNotFound();
  return id;
};

// ---------- Store page: profile + rating summary + my own review ----------
const getStoreDetails = async (userId, storeId) => {
  const id = parseId(storeId);
  if (!id) throw storeNotFound();

  const row = await storeRepository.findActiveWithStats(userId, id, nowTimeInZone(appConfig.timezone));
  if (!row) throw storeNotFound();

  const [distributionRows, mine] = await Promise.all([
    ratingRepository.getDistribution(id),
    ratingRepository.findByUserAndStore(userId, id),
  ]);

  return {
    ...toPublicStore(row),
    distribution: buildDistribution(distributionRows),
    // A rating without text is not a review
    myReview: mine && mine.review_text ? toMyReview(mine) : null,
  };
};

// ---------- Reviews of a store: filter by stars, sort, pages ----------
const listReviews = async (userId, storeId, query) => {
  const id = await requireActiveStore(storeId);
  const { page, limit, offset } = parsePagination(query, { defaultLimit: 10 });

  const ratingText = cleanString(query.rating);
  if (ratingText && !RATING_FILTER.test(ratingText)) {
    throw AppError.badRequest('rating must be a whole number from 1 to 5', 'INVALID_RATING_FILTER');
  }

  // Newest first, or highest first, unless the client asks for ascending
  const order = typeof query.order === 'string' ? query.order : 'desc';

  const { rows, total } = await ratingRepository.listReviews(id, userId, {
    rating: ratingText ? Number(ratingText) : null,
    sortBy: query.sortBy,
    order,
    limit,
    offset,
  });

  return { items: rows.map(toReview), pagination: buildPagination(page, limit, total) };
};

// ---------- Post a new review, or edit mine ----------
const saveReview = async (userId, storeId, { rating, text }) => {
  const id = await requireActiveStore(storeId);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw AppError.badRequest('Rating must be a whole number between 1 and 5', 'INVALID_RATING');
  }
  const cleanText = normalizeReviewText(text);

  const before = await ratingRepository.findByUserAndStore(userId, id);
  const hadReview = !!(before && before.review_text);
  const now = new Date();

  // First time with text: both dates start now. Editing: keep the original date, and mark
  // "edited" only if the TEXT really changed (changing only the stars is not an edit).
  let reviewedAt = now;
  let editedAt = null;
  if (hadReview) {
    reviewedAt = before.reviewed_at;
    editedAt = before.review_text === cleanText ? before.review_edited_at : now;
  }

  await ratingRepository.saveReview({ userId, storeId: id, rating, text: cleanText, reviewedAt, editedAt });

  const saved = await ratingRepository.findByUserAndStore(userId, id);
  return { review: toMyReview(saved), created: !hadReview };
};

// ---------- Delete my rating and review ----------
const deleteReview = async (userId, storeId) => {
  const id = parseId(storeId);
  if (!id) throw storeNotFound();

  const removed = await ratingRepository.deleteByUserAndStore(userId, id);
  if (!removed) {
    throw AppError.notFound('You have not reviewed this store', 'REVIEW_NOT_FOUND');
  }
};

module.exports = { getStoreDetails, listReviews, saveReview, deleteReview };
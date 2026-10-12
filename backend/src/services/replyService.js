const AppError = require('../utils/AppError');
const { cleanString } = require('../utils/sql');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { parseId } = require('../utils/ids');
const { normalizeReplyText } = require('../utils/reviewText');
const { toOwnerReview } = require('../utils/reviewMapper');
const ratingRepository = require('../repositories/ratingRepository');

const RATING_FILTER = /^[1-5]$/;

// Wrong id, someone else's review, a stars-only rating: all look the same (404).
// An owner must not be able to find out which reviews exist in other stores.
const reviewNotFound = () => AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');

// ---------- Reviews of MY store ----------
const listForOwner = async (ownerId, query) => {
  const { page, limit, offset } = parsePagination(query, { defaultLimit: 10 });

  const ratingText = cleanString(query.rating);
  if (ratingText && !RATING_FILTER.test(ratingText)) {
    throw AppError.badRequest('rating must be a whole number from 1 to 5', 'INVALID_RATING_FILTER');
  }

  const repliedText = cleanString(query.replied).toLowerCase();
  if (repliedText && !['true', 'false'].includes(repliedText)) {
    throw AppError.badRequest('replied must be true or false', 'INVALID_REPLIED_FILTER');
  }

  const { rows, total } = await ratingRepository.listReviewsForOwner(ownerId, {
    rating: ratingText ? Number(ratingText) : null,
    replied: repliedText === '' ? null : repliedText === 'true',
    sortBy: query.sortBy,
    order: typeof query.order === 'string' ? query.order : 'desc',
    limit,
    offset,
  });

  return { items: rows.map(toOwnerReview), pagination: buildPagination(page, limit, total) };
};

// ---------- Post a reply, or edit it ----------
const saveReply = async (ownerId, reviewId, text) => {
  const id = parseId(reviewId);
  if (!id) throw reviewNotFound();

  // The ownership check happens inside this query (a join on the owner's own store)
  const review = await ratingRepository.findReviewForOwner(ownerId, id);
  if (!review) throw reviewNotFound();

  const cleanText = normalizeReplyText(text);

  const hadReply = !!review.reply_text;
  const now = new Date();

  // First reply: dated now. Editing: keep the original date, and mark "edited"
  // only if the TEXT really changed.
  const repliedAt = hadReply ? review.replied_at : now;
  const editedAt = hadReply ? (review.reply_text === cleanText ? review.reply_edited_at : now) : null;

//   await ratingRepository.saveReply(id, cleanText, repliedAt, editedAt);

//   return { reply: { text: cleanText, repliedAt, editedAt: editedAt ?? null }, created: !hadReply };

  await ratingRepository.saveReply(id, cleanText, repliedAt, editedAt);

  // Return the timestamps exactly as stored by MySQL.
  const savedReview = await ratingRepository.findReviewForOwner(ownerId, id);

  return {
    reply: {
      text: cleanText,
      repliedAt: savedReview.replied_at,
      editedAt: savedReview.reply_edited_at ?? null,
    },
    created: !hadReply,
  };
};

// ---------- Delete my reply ----------
const deleteReply = async (ownerId, reviewId) => {
  const id = parseId(reviewId);
  if (!id) throw reviewNotFound();

  const review = await ratingRepository.findReviewForOwner(ownerId, id);
  if (!review) throw reviewNotFound();
  if (!review.reply_text) {
    throw AppError.notFound('There is no reply to delete', 'REPLY_NOT_FOUND');
  }

  await ratingRepository.clearReply(id);
};

module.exports = { listForOwner, saveReply, deleteReply };
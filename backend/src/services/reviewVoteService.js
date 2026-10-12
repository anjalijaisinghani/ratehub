const AppError = require('../utils/AppError');
const { parseId } = require('../utils/ids');
const { STORE_STATUS } = require('../constants/storeCategories');
const reviewVoteRepository = require('../repositories/reviewVoteRepository');

const reviewNotFound = () => AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');

// helpful = true adds my vote, false removes it. Both can be repeated safely (idempotent).
const setHelpful = async (userId, storeId, reviewId, helpful) => {
  const sid = parseId(storeId);
  const rid = parseId(reviewId);
  if (!sid || !rid) throw reviewNotFound();

  // The review must belong to THIS store, have text, and the store must be visible
  const review = await reviewVoteRepository.findVotable(rid, sid);
  if (!review || !review.review_text || review.store_status !== STORE_STATUS.ACTIVE) {
    throw reviewNotFound();
  }

  if (review.user_id === userId) {
    throw AppError.forbidden('You cannot mark your own review as helpful', 'CANNOT_VOTE_OWN_REVIEW');
  }

  if (helpful) {
    await reviewVoteRepository.add(userId, rid, new Date());
  } else {
    await reviewVoteRepository.remove(userId, rid);
  }

  return { helpfulCount: await reviewVoteRepository.count(rid), iVoted: helpful };
};

module.exports = { setHelpful };
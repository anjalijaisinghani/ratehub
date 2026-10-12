const reviewService = require('../services/reviewService');
const reviewVoteService = require('../services/reviewVoteService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/response');

// GET /api/v1/stores/:storeId
const getStore = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.getStoreDetails(req.user.id, req.params.storeId));
});

// GET /api/v1/stores/:storeId/reviews?rating=&sortBy=newest|rating|helpful&order=&page=&limit=
const listReviews = asyncHandler(async (req, res) => {
  const { items, pagination } = await reviewService.listReviews(req.user.id, req.params.storeId, req.query);
  sendPaginated(res, items, pagination);
});

// PUT /api/v1/stores/:storeId/review   body: { "rating": 4, "text": "..." }
// The author is ALWAYS the user in the token. A "userId" in the body is ignored.
const saveReview = asyncHandler(async (req, res) => {
  const { review, created } = await reviewService.saveReview(req.user.id, req.params.storeId, {
    rating: req.body.rating,
    text: req.body.text,
  });
  sendSuccess(res, { review }, created ? 'Review posted' : 'Review updated', created ? 201 : 200);
});

// DELETE /api/v1/stores/:storeId/review
const deleteReview = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.user.id, req.params.storeId);
  sendSuccess(res, null, 'Your review was deleted');
});

// PUT /api/v1/stores/:storeId/reviews/:reviewId/helpful
const markHelpful = asyncHandler(async (req, res) => {
  const result = await reviewVoteService.setHelpful(req.user.id, req.params.storeId, req.params.reviewId, true);
  sendSuccess(res, result);
});

// DELETE /api/v1/stores/:storeId/reviews/:reviewId/helpful
const unmarkHelpful = asyncHandler(async (req, res) => {
  const result = await reviewVoteService.setHelpful(req.user.id, req.params.storeId, req.params.reviewId, false);
  sendSuccess(res, result);
});

module.exports = { getStore, listReviews, saveReview, deleteReview, markHelpful, unmarkHelpful };
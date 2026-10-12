const replyService = require('../services/replyService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/response');

// GET /api/v1/owner/reviews?replied=true|false&rating=&sortBy=newest|rating|helpful&order=&page=&limit=
// The owner is ALWAYS the user in the token.
const listReviews = asyncHandler(async (req, res) => {
  const { items, pagination } = await replyService.listForOwner(req.user.id, req.query);
  sendPaginated(res, items, pagination);
});

// PUT /api/v1/owner/reviews/:reviewId/reply   body: { "text": "..." }
const saveReply = asyncHandler(async (req, res) => {
  const { reply, created } = await replyService.saveReply(req.user.id, req.params.reviewId, req.body.text);
  sendSuccess(res, { reply }, created ? 'Reply posted' : 'Reply updated', created ? 201 : 200);
});

// DELETE /api/v1/owner/reviews/:reviewId/reply
const deleteReply = asyncHandler(async (req, res) => {
  await replyService.deleteReply(req.user.id, req.params.reviewId);
  sendSuccess(res, null, 'Reply deleted');
});

module.exports = { listReviews, saveReply, deleteReply };
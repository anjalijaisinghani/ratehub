const storeService = require('../services/storeService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/stores?name=&address=&sortBy=&order=
const listStoresForUser = asyncHandler(async (req, res) => {
  sendSuccess(res, await storeService.listForUser(req.user.id, req.query));
});

// POST /api/v1/stores/:storeId/rating   body: { "rating": 4 }
const submitRating = asyncHandler(async (req, res) => {
  const result = await storeService.submitRating(req.user.id, req.params.storeId, req.body.rating);
  sendSuccess(res, result, 'Rating saved successfully');
});

module.exports = { listStoresForUser, submitRating };
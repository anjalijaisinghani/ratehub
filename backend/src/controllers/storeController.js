const storeService = require('../services/storeService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/response');

// GET /api/v1/stores?search=&category=&city=&minRating=&openNow=&lat=&lng=&radius=&sortBy=&order=&page=&limit=
const listStoresForUser = asyncHandler(async (req, res) => {
  const { items, pagination } = await storeService.listForUser(req.user.id, req.query);
  sendPaginated(res, items, pagination);
});

// GET /api/v1/stores/nearby?lat=&lng=&radius=5   (radius in km, default 5, max 100)
const listNearbyStores = asyncHandler(async (req, res) => {
  const { items, pagination } = await storeService.listNearby(req.user.id, req.query);
  sendPaginated(res, items, pagination);
});

// POST /api/v1/stores/:storeId/rating   body: { "rating": 4 }
const submitRating = asyncHandler(async (req, res) => {
  const result = await storeService.submitRating(req.user.id, req.params.storeId, req.body.rating);
  sendSuccess(res, result, 'Rating saved successfully');
});

module.exports = { listStoresForUser, listNearbyStores, submitRating };
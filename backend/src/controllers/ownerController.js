const ownerService = require('../services/ownerService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/owner/dashboard?sortBy=&order=
const getOwnerDashboard = asyncHandler(async (req, res) => {
  sendSuccess(res, await ownerService.getDashboard(req.user.id, req.query));
});

module.exports = { getOwnerDashboard };
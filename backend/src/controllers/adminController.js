const adminService = require('../services/adminService');
const analyticsService = require('../services/analyticsService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/admin/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.getDashboardTotals());
});

// GET /api/v1/admin/analytics
const getAnalytics = asyncHandler(async (req, res) => {
  sendSuccess(res, await analyticsService.getAdminAnalytics());
});

// POST /api/v1/admin/users
const addUser = asyncHandler(async (req, res) => {
  const { name, email, address, password, role } = req.body;
  const user = await adminService.addUser({ name, email, address, password, role });
  sendSuccess(res, { user }, 'User created successfully', 201);
});

// POST /api/v1/admin/stores
const addStore = asyncHandler(async (req, res) => {
  const { name, email, address, ownerId } = req.body;
  const store = await adminService.addStore({ name, email, address, ownerId });
  sendSuccess(res, { store }, 'Store created successfully', 201);
});

// GET /api/v1/admin/users?name=&email=&address=&role=&sortBy=&order=
const listUsers = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.listUsers(req.query));
});

// GET /api/v1/admin/stores?name=&email=&address=&sortBy=&order=
const listStores = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.listStores(req.query));
});

// GET /api/v1/admin/users/:id
const getUserDetails = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.getUserDetails(req.params.id));
});

module.exports = {
  getDashboard,
  getAnalytics,
  addUser,
  addStore,
  listUsers,
  listStores,
  getUserDetails,
};
const adminService = require('../services/adminService');
const analyticsService = require('../services/analyticsService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { pick } = require('../utils/pick');

// The only store fields we accept from a request body
// (verification is NOT here: only the verification endpoint can change it)
const STORE_FIELDS = [
  'name', 'email', 'address', 'category', 'description', 'phone', 'city', 'state',
  'pincode', 'website', 'imageUrl', 'latitude', 'longitude', 'openingTime', 'closingTime',
];

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
  const store = await adminService.addStore(pick(req.body, [...STORE_FIELDS, 'ownerId']));
  sendSuccess(res, { store }, 'Store created successfully', 201);
});

// GET /api/v1/admin/stores/:id
const getStore = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.getStoreDetails(req.params.id));
});

// PUT /api/v1/admin/stores/:id
const updateStore = asyncHandler(async (req, res) => {
  const store = await adminService.updateStore(req.params.id, pick(req.body, [...STORE_FIELDS, 'status']));
  sendSuccess(res, { store }, 'Store updated successfully');
});

// PUT /api/v1/admin/stores/:id/verification   body: { "verified": true | false }
const setStoreVerification = asyncHandler(async (req, res) => {
  const { verified } = req.body;
  const store = await adminService.setStoreVerification(req.params.id, verified, req.user.id);
  sendSuccess(res, { store }, verified ? 'Store verified' : 'Verification removed');
});

// GET /api/v1/admin/users?name=&email=&address=&role=&sortBy=&order=
const listUsers = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.listUsers(req.query));
});

// GET /api/v1/admin/stores?name=&email=&address=&city=&category=&status=&verified=&sortBy=&order=&page=&limit=
const listStores = asyncHandler(async (req, res) => {
  const { items, pagination } = await adminService.listStores(req.query);
  sendPaginated(res, items, pagination);
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
  getStore,
  updateStore,
  setStoreVerification,
  listUsers,
  listStores,
  getUserDetails,
};
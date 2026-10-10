const express = require('express');
const {
  getDashboard,
  getAnalytics,
  addUser,
  addStore,
  getStore,
  updateStore,
  listUsers,
  listStores,
  getUserDetails,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  nameRule,
  emailRule,
  addressRule,
  passwordRule,
  roleRule,
  storeNameRule,
  ownerIdRule,
  handleValidation,
} = require('../utils/validators');
const { categoryRule, statusRule, storeProfileRules } = require('../utils/storeValidators');

const router = express.Router();

// Every route in this file needs: logged in + ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);

router.post(
  '/users',
  [nameRule, emailRule, addressRule, passwordRule('password'), roleRule, handleValidation],
  addUser
);

router.post(
  '/stores',
  [
    storeNameRule,
    emailRule,
    addressRule,
    ownerIdRule,
    categoryRule(false),
    ...storeProfileRules,
    handleValidation,
  ],
  addStore
);

router.get('/stores/:id', getStore);
router.put(
  '/stores/:id',
  [
    storeNameRule,
    emailRule,
    addressRule,
    categoryRule(true),
    statusRule,
    ...storeProfileRules,
    handleValidation,
  ],
  updateStore
);

router.get('/users', listUsers);
router.get('/users/:id', getUserDetails);
router.get('/stores', listStores);

module.exports = router;
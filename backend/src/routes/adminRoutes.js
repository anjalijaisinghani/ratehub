const express = require('express');
const {
  getDashboard,
  addUser,
  addStore,
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

const router = express.Router();

// Every route in this file needs: logged in + ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', getDashboard);

router.post(
  '/users',
  [nameRule, emailRule, addressRule, passwordRule('password'), roleRule, handleValidation],
  addUser
);

router.post(
  '/stores',
  [storeNameRule, emailRule, addressRule, ownerIdRule, handleValidation],
  addStore
);

router.get('/users', listUsers);
router.get('/users/:id', getUserDetails);
router.get('/stores', listStores);

module.exports = router;
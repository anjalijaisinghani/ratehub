const express = require('express');
const { signup, login, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  nameRule,
  emailRule,
  addressRule,
  passwordRule,
  loginPasswordRule,
  handleValidation,
} = require('../utils/validators');

const router = express.Router();

router.post(
  '/signup',
  [nameRule, emailRule, addressRule, passwordRule('password'), handleValidation],
  signup
);

router.post('/login', [emailRule, loginPasswordRule, handleValidation], login);

// Protected: user must be logged in (token required)
router.put(
  '/change-password',
  [authenticate, passwordRule('newPassword'), handleValidation],
  changePassword
);

module.exports = router;
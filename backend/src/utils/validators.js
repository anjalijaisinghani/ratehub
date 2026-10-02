const { body, validationResult } = require('express-validator');

// Rules from the requirements
const nameRule = body('name')
  .trim()
  .isLength({ min: 20, max: 60 })
  .withMessage('Name must be between 20 and 60 characters');

const emailRule = body('email')
  .trim()
  .isEmail()
  .withMessage('Enter a valid email address');

const addressRule = body('address')
  .trim()
  .notEmpty()
  .withMessage('Address is required')
  .isLength({ max: 400 })
  .withMessage('Address must be at most 400 characters');

// 8-16 chars, at least one uppercase letter, at least one special character
const passwordRule = (field = 'password') =>
  body(field)
    .isLength({ min: 8, max: 16 })
    .withMessage('Password must be 8 to 16 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character');

// Runs after the rules: if any rule failed, stop and send the errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// Role must be one of the three allowed values
const roleRule = body('role')
  .isIn(['ADMIN', 'USER', 'OWNER'])
  .withMessage('Role must be ADMIN, USER or OWNER');

// Store name: required, max 255 characters
const storeNameRule = body('name')
  .trim()
  .isLength({ min: 20, max: 60 })
  .withMessage('Store name must be between 20 and 60 characters');

// Rating must be a whole number from 1 to 5
const ratingRule = body('rating')
  .isInt({ min: 1, max: 5 })
  .withMessage('Rating must be a whole number between 1 and 5')
  .toInt();

const ownerIdRule = body('ownerId')
  .isInt({ min: 1 })
  .withMessage('A valid ownerId is required');

module.exports = {
  nameRule,
  emailRule,
  addressRule,
  passwordRule,
  roleRule,
  storeNameRule,
  ownerIdRule,
  ratingRule,
  handleValidation,
};
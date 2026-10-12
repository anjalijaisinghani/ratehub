const { body } = require('express-validator');
const { REVIEW_MIN, REVIEW_MAX } = require('./reviewText');

const reviewTextRule = body('text')
  .isString()
  .withMessage('Review text is required')
  .bail()
  .trim()
  .isLength({ min: REVIEW_MIN, max: REVIEW_MAX })
  .withMessage(`Review must be between ${REVIEW_MIN} and ${REVIEW_MAX} characters`);

module.exports = { reviewTextRule };
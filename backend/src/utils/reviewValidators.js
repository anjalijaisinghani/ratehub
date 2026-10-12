const { body } = require('express-validator');
const { REVIEW_MIN, REVIEW_MAX, REPLY_MIN, REPLY_MAX } = require('./reviewText');

const reviewTextRule = body('text')
  .isString()
  .withMessage('Review text is required')
  .bail()
  .trim()
  .isLength({ min: REVIEW_MIN, max: REVIEW_MAX })
  .withMessage(`Review must be between ${REVIEW_MIN} and ${REVIEW_MAX} characters`);

const replyTextRule = body('text')
  .isString()
  .withMessage('Reply text is required')
  .bail()
  .trim()
  .isLength({ min: REPLY_MIN, max: REPLY_MAX })
  .withMessage(`Reply must be between ${REPLY_MIN} and ${REPLY_MAX} characters`);

module.exports = { reviewTextRule, replyTextRule };
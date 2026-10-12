const express = require('express');
const { listStoresForUser, listNearbyStores, submitRating } = require('../controllers/storeController');
const {
  getStore,
  listReviews,
  saveReview,
  deleteReview,
  markHelpful,
  unmarkHelpful,
} = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');
const { reviewWriteLimiter, reactionLimiter } = require('../middleware/rateLimiters');
const { ratingRule, handleValidation } = require('../utils/validators');
const { reviewTextRule } = require('../utils/reviewValidators');

const router = express.Router();

// Only logged-in normal users can use these routes
router.use(authenticate, authorize('USER'));

router.get('/nearby', listNearbyStores); // must come BEFORE '/:storeId'
router.get('/', listStoresForUser);
router.get('/:storeId', getStore);

router.get('/:storeId/reviews', listReviews);
router.put('/:storeId/review', reviewWriteLimiter, [ratingRule, reviewTextRule, handleValidation], saveReview);
router.delete('/:storeId/review', reviewWriteLimiter, deleteReview);

router.put('/:storeId/reviews/:reviewId/helpful', reactionLimiter, markHelpful);
router.delete('/:storeId/reviews/:reviewId/helpful', reactionLimiter, unmarkHelpful);

router.post('/:storeId/rating', [ratingRule, handleValidation], submitRating);

module.exports = router;
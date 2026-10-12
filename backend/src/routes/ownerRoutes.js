const express = require('express');
const { getOwnerDashboard } = require('../controllers/ownerController');
const { listReviews, saveReply, deleteReply } = require('../controllers/ownerReviewController');
const { authenticate, authorize } = require('../middleware/auth');
const { reviewWriteLimiter } = require('../middleware/rateLimiters');
const { handleValidation } = require('../utils/validators');
const { replyTextRule } = require('../utils/reviewValidators');

const router = express.Router();

// Only logged-in Store Owners can use this
router.use(authenticate, authorize('OWNER'));

router.get('/dashboard', getOwnerDashboard);

router.get('/reviews', listReviews);
router.put('/reviews/:reviewId/reply', reviewWriteLimiter, [replyTextRule, handleValidation], saveReply);
router.delete('/reviews/:reviewId/reply', reviewWriteLimiter, deleteReply);

module.exports = router;
const express = require('express');
const { listStoresForUser, submitRating } = require('../controllers/storeController');
const { authenticate, authorize } = require('../middleware/auth');
const { ratingRule, handleValidation } = require('../utils/validators');

const router = express.Router();

// Only logged-in normal users can use these routes
router.use(authenticate, authorize('USER'));

router.get('/', listStoresForUser);
router.post('/:storeId/rating', [ratingRule, handleValidation], submitRating);

module.exports = router;
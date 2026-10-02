const express = require('express');
const { getOwnerDashboard } = require('../controllers/ownerController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Only logged-in Store Owners can use this
router.use(authenticate, authorize('OWNER'));

router.get('/dashboard', getOwnerDashboard);

module.exports = router;
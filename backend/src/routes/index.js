const express = require('express');

const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const storeRoutes = require('./storeRoutes');
const ownerRoutes = require('./ownerRoutes');

// All API routes in one place
const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/stores', storeRoutes);
router.use('/owner', ownerRoutes);

module.exports = router;
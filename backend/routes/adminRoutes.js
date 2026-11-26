const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuth, ensureAdmin } = require('../middleware/authMiddleware');

// All admin routes strictly require authenticated admin session
router.use(ensureAuth, ensureAdmin);

router.get('/overview', adminController.getPlatformOverview);
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/toggle-status', adminController.toggleUserStatus);
router.get('/rooms', adminController.getAllRooms);
router.patch('/rooms/:id/close', adminController.closeRoom);

module.exports = router;

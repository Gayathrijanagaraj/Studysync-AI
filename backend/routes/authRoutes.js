const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuth, ensureGuest } = require('../middleware/authMiddleware');

// Public auth routes
router.post('/register', ensureGuest, authController.register);
router.post('/login', ensureGuest, authController.login);
router.post('/forgot-password', authController.forgotPassword);

// Protected auth routes
router.post('/logout', ensureAuth, authController.logout);
router.get('/me', ensureAuth, authController.getMe);
router.get('/profile', ensureAuth, authController.getProfile);
router.put('/profile', ensureAuth, authController.updateProfile);
router.put('/change-password', ensureAuth, authController.changePassword);

module.exports = router;

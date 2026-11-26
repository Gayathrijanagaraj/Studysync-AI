const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const sessionController = require('../controllers/sessionController');
const { ensureAuth } = require('../middleware/authMiddleware');

router.get('/stats', ensureAuth, dashboardController.getStats);
router.get('/sessions', ensureAuth, sessionController.getAllStudentSessions);

module.exports = router;

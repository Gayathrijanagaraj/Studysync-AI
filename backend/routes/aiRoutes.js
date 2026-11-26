const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { ensureAuth } = require('../middleware/authMiddleware');
const { ensureRoomMember } = require('../middleware/roomAccessMiddleware');

// All AI endpoints require authentication and active room membership
router.post('/:roomId/ask', ensureAuth, ensureRoomMember, aiController.ask);
router.post('/:roomId/explain', ensureAuth, ensureRoomMember, aiController.explain);
router.post('/:roomId/analyze', ensureAuth, ensureRoomMember, aiController.analyze);
router.post('/:roomId/gaps', ensureAuth, ensureRoomMember, aiController.gaps);

module.exports = router;

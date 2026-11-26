const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const messageController = require('../controllers/messageController');
const noteController = require('../controllers/noteController');
const whiteboardController = require('../controllers/whiteboardController');
const doubtController = require('../controllers/doubtController');
const sessionController = require('../controllers/sessionController');
const { ensureAuth } = require('../middleware/authMiddleware');
const { ensureRoomMember, ensureRoomOwner, ensureRoomActive } = require('../middleware/roomAccessMiddleware');

// Room List & Create (Protected)
router.get('/', ensureAuth, roomController.getRooms);
router.post('/', ensureAuth, roomController.createRoom);
router.post('/join', ensureAuth, roomController.joinRoom);

// Single Room Details & Lifecycle
router.get('/:roomId', ensureAuth, ensureRoomMember, roomController.getRoomById);
router.post('/:roomId/leave', ensureAuth, ensureRoomMember, roomController.leaveRoom);
router.post('/:roomId/close', ensureAuth, ensureRoomMember, ensureRoomOwner, roomController.closeRoom);
router.post('/:roomId/reopen', ensureAuth, ensureRoomMember, ensureRoomOwner, roomController.reopenRoom);
router.patch('/:roomId/status', ensureAuth, ensureRoomMember, ensureRoomOwner, roomController.updateRoomStatus);

// Real-Time Collaborative Workspace Sub-Routes
router.get('/:roomId/messages', ensureAuth, ensureRoomMember, messageController.getMessages);
router.post('/:roomId/messages', ensureAuth, ensureRoomMember, ensureRoomActive, messageController.createMessage);
router.get('/:roomId/notes', ensureAuth, ensureRoomMember, noteController.getNotes);
router.put('/:roomId/notes', ensureAuth, ensureRoomMember, ensureRoomActive, noteController.saveNotes);
router.get('/:roomId/whiteboard', ensureAuth, ensureRoomMember, whiteboardController.getWhiteboard);
router.put('/:roomId/whiteboard', ensureAuth, ensureRoomMember, ensureRoomActive, whiteboardController.saveWhiteboard);

// In-Room Doubt Tracker Sub-Routes
router.get('/:roomId/doubts', ensureAuth, ensureRoomMember, doubtController.getDoubts);
router.post('/:roomId/doubts', ensureAuth, ensureRoomMember, ensureRoomActive, doubtController.createDoubt);
router.post('/:roomId/doubts/:doubtId/upvote', ensureAuth, ensureRoomMember, ensureRoomActive, doubtController.toggleUpvote);
router.post('/:roomId/doubts/:doubtId/answers', ensureAuth, ensureRoomMember, ensureRoomActive, doubtController.addAnswer);
router.patch('/:roomId/doubts/:doubtId/resolve', ensureAuth, ensureRoomMember, ensureRoomActive, doubtController.resolveDoubt);
router.post('/:roomId/doubts/:doubtId/ai-solve', ensureAuth, ensureRoomMember, ensureRoomActive, doubtController.solveDoubtWithAI);
router.delete('/:roomId/doubts/:doubtId', ensureAuth, ensureRoomMember, ensureRoomActive, doubtController.deleteDoubt);

// Study Session & AI Recap Sub-Routes
router.get('/:roomId/session', ensureAuth, ensureRoomMember, sessionController.getActiveSession);
router.post('/:roomId/session/start', ensureAuth, ensureRoomMember, ensureRoomActive, sessionController.startSession);
router.post('/:roomId/session/pause', ensureAuth, ensureRoomMember, ensureRoomActive, sessionController.pauseSession);
router.post('/:roomId/session/resume', ensureAuth, ensureRoomMember, ensureRoomActive, sessionController.resumeSession);
router.post('/:roomId/session/end', ensureAuth, ensureRoomMember, sessionController.endSession);
router.get('/:roomId/session/history', ensureAuth, ensureRoomMember, sessionController.getSessionHistory);

module.exports = router;

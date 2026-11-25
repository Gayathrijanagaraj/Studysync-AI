const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const messageController = require('../controllers/messageController');
const noteController = require('../controllers/noteController');
const whiteboardController = require('../controllers/whiteboardController');
const { ensureAuth } = require('../middleware/authMiddleware');
const { ensureRoomMember, ensureRoomOwner } = require('../middleware/roomAccessMiddleware');

// Room List & Create (Protected)
router.get('/', ensureAuth, roomController.getRooms);
router.post('/', ensureAuth, roomController.createRoom);
router.post('/join', ensureAuth, roomController.joinRoom);

// Single Room Details & Lifecycle
router.get('/:roomId', ensureAuth, ensureRoomMember, roomController.getRoomById);
router.post('/:roomId/leave', ensureAuth, ensureRoomMember, roomController.leaveRoom);
router.post('/:roomId/close', ensureAuth, ensureRoomMember, ensureRoomOwner, roomController.closeRoom);

// Real-Time Collaborative Workspace Sub-Routes
router.get('/:roomId/messages', ensureAuth, ensureRoomMember, messageController.getMessages);
router.post('/:roomId/messages', ensureAuth, ensureRoomMember, messageController.createMessage);
router.get('/:roomId/notes', ensureAuth, ensureRoomMember, noteController.getNotes);
router.put('/:roomId/notes', ensureAuth, ensureRoomMember, noteController.saveNotes);
router.get('/:roomId/whiteboard', ensureAuth, ensureRoomMember, whiteboardController.getWhiteboard);
router.put('/:roomId/whiteboard', ensureAuth, ensureRoomMember, whiteboardController.saveWhiteboard);

module.exports = router;

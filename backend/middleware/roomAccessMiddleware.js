const mongoose = require('mongoose');
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');

/**
 * Verifies that the current user is a valid member of the requested study room
 */
const ensureRoomMember = async (req, res, next) => {
  try {
    const roomId = req.params.roomId || req.body.roomId;

    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room identifier provided.'
      });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Study room not found.'
      });
    }

    const userId = req.session.user.id;

    // Admin has universal inspection access
    if (req.session.user.role === 'admin') {
      req.room = room;
      req.isOwner = room.ownerId.toString() === userId.toString();
      req.membership = { memberRole: req.isOwner ? 'owner' : 'admin' };
      return next();
    }

    // Check membership
    const membership = await RoomMember.findOne({ roomId: room._id, userId });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this study room.'
      });
    }

    req.room = room;
    req.membership = membership;
    req.isOwner = room.ownerId.toString() === userId.toString();

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies that the current user is the owner of the requested room
 */
const ensureRoomOwner = (req, res, next) => {
  if (!req.isOwner && req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only the room owner can perform this management action.'
    });
  }
  next();
};

/**
 * Ensures the study room is currently active
 */
const ensureRoomActive = (req, res, next) => {
  if (req.room && req.room.status === 'closed') {
    return res.status(400).json({
      success: false,
      message: 'This study room has been closed by its owner. It is currently read-only.'
    });
  }
  next();
};

module.exports = {
  ensureRoomMember,
  ensureRoomOwner,
  ensureRoomActive
};

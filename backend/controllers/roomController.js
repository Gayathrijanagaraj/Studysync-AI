const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const User = require('../models/User');
const { generateRoomCode } = require('../utils/codeGenerator');

/**
 * POST /api/rooms
 * Create a new study room
 */
exports.createRoom = async (req, res, next) => {
  try {
    const { name, subject, description, visibility, maxParticipants } = req.body;
    const userId = req.session.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Room name is required.' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required.' });
    }

    // Generate unique room code
    let roomCode = generateRoomCode();
    let codeExists = await Room.findOne({ roomCode });
    let attempts = 0;
    while (codeExists && attempts < 5) {
      roomCode = generateRoomCode();
      codeExists = await Room.findOne({ roomCode });
      attempts++;
    }

    const newRoom = await Room.create({
      name: name.trim(),
      subject: subject.trim(),
      description: description ? description.trim() : '',
      visibility: visibility === 'public' ? 'public' : 'private',
      maxParticipants: maxParticipants ? Math.min(Math.max(parseInt(maxParticipants, 10), 2), 50) : 20,
      roomCode,
      ownerId: userId,
      status: 'active'
    });

    // Add creator as owner in RoomMember
    await RoomMember.create({
      roomId: newRoom._id,
      userId,
      memberRole: 'owner'
    });

    return res.status(201).json({
      success: true,
      message: 'Study room created successfully!',
      data: {
        room: newRoom,
        isOwner: true
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms
 * List study rooms accessible to the authenticated student
 */
exports.getRooms = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const filter = req.query.filter || 'all'; // all | created | joined

    // Find all memberships for this user
    const memberships = await RoomMember.find({ userId });
    const joinedRoomIds = memberships.map(m => m.roomId);

    let query = {};
    if (filter === 'created') {
      query = { ownerId: userId };
    } else if (filter === 'joined') {
      query = { _id: { $in: joinedRoomIds }, ownerId: { $ne: userId } };
    } else if (filter === 'public') {
      query = { visibility: 'public', status: 'active' };
    } else {
      // All rooms user has joined or created
      query = { _id: { $in: joinedRoomIds } };
    }

    if (req.query.subject) {
      query.subject = new RegExp(req.query.subject.trim(), 'i');
    }
    if (req.query.search) {
      const term = req.query.search.trim();
      query.$or = [
        { name: new RegExp(term, 'i') },
        { subject: new RegExp(term, 'i') },
        { description: new RegExp(term, 'i') }
      ];
    }

    const rooms = await Room.find(query)
      .populate('ownerId', 'name email department')
      .sort({ updatedAt: -1 });

    // Attach participant counts and isOwner flag
    const roomsWithDetails = await Promise.all(
      rooms.map(async (r) => {
        const memberCount = await RoomMember.countDocuments({ roomId: r._id });
        const isOwner = r.ownerId._id.toString() === userId.toString();
        return {
          id: r._id,
          name: r.name,
          subject: r.subject,
          description: r.description,
          roomCode: r.roomCode,
          visibility: r.visibility,
          maxParticipants: r.maxParticipants,
          status: r.status,
          owner: r.ownerId,
          isOwner,
          memberCount,
          updatedAt: r.updatedAt,
          createdAt: r.createdAt
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        rooms: roomsWithDetails
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms/:roomId
 * Get detailed room info including active members list
 */
exports.getRoomById = async (req, res, next) => {
  try {
    const room = req.room;
    const isOwner = req.isOwner;

    // Fetch members with user details
    const members = await RoomMember.find({ roomId: room._id })
      .populate('userId', 'name email department institution')
      .sort({ joinedAt: 1 });

    return res.status(200).json({
      success: true,
      data: {
        room,
        isOwner,
        members: members.map(m => ({
          id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          department: m.userId.department,
          memberRole: m.memberRole,
          joinedAt: m.joinedAt
        })),
        memberCount: members.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/join
 * Join a room using room code
 */
exports.joinRoom = async (req, res, next) => {
  try {
    const { roomCode } = req.body;
    const userId = req.session.user.id;

    if (!roomCode || !roomCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid room code.'
      });
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = await Room.findOne({ roomCode: normalizedCode });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Invalid room code. Please check the code and try again.'
      });
    }

    if (room.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'This study room has been closed by its owner.'
      });
    }

    // Check if user is already a member
    const existingMembership = await RoomMember.findOne({ roomId: room._id, userId });
    if (existingMembership) {
      return res.status(200).json({
        success: true,
        message: 'You are already a member of this room.',
        data: {
          roomId: room._id
        }
      });
    }

    // Check participant limit
    const currentMemberCount = await RoomMember.countDocuments({ roomId: room._id });
    if (currentMemberCount >= room.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: `This study room has reached its maximum capacity of ${room.maxParticipants} students.`
      });
    }

    // Add user as member
    await RoomMember.create({
      roomId: room._id,
      userId,
      memberRole: 'member'
    });

    return res.status(200).json({
      success: true,
      message: `Successfully joined ${room.name}!`,
      data: {
        roomId: room._id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/leave
 * Member leaves the study room
 */
exports.leaveRoom = async (req, res, next) => {
  try {
    const room = req.room;
    const userId = req.session.user.id;

    if (req.isOwner) {
      return res.status(400).json({
        success: false,
        message: 'As the room owner, you cannot leave the room. You can close the room instead.'
      });
    }

    await RoomMember.deleteOne({ roomId: room._id, userId });

    return res.status(200).json({
      success: true,
      message: 'You have left the study room.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/close
 * Owner closes the study room, ending any active study sessions and placing workspace in read-only mode
 */
exports.closeRoom = async (req, res, next) => {
  try {
    const room = req.room;
    room.status = 'closed';
    await room.save();

    // End any active or paused study session for this room
    const StudySession = require('../models/StudySession');
    const activeSession = await StudySession.findOne({
      roomId: room._id,
      status: { $in: ['active', 'paused'] }
    });

    if (activeSession) {
      if (activeSession.status === 'active' && activeSession.startTime) {
        const delta = Math.floor((Date.now() - new Date(activeSession.startTime).getTime()) / 1000);
        activeSession.durationSeconds = (activeSession.durationSeconds || 0) + Math.max(0, delta);
      }
      activeSession.status = 'completed';
      activeSession.endTime = new Date();
      activeSession.endedBy = req.session.user.id;
      await activeSession.save();
    }

    const io = req.app.get('io');
    if (io) {
      if (activeSession) {
        io.to(room._id.toString()).emit('session:ended', {
          session: activeSession,
          endedBy: req.session.user.name,
          reason: 'Study room closed by host'
        });
      }
      io.to(room._id.toString()).emit('room:closed', {
        roomId: room._id,
        status: 'closed',
        closedBy: req.session.user.name
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Study room has been closed successfully and is now read-only. Active sessions have been completed.',
      data: { room }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/reopen
 * Owner reopens a closed study room
 */
exports.reopenRoom = async (req, res, next) => {
  try {
    const room = req.room;
    room.status = 'active';
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.to(room._id.toString()).emit('room:reopened', {
        roomId: room._id,
        status: 'active',
        reopenedBy: req.session.user.name
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Study room has been reopened successfully.',
      data: { room }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/rooms/:roomId/status
 * Owner updates room status (active, closed)
 */
exports.updateRoomStatus = async (req, res, next) => {
  try {
    const room = req.room;
    const { status } = req.body;
    if (!['active', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room status. Allowed values: active, closed.'
      });
    }

    room.status = status;
    await room.save();

    // If setting to closed, end any active session
    if (status === 'closed') {
      const StudySession = require('../models/StudySession');
      const activeSession = await StudySession.findOne({
        roomId: room._id,
        status: { $in: ['active', 'paused'] }
      });
      if (activeSession) {
        if (activeSession.status === 'active' && activeSession.startTime) {
          const delta = Math.floor((Date.now() - new Date(activeSession.startTime).getTime()) / 1000);
          activeSession.durationSeconds = (activeSession.durationSeconds || 0) + Math.max(0, delta);
        }
        activeSession.status = 'completed';
        activeSession.endTime = new Date();
        activeSession.endedBy = req.session.user.id;
        await activeSession.save();
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(room._id.toString()).emit(status === 'closed' ? 'room:closed' : 'room:reopened', {
        roomId: room._id,
        status,
        updatedBy: req.session.user.name
      });
    }

    return res.status(200).json({
      success: true,
      message: `Study room status updated to ${status}.`,
      data: { room }
    });
  } catch (error) {
    next(error);
  }
};

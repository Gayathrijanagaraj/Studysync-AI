const mongoose = require('mongoose');
const User = require('../models/User');
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const Message = require('../models/Message');
const Doubt = require('../models/Doubt');
const StudySession = require('../models/StudySession');
const KnowledgeItem = require('../models/KnowledgeItem');

/**
 * 1. Platform-wide overview statistics & health metrics
 */
exports.getPlatformOverview = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalAdmins,
      activeUsers,
      totalRooms,
      activeRooms,
      closedRooms,
      totalMessages,
      totalDoubts,
      resolvedDoubts,
      completedSessions,
      sessionDurations,
      totalKnowledgeItems
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ isActive: true }),
      Room.countDocuments(),
      Room.countDocuments({ status: 'active' }),
      Room.countDocuments({ status: 'closed' }),
      Message.countDocuments(),
      Doubt.countDocuments(),
      Doubt.countDocuments({ status: 'resolved' }),
      StudySession.countDocuments({ status: 'completed' }),
      StudySession.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalSeconds: { $sum: '$durationSeconds' } } }
      ]),
      KnowledgeItem.countDocuments()
    ]);

    const totalDurationSeconds = (sessionDurations[0] && sessionDurations[0].totalSeconds) || 0;
    const totalStudyHours = (totalDurationSeconds / 3600).toFixed(1);
    const doubtResolutionRate = totalDoubts > 0 ? Math.round((resolvedDoubts / totalDoubts) * 100) : 0;

    // Server Diagnostics
    const diagnostics = {
      mongoState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      mongoHost: mongoose.connection.host || 'MongoDB Atlas',
      serverUptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryHeapUsedMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      geminiEngineReady: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '')
    };

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalUsers,
          totalStudents,
          totalAdmins,
          activeUsers,
          totalRooms,
          activeRooms,
          closedRooms,
          totalMessages,
          totalDoubts,
          resolvedDoubts,
          doubtResolutionRate,
          completedSessions,
          totalStudyHours,
          totalKnowledgeItems
        },
        diagnostics
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 2. Get list of all registered users
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { search, status, role } = req.query;
    const query = {};

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { institution: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } }
      ];
    }

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (role && ['student', 'admin'].includes(role)) query.role = role;

    const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        users,
        total: users.length
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 3. Toggle user account status (Activate / Suspend)
 */
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentAdminId = req.session.user.id;

    if (id.toString() === currentAdminId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot deactivate their own account.'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${user.name} has been ${user.isActive ? 'activated' : 'deactivated'}.`,
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 4. Get list of all study rooms across platform
 */
exports.getAllRooms = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { roomCode: { $regex: q, $options: 'i' } }
      ];
    }

    if (status && ['active', 'closed'].includes(status)) {
      query.status = status;
    }

    const rooms = await Room.find(query)
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 });

    // Aggregate member counts
    const roomIds = rooms.map(r => r._id);
    const memberCounts = await RoomMember.aggregate([
      { $match: { roomId: { $in: roomIds } } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    memberCounts.forEach(mc => {
      countMap[mc._id.toString()] = mc.count;
    });

    const enrichedRooms = rooms.map(r => ({
      _id: r._id,
      name: r.name,
      subject: r.subject,
      description: r.description,
      roomCode: r.roomCode,
      visibility: r.visibility,
      status: r.status,
      owner: r.ownerId ? { name: r.ownerId.name, email: r.ownerId.email } : { name: 'Unknown', email: '' },
      membersCount: countMap[r._id.toString()] || 0,
      createdAt: r.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        rooms: enrichedRooms,
        total: enrichedRooms.length
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 5. Admin Close Study Room
 */
exports.closeRoom = async (req, res, next) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Study room not found.'
      });
    }

    room.status = 'closed';
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.to(id.toString()).emit('room:closed', {
        roomId: id,
        message: 'This study room has been closed by the platform administrator.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Study room "${room.name}" has been closed.`,
      data: { room }
    });
  } catch (error) {
    return next(error);
  }
};

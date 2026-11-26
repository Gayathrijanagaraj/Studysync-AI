const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const Doubt = require('../models/Doubt');
const StudySession = require('../models/StudySession');

/**
 * GET /api/dashboard/stats
 * Aggregates student dashboard summary statistics and recent study rooms
 */
exports.getStats = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const userName = req.session.user.name;

    // Total rooms joined / created
    const memberships = await RoomMember.find({ userId });
    const joinedRoomIds = memberships.map(m => m.roomId);

    const totalRoomsCount = joinedRoomIds.length;
    const createdRoomsCount = await Room.countDocuments({ ownerId: userId });

    // Recent active rooms (up to 4)
    const recentRooms = await Room.find({ _id: { $in: joinedRoomIds }, status: 'active' })
      .populate('ownerId', 'name')
      .sort({ updatedAt: -1 })
      .limit(4);

    const formattedRecentRooms = await Promise.all(
      recentRooms.map(async (r) => {
        const memberCount = await RoomMember.countDocuments({ roomId: r._id });
        const isOwner = r.ownerId ? (r.ownerId._id ? r.ownerId._id.toString() : r.ownerId.toString()) === userId.toString() : false;
        const ownerName = r.ownerId ? (r.ownerId.name || 'Student') : 'Student';
        return {
          id: r._id,
          name: r.name,
          subject: r.subject,
          roomCode: r.roomCode,
          isOwner,
          ownerName,
          memberCount,
          updatedAt: r.updatedAt
        };
      })
    );

    // Dynamic metrics
    const [sessionsCompleted, doubtsResolved] = await Promise.all([
      StudySession.countDocuments({
        $or: [{ startedBy: userId }, { endedBy: userId }],
        status: 'completed'
      }),
      Doubt.countDocuments({
        author: userId,
        status: 'resolved'
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          name: userName,
          email: req.session.user.email,
          department: req.session.user.department
        },
        metrics: {
          roomsJoined: totalRoomsCount,
          roomsCreated: createdRoomsCount,
          sessionsCompleted,
          doubtsResolved
        },
        recentRooms: formattedRecentRooms
      }
    });
  } catch (error) {
    next(error);
  }
};

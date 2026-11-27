const StudySession = require('../models/StudySession');
const Message = require('../models/Message');
const SharedNote = require('../models/SharedNote');
const Doubt = require('../models/Doubt');
const geminiService = require('../services/geminiService');

/**
 * 1. Get current active/paused session for a room
 */
exports.getActiveSession = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const session = await StudySession.findOne({
      roomId,
      status: { $in: ['active', 'paused'] }
    }).populate('startedBy', 'name email');

    let elapsedSeconds = 0;
    if (session) {
      elapsedSeconds = session.durationSeconds || 0;
      if (session.status === 'active' && session.startTime) {
        const delta = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
        elapsedSeconds += Math.max(0, delta);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        session,
        elapsedSeconds
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 2. Start a new study session in the room
 */
exports.startSession = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { mode = 'stopwatch' } = req.body;

    // Permission Check: Only room host can start session
    if (!req.isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only the room host can start study sessions.'
      });
    }

    // Check if an active/paused session already exists
    let session = await StudySession.findOne({
      roomId,
      status: { $in: ['active', 'paused'] }
    });

    if (session) {
      // If paused, resume it
      if (session.status === 'paused') {
        session.status = 'active';
        session.startTime = new Date();
        session.pausedAt = null;
        await session.save();
      }
    } else {
      session = await StudySession.create({
        roomId,
        startedBy: req.session.user.id,
        mode: ['stopwatch', 'pomodoro_25', 'focus_50'].includes(mode) ? mode : 'stopwatch',
        status: 'active',
        startTime: new Date(),
        durationSeconds: 0
      });
    }

    await session.populate('startedBy', 'name email');

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('session:started', {
        session,
        startedBy: req.session.user.name,
        timestamp: Date.now()
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Study session started.',
      data: { session }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 3. Pause active session
 */
exports.pauseSession = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const session = await StudySession.findOne({
      roomId,
      status: 'active'
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active study session to pause.'
      });
    }

    const isHost = req.isOwner || (session.startedBy && session.startedBy.toString() === req.session.user.id.toString());
    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only the room host can pause study sessions.'
      });
    }

    const delta = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
    session.durationSeconds = (session.durationSeconds || 0) + Math.max(0, delta);
    session.status = 'paused';
    session.pausedAt = new Date();
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('session:paused', {
        session,
        pausedBy: req.session.user.name,
        durationSeconds: session.durationSeconds
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Study session paused.',
      data: { session }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 4. Resume paused session
 */
exports.resumeSession = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const session = await StudySession.findOne({
      roomId,
      status: 'paused'
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No paused study session to resume.'
      });
    }

    const isHost = req.isOwner || (session.startedBy && session.startedBy.toString() === req.session.user.id.toString());
    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only the room host can resume study sessions.'
      });
    }

    session.status = 'active';
    session.startTime = new Date();
    session.pausedAt = null;
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('session:resumed', {
        session,
        resumedBy: req.session.user.name,
        timestamp: Date.now()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Study session resumed.',
      data: { session }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 5. End session and synthesize AI Study Recap
 */
exports.endSession = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const room = req.room;

    // Verify host authority: only the owner who created the room can end the session
    const userId = req.session.user.id.toString();
    const isHost = req.isOwner || (room && room.ownerId && (room.ownerId._id || room.ownerId).toString() === userId);
    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only the room host who created this study room can end the session.'
      });
    }

    // Find any active or paused session
    let session = await StudySession.findOne({
      roomId,
      status: { $in: ['active', 'paused'] }
    });

    // If no active session is running, check if already completed or create a session for this wrap-up
    if (!session) {
      const existingSession = await StudySession.findOne({ roomId }).sort({ createdAt: -1 });
      if (existingSession && existingSession.status === 'completed' && existingSession.aiSummary && existingSession.aiSummary.content) {
        // Room was already ended; ensure room status is closed
        const Room = require('../models/Room');
        const roomDoc = await Room.findById(roomId);
        if (roomDoc && roomDoc.status !== 'closed') {
          roomDoc.status = 'closed';
          await roomDoc.save();
        }
        return res.status(200).json({
          success: true,
          message: 'Study session is already completed.',
          data: { session: existingSession, roomStatus: 'closed' }
        });
      }

      // Create a fresh completed session record so wrap-up recap and room close ALWAYS work smoothly
      session = await StudySession.create({
        roomId,
        startedBy: req.session.user.id,
        endedBy: req.session.user.id,
        mode: 'stopwatch',
        durationSeconds: 60,
        status: 'completed',
        startTime: new Date(Date.now() - 60000),
        endTime: new Date()
      });
    } else {
      // Calculate final duration
      if (session.status === 'active' && session.startTime) {
        const delta = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
        session.durationSeconds = (session.durationSeconds || 0) + Math.max(0, delta);
      }
      session.status = 'completed';
      session.endTime = new Date();
      session.endedBy = req.session.user.id;
    }

    // Aggregate room metrics for AI synthesis
    const msgCount = await Message.countDocuments({ roomId });
    const doubtsCount = await Doubt.countDocuments({ roomId, status: 'resolved' });
    const sharedNote = await SharedNote.findOne({ roomId });
    const recentMessages = await Message.find({ roomId }).sort({ createdAt: -1 }).limit(15);

    const discussionExcerpt = recentMessages
      .reverse()
      .map(m => `${m.message}`)
      .join('\n');

    const notesExcerpt = sharedNote && sharedNote.content ? sharedNote.content.substring(0, 1000) : '';
    const sessionContent = `Recent Group Discussion:\n${discussionExcerpt || 'None'}\n\nShared Notes Excerpt:\n${notesExcerpt || 'None'}`;
    const durationMinutes = Math.max(1, Math.round(session.durationSeconds / 60));

    // Generate AI study recap with graceful educational fallback
    const summaryText = await geminiService.generateSessionSummary({
      subject: room ? room.subject : 'General Studies',
      roomName: room ? room.name : 'Study Room',
      durationMinutes,
      sessionContent,
      doubtsResolved: doubtsCount,
      messageCount: msgCount
    });

    session.aiSummary = {
      content: summaryText,
      generatedAt: new Date(),
      modelUsed: 'gemini-3.5-flash'
    };

    session.stats = {
      chatMessagesCount: msgCount,
      doubtsSolvedCount: doubtsCount,
      notesWordCount: sharedNote && sharedNote.content ? sharedNote.content.split(/\s+/).length : 0
    };

    await session.save();
    await session.populate('startedBy', 'name');
    await session.populate('endedBy', 'name');

    // Automatically persist recap to the Persistent Knowledge Base for revision
    try {
      const KnowledgeItem = require('../models/KnowledgeItem');
      await KnowledgeItem.create({
        userId: req.session.user.id,
        title: `Study Session Recap: ${room ? room.name : 'Study Session'}`,
        content: summaryText,
        subject: room ? room.subject : 'General Studies',
        category: 'ai_recap',
        tags: ['session-recap', 'summary', room ? room.subject.toLowerCase() : 'studies']
      });
    } catch (kErr) {
      console.warn('[Session] Could not auto-save recap to KnowledgeItem:', kErr.message);
    }

    // Automatically block & close the study room so all collaborative tools lock into Read-Only mode
    const Room = require('../models/Room');
    const roomDoc = await Room.findById(roomId);
    if (roomDoc) {
      roomDoc.status = 'closed';
      await roomDoc.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('session:ended', {
        session,
        endedBy: req.session.user.name,
        aiSummary: session.aiSummary
      });
      io.to(roomId).emit('room:closed', {
        roomId,
        status: 'closed',
        closedBy: req.session.user.name,
        reason: 'Study session completed by host'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Study session completed, AI summary generated, and room archived in read-only mode.',
      data: { session, roomStatus: 'closed' }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 6. Get completed session history
 */
exports.getSessionHistory = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const sessions = await StudySession.find({
      roomId,
      status: 'completed'
    })
      .populate('startedBy', 'name')
      .populate('endedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 7. Get all sessions for the current student across all rooms
 */
exports.getAllStudentSessions = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const RoomMember = require('../models/RoomMember');
    const memberships = await RoomMember.find({ userId });
    const joinedRoomIds = memberships.map(m => m.roomId);

    const query = {
      $or: [
        { startedBy: userId },
        { endedBy: userId },
        { roomId: { $in: joinedRoomIds } }
      ]
    };

    if (req.query.mode && req.query.mode !== 'all') {
      query.mode = req.query.mode;
    }

    const sessions = await StudySession.find(query)
      .populate('roomId', 'name subject roomCode')
      .populate('startedBy', 'name email')
      .populate('endedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    return next(error);
  }
};

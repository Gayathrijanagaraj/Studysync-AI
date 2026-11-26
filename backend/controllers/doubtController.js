const Doubt = require('../models/Doubt');
const Room = require('../models/Room');
const geminiService = require('../services/geminiService');

/**
 * 1. Get all doubts for a study room
 */
exports.getDoubts = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const doubts = await Doubt.find({ roomId })
      .populate('author', 'name email role')
      .populate('answers.author', 'name email role')
      .populate('resolvedBy', 'name email')
      .sort({ status: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: { doubts }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 2. Raise a new study doubt
 */
exports.createDoubt = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { title, description, tags } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Doubt title is required.'
      });
    }

    if (!description || description.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Doubt description is required.'
      });
    }

    let parsedTags = [];
    if (Array.isArray(tags)) {
      parsedTags = tags.map(t => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string' && tags.trim()) {
      parsedTags = tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    }

    const doubt = await Doubt.create({
      roomId,
      author: req.session.user.id,
      title: title.trim(),
      description: description.trim(),
      tags: parsedTags,
      upvotes: []
    });

    await doubt.populate('author', 'name email role');

    // Broadcast to real-time room subscribers
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('doubt:created', doubt);
    }

    return res.status(201).json({
      success: true,
      message: 'Doubt raised successfully.',
      data: { doubt }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 3. Toggle Upvote on a doubt
 */
exports.toggleUpvote = async (req, res, next) => {
  try {
    const { roomId, doubtId } = req.params;
    const userId = req.session.user.id;

    const doubt = await Doubt.findOne({ _id: doubtId, roomId });
    if (!doubt) {
      return res.status(404).json({
        success: false,
        message: 'Doubt not found.'
      });
    }

    const existingIndex = doubt.upvotes.findIndex(id => id.toString() === userId);
    let hasUpvoted = false;

    if (existingIndex > -1) {
      // Remove upvote
      doubt.upvotes.splice(existingIndex, 1);
      hasUpvoted = false;
    } else {
      // Add upvote
      doubt.upvotes.push(userId);
      hasUpvoted = true;
    }

    await doubt.save();

    // Broadcast upvote change
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('doubt:upvoted', {
        doubtId: doubt._id,
        upvotes: doubt.upvotes,
        upvoteCount: doubt.upvotes.length
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        doubtId: doubt._id,
        upvoteCount: doubt.upvotes.length,
        hasUpvoted
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 4. Add peer answer / discussion to a doubt
 */
exports.addAnswer = async (req, res, next) => {
  try {
    const { roomId, doubtId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Answer content is required.'
      });
    }

    const doubt = await Doubt.findOne({ _id: doubtId, roomId });
    if (!doubt) {
      return res.status(404).json({
        success: false,
        message: 'Doubt not found.'
      });
    }

    doubt.answers.push({
      author: req.session.user.id,
      content: content.trim()
    });

    await doubt.save();
    await doubt.populate('answers.author', 'name email role');

    const createdAnswer = doubt.answers[doubt.answers.length - 1];

    // Broadcast answer to room
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('doubt:answered', {
        doubtId: doubt._id,
        answer: createdAnswer
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Answer added successfully.',
      data: {
        answer: createdAnswer,
        doubt
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 5. Toggle Resolve/Reopen status on a doubt
 */
exports.resolveDoubt = async (req, res, next) => {
  try {
    const { roomId, doubtId } = req.params;
    const currentUserId = req.session.user.id;

    const doubt = await Doubt.findOne({ _id: doubtId, roomId });
    if (!doubt) {
      return res.status(404).json({
        success: false,
        message: 'Doubt not found.'
      });
    }

    const isAuthor = doubt.author.toString() === currentUserId;
    const isOwnerOrAdmin = req.isOwner || (req.membership && req.membership.memberRole === 'owner') || req.session.user.role === 'admin';

    if (!isAuthor && !isOwnerOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the author or room owner can update the doubt resolution status.'
      });
    }

    if (doubt.status === 'resolved') {
      doubt.status = 'open';
      doubt.resolvedAt = null;
      doubt.resolvedBy = null;
    } else {
      doubt.status = 'resolved';
      doubt.resolvedAt = new Date();
      doubt.resolvedBy = currentUserId;
    }

    await doubt.save();
    await doubt.populate('resolvedBy', 'name email');

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('doubt:resolved', {
        doubtId: doubt._id,
        status: doubt.status,
        resolvedAt: doubt.resolvedAt,
        resolvedBy: doubt.resolvedBy
      });
    }

    return res.status(200).json({
      success: true,
      message: `Doubt marked as ${doubt.status}.`,
      data: { doubt }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 6. Solve Doubt with Gemini AI
 */
exports.solveDoubtWithAI = async (req, res, next) => {
  try {
    const { roomId, doubtId } = req.params;

    const doubt = await Doubt.findOne({ _id: doubtId, roomId });
    if (!doubt) {
      return res.status(404).json({
        success: false,
        message: 'Doubt not found.'
      });
    }

    const room = await Room.findById(roomId);
    const subject = room ? room.subject : '';
    const topic = room ? room.name : '';

    const solution = await geminiService.solveDoubt({
      subject,
      topic,
      title: doubt.title,
      description: doubt.description
    });

    doubt.aiSolution = {
      content: solution,
      generatedAt: new Date(),
      modelUsed: 'gemini-3.5-flash'
    };

    await doubt.save();

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('doubt:ai_solved', {
        doubtId: doubt._id,
        aiSolution: doubt.aiSolution
      });
    }

    return res.status(200).json({
      success: true,
      message: 'AI solution generated successfully.',
      data: { aiSolution: doubt.aiSolution }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 7. Delete a doubt
 */
exports.deleteDoubt = async (req, res, next) => {
  try {
    const { roomId, doubtId } = req.params;
    const currentUserId = req.session.user.id;

    const doubt = await Doubt.findOne({ _id: doubtId, roomId });
    if (!doubt) {
      return res.status(404).json({
        success: false,
        message: 'Doubt not found.'
      });
    }

    const isAuthor = doubt.author.toString() === currentUserId;
    const isOwnerOrAdmin = req.isOwner || (req.membership && req.membership.memberRole === 'owner') || req.session.user.role === 'admin';

    if (!isAuthor && !isOwnerOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the author or room owner can delete this doubt.'
      });
    }

    await Doubt.deleteOne({ _id: doubtId, roomId });

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('doubt:deleted', { doubtId });
    }

    return res.status(200).json({
      success: true,
      message: 'Doubt deleted successfully.'
    });
  } catch (error) {
    return next(error);
  }
};

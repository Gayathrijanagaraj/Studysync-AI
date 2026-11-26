const geminiService = require('../services/geminiService');
const AIInteraction = require('../models/AIInteraction');
const Message = require('../models/Message');

/**
 * POST /api/ai/ask
 * Ask AI with room topic & recent discussion grounding
 */
exports.ask = async (req, res, next) => {
  try {
    const { question, recentContext } = req.body;
    const room = req.room;
    const userId = req.session.user.id;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a question for the AI assistant.'
      });
    }

    const answer = await geminiService.askAI({
      subject: room.subject,
      description: room.description,
      question: question.trim(),
      recentContext: recentContext || ''
    });

    // Save interaction
    await AIInteraction.create({
      userId,
      roomId: room._id,
      actionType: 'ask',
      prompt: question.trim(),
      response: answer
    });

    return res.status(200).json({
      success: true,
      data: {
        answer,
        question: question.trim()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/explain
 * Explain a specific snippet or confusing chat exchange
 */
exports.explain = async (req, res, next) => {
  try {
    const { selectedDiscussion } = req.body;
    const room = req.room;
    const userId = req.session.user.id;

    if (!selectedDiscussion || !selectedDiscussion.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No discussion text was selected to explain.'
      });
    }

    const explanation = await geminiService.explainDiscussion({
      subject: room.subject,
      selectedDiscussion: selectedDiscussion.trim()
    });

    await AIInteraction.create({
      userId,
      roomId: room._id,
      actionType: 'explain',
      prompt: selectedDiscussion.trim(),
      response: explanation
    });

    return res.status(200).json({
      success: true,
      data: {
        explanation
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/analyze
 * Analyze recent discussion in the room
 */
exports.analyze = async (req, res, next) => {
  try {
    const room = req.room;
    const userId = req.session.user.id;

    // Fetch last 25 messages
    const recentMessages = await Message.find({ roomId: room._id })
      .populate('senderId', 'name')
      .sort({ createdAt: -1 })
      .limit(25);

    if (!recentMessages || recentMessages.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          analysis: 'There are no chat messages in this study room yet to analyze. Start discussing concepts or raising doubts!'
        }
      });
    }

    // Format chronologically
    const discussionLog = recentMessages
      .reverse()
      .map(m => `${m.senderId ? m.senderId.name : 'Student'}: ${m.message}`)
      .join('\n');

    const analysis = await geminiService.analyzeDiscussion({
      subject: room.subject,
      discussionHistory: discussionLog
    });

    await AIInteraction.create({
      userId,
      roomId: room._id,
      actionType: 'analyze',
      prompt: 'Analyze recent room discussion',
      response: analysis
    });

    return res.status(200).json({
      success: true,
      data: {
        analysis
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/gaps
 * Identify conceptual gaps from recent discussions
 */
exports.gaps = async (req, res, next) => {
  try {
    const room = req.room;
    const userId = req.session.user.id;

    const recentMessages = await Message.find({ roomId: room._id })
      .populate('senderId', 'name')
      .sort({ createdAt: -1 })
      .limit(25);

    const discussionLog = recentMessages.length > 0
      ? recentMessages.reverse().map(m => `${m.senderId ? m.senderId.name : 'Student'}: ${m.message}`).join('\n')
      : `Subject: ${room.subject} - General study room session.`;

    const gaps = await geminiService.identifyConceptualGaps({
      subject: room.subject,
      discussionHistory: discussionLog
    });

    await AIInteraction.create({
      userId,
      roomId: room._id,
      actionType: 'gaps',
      prompt: 'Identify conceptual gaps',
      response: gaps
    });

    return res.status(200).json({
      success: true,
      data: {
        gaps
      }
    });
  } catch (error) {
    next(error);
  }
};

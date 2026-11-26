const Whiteboard = require('../models/Whiteboard');

/**
 * GET /api/rooms/:roomId/whiteboard
 * Retrieve saved whiteboard drawing strokes
 */
exports.getWhiteboard = async (req, res, next) => {
  try {
    const roomId = req.room._id;

    let whiteboard = await Whiteboard.findOne({ roomId });
    if (!whiteboard) {
      whiteboard = await Whiteboard.create({
        roomId,
        strokes: [],
        lastUpdatedBy: req.session.user.id
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        strokes: whiteboard.strokes || [],
        updatedAt: whiteboard.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/rooms/:roomId/whiteboard
 * Save updated whiteboard drawing state
 */
exports.saveWhiteboard = async (req, res, next) => {
  try {
    const roomId = req.room._id;
    const { strokes } = req.body;
    const userId = req.session.user.id;

    let whiteboard = await Whiteboard.findOne({ roomId });
    if (!whiteboard) {
      whiteboard = new Whiteboard({ roomId });
    }

    whiteboard.strokes = Array.isArray(strokes) ? strokes : [];
    whiteboard.lastUpdatedBy = userId;
    await whiteboard.save();

    return res.status(200).json({
      success: true,
      message: 'Whiteboard saved successfully.'
    });
  } catch (error) {
    next(error);
  }
};

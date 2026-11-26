const SharedNote = require('../models/SharedNote');

/**
 * GET /api/rooms/:roomId/notes
 * Fetch the shared notes document for the study room
 */
exports.getNotes = async (req, res, next) => {
  try {
    const roomId = req.room._id;

    let note = await SharedNote.findOne({ roomId }).populate('lastEditedBy', 'name');
    if (!note) {
      note = await SharedNote.create({
        roomId,
        content: '# Study Notes\nStart typing collaboratively here...',
        lastEditedBy: req.session.user.id
      });
      note = await note.populate('lastEditedBy', 'name');
    }

    return res.status(200).json({
      success: true,
      data: {
        content: note.content,
        lastEditedBy: note.lastEditedBy ? note.lastEditedBy.name : 'Unknown',
        updatedAt: note.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/rooms/:roomId/notes
 * Save the updated shared notes document
 */
exports.saveNotes = async (req, res, next) => {
  try {
    const roomId = req.room._id;
    const { content } = req.body;
    const userId = req.session.user.id;

    let note = await SharedNote.findOne({ roomId });
    if (!note) {
      note = new SharedNote({ roomId });
    }

    note.content = typeof content === 'string' ? content : '';
    note.lastEditedBy = userId;
    await note.save();

    return res.status(200).json({
      success: true,
      message: 'Shared notes saved successfully.',
      data: {
        updatedAt: note.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const Message = require('../models/Message');

/**
 * GET /api/rooms/:roomId/messages
 * Retrieve recent message history for the room
 */
exports.getMessages = async (req, res, next) => {
  try {
    const roomId = req.room._id;
    const limit = parseInt(req.query.limit, 10) || 50;

    const messages = await Message.find({ roomId })
      .populate('senderId', 'name email profileImage')
      .sort({ createdAt: 1 })
      .limit(limit);

    const formattedMessages = messages.map(m => ({
      id: m._id,
      sender: {
        id: m.senderId._id,
        name: m.senderId.name,
        email: m.senderId.email
      },
      message: m.message,
      messageType: m.messageType,
      createdAt: m.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        messages: formattedMessages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/messages
 * REST fallback to post a message
 */
exports.createMessage = async (req, res, next) => {
  try {
    const roomId = req.room._id;
    const senderId = req.session.user.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty.'
      });
    }

    const newMessage = await Message.create({
      roomId,
      senderId,
      message: message.trim()
    });

    const populatedMessage = await newMessage.populate('senderId', 'name email profileImage');

    return res.status(201).json({
      success: true,
      data: {
        message: {
          id: populatedMessage._id,
          sender: {
            id: populatedMessage.senderId._id,
            name: populatedMessage.senderId.name,
            email: populatedMessage.senderId.email
          },
          message: populatedMessage.message,
          createdAt: populatedMessage.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

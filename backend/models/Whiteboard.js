const mongoose = require('mongoose');

const whiteboardSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      unique: true
    },
    strokes: [
      {
        tool: {
          type: String,
          enum: ['pencil', 'eraser'],
          default: 'pencil'
        },
        color: {
          type: String,
          default: '#1A1D36'
        },
        size: {
          type: Number,
          default: 3
        },
        points: [
          {
            x: Number,
            y: Number
          }
        ]
      }
    ],
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

const Whiteboard = mongoose.model('Whiteboard', whiteboardSchema);
module.exports = Whiteboard;

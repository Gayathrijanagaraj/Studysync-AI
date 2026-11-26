const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room ID is required.'],
      index: true
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Session initiator is required.']
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    mode: {
      type: String,
      enum: ['stopwatch', 'pomodoro_25', 'focus_50'],
      default: 'stopwatch'
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
      index: true
    },
    pausedAt: {
      type: Date
    },
    topicsCovered: [
      {
        type: String,
        trim: true
      }
    ],
    aiSummary: {
      content: {
        type: String,
        default: ''
      },
      keyTakeaways: [
        {
          type: String
        }
      ],
      generatedAt: {
        type: Date
      },
      modelUsed: {
        type: String,
        default: 'gemini-3.5-flash'
      }
    },
    stats: {
      chatMessagesCount: {
        type: Number,
        default: 0
      },
      doubtsSolvedCount: {
        type: Number,
        default: 0
      },
      notesWordCount: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

studySessionSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('StudySession', studySessionSchema);

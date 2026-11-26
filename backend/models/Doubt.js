const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Answer content is required.'],
    trim: true,
    maxlength: [2000, 'Answer cannot exceed 2000 characters.']
  },
  isAccepted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const doubtSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room ID is required.'],
      index: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required.']
    },
    title: {
      type: String,
      required: [true, 'Doubt title is required.'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters.']
    },
    description: {
      type: String,
      required: [true, 'Doubt description is required.'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters.']
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open',
      index: true
    },
    answers: [answerSchema],
    aiSolution: {
      content: {
        type: String,
        default: ''
      },
      generatedAt: {
        type: Date
      },
      modelUsed: {
        type: String,
        default: 'gemini-3.5-flash'
      }
    },
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

doubtSchema.index({ roomId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Doubt', doubtSchema);

const mongoose = require('mongoose');

const knowledgeItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required.'],
      index: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },
    sourceDoubtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doubt'
    },
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters.']
    },
    content: {
      type: String,
      required: [true, 'Content is required.'],
      trim: true,
      maxlength: [10000, 'Content cannot exceed 10000 characters.']
    },
    category: {
      type: String,
      enum: ['summary', 'doubt', 'note', 'flashcard'],
      default: 'note',
      index: true
    },
    subject: {
      type: String,
      required: [true, 'Subject is required.'],
      trim: true,
      default: 'General Studies'
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    source: {
      type: String,
      default: 'Personal Note'
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

knowledgeItemSchema.index({ userId: 1, category: 1, createdAt: -1 });
knowledgeItemSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });

module.exports = mongoose.model('KnowledgeItem', knowledgeItemSchema);

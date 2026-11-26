const mongoose = require('mongoose');

const aiInteractionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true
    },
    actionType: {
      type: String,
      enum: ['ask', 'explain', 'analyze', 'gaps', 'summarize'],
      required: true
    },
    prompt: {
      type: String,
      required: true
    },
    contextReference: {
      type: String,
      default: ''
    },
    response: {
      type: String,
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

aiInteractionSchema.index({ roomId: 1, createdAt: -1 });
aiInteractionSchema.index({ userId: 1 });

const AIInteraction = mongoose.model('AIInteraction', aiInteractionSchema);
module.exports = AIInteraction;

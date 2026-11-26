const mongoose = require('mongoose');

const sharedNoteSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      unique: true
    },
    content: {
      type: String,
      default: ''
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

const SharedNote = mongoose.model('SharedNote', sharedNoteSchema);
module.exports = SharedNote;

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [100, 'Room name cannot exceed 100 characters']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [80, 'Subject cannot exceed 80 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'private'
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    maxParticipants: {
      type: Number,
      default: 20,
      min: [2, 'Minimum 2 participants'],
      max: [50, 'Maximum 50 participants']
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
roomSchema.index({ ownerId: 1 });
roomSchema.index({ status: 1 });

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;

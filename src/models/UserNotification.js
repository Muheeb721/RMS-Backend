import mongoose from 'mongoose';

const userNotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userName: {
    type: String,
    default: '',
  },
  actorType: {
    type: String,
    default: 'admin',
  },
  actorName: {
    type: String,
    default: 'Admin',
  },
  entityType: {
    type: String,
    default: 'GENERAL',
    index: true,
  },
  entityId: {
    type: String,
    default: '',
  },
  actionType: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    default: 'Admin update',
  },
  message: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: 'Updated',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

export default mongoose.model('UserNotification', userNotificationSchema, 'user_notifications');

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      // Admin notifications
      'user_created', 'user_deleted', 'user_updated', 'user_banned', 'user_unbanned', 'role_changed', 'bulk_action', 'export',
      // User notifications
      'report_status_changed', 'report_commented', 'report_resolved', 'welcome', 'achievement', 'community_update'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // For admin notifications
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // For user notifications
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Related report (for report-based notifications)
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  },
  read: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ adminId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema); 
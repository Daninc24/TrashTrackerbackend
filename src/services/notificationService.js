const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { deliverWebhook } = require('../routes/apiRoutes');

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Email templates
const emailTemplates = {
  reportSubmitted: {
    subject: 'Report Submitted Successfully - RashTrackr',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">🌱 RashTrackr</h2>
        <h3>Report Submitted Successfully</h3>
        <p>Hello ${data.userName},</p>
        <p>Your report has been submitted successfully and is being reviewed by our team.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Report Details:</h4>
          <p><strong>Category:</strong> ${data.category}</p>
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Status:</strong> ${data.status}</p>
          <p><strong>Report ID:</strong> ${data.reportId}</p>
        </div>
        <p>You'll receive updates on your report's progress. Thank you for helping keep our community clean!</p>
        <p>Best regards,<br>The RashTrackr Team</p>
      </div>
    `
  },
  reportUpdated: {
    subject: 'Report Status Updated - RashTrackr',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">🌱 RashTrackr</h2>
        <h3>Report Status Updated</h3>
        <p>Hello ${data.userName},</p>
        <p>Your report status has been updated.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Report Details:</h4>
          <p><strong>Category:</strong> ${data.category}</p>
          <p><strong>New Status:</strong> ${data.newStatus}</p>
          <p><strong>Previous Status:</strong> ${data.previousStatus}</p>
          <p><strong>Report ID:</strong> ${data.reportId}</p>
          ${data.comment ? `<p><strong>Comment:</strong> ${data.comment}</p>` : ''}
        </div>
        <p>Thank you for your patience!</p>
        <p>Best regards,<br>The RashTrackr Team</p>
      </div>
    `
  },
  reportResolved: {
    subject: 'Report Resolved - RashTrackr',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">🌱 RashTrackr</h2>
        <h3>Report Resolved!</h3>
        <p>Hello ${data.userName},</p>
        <p>Great news! Your report has been resolved.</p>
        <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Report Details:</h4>
          <p><strong>Category:</strong> ${data.category}</p>
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Resolution Time:</strong> ${data.resolutionTime}</p>
          <p><strong>Report ID:</strong> ${data.reportId}</p>
        </div>
        <p>Thank you for helping make our community a better place!</p>
        <p>Best regards,<br>The RashTrackr Team</p>
      </div>
    `
  },
  achievementUnlocked: {
    subject: 'Achievement Unlocked! - RashTrackr',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">🌱 RashTrackr</h2>
        <h3>🏆 Achievement Unlocked!</h3>
        <p>Congratulations ${data.userName}!</p>
        <p>You've unlocked a new achievement!</p>
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Achievement Details:</h4>
          <p><strong>Name:</strong> ${data.achievementName}</p>
          <p><strong>Description:</strong> ${data.achievementDescription}</p>
          <p><strong>Points Earned:</strong> ${data.pointsEarned}</p>
        </div>
        <p>Keep up the great work!</p>
        <p>Best regards,<br>The RashTrackr Team</p>
      </div>
    `
  },
  welcome: {
    subject: 'Welcome to RashTrackr!',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">🌱 RashTrackr</h2>
        <h3>Welcome to RashTrackr!</h3>
        <p>Hello ${data.userName},</p>
        <p>Welcome to RashTrackr! We're excited to have you join our community of environmental stewards.</p>
        <p>Here's what you can do:</p>
        <ul>
          <li>Submit reports about environmental issues</li>
          <li>Track the progress of your reports</li>
          <li>Earn achievements and points</li>
          <li>Connect with other community members</li>
        </ul>
        <p>Ready to make a difference? Submit your first report!</p>
        <p>Best regards,<br>The RashTrackr Team</p>
      </div>
    `
  }
};

// Send email notification
const sendEmail = async (to, templateName, data) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates[templateName];
    
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@rashtrackr.com',
      to,
      subject: template.subject,
      html: template.template(data)
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

// Create notification
const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      data,
      isRead: false
    });
    
    await notification.save();
    
    // Emit real-time notification if user is online
    // This would be handled by Socket.IO in a real implementation
    
    return notification;
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
};

// Send notification to multiple users
const sendBulkNotification = async (userIds, type, title, message, data = {}) => {
  try {
    const notifications = [];
    
    for (const userId of userIds) {
      const notification = await createNotification(userId, type, title, message, data);
      notifications.push(notification);
    }
    
    return notifications;
  } catch (error) {
    console.error('Bulk notification failed:', error);
    throw error;
  }
};

// Mark notification as read
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    
    return notification;
  } catch (error) {
    console.error('Mark as read failed:', error);
    throw error;
  }
};

// Mark all notifications as read
const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    return result;
  } catch (error) {
    console.error('Mark all as read failed:', error);
    throw error;
  }
};

// Get user notifications
const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Notification.countDocuments({ userId });
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    
    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };
  } catch (error) {
    console.error('Get user notifications failed:', error);
    throw error;
  }
};

// Delete notification
const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });
    
    return notification;
  } catch (error) {
    console.error('Delete notification failed:', error);
    throw error;
  }
};

// Notification preferences
const updateNotificationPreferences = async (userId, preferences) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { notificationPreferences: preferences },
      { new: true }
    );
    
    return user;
  } catch (error) {
    console.error('Update notification preferences failed:', error);
    throw error;
  }
};

// Send push notification (placeholder for mobile push notifications)
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    // This would integrate with Firebase Cloud Messaging or similar
    console.log('Push notification sent:', { userId, title, body, data });
    
    // For now, create an in-app notification
    await createNotification(userId, 'push', title, body, data);
    
    return true;
  } catch (error) {
    console.error('Push notification failed:', error);
    throw error;
  }
};

// Notification templates for different events
const notificationTemplates = {
  reportSubmitted: {
    type: 'info',
    title: 'Report Submitted',
    message: 'Your report has been submitted successfully and is being reviewed.'
  },
  reportUpdated: {
    type: 'info',
    title: 'Report Updated',
    message: 'Your report status has been updated.'
  },
  reportResolved: {
    type: 'success',
    title: 'Report Resolved',
    message: 'Your report has been resolved! Thank you for your contribution.'
  },
  achievementUnlocked: {
    type: 'achievement',
    title: 'Achievement Unlocked!',
    message: 'Congratulations! You\'ve unlocked a new achievement.'
  },
  newComment: {
    type: 'comment',
    title: 'New Comment',
    message: 'Someone commented on your report.'
  },
  reportLiked: {
    type: 'like',
    title: 'Report Liked',
    message: 'Someone liked your report.'
  },
  levelUp: {
    type: 'level',
    title: 'Level Up!',
    message: 'Congratulations! You\'ve reached a new level.'
  }
};

// Event handlers for different notification types
const handleReportSubmitted = async (report, user) => {
  try {
    // Create in-app notification
    await createNotification(
      user._id,
      'info',
      'Report Submitted',
      'Your report has been submitted successfully and is being reviewed.',
      { reportId: report._id, category: report.category }
    );
    
    // Send email if user has email notifications enabled
    if (user.notificationPreferences?.email?.reportSubmitted !== false) {
      await sendEmail(user.email, 'reportSubmitted', {
        userName: user.name || user.email,
        category: report.category,
        description: report.description,
        status: report.status,
        reportId: report._id
      });
    }
    
    // Send webhook if configured
    await deliverWebhook('report.submitted', {
      reportId: report._id,
      userId: user._id,
      category: report.category
    });
    
  } catch (error) {
    console.error('Handle report submitted failed:', error);
  }
};

const handleReportUpdated = async (report, user, previousStatus, comment) => {
  try {
    // Create in-app notification
    await createNotification(
      user._id,
      'info',
      'Report Updated',
      `Your report status has been updated from ${previousStatus} to ${report.status}.`,
      { reportId: report._id, previousStatus, newStatus: report.status }
    );
    
    // Send email if user has email notifications enabled
    if (user.notificationPreferences?.email?.reportUpdated !== false) {
      await sendEmail(user.email, 'reportUpdated', {
        userName: user.name || user.email,
        category: report.category,
        newStatus: report.status,
        previousStatus,
        reportId: report._id,
        comment
      });
    }
    
    // Send webhook if configured
    await deliverWebhook('report.updated', {
      reportId: report._id,
      userId: user._id,
      previousStatus,
      newStatus: report.status
    });
    
  } catch (error) {
    console.error('Handle report updated failed:', error);
  }
};

const handleReportResolved = async (report, user) => {
  try {
    // Create in-app notification
    await createNotification(
      user._id,
      'success',
      'Report Resolved',
      'Your report has been resolved! Thank you for your contribution.',
      { reportId: report._id, category: report.category }
    );
    
    // Send email if user has email notifications enabled
    if (user.notificationPreferences?.email?.reportResolved !== false) {
      await sendEmail(user.email, 'reportResolved', {
        userName: user.name || user.email,
        category: report.category,
        description: report.description,
        resolutionTime: '2 days', // Calculate actual time
        reportId: report._id
      });
    }
    
    // Send webhook if configured
    await deliverWebhook('report.resolved', {
      reportId: report._id,
      userId: user._id,
      category: report.category
    });
    
  } catch (error) {
    console.error('Handle report resolved failed:', error);
  }
};

module.exports = {
  sendEmail,
  createNotification,
  sendBulkNotification,
  markAsRead,
  markAllAsRead,
  getUserNotifications,
  deleteNotification,
  updateNotificationPreferences,
  sendPushNotification,
  notificationTemplates,
  handleReportSubmitted,
  handleReportUpdated,
  handleReportResolved
}; 
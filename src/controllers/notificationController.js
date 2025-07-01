const Notification = require('../models/Notification');
const Report = require('../models/Report');

// GET /api/notifications (for users)
async function getUserNotifications(req, res) {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const filter = { userId: req.user.userId };
    
    if (unreadOnly === 'true') {
      filter.read = false;
    }
    
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('reportId', 'category description status');
    
    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });
    
    res.json({
      notifications,
      total,
      page: Number(page),
      limit: Number(limit),
      unreadCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/notifications/admin (for admins)
async function getAdminNotifications(req, res) {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const filter = { adminId: req.user.userId };
    
    if (unreadOnly === 'true') {
      filter.read = false;
    }
    
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    
    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ adminId: req.user.userId, read: false });
    
    res.json({
      notifications,
      total,
      page: Number(page),
      limit: Number(limit),
      unreadCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/notifications/:id/read
async function markAsRead(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/notifications/read-all
async function markAllAsRead(req, res) {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { read: true }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// DELETE /api/notifications/:id
async function deleteNotification(req, res) {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Helper function to create user notifications
async function createUserNotification(userId, type, title, message, details = {}, reportId = null) {
  try {
    const notification = new Notification({
      type,
      title,
      message,
      details,
      userId,
      reportId,
      priority: type === 'report_resolved' ? 'high' : 'medium'
    });
    
    await notification.save();
    return notification;
  } catch (err) {
    console.error('Error creating user notification:', err);
  }
}

// Helper function to create admin notifications
async function createAdminNotification(adminId, type, title, message, details = {}) {
  try {
    const notification = new Notification({
      type,
      title,
      message,
      details,
      adminId
    });
    
    await notification.save();
    return notification;
  } catch (err) {
    console.error('Error creating admin notification:', err);
  }
}

module.exports = {
  getUserNotifications,
  getAdminNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createUserNotification,
  createAdminNotification
}; 
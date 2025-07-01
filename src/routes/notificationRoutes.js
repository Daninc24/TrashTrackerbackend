const express = require('express');
const { 
  getUserNotifications, 
  getAdminNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification 
} = require('../controllers/notificationController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// User notification routes
router.get('/', auth, getUserNotifications);
router.put('/:id/read', auth, markAsRead);
router.put('/read-all', auth, markAllAsRead);
router.delete('/:id', auth, deleteNotification);

// Admin notification routes
router.get('/admin', auth, admin, getAdminNotifications);

module.exports = router; 
const express = require('express');
const { body } = require('express-validator');
const {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  updateNotificationPreferences,
  updatePrivacySettings,
  updateSettings,
  getUserStats,
  deleteAccount
} = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Profile validation
const profileValidation = [
  body('firstName').optional().custom(value => {
    if (value !== undefined && value !== null && value !== '' && (value.length < 1 || value.length > 50)) {
      throw new Error('First name must be between 1 and 50 characters');
    }
    return true;
  }),
  body('lastName').optional().custom(value => {
    if (value !== undefined && value !== null && value !== '' && (value.length < 1 || value.length > 50)) {
      throw new Error('Last name must be between 1 and 50 characters');
    }
    return true;
  }),
  body('displayName').optional().custom(value => {
    if (value !== undefined && value !== null && value !== '' && (value.length < 1 || value.length > 50)) {
      throw new Error('Display name must be between 1 and 50 characters');
    }
    return true;
  }),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('phone').optional().custom(value => {
    if (value !== undefined && value !== null && value !== '' && !/^\+?[\d\s\-\(\)]+$/.test(value)) {
      throw new Error('Please enter a valid phone number');
    }
    return true;
  }),
  body('website').optional().custom(value => {
    if (value !== undefined && value !== null && value !== '' && !/^https?:\/\/.+/.test(value)) {
      throw new Error('Please enter a valid website URL');
    }
    return true;
  }),
  body('dateOfBirth').optional().isISO8601().withMessage('Please enter a valid date')
];

// Password validation
const passwordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
];

// Routes
router.get('/profile', getProfile);
router.put('/profile', profileValidation, updateProfile);
router.put('/avatar', updateAvatar);
router.put('/password', passwordValidation, changePassword);
router.put('/notifications', updateNotificationPreferences);
router.put('/privacy', updatePrivacySettings);
router.put('/settings', updateSettings);
router.get('/stats', getUserStats);
router.delete('/account', body('password').notEmpty().withMessage('Password is required'), deleteAccount);

module.exports = router; 
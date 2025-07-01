const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

// GET /api/user/profile
async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('stats');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/user/profile
async function updateProfile(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  
  try {
    const { firstName, lastName, displayName, bio, location, phone, website, dateOfBirth } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update profile fields - handle empty strings properly
    user.profile = {
      ...user.profile,
      firstName: firstName !== undefined ? firstName : user.profile.firstName,
      lastName: lastName !== undefined ? lastName : user.profile.lastName,
      displayName: displayName !== undefined ? displayName : user.profile.displayName,
      bio: bio !== undefined ? bio : user.profile.bio,
      location: location !== undefined ? location : user.profile.location,
      phone: phone !== undefined ? phone : user.profile.phone,
      website: website !== undefined ? website : user.profile.website,
      dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : user.profile.dateOfBirth
    };
    
    await user.save();
    
    // Update stats
    await user.updateStats();
    
    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/user/avatar
async function updateAvatar(req, res) {
  try {
    const { avatar } = req.body;
    
    if (!avatar) {
      return res.status(400).json({ error: 'Avatar data is required' });
    }
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.profile.avatar = avatar;
    await user.save();
    
    res.json({ message: 'Avatar updated successfully', avatar: user.profile.avatar });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/user/password
async function changePassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/user/notifications
async function updateNotificationPreferences(req, res) {
  try {
    const { notifications } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.notifications = {
      ...user.notifications,
      ...notifications
    };
    
    await user.save();
    
    res.json({ message: 'Notification preferences updated successfully', notifications: user.notifications });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/user/privacy
async function updatePrivacySettings(req, res) {
  try {
    const { privacy } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.privacy = {
      ...user.privacy,
      ...privacy
    };
    
    await user.save();
    
    res.json({ message: 'Privacy settings updated successfully', privacy: user.privacy });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/user/settings
async function updateSettings(req, res) {
  try {
    const { settings } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.settings = {
      ...user.settings,
      ...settings
    };
    
    await user.save();
    
    res.json({ message: 'Settings updated successfully', settings: user.settings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/user/stats
async function getUserStats(req, res) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update stats before returning
    await user.updateStats();
    
    res.json({
      stats: user.stats,
      profile: {
        fullName: user.profile.fullName,
        avatarUrl: user.profile.avatarUrl,
        joinDate: user.profile.joinDate
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/user/account
async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Delete user
    await User.findByIdAndDelete(req.user.userId);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  updateNotificationPreferences,
  updatePrivacySettings,
  updateSettings,
  getUserStats,
  deleteAccount
}; 
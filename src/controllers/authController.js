const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createNotification } = require('./notificationController');

// POST /api/auth/register
async function register(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is banned
    if (!user.active) {
      return res.status(403).json({ error: 'Account is banned. Please contact administrator.' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/auth/users (admin only)
async function getAllUsers(req, res) {
  try {
    const users = await User.find({}, '-password');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/auth/users/:id/role (admin only)
async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const originalUser = await User.findById(id);
    if (!originalUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = await User.findByIdAndUpdate(id, { role }, { new: true, select: '-password' });
    
    // Create notification
    await createNotification(
      'role_changed',
      'User Role Updated',
      `User ${user.email} role changed from ${originalUser.role} to ${role}`,
      req.user.id,
      { userId: id, userEmail: user.email, newRole: role, previousRole: originalUser.role }
    );
    
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/auth/users/:id (admin only)
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create notification
    await createNotification(
      'user_deleted',
      'User Deleted',
      `User ${user.email} was deleted`,
      req.user.id,
      { userId: id, userEmail: user.email }
    );
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/auth/users/:id/stats (admin only)
async function getUserStats(req, res) {
  try {
    const { id } = req.params;
    const Report = require('../models/Report');
    
    // Get user's reports count
    const reportsCount = await Report.countDocuments({ createdBy: id });
    
    // Get user's reports by status
    const reportsByStatus = await Report.aggregate([
      { $match: { createdBy: require('mongoose').Types.ObjectId(id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get user's reports by category
    const reportsByCategory = await Report.aggregate([
      { $match: { createdBy: require('mongoose').Types.ObjectId(id) } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Get user's latest report
    const latestReport = await Report.findOne({ createdBy: id })
      .sort({ createdAt: -1 })
      .select('createdAt category status');
    
    res.json({
      reportsCount,
      reportsByStatus,
      reportsByCategory,
      latestReport: latestReport ? {
        createdAt: latestReport.createdAt,
        category: latestReport.category,
        status: latestReport.status
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/auth/users/:id/toggle-status (admin only)
async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Toggle the active status
    const previousStatus = user.active;
    user.active = !user.active;
    await user.save();
    
    // Create notification
    await createNotification(
      user.active ? 'user_unbanned' : 'user_banned',
      user.active ? 'User Activated' : 'User Banned',
      `User ${user.email} was ${user.active ? 'activated' : 'banned'}`,
      req.user.id,
      { userId: id, userEmail: user.email, previousStatus, newStatus: user.active }
    );
    
    res.json({ 
      user: { 
        _id: user._id, 
        email: user.email, 
        role: user.role, 
        active: user.active,
        createdAt: user.createdAt 
      },
      message: user.active ? 'User activated successfully' : 'User banned successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/auth/users/bulk (admin only)
async function bulkDeleteUsers(req, res) {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }
    
    const result = await User.deleteMany({ _id: { $in: userIds } });
    
    // Create notification
    await createNotification(
      'bulk_action',
      'Bulk User Deletion',
      `Successfully deleted ${result.deletedCount} users`,
      req.user.id,
      { action: 'delete', count: result.deletedCount, userIds }
    );
    
    res.json({ 
      message: `Successfully deleted ${result.deletedCount} users`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/auth/users/bulk/role (admin only)
async function bulkUpdateUserRoles(req, res) {
  try {
    const { userIds, role } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { role }
    );
    
    // Create notification
    await createNotification(
      'bulk_action',
      'Bulk Role Update',
      `Successfully updated ${result.modifiedCount} users to ${role}`,
      req.user.id,
      { action: 'role_update', count: result.modifiedCount, newRole: role, userIds }
    );
    
    res.json({ 
      message: `Successfully updated ${result.modifiedCount} users to ${role}`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/auth/users/bulk/status (admin only)
async function bulkUpdateUserStatus(req, res) {
  try {
    const { userIds, active } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }
    
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Active status must be boolean' });
    }
    
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { active }
    );
    
    const action = active ? 'activated' : 'banned';
    
    // Create notification
    await createNotification(
      'bulk_action',
      `Bulk User ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      `Successfully ${action} ${result.modifiedCount} users`,
      req.user.id,
      { action: action, count: result.modifiedCount, newStatus: active, userIds }
    );
    
    res.json({ 
      message: `Successfully ${action} ${result.modifiedCount} users`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/auth/users/export (admin only)
async function exportUsers(req, res) {
  try {
    const { format = 'csv', filters = {} } = req.query;
    
    let query = {};
    
    // Apply filters
    if (filters.role) {
      query.role = filters.role;
    }
    if (filters.active !== undefined) {
      query.active = filters.active === 'true';
    }
    if (filters.search) {
      query.email = { $regex: filters.search, $options: 'i' };
    }
    
    const users = await User.find(query).select('-password').lean();
    
    if (format === 'csv') {
      // Generate CSV data
      const csvHeaders = ['Email', 'Role', 'Status', 'Created At', 'User ID'];
      const csvRows = users.map(user => [
        user.email,
        user.role,
        user.active ? 'Active' : 'Banned',
        new Date(user.createdAt).toISOString(),
        user._id
      ]);
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
      
      // Create notification for export
      await createNotification(
        'export',
        'User Data Exported',
        `Exported ${users.length} users to CSV`,
        req.user.id,
        { format: 'csv', count: users.length, filters }
      );
    } else {
      res.json(users);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { 
  register, 
  login, 
  getAllUsers, 
  updateUserRole, 
  deleteUser, 
  getUserStats, 
  toggleUserStatus,
  bulkDeleteUsers,
  bulkUpdateUserRoles,
  bulkUpdateUserStatus,
  exportUsers
}; 
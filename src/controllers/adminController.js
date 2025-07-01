const User = require('../models/User');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');

// GET /api/admin/overview
const getOverview = async (req, res) => {
  try {
    // User stats
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 7*24*60*60*1000) } });
    const newUsers = await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } });

    // Report stats
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const inProgressReports = await Report.countDocuments({ status: 'in progress' });
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });
    const flaggedReports = await Report.countDocuments({ flagged: true });

    // Recent activity
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10).select('email name createdAt role');
    const recentReports = await Report.find().sort({ createdAt: -1 }).limit(10).select('category status createdAt flagged');
    const recentAudit = await AuditLog.find().sort({ timestamp: -1 }).limit(10).select('action userEmail resource timestamp');

    res.json({
      userStats: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers
      },
      reportStats: {
        total: totalReports,
        pending: pendingReports,
        inProgress: inProgressReports,
        resolved: resolvedReports,
        flagged: flaggedReports
      },
      recentActivity: {
        users: recentUsers,
        reports: recentReports,
        audit: recentAudit
      }
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
};

// GET /api/admin/users
const listUsers = async (req, res) => {
  try {
    const { search, role, status, sort = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (status === 'active') query.active = true;
    if (status === 'banned') query.active = false;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await User.countDocuments(query);
    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list users' });
  }
};

// GET /api/admin/users/:id
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Get user reports and audit logs
    const reports = await Report.find({ createdBy: user._id }).sort({ createdAt: -1 }).limit(10);
    const auditLogs = await AuditLog.find({ userId: user._id }).sort({ timestamp: -1 }).limit(10);
    res.json({ user, reports, auditLogs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};

// PUT /api/admin/users/:id/role
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin', 'moderator'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

// PUT /api/admin/users/:id/status
const updateUserStatus = async (req, res) => {
  try {
    const { active } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { active }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// POST /api/admin/users/bulk
const bulkUserAction = async (req, res) => {
  try {
    const { ids, action, value } = req.body;
    if (!Array.isArray(ids) || !action) return res.status(400).json({ error: 'Invalid request' });
    let result;
    switch (action) {
      case 'delete':
        result = await User.deleteMany({ _id: { $in: ids } });
        break;
      case 'role':
        if (!['user', 'admin', 'moderator'].includes(value)) return res.status(400).json({ error: 'Invalid role' });
        result = await User.updateMany({ _id: { $in: ids } }, { role: value });
        break;
      case 'status':
        result = await User.updateMany({ _id: { $in: ids } }, { active: value });
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ message: 'Bulk action completed', result });
  } catch (error) {
    res.status(500).json({ error: 'Bulk action failed' });
  }
};

// GET /api/admin/users/:id/export
const exportUserData = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const reports = await Report.find({ createdBy: user._id }).lean();
    const auditLogs = await AuditLog.find({ userId: user._id }).lean();
    res.json({ user, reports, auditLogs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export user data' });
  }
};

module.exports = {
  getOverview,
  listUsers,
  getUserProfile,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  bulkUserAction,
  exportUserData
}; 
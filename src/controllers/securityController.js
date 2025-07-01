const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Report = require('../models/Report');
const { requireRole } = require('../middleware/security');

// Get audit logs with filtering
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, resource, level, startDate, endDate } = req.query;
    
    const filters = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (resource) filters.resource = resource;
    if (level) filters.level = level;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const logs = await AuditLog.getLogs(filters, parseInt(page), parseInt(limit));
    const total = await AuditLog.countDocuments(filters);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// Get security events
const getSecurityEvents = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const events = await AuditLog.getSecurityEvents(parseInt(days));
    
    res.json({ events });
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
};

// Get GDPR compliance report for a user
const getGDPRReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const report = await AuditLog.getGDPRReport(userId, startDate, endDate);
    
    res.json({ report });
  } catch (error) {
    console.error('Error fetching GDPR report:', error);
    res.status(500).json({ error: 'Failed to fetch GDPR report' });
  }
};

// Delete user data for GDPR compliance
const deleteUserData = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user data from all collections
    await Promise.all([
      AuditLog.deleteUserData(userId),
      Report.updateMany(
        { createdBy: userId },
        { 
          $set: {
            createdBy: null,
            createdByEmail: '[DELETED]',
            gdprCompliant: true
          }
        }
      ),
      User.findByIdAndUpdate(userId, {
        email: '[DELETED]',
        name: '[DELETED]',
        isDeleted: true,
        deletedAt: new Date(),
        gdprCompliant: true
      })
    ]);

    // Log the deletion
    await AuditLog.log({
      level: 'security',
      action: 'GDPR_DATA_DELETION',
      resource: 'user',
      resourceId: userId,
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.originalUrl,
      statusCode: 200,
      metadata: { deletedUserId: userId }
    });

    res.json({ message: 'User data deleted successfully for GDPR compliance' });
  } catch (error) {
    console.error('Error deleting user data:', error);
    res.status(500).json({ error: 'Failed to delete user data' });
  }
};

// Get security dashboard data
const getSecurityDashboard = async (req, res) => {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      securityEvents30Days,
      securityEvents7Days,
      securityEvents24Hours,
      failedLogins,
      suspiciousActivities
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ level: 'security', timestamp: { $gte: last30Days } }),
      AuditLog.countDocuments({ level: 'security', timestamp: { $gte: last7Days } }),
      AuditLog.countDocuments({ level: 'security', timestamp: { $gte: last24Hours } }),
      AuditLog.countDocuments({ 
        action: 'LOGIN_FAILED',
        timestamp: { $gte: last30Days }
      }),
      AuditLog.countDocuments({
        level: 'warning',
        timestamp: { $gte: last30Days }
      })
    ]);

    // Get recent security events
    const recentSecurityEvents = await AuditLog.find({
      level: 'security',
      timestamp: { $gte: last7Days }
    })
    .sort({ timestamp: -1 })
    .limit(10)
    .populate('userId', 'email role')
    .lean();

    res.json({
      stats: {
        totalLogs,
        securityEvents30Days,
        securityEvents7Days,
        securityEvents24Hours,
        failedLogins,
        suspiciousActivities
      },
      recentSecurityEvents
    });
  } catch (error) {
    console.error('Error fetching security dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch security dashboard' });
  }
};

// Export user data for GDPR compliance
const exportUserData = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all user data
    const [userReports, userAuditLogs] = await Promise.all([
      Report.find({ createdBy: userId }).lean(),
      AuditLog.find({ userId }).lean()
    ]);

    const userData = {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      reports: userReports.map(report => ({
        id: report._id,
        category: report.category,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt,
        location: report.location
      })),
      auditLogs: userAuditLogs.map(log => ({
        timestamp: log.timestamp,
        action: log.action,
        resource: log.resource,
        ipAddress: log.ipAddress
      }))
    };

    // Log the export
    await AuditLog.log({
      level: 'info',
      action: 'GDPR_DATA_EXPORT',
      resource: 'user',
      resourceId: userId,
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.originalUrl,
      statusCode: 200,
      metadata: { exportedUserId: userId }
    });

    res.json({ userData });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
};

module.exports = {
  getAuditLogs,
  getSecurityEvents,
  getGDPRReport,
  deleteUserData,
  getSecurityDashboard,
  exportUserData
}; 
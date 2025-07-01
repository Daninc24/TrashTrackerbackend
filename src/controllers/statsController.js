const Report = require('../models/Report');
const User = require('../models/User');

// Get basic stats
exports.getStats = async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const totalUsers = await User.countDocuments();
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const inProgressReports = await Report.countDocuments({ status: 'in progress' });

    res.json({
      totalReports,
      totalUsers,
      resolvedReports,
      pendingReports,
      inProgressReports,
      resolutionRate: totalReports > 0 ? ((resolvedReports / totalReports) * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

// Get advanced analytics
exports.getAdvancedAnalytics = async (req, res) => {
  try {
    const { period = '30d', category, status } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build filter
    const filter = { createdAt: { $gte: startDate } };
    if (category) filter.category = category;
    if (status) filter.status = status;

    // Get reports for the period
    const reports = await Report.find(filter);

    // Daily trends
    const dailyTrends = [];
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayReports = reports.filter(report => 
        report.createdAt >= dayStart && report.createdAt <= dayEnd
      );

      dailyTrends.push({
        date: currentDate.toISOString().split('T')[0],
        total: dayReports.length,
        pending: dayReports.filter(r => r.status === 'pending').length,
        inProgress: dayReports.filter(r => r.status === 'in progress').length,
        resolved: dayReports.filter(r => r.status === 'resolved').length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Category distribution
    const categoryStats = await Report.aggregate([
      { $match: filter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Status distribution
    const statusStats = await Report.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Top contributors
    const topContributors = await Report.aggregate([
      { $match: filter },
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          email: '$user.email',
          count: 1
        }
      }
    ]);

    // Resolution time analysis
    const resolvedReports = await Report.find({ 
      ...filter, 
      status: 'resolved',
      resolvedAt: { $exists: true }
    });

    const resolutionTimes = resolvedReports.map(report => {
      const created = new Date(report.createdAt);
      const resolved = new Date(report.resolvedAt);
      return Math.ceil((resolved - created) / (1000 * 60 * 60 * 24)); // days
    });

    const avgResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length 
      : 0;

    // Performance metrics
    const performanceMetrics = {
      totalReports: reports.length,
      avgReportsPerDay: reports.length / Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)),
      resolutionRate: reports.length > 0 ? ((reports.filter(r => r.status === 'resolved').length / reports.length) * 100).toFixed(1) : 0,
      avgResolutionTime: Math.round(avgResolutionTime),
      activeUsers: await User.countDocuments({ lastLoginAt: { $gte: startDate } })
    };

    res.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      dailyTrends,
      categoryStats,
      statusStats,
      topContributors,
      performanceMetrics
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

// Get user-specific analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get user's reports
    const userReports = await Report.find({
      createdBy: userId,
      createdAt: { $gte: startDate }
    });

    // Daily activity
    const dailyActivity = [];
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayReports = userReports.filter(report => 
        report.createdAt >= dayStart && report.createdAt <= dayEnd
      );

      dailyActivity.push({
        date: currentDate.toISOString().split('T')[0],
        reports: dayReports.length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Category breakdown
    const categoryBreakdown = await Report.aggregate([
      { 
        $match: { 
          createdBy: userId,
          createdAt: { $gte: startDate }
        } 
      },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Status breakdown
    const statusBreakdown = await Report.aggregate([
      { 
        $match: { 
          createdBy: userId,
          createdAt: { $gte: startDate }
        } 
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // User stats
    const userStats = {
      totalReports: userReports.length,
      pendingReports: userReports.filter(r => r.status === 'pending').length,
      inProgressReports: userReports.filter(r => r.status === 'in progress').length,
      resolvedReports: userReports.filter(r => r.status === 'resolved').length,
      resolutionRate: userReports.length > 0 ? ((userReports.filter(r => r.status === 'resolved').length / userReports.length) * 100).toFixed(1) : 0,
      avgReportsPerDay: userReports.length / Math.ceil((now - startDate) / (1000 * 60 * 60 * 24))
    };

    res.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      dailyActivity,
      categoryBreakdown,
      statusBreakdown,
      userStats
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching user analytics', error: error.message });
  }
};

// Export analytics data
exports.exportAnalytics = async (req, res) => {
  try {
    const { period = '30d', format = 'csv' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const reports = await Report.find({ createdAt: { $gte: startDate } })
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvData = reports.map(report => ({
        ID: report._id,
        Category: report.category,
        Description: report.description,
        Status: report.status,
        CreatedBy: report.createdBy?.email || 'Unknown',
        CreatedAt: report.createdAt,
        ResolvedAt: report.resolvedAt,
        Location: report.location ? `${report.location.coordinates[1]}, ${report.location.coordinates[0]}` : '',
        ImageUrl: report.imageUrl || ''
      }));

      const csvHeaders = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','));
      const csv = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else {
      res.json({
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalReports: reports.length,
        reports: reports
      });
    }

  } catch (error) {
    res.status(500).json({ message: 'Error exporting analytics', error: error.message });
  }
}; 
const Report = require('../models/Report');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { createUserNotification } = require('./notificationController');
const GamificationService = require('../services/gamificationService');

// POST /api/reports
async function createReport(req, res) {
  console.log('Received report data:', {
    body: req.body,
    file: req.file ? { name: req.file.originalname, size: req.file.size } : null
  });
  
  // Temporarily disable validation for debugging
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   console.log('Validation errors:', errors.array());
  //   return res.status(422).json({ errors: errors.array() });
  // }
  
  // Basic validation
  if (!req.body.category || !req.body.location || !req.body.description) {
    return res.status(422).json({ 
      error: 'Missing required fields',
      received: req.body 
    });
  }
  
  try {
    let imageUrl = null;
    
    // Handle image upload if present
    if (req.file) {
      // Convert buffer to base64 for simple storage
      const base64Image = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      imageUrl = `data:${mimeType};base64,${base64Image}`;
    }
    
    let { category, location, description } = req.body;
    console.log('Parsing location:', location, typeof location);
    
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
        console.log('Parsed location:', location);
      } catch (e) {
        console.log('Location parse error:', e.message);
        return res.status(400).json({ error: 'Invalid location format' });
      }
    }
    
    // Validate location structure
    if (!location || typeof location !== 'object' || location.type !== 'Point' || !Array.isArray(location.coordinates)) {
      return res.status(400).json({ error: 'Invalid location structure' });
    }
    
    const report = new Report({ 
      category, 
      location, 
      description, 
      imageUrl, 
      priority: req.body.priority || 'medium',
      severity: req.body.severity || 'moderate',
      tags: req.body.tags || [],
      address: req.body.address || '',
      estimatedCleanupTime: req.body.estimatedCleanupTime || null,
      createdBy: req.user.userId 
    });
    
    await report.save();
    
    // Update user stats and award points
    const user = await User.findById(req.user.userId);
    user.stats.totalReports += 1;
    await user.save();
    
    // Award points for report submission
    await GamificationService.awardPoints(req.user.userId, 'REPORT_SUBMITTED');
    
    // Update streak
    await GamificationService.updateStreak(req.user.userId);
    
    // Check for achievements
    await GamificationService.checkAchievements(user, 'report');
    
    // Create welcome notification for new users
    const userReports = await Report.countDocuments({ createdBy: req.user.userId });
    if (userReports === 1) {
      await createUserNotification(
        req.user.userId,
        'welcome',
        'Welcome to RashTrackr! 🎉',
        'Thank you for submitting your first report. You\'re now part of our community making a difference!',
        { reportId: report._id },
        report._id
      );
    } else {
      await createUserNotification(
        req.user.userId,
        'report_status_changed',
        'Report Submitted Successfully! 📝',
        `Your "${category}" report has been submitted and is now under review.`,
        { reportId: report._id, status: 'pending' },
        report._id
      );
    }
    
    res.status(201).json(report);
  } catch (err) {
    console.error('Error creating report:', err);
    res.status(400).json({ error: err.message });
  }
}

// GET /api/reports
async function getReports(req, res) {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Report.countDocuments(filter);
    res.json({ total, page: Number(page), limit: Number(limit), reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/reports/:id
async function getReportById(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/reports/:id/status
async function updateReportStatus(req, res) {
  try {
    const { status } = req.body;
    const updateData = { status };
    
    // Set resolvedAt when status is changed to 'resolved'
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }
    
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    
    // Award points if report is resolved
    if (status === 'resolved' && report.createdBy) {
      await GamificationService.awardPoints(report.createdBy, 'REPORT_RESOLVED');
      
      // Update user stats
      const user = await User.findById(report.createdBy);
      if (user) {
        user.stats.resolvedReports += 1;
        await user.save();
      }
    }
    
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/reports/my
async function getMyReports(req, res) {
  try {
    const reports = await Report.find({ createdBy: req.user.userId })
      .populate('assignedTo', 'profile.firstName profile.lastName email')
      .populate('resolvedBy', 'profile.firstName profile.lastName email')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/reports/:id/comments
async function addComment(req, res) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.comments.push({
      user: req.user.userId,
      text: text.trim()
    });

    await report.save();

    // Notify report creator if comment is from someone else
    if (report.createdBy.toString() !== req.user.userId) {
      await createUserNotification(
        report.createdBy,
        'comment_added',
        'New Comment on Your Report 💬',
        `Someone commented on your "${report.category}" report.`,
        { reportId: report._id, commentId: report.comments[report.comments.length - 1]._id },
        report._id
      );
    }

    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/reports/:id/like
async function toggleLike(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const userId = req.user.userId;
    const likeIndex = report.likes.indexOf(userId);

    if (likeIndex > -1) {
      report.likes.splice(likeIndex, 1);
    } else {
      report.likes.push(userId);
    }

    await report.save();
    res.json({ likes: report.likes.length, isLiked: likeIndex === -1 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/reports/:id/share
async function shareReport(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.shares += 1;
    await report.save();

    res.json({ shares: report.shares });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/reports/:id/view
async function incrementViews(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.views += 1;
    await report.save();

    res.json({ views: report.views });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/reports/:id/assign
async function assignReport(req, res) {
  try {
    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const user = await User.findById(assignedTo);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    report.assignedTo = assignedTo;
    report.updates.push({
      status: report.status,
      message: `Report assigned to ${user.profile.firstName || user.email}`,
      updatedBy: req.user.userId
    });

    await report.save();

    // Notify assigned user
    await createUserNotification(
      assignedTo,
      'report_assigned',
      'Report Assigned to You 📋',
      `You have been assigned a "${report.category}" report.`,
      { reportId: report._id },
      report._id
    );

    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/reports/search
async function searchReports(req, res) {
  try {
    const { 
      q, 
      category, 
      status, 
      priority, 
      severity, 
      tags,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    // Text search
    if (q) {
      filter.$or = [
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ];
    }

    // Filters
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (severity) filter.severity = severity;
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }

    // Date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const reports = await Report.find(filter)
      .populate('createdBy', 'profile.firstName profile.lastName email')
      .populate('assignedTo', 'profile.firstName profile.lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Report.countDocuments(filter);

    res.json({
      reports,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/reports/analytics
async function getReportAnalytics(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [
      totalReports,
      resolvedReports,
      categoryStats,
      statusStats,
      priorityStats,
      severityStats,
      monthlyStats
    ] = await Promise.all([
      Report.countDocuments(filter),
      Report.countDocuments({ ...filter, status: 'resolved' }),
      Report.aggregate([
        { $match: filter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Report.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Report.aggregate([
        { $match: filter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Report.aggregate([
        { $match: filter },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Report.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

    res.json({
      totalReports,
      resolvedReports,
      resolutionRate: totalReports > 0 ? (resolvedReports / totalReports * 100).toFixed(1) : 0,
      categoryStats,
      statusStats,
      priorityStats,
      severityStats,
      monthlyStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { 
  createReport, 
  getReports, 
  getReportById, 
  updateReportStatus, 
  getMyReports,
  addComment,
  toggleLike,
  shareReport,
  incrementViews,
  assignReport,
  searchReports,
  getReportAnalytics
}; 
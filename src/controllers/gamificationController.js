const GamificationService = require('../services/gamificationService');
const User = require('../models/User');

// Get user progress and stats
exports.getUserProgress = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    let progress;
    try {
      progress = await GamificationService.getUserProgress(req.user.id);
    } catch (err) {
      if (err.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(500).json({ error: err.message || 'Failed to get user progress' });
    }
    res.json(progress);
  } catch (error) {
    console.error('Error getting user progress:', error);
    res.status(500).json({ error: error.message || 'Failed to get user progress' });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { type = 'points', limit = 10 } = req.query;
    const leaderboard = await GamificationService.getLeaderboard(type, parseInt(limit));
    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
};

// Get all achievements
exports.getAllAchievements = async (req, res) => {
  try {
    const achievements = GamificationService.getAllAchievements();
    res.json(achievements);
  } catch (error) {
    console.error('Error getting achievements:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
};

// Get user achievements
exports.getUserAchievements = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const user = await User.findById(req.user.id).select('stats.achievements');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.stats) user.stats = { achievements: [] };
    if (!user.stats.achievements) user.stats.achievements = [];
    res.json(user.stats.achievements);
  } catch (error) {
    console.error('Error getting user achievements:', error);
    res.status(500).json({ error: error.message || 'Failed to get user achievements' });
  }
};

// Award points (admin only)
exports.awardPoints = async (req, res) => {
  try {
    const { userId, action, amount } = req.body;
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await GamificationService.awardPoints(userId, action, amount);
    res.json(result);
  } catch (error) {
    console.error('Error awarding points:', error);
    res.status(500).json({ error: 'Failed to award points' });
  }
};

// Get user stats
exports.getUserStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('stats');
    res.json(user.stats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
};

// Get global stats
exports.getGlobalStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalPoints: { $sum: '$stats.totalPoints' },
          totalReports: { $sum: '$stats.totalReports' },
          totalResolved: { $sum: '$stats.resolvedReports' },
          avgLevel: { $avg: '$stats.level' },
          avgStreak: { $avg: '$stats.longestStreak' }
        }
      }
    ]);

    res.json(stats[0] || {
      totalUsers: 0,
      totalPoints: 0,
      totalReports: 0,
      totalResolved: 0,
      avgLevel: 0,
      avgStreak: 0
    });
  } catch (error) {
    console.error('Error getting global stats:', error);
    res.status(500).json({ error: 'Failed to get global stats' });
  }
}; 
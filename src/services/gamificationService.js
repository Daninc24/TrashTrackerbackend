const User = require('../models/User');
const Challenge = require('../models/Challenge');
const Team = require('../models/Team');

// Achievement definitions
const ACHIEVEMENTS = {
  FIRST_REPORT: {
    id: 'first_report',
    name: 'First Steps',
    description: 'Submit your first report',
    icon: '🎯',
    points: 10
  },
  REPORTS_10: {
    id: 'reports_10',
    name: 'Getting Started',
    description: 'Submit 10 reports',
    icon: '📝',
    points: 50
  },
  REPORTS_50: {
    id: 'reports_50',
    name: 'Dedicated Reporter',
    description: 'Submit 50 reports',
    icon: '📊',
    points: 200
  },
  REPORTS_100: {
    id: 'reports_100',
    name: 'Report Master',
    description: 'Submit 100 reports',
    icon: '🏆',
    points: 500
  },
  STREAK_3: {
    id: 'streak_3',
    name: 'Consistent',
    description: 'Report for 3 consecutive days',
    icon: '🔥',
    points: 30
  },
  STREAK_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Report for 7 consecutive days',
    icon: '⚡',
    points: 100
  },
  STREAK_30: {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Report for 30 consecutive days',
    icon: '💎',
    points: 500
  },
  LEVEL_5: {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    points: 100
  },
  LEVEL_10: {
    id: 'level_10',
    name: 'Community Hero',
    description: 'Reach level 10',
    icon: '🌟',
    points: 300
  },
  LEVEL_25: {
    id: 'level_25',
    name: 'Legend',
    description: 'Reach level 25',
    icon: '👑',
    points: 1000
  },
  TEAM_JOIN: {
    id: 'team_join',
    name: 'Team Player',
    description: 'Join a community team',
    icon: '🤝',
    points: 50
  },
  CHALLENGE_WIN: {
    id: 'challenge_win',
    name: 'Challenge Champion',
    description: 'Win your first challenge',
    icon: '🏅',
    points: 200
  },
  SOCIAL_BUTTERFLY: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Have 10 followers',
    icon: '🦋',
    points: 100
  }
};

// Points system
const POINTS = {
  REPORT_SUBMITTED: 10,
  REPORT_RESOLVED: 25,
  DAILY_LOGIN: 5,
  STREAK_BONUS: 5, // per day in streak
  CHALLENGE_COMPLETION: 100,
  TEAM_CONTRIBUTION: 15,
  SOCIAL_ACTION: 2 // likes, shares, comments
};

class GamificationService {
  // Award points to user
  static async awardPoints(userId, action, amount = null) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const pointsToAward = amount || POINTS[action] || 0;
      if (pointsToAward <= 0) return;

      user.stats.totalPoints += pointsToAward;
      user.stats.experience += pointsToAward;

      // Check for level up
      await this.checkLevelUp(user);

      await user.save();
      return { pointsAwarded: pointsToAward, newTotal: user.stats.totalPoints };
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  // Check and handle level up
  static async checkLevelUp(user) {
    const currentLevel = user.stats.level;
    const experience = user.stats.experience;
    const experienceToNext = user.stats.experienceToNextLevel;

    if (experience >= experienceToNext) {
      user.stats.level += 1;
      user.stats.experience -= experienceToNext;
      user.stats.experienceToNextLevel = Math.floor(experienceToNext * 1.2); // 20% increase

      // Award level up bonus
      const levelUpBonus = currentLevel * 10;
      user.stats.totalPoints += levelUpBonus;

      // Check for level-based achievements
      await this.checkAchievements(user, 'level');

      return { leveledUp: true, newLevel: user.stats.level, bonus: levelUpBonus };
    }

    return { leveledUp: false };
  }

  // Update streak
  static async updateStreak(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastReport = user.stats.lastReportDate;
      const lastReportDate = lastReport ? new Date(lastReport) : null;
      if (lastReportDate) {
        lastReportDate.setHours(0, 0, 0, 0);
      }

      if (!lastReportDate || lastReportDate.getTime() < today.getTime()) {
        // New day
        if (!lastReportDate || lastReportDate.getTime() === today.getTime() - 86400000) {
          // Consecutive day
          user.stats.streak += 1;
        } else {
          // Streak broken
          user.stats.streak = 1;
        }

        user.stats.lastReportDate = today;
        
        // Update longest streak
        if (user.stats.streak > user.stats.longestStreak) {
          user.stats.longestStreak = user.stats.streak;
        }

        // Award streak bonus
        if (user.stats.streak > 1) {
          const streakBonus = user.stats.streak * POINTS.STREAK_BONUS;
          user.stats.totalPoints += streakBonus;
          user.stats.experience += streakBonus;
        }

        await user.save();
        return { streak: user.stats.streak, longestStreak: user.stats.longestStreak };
      }

      return { streak: user.stats.streak, longestStreak: user.stats.longestStreak };
    } catch (error) {
      console.error('Error updating streak:', error);
      throw error;
    }
  }

  // Check and award achievements
  static async checkAchievements(user, trigger = null) {
    const newAchievements = [];

    // Check report count achievements
    if (trigger === 'report' || !trigger) {
      if (user.stats.totalReports === 1) {
        newAchievements.push(ACHIEVEMENTS.FIRST_REPORT);
      }
      if (user.stats.totalReports === 10) {
        newAchievements.push(ACHIEVEMENTS.REPORTS_10);
      }
      if (user.stats.totalReports === 50) {
        newAchievements.push(ACHIEVEMENTS.REPORTS_50);
      }
      if (user.stats.totalReports === 100) {
        newAchievements.push(ACHIEVEMENTS.REPORTS_100);
      }
    }

    // Check streak achievements
    if (trigger === 'streak' || !trigger) {
      if (user.stats.streak === 3) {
        newAchievements.push(ACHIEVEMENTS.STREAK_3);
      }
      if (user.stats.streak === 7) {
        newAchievements.push(ACHIEVEMENTS.STREAK_7);
      }
      if (user.stats.streak === 30) {
        newAchievements.push(ACHIEVEMENTS.STREAK_30);
      }
    }

    // Check level achievements
    if (trigger === 'level' || !trigger) {
      if (user.stats.level === 5) {
        newAchievements.push(ACHIEVEMENTS.LEVEL_5);
      }
      if (user.stats.level === 10) {
        newAchievements.push(ACHIEVEMENTS.LEVEL_10);
      }
      if (user.stats.level === 25) {
        newAchievements.push(ACHIEVEMENTS.LEVEL_25);
      }
    }

    // Check social achievements
    if (trigger === 'social' || !trigger) {
      if (user.community.followers.length >= 10) {
        newAchievements.push(ACHIEVEMENTS.SOCIAL_BUTTERFLY);
      }
    }

    // Award new achievements
    for (const achievement of newAchievements) {
      const alreadyUnlocked = user.stats.achievements.some(a => a.id === achievement.id);
      if (!alreadyUnlocked) {
        user.stats.achievements.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          points: achievement.points,
          unlockedAt: new Date()
        });

        // Award achievement points
        user.stats.totalPoints += achievement.points;
        user.stats.experience += achievement.points;
      }
    }

    if (newAchievements.length > 0) {
      await user.save();
    }

    return newAchievements;
  }

  // Get leaderboard
  static async getLeaderboard(type = 'points', limit = 10) {
    try {
      let sortField;
      switch (type) {
        case 'points':
          sortField = 'stats.totalPoints';
          break;
        case 'reports':
          sortField = 'stats.totalReports';
          break;
        case 'streak':
          sortField = 'stats.longestStreak';
          break;
        case 'level':
          sortField = 'stats.level';
          break;
        default:
          sortField = 'stats.totalPoints';
      }

      const leaderboard = await User.find({})
        .select('username email stats.avatar stats.totalPoints stats.totalReports stats.longestStreak stats.level')
        .sort({ [sortField]: -1 })
        .limit(limit);

      return leaderboard.map((user, index) => ({
        rank: index + 1,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.stats.avatar
        },
        stats: user.stats
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  // Get user progress
  static async getUserProgress(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const progress = {
        level: user.stats.level,
        experience: user.stats.experience,
        experienceToNext: user.stats.experienceToNextLevel,
        progressPercentage: Math.min(100, (user.stats.experience / user.stats.experienceToNextLevel) * 100),
        totalPoints: user.stats.totalPoints,
        totalReports: user.stats.totalReports,
        resolvedReports: user.stats.resolvedReports,
        streak: user.stats.streak,
        longestStreak: user.stats.longestStreak,
        achievements: user.stats.achievements.length,
        totalAchievements: Object.keys(ACHIEVEMENTS).length
      };

      return progress;
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  // Get all achievements
  static getAllAchievements() {
    return Object.values(ACHIEVEMENTS);
  }
}

module.exports = GamificationService; 
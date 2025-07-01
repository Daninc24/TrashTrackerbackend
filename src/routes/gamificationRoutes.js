const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get user progress and stats
router.get('/progress', auth, gamificationController.getUserProgress);

// Get leaderboard
router.get('/leaderboard', gamificationController.getLeaderboard);

// Get all achievements
router.get('/achievements', gamificationController.getAllAchievements);

// Get user achievements
router.get('/achievements/user', auth, gamificationController.getUserAchievements);

// Get user stats
router.get('/stats', auth, gamificationController.getUserStats);

// Get global stats
router.get('/stats/global', gamificationController.getGlobalStats);

// Award points (admin only)
router.post('/award-points', [auth, admin], gamificationController.awardPoints);

module.exports = router; 
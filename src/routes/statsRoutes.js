const express = require('express');
const { 
  getStats, 
  getAdvancedAnalytics, 
  getUserAnalytics, 
  exportAnalytics 
} = require('../controllers/statsController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', getStats);
router.get('/advanced', auth, getAdvancedAnalytics);
router.get('/user', auth, getUserAnalytics);
router.get('/export', auth, exportAnalytics);

module.exports = router; 
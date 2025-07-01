const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const { 
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
} = require('../controllers/reportController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const reportValidation = [
  body('category').notEmpty().withMessage('Category is required'),
  body('location').custom((value) => {
    console.log('Validating location:', value, typeof value);
    if (!value) throw new Error('Location is required');
    
    let locationObj;
    try {
      // Handle both string and object formats
      locationObj = typeof value === 'string' ? JSON.parse(value) : value;
      console.log('Parsed location object:', locationObj);
    } catch (parseError) {
      console.log('Location parse error:', parseError.message);
      throw new Error('Invalid location format - must be valid JSON');
    }
    
    // Validate GeoJSON Point structure
    if (typeof locationObj !== 'object' || locationObj === null) {
      throw new Error('Location must be an object');
    }
    
    if (locationObj.type !== 'Point') {
      throw new Error('Location type must be "Point"');
    }
    
    if (!Array.isArray(locationObj.coordinates) || locationObj.coordinates.length !== 2) {
      throw new Error('Location must have coordinates array with exactly 2 values [lng, lat]');
    }
    
    // Validate coordinates are numbers
    if (typeof locationObj.coordinates[0] !== 'number' || typeof locationObj.coordinates[1] !== 'number') {
      throw new Error('Location coordinates must be numbers');
    }
    
    // Validate coordinate ranges
    if (locationObj.coordinates[0] < -180 || locationObj.coordinates[0] > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
    
    if (locationObj.coordinates[1] < -90 || locationObj.coordinates[1] > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    
    return true;
  }),
  body('description').notEmpty().withMessage('Description is required').isString().withMessage('Description must be a string'),
];

// Test endpoint to debug form data
router.post('/test', auth, upload.single('image'), (req, res) => {
  console.log('Test endpoint - received data:', {
    body: req.body,
    file: req.file ? { name: req.file.originalname, size: req.file.size } : null,
    headers: req.headers['content-type']
  });
  res.json({ received: req.body, file: req.file ? true : false });
});

// Enhanced report validation
const enhancedReportValidation = [
  ...reportValidation,
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level'),
  body('severity').optional().isIn(['minor', 'moderate', 'major', 'critical']).withMessage('Invalid severity level'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('estimatedCleanupTime').optional().isNumeric().withMessage('Estimated cleanup time must be a number'),
];

// Routes
router.post('/', auth, upload.single('image'), enhancedReportValidation, createReport);
router.get('/', getReports);
router.get('/search', searchReports);
router.get('/analytics', getReportAnalytics);
router.get('/my', auth, getMyReports);
router.get('/:id', getReportById);
router.put('/:id/status', auth, admin, updateReportStatus);
router.post('/:id/comments', auth, body('text').notEmpty().withMessage('Comment text is required'), addComment);
router.put('/:id/like', auth, toggleLike);
router.put('/:id/share', auth, shareReport);
router.put('/:id/view', incrementViews);
router.put('/:id/assign', auth, admin, body('assignedTo').notEmpty().withMessage('User ID is required'), assignReport);

module.exports = router; 
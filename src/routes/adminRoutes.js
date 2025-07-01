const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { validateToken, requireRole } = require('../middleware/security');

// All admin routes require authentication and admin role
router.use(validateToken);
router.use(requireRole(['admin']));

router.get('/overview', adminController.getOverview);
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUserProfile);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/bulk', adminController.bulkUserAction);
router.get('/users/:id/export', adminController.exportUserData);

module.exports = router; 
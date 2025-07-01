const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { requireRole, validateToken } = require('../middleware/security');

// All routes require authentication and admin role
router.use(validateToken);
router.use(requireRole(['admin']));

// Audit logs
router.get('/audit-logs', securityController.getAuditLogs);
router.get('/security-events', securityController.getSecurityEvents);
router.get('/security-dashboard', securityController.getSecurityDashboard);

// GDPR compliance
router.get('/gdpr-report/:userId', securityController.getGDPRReport);
router.delete('/gdpr-delete/:userId', securityController.deleteUserData);
router.get('/gdpr-export/:userId', securityController.exportUserData);

module.exports = router; 
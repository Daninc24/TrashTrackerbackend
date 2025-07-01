const express = require('express');
const { register, login, getAllUsers, updateUserRole, deleteUser, getUserStats, toggleUserStatus, bulkDeleteUsers, bulkUpdateUserRoles, bulkUpdateUserStatus, exportUsers } = require('../controllers/authController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', auth, admin, getAllUsers);
router.get('/users/:id/stats', auth, admin, getUserStats);
router.put('/users/:id/role', auth, admin, updateUserRole);
router.put('/users/:id/toggle-status', auth, admin, toggleUserStatus);
router.delete('/users/:id', auth, admin, deleteUser);

// Bulk actions
router.delete('/users/bulk', auth, admin, bulkDeleteUsers);
router.put('/users/bulk/role', auth, admin, bulkUpdateUserRoles);
router.put('/users/bulk/status', auth, admin, bulkUpdateUserStatus);

// Export
router.get('/users/export', auth, admin, exportUsers);

module.exports = router; 
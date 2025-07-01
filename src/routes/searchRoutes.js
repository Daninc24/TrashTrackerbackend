const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { validateToken, requireRole } = require('../middleware/security');
const { cache } = require('../middleware/cache');

// Public search endpoints (with rate limiting)
router.get('/reports', cache(300), searchController.searchReports);
router.get('/users', cache(300), searchController.searchUsers);
router.get('/suggestions', cache(60), searchController.getSuggestions);
router.get('/popular', cache(3600), searchController.getPopularSearches);
router.get('/filters', cache(3600), searchController.getSearchFilters);

// Authenticated search endpoints
router.use(validateToken);

router.post('/preferences', searchController.saveSearchPreferences);
router.get('/saved', searchController.getSavedSearches);
router.post('/saved', searchController.saveSearch);
router.delete('/saved/:id', searchController.deleteSavedSearch);

// Admin only endpoints
router.post('/reindex', requireRole(['admin']), searchController.reindexAll);

module.exports = router; 
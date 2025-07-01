const searchService = require('../services/searchService');
const { cache } = require('../middleware/cache');

// Advanced search for reports
const searchReports = async (req, res) => {
  try {
    const { 
      q: query, 
      page = 1, 
      limit = 20,
      category,
      status,
      priority,
      severity,
      tags,
      createdBy,
      dateFrom,
      dateTo,
      latitude,
      longitude,
      radius,
      sortBy,
      sortOrder
    } = req.query;

    const filters = {
      category,
      status,
      priority,
      severity,
      tags: tags ? tags.split(',') : undefined,
      createdBy,
      dateFrom,
      dateTo,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      radius: radius ? parseFloat(radius) : undefined,
      sortBy,
      sortOrder
    };

    const results = await searchService.searchReports(query, filters, parseInt(page), parseInt(limit));
    
    // Save search history
    await searchService.saveSearchHistory(req.user?.id, query, filters, results.hits);

    res.json(results);
  } catch (error) {
    console.error('Search reports error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

// Advanced search for users
const searchUsers = async (req, res) => {
  try {
    const { 
      q: query, 
      page = 1, 
      limit = 20,
      role,
      minLevel,
      minExperience
    } = req.query;

    const filters = {
      role,
      minLevel: minLevel ? parseInt(minLevel) : undefined,
      minExperience: minExperience ? parseInt(minExperience) : undefined
    };

    const results = await searchService.searchUsers(query, filters, parseInt(page), parseInt(limit));
    
    res.json(results);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'User search failed' });
  }
};

// Get search suggestions
const getSuggestions = async (req, res) => {
  try {
    const { q: query, type = 'reports' } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await searchService.getSuggestions(query, type);
    res.json({ suggestions });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};

// Get popular searches
const getPopularSearches = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const searches = await searchService.getPopularSearches(parseInt(days));
    res.json({ searches });
  } catch (error) {
    console.error('Get popular searches error:', error);
    res.status(500).json({ error: 'Failed to get popular searches' });
  }
};

// Get search filters and options
const getSearchFilters = async (req, res) => {
  try {
    const { type = 'reports' } = req.query;
    
    let filters = {};
    
    if (type === 'reports') {
      filters = {
        categories: ['Trash', 'Recycling', 'Pollution', 'Litter', 'Hazardous Waste', 'Other'],
        statuses: ['pending', 'in progress', 'resolved'],
        priorities: ['low', 'medium', 'high', 'critical'],
        severities: ['minor', 'moderate', 'major', 'severe'],
        tags: ['environment', 'community', 'health', 'safety', 'cleanup', 'maintenance'],
        sortOptions: [
          { value: 'date', label: 'Date' },
          { value: 'priority', label: 'Priority' },
          { value: 'likes', label: 'Most Liked' },
          { value: 'views', label: 'Most Viewed' }
        ]
      };
    } else if (type === 'users') {
      filters = {
        roles: ['user', 'admin', 'moderator'],
        levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        sortOptions: [
          { value: 'level', label: 'Level' },
          { value: 'experience', label: 'Experience' },
          { value: 'name', label: 'Name' }
        ]
      };
    }
    
    res.json({ filters });
  } catch (error) {
    console.error('Get search filters error:', error);
    res.status(500).json({ error: 'Failed to get search filters' });
  }
};

// Save search preferences
const saveSearchPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    
    // This would typically save to user preferences in database
    console.log('Search preferences saved:', { userId: req.user?.id, preferences });
    
    res.json({ message: 'Search preferences saved successfully' });
  } catch (error) {
    console.error('Save search preferences error:', error);
    res.status(500).json({ error: 'Failed to save search preferences' });
  }
};

// Get saved searches
const getSavedSearches = async (req, res) => {
  try {
    // This would typically fetch from database
    const savedSearches = [
      {
        id: '1',
        name: 'My Area Reports',
        query: '',
        filters: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'High Priority Issues',
        query: '',
        filters: { priority: 'high' },
        createdAt: new Date().toISOString()
      }
    ];
    
    res.json({ savedSearches });
  } catch (error) {
    console.error('Get saved searches error:', error);
    res.status(500).json({ error: 'Failed to get saved searches' });
  }
};

// Save a search
const saveSearch = async (req, res) => {
  try {
    const { name, query, filters } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Search name is required' });
    }
    
    // This would typically save to database
    const savedSearch = {
      id: Date.now().toString(),
      name,
      query,
      filters,
      userId: req.user?.id,
      createdAt: new Date().toISOString()
    };
    
    console.log('Search saved:', savedSearch);
    
    res.json({ savedSearch });
  } catch (error) {
    console.error('Save search error:', error);
    res.status(500).json({ error: 'Failed to save search' });
  }
};

// Delete saved search
const deleteSavedSearch = async (req, res) => {
  try {
    const { id } = req.params;
    
    // This would typically delete from database
    console.log('Search deleted:', { id, userId: req.user?.id });
    
    res.json({ message: 'Search deleted successfully' });
  } catch (error) {
    console.error('Delete saved search error:', error);
    res.status(500).json({ error: 'Failed to delete saved search' });
  }
};

// Reindex all data (admin only)
const reindexAll = async (req, res) => {
  try {
    await searchService.reindexAll();
    res.json({ message: 'Reindex completed successfully' });
  } catch (error) {
    console.error('Reindex error:', error);
    res.status(500).json({ error: 'Reindex failed' });
  }
};

module.exports = {
  searchReports,
  searchUsers,
  getSuggestions,
  getPopularSearches,
  getSearchFilters,
  saveSearchPreferences,
  getSavedSearches,
  saveSearch,
  deleteSavedSearch,
  reindexAll
}; 
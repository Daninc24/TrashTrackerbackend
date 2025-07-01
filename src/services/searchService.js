const { Client } = require('@elastic/elasticsearch');
const Report = require('../models/Report');
const User = require('../models/User');

// Initialize Elasticsearch client
const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  }
});

// Index configuration
const INDEX_CONFIG = {
  reports: {
    name: 'reports',
    mapping: {
      properties: {
        id: { type: 'keyword' },
        category: { type: 'keyword' },
        description: { 
          type: 'text',
          analyzer: 'english',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        status: { type: 'keyword' },
        priority: { type: 'keyword' },
        severity: { type: 'keyword' },
        tags: { type: 'keyword' },
        address: { type: 'text' },
        location: {
          type: 'geo_point'
        },
        createdBy: { type: 'keyword' },
        createdByEmail: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        likes: { type: 'integer' },
        shares: { type: 'integer' },
        views: { type: 'integer' },
        comments: { type: 'integer' }
      }
    }
  },
  users: {
    name: 'users',
    mapping: {
      properties: {
        id: { type: 'keyword' },
        email: { type: 'keyword' },
        name: { 
          type: 'text',
          analyzer: 'english'
        },
        role: { type: 'keyword' },
        level: { type: 'integer' },
        experience: { type: 'integer' },
        createdAt: { type: 'date' },
        lastLogin: { type: 'date' }
      }
    }
  }
};

// Initialize indices
const initializeIndices = async () => {
  try {
    for (const [key, config] of Object.entries(INDEX_CONFIG)) {
      const indexExists = await client.indices.exists({ index: config.name });
      
      if (!indexExists) {
        await client.indices.create({
          index: config.name,
          body: {
            mappings: config.mapping
          }
        });
        console.log(`Created index: ${config.name}`);
      }
    }
  } catch (error) {
    console.error('Error initializing Elasticsearch indices:', error);
  }
};

// Index a document
const indexDocument = async (indexName, document) => {
  try {
    await client.index({
      index: indexName,
      id: document.id || document._id,
      body: document
    });
  } catch (error) {
    console.error(`Error indexing document in ${indexName}:`, error);
  }
};

// Search reports with advanced filtering
const searchReports = async (query, filters = {}, page = 1, limit = 20) => {
  try {
    const must = [];
    const filter = [];
    
    // Full-text search
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['description^2', 'category', 'address', 'tags'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }
    
    // Filters
    if (filters.category) {
      filter.push({ term: { category: filters.category } });
    }
    
    if (filters.status) {
      filter.push({ term: { status: filters.status } });
    }
    
    if (filters.priority) {
      filter.push({ term: { priority: filters.priority } });
    }
    
    if (filters.severity) {
      filter.push({ term: { severity: filters.severity } });
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filter.push({ terms: { tags: filters.tags } });
    }
    
    if (filters.createdBy) {
      filter.push({ term: { createdBy: filters.createdBy } });
    }
    
    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const dateFilter = {};
      if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.lte = filters.dateTo;
      filter.push({ range: { createdAt: dateFilter } });
    }
    
    // Location filter (within radius)
    if (filters.latitude && filters.longitude && filters.radius) {
      filter.push({
        geo_distance: {
          distance: `${filters.radius}km`,
          location: {
            lat: filters.latitude,
            lon: filters.longitude
          }
        }
      });
    }
    
    // Sort options
    let sort = [];
    switch (filters.sortBy) {
      case 'date':
        sort.push({ createdAt: { order: filters.sortOrder || 'desc' } });
        break;
      case 'priority':
        sort.push({ priority: { order: filters.sortOrder || 'desc' } });
        break;
      case 'likes':
        sort.push({ likes: { order: filters.sortOrder || 'desc' } });
        break;
      case 'views':
        sort.push({ views: { order: filters.sortOrder || 'desc' } });
        break;
      default:
        sort.push({ createdAt: { order: 'desc' } });
    }
    
    const searchBody = {
      query: {
        bool: {
          must,
          filter
        }
      },
      sort,
      from: (page - 1) * limit,
      size: limit,
      highlight: {
        fields: {
          description: {},
          address: {}
        }
      },
      aggs: {
        categories: {
          terms: { field: 'category' }
        },
        statuses: {
          terms: { field: 'status' }
        },
        priorities: {
          terms: { field: 'priority' }
        },
        severities: {
          terms: { field: 'severity' }
        },
        tags: {
          terms: { field: 'tags' }
        }
      }
    };
    
    const response = await client.search({
      index: INDEX_CONFIG.reports.name,
      body: searchBody
    });
    
    return {
      hits: response.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score,
        highlights: hit.highlight
      })),
      total: response.hits.total.value,
      aggregations: response.aggregations,
      page,
      limit,
      pages: Math.ceil(response.hits.total.value / limit)
    };
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('Search failed');
  }
};

// Search users
const searchUsers = async (query, filters = {}, page = 1, limit = 20) => {
  try {
    const must = [];
    const filter = [];
    
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['name^2', 'email'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }
    
    if (filters.role) {
      filter.push({ term: { role: filters.role } });
    }
    
    if (filters.minLevel) {
      filter.push({ range: { level: { gte: filters.minLevel } } });
    }
    
    if (filters.minExperience) {
      filter.push({ range: { experience: { gte: filters.minExperience } } });
    }
    
    const searchBody = {
      query: {
        bool: {
          must,
          filter
        }
      },
      sort: [{ level: { order: 'desc' } }],
      from: (page - 1) * limit,
      size: limit
    };
    
    const response = await client.search({
      index: INDEX_CONFIG.users.name,
      body: searchBody
    });
    
    return {
      hits: response.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score
      })),
      total: response.hits.total.value,
      page,
      limit,
      pages: Math.ceil(response.hits.total.value / limit)
    };
  } catch (error) {
    console.error('User search error:', error);
    throw new Error('User search failed');
  }
};

// Get search suggestions
const getSuggestions = async (query, type = 'reports') => {
  try {
    const response = await client.search({
      index: INDEX_CONFIG[type].name,
      body: {
        suggest: {
          suggestions: {
            prefix: query,
            completion: {
              field: 'suggest',
              size: 5,
              skip_duplicates: true
            }
          }
        }
      }
    });
    
    return response.suggest.suggestions[0].options.map(option => option.text);
  } catch (error) {
    console.error('Suggestion error:', error);
    return [];
  }
};

// Save search history
const saveSearchHistory = async (userId, query, filters, results) => {
  try {
    // This would typically be saved to a database
    console.log('Search history saved:', { userId, query, filters, resultsCount: results.length });
  } catch (error) {
    console.error('Error saving search history:', error);
  }
};

// Get popular searches
const getPopularSearches = async (days = 7) => {
  try {
    // This would typically query a search history collection
    return [
      'trash',
      'recycling',
      'pollution',
      'litter',
      'environment'
    ];
  } catch (error) {
    console.error('Error getting popular searches:', error);
    return [];
  }
};

// Reindex all data
const reindexAll = async () => {
  try {
    console.log('Starting full reindex...');
    
    // Reindex reports
    const reports = await Report.find({}).lean();
    for (const report of reports) {
      await indexDocument(INDEX_CONFIG.reports.name, {
        id: report._id.toString(),
        ...report,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString()
      });
    }
    
    // Reindex users
    const users = await User.find({}).lean();
    for (const user of users) {
      await indexDocument(INDEX_CONFIG.users.name, {
        id: user._id.toString(),
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLogin: user.lastLogin?.toISOString()
      });
    }
    
    console.log('Full reindex completed');
  } catch (error) {
    console.error('Reindex error:', error);
    throw error;
  }
};

module.exports = {
  initializeIndices,
  indexDocument,
  searchReports,
  searchUsers,
  getSuggestions,
  saveSearchHistory,
  getPopularSearches,
  reindexAll
}; 
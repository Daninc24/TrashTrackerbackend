const Redis = require('ioredis');
const winston = require('winston');

// Configure Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  showFriendlyErrorStack: process.env.NODE_ENV === 'development'
});

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rashtrackr-cache' },
  transports: [
    new winston.transports.File({ filename: 'logs/cache-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/cache-combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Cache middleware
const cache = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        return res.json(data);
      }
    } catch (error) {
      logger.error('Cache read error:', error);
    }

    // Store original send method
    const originalSend = res.json;
    
    // Override send method to cache response
    res.json = function(data) {
      try {
        redis.setex(key, duration, JSON.stringify(data));
      } catch (error) {
        logger.error('Cache write error:', error);
      }
      
      // Call original send method
      return originalSend.call(this, data);
    };

    next();
  };
};

// Cache invalidation middleware
const invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    const originalSend = res.json;
    
    res.json = async function(data) {
      try {
        const keys = await redis.keys('cache:*');
        const patternsToInvalidate = patterns.length > 0 ? patterns : ['cache:*'];
        
        for (const pattern of patternsToInvalidate) {
          const matchingKeys = keys.filter(key => key.includes(pattern.replace('cache:', '')));
          if (matchingKeys.length > 0) {
            await redis.del(...matchingKeys);
            logger.info(`Invalidated ${matchingKeys.length} cache keys for pattern: ${pattern}`);
          }
        }
      } catch (error) {
        logger.error('Cache invalidation error:', error);
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};

// Cache statistics
const getCacheStats = async () => {
  try {
    const info = await redis.info();
    const keys = await redis.keys('cache:*');
    
    return {
      totalKeys: keys.length,
      memoryUsage: info.match(/used_memory_human:(.+)/)?.[1] || 'Unknown',
      connectedClients: info.match(/connected_clients:(.+)/)?.[1] || 'Unknown',
      uptime: info.match(/uptime_in_seconds:(.+)/)?.[1] || 'Unknown'
    };
  } catch (error) {
    logger.error('Cache stats error:', error);
    return { error: 'Failed to get cache stats' };
  }
};

// Clear all cache
const clearCache = async () => {
  try {
    const keys = await redis.keys('cache:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cleared ${keys.length} cache keys`);
      return { message: `Cleared ${keys.length} cache keys` };
    }
    return { message: 'No cache keys to clear' };
  } catch (error) {
    logger.error('Clear cache error:', error);
    return { error: 'Failed to clear cache' };
  }
};

// Health check
const healthCheck = async () => {
  try {
    await redis.ping();
    return { status: 'healthy', service: 'redis' };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return { status: 'unhealthy', service: 'redis', error: error.message };
  }
};

module.exports = {
  redis,
  cache,
  invalidateCache,
  getCacheStats,
  clearCache,
  healthCheck,
  logger
}; 
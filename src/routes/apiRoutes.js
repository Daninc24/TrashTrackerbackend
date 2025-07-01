const express = require('express');
const router = express.Router();
const { validateToken, requireRole } = require('../middleware/security');
const { cache, invalidateCache } = require('../middleware/cache');

// API Documentation
const apiDocs = {
  version: '1.0.0',
  name: 'RashTrackr API',
  description: 'Comprehensive API for environmental reporting and community management',
  baseUrl: '/api/v1',
  endpoints: {
    reports: {
      GET: '/reports - Get all reports with filtering',
      POST: '/reports - Create a new report',
      GET: '/reports/:id - Get specific report',
      PUT: '/reports/:id - Update report',
      DELETE: '/reports/:id - Delete report'
    },
    users: {
      GET: '/users - Get all users',
      POST: '/users - Create user',
      GET: '/users/:id - Get user profile',
      PUT: '/users/:id - Update user',
      DELETE: '/users/:id - Delete user'
    },
    auth: {
      POST: '/auth/login - User login',
      POST: '/auth/register - User registration',
      POST: '/auth/logout - User logout',
      POST: '/auth/refresh - Refresh token'
    },
    stats: {
      GET: '/stats - Get system statistics',
      GET: '/stats/reports - Get report statistics',
      GET: '/stats/users - Get user statistics'
    },
    notifications: {
      GET: '/notifications - Get user notifications',
      POST: '/notifications - Create notification',
      PUT: '/notifications/:id - Mark as read'
    },
    gamification: {
      GET: '/gamification/leaderboard - Get leaderboard',
      GET: '/gamification/achievements - Get achievements',
      POST: '/gamification/points - Award points'
    },
    community: {
      GET: '/community/teams - Get teams',
      POST: '/community/teams - Create team',
      GET: '/community/challenges - Get challenges'
    }
  },
  authentication: {
    type: 'Bearer Token',
    header: 'Authorization: Bearer <token>'
  },
  rateLimiting: {
    auth: '5 requests per 15 minutes',
    api: '100 requests per 15 minutes',
    reports: '10 requests per hour'
  }
};

// API Documentation endpoint
router.get('/docs', (req, res) => {
  res.json(apiDocs);
});

// API Health Check
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: apiDocs.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});

// API Status endpoint
router.get('/status', cache(60), (req, res) => {
  const status = {
    api: 'operational',
    database: 'operational',
    cache: 'operational',
    notifications: 'operational',
    lastUpdated: new Date().toISOString()
  };
  
  res.json(status);
});

// Webhook management
const webhooks = new Map();

// Register webhook
router.post('/webhooks/register', validateToken, (req, res) => {
  const { url, events, secret } = req.body;
  
  if (!url || !events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid webhook configuration' });
  }
  
  const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  webhooks.set(webhookId, {
    id: webhookId,
    url,
    events,
    secret,
    userId: req.user.id,
    createdAt: new Date(),
    isActive: true
  });
  
  res.json({ 
    webhookId, 
    message: 'Webhook registered successfully' 
  });
});

// List webhooks
router.get('/webhooks', validateToken, (req, res) => {
  const userWebhooks = Array.from(webhooks.values())
    .filter(webhook => webhook.userId === req.user.id)
    .map(webhook => ({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt
    }));
  
  res.json({ webhooks: userWebhooks });
});

// Delete webhook
router.delete('/webhooks/:id', validateToken, (req, res) => {
  const { id } = req.params;
  const webhook = webhooks.get(id);
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  if (webhook.userId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  webhooks.delete(id);
  res.json({ message: 'Webhook deleted successfully' });
});

// Webhook delivery function
const deliverWebhook = async (event, data) => {
  const relevantWebhooks = Array.from(webhooks.values())
    .filter(webhook => webhook.isActive && webhook.events.includes(event));
  
  for (const webhook of relevantWebhooks) {
    try {
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data
      };
      
      // Add signature if secret is provided
      if (webhook.secret) {
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');
        
        payload.signature = signature;
      }
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RashTrackr-Webhook/1.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Webhook delivery failed for ${webhook.url}: ${response.status}`);
      }
    } catch (error) {
      console.error(`Webhook delivery error for ${webhook.url}:`, error);
    }
  }
};

// Export webhook delivery function
module.exports = {
  router,
  deliverWebhook
}; 
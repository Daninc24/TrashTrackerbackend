const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  level: {
    type: String,
    enum: ['info', 'warning', 'error', 'security'],
    default: 'info'
  },
  action: {
    type: String,
    required: true
  },
  resource: {
    type: String,
    required: true
  },
  resourceId: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userEmail: {
    type: String
  },
  userRole: {
    type: String
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  method: {
    type: String
  },
  url: {
    type: String
  },
  statusCode: {
    type: Number
  },
  duration: {
    type: Number // in milliseconds
  },
  requestBody: {
    type: mongoose.Schema.Types.Mixed
  },
  responseBody: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    message: String,
    stack: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  gdprCompliant: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ level: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

// TTL index to automatically delete old logs (keep for 1 year)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static method to create audit log entry
auditLogSchema.statics.log = function(data) {
  const logEntry = new this({
    level: data.level || 'info',
    action: data.action,
    resource: data.resource,
    resourceId: data.resourceId,
    userId: data.userId,
    userEmail: data.userEmail,
    userRole: data.userRole,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    method: data.method,
    url: data.url,
    statusCode: data.statusCode,
    duration: data.duration,
    requestBody: data.requestBody,
    responseBody: data.responseBody,
    error: data.error,
    metadata: data.metadata,
    gdprCompliant: data.gdprCompliant !== false
  });

  return logEntry.save();
};

// Static method to get audit logs with filtering
auditLogSchema.statics.getLogs = function(filters = {}, page = 1, limit = 50) {
  const query = {};
  
  if (filters.userId) query.userId = filters.userId;
  if (filters.action) query.action = filters.action;
  if (filters.resource) query.resource = filters.resource;
  if (filters.level) query.level = filters.level;
  if (filters.startDate) query.timestamp = { $gte: new Date(filters.startDate) };
  if (filters.endDate) {
    if (query.timestamp) {
      query.timestamp.$lte = new Date(filters.endDate);
    } else {
      query.timestamp = { $lte: new Date(filters.endDate) };
    }
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('userId', 'email role')
    .lean();
};

// Static method to get security events
auditLogSchema.statics.getSecurityEvents = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    level: 'security',
    timestamp: { $gte: startDate }
  })
  .sort({ timestamp: -1 })
  .populate('userId', 'email role')
  .lean();
};

// Static method to get GDPR compliance report
auditLogSchema.statics.getGDPRReport = function(userId, startDate, endDate) {
  const query = { userId };
  
  if (startDate) query.timestamp = { $gte: new Date(startDate) };
  if (endDate) {
    if (query.timestamp) {
      query.timestamp.$lte = new Date(endDate);
    } else {
      query.timestamp = { $lte: new Date(endDate) };
    }
  }

  return this.find(query)
    .select('timestamp action resource resourceId gdprCompliant')
    .sort({ timestamp: -1 })
    .lean();
};

// Static method to delete user data for GDPR compliance
auditLogSchema.statics.deleteUserData = function(userId) {
  return this.updateMany(
    { userId },
    { 
      $set: {
        userId: null,
        userEmail: '[DELETED]',
        userRole: '[DELETED]',
        requestBody: null,
        responseBody: null,
        gdprCompliant: true
      }
    }
  );
};

module.exports = mongoose.model('AuditLog', auditLogSchema); 
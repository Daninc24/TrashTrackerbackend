const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  category: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  description: { type: String },
  imageUrl: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'resolved', 'rejected', 'duplicate'],
    default: 'pending' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium' 
  },
  severity: { 
    type: String, 
    enum: ['minor', 'moderate', 'major', 'critical'],
    default: 'moderate' 
  },
  tags: [{ type: String }],
  address: { type: String },
  estimatedCleanupTime: { type: Number }, // in minutes
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  updates: [{
    status: { type: String, required: true },
    message: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shares: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true
});

reportSchema.index({ location: '2dsphere' });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ category: 1, status: 1 });
reportSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for full status display
reportSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': 'Pending Review',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'rejected': 'Rejected',
    'duplicate': 'Duplicate'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for priority color
reportSchema.virtual('priorityColor').get(function() {
  const colorMap = {
    'low': 'text-gray-500',
    'medium': 'text-blue-500',
    'high': 'text-orange-500',
    'urgent': 'text-red-500'
  };
  return colorMap[this.priority] || 'text-blue-500';
});

// Virtual for severity color
reportSchema.virtual('severityColor').get(function() {
  const colorMap = {
    'minor': 'text-green-500',
    'moderate': 'text-yellow-500',
    'major': 'text-orange-500',
    'critical': 'text-red-500'
  };
  return colorMap[this.severity] || 'text-yellow-500';
});

module.exports = mongoose.model('Report', reportSchema); 
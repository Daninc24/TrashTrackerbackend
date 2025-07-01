const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  tagline: { type: String },
  avatar: { type: String }, // URL or base64
  banner: { type: String }, // URL or base64
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['leader', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  stats: {
    totalReports: { type: Number, default: 0 },
    resolvedReports: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    experienceToNextLevel: { type: Number, default: 1000 }
  },
  achievements: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now }
  }],
  challenges: [{
    challengeId: { type: String, required: true },
    progress: { type: Number, default: 0 },
    target: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    joinedAt: { type: Date, default: Date.now }
  }],
  settings: {
    isPublic: { type: Boolean, default: true },
    allowJoinRequests: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: true },
    maxMembers: { type: Number, default: 50 }
  },
  joinRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

// Virtual for member count
teamSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for progress percentage
teamSchema.virtual('progressPercentage').get(function() {
  if (this.stats.experienceToNextLevel === 0) return 100;
  return Math.min(100, (this.stats.experience / this.stats.experienceToNextLevel) * 100);
});

module.exports = mongoose.model('Team', teamSchema); 
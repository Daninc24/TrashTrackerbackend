const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly', 'special', 'team'], 
    required: true 
  },
  category: { type: String, required: true }, // 'reports', 'cleanup', 'engagement', etc.
  target: { type: Number, required: true },
  metric: { type: String, required: true }, // 'reports', 'points', 'streak', etc.
  reward: {
    points: { type: Number, default: 0 },
    experience: { type: Number, default: 0 },
    badge: { type: String },
    title: { type: String }
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true },
  maxParticipants: { type: Number },
  currentParticipants: { type: Number, default: 0 },
  leaderboard: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    progress: { type: Number, default: 0 },
    rank: { type: Number },
    completedAt: { type: Date }
  }],
  requirements: {
    minLevel: { type: Number, default: 1 },
    requiredBadges: [{ type: String }],
    location: {
      type: { type: String, enum: ['any', 'city', 'neighborhood', 'coordinates'] },
      value: mongoose.Schema.Types.Mixed // city name, neighborhood, or coordinates
    }
  },
  tags: [{ type: String }],
  image: { type: String }, // Challenge banner/icon
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teamOnly: { type: Boolean, default: false },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }
}, { timestamps: true });

// Virtual for challenge status
challengeSchema.virtual('status').get(function() {
  const now = new Date();
  if (now < this.startDate) return 'upcoming';
  if (now > this.endDate) return 'ended';
  return 'active';
});

// Virtual for time remaining
challengeSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  if (now > this.endDate) return 0;
  return this.endDate - now;
});

// Virtual for progress percentage
challengeSchema.virtual('progressPercentage').get(function() {
  if (this.maxParticipants && this.currentParticipants) {
    return Math.min(100, (this.currentParticipants / this.maxParticipants) * 100);
  }
  return 0;
});

module.exports = mongoose.model('Challenge', challengeSchema); 
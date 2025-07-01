const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  active: { type: Boolean, default: true }, // true = active, false = banned
  lastLoginAt: { type: Date },
  
  // Profile Information
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    bio: { type: String, maxLength: 500 },
    avatar: { type: String }, // base64 or URL
    location: { type: String },
    phone: { type: String },
    website: { type: String },
    dateOfBirth: { type: Date },
    joinDate: { type: Date, default: Date.now }
  },
  
  // Notification Preferences
  notifications: {
    email: {
      enabled: { type: Boolean, default: true },
      reportUpdates: { type: Boolean, default: true },
      communityUpdates: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true }
    },
    push: {
      enabled: { type: Boolean, default: true },
      reportUpdates: { type: Boolean, default: true },
      communityUpdates: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true }
    },
    inApp: {
      enabled: { type: Boolean, default: true },
      reportUpdates: { type: Boolean, default: true },
      communityUpdates: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true }
    }
  },
  
  // Privacy Settings
  privacy: {
    profileVisibility: { type: String, enum: ['public', 'private', 'friends'], default: 'public' },
    showEmail: { type: Boolean, default: false },
    showLocation: { type: Boolean, default: true },
    showJoinDate: { type: Boolean, default: true },
    allowMessages: { type: Boolean, default: true },
    dataSharing: { type: Boolean, default: true }
  },
  
  // Statistics & Gamification
  stats: {
    totalReports: { type: Number, default: 0 },
    resolvedReports: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    experienceToNextLevel: { type: Number, default: 100 },
    streak: { type: Number, default: 0 }, // Daily reporting streak
    longestStreak: { type: Number, default: 0 },
    lastReportDate: { type: Date },
    badges: [{ type: String }],
    achievements: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      description: { type: String, required: true },
      icon: { type: String, required: true },
      unlockedAt: { type: Date, default: Date.now },
      points: { type: Number, default: 0 }
    }],
    lastActive: { type: Date, default: Date.now }
  },
  
  // Account Settings
  settings: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
    emailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false }
  },
  
  // Community Features
  community: {
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
      createdAt: { type: Date, default: Date.now }
    }],
    challenges: [{
      challengeId: { type: String, required: true },
      progress: { type: Number, default: 0 },
      target: { type: Number, required: true },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date },
      joinedAt: { type: Date, default: Date.now }
    }],
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }
  }
}, { timestamps: true });

// Virtual for full name
userSchema.virtual('profile.fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.profile.displayName || this.email;
});

// Virtual for avatar URL or default
userSchema.virtual('profile.avatarUrl').get(function() {
  if (this.profile.avatar) {
    return this.profile.avatar;
  }
  // Generate default avatar based on email
  const hash = this.email.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.profile.fullName)}&background=random&color=fff&size=128&bold=true`;
});

// Update stats when reports are created/updated
userSchema.methods.updateStats = async function() {
  const Report = require('./Report');
  const totalReports = await Report.countDocuments({ createdBy: this._id });
  const resolvedReports = await Report.countDocuments({ createdBy: this._id, status: 'resolved' });
  
  this.stats.totalReports = totalReports;
  this.stats.resolvedReports = resolvedReports;
  this.stats.lastActive = new Date();
  
  // Calculate level based on reports (simple progression)
  this.stats.level = Math.floor(totalReports / 10) + 1;
  
  // Calculate points (10 points per report, 50 bonus for resolved)
  this.stats.totalPoints = (totalReports * 10) + (resolvedReports * 50);
  
  await this.save();
};

module.exports = mongoose.model('User', userSchema); 
const User = require('../models/User');
const Team = require('../models/Team');
const Challenge = require('../models/Challenge');
const GamificationService = require('../services/gamificationService');

// Team Management
exports.createTeam = async (req, res) => {
  try {
    const { name, description, tagline, isPublic, allowJoinRequests, requireApproval, maxMembers } = req.body;

    // Check if team name already exists
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(400).json({ error: 'Team name already exists' });
    }

    const team = new Team({
      name,
      description,
      tagline,
      leader: req.user.id,
      members: [{ user: req.user.id, role: 'leader' }],
      settings: {
        isPublic: isPublic !== false,
        allowJoinRequests: allowJoinRequests !== false,
        requireApproval: requireApproval !== false,
        maxMembers: maxMembers || 50
      }
    });

    await team.save();

    // Update user's team reference
    await User.findByIdAndUpdate(req.user.id, { 'community.team': team._id });

    // Award team join achievement
    await GamificationService.checkAchievements(req.user, 'team');

    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

exports.getTeams = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { 'settings.isPublic': true };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const teams = await Team.find(query)
      .populate('leader', 'username email stats.avatar')
      .populate('members.user', 'username email stats.avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Team.countDocuments(query);

    res.json({
      teams,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting teams:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
};

exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('leader', 'username email stats.avatar')
      .populate('members.user', 'username email stats.avatar stats.level stats.totalPoints')
      .populate('joinRequests.user', 'username email stats.avatar');

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Error getting team:', error);
    res.status(500).json({ error: 'Failed to get team' });
  }
};

exports.joinTeam = async (req, res) => {
  try {
    const { message } = req.body;
    const teamId = req.params.id;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user is already a member
    const isMember = team.members.some(member => member.user.toString() === req.user.id);
    if (isMember) {
      return res.status(400).json({ error: 'Already a member of this team' });
    }

    // Check if team is full
    if (team.members.length >= team.settings.maxMembers) {
      return res.status(400).json({ error: 'Team is full' });
    }

    if (team.settings.requireApproval) {
      // Add join request
      team.joinRequests.push({
        user: req.user.id,
        message,
        status: 'pending'
      });
    } else {
      // Direct join
      team.members.push({ user: req.user.id, role: 'member' });
      team.stats.currentParticipants = team.members.length;
    }

    await team.save();

    // Update user's team reference if direct join
    if (!team.settings.requireApproval) {
      await User.findByIdAndUpdate(req.user.id, { 'community.team': teamId });
    }

    res.json({ message: team.settings.requireApproval ? 'Join request sent' : 'Successfully joined team' });
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
};

// Challenge Management
exports.createChallenge = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      category,
      target,
      metric,
      reward,
      startDate,
      endDate,
      maxParticipants,
      requirements,
      tags,
      teamOnly,
      teamId
    } = req.body;

    const challenge = new Challenge({
      title,
      description,
      type,
      category,
      target,
      metric,
      reward,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxParticipants,
      requirements,
      tags,
      creator: req.user.id,
      teamOnly,
      teamId
    });

    await challenge.save();
    res.status(201).json(challenge);
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
};

exports.getChallenges = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isPublic: true };
    if (type) query.type = type;
    if (status) {
      const now = new Date();
      if (status === 'active') {
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
      } else if (status === 'upcoming') {
        query.startDate = { $gt: now };
      } else if (status === 'ended') {
        query.endDate = { $lt: now };
      }
    }

    const challenges = await Challenge.find(query)
      .populate('creator', 'username email stats.avatar')
      .populate('teamId', 'name')
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Challenge.countDocuments(query);

    res.json({
      challenges,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting challenges:', error);
    res.status(500).json({ error: 'Failed to get challenges' });
  }
};

exports.joinChallenge = async (req, res) => {
  try {
    const challengeId = req.params.id;
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Check if challenge is active
    const now = new Date();
    if (now < challenge.startDate || now > challenge.endDate) {
      return res.status(400).json({ error: 'Challenge is not active' });
    }

    // Check if user meets requirements
    const user = await User.findById(req.user.id);
    if (user.stats.level < challenge.requirements.minLevel) {
      return res.status(400).json({ error: 'Level requirement not met' });
    }

    // Check if already participating
    const isParticipating = challenge.leaderboard.some(entry => entry.user.toString() === req.user.id);
    if (isParticipating) {
      return res.status(400).json({ error: 'Already participating in this challenge' });
    }

    // Add to leaderboard
    challenge.leaderboard.push({
      user: req.user.id,
      progress: 0,
      rank: challenge.leaderboard.length + 1
    });

    challenge.currentParticipants += 1;
    await challenge.save();

    // Add to user's challenges
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        'community.challenges': {
          challengeId: challenge._id.toString(),
          progress: 0,
          target: challenge.target,
          completed: false
        }
      }
    });

    res.json({ message: 'Successfully joined challenge' });
  } catch (error) {
    console.error('Error joining challenge:', error);
    res.status(500).json({ error: 'Failed to join challenge' });
  }
};

// Social Features
exports.followUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = await User.findById(req.user.id);

    // Check if already following
    if (currentUser.community.following.includes(targetUserId)) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Add to following
    currentUser.community.following.push(targetUserId);
    targetUser.community.followers.push(req.user.id);

    await Promise.all([currentUser.save(), targetUser.save()]);

    // Check for social achievements
    await GamificationService.checkAchievements(currentUser, 'social');

    res.json({ message: 'Successfully followed user' });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove from following
    currentUser.community.following = currentUser.community.following.filter(
      id => id.toString() !== targetUserId
    );
    targetUser.community.followers = targetUser.community.followers.filter(
      id => id.toString() !== req.user.id
    );

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    const currentUser = await User.findById(req.user.id);
    if (currentUser.community.friends.includes(targetUserId)) {
      return res.status(400).json({ error: 'Already friends with this user' });
    }

    // Check if request already exists
    const existingRequest = targetUser.community.friendRequests.find(
      req => req.from.toString() === req.user.id && req.status === 'pending'
    );
    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Send friend request
    targetUser.community.friendRequests.push({
      from: req.user.id,
      status: 'pending'
    });

    await targetUser.save();
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
};

exports.respondToFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    const currentUser = await User.findById(req.user.id);
    const request = currentUser.community.friendRequests.id(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (action === 'accept') {
      // Add to friends list for both users
      currentUser.community.friends.push(request.from);
      const sender = await User.findById(request.from);
      sender.community.friends.push(req.user.id);
      await sender.save();
    }

    // Remove the request
    currentUser.community.friendRequests.pull(requestId);
    await currentUser.save();

    res.json({ message: `Friend request ${action}ed` });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: 'Failed to respond to friend request' });
  }
};

// Get user's social connections
exports.getSocialConnections = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const user = await User.findById(req.user.id)
      .populate('community.followers', 'username email stats.avatar stats.level')
      .populate('community.following', 'username email stats.avatar stats.level')
      .populate('community.friends', 'username email stats.avatar stats.level')
      .populate('community.friendRequests.from', 'username email stats.avatar');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.community) user.community = {};
    if (!user.community.followers) user.community.followers = [];
    if (!user.community.following) user.community.following = [];
    if (!user.community.friends) user.community.friends = [];
    if (!user.community.friendRequests) user.community.friendRequests = [];
    res.json({
      followers: user.community.followers,
      following: user.community.following,
      friends: user.community.friends,
      friendRequests: user.community.friendRequests
    });
  } catch (error) {
    console.error('Error getting social connections:', error);
    res.status(500).json({ error: error.message || 'Failed to get social connections' });
  }
}; 
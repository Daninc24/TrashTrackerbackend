const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const auth = require('../middleware/auth');

// Team routes
router.post('/teams', auth, communityController.createTeam);
router.get('/teams', communityController.getTeams);
router.get('/teams/:id', communityController.getTeam);
router.post('/teams/:id/join', auth, communityController.joinTeam);

// Challenge routes
router.post('/challenges', auth, communityController.createChallenge);
router.get('/challenges', communityController.getChallenges);
router.post('/challenges/:id/join', auth, communityController.joinChallenge);

// Social features
router.post('/users/:id/follow', auth, communityController.followUser);
router.delete('/users/:id/follow', auth, communityController.unfollowUser);
router.post('/users/:id/friend-request', auth, communityController.sendFriendRequest);
router.put('/friend-requests/:requestId', auth, communityController.respondToFriendRequest);
router.get('/social-connections', auth, communityController.getSocialConnections);

module.exports = router; 
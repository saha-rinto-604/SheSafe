const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const controller = require('./chat.controller');

const router = express.Router();

router.use(authenticate);

// GET /api/chat/active — list ACTIVE incidents (for volunteers/police)
router.get('/active', controller.getActiveIncidents);

// GET /api/chat/:incidentId/messages — load chat history
router.get('/:incidentId/messages', controller.getMessages);

// POST /api/chat/:incidentId/messages — REST send (WebSocket fallback)
router.post('/:incidentId/messages', controller.sendMessage);

// POST /api/chat/:incidentId/join — join an incident chat room
router.post('/:incidentId/join', controller.joinIncident);

module.exports = router;

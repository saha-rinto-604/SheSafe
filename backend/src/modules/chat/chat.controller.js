const chatService = require('./chat.service');

async function getMessages(req, res, next) {
  try {
    const messages = await chatService.fetchMessages(req.params.incidentId, req.user.id, req.user.role);
    res.status(200).json({ messages });
  } catch (error) {
    next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const message = await chatService.sendMessage(req.user.id, req.params.incidentId, req.body, req.user.role);
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
}

async function joinIncident(req, res, next) {
  try {
    const participants = await chatService.join(req.user.id, req.params.incidentId);
    res.status(200).json({ participants });
  } catch (error) {
    next(error);
  }
}

async function getActiveIncidents(req, res, next) {
  try {
    const incidents = await chatService.listActiveIncidents();
    res.status(200).json({ incidents });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/chat/assisted — list incidents the volunteer has assisted with.
 * Returns the exact same data shape as /api/chat/active for frontend parity.
 */
async function getAssistedChats(req, res, next) {
  try {
    const incidents = await chatService.listAssistedIncidents(req.user.id);
    res.status(200).json({ incidents });
  } catch (error) {
    next(error);
  }
}

module.exports = { getMessages, sendMessage, joinIncident, getActiveIncidents, getAssistedChats };

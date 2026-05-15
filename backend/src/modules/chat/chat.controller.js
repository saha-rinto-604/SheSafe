const chatService = require('./chat.service');

async function getMessages(req, res, next) {
  try {
    const messages = await chatService.fetchMessages(req.params.incidentId);
    res.status(200).json({ messages });
  } catch (error) {
    next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const message = await chatService.sendMessage(req.user.id, req.params.incidentId, req.body);
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

module.exports = { getMessages, sendMessage, joinIncident, getActiveIncidents };

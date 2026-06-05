const chatService = require('./chat.service');
const chatWsServer = require('../../websocket/chatWsServer');
const incidentService = require('../incidents/incident.service');
const notificationService = require('../notifications/notification.service');
const userService = require('../users/user.service');

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
    const recipients = await incidentService.getNotificationRecipients(req.params.incidentId, { excludeUserId: req.user.id });
    const messageType = String(message?.type || req.body?.type || 'TEXT').toUpperCase();
    const notBlockedRecipients = messageType === 'SYSTEM'
      ? recipients
      : (await Promise.all(recipients.map(async (recipient) => {
          const blocked = await userService.isUserBlockedBy(recipient.userId, req.user.id);
          return blocked ? null : recipient;
        }))).filter(Boolean);
    await Promise.all(notBlockedRecipients.map((recipient) => notificationService.createAndDispatchNotification({
      userId: recipient.userId,
      type: 'CHAT_MESSAGE',
      title: 'New chat message',
      body: 'You have a new incident chat message.',
      incidentId: req.params.incidentId,
      data: { context: 'incident_chat', role: recipient.role || '' },
      pushTitle: 'New chat message',
      pushBody: 'Open SheSafe to view the incident chat.',
      emit: (event) => chatWsServer.sendToUser(recipient.userId, event),
    })));
    chatWsServer.notifyMessageNew?.(req.params.incidentId, message);
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

async function archiveForMe(req, res, next) {
  try {
    const result = await chatService.archiveForMe(req.user.id, req.params.incidentId, { deleted: false });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function deleteForMe(req, res, next) {
  try {
    const result = await chatService.archiveForMe(req.user.id, req.params.incidentId, { deleted: true });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function leave(req, res, next) {
  try {
    const result = await chatService.leave(req.user.id, req.params.incidentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMessages,
  sendMessage,
  joinIncident,
  getActiveIncidents,
  getAssistedChats,
  archiveForMe,
  deleteForMe,
  leave,
};

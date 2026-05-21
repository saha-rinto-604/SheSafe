const incidentService = require('./incident.service');
const chatWsServer = require('../../websocket/chatWsServer');

async function report(req, res, next) {
  try {
    const incident = await incidentService.reportIncident(req.user.id, req.body);
    const fullIncident = await incidentService.getOne(incident.id);
    const dispatchList = await incidentService.getDispatchList(incident.id);
    chatWsServer.notifyNewSOS(fullIncident, dispatchList);
    res.status(201).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function getZones(req, res, next) {
  try {
    const zones = await incidentService.getZones();
    res.status(200).json({ zones });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const incident = await incidentService.getOne(req.params.id);
    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const incident = await incidentService.cancelIncident(req.user.id, req.params.id);
    chatWsServer.notifyClosed(req.params.id);
    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function resolve(req, res, next) {
  try {
    const incident = await incidentService.resolveIncident(req.user.id, req.params.id);
    chatWsServer.notifyClosed(req.params.id);
    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/my — Get all incidents created by the authenticated user.
 * Returns incidents with exact location, date/time, and status.
 */
async function getMyIncidents(req, res, next) {
  try {
    const incidents = await incidentService.getMyIncidents(req.user.id);
    res.status(200).json({ incidents });
  } catch (error) {
    next(error);
  }
}

async function clearMyHistory(req, res, next) {
  try {
    const result = await incidentService.clearMyHistory(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// ── Volunteer Dispatch Handlers ──────────────────────────────────────────────

/**
 * GET /api/incidents/nearby — Get ACTIVE incidents within 5km of the volunteer.
 */
async function nearby(req, res, next) {
  try {
    const incidents = await incidentService.getNearbyIncidents(req.user.id, {
      latitude: req.query.latitude,
      longitude: req.query.longitude,
    });
    res.status(200).json({ incidents });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/incidents/:id/accept — Volunteer accepts an incident (atomic).
 * Returns the incident details and provisioned chat room.
 */
async function accept(req, res, next) {
  try {
    const result = await incidentService.acceptIncident(req.user.id, req.params.id);
    chatWsServer.notifyAccepted(result.chatRoom.incidentId, result.chatRoom.victimUserId, {
      id: req.user.id,
      name: req.user.phoneNumber || 'Volunteer',
      photoUrl: null,
    });
    chatWsServer.notifyRespondersUpdated?.(result.chatRoom.incidentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/incidents/:id/reject — Volunteer declines an incident.
 * No state change — incident stays ACTIVE for other volunteers.
 */
async function reject(req, res, next) {
  try {
    const result = await incidentService.rejectIncident(req.user.id, req.params.id);
    chatWsServer.notifyRejected(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/assisted — Get incidents the volunteer has assisted with.
 * Returns the same data shape as /api/chat/active for frontend parity.
 */
async function assisted(req, res, next) {
  try {
    const incidents = await incidentService.getAssistedIncidents(req.user.id, req.query.search);
    res.status(200).json({ incidents });
  } catch (error) {
    next(error);
  }
}

async function volunteerNotifications(req, res, next) {
  try {
    const notifications = await incidentService.getVolunteerNotifications(req.user.id, {
      latitude: req.query.latitude,
      longitude: req.query.longitude,
    });
    res.status(200).json({ notifications });
  } catch (error) {
    next(error);
  }
}

async function responders(req, res, next) {
  try {
    const result = await incidentService.getResponders(req.params.id, req.user.id, req.user.role);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function messages(req, res, next) {
  try {
    const messages = await incidentService.getIncidentMessages(req.user.id, req.params.id, req.user.role);
    res.status(200).json({ messages });
  } catch (error) {
    next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const message = await incidentService.sendIncidentMessage(req.user.id, req.params.id, {
      content: req.body.text ?? req.body.content,
      type: req.body.type,
      mediaUrl: req.body.mediaUrl,
    }, req.user.role);
    chatWsServer.notifyMessageNew?.(req.params.id, message);
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
}

async function getVolunteerCaseDetails(req, res, next) {
  try {
    const result = await incidentService.getVolunteerCaseDetails(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getUserCaseDetails(req, res, next) {
  try {
    const result = await incidentService.getUserCaseDetails(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function updateUserCaseDetails(req, res, next) {
  try {
    const result = await incidentService.updateUserCaseDetails(req.user.id, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function userChats(req, res, next) {
  try {
    const incidents = await incidentService.getUserIncidentChats(req.user.id, req.query.search, req.user.role);
    res.status(200).json({ incidents });
  } catch (error) {
    next(error);
  }
}

async function updateVolunteerCaseDetails(req, res, next) {
  try {
    const result = await incidentService.updateVolunteerCaseDetails(req.user.id, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/incidents/online-status — Toggle volunteer online/offline status.
 */
async function onlineStatus(req, res, next) {
  try {
    const isOnline = req.body.isOnline === true;
    const result = await incidentService.updateOnlineStatus(req.user.id, isOnline);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  report,
  getZones,
  getOne,
  cancel,
  resolve,
  getMyIncidents,
  clearMyHistory,
  nearby,
  accept,
  reject,
  assisted,
  volunteerNotifications,
  responders,
  messages,
  sendMessage,
  userChats,
  getUserCaseDetails,
  updateUserCaseDetails,
  getVolunteerCaseDetails,
  updateVolunteerCaseDetails,
  onlineStatus,
};

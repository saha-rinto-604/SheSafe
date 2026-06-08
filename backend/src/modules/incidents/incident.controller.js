const incidentService = require('./incident.service');
const chatWsServer = require('../../websocket/chatWsServer');
const lawService = require('../law-enforcement/law.service');
const notificationService = require('../notifications/notification.service');
const userService = require('../users/user.service');

async function notifyNewSosTargets(incident, dispatchList) {
  const basePayload = {
    type: 'sos.new',
    payload: {
      incidentId: String(incident.id),
      victimName: `${incident.first_name || ''} ${incident.last_name || ''}`.trim(),
      avatarUri: incident.photo_url || null,
      latitude: Number(incident.latitude),
      longitude: Number(incident.longitude),
      address: incident.address || null,
      distanceKm: null,
      createdAt: incident.created_at instanceof Date
        ? incident.created_at.toISOString()
        : String(incident.created_at),
    },
  };

  await Promise.all((dispatchList || []).map((volunteer) => {
    const payload = {
      ...basePayload,
      payload: {
        ...basePayload.payload,
        distanceKm: volunteer.distanceKm,
      },
    };
    return notificationService.createAndDispatchNotification({
      userId: volunteer.userId,
      type: 'NEW_SOS_REQUEST',
      title: 'New SOS request nearby',
      body: 'A user needs help. Open SheSafe to respond.',
      incidentId: incident.id,
      data: { context: 'volunteer_dispatch', role: 'volunteer' },
      pushTitle: 'New SOS request nearby',
      pushBody: 'A user needs help. Open SheSafe to respond.',
      emit: (event) => {
        chatWsServer.sendToUser(volunteer.userId, event);
        chatWsServer.sendToUser(volunteer.userId, payload);
      },
    });
  }));
}

async function notifyIncidentMembers(incidentId, { type, title, body, pushTitle, pushBody, excludeUserId = null, senderUserId = null, respectBlocks = false }) {
  const recipients = await incidentService.getNotificationRecipients(incidentId, { excludeUserId });
  const visibleRecipients = respectBlocks && senderUserId
    ? (await Promise.all(recipients.map(async (recipient) => {
        const blocked = await userService.isUserBlockedBy(recipient.userId, senderUserId);
        return blocked ? null : recipient;
      }))).filter(Boolean)
    : recipients;
  await Promise.all(visibleRecipients.map((recipient) => notificationService.createAndDispatchNotification({
    userId: recipient.userId,
    type,
    title,
    body,
    incidentId,
    data: { context: 'incident_update', role: recipient.role || '' },
    pushTitle,
    pushBody,
    emit: (event) => chatWsServer.sendToUser(recipient.userId, event),
  })));
}

async function report(req, res, next) {
  try {
    const incident = await incidentService.reportIncident(req.user.id, req.body);
    const fullIncident = await incidentService.getOne(incident.id);
    const dispatchList = await incidentService.getDispatchList(incident.id);
    await notifyNewSosTargets(fullIncident, dispatchList);
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
    await lawService.closeRequestsForIncident(req.params.id, 'CANCELLED', 'Incident cancelled.').catch(() => undefined);
    await notifyIncidentMembers(req.params.id, {
      type: 'INCIDENT_CANCELLED',
      title: 'Incident cancelled',
      body: 'This incident has been cancelled.',
      pushTitle: 'Incident cancelled',
      pushBody: 'Open SheSafe for the latest update.',
    });
    await chatWsServer.notifyClosed(req.params.id, 'CANCELLED', 'This incident has been cancelled.');
    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function resolve(req, res, next) {
  try {
    const incident = await incidentService.resolveIncident(req.user.id, req.params.id);
    await lawService.closeRequestsForIncident(req.params.id, 'RESOLVED').catch(() => undefined);
    await notifyIncidentMembers(req.params.id, {
      type: 'INCIDENT_RESOLVED',
      title: 'Incident resolved',
      body: 'This incident has been marked resolved.',
      pushTitle: 'Incident resolved',
      pushBody: 'Open SheSafe for the latest update.',
    });
    await chatWsServer.notifyClosed(req.params.id, 'RESOLVED', 'This incident has been resolved.');
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
    const profile = await userService.getProfile(req.user.id).catch(() => null);
    const username = String(profile?.username || '').trim().toLowerCase();
    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
    const volunteer = {
      id: req.user.id,
      name: username ? `@${username}` : fullName || 'A responder',
      photoUrl: profile?.photoUrl || profile?.photoUri || null,
    };
    await notificationService.createAndDispatchNotification({
      userId: result.chatRoom.victimUserId,
      type: 'VOLUNTEER_ACCEPTED',
      title: 'Volunteer accepted your SOS',
      body: 'A responder accepted your emergency request.',
      incidentId: result.chatRoom.incidentId,
      data: { context: 'incident_update', role: 'standard_user' },
      pushTitle: 'Volunteer accepted your SOS',
      pushBody: 'Open SheSafe for responder details.',
      emit: (event) => {
        chatWsServer.sendToUser(result.chatRoom.victimUserId, event);
        chatWsServer.sendToUser(result.chatRoom.victimUserId, {
          type: 'sos.accepted',
          payload: {
            incidentId: String(result.chatRoom.incidentId),
            volunteer,
          },
        });
      },
    });
    chatWsServer.notifyRespondersUpdated?.(result.chatRoom.incidentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getMyActiveSos(req, res, next) {
  try {
    const incident = await incidentService.getMyActiveSos(req.user.id);
    res.status(200).json({ incident });
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

async function routeContext(req, res, next) {
  try {
    const result = await incidentService.getRouteContext(req.params.id, req.user.id, req.user.role);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function mapSnapshot(req, res, next) {
  try {
    const result = await incidentService.getMapSnapshot(req.params.id, req.user.id, req.user.role);
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
    await notifyIncidentMembers(req.params.id, {
      type: 'CHAT_MESSAGE',
      title: 'New chat message',
      body: 'You have a new incident chat message.',
      pushTitle: 'New chat message',
      pushBody: 'Open SheSafe to view the incident chat.',
      excludeUserId: req.user.id,
      senderUserId: req.user.id,
      respectBlocks: String(message?.type || req.body?.type || 'TEXT').toUpperCase() !== 'SYSTEM',
    });
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

async function createReview(req, res, next) {
  try {
    const result = await incidentService.submitIncidentReview(req.user.id, req.params.id, req.body);
    res.status(result.alreadyReviewed ? 200 : 201).json(result);
  } catch (error) {
    next(error);
  }
}

async function volunteerActivity(req, res, next) {
  try {
    const activities = await incidentService.getVolunteerActivity(req.user.id);
    res.status(200).json({ activities });
  } catch (error) {
    next(error);
  }
}

async function volunteerLeaderboard(req, res, next) {
  try {
    const result = await incidentService.getVolunteerLeaderboard(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/incidents/online-status — Toggle volunteer online/offline status.
 */
async function volunteerCertificateData(req, res, next) {
  try {
    const result = await incidentService.getVolunteerCertificateData(req.user.id, req.user.role);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

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
  getMyActiveSos,
  clearMyHistory,
  nearby,
  accept,
  reject,
  assisted,
  volunteerNotifications,
  responders,
  routeContext,
  mapSnapshot,
  messages,
  sendMessage,
  userChats,
  getUserCaseDetails,
  updateUserCaseDetails,
  getVolunteerCaseDetails,
  updateVolunteerCaseDetails,
  createReview,
  volunteerActivity,
  volunteerLeaderboard,
  volunteerCertificateData,
  onlineStatus,
};

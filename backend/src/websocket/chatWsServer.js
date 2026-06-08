const { WebSocketServer } = require('ws');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const chatService = require('../modules/chat/chat.service');
const locationService = require('../modules/locations/location.service');
const notificationService = require('../modules/notifications/notification.service');
const { query } = require('../config/db');
const { jwt: jwtConfig } = env;

// ── Room Management ─────────────────────────────────────────────────────────
// rooms: Map<incidentId(string), Set<{ ws, userId, userInfo }>>
const rooms = new Map();

// dispatchClients: Set<{ ws, userId, userInfo }> — all online volunteers
const dispatchClients = new Set();
let hasAccountStatusColumn;

async function usersHaveAccountStatus() {
  if (hasAccountStatusColumn !== undefined) return hasAccountStatusColumn;
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'account_status'`
  );
  hasAccountStatusColumn = Number(rows[0]?.count || 0) > 0;
  return hasAccountStatusColumn;
}

async function isBlockedUser(userId) {
  if (!(await usersHaveAccountStatus())) return false;
  const rows = await query(
    `SELECT account_status
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  return String(rows[0]?.account_status || '').toUpperCase() === 'BLOCKED';
}

async function isFinalIncident(incidentId) {
  const rows = await query(
    `SELECT status
     FROM incidents
     WHERE id = ?
     LIMIT 1`,
    [incidentId]
  );
  const status = String(rows[0]?.status || '').toUpperCase();
  return status === 'RESOLVED' || status === 'CANCELLED';
}

function getRoomId(pathname) {
  // /ws/chat/:incidentId/
  const match = pathname.match(/^\/ws\/chat\/(\d+)\/?$/);
  return match ? match[1] : null;
}

function isDispatchPath(pathname) {
  return /^\/ws\/dispatch\/?$/.test(pathname);
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  if (!value) return '';
  return String(value).split(',')[0].trim();
}

function getRequestBaseUrl(req) {
  if (env.baseUrl) return env.baseUrl;
  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']);
  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host']);
  const protocol = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
  const host = forwardedHost || req.headers.host || 'resqher.local';
  return `${protocol}://${host}`;
}

function broadcast(incidentId, event, exceptWs = null) {
  const room = rooms.get(incidentId);
  if (!room) return;
  const data = JSON.stringify(event);
  for (const client of room) {
    if (client.ws !== exceptWs && client.ws.readyState === 1 /* OPEN */) {
      client.ws.send(data);
    }
  }
}

function broadcastAll(incidentId, event) {
  broadcast(incidentId, event, null);
}

/**
 * Broadcast an event to all connected dispatch clients (online volunteers).
 */
function broadcastDispatch(event, exceptWs = null) {
  const data = JSON.stringify(event);
  for (const client of dispatchClients) {
    if (client.ws !== exceptWs && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

/**
 * Send an event to a specific user across all their connections.
 */
function sendToUser(userId, event) {
  const data = JSON.stringify(event);
  const targetId = String(userId);

  // Check dispatch clients
  for (const client of dispatchClients) {
    if (String(client.userId) === targetId && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }

  // Check all chat rooms
  for (const [, room] of rooms) {
    for (const client of room) {
      if (String(client.userId) === targetId && client.ws.readyState === 1) {
        client.ws.send(data);
      }
    }
  }
}

// ── Exported broadcast helpers for use by HTTP controllers ──────────────────

/**
 * Notify all nearby volunteers about a new SOS incident.
 * Called from incident.service after reportIncident() + dispatch list generation.
 */
function notifyNewSOS(incident, dispatchList) {
  const event = {
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

  for (const volunteer of dispatchList || []) {
    sendToUser(volunteer.userId, {
      ...event,
      payload: {
        ...event.payload,
        distanceKm: volunteer.distanceKm,
      },
    });
  }
}

/**
 * Notify victim and clear banners for other volunteers when an incident is accepted.
 */
function notifyAccepted(incidentId, victimUserId, volunteer) {
  sendToUser(victimUserId, {
    type: 'sos.accepted',
    payload: {
      incidentId: String(incidentId),
      volunteer: {
        id: String(volunteer.id),
        name: volunteer.name,
        photoUrl: volunteer.photoUrl || null,
      },
    },
  });
  notifyRespondersUpdated(incidentId);
}

/**
 * Notify a specific volunteer that their rejection has been acknowledged.
 */
function notifyRejected(volunteerId, incidentId) {
  sendToUser(volunteerId, {
    type: 'sos.rejected',
    payload: { incidentId: String(incidentId) },
  });
}

async function getPoliceRecipientsForStatusEvent({ incidentId, requestId }) {
  try {
    const params = [];
    const filters = [];
    if (requestId) {
      filters.push('ler.id = ?');
      params.push(requestId);
    }
    if (incidentId) {
      filters.push('ler.incident_id = ?');
      params.push(incidentId);
    }
    if (!filters.length) return [];

    const rows = await query(
      `SELECT ler.id AS request_id, ler.incident_id, ler.assigned_police_id AS police_id
       FROM law_enforcement_requests ler
       WHERE (${filters.join(' OR ')})
         AND ler.assigned_police_id IS NOT NULL
       UNION
       SELECT ler.id AS request_id, ler.incident_id, lerc.police_id
       FROM law_enforcement_requests ler
       JOIN law_enforcement_request_candidates lerc ON lerc.request_id = ler.id
       WHERE (${filters.join(' OR ')})
         AND lerc.police_id IS NOT NULL`,
      [...params, ...params]
    );

    const seen = new Set();
    return rows
      .filter((row) => row.police_id)
      .filter((row) => {
        const key = String(row.police_id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch (err) {
    console.error('[WS] Failed to load police status recipients:', err.message);
    return [];
  }
}

async function notifyPoliceIncidentStatus({ incidentId, requestId = null, status, message }) {
  const normalizedStatus = String(status || '').toUpperCase();
  const recipients = await getPoliceRecipientsForStatusEvent({ incidentId, requestId });
  const createdAt = new Date().toISOString();
  const notificationType = normalizedStatus === 'RESOLVED'
    ? 'INCIDENT_RESOLVED'
    : normalizedStatus === 'CANCELLED'
      ? 'INCIDENT_CANCELLED'
      : 'INCIDENT_STATUS_UPDATED';
  const title = normalizedStatus === 'RESOLVED'
    ? 'Incident Resolved'
    : normalizedStatus === 'CANCELLED'
      ? 'Incident Cancelled'
      : 'Incident Status Updated';
  const payloadBase = {
    notificationId: `police-status:${incidentId}:${requestId || 'incident'}:${normalizedStatus}:${createdAt}`,
    type: notificationType,
    incidentId: String(incidentId),
    requestId: requestId ? String(requestId) : null,
    status: normalizedStatus,
    title,
    message: message || (
      normalizedStatus === 'RESOLVED'
        ? 'This incident has been resolved.'
        : normalizedStatus === 'CANCELLED'
          ? 'This incident has been cancelled.'
          : 'This incident status changed.'
    ),
    createdAt,
  };

  broadcastAll(String(incidentId), {
    type: 'incident:status_updated',
    payload: payloadBase,
  });

  if (normalizedStatus === 'RESOLVED' || normalizedStatus === 'CANCELLED') {
    broadcastDispatch({
      type: 'law_enforcement.request_updated',
      payload: {
        ...payloadBase,
        type: 'LAW_ENFORCEMENT_REQUEST_UPDATED',
      },
    });
  }

  await Promise.all(recipients.map((recipient) => notificationService.createAndDispatchNotification({
    userId: recipient.police_id,
    type: notificationType,
    title,
    body: payloadBase.message,
    incidentId,
    data: { context: 'police_incident_update', role: 'law_enforcement', requestId: payloadBase.requestId || String(recipient.request_id) },
    pushTitle: title,
    pushBody: 'Open SheSafe for the latest assignment update.',
    emit: () => sendToUser(recipient.police_id, {
      type: 'incident_status_updated',
      payload: {
        ...payloadBase,
        assignedPoliceId: String(recipient.police_id),
        requestId: payloadBase.requestId || String(recipient.request_id),
      },
    }),
  })));
}

async function notifyPoliceAssignment({ incidentId, requestId, message }) {
  const recipients = await getPoliceRecipientsForStatusEvent({ incidentId, requestId });
  const createdAt = new Date().toISOString();
  const payloadBase = {
    notificationId: `police-assignment:${incidentId}:${requestId || 'request'}:${createdAt}`,
    type: 'POLICE_ASSIGNMENT',
    incidentId: String(incidentId),
    requestId: requestId ? String(requestId) : null,
    title: 'New Police Assignment',
    message: message || 'A law enforcement request has been assigned.',
    createdAt,
  };

  await Promise.all(recipients.map((recipient) => notificationService.createAndDispatchNotification({
    userId: recipient.police_id,
    type: 'POLICE_ASSIGNMENT',
    title: payloadBase.title,
    body: payloadBase.message,
    incidentId,
    data: { context: 'police_assignment', role: 'law_enforcement', requestId: payloadBase.requestId || String(recipient.request_id) },
    pushTitle: payloadBase.title,
    pushBody: 'Open SheSafe to view the assignment.',
    emit: () => sendToUser(recipient.police_id, {
      type: 'law_enforcement.assigned',
      payload: {
        ...payloadBase,
        assignedPoliceId: String(recipient.police_id),
        requestId: payloadBase.requestId || String(recipient.request_id),
      },
    }),
  })));
}

function notifyLawEnforcementRequestCreated(request) {
  const createdAt = new Date().toISOString();
  broadcastDispatch({
    type: 'law_enforcement.requested',
    payload: {
      notificationId: `law-request:${request?.incidentId || 'incident'}:${request?.id || 'request'}:${createdAt}`,
      type: 'LAW_ENFORCEMENT_REQUESTED',
      incidentId: request?.incidentId ? String(request.incidentId) : null,
      requestId: request?.id ? String(request.id) : null,
      status: request?.status || 'PENDING_ADMIN_REVIEW',
      title: 'New Law Enforcement Request',
      message: 'A law enforcement request needs admin review.',
      createdAt,
    },
  });
}

function notifyLawEnforcementRequestUpdated(request, action = 'updated') {
  const createdAt = new Date().toISOString();
  broadcastDispatch({
    type: 'law_enforcement.request_updated',
    payload: {
      notificationId: `law-request-${action}:${request?.incidentId || 'incident'}:${request?.id || 'request'}:${createdAt}`,
      type: 'LAW_ENFORCEMENT_REQUEST_UPDATED',
      incidentId: request?.incidentId ? String(request.incidentId) : null,
      requestId: request?.id ? String(request.id) : null,
      status: request?.status || null,
      title: 'Law Enforcement Request Updated',
      message: 'A law enforcement request was updated.',
      createdAt,
    },
  });
}

async function notifyClosed(incidentId, status = 'CLOSED', message) {
  broadcastDispatch({
    type: 'sos.claimed',
    payload: { incidentId: String(incidentId) },
  });
  await notifyPoliceIncidentStatus({
    incidentId,
    status,
    message,
  });
}

function notifyRespondersUpdated(incidentId) {
  broadcastAll(String(incidentId), {
    type: 'incident:responders_updated',
    payload: { incidentId: String(incidentId) },
  });
}

function notifyMessageNew(incidentId, message) {
  broadcastAll(String(incidentId), {
    type: 'message:new',
    payload: message,
  });
}

function normalizeSocketRole(role) {
  const value = String(role || '').toLowerCase();
  if (value === 'volunteer') return 'VOLUNTEER';
  if (value === 'law_enforcement') return 'POLICE';
  return 'USER';
}

function notificationIdentity(user = {}) {
  const username = String(user.username || '').trim().toLowerCase();
  if (/^[a-z0-9_]{3,30}$/.test(username)) return `@${username}`;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  const role = String(user.role_name || user.role || '').toLowerCase();
  if (role === 'volunteer') return 'A responder';
  if (role === 'law_enforcement') return 'An officer';
  if (role === 'standard_user') return 'A SheSafe user';
  return 'Someone';
}

async function getSocketUserIdentity(userId, tokenPayload = {}) {
  try {
    const rows = await query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.photo_url, r.role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    if (rows[0]) {
      return {
        id: String(rows[0].id),
        name: [rows[0].first_name, rows[0].last_name].filter(Boolean).join(' ').trim() || notificationIdentity(rows[0]),
        notificationName: notificationIdentity(rows[0]),
        username: rows[0].username || null,
        role: rows[0].role_name,
        photoUrl: rows[0].photo_url || null,
      };
    }
  } catch {
    // Token fallback keeps old sessions usable if the identity lookup fails.
  }
  const fallback = {
    id: String(userId),
    username: tokenPayload.username || null,
    role: tokenPayload.role,
  };
  return {
    ...fallback,
    name: notificationIdentity(fallback),
    notificationName: notificationIdentity(fallback),
    photoUrl: null,
  };
}

// ── WebSocket Server ────────────────────────────────────────────────────────

function attach(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const baseUrl = getRequestBaseUrl(req);
    let parsed;
    try {
      parsed = new URL(req.url, baseUrl);
    } catch {
      socket.destroy();
      return;
    }

    // Authenticate JWT from query params
    const token = parsed.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let userPayload;
    try {
      userPayload = jwt.verify(token, jwtConfig.secret);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const incidentId = getRoomId(parsed.pathname);
    const isDispatch = isDispatchPath(parsed.pathname);

    if (!incidentId && !isDispatch) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, {
        incidentId,
        isDispatch,
        userPayload,
      });
    });
  });

  wss.on('connection', async (ws, req, { incidentId, isDispatch, userPayload }) => {
    const userId = Number(userPayload.sub);
    const userInfo = await getSocketUserIdentity(userId, userPayload);

    if (await isBlockedUser(userId)) {
      ws.close(1008, 'Account blocked');
      return;
    }

    // ── Dispatch channel (volunteer presence) ──
    if (isDispatch) {
      const client = { ws, userId, userInfo };
      dispatchClients.add(client);

      // Mark user online in DB (fire-and-forget)
      try {
        await query(`UPDATE users SET is_online = TRUE, last_seen_at = NOW() WHERE id = ?`, [userId]);
      } catch (err) {
        console.error('[WS Dispatch] Failed to mark user online:', err.message);
      }

      ws.send(JSON.stringify({ type: 'dispatch.connected', payload: { userId: String(userId) } }));

      ws.on('close', async () => {
        dispatchClients.delete(client);
        // Mark user offline
        try {
          await query(`UPDATE users SET is_online = FALSE, last_seen_at = NOW() WHERE id = ?`, [userId]);
        } catch (err) {
          console.error('[WS Dispatch] Failed to mark user offline:', err.message);
        }
      });

      return;
    }

    // ── Chat room (per-incident) ──
    if (!rooms.has(incidentId)) rooms.set(incidentId, new Set());
    const client = { ws, userId, userInfo };
    rooms.get(incidentId).add(client);

    // Join the incident in DB and get participant list
    let participants = [];
    let joinMessage = null;
    try {
      const joinResult = await chatService.joinAndGetEvent(userId, incidentId, userPayload.role);
      participants = joinResult.participants;
      joinMessage = joinResult.joinMessage;
    } catch {
      // incident may be cancelled — still allow read-only connection
    }

    if (joinMessage) {
      broadcastAll(incidentId, { type: 'message:new', payload: joinMessage });
      broadcast(incidentId, {
        type: 'incident.participant.joined',
        payload: {
          id: String(userId),
          name: userInfo.name,
          notificationName: userInfo.notificationName,
          username: userInfo.username || undefined,
          role: userInfo.role || userPayload.role,
          avatarUrl: userInfo.photoUrl || undefined,
        },
      }, ws);
    }

    // Send current participants to the newly connected client
    ws.send(JSON.stringify({ type: 'incident.participants.list', payload: participants }));

    ws.on('message', async (raw) => {
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      if (data.type === 'chat.message.send') {
        try {
          if (await isBlockedUser(userId)) {
            throw new Error('This account is blocked and cannot send messages.');
          }
          const msg = await chatService.sendMessage(userId, incidentId, data.payload || {});
          broadcastAll(incidentId, { type: 'chat.message.new', payload: msg });
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
        }
      }

      if (data.type === 'incident.location.update') {
        if (await isFinalIncident(incidentId)) {
          ws.send(JSON.stringify({
            type: 'incident.location.rejected',
            payload: { incidentId: String(incidentId), reason: 'INCIDENT_FINAL' },
          }));
          return;
        }

        const loc = data.payload || {};
        const latitude = Number(loc.latitude);
        const longitude = Number(loc.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        try {
          await locationService.save(userId, { latitude, longitude, address: loc.address });
        } catch (err) {
          console.error('[WS Chat] Failed to save live location:', err.message);
        }

        broadcast(incidentId, {
          type: 'incident.location.updated',
          payload: {
            latitude,
            longitude,
            heading: Number.isFinite(Number(loc.heading)) ? Number(loc.heading) : null,
            updatedAt: new Date().toISOString(),
            userId: String(userId),
            role: normalizeSocketRole(userPayload.role),
          },
        }, ws);
      }
    });

    ws.on('close', () => {
      const room = rooms.get(incidentId);
      if (room) {
        room.delete(client);
        if (room.size === 0) rooms.delete(incidentId);
      }
    });
  });

  return wss;
}

module.exports = {
  attach,
  notifyNewSOS,
  notifyAccepted,
  notifyRejected,
  notifyClosed,
  notifyRespondersUpdated,
  notifyMessageNew,
  notifyPoliceIncidentStatus,
  notifyPoliceAssignment,
  notifyLawEnforcementRequestCreated,
  notifyLawEnforcementRequestUpdated,
  broadcastDispatch,
  sendToUser,
};

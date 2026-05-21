const { WebSocketServer } = require('ws');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const chatService = require('../modules/chat/chat.service');

// ── Room Management ─────────────────────────────────────────────────────────
// rooms: Map<incidentId(string), Set<{ ws, userId, userInfo }>>
const rooms = new Map();

// dispatchClients: Set<{ ws, userId, userInfo }> — all online volunteers
const dispatchClients = new Set();

function getRoomId(pathname) {
  // /ws/chat/:incidentId/
  const match = pathname.match(/^\/ws\/chat\/(\d+)\/?$/);
  return match ? match[1] : null;
}

function isDispatchPath(pathname) {
  return /^\/ws\/dispatch\/?$/.test(pathname);
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

function notifyClosed(incidentId) {
  broadcastDispatch({
    type: 'sos.claimed',
    payload: { incidentId: String(incidentId) },
  });
  broadcastAll(String(incidentId), {
    type: 'incident:status_updated',
    payload: { incidentId: String(incidentId) },
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

// ── WebSocket Server ────────────────────────────────────────────────────────

function attach(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const baseUrl = `http://${req.headers.host}`;
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
    const userInfo = {
      id: String(userId),
      role: userPayload.role,
      phoneNumber: userPayload.phoneNumber,
    };

    // ── Dispatch channel (volunteer presence) ──
    if (isDispatch) {
      const client = { ws, userId, userInfo };
      dispatchClients.add(client);

      // Mark user online in DB (fire-and-forget)
      try {
        const { query } = require('../config/db');
        await query(`UPDATE users SET is_online = TRUE, last_seen_at = NOW() WHERE id = ?`, [userId]);
      } catch (err) {
        console.error('[WS Dispatch] Failed to mark user online:', err.message);
      }

      ws.send(JSON.stringify({ type: 'dispatch.connected', payload: { userId: String(userId) } }));

      ws.on('close', async () => {
        dispatchClients.delete(client);
        // Mark user offline
        try {
          const { query } = require('../config/db');
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
    try {
      participants = await chatService.join(userId, incidentId);
    } catch {
      // incident may be cancelled — still allow read-only connection
    }

    // Notify all others that this participant joined
    broadcast(incidentId, {
      type: 'incident.participant.joined',
      payload: { id: String(userId), name: userPayload.phoneNumber, role: userPayload.role },
    }, ws);

    // Send current participants to the newly connected client
    ws.send(JSON.stringify({ type: 'incident.participants.list', payload: participants }));

    ws.on('message', async (raw) => {
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      if (data.type === 'chat.message.send') {
        try {
          const msg = await chatService.sendMessage(userId, incidentId, data.payload || {});
          broadcastAll(incidentId, { type: 'chat.message.new', payload: msg });
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
        }
      }

      if (data.type === 'incident.location.update') {
        const loc = data.payload;
        broadcast(incidentId, { type: 'incident.location.updated', payload: loc }, ws);
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
  broadcastDispatch,
  sendToUser,
};

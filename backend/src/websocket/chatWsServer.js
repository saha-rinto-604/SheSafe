const { WebSocketServer } = require('ws');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const chatService = require('../modules/chat/chat.service');

// rooms: Map<incidentId(string), Set<{ ws, userId, userInfo }>>
const rooms = new Map();

function getRoomId(pathname) {
  // expects /ws/chat/:incidentId/
  const match = pathname.match(/^\/ws\/chat\/(\d+)\/?$/);
  return match ? match[1] : null;
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

    const incidentId = getRoomId(parsed.pathname);
    if (!incidentId) {
      socket.destroy();
      return;
    }

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

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, { incidentId, userPayload });
    });
  });

  wss.on('connection', async (ws, req, { incidentId, userPayload }) => {
    const userId = Number(userPayload.sub);
    const userInfo = {
      id: String(userId),
      role: userPayload.role,
      phoneNumber: userPayload.phoneNumber,
    };

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

module.exports = { attach };

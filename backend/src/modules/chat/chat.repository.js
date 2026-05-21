const { query } = require('../../config/db');

async function joinIncident(incidentId, userId) {
  await query(
    `INSERT IGNORE INTO incident_participants (incident_id, user_id) VALUES (?, ?)`,
    [incidentId, userId]
  );
}

async function getParticipants(incidentId) {
  return query(
    `SELECT u.id, u.first_name, u.last_name, u.photo_url, r.role_name
     FROM incident_participants ip
     JOIN users u ON ip.user_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE ip.incident_id = ?
     ORDER BY ip.joined_at ASC`,
    [incidentId]
  );
}

async function insertMessage({ incidentId, senderId, content, messageType, mediaUrl }) {
  const result = await query(
    `INSERT INTO chat_messages (incident_id, sender_id, content, message_type, media_url)
     VALUES (?, ?, ?, ?, ?)`,
    [incidentId, senderId, content, messageType || 'TEXT', mediaUrl || null]
  );
  const rows = await query(
    `SELECT m.id, m.incident_id, m.content, m.message_type, m.media_url, m.created_at,
            u.id AS sender_id, u.first_name, u.last_name, u.photo_url, r.role_name
     FROM chat_messages m
     JOIN users u ON m.sender_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE m.id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

async function getMessages(incidentId, limit = 100) {
  return query(
    `SELECT m.id, m.incident_id, m.content, m.message_type, m.media_url, m.created_at,
            u.id AS sender_id, u.first_name, u.last_name, u.photo_url, r.role_name
     FROM chat_messages m
     JOIN users u ON m.sender_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE m.incident_id = ?
     ORDER BY m.created_at ASC
     LIMIT ?`,
    [incidentId, limit]
  );
}

async function getActiveIncidents() {
  return query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.accepted_at,
            u.first_name, u.last_name, u.photo_url,
            (SELECT COUNT(*) FROM incident_participants ip WHERE ip.incident_id = i.id) AS participant_count,
            (SELECT m.content FROM chat_messages m WHERE m.incident_id = i.id ORDER BY m.created_at DESC LIMIT 1) AS latest_message
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     WHERE i.status = 'ACTIVE'
     ORDER BY i.created_at DESC`
  );
}

/**
 * Fetch incidents a volunteer has been involved with (assisted chats).
 * Mirrors the exact shape of getActiveIncidents() for frontend parity.
 */
async function getAssistedChats(volunteerId) {
  return query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.accepted_at,
            u.first_name, u.last_name, u.photo_url,
            (SELECT COUNT(*) FROM incident_participants ip WHERE ip.incident_id = i.id) AS participant_count,
            (SELECT m.content FROM chat_messages m WHERE m.incident_id = i.id ORDER BY m.created_at DESC LIMIT 1) AS latest_message
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     WHERE i.volunteer_id = ?
       AND i.status IN ('ACTIVE', 'RESOLVED')
     ORDER BY i.created_at DESC`,
    [volunteerId]
  );
}

module.exports = {
  joinIncident,
  getParticipants,
  insertMessage,
  getMessages,
  getActiveIncidents,
  getAssistedChats,
};

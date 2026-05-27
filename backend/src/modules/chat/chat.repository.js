const { query, pool } = require('../../config/db');
const { ensureVolunteerDispatchSchema } = require('../incidents/incident.repository');

async function joinIncident(incidentId, userId) {
  await ensureVolunteerDispatchSchema();
  await query(
    `INSERT INTO incident_participants (incident_id, user_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       archived_at = NULL,
       deleted_for_user_at = NULL,
       left_at = NULL`,
    [incidentId, userId]
  );
}

async function getParticipants(incidentId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT u.id, u.first_name, u.last_name, u.photo_url, r.role_name
     FROM incident_participants ip
     JOIN users u ON ip.user_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE ip.incident_id = ?
       AND ip.left_at IS NULL
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

async function archiveForUser(incidentId, userId, { deleted = false } = {}) {
  await ensureVolunteerDispatchSchema();
  await query(
    `INSERT INTO incident_participants (incident_id, user_id, archived_at, deleted_for_user_at)
     VALUES (?, ?, NOW(), ${deleted ? 'NOW()' : 'NULL'})
     ON DUPLICATE KEY UPDATE
       archived_at = COALESCE(archived_at, NOW()),
       deleted_for_user_at = ${deleted ? 'COALESCE(deleted_for_user_at, NOW())' : 'deleted_for_user_at'}`,
    [incidentId, userId]
  );
}

async function leaveForUser(incidentId, userId) {
  await ensureVolunteerDispatchSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO incident_participants (incident_id, user_id, archived_at, left_at)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         archived_at = COALESCE(archived_at, NOW()),
         left_at = COALESCE(left_at, NOW())`,
      [incidentId, userId]
    );

    const [leaveRows] = await conn.execute(
      `UPDATE incident_volunteers
       SET status = 'LEFT', updated_at = NOW()
       WHERE incident_id = ?
         AND volunteer_id = ?
         AND status = 'ACCEPTED'`,
      [incidentId, userId]
    );

    if (leaveRows.affectedRows > 0) {
      await conn.execute(
        `UPDATE incidents
         SET volunteer_id = (
             SELECT next_volunteer_id FROM (
               SELECT volunteer_id AS next_volunteer_id
               FROM incident_volunteers
               WHERE incident_id = ?
                 AND status = 'ACCEPTED'
                 AND volunteer_id <> ?
               ORDER BY accepted_at ASC, id ASC
               LIMIT 1
             ) next_responder
           ),
           updated_at = NOW()
         WHERE id = ?
           AND volunteer_id = ?`,
        [incidentId, userId, incidentId, userId]
      );

      await conn.execute(
        `INSERT INTO chat_messages (incident_id, sender_id, content, message_type)
         VALUES (?, ?, 'A responder left this dispatch.', 'SYSTEM')`,
        [incidentId, userId]
      );
    }

    await conn.commit();
    return { leftResponder: leaveRows.affectedRows > 0 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
     JOIN incident_volunteers iv ON iv.incident_id = i.id
       AND iv.volunteer_id = ?
       AND iv.status = 'ACCEPTED'
     JOIN incident_participants current_ip ON current_ip.incident_id = i.id
       AND current_ip.user_id = iv.volunteer_id
       AND current_ip.archived_at IS NULL
       AND current_ip.deleted_for_user_at IS NULL
     WHERE i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
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
  archiveForUser,
  leaveForUser,
};

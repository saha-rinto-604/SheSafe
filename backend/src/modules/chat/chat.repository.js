const { query, pool } = require('../../config/db');
const { ensureVolunteerDispatchSchema } = require('../incidents/incident.repository');
const { ensureUserBlockSchema } = require('../users/user.repository');

let chatSchemaReady = false;

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function hasIndex(tableName, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function ensureChatSchema() {
  if (chatSchemaReady) return;
  await ensureVolunteerDispatchSchema();

  await query(
    `CREATE TABLE IF NOT EXISTS chat_messages (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       incident_id BIGINT UNSIGNED NOT NULL,
       sender_id BIGINT UNSIGNED NOT NULL,
       content TEXT NOT NULL,
       message_type ENUM('TEXT','IMAGE','AUDIO','SYSTEM') NOT NULL DEFAULT 'TEXT',
       media_url VARCHAR(500) DEFAULT NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY idx_chat_incident_id (incident_id),
       KEY idx_chat_sender_id (sender_id),
       CONSTRAINT fk_chat_incident FOREIGN KEY (incident_id)
         REFERENCES incidents (id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_chat_sender FOREIGN KEY (sender_id)
         REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
     )`
  );

  if (!(await hasColumn('chat_messages', 'message_type'))) {
    await query(
      `ALTER TABLE chat_messages
       ADD COLUMN message_type ENUM('TEXT','IMAGE','AUDIO','SYSTEM') NOT NULL DEFAULT 'TEXT' AFTER content`
    );
  }
  await query(
    `ALTER TABLE chat_messages
     MODIFY COLUMN message_type ENUM('TEXT','IMAGE','AUDIO','SYSTEM') NOT NULL DEFAULT 'TEXT'`
  );

  if (!(await hasColumn('chat_messages', 'media_url'))) {
    await query(
      `ALTER TABLE chat_messages
       ADD COLUMN media_url VARCHAR(500) DEFAULT NULL AFTER message_type`
    );
  }

  if (!(await hasColumn('chat_messages', 'created_at'))) {
    await query(
      `ALTER TABLE chat_messages
       ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
  }

  if (!(await hasIndex('chat_messages', 'idx_chat_incident_created'))) {
    await query(
      `ALTER TABLE chat_messages
       ADD KEY idx_chat_incident_created (incident_id, created_at, id)`
    );
  }

  chatSchemaReady = true;
}

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
    `SELECT u.id, u.first_name, u.last_name, u.username, u.photo_url, r.role_name
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
  await ensureChatSchema();
  const result = await query(
    `INSERT INTO chat_messages (incident_id, sender_id, content, message_type, media_url)
     VALUES (?, ?, ?, ?, ?)`,
    [incidentId, senderId, content, messageType || 'TEXT', mediaUrl || null]
  );
  const rows = await query(
    `SELECT m.id, m.incident_id, m.content, m.message_type, m.media_url, m.created_at,
            u.id AS sender_id, u.first_name, u.last_name, u.username, u.photo_url, r.role_name
     FROM chat_messages m
     JOIN users u ON m.sender_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE m.id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

async function getMessages(incidentId, limit = 100, viewerId = null) {
  await ensureChatSchema();
  if (viewerId) await ensureUserBlockSchema();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const blockFilter = viewerId
    ? `AND (
         m.message_type = 'SYSTEM'
         OR m.sender_id = ?
         OR NOT EXISTS (
           SELECT 1
           FROM user_blocks ub
           WHERE ub.blocker_user_id = ?
             AND ub.blocked_user_id = m.sender_id
         )
       )`
    : '';
  const params = viewerId ? [incidentId, viewerId, viewerId] : [incidentId];
  return query(
    `SELECT *
     FROM (
       SELECT m.id, m.incident_id, m.content, m.message_type, m.media_url, m.created_at,
              u.id AS sender_id, u.first_name, u.last_name, u.username, u.photo_url, r.role_name
       FROM chat_messages m
       JOIN users u ON m.sender_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE m.incident_id = ?
       ${blockFilter}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${safeLimit}
     ) latest
     ORDER BY latest.created_at ASC, latest.id ASC`,
    params
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
  await ensureChatSchema();
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
  await ensureChatSchema();
  return query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.updated_at, i.accepted_at,
            u.first_name, u.last_name, u.photo_url,
            (SELECT COUNT(*) FROM incident_participants ip WHERE ip.incident_id = i.id) AS participant_count,
            lm.content AS latest_message,
            lm.created_at AS latest_message_created_at,
            COALESCE(lm.created_at, i.updated_at, i.created_at) AS latest_activity_at
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     LEFT JOIN chat_messages lm ON lm.id = (
       SELECT m2.id FROM chat_messages m2
       WHERE m2.incident_id = i.id
       ORDER BY m2.created_at DESC, m2.id DESC
       LIMIT 1
     )
     WHERE i.status = 'ACTIVE'
     ORDER BY i.id DESC`
  );
}

/**
 * Fetch incidents a volunteer has been involved with (assisted chats).
 * Mirrors the exact shape of getActiveIncidents() for frontend parity.
 */
async function getAssistedChats(volunteerId) {
  await ensureChatSchema();
  return query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.updated_at, i.accepted_at,
            u.first_name, u.last_name, u.photo_url,
            (SELECT COUNT(*) FROM incident_participants ip WHERE ip.incident_id = i.id) AS participant_count,
            lm.content AS latest_message,
            lm.created_at AS latest_message_created_at,
            COALESCE(lm.created_at, i.updated_at, i.created_at) AS latest_activity_at
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     JOIN incident_volunteers iv ON iv.incident_id = i.id
       AND iv.volunteer_id = ?
       AND iv.status = 'ACCEPTED'
     JOIN incident_participants current_ip ON current_ip.incident_id = i.id
       AND current_ip.user_id = iv.volunteer_id
       AND current_ip.archived_at IS NULL
       AND current_ip.deleted_for_user_at IS NULL
     LEFT JOIN chat_messages lm ON lm.id = (
       SELECT m2.id FROM chat_messages m2
       WHERE m2.incident_id = i.id
       ORDER BY m2.created_at DESC, m2.id DESC
       LIMIT 1
     )
     WHERE i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
     ORDER BY i.id DESC`,
    [volunteerId]
  );
}

module.exports = {
  joinIncident,
  getParticipants,
  ensureChatSchema,
  insertMessage,
  getMessages,
  getActiveIncidents,
  getAssistedChats,
  archiveForUser,
  leaveForUser,
};

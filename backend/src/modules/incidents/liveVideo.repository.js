const { pool, query } = require('../../config/db');
const { ensureChatSchema, insertMessage } = require('../chat/chat.repository');

let liveVideoSchemaReady = false;
const ACTIVE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'STREAMING', 'RECORDING'];
const UPLOADABLE_REQUEST_STATUSES = ['APPROVED', 'RECORDING', 'STOPPED'];

async function ensureLiveVideoSchema() {
  if (liveVideoSchemaReady) return;
  await ensureChatSchema();
  await query(
    `CREATE TABLE IF NOT EXISTS incident_video_requests (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       incident_id BIGINT UNSIGNED NOT NULL,
       requester_id BIGINT UNSIGNED NOT NULL,
       victim_id BIGINT UNSIGNED NOT NULL,
       status ENUM('PENDING','APPROVED','STREAMING','RECORDING','STOPPED','DECLINED','EXPIRED','FAILED','COMPLETED') NOT NULL DEFAULT 'PENDING',
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       expires_at TIMESTAMP NULL DEFAULT NULL,
       PRIMARY KEY (id),
       KEY idx_video_requests_incident_status (incident_id, status),
       KEY idx_video_requests_victim_status (victim_id, status),
       KEY idx_video_requests_requester_status (requester_id, status),
       CONSTRAINT fk_video_requests_incident FOREIGN KEY (incident_id)
         REFERENCES incidents (id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_video_requests_requester FOREIGN KEY (requester_id)
         REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_video_requests_victim FOREIGN KEY (victim_id)
         REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
     )`
  );
  await query(
    `ALTER TABLE incident_video_requests
       MODIFY COLUMN status
       ENUM('PENDING','APPROVED','STREAMING','RECORDING','STOPPED','DECLINED','EXPIRED','FAILED','COMPLETED')
       NOT NULL DEFAULT 'PENDING'`
  );
  liveVideoSchemaReady = true;
}

function formatDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function formatRequest(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    requesterId: String(row.requester_id),
    victimId: String(row.victim_id),
    status: row.status,
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
    expiresAt: formatDate(row.expires_at),
    requester: row.requester_name || row.requester_username ? {
      id: String(row.requester_id),
      name: row.requester_name || 'A responder',
      username: row.requester_username || undefined,
      photoUrl: row.requester_photo_url || null,
    } : undefined,
  };
}

async function expireStaleRequests(incidentId) {
  await ensureLiveVideoSchema();
  await query(
    `UPDATE incident_video_requests
        SET status = 'EXPIRED', updated_at = NOW()
      WHERE incident_id = ?
        AND (
          (status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < NOW())
          OR
          (status IN ('APPROVED', 'STREAMING', 'RECORDING') AND updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))
        )`,
    [incidentId]
  );
}

async function findAcceptedResponder(incidentId, userId) {
  await ensureLiveVideoSchema();
  const rows = await query(
    `SELECT iv.id, u.id AS user_id, u.first_name, u.last_name, u.username, u.photo_url
       FROM incident_volunteers iv
       JOIN users u ON u.id = iv.volunteer_id
      WHERE iv.incident_id = ?
        AND iv.volunteer_id = ?
        AND iv.status = 'ACCEPTED'
      LIMIT 1`,
    [incidentId, userId]
  );
  return rows[0] || null;
}

async function findLatestActiveForVictim(incidentId, victimId) {
  await expireStaleRequests(incidentId);
  const rows = await query(
    `SELECT ivr.*,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
            u.username AS requester_username,
            u.photo_url AS requester_photo_url
       FROM incident_video_requests ivr
       JOIN users u ON u.id = ivr.requester_id
      WHERE ivr.incident_id = ?
        AND ivr.victim_id = ?
        AND ivr.status IN ('PENDING', 'APPROVED', 'STREAMING', 'RECORDING')
      ORDER BY ivr.updated_at DESC, ivr.id DESC
      LIMIT 1`,
    [incidentId, victimId]
  );
  return formatRequest(rows[0]);
}

async function findLatestActiveForIncident(incidentId) {
  await expireStaleRequests(incidentId);
  const rows = await query(
    `SELECT ivr.*,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
            u.username AS requester_username,
            u.photo_url AS requester_photo_url
       FROM incident_video_requests ivr
       JOIN users u ON u.id = ivr.requester_id
      WHERE ivr.incident_id = ?
        AND ivr.status IN ('PENDING', 'APPROVED', 'STREAMING', 'RECORDING')
      ORDER BY ivr.updated_at DESC, ivr.id DESC
      LIMIT 1`,
    [incidentId]
  );
  return formatRequest(rows[0]);
}

async function findLatestForIncident(incidentId) {
  await expireStaleRequests(incidentId);
  const rows = await query(
    `SELECT ivr.*,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
            u.username AS requester_username,
            u.photo_url AS requester_photo_url
      FROM incident_video_requests ivr
      JOIN users u ON u.id = ivr.requester_id
      WHERE ivr.incident_id = ?
      ORDER BY CASE
                 WHEN ivr.status IN ('PENDING', 'APPROVED', 'STREAMING', 'RECORDING') THEN 0
                 ELSE 1
               END,
               ivr.updated_at DESC,
               ivr.id DESC
      LIMIT 1`,
    [incidentId]
  );
  return formatRequest(rows[0]);
}

async function findLatestActiveForRequester(incidentId, requesterId) {
  await expireStaleRequests(incidentId);
  const rows = await query(
    `SELECT ivr.*,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
            u.username AS requester_username,
            u.photo_url AS requester_photo_url
       FROM incident_video_requests ivr
       JOIN users u ON u.id = ivr.requester_id
      WHERE ivr.incident_id = ?
        AND ivr.requester_id = ?
        AND ivr.status IN ('PENDING', 'APPROVED', 'STREAMING', 'RECORDING')
      ORDER BY ivr.updated_at DESC, ivr.id DESC
      LIMIT 1`,
    [incidentId, requesterId]
  );
  return formatRequest(rows[0]);
}

async function findLatestUploadableForVictim(incidentId, victimId) {
  await expireStaleRequests(incidentId);
  const rows = await query(
    `SELECT ivr.*,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
            u.username AS requester_username,
            u.photo_url AS requester_photo_url
       FROM incident_video_requests ivr
       JOIN users u ON u.id = ivr.requester_id
      WHERE ivr.incident_id = ?
        AND ivr.victim_id = ?
        AND ivr.status IN ('APPROVED', 'RECORDING', 'STOPPED')
      ORDER BY ivr.updated_at DESC, ivr.id DESC
      LIMIT 1`,
    [incidentId, victimId]
  );
  return formatRequest(rows[0]);
}

async function findLatestRespondableForVictim(incidentId, victimId) {
  await expireStaleRequests(incidentId);
  const rows = await query(
    `SELECT ivr.*,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
            u.username AS requester_username,
            u.photo_url AS requester_photo_url
       FROM incident_video_requests ivr
       JOIN users u ON u.id = ivr.requester_id
      WHERE ivr.incident_id = ?
        AND ivr.victim_id = ?
        AND ivr.status IN ('PENDING', 'APPROVED', 'STREAMING', 'RECORDING')
      ORDER BY ivr.updated_at DESC, ivr.id DESC
      LIMIT 1`,
    [incidentId, victimId]
  );
  return formatRequest(rows[0]);
}

async function findRequestById(requestId) {
  await ensureLiveVideoSchema();
  const rows = await query(
    `SELECT ivr.*,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
            u.username AS requester_username,
            u.photo_url AS requester_photo_url
       FROM incident_video_requests ivr
       JOIN users u ON u.id = ivr.requester_id
      WHERE ivr.id = ?
      LIMIT 1`,
    [requestId]
  );
  return formatRequest(rows[0]);
}

async function createOrReusePendingRequest({ incidentId, requesterId, victimId }) {
  await ensureLiveVideoSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Serialize request creation per incident so concurrent taps cannot create duplicates.
    await conn.execute('SELECT id FROM incidents WHERE id = ? FOR UPDATE', [incidentId]);
    await conn.execute(
      `UPDATE incident_video_requests
          SET status = 'EXPIRED', updated_at = NOW()
        WHERE incident_id = ?
          AND (
            (status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < NOW())
            OR
            (status IN ('APPROVED', 'STREAMING', 'RECORDING') AND updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))
          )`,
      [incidentId]
    );

    const [existingRows] = await conn.execute(
      `SELECT ivr.*,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
              u.username AS requester_username,
              u.photo_url AS requester_photo_url
         FROM incident_video_requests ivr
         JOIN users u ON u.id = ivr.requester_id
        WHERE ivr.incident_id = ?
          AND ivr.status IN ('PENDING', 'APPROVED', 'STREAMING', 'RECORDING')
        ORDER BY ivr.updated_at DESC, ivr.id DESC
        LIMIT 1`,
      [incidentId]
    );
    if (existingRows[0]) {
      await conn.commit();
      return { request: formatRequest(existingRows[0]), created: false };
    }

    const [result] = await conn.execute(
      `INSERT INTO incident_video_requests
         (incident_id, requester_id, victim_id, status, expires_at)
       VALUES (?, ?, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [incidentId, requesterId, victimId]
    );
    const [createdRows] = await conn.execute(
      `SELECT ivr.*,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS requester_name,
              u.username AS requester_username,
              u.photo_url AS requester_photo_url
         FROM incident_video_requests ivr
         JOIN users u ON u.id = ivr.requester_id
        WHERE ivr.id = ?
        LIMIT 1`,
      [result.insertId]
    );
    await conn.commit();
    return { request: formatRequest(createdRows[0]), created: true };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateRequestStatus(requestId, status, allowedCurrentStatuses = []) {
  await ensureLiveVideoSchema();
  const allowed = allowedCurrentStatuses.map((value) => String(value).toUpperCase());
  const statusFilter = allowed.length
    ? ` AND status IN (${allowed.map(() => '?').join(', ')})`
    : '';
  const result = await query(
    `UPDATE incident_video_requests
        SET status = ?,
            updated_at = NOW(),
            expires_at = CASE WHEN ? IN ('APPROVED', 'STREAMING', 'RECORDING', 'STOPPED', 'DECLINED', 'FAILED', 'COMPLETED') THEN NULL ELSE expires_at END
      WHERE id = ?${statusFilter}`,
    [status, status, requestId, ...allowed]
  );
  if (Number(result.affectedRows || 0) === 0) return null;
  return findRequestById(requestId);
}

async function insertLiveVideoSystemMessage({ incidentId, senderId, content, systemEventKey }) {
  return insertMessage({
    incidentId,
    senderId,
    content,
    messageType: 'SYSTEM',
    systemEventKey: systemEventKey || null,
  });
}

async function insertLiveVideoMessage({
  incidentId,
  senderId,
  mediaUrl,
  mediaPublicId,
  mediaMimeType,
  mediaFilename,
  mediaSizeBytes,
}) {
  return insertMessage({
    incidentId,
    senderId,
    content: 'Live Safety Video',
    messageType: 'VIDEO',
    mediaUrl,
    mediaPublicId,
    mediaMimeType,
    mediaFilename,
    mediaSizeBytes,
  });
}

async function insertSessionVideoMessage({
  requestId,
  incidentId,
  victimId,
  mediaUrl,
  mediaPublicId,
  mediaMimeType,
  mediaFilename,
  mediaSizeBytes,
}) {
  await ensureLiveVideoSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [requestRows] = await conn.execute(
      `SELECT ivr.requester_id
         FROM incident_video_requests ivr
         JOIN incidents i ON i.id = ivr.incident_id
        WHERE ivr.id = ?
          AND ivr.incident_id = ?
          AND ivr.victim_id = ?
          AND ivr.status IN ('APPROVED', 'RECORDING', 'STOPPED')
          AND i.status IN ('ACTIVE', 'IN_PROGRESS', 'LIVE')
        FOR UPDATE`,
      [requestId, incidentId, victimId]
    );
    if (!requestRows[0]) {
      await conn.rollback();
      return null;
    }

    const [messageResult] = await conn.execute(
      `INSERT INTO chat_messages (
         incident_id, sender_id, content, message_type, media_url,
         media_public_id, media_mime_type, media_filename, media_size_bytes
       )
       VALUES (?, ?, 'Live Safety Video', 'VIDEO', ?, ?, ?, ?, ?)`,
      [
        incidentId,
        victimId,
        mediaUrl,
        mediaPublicId,
        mediaMimeType,
        mediaFilename,
        mediaSizeBytes == null ? null : Number(mediaSizeBytes),
      ]
    );
    await conn.execute(
      `UPDATE incident_video_requests
          SET status = CASE WHEN status = 'STOPPED' THEN 'STOPPED' ELSE 'RECORDING' END,
              updated_at = NOW(),
              expires_at = NULL
        WHERE id = ?`,
      [requestId]
    );
    const [messageRows] = await conn.execute(
      `SELECT m.id, m.incident_id, m.content, m.message_type, m.media_url,
              m.media_public_id, m.media_mime_type, m.media_filename, m.media_size_bytes,
              m.created_at,
              u.id AS sender_id, u.first_name, u.last_name, u.username, u.photo_url, r.role_name
         FROM chat_messages m
         JOIN users u ON m.sender_id = u.id
         JOIN roles r ON u.role_id = r.id
        WHERE m.id = ?
        LIMIT 1`,
      [messageResult.insertId]
    );
    await conn.commit();
    return {
      requesterId: String(requestRows[0].requester_id),
      message: messageRows[0],
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  ensureLiveVideoSchema,
  findAcceptedResponder,
  findLatestActiveForVictim,
  findLatestActiveForIncident,
  findLatestForIncident,
  findLatestActiveForRequester,
  findLatestUploadableForVictim,
  findLatestRespondableForVictim,
  findRequestById,
  createOrReusePendingRequest,
  updateRequestStatus,
  insertLiveVideoSystemMessage,
  insertLiveVideoMessage,
  insertSessionVideoMessage,
  ACTIVE_REQUEST_STATUSES,
  UPLOADABLE_REQUEST_STATUSES,
};

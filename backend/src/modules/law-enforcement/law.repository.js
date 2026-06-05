const { query, pool } = require('../../config/db');
const { ensurePoliceProfilesSchema } = require('../users/user.repository');
const { ensureVolunteerDispatchSchema } = require('../incidents/incident.repository');
const { ensureChatSchema } = require('../chat/chat.repository');

const ACTIVE_REQUEST_STATUSES = ['PENDING_ADMIN_REVIEW', 'ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE'];
let schemaReadyPromise = null;

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function addColumnIfMissing(tableName, columnName, ddl) {
  if (!(await hasColumn(tableName, columnName))) {
    await query(ddl);
  }
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
  return Number(rows[0]?.count || 0) > 0;
}

async function ensureLawSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await query(`INSERT IGNORE INTO roles (role_name) VALUES ('law_enforcement')`);
      await ensureVolunteerDispatchSchema();
      await ensureChatSchema();
      await ensurePoliceProfilesSchema();

      await addColumnIfMissing(
        'users',
        'latest_latitude',
        `ALTER TABLE users ADD COLUMN latest_latitude DECIMAL(10,7) DEFAULT NULL`
      );
      await addColumnIfMissing(
        'users',
        'latest_longitude',
        `ALTER TABLE users ADD COLUMN latest_longitude DECIMAL(10,7) DEFAULT NULL`
      );

      await query(
        `CREATE TABLE IF NOT EXISTS incident_volunteers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          incident_id BIGINT UNSIGNED NOT NULL,
          volunteer_id BIGINT UNSIGNED NOT NULL,
          accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL DEFAULT NULL,
          status ENUM('ACCEPTED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ACCEPTED',
          PRIMARY KEY (id),
          UNIQUE KEY uq_incident_volunteer (incident_id, volunteer_id),
          KEY idx_incident_volunteers_incident_status (incident_id, status),
          KEY idx_incident_volunteers_volunteer_status (volunteer_id, status),
          CONSTRAINT fk_law_iv_incident FOREIGN KEY (incident_id)
            REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT fk_law_iv_volunteer FOREIGN KEY (volunteer_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );

      await query(
        `CREATE TABLE IF NOT EXISTS law_enforcement_requests (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          incident_id BIGINT UNSIGNED NOT NULL,
          requested_by_user_id BIGINT UNSIGNED NOT NULL,
          requested_by_role VARCHAR(50) NOT NULL,
          status ENUM(
            'PENDING_ADMIN_REVIEW',
            'ASSIGNED_TO_POLICE',
            'ACCEPTED_BY_POLICE',
            'REJECTED_BY_POLICE',
            'RESOLVED',
            'CANCELLED'
          ) NOT NULL DEFAULT 'PENDING_ADMIN_REVIEW',
          assigned_police_id BIGINT UNSIGNED DEFAULT NULL,
          admin_id BIGINT UNSIGNED DEFAULT NULL,
          request_note TEXT DEFAULT NULL,
          rejection_reason TEXT DEFAULT NULL,
          cancel_reason TEXT DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_law_requests_incident_status (incident_id, status),
          KEY idx_law_requests_assigned_status (assigned_police_id, status),
          KEY idx_law_requests_status_created (status, created_at),
          CONSTRAINT fk_law_requests_incident FOREIGN KEY (incident_id)
            REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT fk_law_requests_requester FOREIGN KEY (requested_by_user_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT fk_law_requests_police FOREIGN KEY (assigned_police_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
          CONSTRAINT fk_law_requests_admin FOREIGN KEY (admin_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );

      await addColumnIfMissing(
        'law_enforcement_requests',
        'request_note',
        `ALTER TABLE law_enforcement_requests ADD COLUMN request_note TEXT DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'incident_summary',
        `ALTER TABLE law_enforcement_requests ADD COLUMN incident_summary TEXT DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'severity',
        `ALTER TABLE law_enforcement_requests ADD COLUMN severity VARCHAR(20) DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'severity_reason',
        `ALTER TABLE law_enforcement_requests ADD COLUMN severity_reason TEXT DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'summary_generated_at',
        `ALTER TABLE law_enforcement_requests ADD COLUMN summary_generated_at DATETIME DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'reviewed_by_admin_id',
        `ALTER TABLE law_enforcement_requests ADD COLUMN reviewed_by_admin_id BIGINT UNSIGNED DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'reviewed_at',
        `ALTER TABLE law_enforcement_requests ADD COLUMN reviewed_at DATETIME DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'rejection_reason',
        `ALTER TABLE law_enforcement_requests ADD COLUMN rejection_reason TEXT DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'cancel_reason',
        `ALTER TABLE law_enforcement_requests ADD COLUMN cancel_reason TEXT DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'assigned_police_id',
        `ALTER TABLE law_enforcement_requests ADD COLUMN assigned_police_id BIGINT UNSIGNED DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'admin_id',
        `ALTER TABLE law_enforcement_requests ADD COLUMN admin_id BIGINT UNSIGNED DEFAULT NULL`
      );
      await addColumnIfMissing(
        'law_enforcement_requests',
        'updated_at',
        `ALTER TABLE law_enforcement_requests ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
      );
      await query(
        `ALTER TABLE law_enforcement_requests
         MODIFY COLUMN status ENUM(
           'PENDING_ADMIN_REVIEW',
           'ASSIGNED_TO_POLICE',
           'ACCEPTED_BY_POLICE',
           'REJECTED_BY_POLICE',
           'RESOLVED',
           'CANCELLED'
         ) NOT NULL DEFAULT 'PENDING_ADMIN_REVIEW'`
      );
      if (!(await hasIndex('law_enforcement_requests', 'idx_law_requests_severity'))) {
        await query(`ALTER TABLE law_enforcement_requests ADD KEY idx_law_requests_severity (severity)`);
      }

      await query(
        `CREATE TABLE IF NOT EXISTS law_enforcement_request_candidates (
          request_id BIGINT UNSIGNED NOT NULL,
          police_id BIGINT UNSIGNED NOT NULL,
          status ENUM('OFFERED','REJECTED','ACCEPTED','EXPIRED') NOT NULL DEFAULT 'OFFERED',
          rejection_reason TEXT DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (request_id, police_id),
          KEY idx_law_candidates_police_status (police_id, status),
          KEY idx_law_candidates_request_status (request_id, status),
          CONSTRAINT fk_law_candidates_request FOREIGN KEY (request_id)
            REFERENCES law_enforcement_requests(id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT fk_law_candidates_police FOREIGN KEY (police_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
    })();
  }
  return schemaReadyPromise;
}

function fullName(prefix) {
  return `TRIM(CONCAT(COALESCE(${prefix}.first_name, ''), ' ', COALESCE(${prefix}.last_name, '')))`;
}

async function findIncidentForRequest(incidentId) {
  const rows = await query(
    `SELECT id, user_id, status, latitude, longitude, address
     FROM incidents
     WHERE id = ?
     LIMIT 1`,
    [incidentId]
  );
  return rows[0] || null;
}

async function isAcceptedVolunteer(incidentId, userId) {
  const rows = await query(
    `SELECT id
     FROM incident_volunteers
     WHERE incident_id = ? AND volunteer_id = ? AND status = 'ACCEPTED'
     LIMIT 1`,
    [incidentId, userId]
  );
  return rows.length > 0;
}

async function findActiveForIncident(incidentId) {
  const rows = await query(
    `SELECT *
     FROM law_enforcement_requests
     WHERE incident_id = ?
       AND status IN (?, ?, ?)
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [incidentId, ...ACTIVE_REQUEST_STATUSES]
  );
  return rows[0] || null;
}

async function getIncidentSummaryContext(incidentId, requesterId) {
  const incidentRows = await query(
    `SELECT
       i.id,
       i.user_id,
       i.volunteer_id,
       i.status,
       i.latitude,
       i.longitude,
       i.address,
       i.created_at,
       i.updated_at,
       i.accepted_at,
       i.user_case_details,
       i.volunteer_case_details,
       i.final_location_snapshot,
       victim.first_name AS victim_first_name,
       victim.last_name AS victim_last_name,
       victim.phone_number AS victim_phone,
       victim.latest_latitude AS victim_latest_latitude,
       victim.latest_longitude AS victim_latest_longitude,
       requester.first_name AS requester_first_name,
       requester.last_name AS requester_last_name,
       requester.phone_number AS requester_phone,
       requester_role.role_name AS requester_role_name,
       requester.latest_latitude AS requester_latest_latitude,
       requester.latest_longitude AS requester_latest_longitude
     FROM incidents i
     JOIN users victim ON victim.id = i.user_id
     JOIN users requester ON requester.id = ?
     JOIN roles requester_role ON requester_role.id = requester.role_id
     WHERE i.id = ?
     LIMIT 1`,
    [requesterId, incidentId]
  );
  const incident = incidentRows[0] || null;
  if (!incident) return null;

  const volunteers = await query(
    `SELECT
       iv.volunteer_id AS id,
       iv.status,
       iv.accepted_at,
       ${fullName('u')} AS name,
       u.phone_number AS phone_number,
       u.latest_latitude,
       u.latest_longitude
     FROM incident_volunteers iv
     JOIN users u ON u.id = iv.volunteer_id
     WHERE iv.incident_id = ?
       AND iv.status IN ('ACCEPTED', 'LEFT', 'REMOVED')
     ORDER BY iv.accepted_at ASC, iv.id ASC`,
    [incidentId]
  );

  const chatMessages = await query(
    `SELECT
       m.id,
       m.content,
       m.message_type,
       m.created_at,
       u.id AS sender_id,
       ${fullName('u')} AS sender_name,
       r.role_name AS sender_role
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     JOIN roles r ON r.id = u.role_id
     WHERE m.incident_id = ?
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 30`,
    [incidentId]
  ).catch(() => []);

  const participantRows = await query(
    `SELECT COUNT(*) AS count
     FROM incident_participants
     WHERE incident_id = ?
       AND left_at IS NULL`,
    [incidentId]
  ).catch(() => [{ count: 0 }]);

  return {
    incident,
    volunteers,
    chatMessages: chatMessages.reverse(),
    responderCount: volunteers.filter((item) => item.status === 'ACCEPTED').length,
    participantCount: Number(participantRows[0]?.count || 0),
  };
}

async function createRequest({ incidentId, requestedByUserId, requestedByRole, requestNote, incidentSummary, severity, severityReason }) {
  const conn = await pool.getConnection();
  const lockName = `law_request_incident_${incidentId}`;
  try {
    const [lockRows] = await conn.query(`SELECT GET_LOCK(?, 5) AS got_lock`, [lockName]);
    if (Number(lockRows?.[0]?.got_lock || 0) !== 1) {
      throw new Error('Could not lock incident police request.');
    }

    const [duplicateRows] = await conn.query(
      `SELECT *
       FROM law_enforcement_requests
       WHERE incident_id = ?
         AND status IN (?, ?, ?)
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [incidentId, ...ACTIVE_REQUEST_STATUSES]
    );
    if (duplicateRows.length) {
      const duplicate = duplicateRows[0];
      if (!duplicate.incident_summary) {
        await conn.query(
          `UPDATE law_enforcement_requests
           SET incident_summary = ?,
               severity = ?,
               severity_reason = ?,
               summary_generated_at = COALESCE(summary_generated_at, NOW())
           WHERE id = ?`,
          [incidentSummary || null, severity || null, severityReason || null, duplicate.id]
        );
        const [updatedRows] = await conn.query(
          `SELECT *
           FROM law_enforcement_requests
           WHERE id = ?
           LIMIT 1`,
          [duplicate.id]
        );
        return { row: updatedRows[0], duplicate: true };
      }
      return { row: duplicate, duplicate: true };
    }

    const [result] = await conn.query(
      `INSERT INTO law_enforcement_requests
         (incident_id, requested_by_user_id, requested_by_role, request_note, incident_summary,
          severity, severity_reason, summary_generated_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'PENDING_ADMIN_REVIEW')`,
      [
        incidentId,
        requestedByUserId,
        requestedByRole,
        requestNote || null,
        incidentSummary || null,
        severity || null,
        severityReason || null,
      ]
    );
    const [createdRows] = await conn.query(
      `SELECT *
       FROM law_enforcement_requests
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );
    return { row: createdRows[0], duplicate: false };
  } finally {
    try {
      await conn.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
    } finally {
      conn.release();
    }
  }
}

async function addSystemMessage(incidentId, senderId, content) {
  const existing = await query(
    `SELECT id
     FROM chat_messages
     WHERE incident_id = ? AND message_type = 'SYSTEM' AND content = ?
     LIMIT 1`,
    [incidentId, content]
  );
  if (existing.length) return false;
  await query(
    `INSERT INTO chat_messages (incident_id, sender_id, content, message_type)
     VALUES (?, ?, ?, 'SYSTEM')`,
    [incidentId, senderId, content]
  );
  return true;
}

async function findById(requestId) {
  const rows = await query(
    `SELECT *
     FROM law_enforcement_requests
     WHERE id = ?
     LIMIT 1`,
    [requestId]
  );
  return rows[0] || null;
}

async function getIncidentStatus(incidentId) {
  const rows = await query(
    `SELECT id, incident_id, status, assigned_police_id, created_at, updated_at
     FROM law_enforcement_requests
     WHERE incident_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [incidentId]
  );
  return rows[0] || null;
}

async function listAdminRequests() {
  return query(
    `SELECT
       ler.id,
       ler.incident_id,
       ler.status,
       ler.requested_by_role,
       ler.request_note,
       ler.incident_summary,
       ler.severity,
       ler.severity_reason,
       ler.summary_generated_at,
       ler.reviewed_by_admin_id,
       ler.reviewed_at,
       ler.rejection_reason,
       ler.cancel_reason,
       ler.created_at,
       ler.updated_at,
       ler.assigned_police_id,
       (
         SELECT COUNT(*)
         FROM law_enforcement_request_candidates lerc_count
         WHERE lerc_count.request_id = ler.id
           AND lerc_count.status = 'OFFERED'
       ) AS assigned_police_count,
       i.status AS incident_status,
       i.address,
       i.latitude,
       i.longitude,
       ${fullName('requester')} AS requester_name,
       ${fullName('victim')} AS victim_name,
       ${fullName('police')} AS assigned_police_name,
       police.phone_number AS assigned_police_phone,
       pp.police_station_or_unit AS assigned_police_unit,
       pp.badge_number AS assigned_police_badge
     FROM law_enforcement_requests ler
     JOIN incidents i ON i.id = ler.incident_id
     JOIN users requester ON requester.id = ler.requested_by_user_id
     JOIN users victim ON victim.id = i.user_id
     LEFT JOIN users police ON police.id = ler.assigned_police_id
     LEFT JOIN police_profiles pp ON pp.user_id = police.id
     ORDER BY
       CASE ler.status
         WHEN 'PENDING_ADMIN_REVIEW' THEN 0
         WHEN 'REJECTED_BY_POLICE' THEN 1
         WHEN 'ASSIGNED_TO_POLICE' THEN 2
         WHEN 'ACCEPTED_BY_POLICE' THEN 3
         ELSE 4
       END,
       ler.updated_at DESC`
  );
}

async function getAdminRequestById(requestId) {
  const rows = await query(
    `SELECT
       ler.id,
       ler.incident_id,
       ler.status,
       ler.requested_by_role,
       ler.request_note,
       ler.incident_summary,
       ler.severity,
       ler.severity_reason,
       ler.summary_generated_at,
       ler.reviewed_by_admin_id,
       ler.reviewed_at,
       ler.rejection_reason,
       ler.cancel_reason,
       ler.created_at,
       ler.updated_at,
       ler.assigned_police_id,
       (
         SELECT COUNT(*)
         FROM law_enforcement_request_candidates lerc_count
         WHERE lerc_count.request_id = ler.id
           AND lerc_count.status = 'OFFERED'
       ) AS assigned_police_count,
       i.status AS incident_status,
       i.address,
       i.latitude,
       i.longitude,
       ${fullName('requester')} AS requester_name,
       ${fullName('victim')} AS victim_name,
       ${fullName('police')} AS assigned_police_name,
       police.phone_number AS assigned_police_phone,
       pp.police_station_or_unit AS assigned_police_unit,
       pp.badge_number AS assigned_police_badge
     FROM law_enforcement_requests ler
     JOIN incidents i ON i.id = ler.incident_id
     JOIN users requester ON requester.id = ler.requested_by_user_id
     JOIN users victim ON victim.id = i.user_id
     LEFT JOIN users police ON police.id = ler.assigned_police_id
     LEFT JOIN police_profiles pp ON pp.user_id = police.id
     WHERE ler.id = ?
     LIMIT 1`,
    [requestId]
  );
  return rows[0] || null;
}

async function markAdminReviewed({ requestId, adminId }) {
  await query(
    `UPDATE law_enforcement_requests
     SET reviewed_by_admin_id = ?,
         reviewed_at = COALESCE(reviewed_at, NOW())
     WHERE id = ?`,
    [adminId, requestId]
  );
}

async function listApprovedPolice() {
  return query(
    `SELECT u.id, ${fullName('u')} AS name, u.phone_number,
            pp.police_station_or_unit, pp.badge_number
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.role_name = 'law_enforcement'
     JOIN police_profiles pp ON pp.user_id = u.id
     WHERE pp.verification_status = 'APPROVED'
     ORDER BY u.first_name ASC, u.last_name ASC`
  );
}

async function findApprovedPolice(policeId) {
  const rows = await query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.role_name = 'law_enforcement'
     JOIN police_profiles pp ON pp.user_id = u.id
     WHERE u.id = ? AND pp.verification_status = 'APPROVED'
     LIMIT 1`,
    [policeId]
  );
  return rows[0] || null;
}

async function assignRequest({ requestId, policeId, adminId }) {
  await query(
    `UPDATE law_enforcement_requests
     SET assigned_police_id = ?, admin_id = ?, status = 'ASSIGNED_TO_POLICE',
         rejection_reason = NULL
     WHERE id = ? AND status IN ('PENDING_ADMIN_REVIEW', 'REJECTED_BY_POLICE')`,
    [policeId, adminId, requestId]
  );
  await expireRequestCandidates(requestId);
  return findById(requestId);
}

async function expireRequestCandidates(requestId) {
  await query(
    `UPDATE law_enforcement_request_candidates
     SET status = 'EXPIRED'
     WHERE request_id = ?
       AND status IN ('OFFERED', 'REJECTED')`,
    [requestId]
  );
}

async function assignRequestToAll({ requestId, adminId }) {
  await query(
    `UPDATE law_enforcement_requests
     SET assigned_police_id = NULL,
         admin_id = ?,
         status = 'ASSIGNED_TO_POLICE',
         rejection_reason = NULL
     WHERE id = ?
       AND status IN ('PENDING_ADMIN_REVIEW', 'REJECTED_BY_POLICE')`,
    [adminId, requestId]
  );
  await expireRequestCandidates(requestId);
  await query(
    `INSERT INTO law_enforcement_request_candidates (request_id, police_id, status, rejection_reason)
     SELECT ?, u.id, 'OFFERED', NULL
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.role_name = 'law_enforcement'
     JOIN police_profiles pp ON pp.user_id = u.id
     WHERE pp.verification_status = 'APPROVED'
     ON DUPLICATE KEY UPDATE
       status = 'OFFERED',
       rejection_reason = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [requestId]
  );
  return findById(requestId);
}

async function cancelRequest({ requestId, adminId, reason }) {
  await query(
    `UPDATE law_enforcement_requests
     SET admin_id = ?,
         status = 'CANCELLED',
         cancel_reason = ?
     WHERE id = ?
       AND status IN ('PENDING_ADMIN_REVIEW', 'REJECTED_BY_POLICE', 'ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE')`,
    [adminId, reason || null, requestId]
  );
  await expireRequestCandidates(requestId);
  return findById(requestId);
}

async function listPoliceTasks(policeId) {
  return query(
    `SELECT
       ler.id,
       ler.incident_id,
       ler.status,
       ler.request_note,
       ler.rejection_reason,
       ler.created_at,
       ler.updated_at,
       i.status AS incident_status,
       i.address,
       i.latitude,
       i.longitude,
       victim.latest_latitude AS victim_latest_latitude,
       victim.latest_longitude AS victim_latest_longitude,
       ${fullName('victim')} AS victim_name
     FROM law_enforcement_requests ler
     JOIN incidents i ON i.id = ler.incident_id
     JOIN users victim ON victim.id = i.user_id
     LEFT JOIN law_enforcement_request_candidates lerc
       ON lerc.request_id = ler.id
      AND lerc.police_id = ?
     WHERE (
       (
           ler.assigned_police_id = ?
           AND ler.status IN ('ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE')
         )
         OR (
           ler.assigned_police_id IS NULL
           AND ler.status = 'ASSIGNED_TO_POLICE'
           AND lerc.status = 'OFFERED'
         )
       )
       AND UPPER(TRIM(i.status)) IN ('ACTIVE', 'IN_PROGRESS', 'LIVE')
     ORDER BY ler.updated_at DESC`,
    [policeId, policeId]
  );
}

async function findOfferedCandidate(requestId, policeId) {
  const rows = await query(
    `SELECT *
     FROM law_enforcement_request_candidates
     WHERE request_id = ?
       AND police_id = ?
       AND status = 'OFFERED'
     LIMIT 1`,
    [requestId, policeId]
  );
  return rows[0] || null;
}

async function acceptCandidateTask({ requestId, policeId }) {
  await query(
    `UPDATE law_enforcement_requests
     SET assigned_police_id = ?,
         status = 'ACCEPTED_BY_POLICE',
         rejection_reason = NULL
     WHERE id = ?
       AND assigned_police_id IS NULL
       AND status = 'ASSIGNED_TO_POLICE'`,
    [policeId, requestId]
  );
  const updated = await findById(requestId);
  if (!updated || Number(updated.assigned_police_id) !== Number(policeId) || updated.status !== 'ACCEPTED_BY_POLICE') {
    return null;
  }
  await query(
    `UPDATE law_enforcement_request_candidates
     SET status = CASE WHEN police_id = ? THEN 'ACCEPTED' ELSE 'EXPIRED' END
     WHERE request_id = ?
       AND status = 'OFFERED'`,
    [policeId, requestId]
  );
  return updated;
}

async function rejectCandidateTask({ requestId, policeId, reason }) {
  await query(
    `UPDATE law_enforcement_request_candidates
     SET status = 'REJECTED',
         rejection_reason = ?
     WHERE request_id = ?
       AND police_id = ?
       AND status = 'OFFERED'`,
    [reason || null, requestId, policeId]
  );
  const remaining = await query(
    `SELECT COUNT(*) AS count
     FROM law_enforcement_request_candidates
     WHERE request_id = ?
       AND status = 'OFFERED'`,
    [requestId]
  );
  if (Number(remaining[0]?.count || 0) === 0) {
    await query(
      `UPDATE law_enforcement_requests
       SET status = 'REJECTED_BY_POLICE',
           rejection_reason = ?
       WHERE id = ?
         AND assigned_police_id IS NULL
         AND status = 'ASSIGNED_TO_POLICE'`,
      [reason || 'All assigned police rejected this request.', requestId]
    );
  }
  return findById(requestId);
}

async function updatePoliceTask({ requestId, policeId, fromStatus, toStatus, reason }) {
  const reasonSql = toStatus === 'REJECTED_BY_POLICE' ? ', rejection_reason = ?' : '';
  const params = reasonSql
    ? [toStatus, reason || null, requestId, policeId, fromStatus]
    : [toStatus, requestId, policeId, fromStatus];
  await query(
    `UPDATE law_enforcement_requests
     SET status = ?${reasonSql}
     WHERE id = ? AND assigned_police_id = ? AND status = ?`,
    params
  );
  return findById(requestId);
}

async function closeRequestsForIncident({ incidentId, status, reason }) {
  await query(
    `UPDATE law_enforcement_requests
     SET status = ?,
         cancel_reason = CASE WHEN ? = 'CANCELLED' THEN COALESCE(?, cancel_reason) ELSE cancel_reason END
     WHERE incident_id = ?
       AND status IN ('PENDING_ADMIN_REVIEW', 'ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE', 'REJECTED_BY_POLICE')`,
    [status, status, reason || null, incidentId]
  );
  await query(
    `UPDATE law_enforcement_request_candidates lerc
     JOIN law_enforcement_requests ler ON ler.id = lerc.request_id
     SET lerc.status = 'EXPIRED'
     WHERE ler.incident_id = ?
       AND lerc.status IN ('OFFERED', 'REJECTED')`,
    [incidentId]
  );
}

async function getPoliceProfile(userId) {
  const rows = await query(
    `SELECT verification_status, rejection_reason
     FROM police_profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = {
  ensureLawSchema,
  findIncidentForRequest,
  isAcceptedVolunteer,
  findActiveForIncident,
  getIncidentSummaryContext,
  createRequest,
  addSystemMessage,
  findById,
  getIncidentStatus,
  listAdminRequests,
  getAdminRequestById,
  markAdminReviewed,
  listApprovedPolice,
  findApprovedPolice,
  assignRequest,
  assignRequestToAll,
  cancelRequest,
  listPoliceTasks,
  findOfferedCandidate,
  acceptCandidateTask,
  rejectCandidateTask,
  updatePoliceTask,
  closeRequestsForIncident,
  getPoliceProfile,
};

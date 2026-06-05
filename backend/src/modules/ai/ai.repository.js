const { query } = require('../../config/db');
const { ensureVolunteerDispatchSchema } = require('../incidents/incident.repository');

async function findIncidentForAi(incidentId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT
       i.id,
       i.user_id,
       i.volunteer_id,
       i.latitude,
       i.longitude,
       i.address,
       i.status,
       i.created_at,
       i.updated_at,
       i.accepted_at,
       i.volunteer_case_details,
       i.user_case_details,
       u.first_name AS victim_first_name,
       u.last_name AS victim_last_name,
       r.role_name AS victim_role,
       (SELECT COUNT(*)
        FROM incident_volunteers ivc
        WHERE ivc.incident_id = i.id AND ivc.status = 'ACCEPTED') AS responder_count,
       (SELECT COUNT(*)
        FROM incident_participants ipc
        WHERE ipc.incident_id = i.id AND ipc.left_at IS NULL) AS participant_count
     FROM incidents i
     JOIN users u ON u.id = i.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE i.id = ?
     LIMIT 1`,
    [incidentId]
  );
  return rows[0] || null;
}

async function canAccessIncident(incidentId, user) {
  await ensureVolunteerDispatchSchema();
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return true;

  if (role !== 'volunteer') {
    const rows = await query(
      `SELECT id
       FROM incidents
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [incidentId, user.id]
    );
    return rows.length > 0;
  }

  const rows = await query(
    `SELECT i.id
     FROM incidents i
     LEFT JOIN incident_volunteers iv
       ON iv.incident_id = i.id
      AND iv.volunteer_id = ?
      AND iv.status = 'ACCEPTED'
     LEFT JOIN incident_participants ip
       ON ip.incident_id = i.id
      AND ip.user_id = ?
      AND ip.left_at IS NULL
      AND ip.deleted_for_user_at IS NULL
     WHERE i.id = ?
       AND (
         i.user_id = ?
         OR iv.id IS NOT NULL
         OR ip.id IS NOT NULL
       )
     LIMIT 1`,
    [user.id, user.id, incidentId, user.id]
  );
  return rows.length > 0;
}

async function listAccessibleIncidents(user) {
  await ensureVolunteerDispatchSchema();
  const role = String(user?.role || '').toLowerCase();

  if (role === 'admin') {
    return query(
      `SELECT DISTINCT
         i.id,
         i.user_id,
         i.latitude,
         i.longitude,
         i.address,
         i.status,
         i.created_at,
         i.updated_at,
         i.accepted_at
       FROM incidents i
       WHERE i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
       ORDER BY i.created_at DESC, i.id DESC`
    );
  }

  if (role !== 'volunteer') {
    return query(
      `SELECT DISTINCT
         i.id,
         i.user_id,
         i.latitude,
         i.longitude,
         i.address,
         i.status,
         i.created_at,
         i.updated_at,
         i.accepted_at
       FROM incidents i
       WHERE i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
         AND i.user_id = ?
       ORDER BY i.created_at DESC, i.id DESC`,
      [user.id]
    );
  }

  return query(
    `SELECT DISTINCT
       i.id,
       i.user_id,
       i.latitude,
       i.longitude,
       i.address,
       i.status,
       i.created_at,
       i.updated_at,
       i.accepted_at
     FROM incidents i
     LEFT JOIN incident_volunteers iv
       ON iv.incident_id = i.id
      AND iv.volunteer_id = ?
      AND iv.status = 'ACCEPTED'
     LEFT JOIN incident_participants ip
       ON ip.incident_id = i.id
      AND ip.user_id = ?
      AND ip.left_at IS NULL
      AND ip.deleted_for_user_at IS NULL
     WHERE i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
       AND (
         i.user_id = ?
         OR iv.id IS NOT NULL
         OR ip.id IS NOT NULL
       )
     ORDER BY i.created_at DESC, i.id DESC`,
    [user.id, user.id, user.id]
  );
}

async function getIncidentMessagesForAi(incidentId, limit = 80) {
  const safeLimit = Math.min(Math.max(Number(limit) || 80, 1), 80);
  return query(
    `SELECT *
     FROM (
       SELECT
         m.id,
         m.incident_id,
         m.content,
         m.message_type,
         m.created_at,
         u.id AS sender_id,
         u.first_name,
         u.last_name,
         r.role_name
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE m.incident_id = ?
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${safeLimit}
     ) recent_messages
     ORDER BY recent_messages.created_at ASC, recent_messages.id ASC`,
    [incidentId]
  );
}

async function getRespondersForAi(incidentId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       r.role_name,
       iv.accepted_at,
       iv.status
     FROM incident_volunteers iv
     JOIN users u ON u.id = iv.volunteer_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE iv.incident_id = ?
       AND iv.status = 'ACCEPTED'
     ORDER BY iv.accepted_at ASC, iv.id ASC`,
    [incidentId]
  );
}

async function getParticipantsForAi(incidentId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       r.role_name,
       ip.joined_at,
       ip.left_at
     FROM incident_participants ip
     JOIN users u ON u.id = ip.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE ip.incident_id = ?
       AND ip.deleted_for_user_at IS NULL
     ORDER BY ip.joined_at ASC, ip.id ASC`,
    [incidentId]
  );
}

async function canVolunteerRespondToIncident(incidentId, user) {
  await ensureVolunteerDispatchSchema();
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (role !== 'volunteer') return false;

  const rows = await query(
    `SELECT i.id
     FROM incidents i
     LEFT JOIN incident_volunteers iv
       ON iv.incident_id = i.id
      AND iv.volunteer_id = ?
      AND iv.status = 'ACCEPTED'
     LEFT JOIN incident_participants ip
       ON ip.incident_id = i.id
      AND ip.user_id = ?
      AND ip.left_at IS NULL
      AND ip.deleted_for_user_at IS NULL
     WHERE i.id = ?
       AND (
         iv.id IS NOT NULL
         OR ip.id IS NOT NULL
       )
     LIMIT 1`,
    [user.id, user.id, incidentId]
  );
  return rows.length > 0;
}

module.exports = {
  findIncidentForAi,
  canAccessIncident,
  canVolunteerRespondToIncident,
  listAccessibleIncidents,
  getIncidentMessagesForAi,
  getRespondersForAi,
  getParticipantsForAi,
};

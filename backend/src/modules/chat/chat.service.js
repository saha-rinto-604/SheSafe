const { httpError } = require('../../utils/httpError');
const { findIncidentById, isIncidentMember, getIncidentParticipantState } = require('../incidents/incident.repository');
const {
  joinIncident,
  getParticipants,
  insertMessage,
  getMessages,
  getActiveIncidents,
  getAssistedChats,
  archiveForUser,
  leaveForUser,
} = require('./chat.repository');

function formatMessage(row) {
  const isSystem = row.message_type === 'SYSTEM';
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    sender: {
      id: isSystem ? 'system' : String(row.sender_id),
      name: isSystem ? '' : `${row.first_name} ${row.last_name}`.trim(),
      role: isSystem ? 'USER' : normalizeRole(row.role_name),
      photoUrl: isSystem ? undefined : row.photo_url || undefined,
    },
    content: row.content,
    type: row.message_type,
    mediaUrl: row.media_url || undefined,
    timestamp: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  };
}

function normalizeRole(dbRole) {
  const map = { standard_user: 'USER', volunteer: 'VOLUNTEER', law_enforcement: 'POLICE' };
  return map[dbRole] || 'USER';
}

function formatIncident(r) {
  return {
    id: String(r.id),
    type: 'SOS Alert',
    status: r.status,
    location: {
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      updatedAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    },
    address: r.address || null,
    reporter: `${r.first_name} ${r.last_name}`.trim(),
    reporterPhotoUrl: r.photo_url || null,
    participantCount: Number(r.participant_count),
    latestMessage: r.latest_message || null,
    acceptedAt: r.accepted_at
      ? (r.accepted_at instanceof Date ? r.accepted_at.toISOString() : String(r.accepted_at))
      : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

async function ensureAccess(userId, incidentId, role) {
  if (!userId) return;
  if (role === 'admin') return;
  const allowed = await isIncidentMember(incidentId, userId);
  if (!allowed) throw httpError(403, 'You are not a member of this incident chat.');
  const participant = await getIncidentParticipantState(incidentId, userId);
  if (participant?.left_at) throw httpError(403, 'You have left this incident chat.');
}

async function fetchMessages(incidentId, userId, role) {
  await ensureAccess(userId, incidentId, role);
  const rows = await getMessages(incidentId);
  return rows.map(formatMessage);
}

async function sendMessage(userId, incidentId, payload, role) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (incident.status === 'CANCELLED') throw httpError(400, 'Cannot send messages to a cancelled incident.');
  await ensureAccess(userId, incidentId, role);

  const content = String(payload.content || '').trim();
  if (!content) throw httpError(400, 'Message content is required.');

  const messageType = ['TEXT', 'IMAGE', 'AUDIO', 'SYSTEM'].includes(payload.type)
    ? payload.type
    : 'TEXT';

  // Auto-join sender as participant
  await joinIncident(incidentId, userId);

  const row = await insertMessage({
    incidentId,
    senderId: userId,
    content,
    messageType,
    mediaUrl: payload.mediaUrl || null,
  });
  return formatMessage(row);
}

async function join(userId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (incident.status === 'CANCELLED') throw httpError(400, 'Incident is cancelled.');
  await ensureAccess(userId, incidentId);
  await joinIncident(incidentId, userId);
  const participants = await getParticipants(incidentId);
  return participants.map((p) => ({
    id: String(p.id),
    name: `${p.first_name} ${p.last_name}`.trim(),
    role: normalizeRole(p.role_name),
    photoUrl: p.photo_url || null,
  }));
}

async function listActiveIncidents() {
  const rows = await getActiveIncidents();
  return rows.map(formatIncident);
}

/**
 * List incidents the authenticated volunteer has assisted with.
 * Returns the exact same data shape as listActiveIncidents() — frontend parity.
 */
async function listAssistedIncidents(volunteerId) {
  const rows = await getAssistedChats(volunteerId);
  return rows.map(formatIncident);
}

async function archiveForMe(userId, incidentId, { deleted = false } = {}) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  const allowed = await isIncidentMember(incidentId, userId);
  if (!allowed) throw httpError(403, 'You are not a member of this incident chat.');
  await archiveForUser(incidentId, userId, { deleted });
  return { incidentId: String(incidentId), archived: true, deleted };
}

async function leave(userId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  const allowed = await isIncidentMember(incidentId, userId);
  if (!allowed) throw httpError(403, 'You are not a member of this incident chat.');
  const result = await leaveForUser(incidentId, userId);
  return { incidentId: String(incidentId), archived: true, left: true, leftResponder: result.leftResponder };
}

module.exports = {
  fetchMessages,
  sendMessage,
  join,
  listActiveIncidents,
  listAssistedIncidents,
  archiveForMe,
  leave,
};

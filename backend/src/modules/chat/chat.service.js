const { httpError } = require('../../utils/httpError');
const { findIncidentById } = require('../incidents/incident.repository');
const {
  joinIncident,
  getParticipants,
  insertMessage,
  getMessages,
  getActiveIncidents,
} = require('./chat.repository');

function formatMessage(row) {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    sender: {
      id: String(row.sender_id),
      name: `${row.first_name} ${row.last_name}`.trim(),
      role: normalizeRole(row.role_name),
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

async function fetchMessages(incidentId) {
  const rows = await getMessages(incidentId);
  return rows.map(formatMessage);
}

async function sendMessage(userId, incidentId, payload) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (incident.status === 'CANCELLED') throw httpError(400, 'Cannot send messages to a cancelled incident.');

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
  await joinIncident(incidentId, userId);
  const participants = await getParticipants(incidentId);
  return participants.map((p) => ({
    id: String(p.id),
    name: `${p.first_name} ${p.last_name}`.trim(),
    role: normalizeRole(p.role_name),
  }));
}

async function listActiveIncidents() {
  const rows = await getActiveIncidents();
  return rows.map((r) => ({
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
    participantCount: Number(r.participant_count),
    latestMessage: r.latest_message || null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

module.exports = { fetchMessages, sendMessage, join, listActiveIncidents };

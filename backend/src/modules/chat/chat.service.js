const { httpError } = require('../../utils/httpError');
const { uploadBuffer } = require('../../config/cloudinary');
const { findIncidentById, isIncidentMember, getIncidentParticipantState } = require('../incidents/incident.repository');
const {
  joinIncident,
  getParticipants,
  ensureChatSchema,
  insertMessage,
  insertSystemMessageOnce,
  getUserChatIdentity,
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
      username: isSystem ? undefined : row.username || undefined,
      role: isSystem ? 'USER' : normalizeRole(row.role_name),
      photoUrl: isSystem ? undefined : row.photo_url || undefined,
    },
    content: row.content,
    type: row.message_type,
    mediaUrl: row.media_url || undefined,
    mediaPublicId: row.media_public_id || undefined,
    mediaMimeType: row.media_mime_type || undefined,
    mediaFilename: row.media_filename || undefined,
    mediaSizeBytes: row.media_size_bytes == null ? undefined : Number(row.media_size_bytes),
    timestamp: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  };
}

function normalizeRole(dbRole) {
  const map = { standard_user: 'USER', volunteer: 'VOLUNTEER', law_enforcement: 'POLICE' };
  return map[dbRole] || 'USER';
}

function roleDisplayName(roleName) {
  const role = normalizeRole(roleName);
  if (role === 'VOLUNTEER') return 'Volunteer';
  if (role === 'POLICE') return 'Police';
  return 'User';
}

function isPhoneLike(value) {
  const compact = String(value || '').replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(compact);
}

function joinDisplayName(user) {
  const username = String(user?.username || '').trim();
  if (/^[a-z0-9_]{3,30}$/i.test(username)) return username;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  if (fullName && !isPhoneLike(fullName)) return fullName;
  return roleDisplayName(user?.role_name);
}

async function createJoinSystemMessage(userId, incidentId) {
  const user = await getUserChatIdentity(userId);
  const displayName = joinDisplayName(user);
  const systemEventKey = `incident_join:${incidentId}:${userId}`;
  const result = await insertSystemMessageOnce({
    incidentId,
    senderId: userId,
    content: `${displayName} has joined the chat room`,
    systemEventKey,
  });
  return {
    message: result.row ? formatMessage(result.row) : null,
    created: result.created,
  };
}

async function joinAndGetEvent(userId, incidentId, role) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (incident.status === 'CANCELLED') throw httpError(400, 'Incident is cancelled.');
  await ensureAccess(userId, incidentId, role);
  await joinIncident(incidentId, userId);
  const joinEvent = await createJoinSystemMessage(userId, incidentId);
  const participants = await getParticipants(incidentId);
  return {
    participants: participants.map((p) => ({
      id: String(p.id),
      name: `${p.first_name} ${p.last_name}`.trim(),
      username: p.username || undefined,
      role: normalizeRole(p.role_name),
      photoUrl: p.photo_url || null,
    })),
    joinMessage: joinEvent.created ? joinEvent.message : null,
  };
}

function formatIncident(r) {
  const latestActivityAt = r.latest_activity_at
    ? (r.latest_activity_at instanceof Date ? r.latest_activity_at.toISOString() : String(r.latest_activity_at))
    : null;
  const lastMessageAt = r.latest_message_created_at
    ? (r.latest_message_created_at instanceof Date ? r.latest_message_created_at.toISOString() : String(r.latest_message_created_at))
    : null;
  const updatedAt = r.updated_at
    ? (r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at))
    : null;
  return {
    id: String(r.id),
    type: 'SOS Alert',
    status: r.status,
    location: {
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      updatedAt: latestActivityAt || updatedAt || (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)),
    },
    address: r.address || null,
    reporter: `${r.first_name} ${r.last_name}`.trim(),
    reporterPhotoUrl: r.photo_url || null,
    participantCount: Number(r.participant_count),
    latestMessage: r.latest_message || null,
    lastMessageAt,
    latestActivityAt,
    updatedAt,
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
  const rows = await getMessages(incidentId, 100, userId);
  return rows.map(formatMessage);
}

async function sendMessage(userId, incidentId, payload, role) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (incident.status === 'CANCELLED') throw httpError(400, 'Cannot send messages to a cancelled incident.');
  await ensureAccess(userId, incidentId, role);

  const content = String(payload.content ?? payload.text ?? '').trim();
  if (!content) throw httpError(400, 'Message content is required.');

  const messageType = ['TEXT', 'IMAGE', 'AUDIO', 'SYSTEM'].includes(payload.type)
    ? payload.type
    : 'TEXT';

  // Auto-join sender as participant
  await joinIncident(incidentId, userId);
  await createJoinSystemMessage(userId, incidentId);

  const row = await insertMessage({
    incidentId,
    senderId: userId,
    content,
    messageType,
    mediaUrl: payload.mediaUrl || null,
  });
  return formatMessage(row);
}

async function sendImageMessage(userId, incidentId, file, role) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (['CANCELLED', 'RESOLVED'].includes(incident.status)) throw httpError(400, 'This incident chat is read-only.');
  await ensureAccess(userId, incidentId, role);
  if (!file) throw httpError(400, 'Image file is required.');
  if (!String(file.mimetype || '').startsWith('image/')) throw httpError(400, 'Only image uploads are allowed.');
  if (Number(file.size || 0) > 5 * 1024 * 1024) throw httpError(400, 'Image must be 5MB or smaller.');

  await joinIncident(incidentId, userId);
  await createJoinSystemMessage(userId, incidentId);

  const folder = `shesafe/chat-images/${incidentId}`;
  const publicId = `chat_${userId}_${Date.now()}`;
  const { secure_url: secureUrl } = await uploadBuffer(file.buffer, folder, publicId);
  const row = await insertMessage({
    incidentId,
    senderId: userId,
    content: 'Photo',
    messageType: 'IMAGE',
    mediaUrl: secureUrl,
  });
  return formatMessage(row);
}

async function join(userId, incidentId, role) {
  const result = await joinAndGetEvent(userId, incidentId, role);
  return result.participants;
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
  ensureChatSchema,
  sendMessage,
  sendImageMessage,
  join,
  joinAndGetEvent,
  listActiveIncidents,
  listAssistedIncidents,
  archiveForMe,
  leave,
};

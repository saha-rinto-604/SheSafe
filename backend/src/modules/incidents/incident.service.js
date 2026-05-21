const { httpError } = require('../../utils/httpError');
const {
  createIncident,
  getIncidentZones,
  findIncidentById,
  updateIncidentStatus,
  cancelAllByUser,
  getMyIncidents: getMyIncidentsRepo,
  findNearbyVolunteers,
  acceptIncidentAtomic,
  getAssistedByVolunteer,
  getChatsByUser,
  getIncidentResponders,
  isIncidentMember,
  getVolunteerCaseDetails: getVolunteerCaseDetailsRepo,
  updateVolunteerCaseDetails: updateVolunteerCaseDetailsRepo,
  getUserCaseDetails: getUserCaseDetailsRepo,
  updateUserCaseDetails: updateUserCaseDetailsRepo,
  ensureDefaultIncidentMessages,
  setUserOnlineStatus,
  getUnavailableIncidentIdsForVolunteer,
  recordIncidentRejection,
} = require('./incident.repository');
const chatService = require('../chat/chat.service');

/**
 * Report a new incident (triggered by SOS).
 */
async function reportIncident(userId, payload) {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const address = String(payload.address || '').trim() || null;

  if (!isFinite(latitude) || !isFinite(longitude)) {
    throw httpError(400, 'Valid latitude and longitude are required.');
  }
  if (latitude < -90 || latitude > 90) {
    throw httpError(400, 'Latitude must be between -90 and 90.');
  }
  if (longitude < -180 || longitude > 180) {
    throw httpError(400, 'Longitude must be between -180 and 180.');
  }

  const incident = await createIncident({ userId, latitude, longitude, address });
  await ensureDefaultIncidentMessages(incident.id);
  return incident;
}

/**
 * Get all aggregated incident zones (clustered by 500m proximity).
 */
async function getZones() {
  return getIncidentZones();
}

async function getOne(incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  return incident;
}

async function cancelIncident(userId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (Number(incident.user_id) !== Number(userId)) {
    throw httpError(403, 'You can only cancel your own incidents.');
  }
  if (incident.status === 'CANCELLED') return incident;
  return updateIncidentStatus(incidentId, 'CANCELLED');
}

async function resolveIncident(userId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');

  const isVictim = Number(incident.user_id) === Number(userId);
  const isVolunteer = await isIncidentMember(incidentId, userId);

  if (!isVictim && !isVolunteer) {
    throw httpError(403, 'Only the victim or assigned volunteer can resolve this incident.');
  }
  if (incident.status === 'RESOLVED') return incident;
  return updateIncidentStatus(incidentId, 'RESOLVED');
}

async function clearMyHistory(userId) {
  return cancelAllByUser(userId);
}

/**
 * Get all incidents created by the authenticated user.
 * Transforms raw DB rows into the shape expected by the frontend IncidentCard:
 *   { id, incidentNumber, latitude, longitude, location, occurredAt, occurredAtLabel, status }
 *
 * Status mapping:
 *   ACTIVE      → 'Active'      (SOS is on)
 *   IN_PROGRESS → 'In Progress' (volunteer accepted)
 *   RESOLVED    → 'Resolved'    (SOS completed)
 *   CANCELLED   → 'Cancelled'   (user cancelled)
 */
async function getMyIncidents(userId) {
  const rows = await getMyIncidentsRepo(userId);
  return rows.map((row) => {
    const statusMap = {
      ACTIVE: 'Active',
      RESOLVED: 'Resolved',
      CANCELLED: 'Cancelled',
    };
    return {
      id: String(row.id),
      incidentNumber: Number(row.id),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      location: row.address || `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`,
      occurredAt: row.created_at,
      occurredAtLabel: new Date(row.created_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      status: statusMap[row.status] || row.status,
    };
  });
}

// ── Volunteer Dispatch & Accept ─────────────────────────────────────────────

/**
 * Get ACTIVE incidents within 5km of a volunteer's current position.
 */
async function getNearbyIncidents(volunteerId, currentLocation = {}) {
  let userLat = Number(currentLocation.latitude);
  let userLng = Number(currentLocation.longitude);

  if (!isFinite(userLat) || !isFinite(userLng)) {
    // Get volunteer's latest cached position from users table
    const { query: dbQuery } = require('../../config/db');
    const userRows = await dbQuery(
      `SELECT latest_latitude, latest_longitude FROM users WHERE id = ? LIMIT 1`,
      [volunteerId]
    );
    const user = userRows[0];
    if (!user || user.latest_latitude == null || user.latest_longitude == null) {
      throw httpError(400, 'Your location is not available. Please enable location services.');
    }
    userLat = Number(user.latest_latitude);
    userLng = Number(user.latest_longitude);
  }

  // Reuse the Haversine logic but query for incidents instead
  const { getActiveIncidents: getActive } = require('./incident.repository');
  const allActive = await getActive();
  const unavailableRows = await getUnavailableIncidentIdsForVolunteer(volunteerId);
  const unavailableIncidentIds = new Set(unavailableRows.map((row) => String(row.incident_id)));

  const EARTH_R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;

  const nearby = allActive
    .filter((inc) => String(inc.user_id) !== String(volunteerId))
    .filter((inc) => !unavailableIncidentIds.has(String(inc.id)))
    .map((inc) => {
      const lat = Number(inc.latitude);
      const lng = Number(inc.longitude);
      const dLat = toRad(lat - userLat);
      const dLng = toRad(lng - userLng);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(userLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
      const distKm = EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...inc, distanceKm: Math.round(distKm * 10) / 10 };
    })
    .filter((inc) => inc.distanceKm <= 5)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return nearby.map((inc) => ({
    id: String(inc.id),
    creatorUserId: String(inc.user_id),
    creatorRole: String(inc.creator_role || '').toUpperCase(),
    victimName: `${inc.first_name} ${inc.last_name}`.trim(),
    avatarUri: inc.photo_url || null,
    distanceKm: inc.distanceKm,
    locationLabel: inc.address || `${Number(inc.latitude).toFixed(4)}, ${Number(inc.longitude).toFixed(4)}`,
    latitude: Number(inc.latitude),
    longitude: Number(inc.longitude),
    status: inc.status,
    createdAt: inc.created_at instanceof Date ? inc.created_at.toISOString() : String(inc.created_at),
  }));
}

async function getVolunteerNotifications(userId, currentLocation = {}) {
  const notifications = [];
  const seen = new Set();
  const add = (item) => {
    const key = item.id;
    if (seen.has(key)) return;
    seen.add(key);
    notifications.push({
      relatedChatId: item.relatedChatId ?? null,
      read: false,
      ...item,
    });
  };

  try {
    const nearby = await getNearbyIncidents(userId, currentLocation);
    nearby.forEach((incident) => {
      const creatorIsVolunteer = incident.creatorRole === 'VOLUNTEER';
      const isOwnSos = String(incident.creatorUserId) === String(userId);
      add({
        id: `sos-${incident.id}`,
        type: creatorIsVolunteer || isOwnSos ? 'VOLUNTEER_SOS_ALERT' : 'SOS_ALERT',
        title: creatorIsVolunteer || isOwnSos ? 'Volunteer SOS Active' : 'Live SOS Nearby',
        body: `${incident.victimName || 'Someone'} needs help at ${incident.locationLabel}. ${incident.distanceKm.toFixed(1)} km away.`,
        relatedIncidentId: String(incident.id),
        createdAt: incident.createdAt,
      });
    });
  } catch {
    // Location may be unavailable; assisted/owned notifications below should still load.
  }

  const ownIncidents = await getMyIncidents(userId);
  ownIncidents
    .filter((incident) => ['Active', 'IN_PROGRESS', 'ACTIVE'].includes(String(incident.status)))
    .forEach((incident) => {
      add({
        id: `own-sos-${incident.id}`,
        type: 'VOLUNTEER_SOS_ALERT',
        title: 'Your SOS is Active',
        body: `Your emergency SOS at ${incident.location || 'your location'} is active.`,
        relatedIncidentId: String(incident.id),
        createdAt: incident.occurredAt,
      });
    });

  const assisted = await getAssistedIncidents(userId);
  assisted.forEach((incident) => {
    const status = String(incident.status || '').toUpperCase();
    const lastMessage = incident.lastMessage;

    if (status === 'CANCELLED') {
      add({
        id: `cancelled-${incident.id}`,
        type: 'INCIDENT_CANCELLED',
        title: `${incident.incidentCode} Cancelled`,
        body: `${incident.sosUser?.name || 'The SOS creator'} cancelled this incident.`,
        relatedIncidentId: String(incident.id),
        createdAt: incident.updatedAt || incident.createdAt,
      });
    }

    if (status === 'RESOLVED') {
      add({
        id: `resolved-${incident.id}`,
        type: 'INCIDENT_RESOLVED',
        title: `${incident.incidentCode} Resolved`,
        body: `${incident.sosUser?.name || 'The SOS creator'} marked this incident resolved.`,
        relatedIncidentId: String(incident.id),
        createdAt: incident.updatedAt || incident.createdAt,
      });
    }

    if (lastMessage && String(lastMessage.senderId) !== String(userId) && lastMessage.senderRole !== 'system') {
      add({
        id: `message-${incident.id}-${lastMessage.id || lastMessage.createdAt}`,
        type: 'MESSAGE',
        title: `New message in ${incident.incidentCode}`,
        body: `${lastMessage.senderName}: ${lastMessage.text}`,
        relatedIncidentId: String(incident.id),
        relatedChatId: String(incident.id),
        createdAt: lastMessage.createdAt,
      });
    }

    if (Number(incident.responderCount || 0) > 1) {
      add({
        id: `responders-${incident.id}-${incident.responderCount}`,
        type: 'RESPONDER_UPDATE',
        title: `Responders updated for ${incident.incidentCode}`,
        body: `${incident.responderCount}/${incident.maxResponders || 3} responders are assigned to this incident.`,
        relatedIncidentId: String(incident.id),
        relatedChatId: String(incident.id),
        createdAt: incident.updatedAt || incident.createdAt,
      });
    }
  });

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Volunteer accepts an incident — atomic transaction.
 * 1. Validates the incident is ACTIVE via SELECT FOR UPDATE
 * 2. Locks the row to prevent double-claims
 * 3. Creates chat participants for both victim and volunteer
 */
async function acceptIncident(volunteerId, incidentId) {
  const result = await acceptIncidentAtomic(incidentId, volunteerId);

  if (!result.success) {
    if (result.reason === 'NOT_FOUND') {
      throw httpError(404, 'Incident not found.');
    }
    if (result.reason === 'CLOSED') {
      throw httpError(409, 'This incident is no longer active.');
    }
    if (result.reason === 'MAX_RESPONDERS_EXCEEDED') {
      throw httpError(409, 'Maximum responders exceeded for this incident.', {
        code: 'MAX_RESPONDERS_EXCEEDED',
        maxResponders: result.maxResponders || 3,
      });
    }
    throw httpError(500, 'Failed to accept incident.');
  }

  // Fetch the full incident details for the response
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(500, 'Incident accepted but retrieval failed.');

  return {
    incident: {
      id: String(incident.id),
      status: incident.status,
      victimName: `${incident.first_name} ${incident.last_name}`.trim(),
      latitude: Number(incident.latitude),
      longitude: Number(incident.longitude),
      address: incident.address || null,
      acceptedAt: incident.accepted_at,
    },
    chatRoom: {
      incidentId: String(incident.id),
      victimUserId: result.victimUserId,
      volunteerId: result.volunteerId,
    },
    responders: await getResponders(incidentId),
  };
}

/**
 * Volunteer rejects/declines an incident — no DB state change needed,
 * just returns acknowledgment. The incident remains ACTIVE for other
 * volunteers to claim.
 */
async function rejectIncident(volunteerId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  await recordIncidentRejection(incidentId, volunteerId);
  if (incident.status !== 'ACTIVE') {
    return { incidentId: String(incidentId), rejected: true, stale: true };
  }
  return { incidentId: String(incidentId), rejected: true };
}

/**
 * Get the list of incidents a volunteer has assisted with.
 * Returns the same shape as listActiveIncidents() for frontend parity.
 */
function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function normalizeRole(dbRole) {
  const map = {
    standard_user: 'standard_user',
    volunteer: 'volunteer',
    law_enforcement: 'law_enforcement',
    system: 'system',
  };
  return map[dbRole] || dbRole || 'standard_user';
}

function formatLatestMessage(row) {
  if (!row.latest_message_id) return null;
  const isSystem = row.latest_message_type === 'SYSTEM';
  return {
    id: String(row.latest_message_id),
    senderId: isSystem ? 'system' : String(row.latest_sender_id),
    senderName: isSystem ? 'System' : userName(row, 'latest_sender_first_name', 'latest_sender_last_name'),
    senderRole: isSystem ? 'system' : normalizeRole(row.latest_sender_role),
    text: row.latest_message,
    createdAt: iso(row.latest_message_created_at),
  };
}

function userName(row, firstKey = 'first_name', lastKey = 'last_name') {
  return [row[firstKey], row[lastKey]].filter(Boolean).join(' ').trim() || 'Unknown User';
}

function formatResponder(row) {
  return {
    id: String(row.id),
    name: userName(row),
    photoUri: row.photo_url || null,
    role: 'volunteer',
    acceptedAt: iso(row.accepted_at),
  };
}

function formatSosUser(row) {
  return {
    id: String(row.user_id),
    name: userName(row),
    photoUri: row.photo_url || null,
    role: 'standard_user',
  };
}

async function getResponders(incidentId, userId, role) {
  if (userId && role !== 'admin') {
    const allowed = await isIncidentMember(incidentId, userId);
    if (!allowed) throw httpError(403, 'You are not a member of this incident chat.');
  }
  const data = await getIncidentResponders(incidentId);
  if (!data.incident) throw httpError(404, 'Incident not found.');

  const sosUser = {
    id: String(data.incident.user_id),
    name: userName(data.incident),
    photoUri: data.incident.photo_url || null,
    role: 'standard_user',
  };
  const volunteers = data.volunteers.map(formatResponder);
  return {
    incidentId: Number(incidentId),
    sosUser,
    volunteers,
    totalMembers: volunteers.length + 1,
    maxVolunteerResponders: 3,
  };
}

async function getAssistedIncidents(volunteerId, search = '') {
  const rows = await getAssistedByVolunteer(volunteerId);
  const incidents = await Promise.all(rows.map(async (r) => {
    const responders = await getResponders(r.id);
    const createdAt = iso(r.created_at);
    const updatedAt = iso(r.latest_activity_at || r.updated_at || r.created_at);
    const latestMessage = formatLatestMessage(r);

    return {
      id: Number(r.id),
      incidentCode: `Incident #${r.id}`,
      type: 'SOS Alert',
      status: r.status === 'IN_PROGRESS' ? 'ACTIVE' : r.status,
      priority: ['ACTIVE', 'IN_PROGRESS'].includes(r.status) ? 'HIGH' : 'NORMAL',
      createdAt,
      updatedAt,
      location: {
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        updatedAt,
      },
      address: r.address || null,
      reporter: userName(r),
      reporterPhotoUrl: r.photo_url || null,
      lastMessage: latestMessage,
      latestMessage: latestMessage ? {
        content: latestMessage.text,
        sender: {
          id: latestMessage.senderId,
          name: latestMessage.senderName,
          role: latestMessage.senderRole === 'volunteer' ? 'VOLUNTEER' : 'USER',
        },
        timestamp: latestMessage.createdAt,
        type: 'TEXT',
      } : null,
      sosUser: responders.sosUser,
      responders: responders.volunteers,
      responderCount: responders.volunteers.length,
      maxResponders: 3,
      participantCount: responders.totalMembers,
      acceptedAt: iso(r.accepted_at),
    };
  }));

  const cleanSearch = String(search || '').trim().toLowerCase();
  if (!cleanSearch) return incidents;

  const idNeedle = cleanSearch.replace(/^incident\s*/i, '').replace('#', '').replace(/\D/g, '');
  return incidents.filter((incident) => {
    const idText = String(incident.id);
    const responderNames = incident.responders.map((r) => r.name.toLowerCase()).join(' ');
    return (
      (idNeedle && idText.includes(idNeedle)) ||
      incident.incidentCode.toLowerCase().includes(cleanSearch) ||
      incident.sosUser.name.toLowerCase().includes(cleanSearch) ||
      responderNames.includes(cleanSearch)
    );
  });
}

async function getUserIncidentChats(userId, search = '', role) {
  const rows = await getChatsByUser(userId);
  const incidents = await Promise.all(rows.map(async (r) => {
    const responders = await getResponders(r.id, userId, role);
    const createdAt = iso(r.created_at);
    const updatedAt = iso(r.latest_activity_at || r.updated_at || r.created_at);
    const latestMessage = formatLatestMessage(r);

    return {
      id: Number(r.id),
      incidentCode: `Incident #${r.id}`,
      status: r.status === 'IN_PROGRESS' ? 'ACTIVE' : r.status,
      priority: ['ACTIVE', 'IN_PROGRESS'].includes(r.status) ? 'HIGH' : 'NORMAL',
      createdAt,
      updatedAt,
      lastMessage: latestMessage,
      sosUser: responders.sosUser,
      responders: responders.volunteers,
      responderCount: responders.volunteers.length,
      maxResponders: 3,
    };
  }));

  const cleanSearch = String(search || '').trim().toLowerCase();
  if (!cleanSearch) return incidents;

  const idNeedle = cleanSearch.replace(/^incident\s*/i, '').replace('#', '').replace(/\D/g, '');
  return incidents.filter((incident) => {
    const responderNames = incident.responders.map((r) => r.name.toLowerCase()).join(' ');
    return (
      (idNeedle && String(incident.id).includes(idNeedle)) ||
      incident.incidentCode.toLowerCase().includes(cleanSearch) ||
      responderNames.includes(cleanSearch)
    );
  });
}

async function ensureChatAccess(userId, incidentId, role) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (role === 'admin') return incident;
  const allowed = await isIncidentMember(incidentId, userId);
  if (!allowed) {
    throw httpError(403, 'You are not a member of this incident chat.');
  }
  return incident;
}

async function getIncidentMessages(userId, incidentId, role) {
  await ensureChatAccess(userId, incidentId, role);
  await ensureDefaultIncidentMessages(incidentId);
  const messages = await chatService.fetchMessages(incidentId, userId, role);
  return messages.map((message) => ({
    id: message.id,
    incidentId: Number(message.incidentId),
    senderId: message.type === 'SYSTEM' ? 'system' : message.sender.id,
    senderName: message.type === 'SYSTEM' ? 'System' : message.sender.name,
    senderRole: message.type === 'SYSTEM'
      ? 'system'
      : message.sender.role === 'VOLUNTEER'
      ? 'volunteer'
      : message.sender.role === 'POLICE'
        ? 'law_enforcement'
        : 'standard_user',
    senderPhotoUri: message.type === 'SYSTEM' ? null : (message.sender.photoUrl || null),
    text: message.content,
    createdAt: message.timestamp,
  }));
}

async function sendIncidentMessage(userId, incidentId, payload, role) {
  const incident = await ensureChatAccess(userId, incidentId, role);
  if (['CANCELLED', 'RESOLVED'].includes(incident.status)) throw httpError(400, 'This incident chat is read-only.');
  const message = await chatService.sendMessage(userId, incidentId, payload, role);
  return {
    id: message.id,
    incidentId: Number(message.incidentId),
    senderId: message.sender.id,
    senderName: message.sender.name,
    senderRole: message.sender.role === 'VOLUNTEER'
      ? 'volunteer'
      : message.sender.role === 'POLICE'
        ? 'law_enforcement'
        : 'standard_user',
    senderPhotoUri: message.sender.photoUrl || null,
    text: message.content,
    createdAt: message.timestamp,
  };
}

async function getUserCaseDetails(userId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (Number(incident.user_id) !== Number(userId)) {
    throw httpError(403, 'Only the SOS creator can view user case details.');
  }
  return {
    incidentId: Number(incidentId),
    details: await getUserCaseDetailsRepo(incidentId),
  };
}

async function updateUserCaseDetails(userId, incidentId, payload) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (Number(incident.user_id) !== Number(userId)) {
    throw httpError(403, 'Only the SOS creator can edit user case details.');
  }

  const details = {
    notes: String(payload.notes || '').trim(),
    condition: String(payload.condition || '').trim(),
    additionalInfo: String(payload.additionalInfo || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  return {
    incidentId: Number(incidentId),
    details: await updateUserCaseDetailsRepo(incidentId, details),
  };
}

async function getVolunteerCaseDetails(userId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  const allowed = await isIncidentMember(incidentId, userId);
  const isVictim = Number(incident.user_id) === Number(userId);
  if (!allowed || isVictim) throw httpError(403, 'Only accepted volunteers can view their case details.');
  return {
    incidentId: Number(incidentId),
    details: await getVolunteerCaseDetailsRepo(incidentId, userId),
  };
}

async function updateVolunteerCaseDetails(userId, incidentId, payload) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  const allowed = await isIncidentMember(incidentId, userId);
  const isVictim = Number(incident.user_id) === Number(userId);
  if (!allowed || isVictim) throw httpError(403, 'Only accepted volunteers can edit their case details.');

  const details = {
    notes: String(payload.notes || '').trim(),
    condition: String(payload.condition || '').trim(),
    actionsTaken: String(payload.actionsTaken || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  return {
    incidentId: Number(incidentId),
    details: await updateVolunteerCaseDetailsRepo(incidentId, userId, details),
  };
}

/**
 * Toggle volunteer online status.
 */
async function updateOnlineStatus(userId, isOnline) {
  await setUserOnlineStatus(userId, isOnline);
  return { isOnline };
}

/**
 * Dispatch notification: find nearby volunteers for a given incident.
 * Called internally after reportIncident() to populate dispatch list.
 */
async function getDispatchList(incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) return [];
  const volunteers = await findNearbyVolunteers(
    Number(incident.latitude),
    Number(incident.longitude)
  );
  return volunteers.map((v) => ({
    userId: String(v.user_id),
    name: `${v.first_name} ${v.last_name}`.trim(),
    photoUrl: v.photo_url || null,
    distanceKm: Math.round(Number(v.distance_km) * 10) / 10,
  }));
}

module.exports = {
  reportIncident,
  getZones,
  getOne,
  cancelIncident,
  resolveIncident,
  clearMyHistory,
  getMyIncidents,
  getNearbyIncidents,
  acceptIncident,
  rejectIncident,
  getAssistedIncidents,
  getVolunteerNotifications,
  getUserIncidentChats,
  getResponders,
  getIncidentMessages,
  sendIncidentMessage,
  getUserCaseDetails,
  updateUserCaseDetails,
  getVolunteerCaseDetails,
  updateVolunteerCaseDetails,
  updateOnlineStatus,
  getDispatchList,
};

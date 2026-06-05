const { httpError } = require('../../utils/httpError');
const {
  createIncident,
  getIncidentZones,
  findIncidentById,
  updateIncidentStatus,
  cancelAllByUser,
  getMyIncidents: getMyIncidentsRepo,
  getMyActiveSos: getMyActiveSosRepo,
  findNearbyVolunteers,
  acceptIncidentAtomic,
  getAssistedByVolunteer,
  getChatsByUser,
  getIncidentResponders,
  getIncidentRouteContext,
  getUserRouteLocation,
  saveFinalLocationSnapshotIfMissing,
  getFinalLocationSnapshot,
  buildIncidentLocationSnapshot,
  isIncidentMember,
  getVolunteerCaseDetails: getVolunteerCaseDetailsRepo,
  updateVolunteerCaseDetails: updateVolunteerCaseDetailsRepo,
  getUserCaseDetails: getUserCaseDetailsRepo,
  updateUserCaseDetails: updateUserCaseDetailsRepo,
  createIncidentReview,
  getVolunteerActivityLogs,
  getVolunteerLeaderboardRows,
  getVolunteerSummary,
  ensureDefaultIncidentMessages,
  setUserOnlineStatus,
  getUnavailableIncidentIdsForVolunteer,
  recordIncidentRejection,
  getIncidentParticipantState,
  leaveActiveAssistedIncidentsForVolunteer,
} = require('./incident.repository');
const chatService = require('../chat/chat.service');
const { getParticipants } = require('../chat/chat.repository');

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

  const existingActiveSos = await getMyActiveSosRepo(userId);
  if (existingActiveSos) {
    throw httpError(409, 'You already have an active SOS.', {
      code: 'ACTIVE_SOS_EXISTS',
      incidentId: String(existingActiveSos.id),
    });
  }

  const incident = await createIncident({ userId, latitude, longitude, address });
  await ensureDefaultIncidentMessages(incident.id);
  if (String(payload.sourceRole || '').toLowerCase() === 'volunteer') {
    await leaveActiveAssistedIncidentsForVolunteer(userId);
  }
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
  if (incident.status === 'CANCELLED') {
    await saveFinalLocationSnapshotIfMissing(incidentId, 'CANCELLED');
    return findIncidentById(incidentId);
  }
  const updated = await updateIncidentStatus(incidentId, 'CANCELLED');
  await saveFinalLocationSnapshotIfMissing(incidentId, 'CANCELLED');
  return updated;
}

async function resolveIncident(userId, incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');

  const isVictim = Number(incident.user_id) === Number(userId);
  const isVolunteer = await isIncidentMember(incidentId, userId);

  if (!isVictim && !isVolunteer) {
    throw httpError(403, 'Only the victim or assigned volunteer can resolve this incident.');
  }
  if (incident.status === 'RESOLVED') {
    await saveFinalLocationSnapshotIfMissing(incidentId, 'RESOLVED');
    return findIncidentById(incidentId);
  }
  const updated = await updateIncidentStatus(incidentId, 'RESOLVED');
  await saveFinalLocationSnapshotIfMissing(incidentId, 'RESOLVED');
  return updated;
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
      IN_PROGRESS: 'In Progress',
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
  const { query: dbQuery } = require('../../config/db');
  const preferenceRows = await dbQuery(
    `SELECT accept_sos_requests FROM users WHERE id = ? LIMIT 1`,
    [volunteerId]
  );
  if (preferenceRows[0]?.accept_sos_requests === 0 || preferenceRows[0]?.accept_sos_requests === false) {
    return [];
  }

  let userLat = Number(currentLocation.latitude);
  let userLng = Number(currentLocation.longitude);

  if (!isFinite(userLat) || !isFinite(userLng)) {
    // Get volunteer's latest cached position from users table
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
        body: `${lastMessage.senderNotificationName || lastMessage.senderName || 'Someone'} sent you a message`,
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
    if (result.reason === 'OWN_INCIDENT') {
      throw httpError(409, 'You cannot accept your own SOS.');
    }
    if (result.reason === 'OWN_SOS_ACTIVE') {
      throw httpError(409, 'You cannot accept incidents while your own SOS is active.');
    }
    if (result.reason === 'MAX_RESPONDERS_EXCEEDED') {
      throw httpError(409, 'Maximum responders exceeded for this incident.', {
        code: 'MAX_RESPONDERS_EXCEEDED',
        maxResponders: result.maxResponders || 3,
      });
    }
    if (result.reason === 'PREVIOUSLY_LEFT') {
      throw httpError(409, 'You have already left this incident.');
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
    senderName: isSystem ? '' : userName(row, 'latest_sender_first_name', 'latest_sender_last_name'),
    senderUsername: isSystem ? '' : (row.latest_sender_username || ''),
    senderNotificationName: isSystem ? '' : notificationIdentityFromRow(row, {
      usernameKey: 'latest_sender_username',
      firstKey: 'latest_sender_first_name',
      lastKey: 'latest_sender_last_name',
      roleKey: 'latest_sender_role',
    }),
    senderRole: isSystem ? 'system' : normalizeRole(row.latest_sender_role),
    text: row.latest_message,
    createdAt: iso(row.latest_message_created_at),
  };
}

function mapOwnActiveSos(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    incidentId: String(row.id),
    incidentNumber: Number(row.id),
    incidentCode: `#${row.id}`,
    status: row.status,
    isLive: ['ACTIVE', 'IN_PROGRESS', 'LIVE'].includes(String(row.status || '').toUpperCase()),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    address: row.address || null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at || row.created_at),
  };
}

async function getMyActiveSos(userId) {
  return mapOwnActiveSos(await getMyActiveSosRepo(userId));
}

function userName(row, firstKey = 'first_name', lastKey = 'last_name') {
  return [row[firstKey], row[lastKey]].filter(Boolean).join(' ').trim() || 'Unknown User';
}

function notificationIdentityFromRow(row, { usernameKey = 'username', firstKey = 'first_name', lastKey = 'last_name', roleKey = 'role_name' } = {}) {
  const username = String(row?.[usernameKey] || '').trim().toLowerCase();
  if (/^[a-z0-9_]{3,30}$/.test(username)) return `@${username}`;
  const fullName = [row?.[firstKey], row?.[lastKey]].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  const role = String(row?.[roleKey] || '').toLowerCase();
  if (role === 'volunteer') return 'A responder';
  if (role === 'law_enforcement') return 'An officer';
  if (role === 'standard_user') return 'A SheSafe user';
  return 'Someone';
}

function formatResponder(row) {
  return {
    id: String(row.id),
    name: userName(row),
    photoUri: row.photo_url || null,
    latitude: row.latest_latitude == null ? null : Number(row.latest_latitude),
    longitude: row.latest_longitude == null ? null : Number(row.latest_longitude),
    role: 'volunteer',
    acceptedAt: iso(row.accepted_at),
  };
}

function formatPerson(row, prefix) {
  return {
    id: String(row[`${prefix}_id`]),
    name: [row[`${prefix}_first_name`], row[`${prefix}_last_name`]].filter(Boolean).join(' ').trim() || 'Unknown User',
    photoUri: row[`${prefix}_photo_url`] || null,
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

function activeParticipantsForChat(sosUser, volunteers) {
  return [
    sosUser,
    ...volunteers.map((volunteer) => ({
      id: volunteer.id,
      name: volunteer.name,
      photoUri: volunteer.photoUri || null,
      role: 'volunteer',
      status: 'ACCEPTED',
    })),
  ];
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
    activeParticipants: activeParticipantsForChat(sosUser, volunteers),
    totalMembers: volunteers.length + 1,
    maxVolunteerResponders: 3,
  };
}

async function getRouteContext(incidentId, userId, role) {
  if (role !== 'admin') {
    const allowed = await isIncidentMember(incidentId, userId);
    if (!allowed) throw httpError(403, 'You are not a member of this incident route.');
  }

  const row = await getIncidentRouteContext(incidentId);
  if (!row) throw httpError(404, 'Incident not found.');
  const volunteer = await getUserRouteLocation(userId);
  const responderData = await getIncidentResponders(incidentId);

  const victimLat = row.victim_latest_latitude == null
    ? row.incident_latitude
    : row.victim_latest_latitude;
  const victimLng = row.victim_latest_longitude == null
    ? row.incident_longitude
    : row.victim_latest_longitude;

  return {
    incidentId: Number(row.id),
    status: row.status,
    victim: {
      id: String(row.victim_id),
      name: userName(row, 'victim_first_name', 'victim_last_name'),
      latitude: Number(victimLat),
      longitude: Number(victimLng),
      photoUri: row.victim_photo_url || null,
    },
    volunteer: volunteer ? {
      id: String(volunteer.id),
      name: userName(volunteer),
      latitude: volunteer.latest_latitude == null ? null : Number(volunteer.latest_latitude),
      longitude: volunteer.latest_longitude == null ? null : Number(volunteer.latest_longitude),
      photoUri: volunteer.photo_url || null,
    } : null,
    volunteers: (responderData.volunteers || []).map((responder) => ({
      id: String(responder.id),
      name: userName(responder),
      latitude: responder.latest_latitude == null ? null : Number(responder.latest_latitude),
      longitude: responder.latest_longitude == null ? null : Number(responder.latest_longitude),
      photoUri: responder.photo_url || null,
      acceptedAt: iso(responder.accepted_at),
    })),
  };
}

async function getAssistedIncidents(volunteerId, search = '') {
  const rows = await getAssistedByVolunteer(volunteerId);
  const incidents = await Promise.all(rows.map(async (r) => {
    const responders = await getResponders(r.id);
    const createdAt = iso(r.created_at);
    const updatedAt = iso(r.updated_at || r.created_at);
    const lastMessageAt = iso(r.latest_message_created_at);
    const latestActivityAt = iso(r.latest_activity_at || r.updated_at || r.created_at);
    const latestMessage = formatLatestMessage(r);

    return {
      id: Number(r.id),
      incidentCode: `Incident #${r.id}`,
      type: 'SOS Alert',
      status: r.status === 'IN_PROGRESS' ? 'ACTIVE' : r.status,
      priority: ['ACTIVE', 'IN_PROGRESS'].includes(r.status) ? 'HIGH' : 'NORMAL',
      createdAt,
      updatedAt,
      lastMessageAt,
      latestActivityAt,
      location: {
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        updatedAt: latestActivityAt,
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
        type: latestMessage.senderRole === 'system' ? 'SYSTEM' : 'TEXT',
      } : null,
      sosUser: responders.sosUser,
      responders: responders.volunteers,
      activeParticipants: responders.activeParticipants,
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
    const updatedAt = iso(r.updated_at || r.created_at);
    const lastMessageAt = iso(r.latest_message_created_at);
    const latestActivityAt = iso(r.latest_activity_at || r.updated_at || r.created_at);
    const latestMessage = formatLatestMessage(r);

    return {
      id: Number(r.id),
      incidentCode: `Incident #${r.id}`,
      status: r.status === 'IN_PROGRESS' ? 'ACTIVE' : r.status,
      priority: ['ACTIVE', 'IN_PROGRESS'].includes(r.status) ? 'HIGH' : 'NORMAL',
      createdAt,
      updatedAt,
      lastMessageAt,
      latestActivityAt,
      lastMessage: latestMessage,
      sosUser: responders.sosUser,
      responders: responders.volunteers,
      activeParticipants: responders.activeParticipants,
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
  const participant = await getIncidentParticipantState(incidentId, userId);
  if (participant?.left_at) {
    throw httpError(403, 'You have left this incident chat.');
  }
  return incident;
}

async function getIncidentMessages(userId, incidentId, role) {
  await ensureChatAccess(userId, incidentId, role);
  await chatService.ensureChatSchema();
  await ensureDefaultIncidentMessages(incidentId);
  const messages = await chatService.fetchMessages(incidentId, userId, role);
  return messages.map((message) => ({
    id: message.id,
    incidentId: Number(message.incidentId),
    senderId: message.type === 'SYSTEM' ? 'system' : message.sender.id,
    senderName: message.type === 'SYSTEM' ? '' : message.sender.name,
    senderUsername: message.type === 'SYSTEM' ? '' : (message.sender.username || ''),
    senderNotificationName: message.type === 'SYSTEM' ? '' : (
      message.sender.username ? `@${message.sender.username}` : message.sender.name || ''
    ),
    senderRole: message.type === 'SYSTEM'
      ? 'system'
      : message.sender.role === 'VOLUNTEER'
      ? 'volunteer'
      : message.sender.role === 'POLICE'
        ? 'law_enforcement'
        : 'standard_user',
    senderPhotoUri: message.type === 'SYSTEM' ? null : (message.sender.photoUrl || null),
    text: message.content,
    type: message.type,
    mediaUrl: message.mediaUrl || null,
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
    senderUsername: message.sender.username || '',
    senderNotificationName: message.sender.username ? `@${message.sender.username}` : message.sender.name || '',
    senderRole: message.sender.role === 'VOLUNTEER'
      ? 'volunteer'
      : message.sender.role === 'POLICE'
        ? 'law_enforcement'
        : 'standard_user',
    senderPhotoUri: message.sender.photoUrl || null,
    text: message.content,
    type: message.type,
    mediaUrl: message.mediaUrl || null,
    createdAt: message.timestamp,
  };
}

async function getNotificationRecipients(incidentId, { excludeUserId = null } = {}) {
  const incident = await findIncidentById(incidentId);
  if (!incident) return [];
  const participants = await getParticipants(incidentId);
  const seen = new Set();
  const recipients = [];

  const add = (userId, role = null) => {
    const id = String(userId || '');
    if (!id || (excludeUserId && id === String(excludeUserId)) || seen.has(id)) return;
    seen.add(id);
    recipients.push({ userId: id, role });
  };

  add(incident.user_id, 'standard_user');
  participants.forEach((participant) => add(participant.id, participant.role_name));
  return recipients;
}

function isFinalIncidentStatus(status) {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'RESOLVED' || normalized === 'CANCELLED';
}

function snapshotResponse(snapshot, fallbackStatus) {
  const status = String(snapshot?.status || fallbackStatus || '').toUpperCase();
  return {
    incidentId: Number(snapshot?.incidentId),
    status,
    mode: 'snapshot',
    isFinal: true,
    victimLocation: snapshot?.victimLocation || null,
    volunteerLocations: Array.isArray(snapshot?.volunteerLocations) ? snapshot.volunteerLocations : [],
    polyline: Array.isArray(snapshot?.polyline) ? snapshot.polyline : null,
    finalizedAt: snapshot?.finalizedAt || null,
  };
}

async function getMapSnapshot(incidentId, userId, role) {
  if (role !== 'admin') {
    const allowed = await isIncidentMember(incidentId, userId);
    if (!allowed) throw httpError(403, 'You are not a member of this incident map.');
  }

  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  const status = String(incident.status || '').toUpperCase();

  if (isFinalIncidentStatus(status)) {
    const snapshot = await getFinalLocationSnapshot(incidentId);
    return snapshotResponse(snapshot, status);
  }

  const liveSnapshot = await buildIncidentLocationSnapshot(incidentId, status);
  return {
    incidentId: Number(incidentId),
    status,
    mode: 'live',
    isFinal: false,
    victimLocation: liveSnapshot?.victimLocation || null,
    volunteerLocations: Array.isArray(liveSnapshot?.volunteerLocations) ? liveSnapshot.volunteerLocations : [],
    polyline: null,
    finalizedAt: null,
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

async function submitIncidentReview(userId, incidentId, payload) {
  const volunteerId = payload?.volunteerId;
  const rating = Math.max(1, Math.min(5, Number(payload?.rating || 0)));
  const feedback = String(payload?.feedback || '').trim();

  if (!volunteerId) throw httpError(400, 'volunteerId is required.');
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw httpError(400, 'rating must be between 1 and 5.');
  }

  const result = await createIncidentReview({
    incidentId,
    reviewerId: userId,
    volunteerId,
    rating,
    feedback,
  });

  if (result.status === 'NOT_FOUND') throw httpError(404, 'Incident not found.');
  if (result.status === 'FORBIDDEN') throw httpError(403, 'Only the SOS creator can review responders.');
  if (result.status === 'NOT_RESPONDER') throw httpError(400, 'You can only review accepted responders for this incident.');

  const review = result.review;
  return {
    review: {
      id: String(review.id),
      incidentId: String(review.incident_id),
      reviewerId: String(review.reviewer_id),
      volunteerId: String(review.volunteer_id),
      rating: Number(review.rating),
      feedback: review.feedback || '',
      createdAt: iso(review.created_at),
      updatedAt: iso(review.updated_at),
    },
  };
}

async function getVolunteerActivity(userId) {
  const rows = await getVolunteerActivityLogs(userId);
  return rows.map((row) => {
    const status = row.status === 'IN_PROGRESS' ? 'ACTIVE' : row.status;
    const updatedAt = iso(row.updated_at || row.accepted_at || row.created_at);
    return {
      id: `${row.incident_id}-${row.volunteer_id}`,
      incidentId: String(row.incident_id),
      status,
      createdAt: iso(row.created_at),
      updatedAt,
      resolvedAt: status === 'RESOLVED' ? updatedAt : null,
      cancelledAt: status === 'CANCELLED' ? updatedAt : null,
      volunteer: formatPerson(row, 'volunteer'),
      victim: formatPerson(row, 'victim'),
    };
  });
}

function formatLeaderboardUser(row, rank) {
  const resolvedIncidentCount = Number(row.resolved_incident_count || 0);
  const assistedIncidentCount = Number(row.assisted_incident_count || 0);
  const averageRating = Number(row.average_rating || 0);
  return {
    id: String(row.id),
    name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Volunteer',
    photoUri: row.photo_url || null,
    rank,
    points: resolvedIncidentCount * 100,
    resolvedIncidentCount,
    assistedIncidentCount,
    averageRating: Number(averageRating.toFixed(1)),
    ratingCount: Number(row.rating_count || 0),
  };
}

async function getVolunteerLeaderboard(userId) {
  const rows = await getVolunteerLeaderboardRows();
  const normalizedRows = rows.map((row) => ({
    ...row,
    resolved_incident_count: Number(row.resolved_incident_count || 0),
    assisted_incident_count: Number(row.assisted_incident_count || 0),
    average_rating: Number(row.average_rating || 0),
    rating_count: Number(row.rating_count || 0),
  }));

  if (!normalizedRows.some((row) => String(row.id) === String(userId))) {
    const current = await getVolunteerSummary(userId);
    if (current) {
      normalizedRows.push({
        ...current,
        resolved_incident_count: 0,
        assisted_incident_count: 0,
        average_rating: 0,
        rating_count: 0,
      });
    }
  }

  normalizedRows.sort((a, b) => {
    const pointsA = Number(a.resolved_incident_count || 0) * 100;
    const pointsB = Number(b.resolved_incident_count || 0) * 100;
    if (pointsB !== pointsA) return pointsB - pointsA;
    if (Number(b.average_rating || 0) !== Number(a.average_rating || 0)) {
      return Number(b.average_rating || 0) - Number(a.average_rating || 0);
    }
    return Number(b.resolved_incident_count || 0) - Number(a.resolved_incident_count || 0);
  });

  const rankings = normalizedRows.map((row, index) => formatLeaderboardUser(row, index + 1));
  const me = rankings.find((row) => String(row.id) === String(userId)) || null;
  return { me, rankings };
}

async function getVolunteerCertificateData(userId, role) {
  if (String(role || '').toLowerCase() !== 'volunteer') {
    throw httpError(403, 'Volunteer certificate is available only to volunteers.');
  }

  const { me } = await getVolunteerLeaderboard(userId);
  if (!me) {
    throw httpError(404, 'Volunteer profile not found.');
  }

  return {
    name: me.name,
    assistedIncidents: Number(me.resolvedIncidentCount || 0),
    totalPoints: Number(me.points || 0),
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
  return volunteers
    .filter((v) => String(v.user_id) !== String(incident.user_id))
    .map((v) => ({
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
  getMyActiveSos,
  getNearbyIncidents,
  acceptIncident,
  rejectIncident,
  getAssistedIncidents,
  getVolunteerNotifications,
  getUserIncidentChats,
  getResponders,
  getRouteContext,
  getMapSnapshot,
  getIncidentMessages,
  sendIncidentMessage,
  getNotificationRecipients,
  getUserCaseDetails,
  updateUserCaseDetails,
  getVolunteerCaseDetails,
  updateVolunteerCaseDetails,
  submitIncidentReview,
  getVolunteerActivity,
  getVolunteerLeaderboard,
  getVolunteerCertificateData,
  updateOnlineStatus,
  getDispatchList,
};

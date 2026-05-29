const { httpError } = require('../../utils/httpError');
const repo = require('./law.repository');

const ACTIVE_INCIDENT_STATUSES = new Set(['ACTIVE', 'IN_PROGRESS', 'LIVE']);

function positiveId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, `Valid ${label} is required.`);
  return id;
}

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  if (text.length > max) throw httpError(400, `Text must be ${max} characters or fewer.`);
  return text || null;
}

function normalizeRole(role) {
  const raw = String(role || '').toLowerCase();
  if (raw === 'volunteer') return 'VOLUNTEER';
  if (raw === 'law_enforcement') return 'POLICE';
  if (raw === 'admin') return 'ADMIN';
  return 'USER';
}

function toRequestStatus(row) {
  if (!row) return { exists: false };
  return {
    exists: true,
    id: String(row.id),
    incidentId: String(row.incident_id),
    status: row.status,
    assignedPoliceId: row.assigned_police_id ? String(row.assigned_police_id) : null,
    isAccepted: row.status === 'ACCEPTED_BY_POLICE',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRequest(row) {
  const assignedPoliceCount = Number(row.assigned_police_count || 0);
  const assignedToAll = row.status === 'ASSIGNED_TO_POLICE' && !row.assigned_police_id && assignedPoliceCount > 0;
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    incidentDisplayCode: `#${row.incident_id}`,
    requesterName: row.requester_name || 'Requester',
    requesterRole: normalizeRole(row.requested_by_role),
    victimName: row.victim_name || 'SOS triggerer',
    incidentStatus: row.incident_status,
    address: row.address || null,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    status: row.status,
    assignedPoliceId: row.assigned_police_id ? String(row.assigned_police_id) : null,
    assignedToAll,
    assignedPoliceCount,
    assignedPoliceName: assignedToAll ? 'All approved police' : row.assigned_police_name || null,
    assignedPolicePhone: row.assigned_police_phone || null,
    assignedPoliceUnit: row.assigned_police_unit || null,
    assignedPoliceBadge: row.assigned_police_badge || null,
    assignedPolice: row.assigned_police_id && !assignedToAll ? {
      id: String(row.assigned_police_id),
      name: row.assigned_police_name || 'Assigned officer',
      phone: row.assigned_police_phone || null,
      unit: row.assigned_police_unit || null,
      badgeNumber: row.assigned_police_badge || null,
    } : null,
    requestNote: row.request_note || null,
    rejectionReason: row.rejection_reason || null,
    cancelReason: row.cancel_reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row) {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    incidentDisplayCode: `#${row.incident_id}`,
    victimName: row.victim_name || 'SOS triggerer',
    incidentStatus: row.incident_status,
    address: row.address || null,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    victimLiveLocation: row.victim_latest_latitude && row.victim_latest_longitude ? {
      latitude: Number(row.victim_latest_latitude),
      longitude: Number(row.victim_latest_longitude),
    } : null,
    status: row.status,
    requestNote: row.request_note || null,
    rejectionReason: row.rejection_reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireActiveRequestIncident(request) {
  const incident = await repo.findIncidentForRequest(request.incident_id);
  if (!incident || !ACTIVE_INCIDENT_STATUSES.has(String(incident.status || '').toUpperCase())) {
    throw httpError(409, 'This task is no longer active because the incident has ended.');
  }
  return incident;
}

async function requireApprovedPolice(userId) {
  const profile = await repo.getPoliceProfile(userId);
  if (!profile) throw httpError(403, 'Police profile is required.');
  if (profile.verification_status !== 'APPROVED') {
    throw httpError(403, 'Police verification approval is required.', { code: 'POLICE_NOT_APPROVED' });
  }
  return profile;
}

async function createLawRequest(user, body) {
  await repo.ensureLawSchema();
  const incidentId = positiveId(body?.incidentId, 'incident id');
  const incident = await repo.findIncidentForRequest(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (!ACTIVE_INCIDENT_STATUSES.has(String(incident.status || '').toUpperCase())) {
    throw httpError(400, 'Law enforcement can only be requested for an active SOS.');
  }

  const isVictim = Number(incident.user_id) === Number(user.id);
  const isVolunteer = await repo.isAcceptedVolunteer(incidentId, user.id);
  if (!isVictim && !isVolunteer) {
    throw httpError(403, 'Only incident participants can request law enforcement.');
  }

  const duplicate = await repo.findActiveForIncident(incidentId);
  if (duplicate) {
    throw httpError(409, 'Law enforcement has already been requested for this incident.');
  }

  const created = await repo.createRequest({
    incidentId,
    requestedByUserId: user.id,
    requestedByRole: user.role,
    requestNote: cleanText(body?.requestNote),
  });
  await repo.addSystemMessage(incidentId, user.id, 'Law enforcement request sent to admin.').catch(() => undefined);
  return toRequestStatus(created);
}

async function getIncidentLawStatus(user, incidentIdValue) {
  await repo.ensureLawSchema();
  const incidentId = positiveId(incidentIdValue, 'incident id');
  const incident = await repo.findIncidentForRequest(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  const isVictim = Number(incident.user_id) === Number(user.id);
  const isVolunteer = await repo.isAcceptedVolunteer(incidentId, user.id);
  const isPoliceOrAdmin = ['law_enforcement', 'admin'].includes(String(user.role || '').toLowerCase());
  if (!isVictim && !isVolunteer && !isPoliceOrAdmin) {
    throw httpError(403, 'You are not a member of this incident.');
  }
  return toRequestStatus(await repo.getIncidentStatus(incidentId));
}

async function listAdminRequests() {
  await repo.ensureLawSchema();
  return (await repo.listAdminRequests()).map(mapRequest);
}

async function listApprovedPolice() {
  await repo.ensureLawSchema();
  return (await repo.listApprovedPolice()).map((row) => ({
    id: String(row.id),
    name: row.name || 'Police officer',
    phoneNumber: row.phone_number,
    policeStationOrUnit: row.police_station_or_unit,
    badgeNumber: row.badge_number,
  }));
}

async function assignRequest(adminId, requestIdValue, body) {
  await repo.ensureLawSchema();
  const requestId = positiveId(requestIdValue, 'request id');
  const request = await repo.findById(requestId);
  if (!request) throw httpError(404, 'Law enforcement request not found.');
  if (!['PENDING_ADMIN_REVIEW', 'REJECTED_BY_POLICE'].includes(request.status)) {
    throw httpError(409, 'This request cannot be assigned in its current state.');
  }
  await requireActiveRequestIncident(request);
  if (body?.assignToAll === true || String(body?.policeId || '').toUpperCase() === 'ALL') {
    const approvedPolice = await repo.listApprovedPolice();
    if (approvedPolice.length === 0) throw httpError(400, 'Approve at least one police user before assigning to all.');
    const updated = await repo.assignRequestToAll({ requestId, adminId });
    await repo.addSystemMessage(updated.incident_id, adminId, 'Law enforcement request has been offered to all approved police.').catch(() => undefined);
    return mapRequest(await repo.getAdminRequestById(requestId));
  }
  const policeId = positiveId(body?.policeId, 'police id');
  if (!(await repo.findApprovedPolice(policeId))) {
    throw httpError(400, 'Selected police user must be approved.');
  }
  const updated = await repo.assignRequest({ requestId, policeId, adminId });
  await repo.addSystemMessage(updated.incident_id, adminId, 'Law enforcement has been assigned.').catch(() => undefined);
  return mapRequest(await repo.getAdminRequestById(requestId));
}

async function cancelRequest(adminId, requestIdValue, body) {
  await repo.ensureLawSchema();
  const requestId = positiveId(requestIdValue, 'request id');
  const request = await repo.findById(requestId);
  if (!request) throw httpError(404, 'Law enforcement request not found.');
  if (['RESOLVED', 'CANCELLED'].includes(String(request.status || '').toUpperCase())) {
    return mapRequest(await repo.getAdminRequestById(requestId));
  }
  const updated = await repo.cancelRequest({ requestId, adminId, reason: cleanText(body?.reason) });
  return mapRequest(await repo.getAdminRequestById(updated.id));
}

async function listPoliceTasks(policeId) {
  await repo.ensureLawSchema();
  await requireApprovedPolice(policeId);
  return (await repo.listPoliceTasks(policeId))
    .map(mapTask)
    .filter((task) => ACTIVE_INCIDENT_STATUSES.has(String(task.incidentStatus || '').toUpperCase()));
}

async function acceptTask(policeId, requestIdValue) {
  await repo.ensureLawSchema();
  await requireApprovedPolice(policeId);
  const requestId = positiveId(requestIdValue, 'request id');
  const request = await repo.findById(requestId);
  if (!request) {
    throw httpError(404, 'Assigned task not found.');
  }
  await requireActiveRequestIncident(request);
  if (Number(request.assigned_police_id) === Number(policeId)) {
    if (request.status === 'ACCEPTED_BY_POLICE') {
      return toRequestStatus(request);
    }
    const updated = await repo.updatePoliceTask({
      requestId,
      policeId,
      fromStatus: 'ASSIGNED_TO_POLICE',
      toStatus: 'ACCEPTED_BY_POLICE',
    });
    if (!updated || updated.status !== 'ACCEPTED_BY_POLICE') {
      throw httpError(409, 'This task is not available to accept.');
    }
    await repo.addSystemMessage(updated.incident_id, policeId, 'Law enforcement is responding.').catch(() => undefined);
    return toRequestStatus(updated);
  }
  if (!request.assigned_police_id && request.status === 'ASSIGNED_TO_POLICE') {
    const candidate = await repo.findOfferedCandidate(requestId, policeId);
    if (!candidate) throw httpError(404, 'Assigned task not found.');
    const updated = await repo.acceptCandidateTask({ requestId, policeId });
    if (!updated) throw httpError(409, 'Another police officer accepted this task first.');
    await repo.addSystemMessage(updated.incident_id, policeId, 'Law enforcement is responding.').catch(() => undefined);
    return toRequestStatus(updated);
  }
  throw httpError(404, 'Assigned task not found.');
}

async function rejectTask(policeId, requestIdValue, body) {
  await repo.ensureLawSchema();
  await requireApprovedPolice(policeId);
  const requestId = positiveId(requestIdValue, 'request id');
  const request = await repo.findById(requestId);
  if (!request) {
    throw httpError(404, 'Assigned task not found.');
  }
  await requireActiveRequestIncident(request);
  const reason = cleanText(body?.reason);
  if (Number(request.assigned_police_id) === Number(policeId)) {
    if (!['ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE'].includes(request.status)) {
      throw httpError(409, 'This task cannot be rejected now.');
    }
    const updated = await repo.updatePoliceTask({
      requestId,
      policeId,
      fromStatus: request.status,
      toStatus: 'REJECTED_BY_POLICE',
      reason,
    });
    return toRequestStatus(updated);
  }
  if (!request.assigned_police_id && request.status === 'ASSIGNED_TO_POLICE') {
    const candidate = await repo.findOfferedCandidate(requestId, policeId);
    if (!candidate) throw httpError(404, 'Assigned task not found.');
    return toRequestStatus(await repo.rejectCandidateTask({ requestId, policeId, reason }));
  }
  throw httpError(404, 'Assigned task not found.');
}

async function resolveTask(policeId, requestIdValue) {
  await repo.ensureLawSchema();
  await requireApprovedPolice(policeId);
  const requestId = positiveId(requestIdValue, 'request id');
  const request = await repo.findById(requestId);
  if (!request || Number(request.assigned_police_id) !== Number(policeId)) {
    throw httpError(404, 'Assigned task not found.');
  }
  await requireActiveRequestIncident(request);
  const updated = await repo.updatePoliceTask({
    requestId,
    policeId,
    fromStatus: request.status,
    toStatus: 'RESOLVED',
  });
  return toRequestStatus(updated);
}

async function closeRequestsForIncident(incidentIdValue, statusValue, reason) {
  await repo.ensureLawSchema();
  const incidentId = positiveId(incidentIdValue, 'incident id');
  const status = String(statusValue || '').toUpperCase();
  if (!['RESOLVED', 'CANCELLED'].includes(status)) {
    throw httpError(400, 'A resolved or cancelled status is required.');
  }
  await repo.closeRequestsForIncident({ incidentId, status, reason: cleanText(reason) });
}

module.exports = {
  requireApprovedPolice,
  createLawRequest,
  getIncidentLawStatus,
  listAdminRequests,
  listApprovedPolice,
  assignRequest,
  cancelRequest,
  listPoliceTasks,
  acceptTask,
  rejectTask,
  resolveTask,
  closeRequestsForIncident,
};

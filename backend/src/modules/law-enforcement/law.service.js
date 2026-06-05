const { httpError } = require('../../utils/httpError');
const repo = require('./law.repository');

const ACTIVE_INCIDENT_STATUSES = new Set(['ACTIVE', 'IN_PROGRESS', 'LIVE']);
const CRITICAL_KEYWORDS = [
  'weapon', 'knife', 'gun', 'assault', 'raped', 'rape', 'unconscious', 'trapped',
  'bleeding', 'blood', 'severe threat', 'kill', 'kidnap', 'choking',
];
const HIGH_KEYWORDS = [
  'medical', 'injured', 'injury', 'hurt', 'stalking', 'following', 'threat',
  'harassment', 'harassing', 'attack', 'panic', 'unsafe', 'danger', 'help',
  'emergency', 'scream', 'forced', 'abuse',
];

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

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function nameFrom(row, firstKey, lastKey, fallback) {
  return [row?.[firstKey], row?.[lastKey]].filter(Boolean).join(' ').trim() || fallback;
}

function compactText(value, max = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function objectToLines(value) {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== 'object') return [];
  return Object.entries(parsed)
    .filter(([, val]) => val !== null && val !== undefined && String(val).trim() !== '')
    .slice(0, 8)
    .map(([key, val]) => `${key.replace(/([A-Z])/g, ' $1')}: ${Array.isArray(val) ? val.join(', ') : String(val)}`);
}

function findKeywordHits(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword));
}

function summarizeChat(messages) {
  const important = [];
  let urgentScore = 0;
  for (const message of messages || []) {
    const content = compactText(message.content, 180);
    if (!content) continue;
    const criticalHits = findKeywordHits(content, CRITICAL_KEYWORDS);
    const highHits = findKeywordHits(content, HIGH_KEYWORDS);
    if (criticalHits.length) urgentScore += 4;
    if (highHits.length) urgentScore += 2;
    if (criticalHits.length || highHits.length || important.length < 5) {
      important.push({
        at: message.created_at,
        sender: message.sender_name || 'Participant',
        role: normalizeRole(message.sender_role),
        type: message.message_type || 'TEXT',
        message: content,
      });
    }
  }
  return { importantMessages: important.slice(-8), urgentScore };
}

function hasRecentLiveLocation(incident) {
  return incident?.victim_latest_latitude != null && incident?.victim_latest_longitude != null;
}

function computeSeverity({ incident, requesterRole, responderCount, chatUrgentScore, allText }) {
  const status = String(incident?.status || '').toUpperCase();
  const active = ACTIVE_INCIDENT_STATUSES.has(status);
  const criticalHits = findKeywordHits(allText, CRITICAL_KEYWORDS);
  const highHits = findKeywordHits(allText, HIGH_KEYWORDS);
  let score = 0;
  const reasons = [];

  if (active) {
    score += 3;
    reasons.push('active SOS status');
  }
  if (status === 'IN_PROGRESS' || status === 'LIVE') {
    score += 1;
    reasons.push('incident is in progress');
  }
  if (requesterRole === 'VOLUNTEER') {
    score += 2;
    reasons.push('request submitted by assisting volunteer');
  }
  if (responderCount >= 2) {
    score += 2;
    reasons.push('multiple responders involved');
  } else if (responderCount === 1) {
    score += 1;
    reasons.push('responder involved');
  }
  if (hasRecentLiveLocation(incident)) {
    score += 2;
    reasons.push('recent live location available');
  }
  if (criticalHits.length) {
    score += 6;
    reasons.push(`critical danger keyword(s): ${criticalHits.slice(0, 4).join(', ')}`);
  }
  if (highHits.length) {
    score += 3;
    reasons.push(`urgent keyword(s): ${highHits.slice(0, 5).join(', ')}`);
  }
  if (chatUrgentScore >= 6) {
    score += 3;
    reasons.push('repeated urgent chat messages');
  } else if (chatUrgentScore > 0) {
    score += 1;
    reasons.push('urgent chat indicators');
  }

  let severity = 'LOW';
  if (score >= 11 || criticalHits.length >= 2) severity = 'CRITICAL';
  else if (score >= 7 || criticalHits.length || (active && highHits.length)) severity = 'HIGH';
  else if (score >= 3) severity = 'MEDIUM';

  return {
    severity,
    severityReason: reasons.length
      ? `${reasons[0][0].toUpperCase()}${reasons[0].slice(1)}${reasons.length > 1 ? ` with ${reasons.slice(1).join(', ')}` : ''}.`
      : 'No immediate danger indicators were found in available incident data.',
  };
}

async function generateIncidentIntelligence({ incidentId, requesterUserId, requestedByRole, requestTime }) {
  const context = await repo.getIncidentSummaryContext(incidentId, requesterUserId);
  if (!context?.incident) throw httpError(404, 'Incident not found.');
  const { incident, volunteers, chatMessages, responderCount, participantCount } = context;
  const userCaseLines = objectToLines(incident.user_case_details);
  const volunteerCaseLines = objectToLines(incident.volunteer_case_details);
  const finalSnapshot = parseJson(incident.final_location_snapshot);
  const chatSummary = summarizeChat(chatMessages);
  const victimName = nameFrom(incident, 'victim_first_name', 'victim_last_name', 'SOS triggerer');
  const requesterName = nameFrom(incident, 'requester_first_name', 'requester_last_name', 'Requester');
  const requesterRole = normalizeRole(requestedByRole || incident.requester_role_name);
  const allText = [
    incident.address,
    ...userCaseLines,
    ...volunteerCaseLines,
    ...(chatMessages || []).map((message) => message.content),
  ].join(' ');
  const { severity, severityReason } = computeSeverity({
    incident,
    requesterRole,
    responderCount,
    chatUrgentScore: chatSummary.urgentScore,
    allText,
  });
  const currentLocation = hasRecentLiveLocation(incident)
    ? {
      latitude: Number(incident.victim_latest_latitude),
      longitude: Number(incident.victim_latest_longitude),
      source: 'victim_live_location',
    }
    : {
      latitude: incident.latitude == null ? null : Number(incident.latitude),
      longitude: incident.longitude == null ? null : Number(incident.longitude),
      source: 'incident_start_location',
    };
  const caseDetails = [...userCaseLines, ...volunteerCaseLines].slice(0, 12);
  const summaryParagraph = compactText([
    `Incident #${incident.id} is currently ${incident.status}.`,
    `${requesterRole === 'VOLUNTEER' ? 'An assisting volunteer' : 'The incident owner'} requested police review.`,
    incident.address ? `Known location: ${incident.address}.` : 'Location label is unavailable.',
    caseDetails.length ? `Case details include ${caseDetails.slice(0, 3).join('; ')}.` : '',
    chatSummary.importantMessages.length ? `Recent chat includes ${chatSummary.importantMessages.slice(-2).map((item) => `"${item.message}"`).join(' and ')}.` : '',
  ].filter(Boolean).join(' '), 900);

  const summary = {
    version: 1,
    title: 'AI Incident Intelligence',
    incidentId: String(incident.id),
    incidentCode: `#${incident.id}`,
    requestSource: requesterRole === 'VOLUNTEER' ? 'Volunteer incident chat' : 'Standard user incident chat',
    requestedBy: {
      userId: String(requesterUserId),
      role: requesterRole,
      name: requesterName,
      phone: incident.requester_phone || null,
    },
    victim: {
      userId: String(incident.user_id),
      name: victimName,
      phone: incident.victim_phone || null,
    },
    status: incident.status,
    sosCreatedAt: incident.created_at,
    policeRequestTime: requestTime,
    lastUpdatedAt: new Date().toISOString(),
    incidentLocation: {
      address: incident.address || null,
      latitude: incident.latitude == null ? null : Number(incident.latitude),
      longitude: incident.longitude == null ? null : Number(incident.longitude),
    },
    currentLocation,
    finalLocationSnapshot: finalSnapshot || null,
    responderCount,
    participantCount,
    acceptedVolunteers: volunteers
      .filter((volunteer) => volunteer.status === 'ACCEPTED')
      .map((volunteer) => ({
        id: String(volunteer.id),
        name: volunteer.name || 'Volunteer',
        phone: volunteer.phone_number || null,
        acceptedAt: volunteer.accepted_at,
      })),
    caseDetails,
    importantChatDetails: chatSummary.importantMessages,
    summary: summaryParagraph || 'No incident details were available beyond the request metadata.',
    severity,
    severityReason,
  };

  return {
    summary,
    incidentSummary: JSON.stringify(summary),
    severity,
    severityReason,
  };
}

function fallbackIncidentIntelligence({ incident, incidentId, requestedByRole }) {
  const requesterRole = normalizeRole(requestedByRole);
  const status = String(incident?.status || '').toUpperCase();
  const severity = ACTIVE_INCIDENT_STATUSES.has(status) ? 'HIGH' : 'MEDIUM';
  const summaryText = `Incident #${incidentId} has an active SOS request. Law enforcement assistance was requested by ${requesterRole}.`;
  const severityReason = severity === 'HIGH'
    ? 'Active SOS status with limited optional incident details available.'
    : 'Law enforcement assistance was requested with limited optional incident details available.';
  const summary = {
    version: 1,
    title: 'Incident Intelligence',
    incidentId: String(incidentId),
    incidentCode: `#${incidentId}`,
    requestSource: requesterRole === 'VOLUNTEER' ? 'Volunteer incident chat' : 'Standard user incident chat',
    status: incident?.status || 'ACTIVE',
    summary: summaryText,
    severity,
    severityReason,
  };

  return {
    summary,
    incidentSummary: JSON.stringify(summary),
    severity,
    severityReason,
  };
}

async function generateIncidentIntelligenceSafely(args) {
  try {
    return await generateIncidentIntelligence(args);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[law-enforcement] Falling back to basic incident summary:', error?.message || error);
    }
    return fallbackIncidentIntelligence(args);
  }
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
  const incidentSummary = parseJson(row.incident_summary);
  return {
    exists: true,
    id: String(row.id),
    incidentId: String(row.incident_id),
    status: row.status,
    assignedPoliceId: row.assigned_police_id ? String(row.assigned_police_id) : null,
    isAccepted: row.status === 'ACCEPTED_BY_POLICE',
    duplicate: Boolean(row.duplicate),
    severity: row.severity || null,
    severityReason: row.severity_reason || null,
    incidentSummary: incidentSummary?.summary || row.incident_summary || null,
    summaryGeneratedAt: row.summary_generated_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRequest(row) {
  const assignedPoliceCount = Number(row.assigned_police_count || 0);
  const assignedToAll = row.status === 'ASSIGNED_TO_POLICE' && !row.assigned_police_id && assignedPoliceCount > 0;
  const incidentSummary = parseJson(row.incident_summary);
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
    incidentSummary,
    incidentSummaryText: incidentSummary?.summary || row.incident_summary || null,
    summaryPreview: compactText(incidentSummary?.summary || row.incident_summary, 180),
    severity: row.severity || incidentSummary?.severity || 'LOW',
    severityReason: row.severity_reason || incidentSummary?.severityReason || null,
    summaryGeneratedAt: row.summary_generated_at || null,
    reviewedByAdminId: row.reviewed_by_admin_id ? String(row.reviewed_by_admin_id) : null,
    reviewedAt: row.reviewed_at || null,
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
  if (await repo.findActiveForIncident(incidentId)) {
    throw httpError(409, 'Law enforcement has already been requested for this incident.');
  }

  const requestTime = new Date().toISOString();
  const intelligence = await generateIncidentIntelligenceSafely({
    incidentId,
    incident,
    requesterUserId: user.id,
    requestedByRole: user.role,
    requestTime,
  });

  const created = await repo.createRequest({
    incidentId,
    requestedByUserId: user.id,
    requestedByRole: user.role,
    requestNote: cleanText(body?.requestNote),
    incidentSummary: intelligence.incidentSummary,
    severity: intelligence.severity,
    severityReason: intelligence.severityReason,
  });
  if (created.duplicate) {
    throw httpError(409, 'Law enforcement has already been requested for this incident.');
  }
  await repo.addSystemMessage(incidentId, user.id, 'Police request submitted to admin with an automatic incident summary.').catch(() => undefined);
  return toRequestStatus({ ...created.row, duplicate: created.duplicate });
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

async function getAdminRequest(adminId, requestIdValue) {
  await repo.ensureLawSchema();
  const requestId = positiveId(requestIdValue, 'request id');
  if (adminId) {
    await repo.markAdminReviewed({ requestId, adminId: positiveId(adminId, 'admin id') });
  }
  const row = await repo.getAdminRequestById(requestId);
  if (!row) throw httpError(404, 'Law enforcement request not found.');
  return mapRequest(row);
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
  getAdminRequest,
  listApprovedPolice,
  assignRequest,
  cancelRequest,
  listPoliceTasks,
  acceptTask,
  rejectTask,
  resolveTask,
  closeRequestsForIncident,
};

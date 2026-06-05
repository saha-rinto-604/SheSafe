const { httpError } = require('../../utils/httpError');
const repo = require('./admin.repository');
const lawService = require('../law-enforcement/law.service');

const VALID_USER_ROLES = new Set(['standard_user', 'volunteer', 'law_enforcement']);
const VALID_INCIDENT_FILTERS = new Set(['LIVE', 'RESOLVED', 'CANCELLED', 'ALL']);
const VALID_VERIFICATION_FILTERS = new Set(['pending', 'verified', 'rejected', 'all']);
const VALID_SAFE_PLACE_FILTERS = new Set(['PENDING', 'CONFIRMED', 'REJECTED', 'ALL']);
const VALID_REPORT_FILTERS = new Set(['PENDING', 'ACTIONED', 'ALL']);
const VALID_POLICE_VERIFICATION_FILTERS = new Set(['PENDING', 'APPROVED', 'REJECTED', 'ALL']);

async function ensureReady() {
  await repo.ensureAdminSchema();
}

function positiveId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError(400, `Valid ${label} is required.`);
  }
  return id;
}

function boundedText(value, { required = false, label = 'Reason', max = 500 } = {}) {
  const text = String(value || '').trim();
  if (required && !text) throw httpError(400, `${label} is required.`);
  if (text.length > max) throw httpError(400, `${label} must be ${max} characters or fewer.`);
  return text || null;
}

function enumValue(value, allowed, fallback) {
  const raw = value === undefined || value === null ? fallback : String(value).trim();
  const normalized = allowed.has(raw) ? raw : raw.toUpperCase();
  if (!allowed.has(normalized) && !allowed.has(raw.toLowerCase())) {
    throw httpError(400, 'Invalid filter value.');
  }
  return allowed.has(normalized) ? normalized : raw.toLowerCase();
}

function handleMutationStatus(result) {
  if (result.status === 'OK') return;
  if (result.status === 'NOT_FOUND') throw httpError(404, 'Record not found.');
  if (result.status === 'TARGET_NOT_FOUND') throw httpError(404, 'Target user not found.');
  if (result.status === 'ADMIN_TARGET') throw httpError(400, 'Admin accounts cannot be moderated from this panel.');
  if (result.status === 'INVALID_STATE') {
    throw httpError(409, `This record is already ${result.currentStatus}.`);
  }
  throw httpError(500, 'Admin action failed.');
}

async function getOverview() {
  await ensureReady();
  return repo.getOverview();
}

async function listIncidents(status = 'LIVE') {
  await ensureReady();
  const filter = enumValue(status, VALID_INCIDENT_FILTERS, 'LIVE');
  return repo.listIncidents(filter);
}

async function getIncidentById(id) {
  await ensureReady();
  const incident = await repo.getIncidentById(positiveId(id, 'incident id'));
  if (!incident) throw httpError(404, 'Incident not found.');
  return incident;
}

async function listUsers(role = 'standard_user') {
  await ensureReady();
  const normalized = String(role || 'standard_user').trim().toLowerCase();
  if (!VALID_USER_ROLES.has(normalized)) throw httpError(400, 'Invalid user role filter.');
  return repo.listUsers(normalized);
}

async function getUserById(id) {
  await ensureReady();
  const user = await repo.getUserById(positiveId(id, 'user id'));
  if (!user) throw httpError(404, 'User not found.');
  return user;
}

async function warnUser(adminId, userId, body) {
  await ensureReady();
  const result = await repo.warnUser({
    adminId: positiveId(adminId, 'admin id'),
    userId: positiveId(userId, 'user id'),
    reason: boundedText(body?.reason || body?.note, { required: true, label: 'Warning reason' }),
  });
  handleMutationStatus(result);
  return getUserById(userId);
}

async function blockUser(adminId, userId, body) {
  await ensureReady();
  const result = await repo.blockUser({
    adminId: positiveId(adminId, 'admin id'),
    userId: positiveId(userId, 'user id'),
    reason: boundedText(body?.reason || body?.note, { required: true, label: 'Block reason' }),
  });
  handleMutationStatus(result);
  return getUserById(userId);
}

async function unblockUser(adminId, userId, body) {
  await ensureReady();
  const result = await repo.unblockUser({
    adminId: positiveId(adminId, 'admin id'),
    userId: positiveId(userId, 'user id'),
    reason: boundedText(body?.reason || body?.note, { required: false, label: 'Unblock note' }),
  });
  handleMutationStatus(result);
  return getUserById(userId);
}

async function listVerifications(status = 'pending') {
  await ensureReady();
  const normalized = String(status || 'pending').trim().toLowerCase();
  if (!VALID_VERIFICATION_FILTERS.has(normalized)) throw httpError(400, 'Invalid verification status.');
  return repo.listVerifications(normalized);
}

async function listPoliceVerifications(status = 'PENDING') {
  await ensureReady();
  const filter = enumValue(status, VALID_POLICE_VERIFICATION_FILTERS, 'PENDING');
  return repo.listPoliceVerifications(filter);
}

async function approvePoliceVerification(adminId, userId) {
  await ensureReady();
  const result = await repo.updatePoliceVerification({
    adminId: positiveId(adminId, 'admin id'),
    userId: positiveId(userId, 'police user id'),
    status: 'APPROVED',
  });
  handleMutationStatus(result);
  return repo.getPoliceVerificationByUserId(userId);
}

async function rejectPoliceVerification(adminId, userId, body) {
  await ensureReady();
  const result = await repo.updatePoliceVerification({
    adminId: positiveId(adminId, 'admin id'),
    userId: positiveId(userId, 'police user id'),
    status: 'REJECTED',
    reason: boundedText(body?.reason || body?.note, { required: true, label: 'Rejection reason' }),
  });
  handleMutationStatus(result);
  return repo.getPoliceVerificationByUserId(userId);
}

async function getVerificationById(id) {
  await ensureReady();
  const verification = await repo.getVerificationById(positiveId(id, 'verification id'));
  if (!verification) throw httpError(404, 'Verification not found.');
  return verification;
}

async function approveVerification(adminId, id) {
  await ensureReady();
  const result = await repo.updateVerification({
    adminId: positiveId(adminId, 'admin id'),
    id: positiveId(id, 'verification id'),
    status: 'verified',
  });
  handleMutationStatus(result);
  return getVerificationById(id);
}

async function rejectVerification(adminId, id, body) {
  await ensureReady();
  const result = await repo.updateVerification({
    adminId: positiveId(adminId, 'admin id'),
    id: positiveId(id, 'verification id'),
    status: 'rejected',
    reason: boundedText(body?.reason || body?.note, { required: true, label: 'Rejection reason' }),
  });
  handleMutationStatus(result);
  return getVerificationById(id);
}

async function listSafePlaces(status = 'PENDING') {
  await ensureReady();
  const filter = enumValue(status, VALID_SAFE_PLACE_FILTERS, 'PENDING');
  return repo.listSafePlaces(filter);
}

async function getSafePlaceById(id) {
  await ensureReady();
  const safePlace = await repo.getSafePlaceById(positiveId(id, 'safe place id'));
  if (!safePlace) throw httpError(404, 'Safe place request not found.');
  return safePlace;
}

async function approveSafePlace(adminId, id) {
  await ensureReady();
  const result = await repo.updateSafePlace({
    adminId: positiveId(adminId, 'admin id'),
    id: positiveId(id, 'safe place id'),
    status: 'CONFIRMED',
  });
  handleMutationStatus(result);
  return getSafePlaceById(id);
}

async function rejectSafePlace(adminId, id, body) {
  await ensureReady();
  const result = await repo.updateSafePlace({
    adminId: positiveId(adminId, 'admin id'),
    id: positiveId(id, 'safe place id'),
    status: 'REJECTED',
    reason: boundedText(body?.reason || body?.note, { required: true, label: 'Rejection reason' }),
  });
  handleMutationStatus(result);
  return getSafePlaceById(id);
}

async function listReports(status = 'PENDING') {
  await ensureReady();
  const filter = enumValue(status, VALID_REPORT_FILTERS, 'PENDING');
  return repo.listReports(filter);
}

async function getReportById(id) {
  await ensureReady();
  const report = await repo.getReportById(positiveId(id, 'report id'));
  if (!report) throw httpError(404, 'Report not found.');
  return report;
}

async function dismissReport(adminId, id, body) {
  await ensureReady();
  const result = await repo.actionReport({
    adminId: positiveId(adminId, 'admin id'),
    reportId: positiveId(id, 'report id'),
    action: 'dismiss',
    note: boundedText(body?.note || body?.reason, { required: false, label: 'Action note' }),
  });
  handleMutationStatus(result);
  return getReportById(id);
}

async function warnFromReport(adminId, id, body) {
  await ensureReady();
  const result = await repo.actionReport({
    adminId: positiveId(adminId, 'admin id'),
    reportId: positiveId(id, 'report id'),
    action: 'warn',
    note: boundedText(body?.note || body?.reason, { required: true, label: 'Warning note' }),
  });
  handleMutationStatus(result);
  return getReportById(id);
}

async function blockFromReport(adminId, id, body) {
  await ensureReady();
  const result = await repo.actionReport({
    adminId: positiveId(adminId, 'admin id'),
    reportId: positiveId(id, 'report id'),
    action: 'block',
    note: boundedText(body?.note || body?.reason, { required: true, label: 'Block note' }),
  });
  handleMutationStatus(result);
  return getReportById(id);
}

async function getNotifications() {
  await ensureReady();
  const overview = await repo.getOverview();
  const now = new Date().toISOString();
  const items = [];

  const add = (count, type, title, message) => {
    if (count > 0) {
      items.push({
        id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${count}`,
        type,
        title,
        message,
        read: false,
        createdAt: now,
      });
    }
  };

  add(overview.live.pendingVerifications, 'info', 'Pending Volunteer Verifications', `${overview.live.pendingVerifications} volunteer application(s) need review.`);
  add(overview.live.pendingSafePlaces, 'info', 'Pending Safe Place Requests', `${overview.live.pendingSafePlaces} community safe place request(s) need moderation.`);
  add(overview.live.pendingReports, 'alert', 'Pending User Reports', `${overview.live.pendingReports} report(s) require admin action.`);
  add(overview.live.activeSos, 'alert', 'Active SOS Incidents', `${overview.live.activeSos} live SOS incident(s) are active now.`);

  if (items.length === 0) {
    items.push({
      id: 'all-clear',
      type: 'success',
      title: 'All Clear',
      message: 'No pending admin actions right now.',
      read: true,
      createdAt: now,
    });
  }

  return { items };
}

async function listAuditLogs(limit) {
  await ensureReady();
  const parsedLimit = Number(limit || 100);
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 200)
    : 100;
  return repo.listAuditLogs(safeLimit);
}

async function listLawEnforcementRequests() {
  await ensureReady();
  return lawService.listAdminRequests();
}

async function getLawEnforcementRequest(adminId, requestId) {
  await ensureReady();
  return lawService.getAdminRequest(positiveId(adminId, 'admin id'), requestId);
}

async function listApprovedPolice() {
  await ensureReady();
  return lawService.listApprovedPolice();
}

async function assignLawEnforcementRequest(adminId, requestId, body) {
  await ensureReady();
  return lawService.assignRequest(positiveId(adminId, 'admin id'), requestId, body);
}

async function cancelLawEnforcementRequest(adminId, requestId, body) {
  await ensureReady();
  return lawService.cancelRequest(positiveId(adminId, 'admin id'), requestId, body);
}

module.exports = {
  getOverview,
  listIncidents,
  getIncidentById,
  listUsers,
  getUserById,
  warnUser,
  blockUser,
  unblockUser,
  listVerifications,
  getVerificationById,
  approveVerification,
  rejectVerification,
  listPoliceVerifications,
  approvePoliceVerification,
  rejectPoliceVerification,
  listSafePlaces,
  getSafePlaceById,
  approveSafePlace,
  rejectSafePlace,
  listReports,
  getReportById,
  dismissReport,
  warnFromReport,
  blockFromReport,
  getNotifications,
  listAuditLogs,
  listLawEnforcementRequests,
  getLawEnforcementRequest,
  listApprovedPolice,
  assignLawEnforcementRequest,
  cancelLawEnforcementRequest,
};

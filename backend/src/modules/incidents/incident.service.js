const { httpError } = require('../../utils/httpError');
const { createIncident, getIncidentZones, findIncidentById, updateIncidentStatus, cancelAllByUser, getMyIncidents: getMyIncidentsRepo } = require('./incident.repository');

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

async function clearMyHistory(userId) {
  return cancelAllByUser(userId);
}

/**
 * Get all incidents created by the authenticated user.
 * Transforms raw DB rows into the shape expected by the frontend IncidentCard:
 *   { id, incidentNumber, latitude, longitude, location, occurredAt, status }
 *
 * Status mapping:
 *   ACTIVE    → 'Active'   (SOS is on)
 *   RESOLVED  → 'Resolved' (SOS completed)
 *   CANCELLED → 'Cancelled' (user cancelled)
 */
async function getMyIncidents(userId) {
  const rows = await getMyIncidentsRepo(userId);
  return rows.map((row) => {
    // Map DB ENUM to frontend display status
    const statusMap = { ACTIVE: 'Active', RESOLVED: 'Resolved', CANCELLED: 'Cancelled' };
    return {
      id: String(row.id),
      incidentNumber: Number(row.id),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      location: row.address || `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`,
      occurredAt: row.created_at, // ISO timestamp
      occurredAtLabel: new Date(row.created_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      status: statusMap[row.status] || row.status,
    };
  });
}

module.exports = { reportIncident, getZones, getOne, cancelIncident, clearMyHistory, getMyIncidents };


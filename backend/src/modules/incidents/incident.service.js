const { httpError } = require('../../utils/httpError');
const { createIncident, getIncidentZones } = require('./incident.repository');

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

module.exports = { reportIncident, getZones };

const { httpError } = require('../../utils/httpError');
const {
  saveLocation,
  getUserLocations,
  updateLocation,
  getLastLocation,
} = require('./location.repository');

const MAX_LOCATIONS = 2;
const PROXIMITY_KM = 5;

/**
 * Haversine formula — returns distance in kilometres between two coordinates.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function save(userId, payload) {
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

  // --- enforce 2-record limit with 5 km proximity replacement ---
  const existing = await getUserLocations(userId);

  // 1. Check if any existing location is within 5 km → update it
  for (const loc of existing) {
    const dist = haversineKm(latitude, longitude, Number(loc.latitude), Number(loc.longitude));
    if (dist <= PROXIMITY_KM) {
      return updateLocation(loc.id, { latitude, longitude, address });
    }
  }

  // 2. Under the cap → insert normally
  if (existing.length < MAX_LOCATIONS) {
    return saveLocation({ userId, latitude, longitude, address });
  }

  // 3. At the cap, none nearby → replace the oldest record
  const oldest = existing[0]; // ordered ASC by recorded_at
  return updateLocation(oldest.id, { latitude, longitude, address });
}

async function getLast(userId) {
  return getLastLocation(userId);
}

module.exports = { save, getLast };

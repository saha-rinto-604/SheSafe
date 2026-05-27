const { httpError } = require('../../utils/httpError');
const {
  createSafePlace,
  countPendingByUser,
  findExactDuplicate,
  findNearbyDuplicate,
  getConfirmedSafePlaces,
  deleteByUser,
} = require('./safe-places.repository');

function formatZone(row) {
  return {
    id: String(row.id),
    name: row.name || 'Safe Place',
    address: row.address || null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    description: row.description,
    status: row.status,
    radius: 150,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  };
}

async function report(userId, payload) {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  const address = String(payload.address || '').trim() || null;

  if (!isFinite(latitude) || !isFinite(longitude)) {
    throw httpError(400, 'Valid latitude and longitude are required.');
  }
  if (!name) throw httpError(400, 'Place name is required.');
  if (!description) throw httpError(400, 'Description is required.');

  const pendingCount = await countPendingByUser(userId);
  if (pendingCount >= 5) {
    throw httpError(429, 'You can have at most 5 pending safe place requests.');
  }

  const exactDuplicate = await findExactDuplicate({ latitude, longitude, name });
  if (exactDuplicate) {
    throw httpError(409, 'This safe place has already been submitted.');
  }

  const nearbyDuplicate = await findNearbyDuplicate({ latitude, longitude, radiusMeters: 100 });
  if (nearbyDuplicate) {
    throw httpError(409, 'A nearby safe place already exists or is pending review.');
  }

  const row = await createSafePlace({ userId, latitude, longitude, name, address, description });
  return formatZone(row);
}

async function listZones() {
  const rows = await getConfirmedSafePlaces();
  return rows.map(formatZone);
}

async function deleteMyData(userId) {
  return deleteByUser(userId);
}

module.exports = { report, listZones, deleteMyData };

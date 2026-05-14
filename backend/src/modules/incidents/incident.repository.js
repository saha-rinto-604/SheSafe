const { query } = require('../../config/db');

/**
 * Insert a new incident record.
 */
async function createIncident({ userId, latitude, longitude, address }) {
  const result = await query(
    `INSERT INTO incidents (user_id, latitude, longitude, address)
     VALUES (?, ?, ?, ?)`,
    [userId, latitude, longitude, address || null]
  );
  const rows = await query(
    `SELECT id, user_id, latitude, longitude, address, status, created_at
     FROM incidents WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

/**
 * Fetch all non-cancelled incidents (ACTIVE or RESOLVED) with user details.
 */
async function getActiveIncidents() {
  return query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address, i.status, i.created_at,
            u.first_name, u.last_name
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     WHERE i.status != 'CANCELLED'
     ORDER BY i.created_at DESC`
  );
}

/**
 * Aggregate incidents into geographic zones.
 *
 * Algorithm:
 * 1. Fetch all non-cancelled incidents.
 * 2. Cluster them using a greedy 500-metre radius approach:
 *    - For each incident, check if it falls within 500m of an existing cluster centre.
 *    - If yes, add it to that cluster. If no, start a new cluster centred on it.
 * 3. Return zones with centre coords, incident count, and a representative name.
 *
 * NOTE: This clustering is done in JS because MySQL doesn't natively support
 * geographic distance grouping without spatial extensions.  For the expected
 * volume (< a few hundred incidents) this is perfectly adequate.
 */
const CLUSTER_RADIUS_M = 500;
const EARTH_RADIUS_M = 6_371_000;

function haversineM(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(a));
}

async function getIncidentZones() {
  const incidents = await getActiveIncidents();

  /** @type {{ latitude: number, longitude: number, address: string|null, count: number, incidents: any[] }[]} */
  const clusters = [];

  for (const inc of incidents) {
    const lat = Number(inc.latitude);
    const lon = Number(inc.longitude);
    let merged = false;

    // Format incident details for frontend
    const incidentDetail = {
      id: inc.id,
      reporter: `${inc.first_name} ${inc.last_name}`.trim(),
      time: inc.created_at, // Send ISO string or raw Date
      status: inc.status
    };

    for (const cluster of clusters) {
      if (haversineM(lat, lon, cluster.latitude, cluster.longitude) <= CLUSTER_RADIUS_M) {
        // Weighted average to shift centre towards new point (simple approach)
        const total = cluster.count + 1;
        cluster.latitude = (cluster.latitude * cluster.count + lat) / total;
        cluster.longitude = (cluster.longitude * cluster.count + lon) / total;
        cluster.count = total;
        cluster.incidents.push(incidentDetail);
        // Keep the first non-null address as zone name
        if (!cluster.address && inc.address) cluster.address = inc.address;
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        latitude: lat,
        longitude: lon,
        address: inc.address || null,
        count: 1,
        incidents: [incidentDetail],
      });
    }
  }

  return clusters.map((c, i) => ({
    id: `zone-${i + 1}`,
    name: c.address || `Incident Zone ${i + 1}`,
    latitude: c.latitude,
    longitude: c.longitude,
    radius: 200, // visual display radius in metres
    incidentCount: c.count,
    incidents: c.incidents,
  }));
}

async function findIncidentById(id) {
  const rows = await query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address, i.status, i.created_at,
            u.first_name, u.last_name
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     WHERE i.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function updateIncidentStatus(id, status) {
  await query(
    `UPDATE incidents SET status = ? WHERE id = ?`,
    [status, id]
  );
  return findIncidentById(id);
}

async function cancelAllByUser(userId) {
  const result = await query(
    `UPDATE incidents SET status = 'CANCELLED' WHERE user_id = ? AND status = 'ACTIVE'`,
    [userId]
  );
  return { cancelled: result.affectedRows };
}

module.exports = { createIncident, getActiveIncidents, getIncidentZones, findIncidentById, updateIncidentStatus, cancelAllByUser };

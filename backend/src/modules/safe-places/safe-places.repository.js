const { query } = require('../../config/db');

async function createSafePlace({ userId, latitude, longitude, name, address, description }) {
  const result = await query(
    `INSERT INTO safe_places (reported_by, latitude, longitude, name, address, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, latitude, longitude, name, address || null, description]
  );
  const rows = await query(
    `SELECT sp.id, sp.latitude, sp.longitude, sp.name, sp.address, sp.description, sp.status, sp.created_at,
            u.first_name, u.last_name
     FROM safe_places sp
     JOIN users u ON sp.reported_by = u.id
     WHERE sp.id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

async function countPendingByUser(userId) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM safe_places
     WHERE reported_by = ?
       AND status = 'PENDING'`,
    [userId]
  );
  return Number(rows[0]?.count || 0);
}

async function findExactDuplicate({ latitude, longitude, name }) {
  const rows = await query(
    `SELECT id
     FROM safe_places
     WHERE LOWER(name) = LOWER(?)
       AND latitude = ?
       AND longitude = ?
       AND UPPER(status) IN ('PENDING','CONFIRMED','APPROVED')
     LIMIT 1`,
    [name, latitude, longitude]
  );
  return rows[0] || null;
}

async function findNearbyDuplicate({ latitude, longitude, radiusMeters = 100 }) {
  const rows = await query(
    `SELECT id, name,
            (6371000 * ACOS(LEAST(1,
              COS(RADIANS(?)) * COS(RADIANS(latitude)) *
              COS(RADIANS(longitude) - RADIANS(?)) +
              SIN(RADIANS(?)) * SIN(RADIANS(latitude))
            ))) AS distance_m
     FROM safe_places
     WHERE UPPER(status) IN ('PENDING','CONFIRMED','APPROVED')
     HAVING distance_m <= ?
     ORDER BY distance_m ASC
     LIMIT 1`,
    [latitude, longitude, latitude, radiusMeters]
  );
  return rows[0] || null;
}

async function getConfirmedSafePlaces() {
  return query(
    `SELECT id, latitude, longitude, name, address, description, status, created_at
     FROM safe_places
     WHERE UPPER(status) IN ('CONFIRMED', 'APPROVED')
     ORDER BY created_at DESC`
  );
}

async function getAllSafePlaces() {
  return query(
    `SELECT sp.id, sp.latitude, sp.longitude, sp.name, sp.address, sp.description, sp.status, sp.created_at,
            u.first_name, u.last_name
     FROM safe_places sp
     JOIN users u ON sp.reported_by = u.id
     ORDER BY sp.created_at DESC`
  );
}

async function deleteByUser(userId) {
  const result = await query(`DELETE FROM safe_places WHERE reported_by = ?`, [userId]);
  return { deleted: result.affectedRows };
}

module.exports = {
  createSafePlace,
  countPendingByUser,
  findExactDuplicate,
  findNearbyDuplicate,
  getConfirmedSafePlaces,
  getAllSafePlaces,
  deleteByUser,
};

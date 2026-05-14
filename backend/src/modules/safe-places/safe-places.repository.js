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

async function getConfirmedSafePlaces() {
  return query(
    `SELECT id, latitude, longitude, name, address, description, status, created_at
     FROM safe_places
     WHERE status = 'CONFIRMED'
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

module.exports = { createSafePlace, getConfirmedSafePlaces, getAllSafePlaces, deleteByUser };

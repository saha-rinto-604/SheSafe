const { query } = require('../../config/db');

async function saveLocation({ userId, latitude, longitude, address }) {
  const result = await query(
    `INSERT INTO user_locations (user_id, latitude, longitude, address)
     VALUES (?, ?, ?, ?)`,
    [userId, latitude, longitude, address || null]
  );
  const rows = await query(
    `SELECT id, user_id, latitude, longitude, address, recorded_at
     FROM user_locations WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

async function getUserLocations(userId) {
  return query(
    `SELECT id, user_id, latitude, longitude, address, recorded_at
     FROM user_locations
     WHERE user_id = ?
     ORDER BY recorded_at ASC`,
    [userId]
  );
}

async function updateLocation(id, { latitude, longitude, address }) {
  await query(
    `UPDATE user_locations
     SET latitude = ?, longitude = ?, address = ?, recorded_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [latitude, longitude, address || null, id]
  );
  const rows = await query(
    `SELECT id, user_id, latitude, longitude, address, recorded_at
     FROM user_locations WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0];
}

async function getLastLocation(userId) {
  const rows = await query(
    `SELECT id, user_id, latitude, longitude, address, recorded_at
     FROM user_locations
     WHERE user_id = ?
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { saveLocation, getUserLocations, updateLocation, getLastLocation };

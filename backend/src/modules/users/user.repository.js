/**
 * user.repository.js — User Data Access Layer
 * ──────────────────────────────────────────────────────────────────────
 * Why a Repository pattern:
 *   All SQL queries for the `users` table live here. If we ever migrate
 *   from MySQL to PostgreSQL (or add an ORM), only this file changes.
 *   Services and Controllers remain untouched.
 *
 * SQL Injection Prevention:
 *   All queries use parameterized placeholders (?). The mysql2 driver
 *   handles escaping automatically — we never concatenate user input
 *   into SQL strings.
 */

const { query } = require('../../config/db');

// ── Auth-oriented queries (existing) ─────────────────────────────────────────

async function findRoleByName(roleName) {
  const rows = await query(
    'SELECT id, role_name FROM roles WHERE role_name = ? LIMIT 1',
    [roleName]
  );
  return rows[0] || null;
}

async function listRoles() {
  return query('SELECT id, role_name FROM roles ORDER BY id ASC');
}

async function findUserByPhone(phoneNumber) {
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.password_hash,
            u.photo_url, u.dob, u.gender, u.blood_group, u.medical_info,
            u.home_address, u.entry_time,
            r.role_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.phone_number = ?
     LIMIT 1`,
    [phoneNumber]
  );
  return rows[0] || null;
}

async function createUser({ roleId, firstName, lastName, phoneNumber, passwordHash }) {
  const result = await query(
    `INSERT INTO users (role_id, first_name, last_name, phone_number, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [roleId, firstName, lastName, phoneNumber, passwordHash]
  );

  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.photo_url,
            u.dob, u.gender, u.blood_group, u.medical_info, u.home_address,
            u.entry_time, r.role_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

// ── Profile-oriented queries (new) ───────────────────────────────────────────

/**
 * Find a user by their numeric ID. Used by the profile service.
 *
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function findUserById(userId) {
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.password_hash,
            u.photo_url, u.dob, u.gender, u.blood_group, u.medical_info,
            u.home_address, u.entry_time,
            r.role_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Generic update for the users table. Accepts a map of column→value pairs.
 *
 * Why dynamic SET clause:
 *   The frontend sends partial updates (PATCH semantics). We only SET the
 *   columns that were actually provided, leaving others untouched.
 *   Parameterized queries prevent SQL injection even with dynamic column names
 *   because we whitelist allowed column names in the service layer.
 *
 * @param {number} userId
 * @param {Object} updates - { column_name: value } pairs
 */
async function updateUser(userId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k]);
  values.push(userId);

  await query(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
}

/**
 * Update only the password_hash for the given user ID.
 * Separated from generic update for clarity and audit logging.
 *
 * @param {number} userId
 * @param {string} passwordHash - bcrypt hash
 */
async function updatePasswordHash(userId, passwordHash) {
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

/**
 * Transforms a raw database row into the public profile shape
 * expected by the frontend. Strips sensitive fields (password_hash).
 *
 * Why this transformation:
 *   - The frontend expects camelCase keys; the database uses snake_case.
 *   - password_hash must never leave the server.
 *   - medical_info is stored as JSON string in MySQL; we parse it back to array.
 *
 * @param {Object} row - Raw database row
 * @returns {Object} Public profile
 */
function toPublicProfile(row) {
  let medicalInfo = [];
  if (row.medical_info) {
    try {
      medicalInfo = typeof row.medical_info === 'string'
        ? JSON.parse(row.medical_info)
        : row.medical_info;
    } catch { /* default empty array */ }
  }

  return {
    id: row.id,
    role: row.role_name,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    phoneNumber: row.phone_number,
    photoUrl: row.photo_url || '',
    dobISO: row.dob ? new Date(row.dob).toISOString().split('T')[0] : '',
    gender: row.gender || '',
    bloodGroup: row.blood_group || '',
    medicalInfo,
    homeAddress: row.home_address || '',
    entryTime: row.entry_time,
  };
}

module.exports = {
  findRoleByName,
  listRoles,
  findUserByPhone,
  createUser,
  findUserById,
  updateUser,
  updatePasswordHash,
  toPublicProfile,
};

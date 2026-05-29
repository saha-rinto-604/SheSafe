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

const { pool, query } = require('../../config/db');
const { phoneSearchVariants } = require('../../utils/phone');

let hasPoliceProfilesTableCache;

async function hasPoliceProfilesTable() {
  if (hasPoliceProfilesTableCache === true) return true;
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'police_profiles'`
  );
  hasPoliceProfilesTableCache = Number(rows[0]?.count || 0) > 0;
  return hasPoliceProfilesTableCache;
}

async function preparePoliceProfilesForRead() {
  const hasTable = await hasPoliceProfilesTable();
  if (hasTable) await ensurePoliceProfilesSchema();
  return hasTable;
}

async function ensurePoliceProfilesSchema(conn = null) {
  const execute = conn
    ? (sql, params = []) => conn.execute(sql, params)
    : (sql, params = []) => query(sql, params);

  await execute(
    `CREATE TABLE IF NOT EXISTS police_profiles (
      user_id BIGINT UNSIGNED NOT NULL,
      police_station_or_unit VARCHAR(255) NOT NULL,
      badge_number VARCHAR(120) NOT NULL,
      nid_card_url TEXT DEFAULT NULL,
      selfie_url TEXT DEFAULT NULL,
      job_id_card_url TEXT DEFAULT NULL,
      verification_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
      rejection_reason TEXT DEFAULT NULL,
      submitted_at TIMESTAMP NULL DEFAULT NULL,
      reviewed_by BIGINT UNSIGNED DEFAULT NULL,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      UNIQUE KEY uq_police_profiles_badge_number (badge_number),
      KEY idx_police_profiles_status (verification_status),
      CONSTRAINT fk_police_profiles_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT fk_police_profiles_reviewed_by FOREIGN KEY (reviewed_by)
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
    )`
  );

  for (const column of [
    ['nid_card_url', 'TEXT DEFAULT NULL AFTER badge_number'],
    ['selfie_url', 'TEXT DEFAULT NULL AFTER nid_card_url'],
    ['job_id_card_url', 'TEXT DEFAULT NULL AFTER selfie_url'],
    ['verification_status', "ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING' AFTER job_id_card_url"],
    ['rejection_reason', 'TEXT DEFAULT NULL AFTER verification_status'],
    ['submitted_at', 'TIMESTAMP NULL DEFAULT NULL AFTER rejection_reason'],
    ['reviewed_by', 'BIGINT UNSIGNED DEFAULT NULL AFTER submitted_at'],
    ['reviewed_at', 'TIMESTAMP NULL DEFAULT NULL AFTER reviewed_by'],
  ]) {
    const [name, definition] = column;
    const result = await execute(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'police_profiles'
         AND COLUMN_NAME = ?`,
      [name]
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : result;
    const count = Number(rows?.[0]?.count || 0);
    if (!count) {
      await execute(`ALTER TABLE police_profiles ADD COLUMN ${name} ${definition}`);
    }
  }

  hasPoliceProfilesTableCache = true;
}

function policeProfileSelect(hasTable) {
  return hasTable
    ? `pp.police_station_or_unit, pp.badge_number, pp.nid_card_url, pp.selfie_url, pp.job_id_card_url,
       pp.verification_status AS police_verification_status,
       pp.rejection_reason AS police_rejection_reason,
       pp.submitted_at AS police_submitted_at`
    : `NULL AS police_station_or_unit, NULL AS badge_number, NULL AS nid_card_url, NULL AS selfie_url, NULL AS job_id_card_url,
       NULL AS police_verification_status, NULL AS police_rejection_reason, NULL AS police_submitted_at`;
}

function policeProfileJoin(hasTable) {
  return hasTable ? 'LEFT JOIN police_profiles pp ON pp.user_id = u.id' : '';
}

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
  const hasPoliceProfiles = await preparePoliceProfilesForRead();
  const variants = phoneSearchVariants(phoneNumber);
  const placeholders = variants.map(() => '?').join(', ');
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.password_hash,
            u.photo_url, u.dob, u.gender, u.blood_group, u.medical_info,
            u.home_address, u.entry_time,
            r.role_name,
            ${policeProfileSelect(hasPoliceProfiles)}
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     ${policeProfileJoin(hasPoliceProfiles)}
     WHERE u.phone_number IN (${placeholders})
     ORDER BY CASE WHEN u.phone_number = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [...variants, variants[0] || phoneNumber]
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

async function createPoliceProfile({ userId, policeStationOrUnit, badgeNumber, jobIdCardUrl }) {
  await ensurePoliceProfilesSchema();
  await query(
    `INSERT INTO police_profiles
       (user_id, police_station_or_unit, badge_number, job_id_card_url, verification_status)
     VALUES (?, ?, ?, ?, 'PENDING')`,
    [userId, policeStationOrUnit, badgeNumber, jobIdCardUrl || null]
  );

  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.photo_url,
            u.dob, u.gender, u.blood_group, u.medical_info, u.home_address,
            u.entry_time, r.role_name,
            pp.police_station_or_unit, pp.badge_number, pp.nid_card_url, pp.selfie_url, pp.job_id_card_url,
            pp.verification_status AS police_verification_status,
            pp.rejection_reason AS police_rejection_reason
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN police_profiles pp ON pp.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function createPoliceUser({ roleId, firstName, lastName, phoneNumber, passwordHash, policeStationOrUnit, badgeNumber }) {
  await ensurePoliceProfilesSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO users (role_id, first_name, last_name, phone_number, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [roleId, firstName, lastName, phoneNumber, passwordHash]
    );

    await conn.execute(
      `INSERT INTO police_profiles
         (user_id, police_station_or_unit, badge_number, job_id_card_url, verification_status)
       VALUES (?, ?, ?, NULL, 'PENDING')`,
      [result.insertId, policeStationOrUnit, badgeNumber]
    );

    const [rows] = await conn.execute(
      `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.photo_url,
              u.dob, u.gender, u.blood_group, u.medical_info, u.home_address,
              u.entry_time, r.role_name,
              pp.police_station_or_unit, pp.badge_number, pp.nid_card_url, pp.selfie_url, pp.job_id_card_url,
              pp.verification_status AS police_verification_status,
              pp.rejection_reason AS police_rejection_reason
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       LEFT JOIN police_profiles pp ON pp.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    await conn.commit();
    return rows[0] || null;
  } catch (error) {
    await conn.rollback();
    if (error?.code === 'ER_DUP_ENTRY' && String(error?.message || '').includes('uq_police_profiles_badge_number')) {
      const err = new Error('Badge or job ID number is already registered.');
      err.status = 409;
      throw err;
    }
    throw error;
  } finally {
    conn.release();
  }
}

// ── Profile-oriented queries (new) ───────────────────────────────────────────

/**
 * Find a user by their numeric ID. Used by the profile service.
 *
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function findUserById(userId) {
  const hasPoliceProfiles = await preparePoliceProfilesForRead();
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.password_hash,
            u.photo_url, u.dob, u.gender, u.blood_group, u.medical_info,
            u.home_address, u.entry_time,
            r.role_name,
            ${policeProfileSelect(hasPoliceProfiles)}
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     ${policeProfileJoin(hasPoliceProfiles)}
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

  const hasPoliceDocuments = !!row.nid_card_url && !!row.selfie_url && !!row.job_id_card_url;
  const policeVerificationStatus = row.police_verification_status === 'APPROVED' || row.police_verification_status === 'REJECTED'
    ? row.police_verification_status
    : hasPoliceDocuments && row.police_submitted_at
      ? row.police_verification_status
      : row.police_verification_status
        ? 'NOT_SUBMITTED'
        : null;

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
    verificationStatus: policeVerificationStatus,
    policeProfile: row.police_verification_status ? {
      policeStationOrUnit: row.police_station_or_unit || '',
      badgeNumber: row.badge_number || '',
      nidCardUrl: row.nid_card_url || '',
      selfieUrl: row.selfie_url || '',
      jobIdCardUrl: row.job_id_card_url || '',
      rejectionReason: row.police_rejection_reason || '',
      submittedAt: row.police_submitted_at ? new Date(row.police_submitted_at).toISOString() : '',
    } : null,
  };
}

module.exports = {
  findRoleByName,
  listRoles,
  findUserByPhone,
  createUser,
  createPoliceProfile,
  createPoliceUser,
  ensurePoliceProfilesSchema,
  findUserById,
  updateUser,
  updatePasswordHash,
  toPublicProfile,
};

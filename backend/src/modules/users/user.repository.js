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

const crypto = require('crypto');
const { pool, query } = require('../../config/db');
const { phoneSearchVariants } = require('../../utils/phone');
const { ensureVolunteerDispatchSchema } = require('../incidents/incident.repository');

let hasPoliceProfilesTableCache;
let userBlockSchemaReady = false;
let userIdentitySchemaReady = false;

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function rowsFromExecuteResult(result) {
  return Array.isArray(result?.[0]) ? result[0] : result;
}

async function executeMaybe(conn, sql, params = []) {
  if (conn) {
    const [rows] = await conn.execute(sql, params);
    return rows;
  }
  return query(sql, params);
}

async function hasUserColumn(columnName, conn = null) {
  const rows = await executeMaybe(
    conn,
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  return Number(rowsFromExecuteResult(rows)?.[0]?.count || rows?.[0]?.count || 0) > 0;
}

async function hasUserIndex(indexName, conn = null) {
  const rows = await executeMaybe(
    conn,
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND INDEX_NAME = ?`,
    [indexName]
  );
  return Number(rowsFromExecuteResult(rows)?.[0]?.count || rows?.[0]?.count || 0) > 0;
}

function normalizeUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  return username || '';
}

function assertValidUsername(value) {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) {
    const err = new Error('Username must be 3-30 characters and use only lowercase letters, numbers, and underscores.');
    err.status = 400;
    throw err;
  }
  return username;
}

function usernameBaseFromName(firstName) {
  const base = String(firstName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  return (base || 'user').slice(0, 18);
}

function randomDigits(length = 4) {
  const max = 10 ** length;
  return String(crypto.randomInt(0, max)).padStart(length, '0');
}

async function isUsernameTaken(username, { conn = null, excludeUserId = null } = {}) {
  const params = [username];
  let sql = 'SELECT id FROM users WHERE username = ?';
  if (excludeUserId) {
    sql += ' AND id <> ?';
    params.push(excludeUserId);
  }
  sql += ' LIMIT 1';
  const rows = await executeMaybe(conn, sql, params);
  return rows.length > 0;
}

async function generateUniqueUsername(firstName, { conn = null, excludeUserId = null, skipEnsure = false, taken = null } = {}) {
  if (!skipEnsure) await ensureUserIdentitySchema(conn);
  const base = usernameBaseFromName(firstName);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${base}${randomDigits(4)}`;
    if (taken) {
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    } else if (!(await isUsernameTaken(candidate, { conn, excludeUserId }))) {
      return candidate;
    }
  }
  const fallback = `${base}${Date.now().toString().slice(-8)}`.slice(0, 30);
  if (taken) taken.add(fallback);
  return fallback;
}

async function ensureUserIdentitySchema(conn = null) {
  if (!conn && userIdentitySchemaReady) return;

  if (!(await hasUserColumn('username', conn))) {
    await executeMaybe(conn, 'ALTER TABLE users ADD COLUMN username VARCHAR(50) NULL AFTER last_name');
  }

  await executeMaybe(conn, 'UPDATE users SET username = LOWER(username) WHERE username IS NOT NULL');

  const rows = await executeMaybe(
    conn,
    `SELECT id, first_name, username
     FROM users
     ORDER BY id ASC`
  );
  const taken = new Set();
  for (const row of rows) {
    const current = normalizeUsername(row.username);
    if (!USERNAME_PATTERN.test(current) || taken.has(current)) {
      const next = await generateUniqueUsername(row.first_name, { conn, skipEnsure: true, taken });
      await executeMaybe(conn, 'UPDATE users SET username = ? WHERE id = ?', [next, row.id]);
    } else {
      taken.add(current);
    }
  }

  if (!(await hasUserIndex('uq_users_username', conn))) {
    await executeMaybe(conn, 'ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)');
  }

  if (!conn) userIdentitySchemaReady = true;
}

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
  await ensureUserIdentitySchema();
  const hasPoliceProfiles = await preparePoliceProfilesForRead();
  const variants = phoneSearchVariants(phoneNumber);
  const placeholders = variants.map(() => '?').join(', ');
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.username, u.phone_number, u.password_hash,
            u.photo_url, u.dob, u.gender, u.blood_group, u.medical_info,
            u.home_address, u.entry_time, u.accept_sos_requests,
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
  await ensureUserIdentitySchema();
  const username = await generateUniqueUsername(firstName);
  const result = await query(
    `INSERT INTO users (role_id, first_name, last_name, username, phone_number, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [roleId, firstName, lastName, username, phoneNumber, passwordHash]
  );

  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.username, u.phone_number, u.photo_url,
            u.dob, u.gender, u.blood_group, u.medical_info, u.home_address,
            u.accept_sos_requests, u.entry_time, r.role_name
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
    `SELECT u.id, u.first_name, u.last_name, u.username, u.phone_number, u.photo_url,
            u.dob, u.gender, u.blood_group, u.medical_info, u.home_address,
            u.accept_sos_requests,
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
  await ensureUserIdentitySchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const username = await generateUniqueUsername(firstName, { conn, skipEnsure: true });
    const [result] = await conn.execute(
      `INSERT INTO users (role_id, first_name, last_name, username, phone_number, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roleId, firstName, lastName, username, phoneNumber, passwordHash]
    );

    await conn.execute(
      `INSERT INTO police_profiles
         (user_id, police_station_or_unit, badge_number, job_id_card_url, verification_status)
       VALUES (?, ?, ?, NULL, 'PENDING')`,
      [result.insertId, policeStationOrUnit, badgeNumber]
    );

    const [rows] = await conn.execute(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.phone_number, u.photo_url,
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
  await ensureUserIdentitySchema();
  const hasPoliceProfiles = await preparePoliceProfilesForRead();
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.username, u.phone_number, u.password_hash,
            u.photo_url, u.dob, u.gender, u.blood_group, u.medical_info,
            u.home_address, u.entry_time, u.accept_sos_requests,
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
  const allowedColumns = new Set([
    'first_name',
    'last_name',
    'username',
    'phone_number',
    'dob',
    'gender',
    'blood_group',
    'medical_info',
    'home_address',
    'accept_sos_requests',
    'photo_url',
  ]);
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const blocked = keys.filter((key) => !allowedColumns.has(key));
  if (blocked.length) {
    const err = new Error('Protected profile field update rejected.');
    err.status = 400;
    throw err;
  }

  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k]);
  values.push(userId);

  try {
    await query(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY' && String(error?.message || '').includes('uq_users_username')) {
      const err = new Error('Username is already taken.');
      err.status = 409;
      throw err;
    }
    throw error;
  }
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

async function ensureUserBlockSchema() {
  if (userBlockSchemaReady) return;
  await query(
    `CREATE TABLE IF NOT EXISTS user_blocks (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       blocker_user_id BIGINT UNSIGNED NOT NULL,
       blocked_user_id BIGINT UNSIGNED NOT NULL,
       reason VARCHAR(255) DEFAULT NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_user_blocks_pair (blocker_user_id, blocked_user_id),
       KEY idx_user_blocks_blocker_created (blocker_user_id, created_at),
       KEY idx_user_blocks_blocked (blocked_user_id),
       CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_user_id)
         REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_user_id)
         REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
     )`
  );
  userBlockSchemaReady = true;
}

function isoOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function safeConnectionRow(row) {
  return {
    userId: Number(row.user_id),
    displayName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'SheSafe user',
    role: row.role_name,
    avatarUrl: row.photo_url || null,
    lastIncidentId: row.last_incident_id == null ? null : Number(row.last_incident_id),
    lastIncidentCode: row.last_incident_code || (row.last_incident_id ? `#${row.last_incident_id}` : null),
    lastConnectedAt: isoOrNull(row.last_connected_at),
    connectionLabel: row.connection_label,
    isBlocked: Number(row.is_blocked || 0) > 0,
  };
}

async function listConnectedUsers(userId) {
  await ensureVolunteerDispatchSchema();
  await ensureUserBlockSchema();
  const rows = await query(
    `SELECT *
     FROM (
       SELECT
         v.id AS user_id,
         v.first_name,
         v.last_name,
         v.photo_url,
         vr.role_name,
         i.id AS last_incident_id,
         CONCAT('#', i.id) AS last_incident_code,
         COALESCE(iv.updated_at, iv.accepted_at, i.updated_at, i.created_at) AS last_connected_at,
         'Helped in incident' AS connection_label,
         CASE WHEN ub.id IS NULL THEN 0 ELSE 1 END AS is_blocked
       FROM incidents i
       JOIN incident_volunteers iv ON iv.incident_id = i.id
        AND iv.status = 'ACCEPTED'
       JOIN users v ON v.id = iv.volunteer_id
       JOIN roles vr ON vr.id = v.role_id AND vr.role_name = 'volunteer'
       LEFT JOIN user_blocks ub ON ub.blocker_user_id = ? AND ub.blocked_user_id = v.id
       WHERE i.user_id = ?
         AND iv.volunteer_id <> ?

       UNION ALL

       SELECT
         victim.id AS user_id,
         victim.first_name,
         victim.last_name,
         victim.photo_url,
         rr.role_name,
         i.id AS last_incident_id,
         CONCAT('#', i.id) AS last_incident_code,
         COALESCE(iv.updated_at, iv.accepted_at, i.updated_at, i.created_at) AS last_connected_at,
         'You helped this user' AS connection_label,
         CASE WHEN ub.id IS NULL THEN 0 ELSE 1 END AS is_blocked
       FROM incident_volunteers iv
       JOIN incidents i ON i.id = iv.incident_id
       JOIN users victim ON victim.id = i.user_id
       JOIN roles rr ON rr.id = victim.role_id AND rr.role_name = 'standard_user'
       LEFT JOIN user_blocks ub ON ub.blocker_user_id = ? AND ub.blocked_user_id = victim.id
       WHERE iv.volunteer_id = ?
         AND iv.status = 'ACCEPTED'
         AND i.user_id <> ?

       UNION ALL

       SELECT
         v.id AS user_id,
         v.first_name,
         v.last_name,
         v.photo_url,
         vr.role_name,
         i.id AS last_incident_id,
         CONCAT('#', i.id) AS last_incident_code,
         COALESCE(other_ip.joined_at, i.updated_at, i.created_at) AS last_connected_at,
         'Shared incident chat' AS connection_label,
         CASE WHEN ub.id IS NULL THEN 0 ELSE 1 END AS is_blocked
       FROM incident_participants self_ip
       JOIN incidents i ON i.id = self_ip.incident_id
       JOIN incident_participants other_ip ON other_ip.incident_id = self_ip.incident_id
        AND other_ip.user_id <> self_ip.user_id
       JOIN users v ON v.id = other_ip.user_id
       JOIN roles vr ON vr.id = v.role_id AND vr.role_name = 'volunteer'
       LEFT JOIN user_blocks ub ON ub.blocker_user_id = ? AND ub.blocked_user_id = v.id
       WHERE self_ip.user_id = ?
         AND i.user_id = ?
         AND v.id <> ?

       UNION ALL

       SELECT
         victim.id AS user_id,
         victim.first_name,
         victim.last_name,
         victim.photo_url,
         rr.role_name,
         i.id AS last_incident_id,
         CONCAT('#', i.id) AS last_incident_code,
         COALESCE(self_ip.joined_at, i.updated_at, i.created_at) AS last_connected_at,
         'Shared incident chat' AS connection_label,
         CASE WHEN ub.id IS NULL THEN 0 ELSE 1 END AS is_blocked
       FROM incident_participants self_ip
       JOIN incidents i ON i.id = self_ip.incident_id
       JOIN users victim ON victim.id = i.user_id
       JOIN roles rr ON rr.id = victim.role_id AND rr.role_name = 'standard_user'
       LEFT JOIN user_blocks ub ON ub.blocker_user_id = ? AND ub.blocked_user_id = victim.id
       WHERE self_ip.user_id = ?
         AND i.user_id <> ?
     ) connected
     ORDER BY last_connected_at DESC, last_incident_id DESC`,
    [
      userId, userId, userId,
      userId, userId, userId,
      userId, userId, userId, userId,
      userId, userId, userId,
    ]
  );

  const seen = new Map();
  for (const row of rows) {
    const id = Number(row.user_id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.set(id, safeConnectionRow(row));
  }
  return [...seen.values()];
}

async function areUsersConnected(userId, otherUserId) {
  const connected = await listConnectedUsers(userId);
  return connected.some((u) => Number(u.userId) === Number(otherUserId));
}

async function findBlockableUserFor(userId, otherUserId) {
  await ensureUserBlockSchema();
  const rows = await query(
    `SELECT u.id, r.role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
       AND r.role_name IN ('standard_user', 'volunteer')
     LIMIT 1`,
    [otherUserId]
  );
  if (!rows[0]) return null;
  const connected = await areUsersConnected(userId, otherUserId);
  return connected ? rows[0] : null;
}

async function listBlockedUsers(userId) {
  await ensureUserBlockSchema();
  const rows = await query(
    `SELECT
       ub.blocked_user_id AS user_id,
       ub.reason,
       ub.created_at AS blocked_at,
       u.first_name,
       u.last_name,
       u.photo_url,
       r.role_name
     FROM user_blocks ub
     JOIN users u ON u.id = ub.blocked_user_id
     JOIN roles r ON r.id = u.role_id
     WHERE ub.blocker_user_id = ?
       AND r.role_name IN ('standard_user', 'volunteer')
     ORDER BY ub.created_at DESC, ub.id DESC`,
    [userId]
  );
  return rows.map((row) => ({
    userId: Number(row.user_id),
    displayName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'SheSafe user',
    role: row.role_name,
    avatarUrl: row.photo_url || null,
    blockedAt: isoOrNull(row.blocked_at),
    reason: row.reason || null,
  }));
}

async function blockUser(blockerUserId, blockedUserId, reason = null) {
  await ensureUserBlockSchema();
  await query(
    `INSERT INTO user_blocks (blocker_user_id, blocked_user_id, reason)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       reason = COALESCE(VALUES(reason), reason),
       updated_at = NOW()`,
    [blockerUserId, blockedUserId, reason || null]
  );
  const rows = await query(
    `SELECT id, blocker_user_id, blocked_user_id, created_at, updated_at
     FROM user_blocks
     WHERE blocker_user_id = ? AND blocked_user_id = ?
     LIMIT 1`,
    [blockerUserId, blockedUserId]
  );
  return rows[0] || null;
}

async function unblockUser(blockerUserId, blockedUserId) {
  await ensureUserBlockSchema();
  await query(
    `DELETE FROM user_blocks
     WHERE blocker_user_id = ? AND blocked_user_id = ?`,
    [blockerUserId, blockedUserId]
  );
}

async function isUserBlockedBy(blockerUserId, blockedUserId) {
  await ensureUserBlockSchema();
  const rows = await query(
    `SELECT id
     FROM user_blocks
     WHERE blocker_user_id = ? AND blocked_user_id = ?
     LIMIT 1`,
    [blockerUserId, blockedUserId]
  );
  return rows.length > 0;
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
    username: row.username || '',
    phoneNumber: row.phone_number,
    photoUrl: row.photo_url || '',
    dobISO: row.dob ? new Date(row.dob).toISOString().split('T')[0] : '',
    gender: row.gender || '',
    bloodGroup: row.blood_group || '',
    medicalInfo,
    homeAddress: row.home_address || '',
    acceptSosRequests: row.accept_sos_requests === undefined || row.accept_sos_requests === null
      ? true
      : !!row.accept_sos_requests,
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
  ensureUserIdentitySchema,
  generateUniqueUsername,
  assertValidUsername,
  isUsernameTaken,
  ensureUserBlockSchema,
  listConnectedUsers,
  listBlockedUsers,
  findBlockableUserFor,
  blockUser,
  unblockUser,
  isUserBlockedBy,
};

const { pool, query } = require('../../config/db');
const { ensurePoliceProfilesSchema } = require('../users/user.repository');
const {
  approvedVolunteerAccountCondition,
  approvedVolunteerExistsCondition,
} = require('../volunteers/volunteerEligibility');

let schemaReadyPromise = null;

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function addColumnIfMissing(tableName, columnName, ddl) {
  if (!(await hasColumn(tableName, columnName))) {
    await query(ddl);
  }
}

async function ensureAdminSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await query(`INSERT IGNORE INTO roles (role_name) VALUES ('admin')`);
      await ensurePoliceProfilesSchema();

      await addColumnIfMissing(
        'users',
        'account_status',
        `ALTER TABLE users ADD COLUMN account_status ENUM('ACTIVE','WARNED','BLOCKED') NOT NULL DEFAULT 'ACTIVE'`
      );
      await addColumnIfMissing(
        'users',
        'warning_count',
        `ALTER TABLE users ADD COLUMN warning_count INT UNSIGNED NOT NULL DEFAULT 0`
      );
      await addColumnIfMissing(
        'users',
        'blocked_at',
        `ALTER TABLE users ADD COLUMN blocked_at TIMESTAMP NULL DEFAULT NULL`
      );
      await addColumnIfMissing(
        'users',
        'blocked_reason',
        `ALTER TABLE users ADD COLUMN blocked_reason VARCHAR(500) DEFAULT NULL`
      );
      await addColumnIfMissing(
        'users',
        'is_online',
        `ALTER TABLE users ADD COLUMN is_online TINYINT(1) NOT NULL DEFAULT 0`
      );

      await addColumnIfMissing(
        'safe_places',
        'reviewed_by',
        `ALTER TABLE safe_places ADD COLUMN reviewed_by BIGINT UNSIGNED NULL DEFAULT NULL`
      );
      await addColumnIfMissing(
        'safe_places',
        'reviewed_at',
        `ALTER TABLE safe_places ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL`
      );
      await addColumnIfMissing(
        'safe_places',
        'rejection_reason',
        `ALTER TABLE safe_places ADD COLUMN rejection_reason VARCHAR(500) DEFAULT NULL`
      );

      await addColumnIfMissing(
        'volunteer_verifications',
        'reviewed_by',
        `ALTER TABLE volunteer_verifications ADD COLUMN reviewed_by BIGINT UNSIGNED NULL DEFAULT NULL`
      );

      await query(
        `CREATE TABLE IF NOT EXISTS user_reports (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          reported_user_id BIGINT UNSIGNED NOT NULL,
          reported_by_user_id BIGINT UNSIGNED NOT NULL,
          incident_id BIGINT UNSIGNED NULL,
          reason TEXT NOT NULL,
          status ENUM('PENDING','DISMISSED','WARNED','BLOCKED') NOT NULL DEFAULT 'PENDING',
          action_note VARCHAR(500) DEFAULT NULL,
          actioned_by BIGINT UNSIGNED NULL,
          actioned_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_user_reports_status (status),
          KEY idx_user_reports_reported_user (reported_user_id),
          KEY idx_user_reports_reporter (reported_by_user_id),
          CONSTRAINT fk_user_reports_reported_user FOREIGN KEY (reported_user_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reported_by_user_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT fk_user_reports_incident FOREIGN KEY (incident_id)
            REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );

      await query(
        `CREATE TABLE IF NOT EXISTS admin_actions (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          admin_id BIGINT UNSIGNED NOT NULL,
          action_type VARCHAR(80) NOT NULL,
          target_type VARCHAR(80) NOT NULL,
          target_id BIGINT UNSIGNED NOT NULL,
          reason VARCHAR(500) DEFAULT NULL,
          metadata JSON DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_admin_actions_admin_created (admin_id, created_at),
          KEY idx_admin_actions_target (target_type, target_id),
          CONSTRAINT fk_admin_actions_admin FOREIGN KEY (admin_id)
            REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
    })();
  }

  return schemaReadyPromise;
}

function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function fullName(row, prefix = '') {
  const first = row[`${prefix}first_name`] || '';
  const last = row[`${prefix}last_name`] || '';
  return `${first} ${last}`.trim() || 'Unknown';
}

function publicUser(row, prefix = '') {
  const role = row[`${prefix}role_name`] || row.role_name || null;
  return {
    id: String(row[`${prefix}id`] ?? row.id),
    name: fullName(row, prefix),
    phone: row[`${prefix}phone_number`] || null,
    role,
    photoUrl: row[`${prefix}photo_url`] || null,
  };
}

function safeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function formatIncident(row, assignedVolunteers = []) {
  return {
    id: String(row.id),
    displayCode: `SOS-${row.id}`,
    status: row.status,
    victim: {
      id: String(row.user_id),
      name: fullName(row),
      phone: row.phone_number || null,
      photoUrl: row.photo_url || null,
    },
    location: {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      address: row.address || null,
    },
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at || row.created_at),
    volunteerCount: Number(row.volunteer_count || assignedVolunteers.length || 0),
    assignedVolunteers,
    userCaseDetails: parseJson(row.user_case_details),
    volunteerCaseDetails: parseJson(row.volunteer_case_details),
  };
}

async function getAssignedVolunteers(incidentIds) {
  if (!incidentIds.length) return new Map();
  const placeholders = incidentIds.map(() => '?').join(',');
  const rows = await query(
    `SELECT iv.incident_id, u.id, u.first_name, u.last_name, u.phone_number, u.photo_url,
            iv.accepted_at, iv.status
     FROM incident_volunteers iv
     JOIN users u ON u.id = iv.volunteer_id
     WHERE iv.incident_id IN (${placeholders})
       AND iv.status = 'ACCEPTED'
     ORDER BY iv.accepted_at ASC`,
    incidentIds
  );

  const map = new Map();
  for (const row of rows) {
    const key = String(row.incident_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      id: String(row.id),
      name: fullName(row),
      phone: row.phone_number || null,
      photoUrl: row.photo_url || null,
      acceptedAt: toIso(row.accepted_at),
      status: row.status,
    });
  }
  return map;
}

function incidentWhereForStatus(status) {
  const normalized = safeStatus(status || 'LIVE');
  if (normalized === 'LIVE') return { clause: `WHERE i.status IN ('ACTIVE','IN_PROGRESS')`, params: [] };
  if (normalized === 'RESOLVED') return { clause: `WHERE i.status = 'RESOLVED'`, params: [] };
  if (normalized === 'CANCELLED') return { clause: `WHERE i.status = 'CANCELLED'`, params: [] };
  return { clause: '', params: [] };
}

async function listIncidents(status) {
  const where = incidentWhereForStatus(status);
  const rows = await query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address, i.status,
            i.created_at, i.updated_at, i.user_case_details, i.volunteer_case_details,
            u.first_name, u.last_name, u.phone_number, u.photo_url,
            (SELECT COUNT(*)
             FROM incident_volunteers iv
             WHERE iv.incident_id = i.id AND iv.status = 'ACCEPTED') AS volunteer_count
     FROM incidents i
     JOIN users u ON u.id = i.user_id
     ${where.clause}
     ORDER BY FIELD(i.status, 'ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'), i.created_at DESC
     LIMIT 200`,
    where.params
  );

  const volunteerMap = await getAssignedVolunteers(rows.map((row) => Number(row.id)));
  return rows.map((row) => formatIncident(row, volunteerMap.get(String(row.id)) || []));
}

async function getIncidentById(id) {
  const rows = await query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address, i.status,
            i.created_at, i.updated_at, i.user_case_details, i.volunteer_case_details,
            u.first_name, u.last_name, u.phone_number, u.photo_url,
            (SELECT COUNT(*)
             FROM incident_volunteers iv
             WHERE iv.incident_id = i.id AND iv.status = 'ACCEPTED') AS volunteer_count
     FROM incidents i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const volunteerMap = await getAssignedVolunteers([id]);
  return formatIncident(rows[0], volunteerMap.get(String(id)) || []);
}

async function getOverview() {
  const [userCounts] = await query(
    `SELECT
       COUNT(*) AS total_users,
       SUM(CASE WHEN r.role_name = 'standard_user' THEN 1 ELSE 0 END) AS standard_users,
       SUM(CASE
         WHEN r.role_name = 'volunteer'
          AND ${approvedVolunteerExistsCondition('u')}
         THEN 1 ELSE 0 END) AS total_volunteers
     FROM users u
     JOIN roles r ON r.id = u.role_id`
  );

  const [volunteerCounts] = await query(
    `SELECT
       SUM(CASE
         WHEN LOWER(TRIM(vv.status)) = 'verified'
          AND ${approvedVolunteerAccountCondition('u')}
         THEN 1 ELSE 0 END) AS verified_volunteers,
       SUM(CASE WHEN LOWER(TRIM(vv.status)) = 'pending' THEN 1 ELSE 0 END) AS pending_verifications
     FROM users u
     JOIN roles r ON r.id = u.role_id AND LOWER(TRIM(r.role_name)) = 'volunteer'
     JOIN volunteer_verifications vv
       ON vv.id = (
         SELECT latest_vv.id
         FROM volunteer_verifications latest_vv
         WHERE latest_vv.user_id = u.id
         ORDER BY latest_vv.id DESC
         LIMIT 1
       )`
  );

  const [policeCounts] = await query(
    `SELECT
       SUM(CASE
         WHEN pp.verification_status = 'PENDING'
          AND pp.nid_card_url IS NOT NULL
          AND pp.selfie_url IS NOT NULL
          AND pp.job_id_card_url IS NOT NULL
          AND pp.submitted_at IS NOT NULL
         THEN 1 ELSE 0 END) AS pending_police_verifications,
       SUM(CASE WHEN pp.verification_status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_police
     FROM police_profiles pp`
  );

  const [incidentCounts] = await query(
    `SELECT
       SUM(CASE WHEN status IN ('ACTIVE','IN_PROGRESS') THEN 1 ELSE 0 END) AS active_sos,
       COUNT(*) AS total_incidents,
       SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_incidents,
       SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_incidents
     FROM incidents`
  );

  const [safePlaceCounts] = await query(
    `SELECT SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_safe_places
     FROM safe_places`
  );

  const [reportCounts] = await query(
    `SELECT
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_reports,
       COUNT(*) AS user_reports
     FROM user_reports`
  );

  const [onlineCounts] = await query(
    `SELECT COUNT(*) AS volunteers_online
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_name = 'volunteer'
       AND ${approvedVolunteerExistsCondition('u')}
       AND ${approvedVolunteerAccountCondition('u')}
       AND COALESCE(u.is_online, 0) = 1`
  );

  const activeSos = Number(incidentCounts?.active_sos || 0);
  const pendingVerifications = Number(volunteerCounts?.pending_verifications || 0)
    + Number(policeCounts?.pending_police_verifications || 0);
  const pendingSafePlaces = Number(safePlaceCounts?.pending_safe_places || 0);
  const pendingReports = Number(reportCounts?.pending_reports || 0);

  return {
    live: {
      activeSos,
      volunteersOnline: Number(onlineCounts?.volunteers_online || 0),
      pendingVerifications,
      pendingSafePlaces,
      pendingReports,
    },
    totals: {
      totalUsers: Number(userCounts?.total_users || 0),
      standardUsers: Number(userCounts?.standard_users || 0),
      totalVolunteers: Number(userCounts?.total_volunteers || 0),
      verifiedVolunteers: Number(volunteerCounts?.verified_volunteers || 0),
      totalIncidents: Number(incidentCounts?.total_incidents || 0),
      resolvedIncidents: Number(incidentCounts?.resolved_incidents || 0),
      cancelledIncidents: Number(incidentCounts?.cancelled_incidents || 0),
      userReports: Number(reportCounts?.user_reports || 0),
    },
    quickActions: {
      activeIncidents: activeSos,
      pendingVerifications,
      pendingSafePlaces,
      recentReports: pendingReports,
    },
  };
}

function formatUser(row) {
  return {
    id: String(row.id),
    name: fullName(row),
    phone: row.phone_number || null,
    role: row.role_name,
    photoUrl: row.photo_url || null,
    accountStatus: row.account_status || 'ACTIVE',
    warningCount: Number(row.warning_count || 0),
    blockedAt: toIso(row.blocked_at),
    blockedReason: row.blocked_reason || null,
    sosCount: Number(row.sos_count || 0),
    reportCount: Number(row.report_count || 0),
    joinedAt: toIso(row.entry_time),
    isOnline: Boolean(row.is_online),
    verificationStatus: row.verification_status || null,
    policeStationOrUnit: row.police_station_or_unit || null,
    badgeNumber: row.badge_number || null,
    nidCardUrl: row.nid_card_url || null,
    selfieUrl: row.selfie_url || null,
    jobIdCardUrl: row.job_id_card_url || null,
    policeSubmittedAt: toIso(row.police_submitted_at),
    policeReviewedAt: toIso(row.police_reviewed_at),
    policeRejectionReason: row.police_rejection_reason || null,
    activePoliceRequests: Number(row.active_police_requests || 0),
    assistedIncidents: Number(row.assisted_incidents || 0),
    points: Number(row.resolved_assisted || 0) * 100,
    rank: row.rank ? Number(row.rank) : null,
  };
}

async function listUsers(role) {
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.photo_url, u.entry_time,
            u.account_status, u.warning_count, u.blocked_at, u.blocked_reason,
            COALESCE(u.is_online, 0) AS is_online,
            r.role_name,
            CASE WHEN r.role_name = 'law_enforcement' THEN pp.verification_status ELSE vv.status END AS verification_status,
            pp.police_station_or_unit, pp.badge_number, pp.nid_card_url, pp.selfie_url, pp.job_id_card_url,
            pp.submitted_at AS police_submitted_at, pp.reviewed_at AS police_reviewed_at,
            pp.rejection_reason AS police_rejection_reason,
            (SELECT COUNT(*) FROM law_enforcement_requests ler
             WHERE ler.assigned_police_id = u.id
               AND ler.status IN ('ASSIGNED_TO_POLICE','ACCEPTED_BY_POLICE')) AS active_police_requests,
            (SELECT COUNT(*) FROM incidents i WHERE i.user_id = u.id) AS sos_count,
            (SELECT COUNT(*) FROM user_reports ur WHERE ur.reported_user_id = u.id) AS report_count,
            (SELECT COUNT(*) FROM incident_volunteers iv WHERE iv.volunteer_id = u.id AND iv.status = 'ACCEPTED') AS assisted_incidents,
            (SELECT COUNT(*)
             FROM incident_volunteers iv
             JOIN incidents i ON i.id = iv.incident_id
             WHERE iv.volunteer_id = u.id AND iv.status = 'ACCEPTED' AND i.status = 'RESOLVED') AS resolved_assisted
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN volunteer_verifications vv
       ON vv.id = (SELECT vv2.id
                   FROM volunteer_verifications vv2
                   WHERE vv2.user_id = u.id
                   ORDER BY vv2.created_at DESC, vv2.id DESC
                   LIMIT 1)
     LEFT JOIN police_profiles pp ON pp.user_id = u.id
     WHERE r.role_name = ?
     ORDER BY u.entry_time DESC
     LIMIT 300`,
    [role]
  );

  const users = rows.map(formatUser);
  if (role === 'volunteer') {
    users.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    users.forEach((user, index) => {
      user.rank = index + 1;
    });
  }
  return users;
}

async function getUserIncidents(userId) {
  const rows = await query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address, i.status,
            i.created_at, i.updated_at, i.user_case_details, i.volunteer_case_details,
            u.first_name, u.last_name, u.phone_number, u.photo_url,
            (SELECT COUNT(*) FROM incident_volunteers iv WHERE iv.incident_id = i.id AND iv.status = 'ACCEPTED') AS volunteer_count
     FROM incidents i
     JOIN users u ON u.id = i.user_id
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC
     LIMIT 50`,
    [userId]
  );
  const volunteerMap = await getAssignedVolunteers(rows.map((row) => Number(row.id)));
  return rows.map((row) => formatIncident(row, volunteerMap.get(String(row.id)) || []));
}

async function getVolunteerAssistedIncidents(userId) {
  const rows = await query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address, i.status,
            i.created_at, i.updated_at, i.user_case_details, i.volunteer_case_details,
            u.first_name, u.last_name, u.phone_number, u.photo_url,
            (SELECT COUNT(*) FROM incident_volunteers ivc WHERE ivc.incident_id = i.id AND ivc.status = 'ACCEPTED') AS volunteer_count
     FROM incident_volunteers iv
     JOIN incidents i ON i.id = iv.incident_id
     JOIN users u ON u.id = i.user_id
     WHERE iv.volunteer_id = ?
       AND iv.status = 'ACCEPTED'
     ORDER BY COALESCE(i.updated_at, i.created_at) DESC
     LIMIT 50`,
    [userId]
  );
  const volunteerMap = await getAssignedVolunteers(rows.map((row) => Number(row.id)));
  return rows.map((row) => formatIncident(row, volunteerMap.get(String(row.id)) || []));
}

async function getUserById(userId) {
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.photo_url, u.entry_time,
            u.account_status, u.warning_count, u.blocked_at, u.blocked_reason,
            COALESCE(u.is_online, 0) AS is_online,
            r.role_name,
            CASE WHEN r.role_name = 'law_enforcement' THEN pp.verification_status ELSE vv.status END AS verification_status,
            pp.police_station_or_unit, pp.badge_number, pp.nid_card_url, pp.selfie_url, pp.job_id_card_url,
            pp.submitted_at AS police_submitted_at, pp.reviewed_at AS police_reviewed_at,
            pp.rejection_reason AS police_rejection_reason,
            (SELECT COUNT(*) FROM law_enforcement_requests ler
             WHERE ler.assigned_police_id = u.id
               AND ler.status IN ('ASSIGNED_TO_POLICE','ACCEPTED_BY_POLICE')) AS active_police_requests,
            (SELECT COUNT(*) FROM incidents i WHERE i.user_id = u.id) AS sos_count,
            (SELECT COUNT(*) FROM user_reports ur WHERE ur.reported_user_id = u.id) AS report_count,
            (SELECT COUNT(*) FROM incident_volunteers iv WHERE iv.volunteer_id = u.id AND iv.status = 'ACCEPTED') AS assisted_incidents,
            (SELECT COUNT(*)
             FROM incident_volunteers iv
             JOIN incidents i ON i.id = iv.incident_id
             WHERE iv.volunteer_id = u.id AND iv.status = 'ACCEPTED' AND i.status = 'RESOLVED') AS resolved_assisted
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN volunteer_verifications vv
       ON vv.id = (SELECT vv2.id
                   FROM volunteer_verifications vv2
                   WHERE vv2.user_id = u.id
                   ORDER BY vv2.created_at DESC, vv2.id DESC
                   LIMIT 1)
     LEFT JOIN police_profiles pp ON pp.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  if (!rows[0]) return null;
  const user = formatUser(rows[0]);
  user.incidentHistory = await getUserIncidents(userId);
  user.assistedIncidentHistory = await getVolunteerAssistedIncidents(userId);
  return user;
}

async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function execute(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

async function insertAdminAction(conn, { adminId, actionType, targetType, targetId, reason = null, metadata = null }) {
  await execute(
    conn,
    `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      adminId,
      actionType,
      targetType,
      targetId,
      reason || null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

async function getTargetUserForUpdate(conn, userId) {
  const rows = await execute(
    conn,
    `SELECT u.id, u.account_status, u.warning_count, r.role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1
     FOR UPDATE`,
    [userId]
  );
  return rows[0] || null;
}

async function warnUser({ adminId, userId, reason }) {
  return withTransaction(async (conn) => {
    const user = await getTargetUserForUpdate(conn, userId);
    if (!user) return { status: 'NOT_FOUND' };
    if (String(user.role_name).toLowerCase() === 'admin') return { status: 'ADMIN_TARGET' };

    await execute(
      conn,
      `UPDATE users
       SET warning_count = COALESCE(warning_count, 0) + 1,
           account_status = 'WARNED'
       WHERE id = ?`,
      [userId]
    );
    await insertAdminAction(conn, {
      adminId,
      actionType: 'USER_WARNED',
      targetType: 'user',
      targetId: userId,
      reason,
    });
    return { status: 'OK' };
  });
}

async function blockUser({ adminId, userId, reason }) {
  return withTransaction(async (conn) => {
    const user = await getTargetUserForUpdate(conn, userId);
    if (!user) return { status: 'NOT_FOUND' };
    if (String(user.role_name).toLowerCase() === 'admin') return { status: 'ADMIN_TARGET' };

    await execute(
      conn,
      `UPDATE users
       SET account_status = 'BLOCKED',
           blocked_at = NOW(),
           blocked_reason = ?
       WHERE id = ?`,
      [reason, userId]
    );
    await insertAdminAction(conn, {
      adminId,
      actionType: 'USER_BLOCKED',
      targetType: 'user',
      targetId: userId,
      reason,
    });
    return { status: 'OK' };
  });
}

async function unblockUser({ adminId, userId, reason }) {
  return withTransaction(async (conn) => {
    const user = await getTargetUserForUpdate(conn, userId);
    if (!user) return { status: 'NOT_FOUND' };
    if (String(user.role_name).toLowerCase() === 'admin') return { status: 'ADMIN_TARGET' };

    await execute(
      conn,
      `UPDATE users
       SET account_status = 'ACTIVE',
           blocked_at = NULL,
           blocked_reason = NULL
       WHERE id = ?`,
      [userId]
    );
    await insertAdminAction(conn, {
      adminId,
      actionType: 'USER_UNBLOCKED',
      targetType: 'user',
      targetId: userId,
      reason,
    });
    return { status: 'OK' };
  });
}

function formatVerification(row) {
  return {
    id: String(row.id),
    status: row.status,
    submittedAt: toIso(row.submitted_at || row.created_at),
    reviewedAt: toIso(row.reviewed_at),
    rejectionReason: row.rejection_reason || null,
    idCardUrl: row.id_card_url || null,
    selfieUrl: row.selfie_url || null,
    certificateUrl: row.certificate_url || null,
    user: publicUser({
      id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      phone_number: row.phone_number,
      photo_url: row.photo_url,
      role_name: row.role_name,
    }),
  };
}

function verificationStatusWhere(status) {
  const normalized = String(status || 'pending').trim().toLowerCase();
  if (['pending', 'verified', 'rejected', 'draft'].includes(normalized)) {
    return { clause: 'WHERE vv.status = ?', params: [normalized] };
  }
  return { clause: '', params: [] };
}

async function listVerifications(status) {
  const where = verificationStatusWhere(status);
  const rows = await query(
    `SELECT vv.id, vv.user_id, vv.status, vv.id_card_url, vv.selfie_url,
            vv.certificate_url, vv.rejection_reason, vv.submitted_at,
            vv.reviewed_at, vv.created_at,
            u.first_name, u.last_name, u.phone_number, u.photo_url, r.role_name
     FROM volunteer_verifications vv
     JOIN users u ON u.id = vv.user_id
     JOIN roles r ON r.id = u.role_id
     ${where.clause}
     ORDER BY COALESCE(vv.submitted_at, vv.created_at) DESC
     LIMIT 200`,
    where.params
  );
  return rows.map(formatVerification);
}

async function getVerificationById(id) {
  const rows = await query(
    `SELECT vv.id, vv.user_id, vv.status, vv.id_card_url, vv.selfie_url,
            vv.certificate_url, vv.rejection_reason, vv.submitted_at,
            vv.reviewed_at, vv.created_at,
            u.first_name, u.last_name, u.phone_number, u.photo_url, r.role_name
     FROM volunteer_verifications vv
     JOIN users u ON u.id = vv.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE vv.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? formatVerification(rows[0]) : null;
}

async function updateVerification({ adminId, id, status, reason = null }) {
  return withTransaction(async (conn) => {
    const rows = await execute(
      conn,
      `SELECT id, user_id, status
       FROM volunteer_verifications
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );
    const record = rows[0];
    if (!record) return { status: 'NOT_FOUND' };
    if (record.status !== 'pending') return { status: 'INVALID_STATE', currentStatus: record.status };

    await execute(
      conn,
      `UPDATE volunteer_verifications
       SET status = ?,
           reviewed_at = NOW(),
           reviewed_by = ?,
           rejection_reason = ?
       WHERE id = ?`,
      [status, adminId, status === 'rejected' ? reason : null, id]
    );
    await insertAdminAction(conn, {
      adminId,
      actionType: status === 'verified' ? 'VOLUNTEER_APPROVED' : 'VOLUNTEER_REJECTED',
      targetType: 'volunteer_verification',
      targetId: id,
      reason,
      metadata: { userId: Number(record.user_id) },
    });
    return { status: 'OK' };
  });
}

function formatSafePlace(row) {
  const normalizedStatus = String(row.status || '').toUpperCase();
  return {
    id: String(row.id),
    name: row.name,
    address: row.address || null,
    location: row.address || `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}`,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    description: row.description || '',
    status: normalizedStatus === 'APPROVED' ? 'CONFIRMED' : row.status,
    submittedAt: toIso(row.created_at),
    reviewedAt: toIso(row.reviewed_at),
    rejectionReason: row.rejection_reason || null,
    requester: {
      id: String(row.reported_by),
      name: fullName(row),
      phone: row.phone_number || null,
      role: row.role_name,
      photoUrl: row.photo_url || null,
    },
    reviewedBy: row.reviewer_id ? {
      id: String(row.reviewer_id),
      name: fullName({
        first_name: row.reviewer_first_name,
        last_name: row.reviewer_last_name,
      }),
    } : null,
  };
}

function safePlaceStatusWhere(status) {
  const normalized = safeStatus(status || 'PENDING');
  if (normalized === 'CONFIRMED') {
    return { clause: `WHERE UPPER(sp.status) IN ('CONFIRMED', 'APPROVED')`, params: [] };
  }
  if (['PENDING', 'CONFIRMED', 'REJECTED'].includes(normalized)) {
    return { clause: 'WHERE sp.status = ?', params: [normalized] };
  }
  return { clause: '', params: [] };
}

async function listSafePlaces(status) {
  const where = safePlaceStatusWhere(status);
  const rows = await query(
    `SELECT sp.id, sp.reported_by, sp.latitude, sp.longitude, sp.name, sp.address,
            sp.description, sp.status, sp.created_at, sp.reviewed_at, sp.rejection_reason,
            u.first_name, u.last_name, u.phone_number, u.photo_url, r.role_name,
            reviewer.id AS reviewer_id, reviewer.first_name AS reviewer_first_name,
            reviewer.last_name AS reviewer_last_name
     FROM safe_places sp
     JOIN users u ON u.id = sp.reported_by
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN users reviewer ON reviewer.id = sp.reviewed_by
     ${where.clause}
     ORDER BY sp.created_at DESC
     LIMIT 200`,
    where.params
  );
  return rows.map(formatSafePlace);
}

async function getSafePlaceById(id) {
  const rows = await query(
    `SELECT sp.id, sp.reported_by, sp.latitude, sp.longitude, sp.name, sp.address,
            sp.description, sp.status, sp.created_at, sp.reviewed_at, sp.rejection_reason,
            u.first_name, u.last_name, u.phone_number, u.photo_url, r.role_name,
            reviewer.id AS reviewer_id, reviewer.first_name AS reviewer_first_name,
            reviewer.last_name AS reviewer_last_name
     FROM safe_places sp
     JOIN users u ON u.id = sp.reported_by
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN users reviewer ON reviewer.id = sp.reviewed_by
     WHERE sp.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? formatSafePlace(rows[0]) : null;
}

async function updateSafePlace({ adminId, id, status, reason = null }) {
  return withTransaction(async (conn) => {
    const rows = await execute(
      conn,
      `SELECT id, reported_by, status
       FROM safe_places
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );
    const record = rows[0];
    if (!record) return { status: 'NOT_FOUND' };
    if (record.status !== 'PENDING') return { status: 'INVALID_STATE', currentStatus: record.status };

    await execute(
      conn,
      `UPDATE safe_places
       SET status = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           rejection_reason = ?
       WHERE id = ?`,
      [status, adminId, status === 'REJECTED' ? reason : null, id]
    );
    await insertAdminAction(conn, {
      adminId,
      actionType: status === 'CONFIRMED' ? 'SAFE_PLACE_APPROVED' : 'SAFE_PLACE_REJECTED',
      targetType: 'safe_place',
      targetId: id,
      reason,
      metadata: { reportedBy: Number(record.reported_by) },
    });
    return { status: 'OK' };
  });
}

function formatReport(row) {
  return {
    id: String(row.id),
    reason: row.reason,
    status: row.status,
    actionNote: row.action_note || null,
    actionedAt: toIso(row.actioned_at),
    createdAt: toIso(row.created_at),
    incidentId: row.incident_id ? String(row.incident_id) : null,
    reportedUser: publicUser({
      id: row.reported_user_id,
      first_name: row.reported_first_name,
      last_name: row.reported_last_name,
      phone_number: row.reported_phone_number,
      photo_url: row.reported_photo_url,
      role_name: row.reported_role_name,
    }),
    reportedBy: publicUser({
      id: row.reported_by_user_id,
      first_name: row.reporter_first_name,
      last_name: row.reporter_last_name,
      phone_number: row.reporter_phone_number,
      photo_url: row.reporter_photo_url,
      role_name: row.reporter_role_name,
    }),
  };
}

function reportStatusWhere(status) {
  const normalized = safeStatus(status || 'PENDING');
  if (normalized === 'PENDING') return { clause: `WHERE ur.status = 'PENDING'`, params: [] };
  if (normalized === 'ACTIONED') return { clause: `WHERE ur.status IN ('DISMISSED','WARNED','BLOCKED')`, params: [] };
  return { clause: '', params: [] };
}

async function listReports(status) {
  const where = reportStatusWhere(status);
  const rows = await query(
    `SELECT ur.id, ur.reported_user_id, ur.reported_by_user_id, ur.incident_id,
            ur.reason, ur.status, ur.action_note, ur.actioned_at, ur.created_at,
            reported.first_name AS reported_first_name,
            reported.last_name AS reported_last_name,
            reported.phone_number AS reported_phone_number,
            reported.photo_url AS reported_photo_url,
            reported_role.role_name AS reported_role_name,
            reporter.first_name AS reporter_first_name,
            reporter.last_name AS reporter_last_name,
            reporter.phone_number AS reporter_phone_number,
            reporter.photo_url AS reporter_photo_url,
            reporter_role.role_name AS reporter_role_name
     FROM user_reports ur
     JOIN users reported ON reported.id = ur.reported_user_id
     JOIN roles reported_role ON reported_role.id = reported.role_id
     JOIN users reporter ON reporter.id = ur.reported_by_user_id
     JOIN roles reporter_role ON reporter_role.id = reporter.role_id
     ${where.clause}
     ORDER BY ur.created_at DESC
     LIMIT 200`,
    where.params
  );
  return rows.map(formatReport);
}

async function getReportById(id) {
  const rows = await query(
    `SELECT ur.id, ur.reported_user_id, ur.reported_by_user_id, ur.incident_id,
            ur.reason, ur.status, ur.action_note, ur.actioned_at, ur.created_at,
            reported.first_name AS reported_first_name,
            reported.last_name AS reported_last_name,
            reported.phone_number AS reported_phone_number,
            reported.photo_url AS reported_photo_url,
            reported_role.role_name AS reported_role_name,
            reporter.first_name AS reporter_first_name,
            reporter.last_name AS reporter_last_name,
            reporter.phone_number AS reporter_phone_number,
            reporter.photo_url AS reporter_photo_url,
            reporter_role.role_name AS reporter_role_name
     FROM user_reports ur
     JOIN users reported ON reported.id = ur.reported_user_id
     JOIN roles reported_role ON reported_role.id = reported.role_id
     JOIN users reporter ON reporter.id = ur.reported_by_user_id
     JOIN roles reporter_role ON reporter_role.id = reporter.role_id
     WHERE ur.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? formatReport(rows[0]) : null;
}

async function actionReport({ adminId, reportId, action, note = null }) {
  return withTransaction(async (conn) => {
    const rows = await execute(
      conn,
      `SELECT id, reported_user_id, status
       FROM user_reports
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [reportId]
    );
    const report = rows[0];
    if (!report) return { status: 'NOT_FOUND' };
    if (report.status !== 'PENDING') return { status: 'INVALID_STATE', currentStatus: report.status };

    const nextStatus = action === 'dismiss' ? 'DISMISSED' : action === 'warn' ? 'WARNED' : 'BLOCKED';

    await execute(
      conn,
      `UPDATE user_reports
       SET status = ?,
           action_note = ?,
           actioned_by = ?,
           actioned_at = NOW()
       WHERE id = ?`,
      [nextStatus, note || null, adminId, reportId]
    );

    if (action === 'dismiss') {
      await insertAdminAction(conn, {
        adminId,
        actionType: 'REPORT_DISMISSED',
        targetType: 'user_report',
        targetId: reportId,
        reason: note,
      });
      return { status: 'OK' };
    }

    const targetUser = await getTargetUserForUpdate(conn, Number(report.reported_user_id));
    if (!targetUser) return { status: 'TARGET_NOT_FOUND' };
    if (String(targetUser.role_name).toLowerCase() === 'admin') return { status: 'ADMIN_TARGET' };

    if (action === 'warn') {
      await execute(
        conn,
        `UPDATE users
         SET warning_count = COALESCE(warning_count, 0) + 1,
             account_status = 'WARNED'
         WHERE id = ?`,
        [Number(report.reported_user_id)]
      );
      await insertAdminAction(conn, {
        adminId,
        actionType: 'USER_WARNED',
        targetType: 'user',
        targetId: Number(report.reported_user_id),
        reason: note,
        metadata: { reportId },
      });
    } else {
      await execute(
        conn,
        `UPDATE users
         SET account_status = 'BLOCKED',
             blocked_at = NOW(),
             blocked_reason = ?
         WHERE id = ?`,
        [note || 'Blocked from user report', Number(report.reported_user_id)]
      );
      await insertAdminAction(conn, {
        adminId,
        actionType: 'USER_BLOCKED',
        targetType: 'user',
        targetId: Number(report.reported_user_id),
        reason: note,
        metadata: { reportId },
      });
    }

    return { status: 'OK' };
  });
}

async function listAuditLogs(limit = 100) {
  const rows = await query(
    `SELECT aa.id, aa.admin_id, aa.action_type, aa.target_type, aa.target_id,
            aa.reason, aa.metadata, aa.created_at,
            u.first_name, u.last_name
     FROM admin_actions aa
     JOIN users u ON u.id = aa.admin_id
     ORDER BY aa.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({
    id: String(row.id),
    adminId: String(row.admin_id),
    adminName: fullName(row),
    actionType: row.action_type,
    targetType: row.target_type,
    targetId: String(row.target_id),
    reason: row.reason || null,
    metadata: parseJson(row.metadata),
    createdAt: toIso(row.created_at),
  }));
}

async function listPoliceVerifications(status = 'PENDING') {
  const normalized = String(status || 'PENDING').toUpperCase();
  const whereParts = [];
  const params = [];
  if (normalized !== 'ALL') {
    whereParts.push('pp.verification_status = ?');
    params.push(normalized);
  }
  if (normalized === 'PENDING') {
    whereParts.push('pp.nid_card_url IS NOT NULL');
    whereParts.push('pp.selfie_url IS NOT NULL');
    whereParts.push('pp.job_id_card_url IS NOT NULL');
    whereParts.push('pp.submitted_at IS NOT NULL');
  }
  const statusSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = await query(
    `SELECT
       pp.user_id AS id,
       pp.police_station_or_unit,
       pp.badge_number,
       pp.nid_card_url,
       pp.selfie_url,
       pp.job_id_card_url,
       pp.verification_status,
       pp.rejection_reason,
       pp.submitted_at,
       pp.reviewed_at,
       pp.created_at,
       pp.updated_at,
       u.first_name,
       u.last_name,
       u.phone_number
     FROM police_profiles pp
     JOIN users u ON u.id = pp.user_id
     ${statusSql}
     ORDER BY pp.created_at DESC`,
    params
  );
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.id),
    type: 'police',
    typeLabel: 'Police/Law Enforcement Verification',
    name: fullName(row),
    user: {
      id: String(row.id),
      name: fullName(row),
      phone: row.phone_number || null,
      role: 'law_enforcement',
      photoUrl: null,
    },
    phoneNumber: row.phone_number,
    phone: row.phone_number || null,
    policeStationOrUnit: row.police_station_or_unit,
    badgeNumber: row.badge_number,
    nidCardUrl: row.nid_card_url,
    selfieUrl: row.selfie_url,
    jobIdCardUrl: row.job_id_card_url,
    idCardUrl: row.nid_card_url,
    certificateUrl: row.job_id_card_url,
    documents: {
      idCardUrl: row.nid_card_url || null,
      selfieUrl: row.selfie_url || null,
      certificateUrl: row.job_id_card_url || null,
      jobIdCardUrl: row.job_id_card_url || null,
    },
    verificationStatus: row.verification_status,
    status: row.verification_status,
    rejectionReason: row.rejection_reason || null,
    submittedAt: toIso(row.submitted_at),
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }));
}

async function getPoliceVerificationByUserId(userId) {
  const items = await listPoliceVerifications('ALL');
  return items.find((item) => item.userId === String(userId)) || null;
}

async function updatePoliceVerification({ adminId, userId, status, reason }) {
  const rows = await query(
    `SELECT pp.user_id, pp.verification_status, pp.nid_card_url, pp.selfie_url, pp.job_id_card_url, pp.submitted_at
     FROM police_profiles pp
     WHERE pp.user_id = ?
     LIMIT 1`,
    [userId]
  );
  if (!rows.length) return { status: 'NOT_FOUND' };
  if (status === 'APPROVED' && (!rows[0].nid_card_url || !rows[0].selfie_url || !rows[0].job_id_card_url || !rows[0].submitted_at)) {
    return { status: 'INVALID_STATE', currentStatus: 'not submitted' };
  }

  await query(
    `UPDATE police_profiles
     SET verification_status = ?,
         rejection_reason = ?,
         reviewed_by = ?,
         reviewed_at = NOW()
     WHERE user_id = ?`,
    [status, reason || null, adminId, userId]
  );

  await insertAdminAction(pool, {
    adminId,
    actionType: status === 'APPROVED' ? 'POLICE_APPROVED' : 'POLICE_REJECTED',
    targetType: 'police',
    targetId: userId,
    reason: reason || null,
    metadata: { status },
  }).catch(() => undefined);

  return { status: 'OK' };
}

module.exports = {
  ensureAdminSchema,
  getOverview,
  listIncidents,
  getIncidentById,
  listUsers,
  getUserById,
  warnUser,
  blockUser,
  unblockUser,
  listVerifications,
  getVerificationById,
  updateVerification,
  listSafePlaces,
  getSafePlaceById,
  updateSafePlace,
  listReports,
  getReportById,
  actionReport,
  listAuditLogs,
  listPoliceVerifications,
  getPoliceVerificationByUserId,
  updatePoliceVerification,
};

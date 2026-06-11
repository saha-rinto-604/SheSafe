const { query, pool } = require('../../config/db');
const {
  VOLUNTEER_ACCEPT_RADIUS_KM,
  approvedVolunteerJoins,
  approvedVolunteerAccountCondition,
  getVolunteerEligibility,
  haversineKm,
} = require('../volunteers/volunteerEligibility');

let dispatchSchemaReady = false;

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function hasIndex(tableName, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function ensureVolunteerDispatchSchema() {
  if (dispatchSchemaReady) return;

  if (!(await hasColumn('incidents', 'volunteer_id'))) {
    await query(
      `ALTER TABLE incidents
       ADD COLUMN volunteer_id BIGINT UNSIGNED DEFAULT NULL AFTER user_id`
    );
  }

  if (!(await hasColumn('incidents', 'accepted_at'))) {
    await query(
      `ALTER TABLE incidents
       ADD COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at`
    );
  }

  if (!(await hasColumn('incidents', 'updated_at'))) {
    await query(
      `ALTER TABLE incidents
       ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`
    );
  }

  if (!(await hasColumn('incidents', 'volunteer_case_details'))) {
    await query(
      `ALTER TABLE incidents
       ADD COLUMN volunteer_case_details JSON DEFAULT NULL AFTER accepted_at`
    );
  }

  if (!(await hasColumn('incidents', 'user_case_details'))) {
    await query(
      `ALTER TABLE incidents
       ADD COLUMN user_case_details JSON DEFAULT NULL AFTER volunteer_case_details`
    );
  }

  if (!(await hasColumn('incidents', 'final_location_snapshot'))) {
    await query(
      `ALTER TABLE incidents
       ADD COLUMN final_location_snapshot JSON DEFAULT NULL AFTER user_case_details`
    );
  }

  if (!(await hasColumn('users', 'is_online'))) {
    await query(
      `ALTER TABLE users
       ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT FALSE`
    );
  }

  if (!(await hasColumn('users', 'last_seen_at'))) {
    await query(
      `ALTER TABLE users
       ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL`
    );
  }

  if (!(await hasColumn('users', 'accept_sos_requests'))) {
    await query(
      `ALTER TABLE users
       ADD COLUMN accept_sos_requests BOOLEAN NOT NULL DEFAULT TRUE AFTER last_seen_at`
    );
  }

  if (!(await hasColumn('users', 'latest_latitude'))) {
    await query(
      `ALTER TABLE users
       ADD COLUMN latest_latitude DECIMAL(10,7) DEFAULT NULL`
    );
  }

  if (!(await hasColumn('users', 'latest_longitude'))) {
    await query(
      `ALTER TABLE users
       ADD COLUMN latest_longitude DECIMAL(10,7) DEFAULT NULL`
    );
  }

  await query(
    `ALTER TABLE incidents
     MODIFY COLUMN status ENUM('ACTIVE','IN_PROGRESS','RESOLVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE'`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS incident_volunteers (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       incident_id BIGINT UNSIGNED NOT NULL,
       volunteer_id BIGINT UNSIGNED NOT NULL,
       accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       status ENUM('ACCEPTED','LEFT','REMOVED') NOT NULL DEFAULT 'ACCEPTED',
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_incident_volunteer (incident_id, volunteer_id),
       KEY idx_incident_volunteers_incident_status (incident_id, status),
       KEY idx_incident_volunteers_volunteer_status (volunteer_id, status),
       CONSTRAINT fk_incident_volunteers_incident FOREIGN KEY (incident_id)
         REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_incident_volunteers_volunteer FOREIGN KEY (volunteer_id)
         REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
     )`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS incident_volunteer_rejections (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       incident_id BIGINT UNSIGNED NOT NULL,
       volunteer_id BIGINT UNSIGNED NOT NULL,
       rejected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_incident_volunteer_rejection (incident_id, volunteer_id),
       KEY idx_incident_volunteer_rejections_volunteer (volunteer_id),
       CONSTRAINT fk_incident_volunteer_rejections_incident FOREIGN KEY (incident_id)
         REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_incident_volunteer_rejections_volunteer FOREIGN KEY (volunteer_id)
         REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
     )`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS incident_participants (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       incident_id BIGINT UNSIGNED NOT NULL,
       user_id BIGINT UNSIGNED NOT NULL,
       joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       archived_at TIMESTAMP NULL DEFAULT NULL,
       deleted_for_user_at TIMESTAMP NULL DEFAULT NULL,
       left_at TIMESTAMP NULL DEFAULT NULL,
       PRIMARY KEY (id),
       UNIQUE KEY uq_participant (incident_id, user_id),
       KEY idx_participants_incident_id (incident_id),
       KEY idx_participants_user_visibility (user_id, archived_at, deleted_for_user_at),
       CONSTRAINT fk_part_incident FOREIGN KEY (incident_id)
         REFERENCES incidents (id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_part_user FOREIGN KEY (user_id)
         REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
     )`
  );

  if (!(await hasColumn('incident_participants', 'archived_at'))) {
    await query(
      `ALTER TABLE incident_participants
       ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL AFTER joined_at`
    );
  }

  if (!(await hasColumn('incident_participants', 'deleted_for_user_at'))) {
    await query(
      `ALTER TABLE incident_participants
       ADD COLUMN deleted_for_user_at TIMESTAMP NULL DEFAULT NULL AFTER archived_at`
    );
  }

  if (!(await hasColumn('incident_participants', 'left_at'))) {
    await query(
      `ALTER TABLE incident_participants
       ADD COLUMN left_at TIMESTAMP NULL DEFAULT NULL AFTER deleted_for_user_at`
    );
  }

  await query(
    `CREATE TABLE IF NOT EXISTS reviews (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       incident_id BIGINT UNSIGNED NOT NULL,
       reviewer_id BIGINT UNSIGNED NOT NULL,
       volunteer_id BIGINT UNSIGNED NOT NULL,
       rating TINYINT UNSIGNED NOT NULL,
       feedback TEXT DEFAULT NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_incident_reviewer_volunteer (incident_id, reviewer_id, volunteer_id),
       KEY idx_reviews_volunteer (volunteer_id),
       KEY idx_reviews_reviewer (reviewer_id),
       CONSTRAINT fk_reviews_incident FOREIGN KEY (incident_id)
         REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id)
         REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
       CONSTRAINT fk_reviews_volunteer FOREIGN KEY (volunteer_id)
         REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
     )`
  );

  if (!(await hasColumn('reviews', 'incident_id'))) {
    await query(`ALTER TABLE reviews ADD COLUMN incident_id BIGINT UNSIGNED DEFAULT NULL AFTER id`);
  }
  if (!(await hasColumn('reviews', 'reviewer_id'))) {
    await query(`ALTER TABLE reviews ADD COLUMN reviewer_id BIGINT UNSIGNED DEFAULT NULL AFTER incident_id`);
  }
  if (!(await hasColumn('reviews', 'volunteer_id'))) {
    await query(`ALTER TABLE reviews ADD COLUMN volunteer_id BIGINT UNSIGNED DEFAULT NULL AFTER reviewer_id`);
  }
  if (!(await hasIndex('reviews', 'uq_incident_reviewer_volunteer'))) {
    await query(
      `DELETE r1 FROM reviews r1
       JOIN reviews r2
         ON r1.incident_id = r2.incident_id
        AND r1.reviewer_id = r2.reviewer_id
        AND r1.volunteer_id = r2.volunteer_id
        AND r1.id > r2.id
       WHERE r1.incident_id IS NOT NULL
         AND r1.reviewer_id IS NOT NULL
         AND r1.volunteer_id IS NOT NULL`
    );
    await query(
      `ALTER TABLE reviews
       ADD UNIQUE KEY uq_incident_reviewer_volunteer (incident_id, reviewer_id, volunteer_id)`
    );
  }

  await query(
    `INSERT IGNORE INTO incident_volunteers (incident_id, volunteer_id, accepted_at, status)
     SELECT id, volunteer_id, COALESCE(accepted_at, created_at), 'ACCEPTED'
     FROM incidents
     WHERE volunteer_id IS NOT NULL`
  );

  if (!(await hasIndex('incidents', 'idx_incidents_updated_at'))) {
    await query(`ALTER TABLE incidents ADD KEY idx_incidents_updated_at (updated_at)`);
  }

  dispatchSchemaReady = true;
}

/**
 * Insert a new incident record.
 */
async function createIncident({ userId, latitude, longitude, address }) {
  await ensureVolunteerDispatchSchema();
  const result = await query(
    `INSERT INTO incidents (user_id, latitude, longitude, address)
     VALUES (?, ?, ?, ?)`,
    [userId, latitude, longitude, address || null]
  );
  const rows = await query(
    `SELECT id, user_id, volunteer_id, latitude, longitude, address, status, created_at, updated_at, accepted_at
     FROM incidents WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  await query(
    `INSERT INTO incident_participants (incident_id, user_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       archived_at = NULL,
       deleted_for_user_at = NULL,
       left_at = NULL`,
    [result.insertId, userId]
  );
  return rows[0];
}

/**
 * Fetch all ACTIVE incidents with user details (used for zone map).
 */
async function getActiveIncidents() {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address, i.status, i.created_at, i.updated_at,
            i.accepted_at, u.first_name, u.last_name, u.photo_url, r.role_name AS creator_role
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE UPPER(TRIM(i.status)) IN ('ACTIVE', 'IN_PROGRESS', 'OPEN', 'LIVE')
     ORDER BY i.id DESC`
  );
}

async function getUnavailableIncidentIdsForVolunteer(volunteerId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT incident_id
     FROM incident_volunteers
     WHERE volunteer_id = ? AND status IN ('ACCEPTED', 'LEFT', 'REMOVED')
     UNION
     SELECT incident_id
     FROM incident_volunteer_rejections
     WHERE volunteer_id = ?`,
    [volunteerId, volunteerId]
  );
}

async function recordIncidentRejection(incidentId, volunteerId) {
  await ensureVolunteerDispatchSchema();
  await query(
    `INSERT IGNORE INTO incident_volunteer_rejections (incident_id, volunteer_id)
     VALUES (?, ?)`,
    [incidentId, volunteerId]
  );
}

async function getIncidentRecordsForZones() {
  return query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address, i.status, i.created_at,
            u.first_name, u.last_name
     FROM incidents i
     LEFT JOIN users u ON i.user_id = u.id
     WHERE i.latitude IS NOT NULL
       AND i.longitude IS NOT NULL
       AND i.latitude BETWEEN -90 AND 90
       AND i.longitude BETWEEN -180 AND 180
       AND (
         i.status IS NULL
         OR UPPER(TRIM(i.status)) NOT IN ('DELETED', 'REJECTED', 'FAKE')
       )
     ORDER BY i.created_at DESC, i.id DESC`
  );
}

/**
 * Aggregate incidents into geographic zones.
 *
 * Algorithm:
 * 1. Fetch all valid safety-relevant incident records from the incidents table.
 * 2. Cluster them using a greedy 200-metre radius approach:
 *    - For each incident, check if it falls within 200m of an existing cluster centre.
 *    - If yes, add it to that cluster. If no, start a new cluster centred on it.
 * 3. Return zones with centre coords, incident count, and a representative name.
 */
const CLUSTER_RADIUS_M = 200;
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
  const incidents = await getIncidentRecordsForZones();

  /** @type {{ latitude: number, longitude: number, address: string|null, count: number, incidents: any[] }[]} */
  const clusters = [];

  for (const inc of incidents) {
    const lat = Number(inc.latitude);
    const lon = Number(inc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    let merged = false;

    const incidentDetail = {
      id: String(inc.id),
      reporter: `${inc.first_name || ''} ${inc.last_name || ''}`.trim() || (inc.user_id ? `User ${inc.user_id}` : 'Incident report'),
      reporterName: `${inc.first_name || ''} ${inc.last_name || ''}`.trim() || null,
      userName: `${inc.first_name || ''} ${inc.last_name || ''}`.trim() || null,
      time: inc.created_at,
      status: inc.status
    };

    for (const cluster of clusters) {
      if (haversineM(lat, lon, cluster.latitude, cluster.longitude) <= CLUSTER_RADIUS_M) {
        const total = cluster.count + 1;
        cluster.latitude = (cluster.latitude * cluster.count + lat) / total;
        cluster.longitude = (cluster.longitude * cluster.count + lon) / total;
        cluster.count = total;
        cluster.incidents.push(incidentDetail);
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

  return clusters.map((c, i) => {
    const incidentCount = c.count;
    return {
      id: `zone-${i + 1}`,
      name: c.address || `Incident Zone ${i + 1}`,
      latitude: c.latitude,
      longitude: c.longitude,
      radius: CLUSTER_RADIUS_M,
      incidentCount,
      count: incidentCount,
      isRed: incidentCount >= 5,
      isYellow: incidentCount >= 1 && incidentCount < 5,
      incidents: c.incidents,
    };
  });
}

async function findIncidentById(id) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.updated_at, i.accepted_at, i.volunteer_case_details, i.user_case_details,
            i.final_location_snapshot,
            u.first_name, u.last_name, u.photo_url
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

function parseJsonColumn(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isoValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function finiteNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function rowName(row, firstKey, lastKey, fallback) {
  return [row[firstKey], row[lastKey]].filter(Boolean).join(' ').trim() || fallback;
}

function coordinatePayload(latitude, longitude) {
  const lat = finiteNumber(latitude);
  const lng = finiteNumber(longitude);
  if (lat == null || lng == null) return null;
  return { latitude: lat, longitude: lng };
}

async function buildIncidentLocationSnapshot(incidentId, statusOverride = null) {
  await ensureVolunteerDispatchSchema();
  const incidentRows = await query(
    `SELECT
       i.id,
       i.status,
       i.updated_at,
       i.latitude AS incident_latitude,
       i.longitude AS incident_longitude,
       i.final_location_snapshot,
       u.id AS victim_id,
       u.first_name AS victim_first_name,
       u.last_name AS victim_last_name,
       u.photo_url AS victim_photo_url,
       u.latest_latitude AS victim_latest_latitude,
       u.latest_longitude AS victim_latest_longitude,
       u.last_seen_at AS victim_last_seen_at
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     WHERE i.id = ?
     LIMIT 1`,
    [incidentId]
  );
  const incident = incidentRows[0];
  if (!incident) return null;

  const volunteerRows = await query(
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       u.photo_url,
       u.latest_latitude,
       u.latest_longitude,
       u.last_seen_at,
       iv.accepted_at
     FROM incident_volunteers iv
     JOIN users u ON u.id = iv.volunteer_id
     WHERE iv.incident_id = ?
       AND iv.status = 'ACCEPTED'
     ORDER BY iv.accepted_at ASC, iv.id ASC`,
    [incidentId]
  );

  const victimCoordinate = coordinatePayload(
    incident.victim_latest_latitude == null ? incident.incident_latitude : incident.victim_latest_latitude,
    incident.victim_latest_longitude == null ? incident.incident_longitude : incident.victim_latest_longitude
  );

  return {
    incidentId: Number(incident.id),
    status: String(statusOverride || incident.status || '').toUpperCase(),
    finalizedAt: isoValue(incident.updated_at) || new Date().toISOString(),
    victimLocation: victimCoordinate ? {
      userId: String(incident.victim_id),
      id: String(incident.victim_id),
      name: rowName(incident, 'victim_first_name', 'victim_last_name', 'Victim'),
      photoUri: incident.victim_photo_url || null,
      ...victimCoordinate,
      updatedAt: isoValue(incident.victim_last_seen_at),
    } : null,
    volunteerLocations: volunteerRows
      .map((volunteer) => {
        const coordinate = coordinatePayload(volunteer.latest_latitude, volunteer.latest_longitude);
        if (!coordinate) return null;
        return {
          userId: String(volunteer.id),
          id: String(volunteer.id),
          name: rowName(volunteer, 'first_name', 'last_name', 'Volunteer'),
          photoUri: volunteer.photo_url || null,
          ...coordinate,
          acceptedAt: isoValue(volunteer.accepted_at),
          updatedAt: isoValue(volunteer.last_seen_at),
        };
      })
      .filter(Boolean),
    polyline: null,
  };
}

async function saveFinalLocationSnapshotIfMissing(incidentId, status) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT final_location_snapshot FROM incidents WHERE id = ? LIMIT 1`,
    [incidentId]
  );
  if (!rows[0]) return null;
  const existing = parseJsonColumn(rows[0].final_location_snapshot);
  if (existing) return existing;

  const snapshot = await buildIncidentLocationSnapshot(incidentId, status);
  if (!snapshot) return null;
  await query(
    `UPDATE incidents
     SET final_location_snapshot = ?
     WHERE id = ?
       AND final_location_snapshot IS NULL`,
    [JSON.stringify(snapshot), incidentId]
  );

  const latestRows = await query(
    `SELECT final_location_snapshot FROM incidents WHERE id = ? LIMIT 1`,
    [incidentId]
  );
  return parseJsonColumn(latestRows[0]?.final_location_snapshot) || snapshot;
}

async function getFinalLocationSnapshot(incidentId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT status, final_location_snapshot FROM incidents WHERE id = ? LIMIT 1`,
    [incidentId]
  );
  if (!rows[0]) return null;
  const existing = parseJsonColumn(rows[0].final_location_snapshot);
  if (existing) return existing;
  return saveFinalLocationSnapshotIfMissing(incidentId, rows[0].status);
}

async function cancelAllByUser(userId) {
  const result = await query(
    `DELETE FROM incidents WHERE user_id = ?`,
    [userId]
  );
  return { deleted: result.affectedRows };
}

/**
 * Fetch all incidents created by a specific user.
 */
async function getMyIncidents(userId) {
  return query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at
     FROM incidents i
     WHERE i.user_id = ?
     ORDER BY i.id DESC`,
    [userId]
  );
}

async function getMyActiveSos(userId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT i.id, i.user_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.updated_at
     FROM incidents i
     WHERE i.user_id = ?
       AND UPPER(TRIM(i.status)) IN ('ACTIVE', 'LIVE', 'IN_PROGRESS', 'ACCEPTED', 'ASSISTING')
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

// ── Volunteer Dispatch ─────────────────────────────────────────────────────

/**
 * Find all verified, online volunteers within 5km of an incident.
 * Uses the Haversine formula on the cached latest_latitude/longitude
 * columns on the users table for optimal performance.
 */
async function findNearbyVolunteers(incidentLat, incidentLng) {
  await ensureVolunteerDispatchSchema();
  return query(`
    SELECT
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.photo_url,
      u.latest_latitude AS latitude,
      u.latest_longitude AS longitude,
      (
        6371 * ACOS(
          LEAST(1, GREATEST(-1,
            COS(RADIANS(?)) * COS(RADIANS(u.latest_latitude))
            * COS(RADIANS(u.latest_longitude) - RADIANS(?))
            + SIN(RADIANS(?)) * SIN(RADIANS(u.latest_latitude))
          ))
        )
      ) AS distance_km
    FROM users u
    ${approvedVolunteerJoins('u', 'r', 'vv')}
    WHERE u.is_online = TRUE
      AND u.accept_sos_requests = TRUE
      AND ${approvedVolunteerAccountCondition('u')}
      AND u.latest_latitude IS NOT NULL
      AND u.latest_longitude IS NOT NULL
    HAVING distance_km <= ?
    ORDER BY distance_km ASC
  `, [incidentLat, incidentLng, incidentLat, VOLUNTEER_ACCEPT_RADIUS_KM]);
}

/**
 * Atomically accept an incident as a volunteer.
 * Uses SELECT ... FOR UPDATE to acquire a row-level lock,
 * preventing any concurrent transaction from reading/modifying
 * the same row until this transaction completes.
 */
async function acceptIncidentAtomic(incidentId, volunteerId) {
  await ensureVolunteerDispatchSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT id, user_id, volunteer_id, latitude, longitude, status FROM incidents
       WHERE id = ?
       FOR UPDATE`,
      [incidentId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return { success: false, reason: 'NOT_FOUND' };
    }

    const incident = rows[0];
    if (Number(incident.user_id) === Number(volunteerId)) {
      await conn.rollback();
      return { success: false, reason: 'OWN_INCIDENT' };
    }
    if (['RESOLVED', 'CANCELLED'].includes(String(incident.status).toUpperCase())) {
      await conn.rollback();
      return { success: false, reason: 'CLOSED' };
    }

    const [ownLiveRows] = await conn.execute(
      `SELECT id
       FROM incidents
       WHERE user_id = ?
         AND status IN ('ACTIVE', 'IN_PROGRESS')
       LIMIT 1`,
      [volunteerId]
    );
    if (ownLiveRows.length > 0) {
      await conn.rollback();
      return { success: false, reason: 'OWN_SOS_ACTIVE' };
    }

    const [existing] = await conn.execute(
      `SELECT id, status FROM incident_volunteers
       WHERE incident_id = ? AND volunteer_id = ?
       LIMIT 1`,
      [incidentId, volunteerId]
    );
    const existingStatus = existing[0]?.status;
    const alreadyAccepted = existingStatus === 'ACCEPTED';
    if (existingStatus && existingStatus !== 'ACCEPTED') {
      await conn.rollback();
      return { success: false, reason: 'PREVIOUSLY_LEFT' };
    }

    if (!alreadyAccepted) {
      const executeWithConnection = async (sql, params) => {
        const [resultRows] = await conn.execute(sql, params);
        return resultRows;
      };
      const eligibility = await getVolunteerEligibility(volunteerId, executeWithConnection);
      if (!eligibility.approved) {
        await conn.rollback();
        return { success: false, reason: 'VOLUNTEER_NOT_VERIFIED' };
      }

      const volunteerLat = eligibility.row?.latest_latitude;
      const volunteerLng = eligibility.row?.latest_longitude;
      if (volunteerLat == null || volunteerLng == null) {
        await conn.rollback();
        return { success: false, reason: 'VOLUNTEER_LOCATION_MISSING' };
      }
      if (incident.latitude == null || incident.longitude == null) {
        await conn.rollback();
        return { success: false, reason: 'INCIDENT_LOCATION_MISSING' };
      }

      const distanceKm = haversineKm(volunteerLat, volunteerLng, incident.latitude, incident.longitude);
      if (distanceKm == null || distanceKm > VOLUNTEER_ACCEPT_RADIUS_KM) {
        await conn.rollback();
        return { success: false, reason: 'OUTSIDE_ACCEPT_RADIUS', distanceKm };
      }
    }

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS count
       FROM incident_volunteers
       WHERE incident_id = ? AND status = 'ACCEPTED'`,
      [incidentId]
    );
    const acceptedCount = Number(countRows?.[0]?.count || 0);

    if (!alreadyAccepted && acceptedCount >= 3) {
      await conn.rollback();
      return { success: false, reason: 'MAX_RESPONDERS_EXCEEDED', maxResponders: 3 };
    }

    if (!alreadyAccepted) {
      await conn.execute(
        `INSERT INTO incident_volunteers (incident_id, volunteer_id, accepted_at, status)
         VALUES (?, ?, NOW(), 'ACCEPTED')
         ON DUPLICATE KEY UPDATE accepted_at = IF(status = 'ACCEPTED', accepted_at, NOW()), status = 'ACCEPTED'`,
        [incidentId, volunteerId]
      );

      if (!incident.volunteer_id) {
        await conn.execute(
          `UPDATE incidents
           SET volunteer_id = ?, accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()
           WHERE id = ?`,
          [volunteerId, incidentId]
        );
      } else {
        await conn.execute(`UPDATE incidents SET updated_at = NOW() WHERE id = ?`, [incidentId]);
      }
    }

    await conn.execute(
      `INSERT IGNORE INTO incident_participants (incident_id, user_id)
       VALUES (?, ?)`,
      [incidentId, volunteerId]
    );

    await conn.execute(
      `INSERT IGNORE INTO incident_participants (incident_id, user_id)
       VALUES (?, ?)`,
      [incidentId, incident.user_id]
    );

    await conn.commit();

    return {
      success: true,
      incidentId: String(incidentId),
      victimUserId: String(incident.user_id),
      volunteerId: String(volunteerId),
      alreadyAccepted,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Fetch incidents accepted by a specific volunteer (for "Assisted" tab).
 */
async function getAssistedByVolunteer(volunteerId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.updated_at, iv.accepted_at,
            u.first_name, u.last_name, u.photo_url,
            lm.id AS latest_message_id, lm.content AS latest_message, lm.message_type AS latest_message_type,
            lm.created_at AS latest_message_created_at,
            lu.id AS latest_sender_id, lu.first_name AS latest_sender_first_name,
            lu.last_name AS latest_sender_last_name, lu.photo_url AS latest_sender_photo_url,
            lu.username AS latest_sender_username,
            lr.role_name AS latest_sender_role,
            COALESCE(lm.created_at, i.updated_at, i.created_at) AS latest_activity_at,
            (SELECT COUNT(*) FROM incident_volunteers ivc WHERE ivc.incident_id = i.id AND ivc.status = 'ACCEPTED') AS responder_count
     FROM incidents i
     JOIN incident_volunteers iv ON iv.incident_id = i.id
       AND iv.volunteer_id = ?
       AND iv.status = 'ACCEPTED'
     JOIN incident_participants ip ON ip.incident_id = i.id
       AND ip.user_id = iv.volunteer_id
       AND ip.archived_at IS NULL
       AND ip.deleted_for_user_at IS NULL
     JOIN users u ON i.user_id = u.id
     LEFT JOIN chat_messages lm ON lm.id = (
       SELECT m2.id FROM chat_messages m2
       WHERE m2.incident_id = i.id
       ORDER BY m2.created_at DESC, m2.id DESC
       LIMIT 1
     )
     LEFT JOIN users lu ON lm.sender_id = lu.id
     LEFT JOIN roles lr ON lu.role_id = lr.id
     WHERE i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
     ORDER BY i.id DESC`,
    [volunteerId]
  );
}

async function getChatsByUser(userId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT i.id, i.user_id, i.volunteer_id, i.latitude, i.longitude, i.address,
            i.status, i.created_at, i.updated_at,
            u.first_name, u.last_name, u.photo_url,
            lm.id AS latest_message_id, lm.content AS latest_message, lm.message_type AS latest_message_type,
            lm.created_at AS latest_message_created_at,
            lu.id AS latest_sender_id, lu.first_name AS latest_sender_first_name,
            lu.last_name AS latest_sender_last_name, lu.photo_url AS latest_sender_photo_url,
            lu.username AS latest_sender_username,
            lr.role_name AS latest_sender_role,
            COALESCE(lm.created_at, i.updated_at, i.created_at) AS latest_activity_at,
            (SELECT COUNT(*) FROM incident_volunteers ivc WHERE ivc.incident_id = i.id AND ivc.status = 'ACCEPTED') AS responder_count
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     LEFT JOIN chat_messages lm ON lm.id = (
       SELECT m2.id FROM chat_messages m2
       WHERE m2.incident_id = i.id
       ORDER BY m2.created_at DESC, m2.id DESC
       LIMIT 1
     )
     LEFT JOIN users lu ON lm.sender_id = lu.id
     LEFT JOIN roles lr ON lu.role_id = lr.id
     LEFT JOIN incident_participants ip
       ON ip.incident_id = i.id
      AND ip.user_id = ?
     WHERE i.user_id = ?
       AND i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
       AND (ip.id IS NULL OR (ip.archived_at IS NULL AND ip.deleted_for_user_at IS NULL))
     ORDER BY i.id DESC`,
    [userId, userId]
  );
}

async function getIncidentResponders(incidentId) {
  await ensureVolunteerDispatchSchema();
  const incidentRows = await query(
    `SELECT i.id, i.user_id, u.first_name, u.last_name, u.photo_url
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     WHERE i.id = ? LIMIT 1`,
    [incidentId]
  );

  const volunteerRows = await query(
    `SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.username,
        u.photo_url,
        u.latest_latitude,
        u.latest_longitude,
        iv.accepted_at
     FROM incident_volunteers iv
     JOIN incidents i ON i.id = iv.incident_id
     JOIN users u ON iv.volunteer_id = u.id
     WHERE iv.incident_id = ?
       AND iv.status = 'ACCEPTED'
       AND iv.volunteer_id <> i.user_id
     ORDER BY iv.accepted_at ASC, iv.id ASC`,
    [incidentId]
  );

  return {
    incident: incidentRows[0] || null,
    volunteers: volunteerRows,
  };
}

async function isIncidentMember(incidentId, userId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT i.id
     FROM incidents i
     LEFT JOIN incident_volunteers iv
       ON iv.incident_id = i.id
      AND iv.volunteer_id = ?
      AND iv.status = 'ACCEPTED'
     WHERE i.id = ?
       AND (i.user_id = ? OR iv.id IS NOT NULL)
     LIMIT 1`,
    [userId, incidentId, userId]
  );
  return rows.length > 0;
}

async function getIncidentParticipantState(incidentId, userId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT archived_at, deleted_for_user_at, left_at
     FROM incident_participants
     WHERE incident_id = ? AND user_id = ?
     LIMIT 1`,
    [incidentId, userId]
  );
  return rows[0] || null;
}

async function leaveActiveAssistedIncidentsForVolunteer(volunteerId) {
  await ensureVolunteerDispatchSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT iv.incident_id
       FROM incident_volunteers iv
       JOIN incidents i ON i.id = iv.incident_id
       WHERE iv.volunteer_id = ?
         AND iv.status = 'ACCEPTED'
         AND i.user_id <> ?
         AND i.status IN ('ACTIVE', 'IN_PROGRESS')
       FOR UPDATE`,
      [volunteerId, volunteerId]
    );

    const incidentIds = rows.map((row) => row.incident_id);
    if (!incidentIds.length) {
      await conn.commit();
      return { incidentIds: [], count: 0 };
    }

    for (const incidentId of incidentIds) {
      await conn.execute(
        `UPDATE incident_volunteers
         SET status = 'LEFT', updated_at = NOW()
         WHERE incident_id = ?
           AND volunteer_id = ?
           AND status = 'ACCEPTED'`,
        [incidentId, volunteerId]
      );

      await conn.execute(
        `INSERT INTO incident_participants (incident_id, user_id, archived_at, left_at)
         VALUES (?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           archived_at = COALESCE(archived_at, NOW()),
           left_at = COALESCE(left_at, NOW())`,
        [incidentId, volunteerId]
      );

      await conn.execute(
        `UPDATE incidents
         SET volunteer_id = (
             SELECT next_volunteer_id FROM (
               SELECT volunteer_id AS next_volunteer_id
               FROM incident_volunteers
               WHERE incident_id = ?
                 AND status = 'ACCEPTED'
                 AND volunteer_id <> ?
               ORDER BY accepted_at ASC, id ASC
               LIMIT 1
             ) next_responder
           ),
           updated_at = NOW()
         WHERE id = ?
           AND volunteer_id = ?`,
        [incidentId, volunteerId, incidentId, volunteerId]
      );

      await conn.execute(
        `INSERT INTO chat_messages (incident_id, sender_id, content, message_type)
         VALUES (?, ?, 'A responder left this dispatch.', 'SYSTEM')`,
        [incidentId, volunteerId]
      );
    }

    await conn.commit();
    return { incidentIds: incidentIds.map(String), count: incidentIds.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getIncidentRouteContext(incidentId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT
       i.id,
       i.status,
       i.latitude AS incident_latitude,
       i.longitude AS incident_longitude,
       u.id AS victim_id,
       u.first_name AS victim_first_name,
       u.last_name AS victim_last_name,
       u.photo_url AS victim_photo_url,
       u.latest_latitude AS victim_latest_latitude,
       u.latest_longitude AS victim_latest_longitude
     FROM incidents i
     JOIN users u ON i.user_id = u.id
     WHERE i.id = ?
     LIMIT 1`,
    [incidentId]
  );
  return rows[0] || null;
}

async function getUserRouteLocation(userId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT id, first_name, last_name, photo_url, latest_latitude, latest_longitude
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getVolunteerCaseDetails(incidentId, volunteerId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT volunteer_case_details
     FROM incidents
     WHERE id = ? LIMIT 1`,
    [incidentId]
  );
  if (!rows[0]) return null;
  const raw = rows[0].volunteer_case_details;
  const allDetails = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
  return allDetails[String(volunteerId)] || {};
}

async function updateVolunteerCaseDetails(incidentId, volunteerId, details) {
  await ensureVolunteerDispatchSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT volunteer_case_details
       FROM incidents
       WHERE id = ?
       FOR UPDATE`,
      [incidentId]
    );
    if (!rows.length) {
      await conn.rollback();
      return null;
    }

    const raw = rows[0].volunteer_case_details;
    const allDetails = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    allDetails[String(volunteerId)] = details;

    await conn.execute(
      `UPDATE incidents
       SET volunteer_case_details = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(allDetails), incidentId]
    );
    await conn.commit();
    return details;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getUserCaseDetails(incidentId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT user_case_details
     FROM incidents
     WHERE id = ? LIMIT 1`,
    [incidentId]
  );
  if (!rows[0]) return null;
  const raw = rows[0].user_case_details;
  return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
}

async function updateUserCaseDetails(incidentId, details) {
  await ensureVolunteerDispatchSchema();
  await query(
    `UPDATE incidents
     SET user_case_details = ?, updated_at = NOW()
     WHERE id = ?`,
    [JSON.stringify(details), incidentId]
  );
  return details;
}

async function createIncidentReview({ incidentId, reviewerId, volunteerId, rating, feedback }) {
  await ensureVolunteerDispatchSchema();
  const incidentRows = await query(
    `SELECT id, user_id
     FROM incidents
     WHERE id = ? LIMIT 1`,
    [incidentId]
  );
  const incident = incidentRows[0];
  if (!incident) return { status: 'NOT_FOUND' };
  if (Number(incident.user_id) !== Number(reviewerId)) return { status: 'FORBIDDEN' };

  const responderRows = await query(
    `SELECT id
     FROM incident_volunteers
     WHERE incident_id = ?
       AND volunteer_id = ?
       AND status = 'ACCEPTED'
     LIMIT 1`,
    [incidentId, volunteerId]
  );
  if (!responderRows.length) return { status: 'NOT_RESPONDER' };

  const existingRows = await query(
    `SELECT id, incident_id, reviewer_id, volunteer_id, rating, feedback, created_at, updated_at
     FROM reviews
     WHERE incident_id = ? AND reviewer_id = ? AND volunteer_id = ?
     LIMIT 1`,
    [incidentId, reviewerId, volunteerId]
  );
  if (existingRows[0]) {
    return { status: 'ALREADY_REVIEWED', review: existingRows[0] };
  }

  try {
    await query(
      `INSERT INTO reviews (incident_id, reviewer_id, volunteer_id, rating, feedback)
       VALUES (?, ?, ?, ?, ?)`,
      [incidentId, reviewerId, volunteerId, rating, feedback || null]
    );
  } catch (err) {
    if (err?.code !== 'ER_DUP_ENTRY') throw err;
    const duplicateRows = await query(
      `SELECT id, incident_id, reviewer_id, volunteer_id, rating, feedback, created_at, updated_at
       FROM reviews
       WHERE incident_id = ? AND reviewer_id = ? AND volunteer_id = ?
       LIMIT 1`,
      [incidentId, reviewerId, volunteerId]
    );
    return { status: 'ALREADY_REVIEWED', review: duplicateRows[0] || null };
  }

  const rows = await query(
    `SELECT id, incident_id, reviewer_id, volunteer_id, rating, feedback, created_at, updated_at
     FROM reviews
     WHERE incident_id = ? AND reviewer_id = ? AND volunteer_id = ?
     LIMIT 1`,
    [incidentId, reviewerId, volunteerId]
  );
  return { status: 'OK', review: rows[0] || null };
}

async function getIncidentReviewRows(incidentId, reviewerId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT id, incident_id, reviewer_id, volunteer_id, rating, feedback, created_at, updated_at
     FROM reviews
     WHERE incident_id = ?
       AND reviewer_id = ?`,
    [incidentId, reviewerId]
  );
}

async function getVolunteerActivityLogs(volunteerId) {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT
       i.id AS incident_id,
       i.status,
       i.created_at,
       i.updated_at,
       iv.accepted_at,
       v.id AS volunteer_id,
       v.first_name AS volunteer_first_name,
       v.last_name AS volunteer_last_name,
       v.photo_url AS volunteer_photo_url,
       u.id AS victim_id,
       u.first_name AS victim_first_name,
       u.last_name AS victim_last_name,
       u.photo_url AS victim_photo_url
     FROM incident_volunteers iv
     JOIN incidents i ON i.id = iv.incident_id
     JOIN users v ON v.id = iv.volunteer_id
     JOIN users u ON u.id = i.user_id
     WHERE iv.volunteer_id = ?
       AND iv.status = 'ACCEPTED'
       AND i.status IN ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
     ORDER BY COALESCE(i.updated_at, iv.accepted_at, i.created_at) DESC, i.id DESC`,
    [volunteerId]
  );
}

async function getVolunteerLeaderboardRows() {
  await ensureVolunteerDispatchSchema();
  return query(
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       u.photo_url,
       COALESCE(inc_stats.assisted_incident_count, 0) AS assisted_incident_count,
       COALESCE(inc_stats.resolved_incident_count, 0) AS resolved_incident_count,
       COALESCE(review_stats.average_rating, 0) AS average_rating,
       COALESCE(review_stats.rating_count, 0) AS rating_count
     FROM users u
     ${approvedVolunteerJoins('u', 'r', 'vv')}
     LEFT JOIN (
       SELECT
         iv.volunteer_id,
         COUNT(DISTINCT iv.incident_id) AS assisted_incident_count,
         COUNT(DISTINCT CASE WHEN i.status = 'RESOLVED' THEN iv.incident_id END) AS resolved_incident_count
       FROM incident_volunteers iv
       JOIN incidents i ON i.id = iv.incident_id
       WHERE iv.status = 'ACCEPTED'
       GROUP BY iv.volunteer_id
     ) inc_stats ON inc_stats.volunteer_id = u.id
     LEFT JOIN (
       SELECT volunteer_id, AVG(rating) AS average_rating, COUNT(id) AS rating_count
       FROM reviews
       GROUP BY volunteer_id
     ) review_stats ON review_stats.volunteer_id = u.id
     WHERE ${approvedVolunteerAccountCondition('u')}`
  );
}

async function getVolunteerSummary(volunteerId) {
  await ensureVolunteerDispatchSchema();
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.photo_url
     FROM users u
     ${approvedVolunteerJoins('u', 'r', 'vv')}
     WHERE u.id = ?
       AND ${approvedVolunteerAccountCondition('u')}
     LIMIT 1`,
    [volunteerId]
  );
  return rows[0] || null;
}

async function ensureDefaultIncidentMessages(incidentId) {
  await ensureVolunteerDispatchSchema();
  const incident = await findIncidentById(incidentId);
  if (!incident) return false;

  const existing = await query(
    `SELECT COUNT(*) AS count
     FROM chat_messages
     WHERE incident_id = ?
       AND message_type = 'SYSTEM'
       AND content IN (?, ?)`,
    [
      incidentId,
      'SOS chat started. Share updates here with accepted responders.',
      'Your location and incident details are visible to responders in this chat.',
    ]
  );
  if (Number(existing?.[0]?.count || 0) >= 2) return false;

  await query(
    `INSERT INTO chat_messages (incident_id, sender_id, content, message_type)
     SELECT ?, ?, ?, 'SYSTEM'
     WHERE NOT EXISTS (
       SELECT 1 FROM chat_messages
       WHERE incident_id = ? AND message_type = 'SYSTEM' AND content = ?
     )`,
    [
      incidentId,
      incident.user_id,
      'SOS chat started. Share updates here with accepted responders.',
      incidentId,
      'SOS chat started. Share updates here with accepted responders.',
    ]
  );
  await query(
    `INSERT INTO chat_messages (incident_id, sender_id, content, message_type)
     SELECT ?, ?, ?, 'SYSTEM'
     WHERE NOT EXISTS (
       SELECT 1 FROM chat_messages
       WHERE incident_id = ? AND message_type = 'SYSTEM' AND content = ?
     )`,
    [
      incidentId,
      incident.user_id,
      'Your location and incident details are visible to responders in this chat.',
      incidentId,
      'Your location and incident details are visible to responders in this chat.',
    ]
  );
  return true;
}

/**
 * Update user's online status and cached location.
 */
async function setUserOnlineStatus(userId, isOnline) {
  await ensureVolunteerDispatchSchema();
  await query(
    `UPDATE users SET is_online = ?, last_seen_at = NOW() WHERE id = ?`,
    [isOnline, userId]
  );
}

module.exports = {
  createIncident,
  getActiveIncidents,
  getUnavailableIncidentIdsForVolunteer,
  recordIncidentRejection,
  getIncidentZones,
  findIncidentById,
  updateIncidentStatus,
  saveFinalLocationSnapshotIfMissing,
  getFinalLocationSnapshot,
  buildIncidentLocationSnapshot,
  cancelAllByUser,
  getMyIncidents,
  getMyActiveSos,
  findNearbyVolunteers,
  acceptIncidentAtomic,
  getAssistedByVolunteer,
  getChatsByUser,
  getIncidentResponders,
  getIncidentRouteContext,
  getUserRouteLocation,
  isIncidentMember,
  getVolunteerCaseDetails,
  updateVolunteerCaseDetails,
  getUserCaseDetails,
  updateUserCaseDetails,
  createIncidentReview,
  getIncidentReviewRows,
  getVolunteerActivityLogs,
  getVolunteerLeaderboardRows,
  getVolunteerSummary,
  ensureDefaultIncidentMessages,
  setUserOnlineStatus,
  ensureVolunteerDispatchSchema,
  getIncidentParticipantState,
  leaveActiveAssistedIncidentsForVolunteer,
};

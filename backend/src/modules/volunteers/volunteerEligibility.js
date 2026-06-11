const { query } = require('../../config/db');

const VOLUNTEER_ACCEPT_RADIUS_KM = 5;

function approvedVolunteerJoins(userAlias = 'u', roleAlias = 'r', verificationAlias = 'vv') {
  return `
    JOIN roles ${roleAlias}
      ON ${roleAlias}.id = ${userAlias}.role_id
     AND LOWER(TRIM(${roleAlias}.role_name)) = 'volunteer'
    JOIN volunteer_verifications ${verificationAlias}
      ON ${verificationAlias}.id = (
        SELECT latest_vv.id
        FROM volunteer_verifications latest_vv
        WHERE latest_vv.user_id = ${userAlias}.id
        ORDER BY latest_vv.id DESC
        LIMIT 1
      )
     AND LOWER(TRIM(${verificationAlias}.status)) = 'verified'`;
}

function approvedVolunteerAccountCondition(userAlias = 'u') {
  return `COALESCE(${userAlias}.account_status, 'ACTIVE') <> 'BLOCKED'`;
}

function approvedVolunteerExistsCondition(userAlias = 'u') {
  return `EXISTS (
    SELECT 1
    FROM volunteer_verifications eligibility_vv
    WHERE eligibility_vv.id = (
      SELECT latest_eligibility_vv.id
      FROM volunteer_verifications latest_eligibility_vv
      WHERE latest_eligibility_vv.user_id = ${userAlias}.id
      ORDER BY latest_eligibility_vv.id DESC
      LIMIT 1
    )
      AND LOWER(TRIM(eligibility_vv.status)) = 'verified'
  ) AND ${approvedVolunteerAccountCondition(userAlias)}`;
}

async function getVolunteerEligibility(userId, execute = query) {
  const rows = await execute(
    `SELECT
       u.id,
       u.latest_latitude,
       u.latest_longitude,
       u.account_status,
       r.role_name,
       (
         SELECT latest_vv.status
         FROM volunteer_verifications latest_vv
         WHERE latest_vv.user_id = u.id
         ORDER BY latest_vv.id DESC
         LIMIT 1
       ) AS verification_status
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  const row = rows[0] || null;
  const approved = Boolean(
    row
    && String(row.role_name || '').trim().toLowerCase() === 'volunteer'
    && String(row.verification_status || '').trim().toLowerCase() === 'verified'
    && String(row.account_status || 'ACTIVE').trim().toUpperCase() !== 'BLOCKED'
  );
  return { approved, row };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [aLat, aLng, bLat, bLng] = values;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = {
  VOLUNTEER_ACCEPT_RADIUS_KM,
  approvedVolunteerJoins,
  approvedVolunteerAccountCondition,
  approvedVolunteerExistsCondition,
  getVolunteerEligibility,
  haversineKm,
};

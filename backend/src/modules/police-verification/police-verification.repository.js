const { query } = require('../../config/db');
const { ensurePoliceProfilesSchema } = require('../users/user.repository');

async function findByUserId(userId) {
  await ensurePoliceProfilesSchema();
  const rows = await query(
    `SELECT pp.*, u.first_name, u.last_name, u.phone_number, r.role_name
     FROM police_profiles pp
     JOIN users u ON u.id = pp.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE pp.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

const DOCUMENT_COLUMNS = {
  nidCard: 'nid_card_url',
  selfie: 'selfie_url',
  jobIdCard: 'job_id_card_url',
};

async function updateDocument(userId, docType, documentUrl) {
  await ensurePoliceProfilesSchema();
  const column = DOCUMENT_COLUMNS[docType];
  if (!column) throw new Error('Invalid police document type.');

  await query(
    `UPDATE police_profiles
     SET ${column} = ?,
         verification_status = 'PENDING',
         rejection_reason = NULL,
         reviewed_by = NULL,
         reviewed_at = NULL
     WHERE user_id = ?`,
    [documentUrl, userId]
  );
  return findByUserId(userId);
}

async function submit(userId) {
  await ensurePoliceProfilesSchema();
  await query(
    `UPDATE police_profiles
     SET verification_status = 'PENDING',
         submitted_at = NOW(),
         rejection_reason = NULL,
         reviewed_by = NULL,
         reviewed_at = NULL
     WHERE user_id = ?
       AND nid_card_url IS NOT NULL
       AND selfie_url IS NOT NULL
       AND job_id_card_url IS NOT NULL`,
    [userId]
  );
  return findByUserId(userId);
}

module.exports = {
  findByUserId,
  updateDocument,
  submit,
};

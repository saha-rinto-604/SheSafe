/**
 * vf.repository.js — Volunteer Verification Data Access Layer
 * ──────────────────────────────────────────────────────────────────────
 * Tracks the verification lifecycle: draft → pending → verified | rejected.
 * Each user can have multiple verification records (after rejection + reapply),
 * but only the most recent one is active.
 */

const { query } = require('../../config/db');

/** Get the most recent verification record for a user. */
async function findLatest(userId) {
  const rows = await query(
    `SELECT * FROM volunteer_verifications
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/** Create a new draft verification record. */
async function createDraft(userId) {
  const result = await query(
    `INSERT INTO volunteer_verifications (user_id, status) VALUES (?, 'draft')`,
    [userId]
  );
  const rows = await query('SELECT * FROM volunteer_verifications WHERE id = ?', [result.insertId]);
  return rows[0];
}

/** Update document URLs (during draft phase). */
async function updateDocuments(recordId, userId, { idCardUrl, selfieUrl, certificateUrl }) {
  await query(
    `UPDATE volunteer_verifications
     SET id_card_url = ?, selfie_url = ?, certificate_url = ?
     WHERE id = ? AND user_id = ? AND status = 'draft'`,
    [idCardUrl || null, selfieUrl || null, certificateUrl || null, recordId, userId]
  );
  return findById(recordId);
}

/** Submit for review (draft → pending). */
async function submit(recordId, userId) {
  await query(
    `UPDATE volunteer_verifications
     SET status = 'pending', submitted_at = NOW()
     WHERE id = ? AND user_id = ? AND status = 'draft'`,
    [recordId, userId]
  );
  return findById(recordId);
}

/** Admin: approve a verification (pending → verified). */
async function approve(recordId) {
  await query(
    `UPDATE volunteer_verifications
     SET status = 'verified', reviewed_at = NOW()
     WHERE id = ? AND status = 'pending'`,
    [recordId]
  );
  return findById(recordId);
}

/** Admin: reject a verification (pending → rejected). */
async function reject(recordId, reason) {
  await query(
    `UPDATE volunteer_verifications
     SET status = 'rejected', rejection_reason = ?, reviewed_at = NOW()
     WHERE id = ? AND status = 'pending'`,
    [reason || 'No reason provided.', recordId]
  );
  return findById(recordId);
}

async function findById(recordId) {
  const rows = await query('SELECT * FROM volunteer_verifications WHERE id = ?', [recordId]);
  return rows[0] || null;
}

/** Revert pending → draft so user can re-upload documents. */
async function revertToDraft(recordId, userId) {
  await query(
    `UPDATE volunteer_verifications
     SET status = 'draft', submitted_at = NULL
     WHERE id = ? AND user_id = ? AND status = 'pending'`,
    [recordId, userId]
  );
  return findById(recordId);
}

module.exports = {
  findLatest,
  createDraft,
  updateDocuments,
  submit,
  approve,
  reject,
  findById,
  revertToDraft,
};

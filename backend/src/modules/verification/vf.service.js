/**
 * vf.service.js — Volunteer Verification Business Logic
 * ──────────────────────────────────────────────────────────────────────
 * Orchestrates the verification workflow:
 *   1. Apply (create draft)
 *   2. Upload documents (Cloudinary)
 *   3. Submit for review
 *   4. Admin approve/reject
 *
 * The service enforces that ID card + selfie are required before submission.
 */

const { httpError } = require('../../utils/httpError');
const { uploadBuffer } = require('../../config/cloudinary');
const vfRepo = require('./vf.repository');

/** Transform DB row to frontend VerificationRecord shape. */
function toPublic(row) {
  if (!row) return { status: 'not_applied' };
  return {
    id: row.id,
    status: row.status,
    submittedOn: row.submitted_at ? new Date(row.submitted_at).toISOString() : undefined,
    documents: {
      idCardUrl: row.id_card_url || undefined,
      selfieUrl: row.selfie_url || undefined,
      certificateUrl: row.certificate_url || undefined,
    },
    rejectionReason: row.rejection_reason || undefined,
  };
}

/** Get current verification status. */
async function getStatus(userId) {
  const row = await vfRepo.findLatest(userId);
  return toPublic(row);
}

/** Start a new application (creates a draft record). */
async function apply(userId) {
  const existing = await vfRepo.findLatest(userId);
  if (existing && (existing.status === 'pending' || existing.status === 'verified')) {
    throw httpError(400, 'You already have an active verification.');
  }
  const record = await vfRepo.createDraft(userId);
  return toPublic(record);
}

/**
 * Upload a verification document to Cloudinary and save the URL.
 *
 * @param {number} userId
 * @param {'idCard'|'selfie'|'certificate'} docType
 * @param {Buffer} fileBuffer
 */
async function uploadDocument(userId, docType, fileBuffer) {
  const record = await vfRepo.findLatest(userId);
  if (!record || record.status !== 'draft') {
    throw httpError(400, 'No active draft to upload to.');
  }

  const folder = `resqher/verification/${userId}`;
  const { secure_url } = await uploadBuffer(fileBuffer, folder, `${docType}_${userId}`);

  const updateMap = {
    idCard: 'idCardUrl',
    selfie: 'selfieUrl',
    certificate: 'certificateUrl',
  };

  const field = updateMap[docType];
  if (!field) throw httpError(400, 'Invalid document type.');

  // Build the update payload: keep existing values for the columns we're NOT updating.
  const updated = await vfRepo.updateDocuments(record.id, userId, {
    idCardUrl:      field === 'idCardUrl'      ? secure_url : (record.id_card_url     || null),
    selfieUrl:      field === 'selfieUrl'      ? secure_url : (record.selfie_url      || null),
    certificateUrl: field === 'certificateUrl' ? secure_url : (record.certificate_url || null),
  });
  return toPublic(updated);
}

/** Submit the draft for review. Requires idCard + selfie. */
async function submit(userId) {
  const record = await vfRepo.findLatest(userId);
  if (!record || record.status !== 'draft') {
    throw httpError(400, 'No draft to submit.');
  }
  if (!record.id_card_url || !record.selfie_url) {
    throw httpError(400, 'ID Card and Selfie are required before submitting.');
  }
  const updated = await vfRepo.submit(record.id, userId);
  return toPublic(updated);
}

/** Reapply after rejection — creates a fresh draft. */
async function reapply(userId) {
  return apply(userId);
}

/**
 * Edit documents while in pending state — reverts pending → draft.
 * This lets users fix mistakes without creating a duplicate record.
 */
async function edit(userId) {
  const record = await vfRepo.findLatest(userId);
  if (!record || record.status !== 'pending') {
    throw httpError(400, 'Only pending verifications can be edited.');
  }
  const updated = await vfRepo.revertToDraft(record.id, userId);
  return toPublic(updated);
}

module.exports = {
  getStatus,
  apply,
  uploadDocument,
  submit,
  reapply,
  edit,
};

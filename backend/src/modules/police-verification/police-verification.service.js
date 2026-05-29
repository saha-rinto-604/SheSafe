const { httpError } = require('../../utils/httpError');
const { uploadBuffer } = require('../../config/cloudinary');
const repo = require('./police-verification.repository');

function ensurePolice(user) {
  if (String(user?.role || '').toLowerCase() !== 'law_enforcement') {
    throw httpError(403, 'Police account required.');
  }
}

function toPublic(row) {
  if (!row) return { status: 'not_submitted' };
  const hasRequiredDocuments = !!row.nid_card_url && !!row.selfie_url && !!row.job_id_card_url;
  const status = row.verification_status === 'APPROVED'
    ? 'approved'
    : row.verification_status === 'REJECTED'
      ? 'rejected'
      : hasRequiredDocuments && row.submitted_at
        ? 'pending'
        : 'not_submitted';

  return {
    id: String(row.user_id),
    status,
    submittedOn: row.submitted_at ? new Date(row.submitted_at).toISOString() : undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    rejectionReason: row.rejection_reason || undefined,
    documents: {
      nidCardUrl: row.nid_card_url || undefined,
      selfieUrl: row.selfie_url || undefined,
      jobIdCardUrl: row.job_id_card_url || undefined,
      documentType: 'Police NID Card, Selfie With NID, and Police Job Certificate / Job ID Card',
    },
    policeProfile: {
      policeStationOrUnit: row.police_station_or_unit,
      badgeNumber: row.badge_number,
    },
  };
}

async function getStatus(user) {
  ensurePolice(user);
  return toPublic(await repo.findByUserId(user.id));
}

const DOCUMENT_CONFIG = {
  'nid-card': {
    repoType: 'nidCard',
    storageName: 'nid_card',
    label: 'Police NID Card',
  },
  nidCard: {
    repoType: 'nidCard',
    storageName: 'nid_card',
    label: 'Police NID Card',
  },
  nid_card: {
    repoType: 'nidCard',
    storageName: 'nid_card',
    label: 'Police NID Card',
  },
  selfie: {
    repoType: 'selfie',
    storageName: 'selfie',
    label: 'Selfie With NID',
  },
  'job-id-card': {
    repoType: 'jobIdCard',
    storageName: 'job_id_card',
    label: 'Police Job Certificate / Job ID Card',
  },
  jobIdCard: {
    repoType: 'jobIdCard',
    storageName: 'job_id_card',
    label: 'Police Job Certificate / Job ID Card',
  },
  job_id_card: {
    repoType: 'jobIdCard',
    storageName: 'job_id_card',
    label: 'Police Job Certificate / Job ID Card',
  },
};

async function uploadDocument(user, rawType, fileBuffer) {
  ensurePolice(user);
  const doc = DOCUMENT_CONFIG[rawType];
  if (!doc) throw httpError(400, 'Invalid police document type.');
  if (!fileBuffer) throw httpError(400, `${doc.label} is required.`);
  const existing = await repo.findByUserId(user.id);
  if (!existing) throw httpError(404, 'Police profile not found.');
  if (existing.verification_status === 'APPROVED') {
    throw httpError(400, 'Approved police verification cannot be changed.');
  }

  const folder = `resqher/police-verification/${user.id}`;
  const { secure_url } = await uploadBuffer(fileBuffer, folder, `${doc.storageName}_${user.id}`);
  return toPublic(await repo.updateDocument(user.id, doc.repoType, secure_url));
}

async function submit(user) {
  ensurePolice(user);
  const existing = await repo.findByUserId(user.id);
  if (!existing) throw httpError(404, 'Police profile not found.');
  if (!existing.nid_card_url || !existing.selfie_url || !existing.job_id_card_url) {
    throw httpError(400, 'Police NID Card, Selfie With NID, and Police Job Certificate / Job ID Card are required before submitting.');
  }
  if (existing.verification_status === 'APPROVED') {
    throw httpError(400, 'Police verification is already approved.');
  }
  return toPublic(await repo.submit(user.id));
}

module.exports = {
  getStatus,
  uploadDocument,
  submit,
};

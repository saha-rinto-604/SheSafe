/**
 * user.service.js — User Profile Business Logic
 * ──────────────────────────────────────────────────────────────────────
 * Why a separate Service layer:
 *   The Controller handles HTTP concerns (req/res). The Service handles
 *   business logic (validation, transformation, orchestration). The Repository
 *   handles raw SQL. This separation means we can test business logic
 *   independently of Express, and swap the database layer without touching
 *   business rules.
 *
 * Profile Photo Flow:
 *   1. Controller receives multipart file via Multer
 *   2. Service uploads buffer to Cloudinary (gets secure_url)
 *   3. Service saves the secure_url to the users table (Reference Pattern)
 *   4. Service returns the full updated user object for frontend state sync
 */

const { uploadBuffer, deleteAsset } = require('../../config/cloudinary');
const { httpError } = require('../../utils/httpError');
const userRepo = require('./user.repository');

/**
 * Get the full profile for the authenticated user.
 * Merges auth fields (id, role, phone) with profile fields (dob, gender, etc).
 *
 * @param {number} userId
 * @returns {Promise<Object>} Public user profile
 */
async function getProfile(userId) {
  const user = await userRepo.findUserById(userId);
  if (!user) throw httpError(404, 'User not found.');
  return userRepo.toPublicProfile(user);
}

/**
 * Update profile fields for the authenticated user.
 *
 * Why we return the full updated user:
 *   The frontend needs the complete object to update its global state store.
 *   Returning only "success" would force a second GET request — wasteful
 *   on mobile networks.
 *
 * @param {number} userId
 * @param {Object} patch - Partial profile fields to update
 * @returns {Promise<Object>} Full updated public profile
 */
async function updateProfile(userId, patch) {
  const currentUser = await userRepo.findUserById(userId);
  if (!currentUser) throw httpError(404, 'User not found.');
  // Normalize: empty strings for ENUM/DATE columns are invalid in MySQL.
  // Sending gender='' crashes the entire UPDATE (including name, phone, DOB).
  // Convert '' → undefined so they're excluded from the SET clause.
  const normStr  = (v) => (typeof v === 'string' && v.trim() !== '') ? v.trim() : undefined;
  const normEnum = (v) => (typeof v === 'string' && v.trim() !== '') ? v.trim() : undefined;
  const normOptionalStr = (v, maxLength) => {
    if (v === null) return null;
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  };

  const phoneNumber = normStr(patch.phoneNumber);
  if (phoneNumber && (!/^\+?[0-9][0-9\s().-]{5,29}$/.test(phoneNumber) || phoneNumber.length > 30)) {
    throw httpError(400, 'Please enter a valid phone number.');
  }

  const username = patch.username !== undefined
    ? userRepo.assertValidUsername(patch.username)
    : undefined;
  if (username && username !== currentUser.username) {
    const taken = await userRepo.isUsernameTaken(username, { excludeUserId: userId });
    if (taken) throw httpError(409, 'Username is already taken.');
  }

  const dob = normStr(patch.dobISO) || normStr(patch.dob) || undefined;
  if (dob && Number.isNaN(new Date(dob).getTime())) {
    throw httpError(400, 'Please enter a valid date of birth.');
  }

  const gender = normEnum(patch.gender);
  if (gender && !['Male', 'Female'].includes(gender)) {
    throw httpError(400, 'Please select a valid gender.');
  }

  const bloodGroup = normEnum(patch.bloodGroup);
  if (bloodGroup && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodGroup)) {
    throw httpError(400, 'Please select a valid blood group.');
  }

  const medicalInfo = Array.isArray(patch.medicalInfo)
    ? patch.medicalInfo.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20)
    : undefined;

  if (
    typeof patch.acceptSosRequests === 'boolean'
    && String(currentUser.role_name || '').toLowerCase() !== 'volunteer'
  ) {
    throw httpError(403, 'Only volunteers can update SOS request availability.');
  }

  // Whitelist only the fields the frontend sends
  const allowed = {
    first_name:   normStr(patch.firstName),
    last_name:    normStr(patch.lastName),
    username,
    phone_number: phoneNumber,
    dob,
    gender,
    blood_group: bloodGroup,
    medical_info: medicalInfo !== undefined ? JSON.stringify(medicalInfo) : undefined,
    home_address: patch.homeAddress !== undefined ? normOptionalStr(patch.homeAddress, 500) : undefined,
    accept_sos_requests: typeof patch.acceptSosRequests === 'boolean' ? patch.acceptSosRequests : undefined,
  };

  // Remove undefined keys so we don't overwrite with NULL
  const updates = {};
  for (const [key, value] of Object.entries(allowed)) {
    if (value !== undefined) updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    throw httpError(400, 'No valid fields to update.');
  }

  console.log('[USER_SVC] updateProfile userId:', userId, 'updates:', updates);

  await userRepo.updateUser(userId, updates);
  return getProfile(userId);
}

/**
 * Upload a profile photo to Cloudinary and save the URL in the database.
 *
 * Architecture Decision — Why we delete the old photo:
 *   Cloudinary's free tier has storage limits. Deleting the previous asset
 *   prevents accumulation of orphaned images. The public_id is derived from
 *   the user ID, so overwriting is deterministic.
 *
 * @param {number} userId
 * @param {Buffer} fileBuffer - Image buffer from Multer
 * @returns {Promise<Object>} Full updated public profile with new photo_url
 */
async function uploadPhoto(userId, fileBuffer) {
  if (!fileBuffer) throw httpError(400, 'No image file provided.');

  // Upload to Cloudinary with a deterministic public_id based on user ID
  const { secure_url } = await uploadBuffer(
    fileBuffer,
    'resqher/profiles',
    `user_${userId}_avatar`
  );

  // Save the secure_url in the database (Reference Pattern)
  await userRepo.updateUser(userId, { photo_url: secure_url });

  return getProfile(userId);
}

/**
 * Remove the profile photo (set to NULL).
 */
async function removePhoto(userId) {
  await deleteAsset(`resqher/profiles/user_${userId}_avatar`);
  await userRepo.updateUser(userId, { photo_url: null });
  return getProfile(userId);
}

async function getConnectedUsers(userId) {
  const currentUser = await userRepo.findUserById(userId);
  if (!currentUser) throw httpError(404, 'User not found.');
  const role = String(currentUser.role_name || '').toLowerCase();
  if (!['standard_user', 'volunteer'].includes(role)) return [];
  return userRepo.listConnectedUsers(userId);
}

async function getBlockedUsers(userId) {
  const currentUser = await userRepo.findUserById(userId);
  if (!currentUser) throw httpError(404, 'User not found.');
  return userRepo.listBlockedUsers(userId);
}

function normalizeBlockReason(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 255) : null;
}

async function blockConnectedUser(userId, blockedUserId, reason) {
  const targetId = Number(blockedUserId);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) {
    throw httpError(400, 'This user is not available to block.');
  }
  if (Number(userId) === targetId) {
    throw httpError(400, 'You cannot block yourself.');
  }
  const currentUser = await userRepo.findUserById(userId);
  const currentRole = String(currentUser?.role_name || '').toLowerCase();
  if (!['standard_user', 'volunteer'].includes(currentRole)) {
    throw httpError(400, 'This user is not available to block.');
  }

  const target = await userRepo.findBlockableUserFor(userId, targetId);
  if (!target) {
    throw httpError(400, 'This user is not available to block.');
  }

  const block = await userRepo.blockUser(userId, targetId, normalizeBlockReason(reason));
  return {
    id: block?.id ? Number(block.id) : null,
    blockedUserId: targetId,
    blockedAt: block?.created_at instanceof Date ? block.created_at.toISOString() : String(block?.created_at || ''),
  };
}

async function unblockConnectedUser(userId, blockedUserId) {
  const targetId = Number(blockedUserId);
  if (!Number.isSafeInteger(targetId) || targetId <= 0 || Number(userId) === targetId) {
    return { blockedUserId: String(blockedUserId), unblocked: true };
  }
  await userRepo.unblockUser(userId, targetId);
  return { blockedUserId: targetId, unblocked: true };
}

async function isUserBlockedBy(blockerUserId, blockedUserId) {
  if (!blockerUserId || !blockedUserId) return false;
  if (Number(blockerUserId) === Number(blockedUserId)) return false;
  return userRepo.isUserBlockedBy(blockerUserId, blockedUserId);
}

module.exports = {
  getProfile,
  updateProfile,
  uploadPhoto,
  removePhoto,
  getConnectedUsers,
  getBlockedUsers,
  blockConnectedUser,
  unblockConnectedUser,
  isUserBlockedBy,
};

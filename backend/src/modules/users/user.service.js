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
  // Normalize: empty strings for ENUM/DATE columns are invalid in MySQL.
  // Sending gender='' crashes the entire UPDATE (including name, phone, DOB).
  // Convert '' → undefined so they're excluded from the SET clause.
  const normStr  = (v) => (typeof v === 'string' && v.trim() !== '') ? v.trim() : undefined;
  const normEnum = (v) => (typeof v === 'string' && v.trim() !== '') ? v.trim() : undefined;

  // Whitelist only the fields the frontend sends
  const allowed = {
    first_name:   normStr(patch.firstName),
    last_name:    normStr(patch.lastName),
    phone_number: normStr(patch.phoneNumber),
    dob:          normStr(patch.dobISO) || normStr(patch.dob) || undefined,
    gender:       normEnum(patch.gender),
    blood_group:  normEnum(patch.bloodGroup),
    medical_info: Array.isArray(patch.medicalInfo) ? JSON.stringify(patch.medicalInfo) : undefined,
    home_address: patch.homeAddress !== undefined ? patch.homeAddress : undefined,
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

module.exports = {
  getProfile,
  updateProfile,
  uploadPhoto,
  removePhoto,
};

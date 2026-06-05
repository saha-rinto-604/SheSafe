const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig, admin: adminConfig } = require('../../config/env');
const { httpError } = require('../../utils/httpError');
const { normalizePhoneNumber, isValidBdPhone, phoneSearchVariants } = require('../../utils/phone');
const { validatePasswordStrength } = require('../../middleware/validate');
const {
  findRoleByName,
  listRoles,
  findUserByPhone,
  findUserById,
  ensurePoliceProfilesSchema,
  ensureUserIdentitySchema,
  generateUniqueUsername,
  updatePasswordHash,
  toPublicProfile,
} = require('../users/user.repository');
const { query, pool } = require('../../config/db');
const { sendPhoneOtp, verifyPhoneOtp } = require('../../services/phoneOtp.service');

const ALLOWED_ROLES = new Set(['standard_user', 'volunteer', 'law_enforcement']);

function isAdminUser(user) {
  return String(user?.role_name || '').toLowerCase() === 'admin';
}

/**
 * Transforms a raw DB row into the public user shape for auth responses.
 * Uses the shared toPublicProfile for consistency with GET /api/users/me.
 */
function toPublicUser(user) {
  return toPublicProfile(user);
}

function makeToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role_name,
      phoneNumber: user.phone_number,
      username: user.username || null,
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

async function getLatestVolunteerVerificationStatus(userId) {
  try {
    const rows = await query(
      `SELECT status
       FROM volunteer_verifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [userId]
    );
    return rows[0]?.status || null;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
}

function getAuthNextStep(publicUser, { volunteerStatus = null } = {}) {
  const role = String(publicUser?.role || '').toLowerCase();
  if (role === 'standard_user') return 'STANDARD_HOME';
  if (role === 'volunteer') {
    const status = String(volunteerStatus || '').toLowerCase();
    if (status === 'verified') return 'VOLUNTEER_DASHBOARD';
    if (status === 'pending') return 'VOLUNTEER_PENDING';
    return 'VOLUNTEER_VERIFICATION';
  }
  if (role === 'law_enforcement') {
    const status = String(publicUser?.verificationStatus || '').toUpperCase();
    if (status === 'APPROVED') return 'POLICE_DASHBOARD';
    if (status === 'PENDING') return 'POLICE_PENDING';
    return 'POLICE_VERIFICATION';
  }
  if (role === 'admin') return 'ADMIN_DASHBOARD';
  return 'STANDARD_HOME';
}

async function toAuthResponse(user) {
  const publicUser = toPublicUser(user);
  const volunteerStatus = String(publicUser?.role || '').toLowerCase() === 'volunteer'
    ? await getLatestVolunteerVerificationStatus(user.id)
    : null;
  const nextStep = getAuthNextStep(publicUser, { volunteerStatus });
  const verificationStatus = volunteerStatus ?? publicUser.verificationStatus ?? null;
  return {
    accessToken: makeToken(user),
    user: publicUser,
    role: user.role_name,
    accountStatus: publicUser.accountStatus || null,
    verificationStatus,
    volunteerVerificationStatus: volunteerStatus,
    needsVerification: nextStep.includes('VERIFICATION') || nextStep.includes('PENDING'),
    nextStep,
  };
}

function assertOtpCode(value) {
  const otpCode = String(value || '').trim();
  if (!/^\d{4,8}$/.test(otpCode)) {
    throw httpError(400, 'Invalid or expired OTP.');
  }
  return otpCode;
}

function parsePendingPayload(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function ensurePendingSignupSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS pending_signups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      phone_number VARCHAR(30) NOT NULL,
      role VARCHAR(50) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      payload_json JSON NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pending_signups_phone_number (phone_number),
      KEY idx_pending_signups_expires_at (expires_at)
    )`
  );
}

async function validateSignupPayload(payload, { hashPassword = false } = {}) {
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const password = String(payload.password || '');
  const role = String(payload.role || 'standard_user').trim().toLowerCase();
  const policeStationOrUnit = String(payload.policeStationOrUnit || payload.policeStation || '').trim();
  const badgeNumber = String(payload.badgeNumber || payload.jobIdNumber || '').trim();

  if (!firstName || !lastName) {
    throw httpError(400, 'First name and last name are required.');
  }
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }
  // Enforce strong password format (matches frontend PasswordStrength rules)
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    throw httpError(400, pwError);
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw httpError(400, 'Invalid role.');
  }
  if (role === 'law_enforcement') {
    if (!policeStationOrUnit) throw httpError(400, 'Police station or unit is required.');
    if (!badgeNumber) throw httpError(400, 'Badge or job ID number is required.');
  }

  const roleRow = await findRoleByName(role);
  if (!roleRow) {
    throw httpError(400, 'Role not configured in database.');
  }

  return {
    firstName,
    lastName,
    phoneNumber,
    passwordHash: hashPassword ? await bcrypt.hash(password, 12) : null,
    role,
    roleRow,
    policeStationOrUnit,
    badgeNumber,
  };
}

async function requestSignupOtp(payload) {
  await ensurePendingSignupSchema();
  const signupData = await validateSignupPayload(payload, { hashPassword: true });

  const existing = await findUserByPhone(signupData.phoneNumber);
  if (existing) {
    throw httpError(409, 'Phone number is already registered.');
  }

  const payloadJson = {
    policeStationOrUnit: signupData.policeStationOrUnit || null,
    badgeNumber: signupData.badgeNumber || null,
  };
  await query(
    `INSERT INTO pending_signups
       (phone_number, role, first_name, last_name, password_hash, payload_json, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
     ON DUPLICATE KEY UPDATE
       role = VALUES(role),
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       password_hash = VALUES(password_hash),
       payload_json = VALUES(payload_json),
       expires_at = VALUES(expires_at),
       created_at = NOW()`,
    [
      signupData.phoneNumber,
      signupData.role,
      signupData.firstName,
      signupData.lastName,
      signupData.passwordHash,
      JSON.stringify(payloadJson),
    ]
  );

  await sendPhoneOtp(signupData.phoneNumber);
  return { message: 'OTP sent to your phone number.' };
}

async function createUserFromPendingSignup(pending) {
  const payload = parsePendingPayload(pending.payload_json);
  await ensureUserIdentitySchema();
  if (pending.role === 'law_enforcement') {
    await ensurePoliceProfilesSchema();
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const variants = phoneSearchVariants(pending.phone_number);
    const placeholders = variants.map(() => '?').join(', ');
    const [existingRows] = await conn.execute(
      `SELECT id FROM users WHERE phone_number IN (${placeholders}) LIMIT 1`,
      variants
    );
    if (existingRows.length) {
      await conn.rollback();
      throw httpError(409, 'Phone number is already registered.');
    }

    const [roleRows] = await conn.execute(
      'SELECT id, role_name FROM roles WHERE role_name = ? LIMIT 1',
      [pending.role]
    );
    const roleRow = roleRows[0];
    if (!roleRow) {
      await conn.rollback();
      throw httpError(400, 'Role not configured in database.');
    }

    const username = await generateUniqueUsername(pending.first_name, { conn, skipEnsure: true });
    const [result] = await conn.execute(
      `INSERT INTO users (role_id, first_name, last_name, username, phone_number, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roleRow.id, pending.first_name, pending.last_name, username, pending.phone_number, pending.password_hash]
    );

    if (pending.role === 'law_enforcement') {
      await conn.execute(
        `INSERT INTO police_profiles
           (user_id, police_station_or_unit, badge_number, job_id_card_url, verification_status)
         VALUES (?, ?, ?, NULL, 'PENDING')`,
        [result.insertId, payload.policeStationOrUnit, payload.badgeNumber]
      );
    }

    await conn.execute('DELETE FROM pending_signups WHERE phone_number = ?', [pending.phone_number]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (error?.code === 'ER_DUP_ENTRY' && String(error?.message || '').includes('uq_police_profiles_badge_number')) {
      throw httpError(409, 'Badge or job ID number is already registered.');
    }
    throw error;
  } finally {
    conn.release();
  }

  const user = await findUserByPhone(pending.phone_number);
  return toAuthResponse(user);
}

async function verifySignupOtp(payload) {
  await ensurePendingSignupSchema();
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }
  const otpCode = assertOtpCode(payload.otpCode);

  const rows = await query(
    `SELECT id, phone_number, role, first_name, last_name, password_hash, payload_json, expires_at
     FROM pending_signups
     WHERE phone_number = ?
       AND expires_at > NOW()
     LIMIT 1`,
    [phoneNumber]
  );
  const pending = rows[0];
  if (!pending) {
    throw httpError(400, 'Signup OTP has expired. Please request a new OTP.');
  }

  const approved = await verifyPhoneOtp(phoneNumber, otpCode);
  if (!approved) {
    throw httpError(400, 'Invalid or expired OTP.');
  }

  return createUserFromPendingSignup(pending);
}

async function signup(payload) {
  return requestSignupOtp(payload);
}

async function login(payload) {
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const password = String(payload.password || '');

  if (!phoneNumber || !password) {
    throw httpError(400, 'Phone number and password are required.');
  }
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }

  const user = await findUserByPhone(phoneNumber);
  if (!user) {
    throw httpError(401, 'Invalid credentials. Sign up first.');
  }
  if (isAdminUser(user)) {
    throw httpError(403, 'Use the admin login portal.');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw httpError(401, 'Invalid credentials.');
  }

  return toAuthResponse(user);
}

async function adminLogin(payload) {
  const configuredPhone = normalizePhoneNumber(adminConfig.phoneNumber);
  const configuredPasswordHash = adminConfig.passwordHash;
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const password = String(payload.password || '');

  if (!configuredPhone || !configuredPasswordHash) {
    throw httpError(503, 'Admin login is not configured.');
  }
  if (!phoneNumber || !password) {
    throw httpError(400, 'Phone number and password are required.');
  }
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }
  if (phoneNumber !== configuredPhone) {
    throw httpError(401, 'Invalid admin credentials.');
  }

  const user = await findUserByPhone(phoneNumber);
  if (!user || !isAdminUser(user)) {
    throw httpError(401, 'Invalid admin credentials.');
  }

  const ok = await bcrypt.compare(password, configuredPasswordHash);
  if (!ok) {
    throw httpError(401, 'Invalid admin credentials.');
  }

  return toAuthResponse(user);
}

async function getRoles() {
  const roles = await listRoles();
  return roles
    .filter((r) => String(r.role_name || '').toLowerCase() !== 'admin')
    .map((r) => ({ id: r.id, role: r.role_name }));
}

async function requestOtp(payload) {
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }

  const user = await findUserByPhone(phoneNumber);
  if (!user) {
    throw httpError(404, 'No account found with this phone number.');
  }
  if (isAdminUser(user)) {
    throw httpError(403, 'Admin credentials are managed privately.');
  }

  await sendPhoneOtp(phoneNumber);
  return { message: 'OTP sent to your phone number.' };
}

async function resetPassword(payload) {
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const otpCode = assertOtpCode(payload.otpCode);
  const newPassword = String(payload.newPassword || '');

  if (!phoneNumber || !otpCode || !newPassword) {
    throw httpError(400, 'Phone number, OTP code, and new password are required.');
  }
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    throw httpError(400, pwError);
  }

  const user = await findUserByPhone(phoneNumber);
  if (!user) {
    throw httpError(404, 'No account found with this phone number.');
  }
  if (isAdminUser(user)) {
    throw httpError(403, 'Admin credentials are managed privately.');
  }

  const approved = await verifyPhoneOtp(phoneNumber, otpCode);
  if (!approved) {
    throw httpError(400, 'Invalid or expired OTP.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await updatePasswordHash(user.id, passwordHash);

  return { message: 'Password reset successful.' };
}

/**
 * Change password for an authenticated user.
 * Requires the current password for verification (prevents session hijacking).
 *
 * Why require current password:
 *   Even with a valid JWT, we re-verify the current password to confirm
 *   the person changing it is the actual account holder, not someone
 *   who found an unlocked phone.
 */
async function changePassword(payload) {
  const { userId, currentPassword, newPassword } = payload;

  if (!currentPassword || !newPassword) {
    throw httpError(400, 'Current password and new password are required.');
  }

  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    throw httpError(400, pwError);
  }

  const user = await findUserById(userId);
  if (!user) throw httpError(404, 'User not found.');
  if (isAdminUser(user)) {
    throw httpError(403, 'Admin credentials are managed privately.');
  }

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw httpError(401, 'Current password is incorrect.');

  const hash = await bcrypt.hash(newPassword, 12);
  await updatePasswordHash(userId, hash);

  return { message: 'Password changed successfully.' };
}

module.exports = {
  signup,
  login,
  adminLogin,
  getRoles,
  requestSignupOtp,
  verifySignupOtp,
  requestOtp,
  resetPassword,
  changePassword,
};

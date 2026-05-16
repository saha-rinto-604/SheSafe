const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwt: jwtConfig } = require('../../config/env');
const { httpError } = require('../../utils/httpError');
const { normalizePhoneNumber, isValidBdPhone } = require('../../utils/phone');
const { validatePasswordStrength } = require('../../middleware/validate');
const {
  findRoleByName,
  listRoles,
  findUserByPhone,
  findUserById,
  createUser,
  updatePasswordHash,
  toPublicProfile,
} = require('../users/user.repository');
const { query } = require('../../config/db');

const ALLOWED_ROLES = new Set(['standard_user', 'volunteer', 'law_enforcement']);

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
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

async function signup(payload) {
  console.log('[AUTH] signup attempt:', { phone: payload.phoneNumber, role: payload.role });
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const password = String(payload.password || '');
  const role = String(payload.role || 'standard_user').trim().toLowerCase();

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

  const existing = await findUserByPhone(phoneNumber);
  if (existing) {
    throw httpError(409, 'Phone number is already registered.');
  }

  const roleRow = await findRoleByName(role);
  if (!roleRow) {
    throw httpError(400, 'Role not configured in database.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({
    roleId: roleRow.id,
    firstName,
    lastName,
    phoneNumber,
    passwordHash,
  });

  const accessToken = makeToken(user);
  console.log('[AUTH] signup success: user ID =', user.id, 'role =', user.role_name);
  return {
    accessToken,
    user: toPublicUser(user),
  };
}

async function login(payload) {
  console.log('[AUTH] login attempt:', { phone: payload.phoneNumber });
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const password = String(payload.password || '');

  if (!phoneNumber || !password) {
    throw httpError(400, 'Phone number and password are required.');
  }

  const user = await findUserByPhone(phoneNumber);
  console.log('[AUTH] login user found:', user ? { id: user.id, hashLen: user.password_hash?.length } : 'NOT FOUND');
  if (!user) {
    throw httpError(401, 'Invalid credentials. Sign up first.');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  console.log('[AUTH] login bcrypt result:', ok);
  if (!ok) {
    throw httpError(401, 'Invalid credentials.');
  }

  const accessToken = makeToken(user);
  return {
    accessToken,
    user: toPublicUser(user),
  };
}

async function getRoles() {
  const roles = await listRoles();
  return roles.map((r) => ({ id: r.id, role: r.role_name }));
}

/**
 * Generates a 6-digit OTP, stores it in password_reset_otps (15-min TTL),
 * and returns it.
 * TODO: Replace the returned otpCode with an SMS delivery (e.g. Twilio) in production.
 */
async function requestOtp(payload) {
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }

  const user = await findUserByPhone(phoneNumber);
  if (!user) {
    throw httpError(404, 'No account found with this phone number.');
  }

  const otpCode = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await query(
    `INSERT INTO password_reset_otps (phone_number, otp_code, expires_at) VALUES (?, ?, ?)`,
    [phoneNumber, otpCode, expiresAt]
  );

  // In production: send otpCode via SMS to phoneNumber
  return { otpCode }; // returned for dev/testing; remove in production
}

async function resetPassword(payload) {
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const otpCode = String(payload.otpCode || '').trim();
  const newPassword = String(payload.newPassword || '');

  if (!phoneNumber || !otpCode || !newPassword) {
    throw httpError(400, 'Phone number, OTP code, and new password are required.');
  }
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    throw httpError(400, pwError);
  }

  const rows = await query(
    `SELECT id FROM password_reset_otps
     WHERE phone_number = ? AND otp_code = ? AND used = 0 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phoneNumber, otpCode]
  );

  if (rows.length === 0) {
    throw httpError(400, 'Invalid or expired OTP.');
  }

  const otpId = rows[0].id;
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await query(`UPDATE users SET password_hash = ? WHERE phone_number = ?`, [passwordHash, phoneNumber]);
  await query(`UPDATE password_reset_otps SET used = 1 WHERE id = ?`, [otpId]);

  return { message: 'Password reset successfully.' };
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

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw httpError(401, 'Current password is incorrect.');

  const hash = await bcrypt.hash(newPassword, 12);
  await updatePasswordHash(userId, hash);

  return { message: 'Password changed successfully.' };
}

module.exports = {
  signup,
  login,
  getRoles,
  requestOtp,
  resetPassword,
  changePassword,
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwt: jwtConfig, admin: adminConfig } = require('../../config/env');
const { httpError } = require('../../utils/httpError');
const { normalizePhoneNumber, isValidBdPhone } = require('../../utils/phone');
const { validatePasswordStrength } = require('../../middleware/validate');
const {
  findRoleByName,
  listRoles,
  findUserByPhone,
  findUserById,
  createUser,
  createPoliceProfile,
  createPoliceUser,
  updatePasswordHash,
  toPublicProfile,
} = require('../users/user.repository');
const { query } = require('../../config/db');

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
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

async function signup(payload) {
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

  const existing = await findUserByPhone(phoneNumber);
  if (existing) {
    const existingRole = String(existing.role_name || '').toLowerCase();
    if (role === 'law_enforcement' && existingRole === 'law_enforcement') {
      const samePassword = await bcrypt.compare(password, existing.password_hash);
      if (samePassword && !existing.police_verification_status) {
        const recoveredUser = await createPoliceProfile({
          userId: existing.id,
          policeStationOrUnit,
          badgeNumber,
        });
        return {
          accessToken: makeToken(recoveredUser),
          user: toPublicUser(recoveredUser),
        };
      }
    }
    throw httpError(409, 'Phone number is already registered.');
  }

  const roleRow = await findRoleByName(role);
  if (!roleRow) {
    throw httpError(400, 'Role not configured in database.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = role === 'law_enforcement'
    ? await createPoliceUser({
      roleId: roleRow.id,
      firstName,
      lastName,
      phoneNumber,
      passwordHash,
      policeStationOrUnit,
      badgeNumber,
    })
    : await createUser({
      roleId: roleRow.id,
      firstName,
      lastName,
      phoneNumber,
      passwordHash,
    });

  const accessToken = makeToken(user);
  return {
    accessToken,
    user: toPublicUser(user),
  };
}

async function login(payload) {
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const password = String(payload.password || '');

  if (!phoneNumber || !password) {
    throw httpError(400, 'Phone number and password are required.');
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

  const accessToken = makeToken(user);
  return {
    accessToken,
    user: toPublicUser(user),
  };
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

  return {
    accessToken: makeToken(user),
    user: toPublicUser(user),
  };
}

async function getRoles() {
  const roles = await listRoles();
  return roles
    .filter((r) => String(r.role_name || '').toLowerCase() !== 'admin')
    .map((r) => ({ id: r.id, role: r.role_name }));
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
  if (isAdminUser(user)) {
    throw httpError(403, 'Admin credentials are managed privately.');
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

  const user = await findUserByPhone(phoneNumber);
  if (!user) {
    throw httpError(404, 'No account found with this phone number.');
  }
  if (isAdminUser(user)) {
    throw httpError(403, 'Admin credentials are managed privately.');
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
  requestOtp,
  resetPassword,
  changePassword,
};

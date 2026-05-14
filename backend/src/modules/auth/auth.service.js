const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwt: jwtConfig } = require('../../config/env');
const { httpError } = require('../../utils/httpError');
const { normalizePhoneNumber, isValidBdPhone } = require('../../utils/phone');
const {
  findRoleByName,
  listRoles,
  findUserByPhone,
  createUser,
} = require('../users/user.repository');
const { query } = require('../../config/db');

const ALLOWED_ROLES = new Set(['standard_user', 'volunteer', 'law_enforcement']);

function toPublicUser(user) {
  return {
    id: user.id,
    role: user.role_name,
    firstName: user.first_name,
    lastName: user.last_name,
    phoneNumber: user.phone_number,
    entryTime: user.entry_time,
  };
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

  if (!firstName || !lastName) {
    throw httpError(400, 'First name and last name are required.');
  }
  if (!isValidBdPhone(phoneNumber)) {
    throw httpError(400, 'Invalid phone number format.');
  }
  if (password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters.');
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
  if (newPassword.length < 8) {
    throw httpError(400, 'New password must be at least 8 characters.');
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

module.exports = {
  signup,
  login,
  getRoles,
  requestOtp,
  resetPassword,
};

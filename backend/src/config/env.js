const dotenv = require('dotenv');

dotenv.config();

function normalizeUrl(value) {
  return (value || '').trim().replace(/\/+$/, '');
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function parseCsv(value, fallback = []) {
  const values = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const port = Number(process.env.PORT || 4000);
const corsOrigin = (process.env.CORS_ORIGIN || '*').trim();
const nodeEnv = (process.env.NODE_ENV || 'development').trim();

module.exports = {
  port,
  nodeEnv,
  baseUrl: normalizeUrl(process.env.BASE_URL),
  corsOrigin,
  corsOrigins: corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean),
  trustProxy: parseBoolean(process.env.TRUST_PROXY),
  mysql: {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  admin: {
    phoneNumber: (process.env.ADMIN_PHONE_NUMBER || '').trim(),
    passwordHash: (process.env.ADMIN_PASSWORD_HASH || '').trim(),
  },
  auth: {
    returnOtpInResponse:
      parseBoolean(process.env.AUTH_RETURN_OTP_IN_RESPONSE)
      || nodeEnv === 'development'
      || nodeEnv === 'test',
  },
  webRtc: {
    stunUrls: parseCsv(process.env.WEBRTC_STUN_URLS, ['stun:stun.l.google.com:19302']),
    turnUrl: (process.env.WEBRTC_TURN_URL || '').trim(),
    turnUsername: (process.env.WEBRTC_TURN_USERNAME || '').trim(),
    turnCredential: (process.env.WEBRTC_TURN_CREDENTIAL || '').trim(),
  },
};

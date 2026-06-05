const twilio = require('twilio');
const { httpError } = require('../utils/httpError');
const { normalizePhoneNumber, isValidBdPhone } = require('../utils/phone');

let twilioClient;

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function assertTwilioProvider() {
  const provider = String(process.env.OTP_PROVIDER || 'twilio').trim().toLowerCase();
  parseBoolean(process.env.RETURN_OTP_IN_DEV);
  if (provider !== 'twilio') {
    throw httpError(503, 'OTP service is not configured.');
  }
}

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  assertTwilioProvider();
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw httpError(503, 'OTP service is not configured.');
  }
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

function getVerifyServiceSid() {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) {
    throw httpError(503, 'OTP service is not configured.');
  }
  return serviceSid;
}

function normalizeTwilioError(error) {
  const code = Number(error?.code || 0);
  const status = Number(error?.status || error?.statusCode || 0);
  if ([21211, 21608, 60200, 60203].includes(code) || status === 400 || status === 403) {
    return httpError(400, 'OTP could not be sent. This number may not be verified for the Twilio trial account.');
  }
  return httpError(status >= 400 && status < 500 ? status : 502, 'OTP service is temporarily unavailable. Please try again.');
}

function assertPhone(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!isValidBdPhone(normalized)) {
    throw httpError(400, 'Invalid phone number format.');
  }
  return normalized;
}

async function sendPhoneOtp(phoneNumber) {
  const to = assertPhone(phoneNumber);
  try {
    await getTwilioClient()
      .verify
      .v2
      .services(getVerifyServiceSid())
      .verifications
      .create({ to, channel: 'sms' });
    return true;
  } catch (error) {
    throw normalizeTwilioError(error);
  }
}

async function verifyPhoneOtp(phoneNumber, otpCode) {
  const to = assertPhone(phoneNumber);
  const code = String(otpCode || '').trim();
  if (!/^\d{4,8}$/.test(code)) {
    throw httpError(400, 'Invalid or expired OTP.');
  }
  try {
    const result = await getTwilioClient()
      .verify
      .v2
      .services(getVerifyServiceSid())
      .verificationChecks
      .create({ to, code });
    return result?.status === 'approved';
  } catch (error) {
    const status = Number(error?.status || error?.statusCode || 0);
    if (status >= 400 && status < 500) return false;
    throw normalizeTwilioError(error);
  }
}

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp,
};

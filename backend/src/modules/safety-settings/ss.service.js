/**
 * ss.service.js — Safety Settings Business Logic
 */

const ssRepo = require('./ss.repository');

/** Transform DB row to frontend-compatible shape (camelCase). */
function toPublic(row) {
  if (!row) return { ...ssRepo.DEFAULTS };
  return {
    sosCancelTimerSec: row.sos_cancel_timer_sec,
    notifyEmergencyContacts: !!row.notify_emergency_contacts,
    pushNotifications: !!row.push_notifications,
    smsBackupAlert: !!row.sms_backup_alert,
    maxResponders: row.max_responders,
  };
}

async function get(userId) {
  const row = await ssRepo.findByUserId(userId);
  return toPublic(row);
}

async function save(userId, settings) {
  const row = await ssRepo.upsert(userId, settings);
  return toPublic(row);
}

module.exports = { get, save };

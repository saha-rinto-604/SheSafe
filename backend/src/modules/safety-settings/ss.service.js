/**
 * ss.service.js — Safety Settings Business Logic
 */

const ssRepo = require('./ss.repository');

/** Transform DB row to frontend-compatible shape (camelCase). */
function toPublic(row) {
  if (!row) {
    return {
      sosCancelTimerSec: ssRepo.DEFAULTS.sos_cancel_timer_sec,
      notifyEmergencyContacts: ssRepo.DEFAULTS.notify_emergency_contacts,
      pushNotifications: ssRepo.DEFAULTS.push_notifications,
      smsBackupAlert: ssRepo.DEFAULTS.sms_backup_alert,
      maxResponders: ssRepo.DEFAULTS.max_responders,
      allowEmergencyAutoEvidenceRecording: ssRepo.DEFAULTS.allow_emergency_auto_evidence_recording,
    };
  }
  return {
    sosCancelTimerSec: row.sos_cancel_timer_sec,
    notifyEmergencyContacts: !!row.notify_emergency_contacts,
    pushNotifications: !!row.push_notifications,
    smsBackupAlert: !!row.sms_backup_alert,
    maxResponders: row.max_responders,
    allowEmergencyAutoEvidenceRecording: !!row.allow_emergency_auto_evidence_recording,
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

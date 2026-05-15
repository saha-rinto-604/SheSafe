/**
 * ss.repository.js — Safety Settings Data Access Layer
 * ──────────────────────────────────────────────────────────────────────
 * One-to-one relationship with users. Uses UPSERT (INSERT ... ON DUPLICATE KEY)
 * for idempotent saves — the frontend auto-saves on every toggle change.
 */

const { query } = require('../../config/db');

/** Default settings matching the frontend DEFAULT_SAFETY_SETTINGS. */
const DEFAULTS = {
  sos_cancel_timer_sec: 10,
  notify_emergency_contacts: true,
  push_notifications: true,
  sms_backup_alert: false,
  max_responders: 5,
};

async function findByUserId(userId) {
  const rows = await query(
    'SELECT * FROM safety_settings WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

/**
 * UPSERT — Insert if not exists, update if exists.
 *
 * Why UPSERT:
 *   The frontend auto-saves settings on every toggle. With UPSERT, we don't
 *   need to check if a row exists first — it's a single atomic operation.
 *   This eliminates race conditions from rapid toggle changes.
 */
async function upsert(userId, settings) {
  await query(
    `INSERT INTO safety_settings
       (user_id, sos_cancel_timer_sec, notify_emergency_contacts, push_notifications, sms_backup_alert, max_responders)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       sos_cancel_timer_sec = VALUES(sos_cancel_timer_sec),
       notify_emergency_contacts = VALUES(notify_emergency_contacts),
       push_notifications = VALUES(push_notifications),
       sms_backup_alert = VALUES(sms_backup_alert),
       max_responders = VALUES(max_responders)`,
    [
      userId,
      settings.sosCancelTimerSec ?? DEFAULTS.sos_cancel_timer_sec,
      settings.notifyEmergencyContacts ?? DEFAULTS.notify_emergency_contacts,
      settings.pushNotifications ?? DEFAULTS.push_notifications,
      settings.smsBackupAlert ?? DEFAULTS.sms_backup_alert,
      settings.maxResponders ?? DEFAULTS.max_responders,
    ]
  );
  return findByUserId(userId);
}

module.exports = { findByUserId, upsert, DEFAULTS };

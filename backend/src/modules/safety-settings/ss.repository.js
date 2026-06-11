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
  allow_emergency_auto_evidence_recording: false,
};

let safetySettingsSchemaReady = false;

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function ensureSafetySettingsSchema() {
  if (safetySettingsSchemaReady) return;
  await query(
    `CREATE TABLE IF NOT EXISTS safety_settings (
       id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       user_id BIGINT UNSIGNED NOT NULL UNIQUE,
       sos_cancel_timer_sec TINYINT UNSIGNED DEFAULT 10,
       notify_emergency_contacts BOOLEAN DEFAULT TRUE,
       push_notifications BOOLEAN DEFAULT TRUE,
       sms_backup_alert BOOLEAN DEFAULT FALSE,
       max_responders TINYINT UNSIGNED DEFAULT 5,
       allow_emergency_auto_evidence_recording BOOLEAN NOT NULL DEFAULT FALSE,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  if (!(await hasColumn('safety_settings', 'allow_emergency_auto_evidence_recording'))) {
    await query(
      `ALTER TABLE safety_settings
       ADD COLUMN allow_emergency_auto_evidence_recording BOOLEAN NOT NULL DEFAULT FALSE AFTER max_responders`
    );
  }
  safetySettingsSchemaReady = true;
}

async function findByUserId(userId) {
  await ensureSafetySettingsSchema();
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
  await ensureSafetySettingsSchema();
  await query(
    `INSERT INTO safety_settings
       (
         user_id,
         sos_cancel_timer_sec,
         notify_emergency_contacts,
         push_notifications,
         sms_backup_alert,
         max_responders,
         allow_emergency_auto_evidence_recording
       )
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       sos_cancel_timer_sec = VALUES(sos_cancel_timer_sec),
       notify_emergency_contacts = VALUES(notify_emergency_contacts),
       push_notifications = VALUES(push_notifications),
       sms_backup_alert = VALUES(sms_backup_alert),
       max_responders = VALUES(max_responders),
       allow_emergency_auto_evidence_recording = VALUES(allow_emergency_auto_evidence_recording)`,
    [
      userId,
      settings.sosCancelTimerSec ?? DEFAULTS.sos_cancel_timer_sec,
      settings.notifyEmergencyContacts ?? DEFAULTS.notify_emergency_contacts,
      settings.pushNotifications ?? DEFAULTS.push_notifications,
      settings.smsBackupAlert ?? DEFAULTS.sms_backup_alert,
      settings.maxResponders ?? DEFAULTS.max_responders,
      settings.allowEmergencyAutoEvidenceRecording ?? DEFAULTS.allow_emergency_auto_evidence_recording,
    ]
  );
  return findByUserId(userId);
}

module.exports = { findByUserId, upsert, DEFAULTS, ensureSafetySettingsSchema };

const { query } = require('../../config/db');

function parseData(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function sanitizeNotificationText(value) {
  return String(value || '').replace(/\+?\d[\d\s().-]{6,}\d/g, 'Someone');
}

function formatNotification(row) {
  return {
    id: String(row.id),
    type: row.type,
    title: sanitizeNotificationText(row.title),
    body: sanitizeNotificationText(row.body),
    incidentId: row.incident_id ? String(row.incident_id) : null,
    chatId: row.chat_id ? String(row.chat_id) : null,
    data: parseData(row.data_json),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    seenAt: row.seen_at ? new Date(row.seen_at).toISOString() : null,
    shownInAppAt: row.shown_in_app_at ? new Date(row.shown_in_app_at).toISOString() : null,
    read: !!row.read_at,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

async function createNotification({ userId, type, title, body, incidentId = null, chatId = null, data = {} }) {
  const result = await query(
    `INSERT INTO notifications
       (user_id, type, title, body, incident_id, chat_id, data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, title, body || '', incidentId, chatId, JSON.stringify(data || {})]
  );
  const rows = await query(
    `SELECT * FROM notifications WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return formatNotification(rows[0]);
}

async function listNotifications(userId, { limit = 50 } = {}) {
  const rows = await query(
    `SELECT *
       FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [userId, Number(limit)]
  );
  return rows.map(formatNotification);
}

async function listMissedNotifications(userId, { limit = 10 } = {}) {
  const rows = await query(
    `SELECT *
       FROM notifications
      WHERE user_id = ?
        AND read_at IS NULL
        AND shown_in_app_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [userId, Number(limit)]
  );
  return rows.reverse().map(formatNotification);
}

async function unreadCount(userId) {
  const rows = await query(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );
  return Number(rows[0]?.count || 0);
}

async function markRead(userId, notificationId) {
  await query(
    `UPDATE notifications
        SET read_at = COALESCE(read_at, NOW()),
            seen_at = COALESCE(seen_at, NOW())
      WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
}

async function markAllRead(userId) {
  await query(
    `UPDATE notifications
        SET read_at = COALESCE(read_at, NOW()),
            seen_at = COALESCE(seen_at, NOW())
      WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );
}

async function markShown(userId, ids) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await query(
    `UPDATE notifications
        SET shown_in_app_at = COALESCE(shown_in_app_at, NOW()),
            seen_at = COALESCE(seen_at, NOW())
      WHERE user_id = ?
        AND id IN (${placeholders})`,
    [userId, ...ids]
  );
}

async function upsertPushToken({ userId, expoPushToken, platform = null, deviceId = null }) {
  await query(
    `INSERT INTO user_push_tokens
       (user_id, expo_push_token, platform, device_id, is_active, last_seen_at)
     VALUES (?, ?, ?, ?, TRUE, NOW())
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       platform = VALUES(platform),
       device_id = VALUES(device_id),
       is_active = TRUE,
       last_seen_at = NOW()`,
    [userId, expoPushToken, platform, deviceId]
  );
}

async function deactivatePushToken({ userId, expoPushToken, deviceId = null }) {
  const filters = ['user_id = ?'];
  const params = [userId];
  if (expoPushToken) {
    filters.push('expo_push_token = ?');
    params.push(expoPushToken);
  } else if (deviceId) {
    filters.push('device_id = ?');
    params.push(deviceId);
  } else {
    return;
  }
  await query(
    `UPDATE user_push_tokens SET is_active = FALSE WHERE ${filters.join(' AND ')}`,
    params
  );
}

async function getActivePushTokens(userId) {
  return query(
    `SELECT id, expo_push_token, platform
       FROM user_push_tokens
      WHERE user_id = ?
        AND is_active = TRUE`,
    [userId]
  );
}

async function deactivateTokenByValue(expoPushToken) {
  await query(
    `UPDATE user_push_tokens SET is_active = FALSE WHERE expo_push_token = ?`,
    [expoPushToken]
  );
}

module.exports = {
  createNotification,
  listNotifications,
  listMissedNotifications,
  unreadCount,
  markRead,
  markAllRead,
  markShown,
  upsertPushToken,
  deactivatePushToken,
  getActivePushTokens,
  deactivateTokenByValue,
};

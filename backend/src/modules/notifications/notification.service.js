const repo = require('./notification.repository');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function safeData(data = {}) {
  const allowed = {};
  for (const key of ['notificationId', 'type', 'incidentId', 'chatId', 'role', 'context']) {
    if (data[key] !== undefined && data[key] !== null) allowed[key] = String(data[key]);
  }
  return allowed;
}

function isInvalidExpoTicket(ticket) {
  const details = ticket?.details || {};
  return ticket?.status === 'error'
    && ['DeviceNotRegistered', 'InvalidCredentials'].includes(String(details.error || ''));
}

async function sendExpoPushToUser(userId, { title, body, data = {} }) {
  const tokens = await repo.getActivePushTokens(userId);
  if (!tokens.length || typeof fetch !== 'function') return;

  const messages = tokens.map((token) => ({
    to: token.expo_push_token,
    sound: 'default',
    title,
    body,
    data: safeData(data),
    priority: 'high',
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    const tickets = Array.isArray(json?.data) ? json.data : [];
    await Promise.all(tickets.map((ticket, index) => (
      isInvalidExpoTicket(ticket)
        ? repo.deactivateTokenByValue(tokens[index]?.expo_push_token).catch(() => undefined)
        : Promise.resolve()
    )));
  } catch (error) {
    console.warn('[Notifications] Expo push dispatch failed:', error?.message || error);
  }
}

async function createAndDispatchNotification({
  userId,
  type,
  title,
  body,
  incidentId = null,
  chatId = null,
  data = {},
  pushTitle,
  pushBody,
  emit,
}) {
  const notification = await repo.createNotification({
    userId,
    type,
    title,
    body,
    incidentId,
    chatId,
    data: { ...data, type, incidentId, chatId },
  });

  if (emit) {
    try {
      emit({
        type: 'notification.created',
        payload: notification,
      });
    } catch (error) {
      console.warn('[Notifications] websocket emit failed:', error?.message || error);
    }
  }

  await sendExpoPushToUser(userId, {
    title: pushTitle || title,
    body: pushBody || body,
    data: {
      notificationId: notification.id,
      type,
      incidentId,
      chatId,
      ...data,
    },
  });

  return notification;
}

function registerPushToken(userId, payload) {
  const expoPushToken = String(payload.expoPushToken || payload.token || '').trim();
  if (!expoPushToken) {
    const err = new Error('Expo push token is required.');
    err.status = 400;
    throw err;
  }
  return repo.upsertPushToken({
    userId,
    expoPushToken,
    platform: payload.platform || null,
    deviceId: payload.deviceId || null,
  });
}

function deactivatePushToken(userId, payload) {
  return repo.deactivatePushToken({
    userId,
    expoPushToken: payload.expoPushToken || payload.token || null,
    deviceId: payload.deviceId || null,
  });
}

async function list(userId, options) {
  return {
    notifications: await repo.listNotifications(userId, options),
    unreadCount: await repo.unreadCount(userId),
  };
}

async function missed(userId, options) {
  return {
    notifications: await repo.listMissedNotifications(userId, options),
    unreadCount: await repo.unreadCount(userId),
  };
}

async function markRead(userId, notificationId) {
  await repo.markRead(userId, notificationId);
  return { unreadCount: await repo.unreadCount(userId) };
}

async function markAllRead(userId) {
  await repo.markAllRead(userId);
  return { unreadCount: 0 };
}

async function markShown(userId, ids) {
  await repo.markShown(userId, ids.map(String).filter(Boolean));
  return { unreadCount: await repo.unreadCount(userId) };
}

module.exports = {
  createAndDispatchNotification,
  registerPushToken,
  deactivatePushToken,
  list,
  missed,
  markRead,
  markAllRead,
  markShown,
};

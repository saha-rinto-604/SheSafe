import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';

export type BackendNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  incidentId?: string | null;
  chatId?: string | null;
  data?: Record<string, any>;
  read: boolean;
  readAt?: string | null;
  seenAt?: string | null;
  shownInAppAt?: string | null;
  createdAt: string;
};

type NotificationListResponse = {
  notifications: BackendNotification[];
  unreadCount: number;
};

function sanitizeNotificationText(value: unknown): string {
  return String(value || '').replace(/\+?\d[\d\s().-]{6,}\d/g, 'Someone');
}

function normalizeBackendNotification(value: unknown): BackendNotification | null {
  if (!value || typeof value !== 'object') return null;
  const notification = value as Record<string, unknown>;
  const id = String(notification.id ?? '').trim();
  if (!id) return null;

  const data = notification.data && typeof notification.data === 'object' && !Array.isArray(notification.data)
    ? notification.data as Record<string, any>
    : {};

  return {
    id,
    type: String(notification.type || 'SYSTEM'),
    title: sanitizeNotificationText(notification.title),
    body: sanitizeNotificationText(notification.body),
    incidentId: notification.incidentId == null ? null : String(notification.incidentId),
    chatId: notification.chatId == null ? null : String(notification.chatId),
    data,
    read: Boolean(notification.read),
    readAt: notification.readAt == null ? null : String(notification.readAt),
    seenAt: notification.seenAt == null ? null : String(notification.seenAt),
    shownInAppAt: notification.shownInAppAt == null ? null : String(notification.shownInAppAt),
    createdAt: notification.createdAt ? String(notification.createdAt) : new Date().toISOString(),
  };
}

function normalizeNotificationListResponse(value: unknown): NotificationListResponse {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const notifications = Array.isArray(data.notifications)
    ? data.notifications.map(normalizeBackendNotification).filter((item): item is BackendNotification => item !== null)
    : [];
  const parsedUnreadCount = Number(data.unreadCount);
  return {
    notifications,
    unreadCount: Number.isFinite(parsedUnreadCount) && parsedUnreadCount >= 0 ? parsedUnreadCount : 0,
  };
}

let lastRegisteredToken: string | null = null;
let notificationsModulePromise: Promise<typeof import('expo-notifications') | null> | null = null;

export function shouldSkipNativeNotifications() {
  const appOwnership = (Constants as any).appOwnership;
  const executionEnvironment = (Constants as any).executionEnvironment;
  const isExpoGo = appOwnership === 'expo' || executionEnvironment === 'storeClient';
  return Platform.OS === 'web' || (Platform.OS === 'android' && isExpoGo);
}

export function loadNotificationsModule() {
  if (shouldSkipNativeNotifications()) return Promise.resolve(null);

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch(() => null);
  }

  return notificationsModulePromise;
}

function projectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId
    || undefined
  );
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || Constants.isDevice === false) return null;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SheSafe alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8A38F6',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const project = projectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(project ? { projectId: project } : undefined);
  const token = tokenResult.data;
  lastRegisteredToken = token;
  await api.post('/api/notifications/push-token', {
    expoPushToken: token,
    platform: Platform.OS,
    deviceId: Constants.sessionId || null,
  });
  return token;
}

export async function deactivateCurrentPushToken(): Promise<void> {
  if (!lastRegisteredToken) return;
  await api.patch('/api/notifications/push-token/deactivate', {
    expoPushToken: lastRegisteredToken,
    deviceId: Constants.sessionId || null,
  }).catch(() => undefined);
  lastRegisteredToken = null;
}

export const notificationService = {
  async list(limit = 50): Promise<NotificationListResponse> {
    const res = await api.get('/api/notifications', { params: { limit } });
    return normalizeNotificationListResponse(res.data);
  },

  async missed(limit = 10): Promise<NotificationListResponse> {
    const res = await api.get('/api/notifications/missed', { params: { limit } });
    return normalizeNotificationListResponse(res.data);
  },

  async markRead(id: string): Promise<{ unreadCount: number }> {
    const res = await api.patch(`/api/notifications/${id}/read`);
    return res.data as { unreadCount: number };
  },

  async markAllRead(): Promise<{ unreadCount: number }> {
    const res = await api.patch('/api/notifications/read-all');
    return res.data as { unreadCount: number };
  },

  async markShown(ids: string[]): Promise<{ unreadCount: number }> {
    const safeIds = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
    if (!safeIds.length) return { unreadCount: 0 };
    const res = await api.patch('/api/notifications/shown', { ids: safeIds });
    return res.data as { unreadCount: number };
  },
};

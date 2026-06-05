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

function sanitizeNotificationText(value: string): string {
  return String(value || '').replace(/\+?\d[\d\s().-]{6,}\d/g, 'Someone');
}

function sanitizeBackendNotification(notification: BackendNotification): BackendNotification {
  return {
    ...notification,
    title: sanitizeNotificationText(notification.title),
    body: sanitizeNotificationText(notification.body),
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
    const data = res.data as NotificationListResponse;
    return { ...data, notifications: (data.notifications || []).map(sanitizeBackendNotification) };
  },

  async missed(limit = 10): Promise<NotificationListResponse> {
    const res = await api.get('/api/notifications/missed', { params: { limit } });
    const data = res.data as NotificationListResponse;
    return { ...data, notifications: (data.notifications || []).map(sanitizeBackendNotification) };
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
    const res = await api.patch('/api/notifications/shown', { ids });
    return res.data as { unreadCount: number };
  },
};

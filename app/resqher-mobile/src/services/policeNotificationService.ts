import {
  notificationStore,
  subscribeUnread,
  type AppNotification,
  type NotifType,
} from './notificationStore';

export type PoliceNotificationPayload = {
  notificationId?: string | null;
  type?: string | null;
  incidentId?: string | null;
  requestId?: string | null;
  status?: string | null;
  title?: string | null;
  message?: string | null;
  createdAt?: string | null;
};

function notificationType(payload: PoliceNotificationPayload): NotifType {
  const status = String(payload.status || '').toUpperCase();
  const type = String(payload.type || '').toUpperCase();
  if (status === 'RESOLVED' || type === 'INCIDENT_RESOLVED') return 'incident_resolved';
  if (status === 'CANCELLED' || type === 'INCIDENT_CANCELLED') return 'incident_cancelled';
  return 'system';
}

function fallbackTitle(payload: PoliceNotificationPayload) {
  const status = String(payload.status || '').toUpperCase();
  const type = String(payload.type || '').toUpperCase();
  if (status === 'RESOLVED' || type === 'INCIDENT_RESOLVED') return 'Incident Resolved';
  if (status === 'CANCELLED' || type === 'INCIDENT_CANCELLED') return 'Incident Cancelled';
  if (type === 'POLICE_ASSIGNMENT') return 'New Police Assignment';
  return 'Police Notification';
}

function fallbackBody(payload: PoliceNotificationPayload) {
  const status = String(payload.status || '').toUpperCase();
  const type = String(payload.type || '').toUpperCase();
  if (status === 'RESOLVED' || type === 'INCIDENT_RESOLVED') {
    return 'This incident has been resolved and was removed from your dashboard.';
  }
  if (status === 'CANCELLED' || type === 'INCIDENT_CANCELLED') {
    return 'This incident has been cancelled and was removed from your dashboard.';
  }
  if (type === 'POLICE_ASSIGNMENT') {
    return 'A law enforcement request has been assigned to you.';
  }
  return 'A police workflow update is available.';
}

function sourceId(payload: PoliceNotificationPayload) {
  return String(
    payload.notificationId
    || `police:${payload.type || 'event'}:${payload.incidentId || 'incident'}:${payload.requestId || 'request'}:${payload.status || 'status'}`
  );
}

export async function addPoliceNotification(payload: PoliceNotificationPayload): Promise<void> {
  await notificationStore.add({
    sourceId: sourceId(payload),
    type: notificationType(payload),
    title: payload.title || fallbackTitle(payload),
    body: payload.message || fallbackBody(payload),
    incidentId: payload.incidentId || undefined,
    createdAt: payload.createdAt || undefined,
  });
}

export async function getPoliceNotifications(): Promise<AppNotification[]> {
  return notificationStore.getAll();
}

export const policeNotificationStore = {
  add: addPoliceNotification,
  getAll: getPoliceNotifications,
  markRead: notificationStore.markRead,
  markAllRead: notificationStore.markAllRead,
  getUnreadCount: notificationStore.getUnreadCount,
  subscribeUnread,
};

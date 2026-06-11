import { Platform } from 'react-native';

export type WebNotificationPermission = NotificationPermission | 'unsupported';

export type WebSystemNotificationInput = {
  title: string;
  body: string;
  tag: string;
  data?: Record<string, unknown>;
  url?: string;
  icon?: string;
};

const shownTags = new Set<string>();
const SHOWN_TAGS_STORAGE_KEY = 'shesafe.web-notification-tags';
const MAX_STORED_TAGS = 200;

function devLog(message: string, detail?: unknown) {
  if (!__DEV__) return;
  if (detail === undefined) {
    console.info(`[web-notification] ${message}`);
    return;
  }
  console.info(`[web-notification] ${message}`, detail);
}

function loadShownTags() {
  if (typeof window === 'undefined') return;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SHOWN_TAGS_STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) {
      stored.slice(-MAX_STORED_TAGS).forEach(tag => shownTags.add(String(tag)));
    }
  } catch {
    // Session storage is optional; the in-memory set still deduplicates.
  }
}

function rememberShownTag(tag: string) {
  shownTags.add(tag);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      SHOWN_TAGS_STORAGE_KEY,
      JSON.stringify([...shownTags].slice(-MAX_STORED_TAGS)),
    );
  } catch {
    // Some private browser modes disable session storage.
  }
}

loadShownTags();

export function isWebNotificationSupported() {
  const supported = Platform.OS === 'web'
    && typeof window !== 'undefined'
    && 'Notification' in window;
  devLog(`supported: ${supported}`);
  return supported;
}

export function getWebNotificationPermission(): WebNotificationPermission {
  const permission = isWebNotificationSupported() ? window.Notification.permission : 'unsupported';
  devLog(`permission: ${permission}`);
  return permission;
}

export async function requestWebNotificationPermission(): Promise<WebNotificationPermission> {
  if (!isWebNotificationSupported()) {
    devLog('skipped reason: Notification API unsupported');
    return 'unsupported';
  }
  if (window.Notification.permission !== 'default') {
    devLog(`permission: ${window.Notification.permission}`);
    return window.Notification.permission;
  }
  try {
    const permission = await window.Notification.requestPermission();
    devLog(`permission: ${permission}`);
    return permission;
  } catch (error) {
    devLog('skipped reason: permission request failed', error instanceof Error ? error.message : 'unknown error');
    return window.Notification.permission;
  }
}

export function showWebSystemNotification({
  title,
  body,
  tag,
  data,
  url,
  icon,
}: WebSystemNotificationInput) {
  if (!isWebNotificationSupported()) {
    devLog('skipped reason: Notification API unsupported');
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    devLog(`skipped reason: permission is ${window.Notification.permission}`);
    return false;
  }
  const safeTag = String(tag || '').trim();
  if (!safeTag) {
    devLog('skipped reason: missing stable notification tag');
    return false;
  }
  if (shownTags.has(safeTag)) {
    devLog(`skipped reason: duplicate tag ${safeTag}`);
    return false;
  }

  try {
    devLog(`showing system notification: ${safeTag}`);
    devLog('new Notification called');
    const notification = new window.Notification(title, {
      body,
      tag: safeTag,
      data: { ...data, url },
      icon: icon || '/favicon.ico',
    });
    rememberShownTag(safeTag);
    notification.onclick = () => {
      window.focus();
      if (url) {
        const target = new URL(url, window.location.origin);
        if (target.origin === window.location.origin) {
          window.location.assign(`${target.pathname}${target.search}${target.hash}`);
        }
      }
      notification.close();
    };
    return true;
  } catch (error) {
    devLog('skipped reason: Notification constructor failed', error instanceof Error ? error.message : 'unknown error');
    return false;
  }
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, R, S } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  type BackendNotification,
  loadNotificationsModule,
  notificationService,
  registerForPushNotifications,
} from '../services/notificationService';
import { notificationStore, type NotifType } from '../services/notificationStore';
import { showWebSystemNotification } from '../services/webNotificationService';
import { liveVideoNavigation } from '../services/liveVideoNavigation';

type BannerContextValue = {
  enqueue: (notification: BackendNotification) => void;
};

const BannerContext = createContext<BannerContextValue | null>(null);

type BannerState = {
  active: BackendNotification | null;
  queue: BackendNotification[];
};

type BannerAction =
  | { type: 'enqueue'; notification: BackendNotification }
  | { type: 'advance' }
  | { type: 'reset' };

function bannerReducer(state: BannerState, action: BannerAction): BannerState {
  if (action.type === 'reset') {
    return { active: null, queue: [] };
  }

  if (action.type === 'enqueue') {
    if (!state.active) {
      return { ...state, active: action.notification };
    }
    return { ...state, queue: [...state.queue, action.notification] };
  }

  const [next, ...rest] = state.queue;
  return { active: next ?? null, queue: rest };
}

function notificationCenterPath(role: string | null) {
  if (role === 'ADMIN') return '/(tabs)/users/admin/dashboard';
  if (role === 'VOLUNTEER') return '/(tabs)/users/volunteer/notifications';
  if (role === 'POLICE') return '/(tabs)/users/police/notifications';
  return '/(tabs)/users/standard-user/notifications';
}

function routeForNotification(notification: BackendNotification, role: string | null) {
  const incidentId = notification.incidentId || notification.data?.incidentId;
  const type = String(notification.type || '').toUpperCase();
  if (role === 'ADMIN') {
    const context = String(notification.data?.context || '').toLowerCase();
    if (context.includes('verification')) return '/(tabs)/users/admin/dashboard?section=verifications';
    if (context.includes('safe_place')) return '/(tabs)/users/admin/dashboard?section=safeplaces';
    if (incidentId || context.includes('law_enforcement') || context.includes('incident')) {
      return '/(tabs)/users/admin/dashboard?section=law-enforcement-requests';
    }
    return notificationCenterPath(role);
  }
  if (!incidentId) return notificationCenterPath(role);

  if (type === 'NEW_SOS_REQUEST' && role === 'VOLUNTEER') {
    return '/(tabs)/users/volunteer';
  }
  if (role === 'POLICE' && type === 'POLICE_ASSIGNMENT') {
    const requestId = notification.data?.requestId;
    return `/(tabs)/users/police/live-map?incidentId=${incidentId}${requestId ? `&requestId=${requestId}` : ''}`;
  }
  if (role === 'POLICE' && (type === 'INCIDENT_RESOLVED' || type === 'INCIDENT_CANCELLED')) {
    return '/(tabs)/users/police/dashboard';
  }
  if (
    type === 'CHAT_MESSAGE'
    || type === 'LIVE_VIDEO_REQUEST'
    || type === 'LIVE_VIDEO_APPROVED'
    || type === 'LIVE_VIDEO_DECLINED'
    || type === 'LIVE_VIDEO_COMPLETED'
    || type === 'INCIDENT_RESOLVED'
    || type === 'INCIDENT_CANCELLED'
    || type === 'VOLUNTEER_ACCEPTED'
  ) {
    if (role === 'VOLUNTEER') {
      return `/(tabs)/users/volunteer/chat_room?incidentId=${incidentId}&category=ASSISTED`;
    }
    if (role === 'POLICE') {
      return notificationCenterPath(role);
    }
    return `/(tabs)/users/standard-user/chat_room?incidentId=${incidentId}`;
  }
  return notificationCenterPath(role);
}

const IMPORTANT_WEB_TYPES = new Set([
  'NEW_SOS_REQUEST',
  'CHAT_MESSAGE',
  'LIVE_VIDEO_REQUEST',
  'LIVE_VIDEO_APPROVED',
  'LIVE_VIDEO_DECLINED',
  'LIVE_VIDEO_COMPLETED',
  'INCIDENT_RESOLVED',
  'INCIDENT_CANCELLED',
  'VOLUNTEER_ACCEPTED',
  'POLICE_ASSIGNMENT',
  'LAW_ENFORCEMENT_REQUESTED',
  'LAW_ENFORCEMENT_REQUEST_UPDATED',
  'ADMIN_VERIFICATION_REQUEST',
  'ADMIN_SAFE_PLACE_REQUEST',
  'ADMIN_CRITICAL_SOS',
]);

function shouldShowWebSystemNotification(notification: BackendNotification) {
  const type = String(notification.type || '').toUpperCase();
  if (__DEV__ && type === 'WEB_NOTIFICATION_TEST') return true;
  if (!IMPORTANT_WEB_TYPES.has(type)) return false;
  if (type === 'CHAT_MESSAGE' && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return false;
  }
  return true;
}

function fromPushContent(content: import('expo-notifications').NotificationContent): BackendNotification | null {
  const data = content.data || {};
  const notificationId = data.notificationId ? String(data.notificationId) : '';
  if (!notificationId) return null;
  return {
    id: notificationId,
    type: data.type ? String(data.type) : 'SYSTEM',
    title: content.title || 'SheSafe notification',
    body: content.body || '',
    incidentId: data.incidentId ? String(data.incidentId) : null,
    chatId: data.chatId ? String(data.chatId) : null,
    data,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

function localType(type: string): NotifType {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'NEW_SOS_REQUEST') return 'sos_triggered';
  if (normalized === 'CHAT_MESSAGE') return 'message_received';
  if (normalized === 'LIVE_VIDEO_REQUEST') return 'live_video_request' as NotifType;
  if (normalized === 'LIVE_VIDEO_DECLINED') return 'live_video_declined' as NotifType;
  if (normalized === 'LIVE_VIDEO_APPROVED' || normalized === 'LIVE_VIDEO_COMPLETED') return 'system';
  if (normalized === 'VOLUNTEER_ACCEPTED') return 'volunteer_joined';
  if (normalized === 'INCIDENT_RESOLVED') return 'incident_resolved';
  if (normalized === 'INCIDENT_CANCELLED') return 'incident_cancelled';
  return 'system';
}

function syncLocalNotification(notification: BackendNotification) {
  return notificationStore.add({
    sourceId: `backend-${notification.id}`,
    type: localType(notification.type),
    title: notification.title,
    body: notification.body,
    incidentId: notification.incidentId || undefined,
    createdAt: notification.createdAt,
  }).catch(() => undefined);
}

export function NotificationBannerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const { isLoading, isSignedIn, role } = useAuth();
  const [{ active }, dispatchBanner] = useReducer(bannerReducer, { active: null, queue: [] });
  const seenThisSession = useRef(new Set<string>());
  const pendingNavigationRef = useRef<((resolvedRole: string) => string) | null>(null);
  const missedFetchInFlight = useRef(false);
  const missedBackoffUntil = useRef(0);

  const navigateOrQueue = useCallback((target: string | ((resolvedRole: string) => string)) => {
    const resolveTarget = typeof target === 'function' ? target : () => target;
    if (isLoading || !isSignedIn || !rootNavigationState?.key || !role) {
      pendingNavigationRef.current = resolveTarget;
      return;
    }
    router.push(resolveTarget(role) as any);
  }, [isLoading, isSignedIn, role, rootNavigationState?.key, router]);

  useEffect(() => {
    if (isLoading || !isSignedIn || !rootNavigationState?.key || !role) return;
    const resolveTarget = pendingNavigationRef.current;
    if (!resolveTarget) return;
    pendingNavigationRef.current = null;
    router.push(resolveTarget(role) as any);
  }, [isLoading, isSignedIn, role, rootNavigationState?.key, router]);

  useEffect(() => {
    let isMounted = true;
    loadNotificationsModule().then((Notifications) => {
      if (!isMounted || !Notifications) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: false,
        }),
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const enqueue = useCallback((notification: BackendNotification) => {
    const id = String(notification?.id || '').trim();
    if (!id || seenThisSession.current.has(id)) return;
    const safeNotification = { ...notification, id };
    if (__DEV__) {
      console.info('[web-notification] event received:', {
        id,
        type: safeNotification.type,
      });
    }
    seenThisSession.current.add(id);
    syncLocalNotification(safeNotification);
    dispatchBanner({ type: 'enqueue', notification: safeNotification });
    if (shouldShowWebSystemNotification(safeNotification)) {
      const target = routeForNotification(safeNotification, role);
      showWebSystemNotification({
        title: safeNotification.title,
        body: safeNotification.body,
        tag: id,
        data: safeNotification.data,
        url: target,
      });
    } else if (__DEV__) {
      console.info(`[web-notification] skipped reason: event type ${safeNotification.type} is not eligible`);
    }
  }, [role]);

  const fetchMissed = useCallback(async () => {
    if (isLoading || !isSignedIn || missedFetchInFlight.current) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
    if (Date.now() < missedBackoffUntil.current) return;
    missedFetchInFlight.current = true;
    try {
      const result = await notificationService.missed(10);
      const notifications = Array.isArray(result.notifications) ? result.notifications : [];
      if (notifications.length) {
        notifications.forEach(enqueue);
        await notificationService.markShown(notifications.map(item => String(item.id)));
      }
    } catch (error: any) {
      if (Number(error?.status || error?.response?.status) === 429) {
        const retryAfter = Number(error?.retryAfterSeconds || error?.response?.headers?.['retry-after'] || 60);
        missedBackoffUntil.current = Date.now() + Math.max(retryAfter, 60) * 1000;
        if (__DEV__) console.info('[notifications] missed polling paused after 429');
      }
      // Best effort; notification center remains available.
    } finally {
      missedFetchInFlight.current = false;
    }
  }, [enqueue, isLoading, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      missedFetchInFlight.current = false;
      pendingNavigationRef.current = null;
      dispatchBanner({ type: 'reset' });
      seenThisSession.current.clear();
      return;
    }
    if (isLoading) return;
    registerForPushNotifications().catch(() => undefined);
    fetchMissed();
    const interval = setInterval(fetchMissed, 60000);
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') fetchMissed();
    });
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) fetchMissed();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      clearInterval(interval);
      appStateSub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [fetchMissed, isLoading, isSignedIn]);

  useEffect(() => {
    let isMounted = true;
    let removeListeners = () => undefined;
    loadNotificationsModule().then((Notifications) => {
      if (!isMounted || !Notifications) return;
      const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
        const item = fromPushContent(notification.request.content);
        if (item) {
          enqueue(item);
          notificationService.markShown([item.id]).catch(() => undefined);
        }
      });
      const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
        const item = fromPushContent(response.notification.request.content);
        if (item) {
          if (String(item.type || '').toUpperCase().startsWith('LIVE_VIDEO_')) {
            liveVideoNavigation.emit(item.incidentId || item.data?.incidentId);
          }
          notificationService.markRead(item.id).catch(() => undefined);
          navigateOrQueue(resolvedRole => routeForNotification(item, resolvedRole));
        } else {
          navigateOrQueue(notificationCenterPath);
        }
      });
      removeListeners = () => {
        foregroundSub.remove();
        responseSub.remove();
      };
    });
    return () => {
      isMounted = false;
      removeListeners();
    };
  }, [enqueue, navigateOrQueue, role]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => dispatchBanner({ type: 'advance' }), 4200);
    return () => clearTimeout(timer);
  }, [active]);

  const value = useMemo(() => ({ enqueue }), [enqueue]);
  const activeIsCritical = String(active?.type || '').toUpperCase().includes('SOS');

  const handlePress = useCallback(() => {
    if (!active) return;
    if (String(active.type || '').toUpperCase().startsWith('LIVE_VIDEO_')) {
      liveVideoNavigation.emit(active.incidentId || active.data?.incidentId);
    }
    notificationService.markRead(active.id).catch(() => undefined);
    dispatchBanner({ type: 'advance' });
    navigateOrQueue(resolvedRole => routeForNotification(active, resolvedRole));
  }, [active, navigateOrQueue]);

  return (
    <BannerContext.Provider value={value}>
      {children}
      {active && (
        <Pressable
          style={[st.wrap, { top: Math.max(insets.top, 8) + 64 }]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={active.title}
        >
          <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[st.tint, activeIsCritical && st.criticalTint]} pointerEvents="none" />
          <View style={[st.icon, activeIsCritical && st.criticalIcon]}>
            <Feather name={activeIsCritical ? 'alert-triangle' : 'bell'} size={18} color={activeIsCritical ? T.dangerText : T.violetLight} />
          </View>
          <View style={st.copy}>
            <Text style={st.title} numberOfLines={1}>{active.title}</Text>
            <Text style={st.body} numberOfLines={2}>{active.body}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={T.ink4} />
        </Pressable>
      )}
    </BannerContext.Provider>
  );
}

export function useNotificationBanner() {
  const ctx = useContext(BannerContext);
  if (!ctx) throw new Error('useNotificationBanner must be used inside NotificationBannerProvider');
  return ctx;
}

const st = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: S.s3,
    right: S.s3,
    zIndex: 9999,
    minHeight: 74,
    borderRadius: R.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(18,12,33,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s3,
    paddingHorizontal: S.s3,
    paddingVertical: S.s3,
  },
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(138,56,246,0.12)' },
  criticalTint: { backgroundColor: 'rgba(244,63,94,0.12)' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.violetDim,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.22)',
  },
  criticalIcon: { backgroundColor: T.dangerLight, borderColor: 'rgba(251,113,133,0.28)' },
  copy: { flex: 1 },
  title: { color: T.ink, fontSize: 14, fontWeight: '900' },
  body: { color: T.ink3, fontSize: 12, lineHeight: 16, marginTop: 2 },
});

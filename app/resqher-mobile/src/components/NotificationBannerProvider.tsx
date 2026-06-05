import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  if (role === 'VOLUNTEER') return '/(tabs)/users/volunteer/notifications';
  if (role === 'POLICE') return '/(tabs)/users/police/notifications';
  return '/(tabs)/users/standard-user/notifications';
}

function routeForNotification(notification: BackendNotification, role: string | null) {
  const incidentId = notification.incidentId || notification.data?.incidentId;
  const type = String(notification.type || '').toUpperCase();
  if (!incidentId) return notificationCenterPath(role);

  if (type === 'NEW_SOS_REQUEST' && role === 'VOLUNTEER') {
    return '/(tabs)/users/volunteer';
  }
  if (type === 'CHAT_MESSAGE' || type === 'INCIDENT_RESOLVED' || type === 'INCIDENT_CANCELLED' || type === 'VOLUNTEER_ACCEPTED') {
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
  const insets = useSafeAreaInsets();
  const { isSignedIn, role } = useAuth();
  const [{ active }, dispatchBanner] = useReducer(bannerReducer, { active: null, queue: [] });
  const seenThisSession = useRef(new Set<string>());

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
    if (!notification?.id || seenThisSession.current.has(notification.id)) return;
    seenThisSession.current.add(notification.id);
    syncLocalNotification(notification);
    dispatchBanner({ type: 'enqueue', notification });
  }, []);

  const fetchMissed = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const result = await notificationService.missed(10);
      if (result.notifications.length) {
        result.notifications.forEach(enqueue);
        await notificationService.markShown(result.notifications.map(item => item.id));
      }
    } catch {
      // Best effort; notification center remains available.
    }
  }, [enqueue, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      dispatchBanner({ type: 'reset' });
      seenThisSession.current.clear();
      return;
    }
    registerForPushNotifications().catch(() => undefined);
    fetchMissed();
    const interval = setInterval(fetchMissed, 15000);
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') fetchMissed();
    });
    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [fetchMissed, isSignedIn]);

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
          notificationService.markRead(item.id).catch(() => undefined);
          router.push(routeForNotification(item, role) as any);
        } else {
          router.push(notificationCenterPath(role) as any);
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
  }, [enqueue, role, router]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => dispatchBanner({ type: 'advance' }), 4200);
    return () => clearTimeout(timer);
  }, [active]);

  const value = useMemo(() => ({ enqueue }), [enqueue]);

  const handlePress = useCallback(() => {
    if (!active) return;
    const target = routeForNotification(active, role);
    notificationService.markRead(active.id).catch(() => undefined);
    dispatchBanner({ type: 'advance' });
    router.push(target as any);
  }, [active, role, router]);

  return (
    <BannerContext.Provider value={value}>
      {children}
      {active && (
        <Pressable
          style={[st.wrap, { top: Math.max(insets.top, 8) + 8 }]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={active.title}
        >
          <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={st.tint} pointerEvents="none" />
          <View style={st.icon}>
            <Feather name="bell" size={18} color={T.violetLight} />
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
  copy: { flex: 1 },
  title: { color: T.ink, fontSize: 14, fontWeight: '900' },
  body: { color: T.ink3, fontSize: 12, lineHeight: 16, marginTop: 2 },
});

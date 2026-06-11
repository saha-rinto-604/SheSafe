import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, ScrollView, Platform, Pressable, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../../constants/theme';
import adminService, { type AdminNotification } from '../../../services/adminService';
import type { BackendNotification } from '../../../services/notificationService';
import { useToast } from '../../../components/Toast';
import {
  getWebNotificationPermission,
  isWebNotificationSupported,
  requestWebNotificationPermission,
  showWebSystemNotification,
  type WebNotificationPermission,
} from '../../../services/webNotificationService';

const DRAWER_WIDTH = 340;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const DRAWER_RATE_LIMIT_BACKOFF_MS = 90_000;

type Notification = {
  id: string;
  type: 'alert' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  liveNotification?: BackendNotification | null;
};

function toTimeLabel(value?: string) {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mapNotification(item: AdminNotification): Notification {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    time: toTimeLabel(item.createdAt),
    read: item.read,
  };
}

export function AdminNotificationsDrawer({ isOpen, onClose, liveNotification }: Props) {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const [slideAnim] = useState(() => new Animated.Value(screenWidth));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [webPermission, setWebPermission] = React.useState<WebNotificationPermission>(() => getWebNotificationPermission());
  const fetchInFlightRef = useRef(false);
  const loadedForCurrentOpenRef = useRef(false);
  const backoffUntilRef = useRef(0);
  const rateLimitToastAtRef = useRef(0);

  const loadNotifications = React.useCallback(async (manual = false) => {
    const now = Date.now();
    if (fetchInFlightRef.current) return;
    if (now < backoffUntilRef.current) {
      if (manual && now - rateLimitToastAtRef.current > 10_000) {
        rateLimitToastAtRef.current = now;
        showToast({
          type: 'warning',
          title: 'Notifications refresh paused',
          message: 'Please wait a moment before refreshing notifications again.',
        });
      }
      return;
    }
    fetchInFlightRef.current = true;
    setLoading(true);
    try {
      if (__DEV__) console.info('[admin-notifications] fetching notifications once');
      const items = await adminService.getNotifications();
      setNotifications(items.map(mapNotification));
    } catch (err: any) {
      const isRateLimited = Number(err?.status) === 429;
      if (isRateLimited) {
        const retryAfterMs = Math.max(Number(err?.retryAfterSeconds || 0) * 1000, DRAWER_RATE_LIMIT_BACKOFF_MS);
        backoffUntilRef.current = Date.now() + retryAfterMs;
      }
      if (!isRateLimited || Date.now() - rateLimitToastAtRef.current > 10_000) {
        rateLimitToastAtRef.current = Date.now();
        showToast(isRateLimited
          ? {
              type: 'warning',
              title: 'Notifications refresh paused',
              message: 'Admin notifications are refreshing too often. Please wait a moment.',
            }
          : {
              type: 'error',
              title: 'Notifications unavailable',
              message: 'We could not refresh admin notifications right now.',
            });
      }
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [showToast]);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleEnableBrowserNotifications = async () => {
    const permission = await requestWebNotificationPermission();
    setWebPermission(permission);
    if (permission === 'granted') {
      showWebSystemNotification({
        title: 'SheSafe notifications enabled.',
        body: 'You will receive important admin alerts here.',
        tag: `web-notifications-enabled:${Date.now()}`,
      });
    }
    showToast(permission === 'granted'
      ? { type: 'success', title: 'Browser notifications enabled', message: 'Important SheSafe alerts can now reach your system.' }
      : { type: 'info', title: 'Browser notifications unavailable', message: 'Important alerts will continue to appear inside SheSafe.' });
  };

  const handleTestBrowserNotification = () => {
    if (__DEV__) console.info('[web-notification] test clicked');
    showToast({
      type: 'info',
      title: 'SheSafe test notification',
      message: 'Browser notifications are working.',
    });
    showWebSystemNotification({
      title: 'SheSafe test notification',
      body: 'Browser notifications are working.',
      tag: `web-notification-test:${Date.now()}`,
    });
  };

  useEffect(() => {
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    if (isOpen) {
      loadTimer = setTimeout(() => {
        setWebPermission(getWebNotificationPermission());
        if (!loadedForCurrentOpenRef.current) {
          loadedForCurrentOpenRef.current = true;
          loadNotifications();
        }
      }, 0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      loadedForCurrentOpenRef.current = false;
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
    return () => {
      if (loadTimer) clearTimeout(loadTimer);
    };
  }, [fadeAnim, isOpen, loadNotifications, slideAnim]);

  useEffect(() => {
    if (!liveNotification) return;
    const timer = setTimeout(() => {
      setNotifications(prev => {
        const id = String(liveNotification.id);
        if (prev.some(item => item.id === id)) return prev;
        return [{
          id,
          type: String(liveNotification.type || '').toUpperCase().includes('SOS') ? 'alert' : 'info',
          title: liveNotification.title,
          message: liveNotification.body,
          time: toTimeLabel(liveNotification.createdAt),
          read: false,
        }, ...prev];
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [liveNotification]);

  if (!isOpen && (slideAnim as any)._value === DRAWER_WIDTH) return null;

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
        <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View 
          style={[
            st.drawer, 
            { 
              paddingTop: Platform.OS === 'ios' ? insets.top : 20,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateX: slideAnim }] 
            }
          ]}
        >
        <View style={st.header}>
          <View>
            <Text style={st.title}>Notifications</Text>
            <Text style={st.subtitle}>System alerts and updates</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={st.closeBtn}>
            <Feather name="x" size={20} color={T.ink3} />
          </TouchableOpacity>
        </View>

        <View style={st.divider} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.list}>
          {Platform.OS === 'web' && isWebNotificationSupported() && webPermission !== 'granted' && (
            <TouchableOpacity style={st.permissionCard} onPress={handleEnableBrowserNotifications} activeOpacity={0.82}>
              <View style={st.permissionIcon}>
                <Feather name="bell" size={18} color={T.violet} />
              </View>
              <View style={st.permissionCopy}>
                <Text style={st.permissionTitle}>Enable browser notifications</Text>
                <Text style={st.permissionBody}>Receive important SheSafe alerts while this browser is open.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={T.ink4} />
            </TouchableOpacity>
          )}
          {__DEV__ && Platform.OS === 'web' && isWebNotificationSupported() && (
            <TouchableOpacity style={st.testCard} onPress={handleTestBrowserNotification} activeOpacity={0.82}>
              <Feather name="send" size={17} color={T.violet} />
              <View style={st.permissionCopy}>
                <Text style={st.permissionTitle}>Test browser notification</Text>
                <Text style={st.permissionBody}>Triggers an in-app banner and a system notification when permitted.</Text>
              </View>
            </TouchableOpacity>
          )}
          {loading && <Text style={st.stateText}>Loading notifications...</Text>}
          {!loading && notifications.map((notif) => (
            <View key={notif.id} style={[st.card, !notif.read && st.cardUnread]}>
              <View style={[st.iconBox, 
                notif.type === 'alert' ? st.iconAlert : 
                notif.type === 'success' ? st.iconSuccess : st.iconInfo
              ]}>
                <Feather 
                  name={notif.type === 'alert' ? 'alert-triangle' : notif.type === 'success' ? 'check-circle' : 'info'} 
                  size={18} 
                  color={notif.type === 'alert' ? T.danger : notif.type === 'success' ? T.success : T.violet} 
                />
              </View>
              <View style={st.cardContent}>
                <View style={st.cardTitleRow}>
                  <Text style={st.cardTitle} numberOfLines={1}>{notif.title}</Text>
                  {!notif.read && <View style={st.unreadDot} />}
                </View>
                <Text style={st.cardMsg} numberOfLines={2}>{notif.message}</Text>
                <Text style={st.cardTime}>{notif.time}</Text>
              </View>
            </View>
          ))}
          {!loading && notifications.length === 0 && (
            <Text style={st.stateText}>No notifications right now.</Text>
          )}
        </ScrollView>
        
        <View style={st.footer}>
          <TouchableOpacity style={st.markAllBtn} onPress={() => loadNotifications(true)} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={16} color={T.violet} />
            <Text style={st.markAllTxt}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.markAllBtn} onPress={handleMarkAllAsRead} activeOpacity={0.7}>
            <Feather name="check-square" size={16} color={T.violet} />
            <Text style={st.markAllTxt}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0F1020',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(138,56,246,0.15)',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: -5, height: 0 } },
      android: { elevation: 20 },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: T.ink4, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  list: { padding: 16, gap: 12 },
  permissionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 14, backgroundColor: 'rgba(138,56,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(138,56,246,0.28)',
  },
  testCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 14, backgroundColor: T.surfaceCard,
    borderWidth: 1, borderColor: T.lineMid,
  },
  permissionIcon: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.violetDim,
  },
  permissionCopy: { flex: 1 },
  permissionTitle: { color: T.ink, fontSize: 13, fontWeight: '800' },
  permissionBody: { color: T.ink4, fontSize: 11, lineHeight: 16, marginTop: 2 },
  stateText: { color: T.ink4, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  
  card: {
    flexDirection: 'row',
    backgroundColor: T.surfaceCard,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.lineMid,
  },
  cardUnread: {
    backgroundColor: 'rgba(138,56,246,0.04)',
    borderColor: 'rgba(138,56,246,0.2)',
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  iconAlert: { backgroundColor: 'rgba(244,63,94,0.12)' },
  iconSuccess: { backgroundColor: 'rgba(16,185,129,0.12)' },
  iconInfo: { backgroundColor: 'rgba(138,56,246,0.12)' },
  
  cardContent: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: T.ink, flex: 1, paddingRight: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.violet },
  cardMsg: { fontSize: 13, color: T.ink3, lineHeight: 18, marginBottom: 8 },
  cardTime: { fontSize: 11, color: T.ink4, fontWeight: '500' },
  
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: 'rgba(138,56,246,0.1)',
    borderRadius: 8,
  },
  markAllTxt: { fontSize: 13, fontWeight: '700', color: T.violet },
});

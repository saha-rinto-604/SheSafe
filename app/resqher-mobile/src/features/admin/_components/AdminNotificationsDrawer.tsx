import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, ScrollView, Platform, Pressable, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R, Ty } from '../../../constants/theme';
import adminService, { type AdminNotification } from '../../../services/adminService';

const DRAWER_WIDTH = 340;

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

export function AdminNotificationsDrawer({ isOpen, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadNotifications = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await adminService.getNotifications();
      setNotifications(items.map(mapNotification));
    } catch (err: any) {
      setError(err?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen, loadNotifications]);

  if (!isOpen && (slideAnim as any)._value === DRAWER_WIDTH) return null;

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={[StyleSheet.absoluteFill, { zIndex: 999, pointerEvents: 'box-none' }]}>
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
          {loading && <Text style={st.stateText}>Loading notifications...</Text>}
          {!!error && !loading && <Text style={st.errorText}>{error}</Text>}
          {!loading && !error && notifications.map((notif) => (
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
          {!loading && !error && notifications.length === 0 && (
            <Text style={st.stateText}>No notifications right now.</Text>
          )}
        </ScrollView>
        
        <View style={st.footer}>
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
    ...StyleSheet.absoluteFillObject,
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
  stateText: { color: T.ink4, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  errorText: { color: T.danger, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  
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
  },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: 'rgba(138,56,246,0.1)',
    borderRadius: 8,
  },
  markAllTxt: { fontSize: 13, fontWeight: '700', color: T.violet },
});

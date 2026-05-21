import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { incidentService, type VolunteerNotification, type VolunteerNotificationType } from '../../../../src/services/incidentService';
import { notificationStore, type AppNotification } from '../../../../src/services/notificationStore';

type DisplayNotification = VolunteerNotification & { localN?: number };
type Group = { label: string; items: DisplayNotification[] };

const ICON_MAP: Record<VolunteerNotificationType, { name: React.ComponentProps<typeof Feather>['name']; color: string }> = {
  SOS_ALERT: { name: 'alert-circle', color: T.danger },
  VOLUNTEER_SOS_ALERT: { name: 'shield', color: T.danger },
  MESSAGE: { name: 'message-circle', color: T.violet },
  INCIDENT_CANCELLED: { name: 'x-circle', color: T.ink4 },
  INCIDENT_RESOLVED: { name: 'check-circle', color: T.success },
  RESPONDER_UPDATE: { name: 'user-plus', color: T.success },
  GENERAL: { name: 'bell', color: T.ink3 },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const date = new Date(iso);
  return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
}

function groupByDate(notifications: DisplayNotification[]): Group[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Group[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ];

  notifications.forEach(notification => {
    const date = new Date(notification.createdAt);
    date.setHours(0, 0, 0, 0);
    if (date.getTime() === today.getTime()) groups[0].items.push(notification);
    else if (date.getTime() === yesterday.getTime()) groups[1].items.push(notification);
    else groups[2].items.push(notification);
  });

  return groups.filter(group => group.items.length > 0);
}

function localToVolunteerNotification(notification: AppNotification): DisplayNotification {
  const typeMap: Record<AppNotification['type'], VolunteerNotificationType> = {
    sos_triggered: 'VOLUNTEER_SOS_ALERT',
    message_received: 'MESSAGE',
    volunteer_joined: 'RESPONDER_UPDATE',
    incident_resolved: 'INCIDENT_RESOLVED',
    incident_cancelled: 'INCIDENT_CANCELLED',
    system: 'GENERAL',
  };

  return {
    id: `local-${notification.id}`,
    localN: notification.n,
    type: typeMap[notification.type] ?? 'GENERAL',
    title: notification.title,
    body: notification.body,
    relatedIncidentId: notification.incidentId ?? null,
    relatedChatId: notification.incidentId ?? null,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

function NotificationCard({
  notification,
  onDelete,
  onRead,
}: {
  notification: DisplayNotification;
  onDelete: (notification: DisplayNotification) => void;
  onRead: (notification: DisplayNotification) => void;
}) {
  const icon = ICON_MAP[notification.type] ?? ICON_MAP.GENERAL;

  return (
    <TouchableOpacity
      style={[s.card, !notification.read && s.cardUnread]}
      activeOpacity={0.8}
      onPress={() => { if (!notification.read) onRead(notification); }}
    >
      {!notification.read && <View style={s.unreadBar} />}
      <View style={[s.iconBox, { backgroundColor: `${icon.color}18` }]}>
        <Feather name={icon.name} size={17} color={icon.color} />
      </View>
      <View style={s.cardContent}>
        <Text style={s.cardTitle}>{notification.title}</Text>
        <Text style={s.cardBody} numberOfLines={2}>{notification.body}</Text>
        <Text style={s.cardTime}>{relativeTime(notification.createdAt)}</Text>
      </View>
      {!!notification.localN && (
        <TouchableOpacity
          style={s.deleteBtn}
          onPress={() => onDelete(notification)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={14} color={T.ink4} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyRing}>
        <Feather name="bell-off" size={30} color={T.ink4} />
      </View>
      <Text style={s.emptyTitle}>No notifications yet</Text>
      <Text style={s.emptySubtitle}>SOS alerts, messages, and responder updates will appear here.</Text>
    </View>
  );
}

export default function VolunteerNotifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      let location: { latitude: number; longitude: number } | undefined;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        location = {
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        };
      }

      const [remote, local, assisted] = await Promise.all([
        incidentService.getVolunteerNotifications(location).catch(() => []),
        notificationStore.getAll().catch(() => []),
        incidentService.getVolunteerAssistedIncidents().catch(() => []),
      ]);
      const assistedIds = new Set(assisted.map((incident: any) => String(incident.id)));

      const localRelevant = local
        .filter(notification => {
          const incidentId = notification.incidentId ? String(notification.incidentId) : null;
          if (notification.type === 'incident_cancelled' || notification.type === 'incident_resolved') {
            return !!incidentId && assistedIds.has(incidentId);
          }
          if (notification.type === 'message_received' || notification.type === 'volunteer_joined') {
            return !incidentId || assistedIds.has(incidentId);
          }
          return notification.type === 'sos_triggered' || notification.type === 'system';
        })
        .map(localToVolunteerNotification);

      const merged = [...remote, ...localRelevant]
        .filter((notification, index, all) => (
          all.findIndex(item => item.id === notification.id) === index
        ))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setNotifications(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRead = useCallback(async (notification: DisplayNotification) => {
    if (notification.localN) await notificationStore.markRead(notification.localN);
    setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));
  }, []);

  const handleDelete = useCallback((notification: DisplayNotification) => {
    if (!notification.localN) return;
    Alert.alert('Delete Notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await notificationStore.remove(notification.localN!);
          setNotifications(prev => prev.filter(item => item.id !== notification.id));
        },
      },
    ]);
  }, []);

  const handleMarkAll = useCallback(async () => {
    await notificationStore.markAllRead();
    setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
  }, []);

  const groups = useMemo(() => groupByDate(notifications), [notifications]);
  const hasUnread = notifications.some(notification => !notification.read);

  return (
    <AtmosphericShell>
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-left" size={22} color={T.ink} />
          </TouchableOpacity>
          <View style={s.headerText}>
            <Text style={s.headerTitle}>Notifications</Text>
            <Text style={s.headerSubtitle}>SOS alerts, messages, and incident updates</Text>
          </View>
          {hasUnread ? (
            <TouchableOpacity onPress={handleMarkAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.headerSpacer} />
          )}
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={T.violet} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.violet} />}
          >
            {notifications.length === 0 ? (
              <EmptyState />
            ) : (
              groups.map(group => (
                <View key={group.label} style={s.group}>
                  <Text style={s.groupLabel}>{group.label}</Text>
                  {group.items.map(notification => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onDelete={handleDelete}
                      onRead={handleRead}
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </AtmosphericShell>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.lineMid,
    backgroundColor: T.surfaceGlass,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: R.hBtn,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: T.surfaceBulky,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerText: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: T.ink },
  headerSubtitle: { fontSize: 11, color: T.ink4, marginTop: 2 },
  markAllText: { fontSize: 13, fontWeight: '600', color: T.violet },
  headerSpacer: { width: 70 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 14, paddingTop: 20 },
  group: { marginBottom: 24 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.ink3,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: T.surfaceBulky,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    padding: S.s4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: 'rgba(108,92,231,0.07)',
    borderColor: 'rgba(108,92,231,0.25)',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: T.violet,
    borderTopLeftRadius: R.lg,
    borderBottomLeftRadius: R.lg,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: T.ink, marginBottom: 3 },
  cardBody: { fontSize: 13, color: T.ink3, lineHeight: 18 },
  cardTime: { fontSize: 11, color: T.ink4, marginTop: 6 },
  deleteBtn: { marginLeft: 8, padding: 4, alignSelf: 'flex-start' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.surfaceBulky,
    borderWidth: 1,
    borderColor: T.lineMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: T.ink2, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: T.ink4, textAlign: 'center', lineHeight: 20 },
});

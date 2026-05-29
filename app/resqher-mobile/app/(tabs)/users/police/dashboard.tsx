import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import SheSafeMark from '../../../../src/components/SheSafeMark';
import { T, R, S } from '../../../../src/constants/theme';
import { incidentService, type PoliceTask } from '../../../../src/services/incidentService';
import { useDispatchSocket } from '../../../../src/hooks/useDispatchSocket';
import IncidentStatusAlert from '../../../../src/components/IncidentStatusAlert';
import api from '../../../../src/services/api';
import { POLICE, routeForPoliceStatus } from '../../../../src/constants/routes';
import {
  addPoliceNotification,
  policeNotificationStore,
  type PoliceNotificationPayload,
} from '../../../../src/services/policeNotificationService';

const ACTIVE_INCIDENT_STATUSES = new Set(['ACTIVE', 'IN_PROGRESS', 'LIVE']);
const INACTIVE_INCIDENT_STATUSES = new Set(['RESOLVED', 'CANCELLED']);

const GLASS = 'rgba(30,21,58,0.56)';
const GLASS_SOFT = 'rgba(30,21,58,0.38)';
const GLASS_ACTIVE = 'rgba(49,31,92,0.62)';
const BORDER = 'rgba(255,255,255,0.10)';
const BORDER_VIOLET = 'rgba(138,56,246,0.30)';
const VIOLET_SOFT = 'rgba(138,56,246,0.13)';
const SUCCESS_SOFT = 'rgba(16,185,129,0.12)';
const DANGER_SOFT = 'rgba(226,54,54,0.12)';

function activePoliceTasks(tasks: PoliceTask[]) {
  return tasks.filter((task) => (
    ACTIVE_INCIDENT_STATUSES.has(String(task.incidentStatus || '').toUpperCase())
    && ['ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE'].includes(String(task.status || '').toUpperCase())
  ));
}

function statusLabel(task: PoliceTask) {
  const status = String(task.status || '').toUpperCase();

  if (status === 'ACCEPTED_BY_POLICE') return 'In progress';
  if (status === 'ASSIGNED_TO_POLICE') return 'Assigned';

  return status.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

export default function PoliceTodo() {
  const router = useRouter();
  const [tasks, setTasks] = useState<PoliceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusAlert, setStatusAlert] = useState<{ status: 'RESOLVED' | 'CANCELLED'; message?: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenStatusEventsRef = useRef<Set<string>>(new Set());
  const seenNotificationsRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<PoliceTask[]>([]);

  const liveCount = tasks.length;
  const subtitle = useMemo(() => {
    if (loading) return 'Syncing assignments';
    if (liveCount === 1) return '1 active assignment';
    return `${liveCount} active assignments`;
  }, [liveCount, loading]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const unsubscribe = policeNotificationStore.subscribeUnread(setUnreadCount);
    policeNotificationStore.getUnreadCount().catch(() => undefined);
    return unsubscribe;
  }, []);

  const addNotification = useCallback((next: PoliceNotificationPayload) => {
    const id = String(
      next.notificationId
      || `${next.type}:${next.incidentId || 'incident'}:${next.requestId || 'request'}:${next.status || ''}:${next.title}`
    );

    if (seenNotificationsRef.current.has(id)) return;

    seenNotificationsRef.current.add(id);
    addPoliceNotification({ ...next, notificationId: id }).catch(() => undefined);
  }, []);

  const openNotifications = useCallback(() => {
    router.push(POLICE.NOTIFICATIONS as any);
  }, [router]);

  const ensureVerifiedAccess = useCallback(async () => {
    const { data } = await api.get('/api/police-verification');
    const verification = data?.verification;
    const targetRoute = routeForPoliceStatus(
      verification?.status,
      verification?.documents
        ? {
          nidCardUrl: verification.documents.nidCardUrl,
          selfieUrl: verification.documents.selfieUrl,
          jobIdCardUrl: verification.documents.jobIdCardUrl,
        }
        : null
    );

    if (targetRoute !== POLICE.DASHBOARD) {
      router.replace(targetRoute as any);
      return false;
    }

    return true;
  }, [router]);

  const load = useCallback(async () => {
    try {
      setError(null);

      if (!(await ensureVerifiedAccess())) return;

      const next = await incidentService.getPoliceTasks();
      setTasks(activePoliceTasks(next));
    } catch (err: any) {
      setTasks([]);
      setError(err?.message || 'Could not load assigned police requests.');
    }
  }, [ensureVerifiedAccess]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load().finally(() => setLoading(false));
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const navigateLiveLocation = useCallback(async (task: PoliceTask) => {
    setBusyId(task.id);

    try {
      if (task.status === 'ASSIGNED_TO_POLICE') {
        await incidentService.acceptPoliceTask(task.id);
      }

      setTasks(prev => prev.map(item => (
        item.id === task.id ? { ...item, status: 'ACCEPTED_BY_POLICE' } : item
      )));
      router.replace(`/(tabs)/users/police/live-map?requestId=${task.id}&incidentId=${task.incidentId}` as any);
    } catch (err: any) {
      setError(err?.message || 'Could not open live navigation for this request.');
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load, router]);

  const reject = useCallback(async (task: PoliceTask) => {
    setBusyId(task.id);

    try {
      await incidentService.rejectPoliceTask(task.id);
      setTasks(prev => prev.filter(item => item.id !== task.id));
    } catch (err: any) {
      setError(err?.message || 'Could not reject this request.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleStatusEvent = useCallback((payload: {
    notificationId?: string | null;
    type?: string | null;
    incidentId: string;
    requestId?: string | null;
    status?: string | null;
    title?: string | null;
    message?: string | null;
    createdAt?: string | null;
  }) => {
    const status = String(payload.status || '').toUpperCase();
    if (!INACTIVE_INCIDENT_STATUSES.has(status)) return;

    const eventKey = `${payload.requestId || payload.incidentId}:${status}`;
    if (seenStatusEventsRef.current.has(eventKey)) return;
    seenStatusEventsRef.current.add(eventKey);

    const affected = tasksRef.current.some((task) => (
      String(task.incidentId) === String(payload.incidentId)
      || (!!payload.requestId && String(task.id) === String(payload.requestId))
    ));

    setTasks(prev => prev.filter((task) => (
      String(task.incidentId) !== String(payload.incidentId)
      && (!payload.requestId || String(task.id) !== String(payload.requestId))
    )));

    if (affected) {
      addNotification({
        notificationId: payload.notificationId,
        type: payload.type || (status === 'RESOLVED' ? 'INCIDENT_RESOLVED' : 'INCIDENT_CANCELLED'),
        title: payload.title || (status === 'RESOLVED' ? 'Incident Resolved' : 'Incident Cancelled'),
        message: payload.message || 'This incident is no longer active. It was removed from your dashboard.',
        incidentId: payload.incidentId,
        requestId: payload.requestId,
        status,
        createdAt: payload.createdAt,
      });
      setStatusAlert({
        status: status as 'RESOLVED' | 'CANCELLED',
        message: payload.message || 'This incident is no longer active. It was removed from your dashboard.',
      });
    }
  }, [addNotification]);

  const handlePoliceAssignment = useCallback((payload: {
    notificationId?: string | null;
    type?: string | null;
    incidentId: string;
    requestId?: string | null;
    title?: string | null;
    message?: string | null;
    createdAt?: string | null;
  }) => {
    addNotification({
      notificationId: payload.notificationId,
      type: payload.type || 'POLICE_ASSIGNMENT',
      title: payload.title || 'New Police Assignment',
      message: payload.message || 'A law enforcement request has been assigned to you.',
      incidentId: payload.incidentId,
      requestId: payload.requestId,
      createdAt: payload.createdAt,
    });
    load();
  }, [addNotification, load]);

  useDispatchSocket({
    onIncidentStatusUpdated: handleStatusEvent,
    onPoliceAssignment: handlePoliceAssignment,
  });

  return (
    <AtmosphericShell>
      <SafeAreaView style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <ScrollView
          contentContainerStyle={st.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={T.violet}
              colors={[T.violet]}
              progressBackgroundColor={T.surfaceBulky}
            />
          )}
        >
          <View style={st.headerCard}>
            <View style={st.headerGlow} pointerEvents="none" />
            <View style={st.headerContent}>
              <View style={st.brandHeader}>
                <View style={st.logoWrap}>
                  <SheSafeMark size={34} />
                </View>

                <View style={st.headerCopy}>
                  <View style={st.eyebrowRow}>
                    <View style={st.liveDot} />
                    <Text style={st.eyebrow} numberOfLines={1}>Law Enforcement</Text>
                  </View>
                  <Text style={st.title} numberOfLines={1}>Dashboard</Text>
                  <Text style={st.headerMeta} numberOfLines={1}>{subtitle}</Text>
                </View>
              </View>

              <View style={st.headerActions}>
                <TouchableOpacity style={st.headerBtn} onPress={openNotifications} activeOpacity={0.82}>
                  <Feather name="bell" size={19} color={T.ink} />
                  {unreadCount > 0 && (
                    <View style={st.unreadBadge}>
                      <Text style={st.unreadText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={st.headerBtn} onPress={refresh} activeOpacity={0.82}>
                  <Feather name="refresh-cw" size={19} color={T.ink} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>Active Requests</Text>
            <Text style={st.sectionMeta}>{liveCount ? `${liveCount} live` : 'Clear'}</Text>
          </View>

          {loading ? (
            <View style={st.stateCard}>
              <ActivityIndicator color={T.violet} />
              <Text style={st.stateTitle}>Syncing dashboard</Text>
              <Text style={st.stateText}>Checking active police assignments.</Text>
            </View>
          ) : error ? (
            <View style={st.stateCard}>
              <View style={st.stateIconDanger}>
                <Feather name="alert-triangle" size={22} color={T.dangerText} />
              </View>
              <Text style={st.stateTitle}>Could not load requests</Text>
              <Text style={st.stateText}>{error}</Text>
              <TouchableOpacity style={st.retryBtn} onPress={refresh} activeOpacity={0.82}>
                <Text style={st.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : tasks.length === 0 ? (
            <View style={st.stateCard}>
              <View style={st.stateIcon}>
                <Feather name="shield" size={22} color={T.violet} />
              </View>
              <Text style={st.stateTitle}>No active assignments</Text>
              <Text style={st.stateText}>Admin-assigned law enforcement requests will appear here instantly.</Text>
            </View>
          ) : tasks.map(task => {
            const accepted = task.status === 'ACCEPTED_BY_POLICE';
            const disabled = busyId === task.id;

            return (
              <View key={task.id} style={[st.card, accepted && st.cardAccepted]}>
                <View style={st.cardTop}>
                  <View style={st.casePill}>
                    <Feather name={accepted ? 'radio' : 'zap'} size={12} color={T.violet} />
                    <Text style={st.caseCode} numberOfLines={1}>{task.incidentDisplayCode || `#${task.incidentId || task.id}`}</Text>
                  </View>

                  <View style={[st.statusPill, accepted ? st.statusPillAccepted : st.statusPillAssigned]}>
                    <Text style={[st.statusText, accepted ? st.statusTextAccepted : st.statusTextAssigned]}>
                      {statusLabel(task)}
                    </Text>
                  </View>
                </View>

                <View style={st.cardMain}>
                  <View style={st.avatarCircle}>
                    <Feather name="user" size={18} color={T.violet} />
                  </View>

                  <View style={st.cardCopy}>
                    <Text style={st.victim} numberOfLines={1}>{task.victimName || 'SOS requester'}</Text>
                    <View style={st.locationRow}>
                      <Feather name="map-pin" size={12} color={T.ink4} />
                      <Text style={st.location} numberOfLines={1}>{task.address || 'Location pending'}</Text>
                    </View>
                  </View>
                </View>

                <View style={st.actions}>
                  <TouchableOpacity
                    style={[st.rejectBtn, disabled && st.disabledBtn]}
                    disabled={disabled}
                    onPress={() => reject(task)}
                    activeOpacity={0.82}
                  >
                    <Feather name="x" size={16} color={T.dangerText} />
                    <Text style={st.rejectText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[st.acceptBtn, disabled && st.disabledBtn]}
                    disabled={disabled}
                    onPress={() => navigateLiveLocation(task)}
                    activeOpacity={0.86}
                  >
                    {disabled ? (
                      <ActivityIndicator size="small" color={T.onPrimary} />
                    ) : (
                      <Feather name="navigation" size={16} color={T.onPrimary} />
                    )}
                    <Text style={st.acceptText}>Navigate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <IncidentStatusAlert
          visible={!!statusAlert}
          status={statusAlert?.status || 'CANCELLED'}
          message={statusAlert?.message}
          confirmLabel="Back to Dashboard"
          onConfirm={() => setStatusAlert(null)}
        />
      </SafeAreaView>
    </AtmosphericShell>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#8A38F6',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  android: {
    elevation: 6,
  },
});

const st = StyleSheet.create({
  root: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 42,
  },

  headerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: GLASS_SOFT,
    overflow: 'hidden',
    marginBottom: 18,
    ...cardShadow,
  },
  headerGlow: {
    position: 'absolute',
    top: -46,
    right: -22,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(138,56,246,0.16)',
  },
  headerContent: {
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandHeader: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  logoWrap: {
    width: 46,
    height: 46,
    borderRadius: R.lg,
    backgroundColor: VIOLET_SOFT,
    borderWidth: 1,
    borderColor: BORDER_VIOLET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: T.violet,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: T.violetLight,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: 0,
    marginTop: 6,
  },
  headerMeta: {
    marginTop: 4,
    color: T.ink3,
    fontSize: 13,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: T.danger,
    borderWidth: 1.5,
    borderColor: '#120B29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: T.onPrimary,
    fontSize: 9,
    fontWeight: '900',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: T.ink3,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '800',
    color: T.violetLight,
  },

  stateCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: GLASS,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 10,
    ...cardShadow,
  },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: VIOLET_SOFT,
    borderWidth: 1,
    borderColor: BORDER_VIOLET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIconDanger: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: DANGER_SOFT,
    borderWidth: 1,
    borderColor: T.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    color: T.ink3,
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '500',
    maxWidth: 270,
  },
  retryBtn: {
    marginTop: 4,
    minHeight: 38,
    paddingHorizontal: 18,
    borderRadius: R.pill,
    backgroundColor: T.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: T.onPrimary,
    fontSize: 12,
    fontWeight: '900',
  },

  card: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: GLASS,
    paddingHorizontal: S.s4,
    paddingVertical: 13,
    marginBottom: 10,
    ...cardShadow,
  },
  cardAccepted: {
    borderColor: BORDER_VIOLET,
    backgroundColor: GLASS_ACTIVE,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  casePill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: VIOLET_SOFT,
    borderWidth: 1,
    borderColor: BORDER_VIOLET,
  },
  caseCode: {
    fontSize: 11,
    fontWeight: '900',
    color: T.violetLight,
    letterSpacing: 0,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: R.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillAssigned: {
    backgroundColor: VIOLET_SOFT,
    borderColor: BORDER_VIOLET,
  },
  statusPillAccepted: {
    backgroundColor: SUCCESS_SOFT,
    borderColor: 'rgba(16,185,129,0.32)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusTextAssigned: {
    color: T.violetLight,
  },
  statusTextAccepted: {
    color: T.success,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: VIOLET_SOFT,
    borderWidth: 1,
    borderColor: BORDER_VIOLET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  victim: {
    fontSize: 16,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: 0,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 3,
  },
  location: {
    flex: 1,
    fontSize: 11,
    color: T.ink3,
    lineHeight: 15,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  rejectBtn: {
    height: 36,
    paddingHorizontal: 11,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: T.dangerBorder,
    backgroundColor: DANGER_SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  rejectText: {
    fontSize: 12,
    fontWeight: '800',
    color: T.dangerText,
  },
  acceptBtn: {
    flex: 1,
    height: 36,
    borderRadius: R.md,
    backgroundColor: T.violet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#8A38F6',
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 7 },
      },
      android: {
        elevation: 7,
      },
    }),
  },
  acceptText: {
    fontSize: 12,
    fontWeight: '900',
    color: T.onPrimary,
  },
  disabledBtn: {
    opacity: 0.58,
  },
});

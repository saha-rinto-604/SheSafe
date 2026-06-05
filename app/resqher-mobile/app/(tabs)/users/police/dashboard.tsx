import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
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
import { T, R } from '../../../../src/constants/theme';
import { incidentService, type PoliceTask } from '../../../../src/services/incidentService';
import { useDispatchSocket } from '../../../../src/hooks/useDispatchSocket';
import IncidentStatusAlert from '../../../../src/components/IncidentStatusAlert';
import api from '../../../../src/services/api';
import { AUTH, POLICE, routeForPoliceStatus } from '../../../../src/constants/routes';
import { useAuth } from '../../../../src/context/AuthContext';
import {
  addPoliceNotification,
  policeNotificationStore,
  type PoliceNotificationPayload,
} from '../../../../src/services/policeNotificationService';

const ACTIVE_INCIDENT_STATUSES = new Set(['ACTIVE', 'IN_PROGRESS', 'LIVE']);
const INACTIVE_INCIDENT_STATUSES = new Set(['RESOLVED', 'CANCELLED']);

const PANEL = 'rgba(11,8,25,0.90)';
const PANEL_SOFT = 'rgba(18,13,38,0.78)';
const PANEL_ACTIVE = 'rgba(25,16,52,0.84)';
const LINE = 'rgba(255,255,255,0.10)';
const LINE_STRONG = 'rgba(255,255,255,0.16)';
const LINE_VIOLET = 'rgba(138,56,246,0.28)';
const VIOLET_WASH = 'rgba(138,56,246,0.10)';
const DANGER_WASH = 'rgba(226,54,54,0.10)';
const SUCCESS_WASH = 'rgba(16,185,129,0.10)';
const WARNING_WASH = 'rgba(245,158,11,0.10)';

function activePoliceTasks(tasks: PoliceTask[]) {
  return tasks.filter((task) => (
    ACTIVE_INCIDENT_STATUSES.has(String(task.incidentStatus || '').toUpperCase())
    && ['ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE'].includes(String(task.status || '').toUpperCase())
  ));
}

function statusLabel(task: PoliceTask) {
  const status = String(task.status || '').toUpperCase();

  if (status === 'ACCEPTED_BY_POLICE') return 'Navigating';
  if (status === 'ASSIGNED_TO_POLICE') return 'Assigned';

  return status.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

function formatTimeAgo(value?: string | null) {
  if (!value) return 'Time pending';

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'Time pending';

  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function taskCode(task: PoliceTask) {
  return task.incidentDisplayCode || `#${task.incidentId || task.id}`;
}

function taskLocation(task: PoliceTask) {
  if (task.address) return task.address;

  const liveLocation = task.victimLiveLocation;
  const lat = liveLocation?.latitude ?? task.latitude;
  const lng = liveLocation?.longitude ?? task.longitude;

  if (typeof lat === 'number' && typeof lng === 'number') {
    return `Live coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  return 'Live location pending';
}

export default function PoliceTodo() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [tasks, setTasks] = useState<PoliceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusAlert, setStatusAlert] = useState<{ status: 'RESOLVED' | 'CANCELLED'; message?: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const seenStatusEventsRef = useRef<Set<string>>(new Set());
  const seenNotificationsRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<PoliceTask[]>([]);
  const firstLoadDoneRef = useRef(false);
  const loadingRequestRef = useRef<Promise<void> | null>(null);

  const liveCount = tasks.length;
  const acceptedCount = useMemo(
    () => tasks.filter(task => String(task.status || '').toUpperCase() === 'ACCEPTED_BY_POLICE').length,
    [tasks]
  );
  const assignedCount = useMemo(
    () => tasks.filter(task => String(task.status || '').toUpperCase() === 'ASSIGNED_TO_POLICE').length,
    [tasks]
  );
  const latestSignal = useMemo(() => {
    if (loading) return 'Syncing';
    if (!tasks.length) return 'Standing by';

    const newest = tasks.reduce((latest, task) => {
      const value = new Date(task.updatedAt || task.createdAt || 0).getTime();
      return value > latest ? value : latest;
    }, 0);

    return newest ? `Signal ${formatTimeAgo(new Date(newest).toISOString())}` : 'Live queue active';
  }, [loading, tasks]);

  const assignmentSummary = useMemo(() => {
    if (loading) return 'Secure channel syncing';
    if (!liveCount) return 'No active dispatch';
    if (liveCount === 1) return '1 active dispatch';
    return `${liveCount} active dispatches`;
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

  const runLoad = useCallback(async (showInitialLoader = false) => {
    if (loadingRequestRef.current) {
      return loadingRequestRef.current;
    }

    if (showInitialLoader) {
      setLoading(true);
    }

    const request = load().finally(() => {
      loadingRequestRef.current = null;
      if (showInitialLoader) {
        setLoading(false);
      }
    });

    loadingRequestRef.current = request;
    return request;
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const isFirstLoad = !firstLoadDoneRef.current;
      firstLoadDoneRef.current = true;
      runLoad(isFirstLoad);

      return undefined;
    }, [runLoad])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runLoad(false);
    } finally {
      setRefreshing(false);
    }
  }, [runLoad]);

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
      await runLoad(false);
    } finally {
      setBusyId(null);
    }
  }, [runLoad, router]);

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

  const openLogout = useCallback(() => {
    setLogoutError(null);
    setLogoutVisible(true);
  }, []);

  const closeLogout = useCallback(() => {
    if (logoutBusy) return;
    setLogoutVisible(false);
    setLogoutError(null);
  }, [logoutBusy]);

  const confirmLogout = useCallback(async () => {
    if (logoutBusy) return;

    setLogoutBusy(true);
    setLogoutError(null);

    try {
      const signedOut = await signOut(() => {
        setLogoutError('You cannot logout while your own SOS is live. Resolve or cancel it first.');
      });

      if (signedOut) {
        setLogoutVisible(false);
        router.replace(AUTH.LOGIN as any);
      }
    } catch (err: any) {
      setLogoutError(err?.message || 'Logout failed. Please try again.');
    } finally {
      setLogoutBusy(false);
    }
  }, [logoutBusy, router, signOut]);

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
    runLoad(false);
  }, [addNotification, runLoad]);

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
            <View style={st.headerMainRow}>
              <View style={st.logoWrap}>
                <SheSafeMark size={22} />
              </View>

              <View style={st.headerCopy}>
                <Text style={st.eyebrow} numberOfLines={1}>Law Enforcement Command</Text>
                <Text style={st.title} numberOfLines={1}>Dashboard</Text>
                <View style={st.headerMetaRow}>
                  <View style={st.secureDot} />
                  <Text style={st.headerMeta} numberOfLines={1}>{assignmentSummary}</Text>
                </View>
              </View>

              <View style={st.headerActions}>
                <TouchableOpacity style={st.iconBtn} onPress={openNotifications} activeOpacity={0.78}>
                  <Feather name="bell" size={14} color={T.ink2} />
                  {unreadCount > 0 && (
                    <View style={st.unreadBadge}>
                      <Text style={st.unreadText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={st.iconBtn} onPress={refresh} activeOpacity={0.78}>
                  <Feather name="refresh-cw" size={14} color={T.ink2} />
                </TouchableOpacity>

                <TouchableOpacity style={[st.iconBtn, st.logoutIconBtn]} onPress={openLogout} activeOpacity={0.78}>
                  <Feather name="log-out" size={14} color={T.dangerText} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={st.sectionHeader}>
            <View style={st.sectionCopy}>
              <Text style={st.sectionTitle}>Dispatch Queue</Text>
              <Text style={st.sectionSubtitle} numberOfLines={1}>
                {latestSignal} · {acceptedCount} navigating · {assignedCount} queued
              </Text>
            </View>
            <View style={[st.queueLabel, liveCount > 0 && st.queueLabelLive]}>
              <View style={[st.queueDot, liveCount > 0 && st.queueDotLive]} />
              <Text style={[st.queueText, liveCount > 0 && st.queueTextLive]}>{liveCount ? `${liveCount} live` : 'clear'}</Text>
            </View>
          </View>

          {loading ? (
            <View style={st.stateCard}>
              <ActivityIndicator color={T.violet} />
              <View style={st.stateCopy}>
                <Text style={st.stateTitle}>Syncing police command</Text>
                <Text style={st.stateText}>Checking verified access and assigned dispatch requests.</Text>
              </View>
            </View>
          ) : error ? (
            <View style={st.stateCard}>
              <View style={st.stateIconDanger}>
                <Feather name="alert-triangle" size={17} color={T.dangerText} />
              </View>
              <View style={st.stateCopy}>
                <Text style={st.stateTitle}>Could not load requests</Text>
                <Text style={st.stateText}>{error}</Text>
              </View>
              <TouchableOpacity style={st.retryBtn} onPress={refresh} activeOpacity={0.82}>
                <Text style={st.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : tasks.length === 0 ? (
            <View style={st.stateCard}>
              <View style={st.stateIcon}>
                <Feather name="radio" size={17} color={T.violetLight} />
              </View>
              <View style={st.stateCopy}>
                <Text style={st.stateTitle}>No active dispatch</Text>
                <Text style={st.stateText}>Assigned law enforcement requests will appear here immediately.</Text>
              </View>
            </View>
          ) : tasks.map(task => {
            const status = String(task.status || '').toUpperCase();
            const accepted = status === 'ACCEPTED_BY_POLICE';
            const disabled = busyId === task.id;
            const requestedAt = formatTimeAgo(task.createdAt);

            return (
              <View key={task.id} style={[st.dispatchCard, accepted && st.dispatchCardActive]}>
                <View style={st.alertRail} />

                <View style={st.dispatchTopRow}>
                  <View style={st.caseTextBlock}>
                    <Text style={st.caseLabel} numberOfLines={1}>LIVE SOS · {taskCode(task)}</Text>
                    <Text style={st.caseTime} numberOfLines={1}>Requested {requestedAt}</Text>
                  </View>

                  <View style={[st.flatStatus, accepted ? st.flatStatusActive : st.flatStatusQueued]}>
                    <Text style={[st.flatStatusText, accepted ? st.flatStatusTextActive : st.flatStatusTextQueued]}>
                      {statusLabel(task)}
                    </Text>
                  </View>
                </View>

                <View style={st.dispatchBody}>
                  <View style={st.personIcon}>
                    <Feather name="user" size={16} color={T.ink2} />
                  </View>

                  <View style={st.dispatchCopy}>
                    <Text style={st.victimName} numberOfLines={1}>{task.victimName || 'SOS requester'}</Text>
                    <View style={st.detailRow}>
                      <Feather name="map-pin" size={12} color={T.ink4} />
                      <Text style={st.detailText} numberOfLines={2}>{taskLocation(task)}</Text>
                    </View>
                    {!!task.requestNote && (
                      <View style={st.detailRow}>
                        <Feather name="message-square" size={12} color={T.ink4} />
                        <Text style={st.noteText} numberOfLines={2}>{task.requestNote}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={st.actions}>
                  <TouchableOpacity
                    style={[st.rejectBtn, disabled && st.disabledBtn]}
                    disabled={disabled}
                    onPress={() => reject(task)}
                    activeOpacity={0.78}
                  >
                    <Feather name="x" size={15} color={T.dangerText} />
                    <Text style={st.rejectText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[st.navigateBtn, accepted && st.navigateBtnActive, disabled && st.disabledBtn]}
                    disabled={disabled}
                    onPress={() => navigateLiveLocation(task)}
                    activeOpacity={0.84}
                  >
                    {disabled ? (
                      <ActivityIndicator size="small" color={T.onPrimary} />
                    ) : (
                      <Feather name="navigation" size={16} color={T.onPrimary} />
                    )}
                    <Text style={st.navigateText}>{accepted ? 'Continue' : 'Navigate'}</Text>
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

        <Modal
          visible={logoutVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeLogout}
        >
          <Pressable style={st.modalBackdrop} onPress={closeLogout}>
            <Pressable style={st.logoutSheet} onPress={() => undefined}>
              <View style={st.logoutIconWrap}>
                <Feather name="log-out" size={22} color={T.dangerText} />
              </View>
              <Text style={st.logoutTitle}>Logout</Text>
              <Text style={st.logoutMessage}>Are you sure you want to logout from the law enforcement dashboard?</Text>
              {!!logoutError && <Text style={st.logoutError}>{logoutError}</Text>}

              <View style={st.modalActions}>
                <TouchableOpacity
                  style={[st.modalBtn, st.modalCancelBtn, logoutBusy && st.disabledBtn]}
                  disabled={logoutBusy}
                  activeOpacity={0.82}
                  onPress={closeLogout}
                >
                  <Text style={st.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[st.modalBtn, st.modalLogoutBtn, logoutBusy && st.disabledBtn]}
                  disabled={logoutBusy}
                  activeOpacity={0.82}
                  onPress={confirmLogout}
                >
                  {logoutBusy ? (
                    <ActivityIndicator size="small" color={T.onDanger} />
                  ) : (
                    <Feather name="log-out" size={15} color={T.onDanger} />
                  )}
                  <Text style={st.modalLogoutText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </AtmosphericShell>
  );
}

const shadowSoft = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: {
    elevation: 5,
  },
});

const shadowDanger = Platform.select({
  ios: {
    shadowColor: '#E23636',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: {
    elevation: 5,
  },
});

const st = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 42,
  },

  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: PANEL,
    overflow: 'hidden',
    marginBottom: 14,
    ...shadowSoft,
  },
  headerMainRow: {
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: LINE_VIOLET,
    backgroundColor: VIOLET_WASH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: T.violetLight,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.95,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    color: T.ink,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  headerMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  secureDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: T.success,
  },
  headerMeta: {
    flex: 1,
    color: T.ink3,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  iconBtn: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.042)',
  },
  logoutIconBtn: {
    borderColor: T.dangerBorder,
    backgroundColor: DANGER_WASH,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 8.5,
    backgroundColor: T.danger,
    borderWidth: 1.5,
    borderColor: '#090712',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: T.onPrimary,
    fontSize: 8.5,
    fontWeight: '900',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: T.ink2,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    marginTop: 3,
    color: T.ink4,
    fontSize: 10.5,
    fontWeight: '700',
  },
  queueLabel: {
    minHeight: 27,
    paddingHorizontal: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueLabelLive: {
    borderColor: T.dangerBorder,
    backgroundColor: DANGER_WASH,
  },
  queueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.ink4,
  },
  queueDotLive: {
    backgroundColor: T.danger,
  },
  queueText: {
    color: T.ink4,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  queueTextLive: {
    color: T.dangerText,
  },

  stateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: PANEL_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadowSoft,
  },
  stateIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: VIOLET_WASH,
    borderWidth: 1,
    borderColor: LINE_VIOLET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIconDanger: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: DANGER_WASH,
    borderWidth: 1,
    borderColor: T.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCopy: {
    flex: 1,
    minWidth: 0,
  },
  stateTitle: {
    color: T.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  stateText: {
    marginTop: 3,
    color: T.ink3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  retryBtn: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: R.sm,
    backgroundColor: T.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: T.onPrimary,
    fontSize: 12,
    fontWeight: '900',
  },

  dispatchCard: {
    position: 'relative',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: PANEL_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadowSoft,
  },
  dispatchCardActive: {
    borderColor: LINE_VIOLET,
    backgroundColor: PANEL_ACTIVE,
  },
  alertRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: T.danger,
  },
  dispatchTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  caseTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  caseLabel: {
    color: T.dangerText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  caseTime: {
    marginTop: 3,
    color: T.ink4,
    fontSize: 10.5,
    fontWeight: '700',
  },
  flatStatus: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: R.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatStatusQueued: {
    backgroundColor: WARNING_WASH,
    borderColor: 'rgba(245,158,11,0.26)',
  },
  flatStatusActive: {
    backgroundColor: SUCCESS_WASH,
    borderColor: 'rgba(16,185,129,0.28)',
  },
  flatStatusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  flatStatusTextQueued: {
    color: '#FBBF24',
  },
  flatStatusTextActive: {
    color: T.success,
  },
  dispatchBody: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  personIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchCopy: {
    flex: 1,
    minWidth: 0,
  },
  victimName: {
    color: T.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  detailRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  detailText: {
    flex: 1,
    color: T.ink3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  noteText: {
    flex: 1,
    color: T.ink4,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  rejectBtn: {
    width: 94,
    height: 38,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: T.dangerBorder,
    backgroundColor: 'rgba(226,54,54,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rejectText: {
    color: T.dangerText,
    fontSize: 12,
    fontWeight: '900',
  },
  navigateBtn: {
    flex: 1,
    height: 38,
    borderRadius: R.sm,
    backgroundColor: T.violet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...shadowDanger,
  },
  navigateBtnActive: {
    backgroundColor: T.violetDark,
  },
  navigateText: {
    color: T.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  disabledBtn: {
    opacity: 0.56,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  logoutSheet: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE_STRONG,
    backgroundColor: '#100B22',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
    ...shadowDanger,
  },
  logoutIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: DANGER_WASH,
    borderWidth: 1,
    borderColor: T.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoutTitle: {
    color: T.ink,
    fontSize: 19,
    fontWeight: '900',
  },
  logoutMessage: {
    marginTop: 7,
    color: T.ink3,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '600',
  },
  logoutError: {
    marginTop: 10,
    color: T.dangerText,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 42,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  modalCancelText: {
    color: T.ink2,
    fontSize: 13,
    fontWeight: '900',
  },
  modalLogoutBtn: {
    backgroundColor: T.danger,
  },
  modalLogoutText: {
    color: T.onDanger,
    fontSize: 13,
    fontWeight: '900',
  },
});

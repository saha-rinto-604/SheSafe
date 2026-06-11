/**
 * Admin Dashboard — Emergency Coordination Center
 * Responsive layout: Desktop sidebar (>768px) / Mobile drawer (≤768px)
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Platform, TextInput, StatusBar, Modal, Animated, Easing, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { T, Ty } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/AuthContext';
import { useToast } from '../../../../src/components/Toast';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { DesktopSidebar, MobileDrawer } from '../../../../src/features/admin/_components/AdminSidebar';
import {
  HeroCard, StatCard, SectionHeader,
  VerificationCard,
} from '../../../../src/features/admin/_components/AdminDashboardCards';
import { IncidentCenterWorkspace } from '../../../../src/features/admin/_components/IncidentCenterWorkspace';
import { UsersWorkspace } from '../../../../src/features/admin/_components/UsersWorkspace';
import { VerificationsWorkspace } from '../../../../src/features/admin/_components/VerificationsWorkspace';
import { SafePlacesWorkspace } from '../../../../src/features/admin/_components/SafePlacesWorkspace';
import { PoliceWorkspace } from '../../../../src/features/admin/_components/PoliceWorkspace';
import { AdminNotificationsDrawer } from '../../../../src/features/admin/_components/AdminNotificationsDrawer';
import { adminService, type AdminOverview } from '../../../../src/services/adminService';
import { SIDEBAR_ITEMS } from '../../../../src/features/admin/_data/adminMockData';
import { useDispatchSocket } from '../../../../src/hooks/useDispatchSocket';
import { useNotificationBanner } from '../../../../src/components/NotificationBannerProvider';
import type { BackendNotification } from '../../../../src/services/notificationService';
const DESKTOP_BREAKPOINT = 768;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const ADMIN_SECTION_KEYS = new Set(SIDEBAR_ITEMS.map(item => item.key));
const ACTIVE_LAW_REQUEST_STATUSES = new Set(['PENDING_ADMIN_REVIEW', 'ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE', 'REJECTED_BY_POLICE']);
const INACTIVE_LAW_STATUSES = new Set(['RESOLVED', 'CANCELLED']);
const ADMIN_REFRESH_INTERVAL_MS = 60_000;
const ADMIN_REFRESH_MIN_GAP_MS = 10_000;
const ADMIN_RATE_LIMIT_FALLBACK_MS = 60_000;

function normalizeAdminSection(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const key = String(raw || 'overview').toLowerCase();
  return ADMIN_SECTION_KEYS.has(key) ? key : 'overview';
}

function statusLabel(value?: string | null) {
  return String(value || '').replace(/_/g, ' ');
}

function shortTime(value?: string | null) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function needsAdminAttention(item: any) {
  const incidentStatus = String(item?.incidentStatus || '').toUpperCase();
  const requestStatus = String(item?.status || '').toUpperCase();
  return !INACTIVE_LAW_STATUSES.has(incidentStatus) && ACTIVE_LAW_REQUEST_STATUSES.has(requestStatus);
}

function LawRequestPreviewCard({ item, onPress }: { item: any; onPress: () => void }) {
  const incidentStatus = String(item?.incidentStatus || '').toUpperCase();
  const requestStatus = String(item?.status || '').toUpperCase();
  const inactiveStatus = INACTIVE_LAW_STATUSES.has(incidentStatus) ? incidentStatus : INACTIVE_LAW_STATUSES.has(requestStatus) ? requestStatus : null;
  const assigned = !inactiveStatus && ['ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE'].includes(requestStatus);
  const badgeText = inactiveStatus ? statusLabel(inactiveStatus) : assigned ? 'Assigned' : statusLabel(requestStatus || 'Pending');
  const severity = String(item.severity || 'LOW').toUpperCase();

  return (
    <TouchableOpacity style={ds.lawQuickItem} activeOpacity={0.82} onPress={onPress}>
      <View style={ds.lawQuickTop}>
        <Text style={ds.quickTitle}>{item.incidentDisplayCode || `#${item.incidentId || item.id}`}</Text>
        <Text style={[
          ds.lawBadge,
          assigned && ds.lawBadgeAssigned,
          inactiveStatus === 'RESOLVED' && ds.lawBadgeResolved,
          inactiveStatus === 'CANCELLED' && ds.lawBadgeCancelled,
        ]}>
          {badgeText}
        </Text>
      </View>
      <Text style={[
        ds.lawSeverity,
        severity === 'CRITICAL' && ds.lawSeverityCritical,
        severity === 'HIGH' && ds.lawSeverityHigh,
        severity === 'MEDIUM' && ds.lawSeverityMedium,
      ]}>
        {severity}
      </Text>
      <Text style={ds.quickSub} numberOfLines={1}>{item.victimName || item.requesterName || 'SOS requester'}</Text>
      <Text style={ds.quickSub} numberOfLines={2}>{item.summaryPreview || item.address || 'Location unavailable'}</Text>
      <View style={ds.lawQuickFooter}>
        <Text style={ds.quickSub}>{shortTime(item.createdAt)}</Text>
        <Text style={ds.quickSub}>{item.assignedToAll ? 'All approved police' : item.assignedPoliceName || item.assignedPolice?.name || 'Unassigned'}</Text>
      </View>
    </TouchableOpacity>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(Dimensions.get('window').width > DESKTOP_BREAKPOINT);
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setIsDesktop(window.width > DESKTOP_BREAKPOINT);
    });
    return () => sub?.remove();
  }, []);
  return isDesktop;
}

/* ── Top Header Bar ── */
function TopHeader({ isDesktop, onMenuPress, onNotificationsPress, activeMenu, bellScale }: any) {
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const showSearch = isDesktop && (activeMenu === 'users' || activeMenu === 'incidents');
  let searchPlaceholder = '';
  if (activeMenu === 'users') {
    searchPlaceholder = 'Search users by name, phone number';
  } else if (activeMenu === 'incidents') {
    searchPlaceholder = 'Search incidents...';
  }
  return (
    <View style={[th.bar, !isDesktop && th.barMobile]}>
      <View style={th.left}>
        {!isDesktop && (
          <TouchableOpacity onPress={onMenuPress} style={th.menuBtn} activeOpacity={0.7}>
            <Feather name="menu" size={22} color={T.ink} />
          </TouchableOpacity>
        )}
        <View>
          <Text style={th.title}>SheSafe Admin</Text>
          {isDesktop && <Text style={th.subtitle}>Monitor emergency activity across SheSafe</Text>}
        </View>
      </View>
      {showSearch && (
        <View style={th.center}>
          <View style={[
            th.searchWrap, 
            isFocused && { borderColor: T.violet, backgroundColor: 'rgba(138,56,246,0.05)' }
          ]}>
            <Feather name="search" size={16} color={isFocused ? T.violet : T.ink4} />
            <TextInput
              placeholder={searchPlaceholder}
              placeholderTextColor={T.ink5}
              value={searchText}
              onChangeText={setSearchText}
              style={[
                th.searchInput,
                Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}
              ]}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          </View>
        </View>
      )}
      <View style={th.right}>
        <TouchableOpacity style={th.iconBtn} activeOpacity={0.7} onPress={onNotificationsPress}>
          <Animated.View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', transform: [{ scale: bellScale }] }}>
            <Feather name="bell" size={18} color={T.ink3} />
            <View style={th.notifDot} />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity style={th.avatarBtn} activeOpacity={0.7}>
          <UserAvatar size={32} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const th = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#0F1020',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  barMobile: { paddingHorizontal: 14, paddingVertical: 10 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  menuBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: T.ink4, marginTop: 1 },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, height: 40, width: 340, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid,
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 8,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: T.danger, borderWidth: 1.5, borderColor: '#0A0A10',
  },
  avatarBtn: {
    borderRadius: 16, borderWidth: 1.5,
    borderColor: 'rgba(138,56,246,0.3)', overflow: 'hidden',
  },
});

/* ── Main Dashboard Screen ── */
export default function AdminDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const routeSection = normalizeAdminSection(params.section);
  const { signOut, isLoading: authLoading, isSignedIn, role } = useAuth();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [activeMenu, setActiveMenu] = useState(routeSection);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [ovVerifs, setOvVerifs] = useState<any[]>([]);
  const [ovSafePlaces, setOvSafePlaces] = useState<any[]>([]);
  const [ovLawRequests, setOvLawRequests] = useState<any[]>([]);
  
  const attentionLawRequests = ovLawRequests.filter(needsAdminAttention);

  const [selectedVerif, setSelectedVerif] = useState<any>(null);
  const { showToast } = useToast();
  const { enqueue } = useNotificationBanner();
  const [latestAdminNotification, setLatestAdminNotification] = useState<BackendNotification | null>(null);
  const enqueueAdminNotification = useCallback((notification: BackendNotification) => {
    enqueue(notification);
    setLatestAdminNotification(notification);
  }, [enqueue]);
  const knownAdminReviewIds = useRef<Set<string> | null>(null);
  const overviewFetchInFlight = useRef(false);
  const overviewLastFetchedAt = useRef(0);
  const overviewBackoffUntil = useRef(0);
  const rateLimitToastShownAt = useRef(0);

  const handleApproveVerif = (item: any) => {
    showToast({ type: 'success', title: 'Volunteer Approved', message: `${item.name} has been verified.` });
    setSelectedVerif(null);
    setTimeout(() => setOvVerifs(prev => prev.filter(v => v.id !== item.id)), 300);
  };
  const handleRejectVerif = (item: any) => {
    showToast({ type: 'info', title: 'Application Rejected', message: `${item.name}'s verification was rejected.` });
    setSelectedVerif(null);
    setTimeout(() => setOvVerifs(prev => prev.filter(v => v.id !== item.id)), 300);
  };
  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      router.replace('/(auth)/admin-login' as any);
      return;
    }
    if (role !== 'ADMIN') {
      showToast({
        type: 'warning',
        title: 'Admin Access Only',
        message: 'Please sign in with an admin account.',
      });
      router.replace('/(auth)/admin-login' as any);
    }
  }, [authLoading, isSignedIn, role, router, showToast]);

  const loadOverview = useCallback(async () => {
    const now = Date.now();
    if (overviewFetchInFlight.current || now < overviewBackoffUntil.current) return;
    if (now - overviewLastFetchedAt.current < ADMIN_REFRESH_MIN_GAP_MS) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;

    overviewFetchInFlight.current = true;
    overviewLastFetchedAt.current = now;
    setOverviewLoading(true);
    setOverviewError('');
    try {
      if (__DEV__) console.info('[admin-dashboard] refresh cycle started');
      const [nextOverview, verifs, safePlaces, lawRequests] = await Promise.all([
        adminService.getOverview(),
        adminService.getVerifications('pending'),
        adminService.getSafePlaces('PENDING'),
        adminService.getLawEnforcementRequests(),
      ]);
      const nextReviewIds = new Set<string>();
      const reviewNotifications = [
        ...verifs.filter((item: any) => item.kind !== 'police').map((item: any) => ({
          key: `admin-volunteer-verification:${item.id}`,
          type: 'ADMIN_VERIFICATION_REQUEST',
          title: 'New volunteer verification request',
          body: `${item.name || 'A volunteer'} submitted documents for review.`,
          context: 'admin_volunteer_verification',
        })),
        ...verifs.filter((item: any) => item.kind === 'police').map((item: any) => ({
          key: `admin-police-verification:${item.id}`,
          type: 'ADMIN_VERIFICATION_REQUEST',
          title: 'New police verification request',
          body: `${item.name || 'A police applicant'} submitted documents for review.`,
          context: 'admin_police_verification',
        })),
        ...safePlaces.map((item: any) => ({
          key: `admin-safe-place:${item.id}`,
          type: 'ADMIN_SAFE_PLACE_REQUEST',
          title: 'New safe place request',
          body: `${item.placeName || 'A safe place'} is waiting for review.`,
          context: 'admin_safe_place',
        })),
      ];
      reviewNotifications.forEach(item => nextReviewIds.add(item.key));
      if (knownAdminReviewIds.current) {
        reviewNotifications
          .filter(item => !knownAdminReviewIds.current?.has(item.key))
          .forEach(item => enqueueAdminNotification({
            id: item.key,
            type: item.type,
            title: item.title,
            body: item.body,
            data: { context: item.context },
            read: false,
            createdAt: new Date().toISOString(),
          }));
      }
      knownAdminReviewIds.current = nextReviewIds;
      setOverview(nextOverview);
      setOvVerifs(verifs);
      setOvSafePlaces(safePlaces);
      setOvLawRequests(lawRequests);
    } catch (err: any) {
      if (Number(err?.status) === 429) {
        const retryAfterMs = Math.max(Number(err?.retryAfterSeconds || 0) * 1000, ADMIN_RATE_LIMIT_FALLBACK_MS);
        overviewBackoffUntil.current = Date.now() + retryAfterMs;
        setOverviewError('');
        if (Date.now() - rateLimitToastShownAt.current >= retryAfterMs) {
          rateLimitToastShownAt.current = Date.now();
          showToast({
            type: 'warning',
            title: 'Dashboard refresh paused',
            message: 'Admin dashboard is refreshing too often. Please wait a moment.',
          });
        }
        if (__DEV__) console.info(`[admin-dashboard] 429 received; polling paused for ${Math.ceil(retryAfterMs / 1000)} seconds`);
      } else {
        setOverviewError(err?.message || 'Could not load admin overview.');
      }
    } finally {
      overviewFetchInFlight.current = false;
      setOverviewLoading(false);
    }
  }, [enqueueAdminNotification, showToast]);

  useEffect(() => {
    if (role !== 'ADMIN') return undefined;
    const initialTimer = setTimeout(() => {
      loadOverview();
    }, 0);
    const refreshTimer = setInterval(loadOverview, ADMIN_REFRESH_INTERVAL_MS);
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) loadOverview();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      clearTimeout(initialTimer);
      clearInterval(refreshTimer);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [role, loadOverview]);

  const refreshLawRequestsFromSocket = useCallback((payload?: any) => {
    if (role === 'ADMIN') {
      if (payload?.notificationId || payload?.requestId) {
        enqueueAdminNotification({
          id: String(payload.notificationId || `admin-law-request:${payload.requestId}:${payload.status || 'updated'}`),
          type: String(payload.type || 'LAW_ENFORCEMENT_REQUESTED'),
          title: String(payload.title || 'Law enforcement request'),
          body: String(payload.message || 'A law enforcement request needs admin attention.'),
          incidentId: payload.incidentId ? String(payload.incidentId) : null,
          data: { context: 'admin_law_enforcement', requestId: payload.requestId || null },
          read: false,
          createdAt: String(payload.createdAt || new Date().toISOString()),
        });
      }
      loadOverview();
    }
  }, [enqueueAdminNotification, loadOverview, role]);

  const notifyCriticalSos = useCallback((incident: any) => {
    if (role !== 'ADMIN') return;
    enqueueAdminNotification({
      id: `admin-critical-sos:${incident.id}`,
      type: 'ADMIN_CRITICAL_SOS',
      title: 'New critical SOS incident',
      body: `${incident.victimName || 'A user'} needs immediate assistance.`,
      incidentId: String(incident.id),
      data: { context: 'admin_incident' },
      read: false,
      createdAt: String(incident.createdAt || new Date().toISOString()),
    });
    loadOverview();
  }, [enqueueAdminNotification, loadOverview, role]);

  useDispatchSocket({
    enabled: role === 'ADMIN' && isSignedIn,
    onNewSos: notifyCriticalSos,
    onLawEnforcementRequest: refreshLawRequestsFromSocket,
    onIncidentStatusUpdated: refreshLawRequestsFromSocket,
    onNotificationCreated: enqueueAdminNotification,
  });

  const workspaceOpacity = useMemo(() => new Animated.Value(1), []);
  const workspaceTranslateX = useMemo(() => new Animated.Value(0), []);
  const bellScale = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (activeMenu === routeSection) return;
    const timer = setTimeout(() => {
      workspaceOpacity.setValue(1);
      workspaceTranslateX.setValue(0);
      setActiveMenu(routeSection);
      setDrawerOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeMenu, routeSection, workspaceOpacity, workspaceTranslateX]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(bellScale, { toValue: 1.15, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(bellScale, { toValue: 1, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.delay(3000),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bellScale]);

  const handleLogoutClick = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setShowLogoutModal(false);
    const success = await signOut();
    if (success) {
      router.replace('/(auth)/admin-login' as any);
    }
  }, [signOut, router]);

  const handleMenuSelect = useCallback((key: string) => {
    const nextKey = ADMIN_SECTION_KEYS.has(key) ? key : 'overview';
    setDrawerOpen(false);
    if (routeSection !== nextKey) {
      router.push({ pathname: '/(tabs)/users/admin/dashboard', params: { section: nextKey } } as any);
    }
    if (activeMenu === nextKey) return;

    Animated.parallel([
      Animated.timing(workspaceOpacity, { toValue: 0, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(workspaceTranslateX, { toValue: 20, duration: 150, useNativeDriver: USE_NATIVE_DRIVER })
    ]).start(() => {
      setActiveMenu(nextKey);
      workspaceTranslateX.setValue(-20);
      Animated.parallel([
        Animated.timing(workspaceOpacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(workspaceTranslateX, { toValue: 0, duration: 200, useNativeDriver: USE_NATIVE_DRIVER })
      ]).start();
    });
  }, [activeMenu, routeSection, router, workspaceOpacity, workspaceTranslateX]);

  const screenWidth = Dimensions.get('window').width;
  const cardMinW = isDesktop ? 155 : 150;
  const availableW = isDesktop ? screenWidth - 260 - 80 : screenWidth - 40;
  const cardsPerRow = Math.max(2, Math.floor(availableW / cardMinW));
  const statCards = [
    { label: 'Total Users', value: overview?.totals.totalUsers ?? 0, icon: 'users', color: T.violet, bgColor: T.violetDim },
    { label: 'Verified Volunteers', value: overview?.totals.verifiedVolunteers ?? 0, icon: 'check-circle', color: T.violet, bgColor: T.violetDim },
    { label: 'Total Incidents', value: overview?.totals.totalIncidents ?? 0, icon: 'layers', color: T.violet, bgColor: T.violetDim },
    { label: 'Resolved Incidents', value: overview?.totals.resolvedIncidents ?? 0, icon: 'shield', color: T.success, bgColor: T.safeLight },
    { label: 'Pending Safe Places', value: overview?.live.pendingSafePlaces ?? 0, icon: 'map-pin', color: T.accent, bgColor: T.accentLight },
  ];

  if (authLoading || role !== 'ADMIN') {
    return (
      <View style={[ds.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: T.ink4 }}>Checking admin access...</Text>
      </View>
    );
  }

  return (
    <View style={[ds.root, { paddingTop: Platform.OS !== 'web' ? insets.top : 0 }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={ds.layout}>
        {isDesktop && (
          <DesktopSidebar
            activeKey={activeMenu}
            onSelect={handleMenuSelect}
            onLogout={handleLogoutClick}
          />
        )}
        <View style={ds.main}>
          <TopHeader 
            isDesktop={isDesktop} 
            onMenuPress={() => setDrawerOpen(true)} 
            onNotificationsPress={() => setNotifDrawerOpen(true)}
            activeMenu={activeMenu}
            bellScale={bellScale}
          />

          <Animated.View style={[ds.workspace, { 
            opacity: workspaceOpacity,
            transform: [{ translateX: workspaceTranslateX }]
          }]}>
            {activeMenu === 'overview' ? (
              <ScrollView
                style={ds.scroll}
                contentContainerStyle={[ds.scrollContent, { paddingBottom: insets.bottom + 30 }]}
                showsVerticalScrollIndicator={false}
              >
                {/* Hero Emergency Card */}
                <HeroCard onOpenIncidentCenter={() => handleMenuSelect('incidents')} overview={overview} />
                {overviewLoading && <Text style={{ color: T.ink4, marginBottom: 12 }}>Loading live admin data...</Text>}
                {!!overviewError && (
                  <TouchableOpacity onPress={loadOverview} activeOpacity={0.8} style={{ marginBottom: 12 }}>
                    <Text style={{ color: T.danger }}>{overviewError}</Text>
                  </TouchableOpacity>
                )}

                {/* Overview Statistics */}
                <SectionHeader title="Overview Statistics" icon="bar-chart-2" />
                <View style={ds.statsGrid}>
                  {statCards.map((card, i) => (
                    <View key={i} style={{ width: `${Math.floor(100 / cardsPerRow) - 2}%` as any, minWidth: cardMinW - 10 }}>
                      <StatCard {...card} index={i} />
                    </View>
                  ))}
                </View>

                {/* Three Column Layout for Desktop, Stacks on Mobile */}
                <View style={[isDesktop ? ds.threeColRow : undefined, { marginTop: 20 }]}>
                  {/* Pending Safe Places */}
                  <View style={[ds.bigCard, isDesktop ? ds.colThird : undefined]}>
                    <SectionHeader title="Pending Safe Places" icon="map-pin" onViewAll={() => handleMenuSelect('safeplaces')} />
                    {ovSafePlaces.slice(0, 3).map((item) => (
                      <TouchableOpacity key={item.id} style={ds.quickItem} activeOpacity={0.8} onPress={() => handleMenuSelect('safeplaces')}>
                        <Text style={ds.quickTitle}>{item.placeName}</Text>
                        <Text style={ds.quickSub}>{item.location}</Text>
                        <Text style={ds.quickSub}>Requested by {item.requestedBy}</Text>
                      </TouchableOpacity>
                    ))}
                    {ovSafePlaces.length === 0 && <Text style={ds.emptyQuickText}>No pending safe places.</Text>}
                  </View>

                  {/* Pending Verifications */}
                  <View style={[ds.bigCard, isDesktop ? ds.colThird : { marginTop: 20 }]}>
                    <SectionHeader title="Pending Verifications" icon="check-circle" onViewAll={() => handleMenuSelect('verifications')} />
                    {ovVerifs.slice(0, 3).map((item) => (
                      <VerificationCard key={item.id} item={item} onPress={() => handleMenuSelect('verifications')} />
                    ))}
                    {ovVerifs.length === 0 && <Text style={ds.emptyQuickText}>No pending verifications.</Text>}
                  </View>

                  {/* Law Enforcement Requests */}
                  <View style={[ds.bigCard, isDesktop ? ds.colThird : { marginTop: 20 }]}>
                    <SectionHeader title="Law Enforcement Requests" icon="shield" onViewAll={() => handleMenuSelect('law-enforcement-requests')} />
                    {attentionLawRequests.slice(0, 3).map(item => (
                      <LawRequestPreviewCard key={item.id} item={item} onPress={() => handleMenuSelect('law-enforcement-requests')} />
                    ))}
                    {attentionLawRequests.length === 0 && <Text style={ds.emptyQuickText}>No active law enforcement requests need admin attention.</Text>}
                  </View>
                </View>
              </ScrollView>
            ) : activeMenu === 'incidents' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <IncidentCenterWorkspace insetsBottom={insets.bottom} />
              </View>
            ) : activeMenu === 'users' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <UsersWorkspace insetsBottom={insets.bottom} />
              </View>
            ) : activeMenu === 'verifications' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <VerificationsWorkspace insetsBottom={insets.bottom} />
              </View>
            ) : activeMenu === 'police' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <PoliceWorkspace insetsBottom={insets.bottom} />
              </View>
            ) : activeMenu === 'law-enforcement-requests' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <PoliceWorkspace insetsBottom={insets.bottom} requestsOnly />
              </View>
            ) : activeMenu === 'safeplaces' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <SafePlacesWorkspace insetsBottom={insets.bottom} />
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="tool" size={48} color={T.ink4} />
                <Text style={{ color: T.ink4, marginTop: 16 }}>{activeMenu.toUpperCase()} MODULE IN DEVELOPMENT</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </View>
      {!isDesktop && (
        <MobileDrawer
          activeKey={activeMenu}
          onSelect={handleMenuSelect}
          onLogout={handleLogoutClick}
          isDrawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
      )}

      {/* Notifications Drawer */}
      <AdminNotificationsDrawer
        isOpen={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        liveNotification={latestAdminNotification}
      />

      {/* Custom Logout Modal */}
      <Modal
        visible={showLogoutModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={ds.modalOverlay}>
          <View style={ds.logoutModalContent}>
            <View style={ds.logoutHeader}>
              <Feather name="log-out" size={24} color={T.danger} />
              <Text style={ds.logoutTitle}>Confirm Logout</Text>
            </View>
            <Text style={ds.logoutSub}>Are you sure you want to log out of the Admin Dashboard?</Text>
            
            <View style={ds.logoutActions}>
              <TouchableOpacity style={ds.cancelBtn} onPress={() => setShowLogoutModal(false)}>
                <Text style={ds.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ds.confirmBtn} onPress={confirmLogout}>
                <Text style={ds.confirmTxt}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verification Modal */}
      <Modal visible={!!selectedVerif} transparent animationType="slide" onRequestClose={() => setSelectedVerif(null)}>
        <View style={ds.modalOverlay}>
          <View style={ds.detailsModalContent}>
            {selectedVerif && (
              <>
                <View style={ds.modalHeader}>
                  <Text style={ds.modalTitle}>Verification Details</Text>
                  <TouchableOpacity onPress={() => setSelectedVerif(null)} style={ds.closeBtn}>
                    <Feather name="x" size={20} color={T.ink3} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={ds.modalScroll} showsVerticalScrollIndicator={false}>
                  <View style={ds.detailsUserInfo}>
                    <UserAvatar size={60} />
                    <View style={ds.detailsUserText}>
                      <Text style={ds.detailsName}>{selectedVerif.name}</Text>
                      <Text style={ds.detailsPhone}>{selectedVerif.phone}</Text>
                    </View>
                  </View>

                  <View style={ds.divider} />

                  {/* Documents */}
                  <Text style={ds.sectionTitle}>Provided Documents</Text>

                  <View style={ds.docItem}>
                    <Text style={ds.docLabel}>ID Card Image</Text>
                    <Image source={{ uri: selectedVerif.idCardUrl }} style={ds.docImage} resizeMode="contain" />
                  </View>

                  <View style={ds.docItem}>
                    <Text style={ds.docLabel}>Selfie With ID</Text>
                    <Image source={{ uri: selectedVerif.selfieUrl }} style={ds.docImage} resizeMode="contain" />
                  </View>

                  {selectedVerif.certificateUrl && (
                    <View style={ds.docItem}>
                      <Text style={ds.docLabel}>Certificates (Optional)</Text>
                      <Image source={{ uri: selectedVerif.certificateUrl }} style={ds.docImage} resizeMode="contain" />
                    </View>
                  )}
                  
                  <View style={{ height: 40 }} />
                </ScrollView>
                <View style={ds.modalFooter}>
                  <TouchableOpacity style={[ds.actionBtn, ds.btnReject]} onPress={() => handleRejectVerif(selectedVerif)}>
                    <Feather name="x" size={18} color={T.danger} />
                    <Text style={[ds.actionBtnTxt, { color: T.danger }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[ds.actionBtn, ds.btnApprove]} onPress={() => handleApproveVerif(selectedVerif)}>
                    <Feather name="check" size={18} color="#FFF" />
                    <Text style={[ds.actionBtnTxt, { color: '#FFF' }]}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const ds = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060610' },
  layout: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
  workspace: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  /* Stats Grid */
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },

  /* Big Card Layout */
  bigCard: {
    backgroundColor: '#0F1020',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(138,56,246,0.15)',
  },
  quickItem: {
    backgroundColor: T.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.lineMid,
    padding: 14,
    marginBottom: 10,
  },
  quickTitle: { fontSize: 13, fontWeight: '800', color: T.ink, marginBottom: 4 },
  quickSub: { fontSize: 11, color: T.ink4, marginTop: 2 },
  lawQuickItem: {
    backgroundColor: T.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.lineMid,
    padding: 14,
    marginBottom: 10,
  },
  lawQuickTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 },
  lawQuickFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  lawBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', backgroundColor: T.violetDim, color: T.violet, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  lawBadgeAssigned: { backgroundColor: T.safeLight, color: T.success },
  lawBadgeResolved: { backgroundColor: T.safeLight, color: T.success },
  lawBadgeCancelled: { backgroundColor: T.dangerLight, color: T.dangerText },
  lawSeverity: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', color: T.ink3, fontSize: 10, fontWeight: '900', marginBottom: 5 },
  lawSeverityMedium: { backgroundColor: T.accentLight, color: T.accent },
  lawSeverityHigh: { backgroundColor: 'rgba(245,158,11,0.16)', color: T.gold },
  lawSeverityCritical: { backgroundColor: T.dangerLight, color: T.dangerText },
  emptyQuickText: { fontSize: 13, color: T.ink4, paddingVertical: 18, textAlign: 'center' },

  /* Column layouts */
  twoColRow: { flexDirection: 'row', gap: 20 },
  threeColRow: { flexDirection: 'row', gap: 20 },
  colLarge: { flex: 3 },
  colSmall: { flex: 2 },
  colThird: { flex: 1 },

  /* Modal Layout */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  detailsModalContent: {
    backgroundColor: '#0F1020',
    borderRadius: 24,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: T.lineMid,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: T.lineMid, backgroundColor: 'rgba(138,56,246,0.03)',
  },
  modalTitle: { ...Ty.h3, color: T.ink },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalScroll: { padding: 20 },
  detailsUserInfo: { flexDirection: 'row', alignItems: 'center' },
  detailsUserText: { marginLeft: 16, flex: 1 },
  detailsName: { fontSize: 18, fontWeight: '800', color: T.ink },
  detailsPhone: { fontSize: 14, color: T.ink3, marginTop: 4 },
  divider: { height: 1, backgroundColor: T.lineMid, marginVertical: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: T.violet, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  docItem: { marginBottom: 24 },
  docLabel: { fontSize: 14, fontWeight: '600', color: T.ink, marginBottom: 10 },
  docImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalFooter: {
    flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: T.lineMid,
    backgroundColor: '#0F1020', gap: 12,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  btnReject: { backgroundColor: T.dangerLight },
  btnApprove: { backgroundColor: T.success },
  actionBtnTxt: { fontSize: 15, fontWeight: '700' },
  
  logoutModalContent: {
    backgroundColor: '#0F1020',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  logoutHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  logoutTitle: { fontSize: 18, fontWeight: '800', color: T.ink },
  logoutSub: { fontSize: 14, color: T.ink3, marginBottom: 24, lineHeight: 20 },
  logoutActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelTxt: { color: T.ink3, fontSize: 14, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: T.danger,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

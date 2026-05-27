/**
 * Admin Dashboard — Emergency Coordination Center
 * Responsive layout: Desktop sidebar (>768px) / Mobile drawer (≤768px)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Platform, TextInput, StatusBar, Modal, Animated, Easing, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T, S, Ty } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/AuthContext';
import { useToast } from '../../../../src/components/Toast';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { DesktopSidebar, MobileDrawer } from '../../../../src/features/admin/_components/AdminSidebar';
import {
  HeroCard, StatCard, SectionHeader,
  VerificationCard, ReportCard,
} from '../../../../src/features/admin/_components/AdminDashboardCards';
import { IncidentCenterWorkspace } from '../../../../src/features/admin/_components/IncidentCenterWorkspace';
import { UsersWorkspace } from '../../../../src/features/admin/_components/UsersWorkspace';
import { VerificationsWorkspace } from '../../../../src/features/admin/_components/VerificationsWorkspace';
import { SafePlacesWorkspace } from '../../../../src/features/admin/_components/SafePlacesWorkspace';
import { ReportsWorkspace } from '../../../../src/features/admin/_components/ReportsWorkspace';
import { AdminNotificationsDrawer } from '../../../../src/features/admin/_components/AdminNotificationsDrawer';
import adminService, { type AdminOverview } from '../../../../src/services/adminService';
import { ROLE_DEFAULT_ROUTE } from '../../../../src/constants/routes';

const DESKTOP_BREAKPOINT = 768;

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
  const { signOut, isLoading: authLoading, isSignedIn, role } = useAuth();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [activeMenu, setActiveMenu] = useState('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [ovVerifs, setOvVerifs] = useState<any[]>([]);
  const [ovSafePlaces, setOvSafePlaces] = useState<any[]>([]);
  const [ovReports, setOvReports] = useState<any[]>([]);
  const [globalActionedReports, setGlobalActionedReports] = useState<Record<string, 'DISMISSED' | 'WARNED' | 'BLOCKED'>>({});
  
  const recentReports = ovReports.filter(r => !globalActionedReports[r.id]);

  const [selectedVerif, setSelectedVerif] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { showToast } = useToast();

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
  const handleReportAction = (item: any, action: string) => {
    showToast({ type: 'success', title: 'Action Taken', message: `Report marked as ${action.toLowerCase()}.` });
    setGlobalActionedReports(prev => ({ ...prev, [item.id]: action }));
    setSelectedReport(null);
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
      router.replace((role ? ROLE_DEFAULT_ROUTE[role] : '/(auth)/login') as any);
    }
  }, [authLoading, isSignedIn, role, router, showToast]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const [nextOverview, verifs, safePlaces, reports] = await Promise.all([
        adminService.getOverview(),
        adminService.getVerifications('pending'),
        adminService.getSafePlaces('PENDING'),
        adminService.getReports('PENDING'),
      ]);
      setOverview(nextOverview);
      setOvVerifs(verifs);
      setOvSafePlaces(safePlaces);
      setOvReports(reports);
    } catch (err: any) {
      setOverviewError(err?.message || 'Could not load admin overview.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'ADMIN') loadOverview();
  }, [role, loadOverview]);

  const workspaceOpacity = useRef(new Animated.Value(1)).current;
  const workspaceTranslateX = useRef(new Animated.Value(0)).current;
  const bellScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(bellScale, { toValue: 1.15, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(bellScale, { toValue: 1, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(3000),
      ])
    ).start();
  }, []);

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
    if (activeMenu === key) return;
    
    Animated.parallel([
      Animated.timing(workspaceOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(workspaceTranslateX, { toValue: 20, duration: 150, useNativeDriver: true })
    ]).start(() => {
      setActiveMenu(key);
      setDrawerOpen(false);
      workspaceTranslateX.setValue(-20);
      Animated.parallel([
        Animated.timing(workspaceOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(workspaceTranslateX, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start();
    });
  }, [activeMenu, workspaceOpacity, workspaceTranslateX]);

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
    { label: 'User Reports', value: overview?.totals.userReports ?? 0, icon: 'file-text', color: T.accent, bgColor: T.accentLight },
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

                  {/* Recent Reports */}
                  <View style={[ds.bigCard, isDesktop ? ds.colThird : { marginTop: 20 }]}>
                    <SectionHeader title="Recent User Reports" icon="file-text" onViewAll={() => handleMenuSelect('reports')} />
                    {recentReports.slice(0, 3).map((item) => (
                      <ReportCard key={item.id} item={item} onPress={() => handleMenuSelect('reports')} />
                    ))}
                    {recentReports.length === 0 && <Text style={ds.emptyQuickText}>No pending reports.</Text>}
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
            ) : activeMenu === 'safeplaces' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <SafePlacesWorkspace insetsBottom={insets.bottom} />
              </View>
            ) : activeMenu === 'reports' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <ReportsWorkspace 
                  insetsBottom={insets.bottom} 
                  globalActionedReports={globalActionedReports}
                  setGlobalActionedReports={setGlobalActionedReports}
                />
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

      {/* Report Modal */}
      <Modal visible={!!selectedReport} transparent animationType="slide" onRequestClose={() => setSelectedReport(null)}>
        <View style={ds.modalOverlay}>
          <View style={ds.detailsModalContent}>
            {selectedReport && (
              <>
                <View style={ds.modalHeader}>
                  <Text style={ds.modalTitle}>Report Details</Text>
                  <TouchableOpacity onPress={() => setSelectedReport(null)} style={ds.closeBtn}>
                    <Feather name="x" size={20} color={T.ink3} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={ds.modalScroll}>
                  {/* Reporter & Reported Info */}
                  <View style={ds.usersSection}>
                    <View style={ds.userBox}>
                      <Text style={ds.userLabel}>Reported User</Text>
                      <View style={ds.userRow}>
                        <UserAvatar size={40} />
                        <Text style={ds.userName}>{selectedReport.reported}</Text>
                      </View>
                    </View>
                    
                    <View style={ds.arrowBox}>
                      <Feather name="arrow-left" size={16} color={T.danger} />
                    </View>
                    
                    <View style={ds.userBox}>
                      <Text style={ds.userLabel}>Reported By</Text>
                      <View style={ds.userRow}>
                        <UserAvatar size={40} />
                        <Text style={ds.userName}>{selectedReport.by}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Report Reason & Details */}
                  <View style={ds.repSection}>
                    <Text style={ds.repSectionTitle}>Incident Details</Text>
                    
                    <View style={ds.detailRowCol}>
                      <Text style={ds.detailLbl}>Reason</Text>
                      <Text style={ds.detailValLeft}>{selectedReport.reason}</Text>
                    </View>
                    
                    <View style={ds.detailRow}>
                      <Text style={ds.detailLbl}>Related Incident ID</Text>
                      <Text style={ds.detailValHi}>{selectedReport.incidentId}</Text>
                    </View>
                    
                    <View style={ds.detailRow}>
                      <Text style={ds.detailLbl}>Date</Text>
                      <Text style={ds.detailVal}>{selectedReport.date}</Text>
                    </View>
                  </View>

                  {/* Action Area */}
                  <View style={ds.actionArea}>
                    <View style={ds.actionButtonsColumn}>
                      <TouchableOpacity style={ds.dismissBtn} onPress={() => handleReportAction(selectedReport, 'DISMISSED')} activeOpacity={0.7}>
                        <Feather name="trash-2" size={18} color={T.ink3} />
                        <Text style={ds.dismissTxt}>Dismiss</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={ds.warnBtn} onPress={() => handleReportAction(selectedReport, 'WARNED')} activeOpacity={0.7}>
                        <Feather name="alert-triangle" size={18} color="#E25B3A" />
                        <Text style={ds.warnTxt}>Warn User</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={ds.blockBtn} onPress={() => handleReportAction(selectedReport, 'BLOCKED')} activeOpacity={0.7}>
                        <Feather name="slash" size={18} color="#FFF" />
                        <Text style={ds.blockTxt}>Block User</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
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
  
  // Report Modal Specific Styles
  usersSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.surfaceCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.lineMid },
  userBox: { flex: 1 },
  userLabel: { fontSize: 11, color: T.ink4, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 13, fontWeight: '700', color: T.ink, flex: 1 },
  arrowBox: { width: 30, alignItems: 'center', justifyContent: 'center' },

  repSection: { backgroundColor: T.surfaceCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.lineMid },
  repSectionTitle: { fontSize: 13, fontWeight: '700', color: T.ink4, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  detailRowCol: { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  detailLbl: { fontSize: 13, color: T.ink4 },
  detailVal: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink, textAlign: 'right', paddingLeft: 24 },
  detailValLeft: { fontSize: 14, fontWeight: '600', color: T.ink, textAlign: 'left', marginTop: 8, lineHeight: 20 },
  detailValHi: { flex: 1, fontSize: 14, fontWeight: '700', color: T.violet, textAlign: 'right', paddingLeft: 24 },
  
  actionArea: { marginTop: 10 },
  actionButtonsColumn: { gap: 12 },
  
  dismissBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, paddingVertical: 14, borderRadius: 12 },
  dismissTxt: { fontSize: 15, fontWeight: '700', color: T.ink3 },
  
  warnBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(226,91,58,0.1)', borderWidth: 1, borderColor: 'rgba(226,91,58,0.3)', paddingVertical: 14, borderRadius: 12 },
  warnTxt: { fontSize: 15, fontWeight: '700', color: '#E25B3A' },
  
  blockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.danger, paddingVertical: 14, borderRadius: 12 },
  blockTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  
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

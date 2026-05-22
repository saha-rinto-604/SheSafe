/**
 * Admin Dashboard — Emergency Coordination Center
 * Responsive layout: Desktop sidebar (>768px) / Mobile drawer (≤768px)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Platform, TextInput, StatusBar, Modal, Animated, Easing, useWindowDimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T, S, R, Ty } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/AuthContext';
import { useToast } from '../../../../src/components/Toast';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { DesktopSidebar, MobileDrawer } from '../../../../src/components/admin/AdminSidebar';
import {
  HeroCard, StatCard, STAT_CARDS_DATA, SectionHeader,
  IncidentCard, EscalationCard, VerificationCard, ReportCard,
} from '../../../../src/components/admin/AdminDashboardCards';
import {
  MOCK_INCIDENTS, MOCK_ESCALATIONS, MOCK_VERIFICATIONS, MOCK_REPORTS,
} from '../../../../src/data/adminMockData';
import { IncidentCenterWorkspace } from '../../../../src/components/admin/IncidentCenterWorkspace';
import { UsersWorkspace } from '../../../../src/components/admin/UsersWorkspace';
import { VerificationsWorkspace } from '../../../../src/components/admin/VerificationsWorkspace';
import { SafePlacesWorkspace } from '../../../../src/components/admin/SafePlacesWorkspace';
import { EscalationsWorkspace } from '../../../../src/components/admin/EscalationsWorkspace';
import { ReportsWorkspace } from '../../../../src/components/admin/ReportsWorkspace';
import { AdminNotificationsDrawer } from '../../../../src/components/admin/AdminNotificationsDrawer';

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
          <Text style={th.title}>{isDesktop ? 'Admin Control Center' : 'SheSafe Admin'}</Text>
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
    pointerEvents: 'box-none',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, height: 40, width: 340, gap: 8,
    pointerEvents: 'auto',
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
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [activeMenu, setActiveMenu] = useState('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

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
                <HeroCard onOpenIncidentCenter={() => handleMenuSelect('incidents')} />

                {/* Overview Statistics */}
                <SectionHeader title="Overview Statistics" icon="bar-chart-2" />
                <View style={ds.statsGrid}>
                  {STAT_CARDS_DATA.map((card, i) => (
                    <View key={i} style={{ width: `${Math.floor(100 / cardsPerRow) - 2}%` as any, minWidth: cardMinW - 10 }}>
                      <StatCard {...card} index={i} />
                    </View>
                  ))}
                </View>

                {/* Three Column Layout for Desktop, Stacks on Mobile */}
                <View style={[isDesktop ? ds.threeColRow : undefined, { marginTop: 20 }]}>
                  {/* Police Escalation Requests */}
                  <View style={[ds.bigCard, isDesktop ? ds.colThird : undefined]}>
                    <SectionHeader title="Police Escalations" icon="alert-triangle" />
                    {MOCK_ESCALATIONS.map((item) => (
                      <EscalationCard key={item.incidentId} item={item} />
                    ))}
                  </View>

                  {/* Pending Verifications */}
                  <View style={[ds.bigCard, isDesktop ? ds.colThird : { marginTop: 20 }]}>
                    <SectionHeader title="Pending Verifications" icon="check-circle" />
                    {MOCK_VERIFICATIONS.map((item) => (
                      <VerificationCard key={item.name} item={item} />
                    ))}
                  </View>

                  {/* Recent Reports */}
                  <View style={[ds.bigCard, isDesktop ? ds.colThird : { marginTop: 20 }]}>
                    <SectionHeader title="Recent User Reports" icon="file-text" />
                    {MOCK_REPORTS.map((item) => (
                      <ReportCard key={item.reported} item={item} />
                    ))}
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
            ) : activeMenu === 'escalations' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <EscalationsWorkspace insetsBottom={insets.bottom} />
              </View>
            ) : activeMenu === 'reports' ? (
              <View style={{ flex: 1, padding: 20 }}>
                <ReportsWorkspace insetsBottom={insets.bottom} />
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
    alignItems: 'center',
    padding: 20,
  },
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

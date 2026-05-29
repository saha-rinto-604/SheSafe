/**
 * AdminSidebar — Desktop sidebar + Mobile drawer for the Admin Dashboard.
 * Uses the existing SheSafe design tokens.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, Pressable, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../constants/theme';
import { SIDEBAR_ITEMS, type SidebarItem } from '../_data/adminMockData';
import UserAvatar from '../../../components/shared/UserAvatar';
import SheSafeLogo from '../../../components/SheSafeLogo';
import SheSafeMark from '../../../components/SheSafeMark';

const SIDEBAR_W = 260;
const DRAWER_W_RATIO = 0.78;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type Props = {
  activeKey: string;
  onSelect: (key: string) => void;
  onLogout: () => void;
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
};

/* ── Menu Item ── */
function MenuItem({ item, active, onPress }: { item: SidebarItem; active: boolean; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: active ? 1 : 0,
      duration: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [active]);

  return (
    <TouchableOpacity
      style={[st.menuItem, active && st.menuItemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[st.menuIconBox, active && st.menuIconBoxActive]}>
        <Feather name={item.icon as any} size={18} color={active ? '#FFFFFF' : T.ink4} />
      </View>
      <Text style={[st.menuLabel, active && st.menuLabelActive]}>{item.label}</Text>
      <Animated.View style={[st.activeIndicator, { opacity: fadeAnim }]} />
    </TouchableOpacity>
  );
}

/* ── Sidebar Content (shared between desktop sidebar and mobile drawer) ── */
function SidebarContent({ activeKey, onSelect, onLogout }: Omit<Props, 'isDrawerOpen' | 'onCloseDrawer'>) {
  return (
    <View style={st.sidebarInner}>
      {/* Header */}
      <View style={st.logoArea}>
        <View style={st.logoCircle}>
          <SheSafeMark size={38} />
        </View>
        <View style={st.logoText}>
          <View style={st.logoTitleRow}>
            <SheSafeLogo size={20} />
            <Text style={st.logoTitleSuffix}>Admin</Text>
          </View>
          <Text style={st.logoSub}>Emergency Coordination</Text>
        </View>
      </View>
      <Text style={st.logoMotto}>Monitor incidents, users and approvals</Text>
      <View style={st.divider} />

      {/* Menu */}
      <ScrollView showsVerticalScrollIndicator={false} style={st.menuScroll}>
        {SIDEBAR_ITEMS.map((item) => (
          <MenuItem
            key={item.key}
            item={item}
            active={activeKey === item.key}
            onPress={() => onSelect(item.key)}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={st.divider} />
      <View style={st.footer}>
        <View style={st.footerProfile}>
          <UserAvatar size={36} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={st.footerName}>Admin User</Text>
            <Text style={st.footerRole}>Super Admin</Text>
          </View>
        </View>
        <TouchableOpacity style={st.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={16} color={T.danger} />
          <Text style={st.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Desktop Sidebar ── */
export function DesktopSidebar(props: Omit<Props, 'isDrawerOpen' | 'onCloseDrawer'>) {
  return (
    <View style={st.desktopSidebar}>
      <SidebarContent {...props} />
    </View>
  );
}

/* ── Mobile Drawer ── */
export function MobileDrawer({ isDrawerOpen, onCloseDrawer, ...rest }: Props) {
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const w = Dimensions.get('window').width * DRAWER_W_RATIO;
    if (isDrawerOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -w, duration: 240, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  const drawerWidth = Dimensions.get('window').width * DRAWER_W_RATIO;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCloseDrawer} />
      </Animated.View>
      <Animated.View style={[st.drawer, { width: drawerWidth, transform: [{ translateX: slideAnim }] }]}>
        <SidebarContent {...rest} />
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  /* Desktop Sidebar */
  desktopSidebar: {
    width: SIDEBAR_W,
    backgroundColor: '#0F1020',
    borderRightWidth: 1,
    borderRightColor: 'rgba(138,56,246,0.12)',
  },
  sidebarInner: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },

  /* Logo Area */
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.violetDim,
    borderWidth: 1,
    borderColor: 'rgba(138,56,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { marginLeft: 10, flex: 1 },
  logoTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  logoTitleSuffix: { fontSize: 15, fontWeight: '800', color: T.ink, marginLeft: 5, letterSpacing: 0 },
  logoSub: { fontSize: 11, fontWeight: '500', color: T.violet, marginTop: 1 },
  logoMotto: {
    fontSize: 10,
    color: T.ink4,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
    marginVertical: 8,
  },

  /* Menu */
  menuScroll: { flex: 1, paddingHorizontal: 12 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: 'rgba(138,56,246,0.14)',
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBoxActive: {
    backgroundColor: T.violet,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink3,
    marginLeft: 10,
    flex: 1,
  },
  menuLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: T.violet,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  footerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  footerName: { fontSize: 13, fontWeight: '700', color: T.ink },
  footerRole: { fontSize: 10, color: T.ink4, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: T.dangerLight,
    gap: 6,
  },
  logoutTxt: { fontSize: 12, fontWeight: '700', color: T.danger },

  /* Mobile Drawer */
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0F1020',
    zIndex: 999,
    borderRightWidth: 1,
    borderRightColor: 'rgba(138,56,246,0.15)',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 5, height: 0 } },
      android: { elevation: 20 },
    }),
  },
});

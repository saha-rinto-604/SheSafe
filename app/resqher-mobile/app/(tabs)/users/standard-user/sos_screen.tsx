/**
 * app/(tabs)/users/standard-user/sos_screen.tsx
 * Premium Tactical Command Center — SOS Screen
 * 
 * Features:
 * - Reanimated-powered heartbeat aura (double-pulse rhythm + haptic sync)
 * - Enhanced 24-rule "Encrypted Professional" map style
 * - Custom Electric Violet glow markers (no default Google pins)
 * - LIVE button heartbeat scale sync (1.0 ↔ 1.05)
 * - High-contrast GPS/recenter for low-light accessibility
 * - 60fps native-thread animations throughout
 */

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert,
    Dimensions, StatusBar, Platform,
    Modal, ScrollView, ViewStyle, Image,
} from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withSequence,
    withDelay, withRepeat, Easing as REasing, runOnJS,
    interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Animated as RNAnimated, Easing } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import { G } from '../../../../src/constants/gradients';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import { incidentService } from '../../../../src/services/incidentService';
import { incidentHistory } from '../../../../src/services/incidentHistory';
import { notificationStore } from '../../../../src/services/notificationStore';

// ─────────────────────────────────────────────────────────────────────────────
// PremiumBar — dark glassmorphism surface for header + navbar
// ─────────────────────────────────────────────────────────────────────────────
const PremiumBar = memo(function PremiumBar({
    style, contentStyle, children,
}: {
    style?: ViewStyle | ViewStyle[];
    contentStyle?: ViewStyle;
    children: React.ReactNode;
}) {
    return (
        <View style={[pb.bar, style]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={pb.tint} pointerEvents="none" />
            <View style={[pb.content, contentStyle]}>{children}</View>
        </View>
    );
});

const pb = StyleSheet.create({
    bar: {
        backgroundColor: 'rgba(30,21,58,0.65)',  // T.surfaceBulky at 65% — lets blur show through
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',     // Global 1px white translucent stroke
        overflow: 'hidden',
    },
    tint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: T.surfaceOverlay,  // Violet tint overlay for glass depth
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');

const SOS_BTN_SIZE = 156;
const SOS_WRAP_SIZE = 320;
const ARC_SIZE = SOS_BTN_SIZE + 20;
const ARC_RADIUS = ARC_SIZE / 2;

// CANCEL_DURATION is now loaded from SafetySettings (default 10 sec)
const CANCEL_DURATION_DEFAULT = 10;
const HOLD_MS = 2000;

const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14;
const SOS_BOTTOM = NAV_BOT_OFFSET + NAV_HEIGHT + 28;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.014, longitudeDelta: 0.014,
};

// ─────────────────────────────────────────────────────────────────────────────
// Nav tab definitions — Ionicons
// ─────────────────────────────────────────────────────────────────────────────
const NAV_TABS: {
    id: string;
    label: string;
    iconActive: string;
    iconOutline: string;
}[] = [
        { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline' },
        { id: 'Chat', label: 'Chat', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline' },
        { id: 'Explore', label: 'Explore', iconActive: 'compass', iconOutline: 'compass-outline' },
        { id: 'Medical', label: 'Medical', iconActive: 'medkit', iconOutline: 'medkit-outline' },
    ];

const ACTIVE_COLOR = T.violet;
const INACTIVE_COLOR = T.navIconInactive;  // Global high-contrast token for all pages

// ─────────────────────────────────────────────────────────────────────────────
// Pulse Radar (idle state — locating)
// ─────────────────────────────────────────────────────────────────────────────
const PulseRadar = memo(function PulseRadar() {
    const a0 = useRef(new RNAnimated.Value(0)).current;
    const a1 = useRef(new RNAnimated.Value(0)).current;
    const a2 = useRef(new RNAnimated.Value(0)).current;
    const anims = [a0, a1, a2];

    useEffect(() => {
        anims.forEach((a, i) => {
            const loop = () => {
                a.setValue(0);
                RNAnimated.timing(a, {
                    toValue: 1, duration: 2000,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true, delay: i * 660,
                }).start(() => loop());
            };
            loop();
        });
    }, []);

    return (
        <View style={rdr.wrap} pointerEvents="none">
            {anims.map((a, i) => (
                <RNAnimated.View key={i} style={[rdr.ring, {
                    transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.6] }) }],
                    opacity: a.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.6, 0.25, 0] }),
                }]} />
            ))}
            <View style={rdr.dot} />
            <Text style={rdr.label}>Locating…</Text>
        </View>
    );
});
const rdr = StyleSheet.create({
    wrap: { position: 'absolute', alignSelf: 'center', top: height * 0.3, alignItems: 'center', zIndex: 5 },
    ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: T.brandGlow },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: T.surface },
    label: { marginTop: 14, fontSize: 11, fontWeight: '600', color: T.violet, letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Border Overlay — Reanimated (native thread, 60fps)
// ─────────────────────────────────────────────────────────────────────────────
const EmergencyOverlay = memo(function EmergencyOverlay() {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.08, { duration: 1000, easing: REasing.inOut(REasing.ease) }),
                withTiming(0.30, { duration: 1000, easing: REasing.inOut(REasing.ease) }),
            ),
            -1, // infinite
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, {
                borderWidth: 2.5, borderColor: T.dangerBorder, zIndex: 999,
            }, animStyle]}
        />
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Heartbeat Aura — Reanimated double-pulse + haptic sync
// Rhythm: lub (0.02→0.12) — dub (0.04→0.12) — rest (→0.02)
// Haptics fire on each peak via runOnJS for NFR-006 reliability
// ─────────────────────────────────────────────────────────────────────────────
const fireHapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const HeartbeatAura = memo(function HeartbeatAura() {
    const pulse = useSharedValue(0.02);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                // Lub — first peak
                withTiming(0.12, { duration: 250, easing: REasing.out(REasing.quad) }),
                withTiming(0.04, { duration: 150, easing: REasing.in(REasing.quad) }),
                // Dub — second peak
                withTiming(0.12, { duration: 250, easing: REasing.out(REasing.quad) }),
                // Rest
                withTiming(0.02, { duration: 800, easing: REasing.inOut(REasing.ease) }),
            ),
            -1, // infinite
        );
    }, []);

    const animStyle = useAnimatedStyle(() => {
        // Fire haptics at peaks (opacity > 0.10)
        if (pulse.value > 0.10) {
            runOnJS(fireHapticLight)();
        }
        return {
            opacity: pulse.value,
        };
    });

    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 1 }, animStyle]}>
            <LinearGradient
                colors={G.sosAuraPulse.colors}
                start={G.sosAuraPulse.start}
                end={G.sosAuraPulse.end}
                style={StyleSheet.absoluteFillObject}
            />
        </Animated.View>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom Marker — Electric Violet Glow (idle state)
// Replaces default Google pin with branded glow marker
// ─────────────────────────────────────────────────────────────────────────────
const VioletGlowMarker = memo(function VioletGlowMarker() {
    return (
        <View style={mkr.container}>
            <View style={mkr.outerGlow}>
                <View style={mkr.midRing}>
                    <View style={mkr.innerDot} />
                </View>
            </View>
        </View>
    );
});

const mkr = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center' },
    outerGlow: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(138,56,246,0.30)',
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.50, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 6 },
        }),
    },
    midRing: {
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: T.violet,
        borderWidth: 2.5, borderColor: T.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    innerDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: T.onPrimary,
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// Hold SOS Button — two-semicircle arc progress ring (RN Animated for arc)
// ─────────────────────────────────────────────────────────────────────────────
const HoldSosButton = memo(function HoldSosButton({
    onTrigger,
    onPhaseChange,
}: {
    onTrigger: () => void;
    onPhaseChange?: (phase: 'idle' | 'holding' | 'armed') => void;
}) {
    const progress = useRef(new RNAnimated.Value(0)).current;
    const scale = useRef(new RNAnimated.Value(1)).current;
    const holdRef = useRef<RNAnimated.CompositeAnimation | null>(null);

    const phaseRef = useRef<'idle' | 'holding' | 'armed'>('idle');
    const setPhase = useCallback((next: 'idle' | 'holding' | 'armed') => {
        phaseRef.current = next;
        onPhaseChange?.(next);
    }, [onPhaseChange]);

    const startHold = useCallback(() => {
        setPhase('holding');
        Haptics.selectionAsync();
        RNAnimated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 10 }).start();
        holdRef.current = RNAnimated.timing(progress, {
            toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false,
        });
        holdRef.current.start(({ finished }) => {
            if (finished && phaseRef.current === 'holding') {
                // Armed: user must release to trigger
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setPhase('armed');
            }
        });
    }, [progress, scale, setPhase]);

    const cancelHold = useCallback(() => {
        holdRef.current?.stop();
        setPhase('idle');
        RNAnimated.parallel([
            RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
            RNAnimated.timing(progress, { toValue: 0, duration: 240, useNativeDriver: false }),
        ]).start();
    }, [progress, scale, setPhase]);

    const endHold = useCallback(() => {
        if (phaseRef.current === 'armed') {
            onTrigger();
            progress.setValue(0);
            scale.setValue(1);
            setPhase('idle');
            return;
        }
        cancelHold();
    }, [cancelHold, onTrigger, progress, scale, setPhase]);

    const rightRot = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '180deg', '180deg'], extrapolate: 'clamp' });
    const leftRot = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '0deg', '180deg'], extrapolate: 'clamp' });
    const arcOp = progress.interpolate({ inputRange: [0, 0.03, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });

    return (
        <RNAnimated.View style={{ transform: [{ scale }] }}>
            {/* Arc progress ring */}
            <RNAnimated.View style={[StyleSheet.absoluteFillObject, {
                width: ARC_SIZE, height: ARC_SIZE,
                left: -(ARC_SIZE - SOS_BTN_SIZE) / 2,
                top: -(ARC_SIZE - SOS_BTN_SIZE) / 2,
                opacity: arcOp,
            }]} pointerEvents="none">
                <View style={hs.arcTrack} />
                <View style={[hs.halfClip, hs.rightClip]}>
                    <RNAnimated.View style={[hs.halfFill, hs.rightFill, { transform: [{ rotate: rightRot }] }]} />
                </View>
                <View style={[hs.halfClip, hs.leftClip]}>
                    <RNAnimated.View style={[hs.halfFill, hs.leftFill, { transform: [{ rotate: leftRot }] }]} />
                </View>
            </RNAnimated.View>

            {/* SOS button — Electric Violet gradient with glow */}
            <TouchableOpacity onPressIn={startHold} onPressOut={endHold} activeOpacity={1}>
                <LinearGradient
                    colors={G.sosIdle.colors}
                    start={G.sosIdle.start}
                    end={G.sosIdle.end}
                    style={s.sosBtn}
                >
                    <Text style={s.sosTxt}>SOS</Text>
                </LinearGradient>
            </TouchableOpacity>
        </RNAnimated.View>
    );
});

const hs = StyleSheet.create({
    arcTrack: { position: 'absolute', width: ARC_SIZE, height: ARC_SIZE, borderRadius: ARC_RADIUS, borderWidth: 3.5, borderColor: `${T.violet}30` },
    halfClip: { position: 'absolute', width: ARC_SIZE / 2, height: ARC_SIZE, overflow: 'hidden' },
    rightClip: { left: ARC_SIZE / 2 },
    leftClip: { left: 0 },
    halfFill: { position: 'absolute', width: ARC_SIZE, height: ARC_SIZE, borderRadius: ARC_RADIUS, borderWidth: 3.5, borderColor: T.violet, backgroundColor: 'transparent' },
    rightFill: { left: -ARC_SIZE / 2 },
    leftFill: { left: 0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LIVE SOS Button — Heartbeat scale sync (1.0 ↔ 1.05) via Reanimated
// ─────────────────────────────────────────────────────────────────────────────
const LiveSOSButton = memo(function LiveSOSButton({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
            <View style={[s.sosBtn, s.sosBtnEmg]}>
                <View style={s.sosBtnDangerFill}>
                    <Ionicons name="location-sharp" size={24} color={T.onDanger} />
                    <Text style={s.sosTxt}>LIVE</Text>
                    <Text style={s.sosSubTxt}>TAP TO STOP</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Side Drawer — Feather icons
// ─────────────────────────────────────────────────────────────────────────────
const DRAWER_ITEMS: { icon: React.ComponentProps<typeof Feather>['name']; label: string; danger?: boolean }[] = [
    { icon: 'user', label: 'Edit Profile' },
    { icon: 'phone-call', label: 'Emergency Contacts' },
    { icon: 'shield', label: 'Safety Settings' },
    { icon: 'check-circle', label: 'Volunteer Verification' },
    { icon: 'clock', label: 'Incident History' },
    { icon: 'lock', label: 'Privacy & Security' },
    { icon: 'settings', label: 'Settings' },
    { icon: 'help-circle', label: 'Help & Support' },
    { icon: 'log-out', label: 'Logout', danger: true },
];

const Drawer = memo(function Drawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const slideX = useRef(new RNAnimated.Value(-width * 0.76)).current;
    useEffect(() => {
        RNAnimated.spring(slideX, {
            toValue: visible ? 0 : -width * 0.76,
            useNativeDriver: true, tension: 62, friction: 13,
        }).start();
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={s.drawerOverlay} activeOpacity={1} onPress={onClose} />
            <RNAnimated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
                <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={s.drawerHd}>
                    <View style={s.drawerAvatarRing}><Feather name="shield" size={26} color={T.onPrimary} /></View>
                    <Text style={s.drawerAppName}>ResQher</Text>
                    <Text style={s.drawerSub}>Emergency Assistance Platform</Text>
                </LinearGradient>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    {DRAWER_ITEMS.map((item, i) => (
                        <React.Fragment key={i}>
                            {item.danger && <View style={s.drawerDivider} />}
                            <TouchableOpacity style={s.drawerRow} onPress={onClose} activeOpacity={0.65}>
                                <View style={[s.drawerIconBox, item.danger && s.drawerIconBoxDanger]}>
                                    <Feather name={item.icon} size={18} color={item.danger ? T.danger : T.violet} />
                                </View>
                                <Text style={[s.drawerLabel, item.danger && s.drawerLabelDanger]}>{item.label}</Text>
                                {!item.danger && <Feather name="chevron-right" size={14} color={T.ink4} />}
                            </TouchableOpacity>
                        </React.Fragment>
                    ))}
                </ScrollView>
            </RNAnimated.View>
        </Modal>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// NavTab — icon + underline active indicator
// ─────────────────────────────────────────────────────────────────────────────
const NavTab = memo(function NavTab({
    tab, isActive, onPress,
}: { tab: typeof NAV_TABS[number]; isActive: boolean; onPress: () => void }) {
    const scale = useRef(new RNAnimated.Value(1)).current;

    const handlePress = useCallback(() => {
        RNAnimated.sequence([
            RNAnimated.timing(scale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
            RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 14 }),
        ]).start();
        onPress();
    }, [onPress]);

    return (
        <TouchableOpacity
            style={s.navTab}
            onPress={handlePress}
            activeOpacity={1}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
        >
            <RNAnimated.View style={[s.navTabInner, { transform: [{ scale }] }]}>
                <View style={[s.navIconBox, isActive && s.navIconBoxActive]}>
                    <Ionicons
                        name={(isActive ? tab.iconActive : tab.iconOutline) as any}
                        size={20}
                        color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
                    />
                </View>
                <View style={[s.navUnderline, { backgroundColor: isActive ? ACTIVE_COLOR : 'transparent' }]} />
            </RNAnimated.View>
        </TouchableOpacity>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Live Beacon Marker (emergency state — pulsing red rings)
// ─────────────────────────────────────────────────────────────────────────────
const LiveBeacon = memo(function LiveBeacon() {
    const ring1 = useRef(new RNAnimated.Value(0)).current;
    const ring2 = useRef(new RNAnimated.Value(0)).current;
    useEffect(() => {
        const pulse = (a: RNAnimated.Value, delay: number) => {
            const loop = () => {
                a.setValue(0);
                RNAnimated.timing(a, {
                    toValue: 1, duration: 1600,
                    easing: Easing.out(Easing.ease), useNativeDriver: true, delay,
                }).start(() => loop());
            };
            loop();
        };
        pulse(ring1, 0); pulse(ring2, 700);
    }, []);
    const ringStyle = (a: RNAnimated.Value) => ({
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
        opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.18, 0] }),
    });
    return (
        <View style={lb.wrap}>
            <RNAnimated.View style={[lb.ring, ringStyle(ring1)]} />
            <RNAnimated.View style={[lb.ring, ringStyle(ring2)]} />
            <View style={lb.core}><View style={lb.dot} /></View>
            <Text style={lb.label}>LIVE</Text>
        </View>
    );
});
const lb = StyleSheet.create({
    wrap: { alignItems: 'center' },
    ring: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: T.danger, top: -3 },
    core: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.onDanger },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.onDanger },
    label: { marginTop: 3, fontSize: 8, fontWeight: '800', color: T.danger, letterSpacing: 1.1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen — Premium Tactical Command Center
// ─────────────────────────────────────────────────────────────────────────────
export default function SOSScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Home');
    const [sosActive, setSosActive] = useState(false);
    const [cancelCountdown, setCancelCountdown] = useState(0);
    const [cancelDuration, setCancelDuration] = useState(CANCEL_DURATION_DEFAULT);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready' | 'sharing'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState('');
    const [holdPhase, setHoldPhase] = useState<'idle' | 'holding' | 'armed'>('idle');
    const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
    const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const navigatedRef = useRef(false);
    const isEmergencyLive = sosActive && cancelCountdown === 0;
    const [hasUnreadNotif, setHasUnreadNotif] = useState(false);

    // Load profile picture on screen focus
    useFocusEffect(
        useCallback(() => {
            getUserProfile().then(setProfile);
            notificationStore.getUnreadCount().then(n => setHasUnreadNotif(n > 0));
        }, []),
    );

    // (navigation now happens immediately inside triggerSOS, not here)

    // Load persisted SOS cancel timer setting on mount
    useEffect(() => {
        import('../../../../src/constants/theme').then(() => {
            import('expo-secure-store').then(SecureStore => {
                SecureStore.getItemAsync('resqher_safety_settings_v1').then(raw => {
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed?.sosCancelTimerSec) {
                                setCancelDuration(parsed.sosCancelTimerSec);
                            }
                        } catch { /* use default */ }
                    }
                });
            });
        });
    }, []);

    const handleNavigation = useCallback((tabId: string) => {
        setActiveTab(tabId);
        if (tabId === 'Chat') {
            router.push('/(tabs)/users/standard-user/chat_home');
        } else if (tabId === 'Explore') {
            router.push('/(tabs)/users/standard-user/ExploreScreen');
        } else if (tabId === 'Medical') {
            router.push('/(tabs)/users/standard-user/MedicalDashboard');
        }
    }, [router]);

    // Reset active tab when screen regains focus (e.g. returning from Chat)
    useFocusEffect(
        useCallback(() => {
            setActiveTab('Home');
        }, [])
    );

    // Pulse ring anims (SOS active state — RN Animated for compatibility)
    const p0s = useRef(new RNAnimated.Value(1)).current; const p0o = useRef(new RNAnimated.Value(0)).current;
    const p1s = useRef(new RNAnimated.Value(1)).current; const p1o = useRef(new RNAnimated.Value(0)).current;
    const p2s = useRef(new RNAnimated.Value(1)).current; const p2o = useRef(new RNAnimated.Value(0)).current;
    const pulseAnims = [
        { scale: p0s, op: p0o },
        { scale: p1s, op: p1o },
        { scale: p2s, op: p2o },
    ];

    // Location
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { Alert.alert('Location required', 'Please grant location access.'); return; }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = pos.coords;
            setUserLoc({ latitude, longitude });
            setTimeout(() => mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 800), 600);
            setLocationStatus('ready');
            try {
                const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geo.length > 0) {
                    const g = geo[0];
                    setAddress([g.street, g.district ?? g.subregion, g.city ?? g.region].filter(Boolean).join(', ') || 'Current location');
                }
            } catch { setAddress('Current location'); }
        })();
    }, []);

    // Pulse rings loop
    useEffect(() => {
        pulseAnims.forEach(({ scale, op }, i) => {
            const loop = () => {
                scale.setValue(1); op.setValue(0.55);
                RNAnimated.parallel([
                    RNAnimated.timing(scale, { toValue: 1.6, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    RNAnimated.timing(op, { toValue: 0, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                ]).start(() => loop());
            };
            setTimeout(loop, i * 700);
        });
    }, []);

    // SOS logic — create incident and start cancel countdown;
    // navigation to chat room happens after the countdown expires (see useEffect below)
    const triggerSOS = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setHoldPhase('idle');
        setSosActive(true); setLocationStatus('sharing'); setCancelCountdown(cancelDuration);
        navigatedRef.current = false;

        const lat = userLoc?.latitude;
        const lng = userLoc?.longitude;

        if (lat && lng) {
            incidentService.createIncident({ latitude: lat, longitude: lng, address: address || undefined })
                .then(async (incident) => {
                    const id = String(incident.id);
                    setActiveIncidentId(id);
                    const SecureStore = await import('expo-secure-store');
                    const raw = await SecureStore.getItemAsync('resqher_sos_count_v1');
                    const displayNumber = raw ? parseInt(raw, 10) + 1 : 1;
                    await SecureStore.setItemAsync('resqher_sos_count_v1', String(displayNumber));
                    const createdAt = new Date().toISOString();
                    await SecureStore.setItemAsync('resqher_active_sos_v1', JSON.stringify({
                        incidentId: id, displayNumber, lat, lng, address: address || '',
                        createdAt,
                    }));
                    await incidentHistory.add({
                        incidentId: id, displayNumber, lat, lng,
                        address: address || '', createdAt, status: 'ACTIVE',
                    });
                    await notificationStore.add({
                        type: 'sos_triggered',
                        title: 'SOS Alert Sent',
                        body: `Emergency alert triggered at ${address || 'your location'}`,
                        incidentId: id,
                    });
                })
                .catch(async () => {
                    const id = `temp-${Date.now()}`;
                    setActiveIncidentId(id);
                    const SecureStore = await import('expo-secure-store');
                    const raw = await SecureStore.getItemAsync('resqher_sos_count_v1');
                    const displayNumber = raw ? parseInt(raw, 10) + 1 : 1;
                    await SecureStore.setItemAsync('resqher_sos_count_v1', String(displayNumber));
                    const createdAt = new Date().toISOString();
                    await SecureStore.setItemAsync('resqher_active_sos_v1', JSON.stringify({
                        incidentId: id, displayNumber, lat, lng, address: address || '',
                        createdAt,
                    }));
                    await incidentHistory.add({
                        incidentId: id, displayNumber, lat, lng,
                        address: address || '', createdAt, status: 'ACTIVE',
                    });
                    await notificationStore.add({
                        type: 'sos_triggered',
                        title: 'SOS Alert Sent',
                        body: `Emergency alert triggered at ${address || 'your location'}`,
                        incidentId: id,
                    });
                });
        } else {
            const id = 'sos-new';
            setActiveIncidentId(id);
            (async () => {
                const SecureStore = await import('expo-secure-store');
                const raw = await SecureStore.getItemAsync('resqher_sos_count_v1');
                const displayNumber = raw ? parseInt(raw, 10) + 1 : 1;
                await SecureStore.setItemAsync('resqher_sos_count_v1', String(displayNumber));
                await SecureStore.setItemAsync('resqher_active_sos_v1', JSON.stringify({
                    incidentId: id, displayNumber, lat: null, lng: null, address: '',
                    createdAt,
                }));
                await incidentHistory.add({
                    incidentId: id, displayNumber, lat: null, lng: null,
                    address: '', createdAt, status: 'ACTIVE',
                });
                await notificationStore.add({
                    type: 'sos_triggered',
                    title: 'SOS Alert Sent',
                    body: 'Emergency alert triggered (location unavailable)',
                    incidentId: id,
                });
            })();
        }
    }, [cancelDuration, userLoc, address]);

    useEffect(() => {
        if (!sosActive || cancelCountdown <= 0) return;
        cancelTimerRef.current = setInterval(() => {
            setCancelCountdown(prev => {
                if (prev <= 1) { clearInterval(cancelTimerRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => { if (cancelTimerRef.current) clearInterval(cancelTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sosActive, cancelCountdown === cancelDuration]);

    // Navigate to chat room once the cancel window expires and SOS is still active
    useEffect(() => {
        if (!isEmergencyLive || navigatedRef.current) return;
        navigatedRef.current = true;
        const lat = userLoc?.latitude;
        const lng = userLoc?.longitude;
        const incId = activeIncidentId ?? `temp-${Date.now()}`;
        router.replace({
            pathname: '/(tabs)/users/standard-user/chat_room',
            params: {
                incidentId: incId,
                autoMessage: 'true',
                ...(lat && lng ? { userLat: String(lat), userLng: String(lng) } : {}),
                userAddress: address || '',
            },
        } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEmergencyLive, activeIncidentId]);

    const cancelSOS = useCallback(() => {
        navigatedRef.current = false;
        setSosActive(false); setCancelCountdown(0); setLocationStatus('ready');
        setHoldPhase('idle');
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
        import('expo-secure-store').then(SecureStore => SecureStore.deleteItemAsync('resqher_active_sos_v1'));
        if (activeIncidentId) {
            incidentService.cancelIncident(activeIncidentId).catch(() => {});
            setActiveIncidentId(null);
        }
    }, [activeIncidentId]);

    const confirmStop = useCallback(() => {
        Alert.alert('Stop Emergency Alert?', 'Your location will no longer be shared.', [
            { text: 'Keep Active', style: 'cancel' },
            { text: 'Stop Alert', style: 'destructive', onPress: cancelSOS },
        ]);
    }, [cancelSOS]);

    const goToMyLoc = () => {
        if (userLoc) mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600);
    };

    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    // SOS overlay placement: below map center (thumb-reachable) and clamped
    const targetCenterY = height * 0.62;
    const headerSafeTop = insets.top + 120;
    const bottomSafe = navBottom + NAV_HEIGHT + 18;
    const extraBelowWrap = 76; // status pill + spacing
    const maxTop = Math.max(headerSafeTop, height - bottomSafe - (SOS_WRAP_SIZE + extraBelowWrap));
    const sosTop = Math.min(Math.max(targetCenterY - SOS_WRAP_SIZE / 2, headerSafeTop), maxTop);

    return (
        <AtmosphericShell>
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            {/* Live-state overlays removed (keep ring pulse only) */}
            <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

            {/* Map — Encrypted Professional Dark Tactical Style */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                initialRegion={DEFAULT_REGION}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={false}
                moveOnMarkerPress={false}
                customMapStyle={TACTICAL_MAP_STYLE}
            >
                {userLoc && !isEmergencyLive && (
                    <Marker coordinate={userLoc} tracksViewChanges={false}>
                        <VioletGlowMarker />
                    </Marker>
                )}
                {userLoc && isEmergencyLive && (
                    <Marker coordinate={userLoc} tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
                        <LiveBeacon />
                    </Marker>
                )}
            </MapView>

            {locationStatus === 'idle' && <PulseRadar />}

            {/* ── Header ─────────────────────────────────────────────────── */}
            <PremiumBar
                style={[s.header, { top: insets.top + 8 }]}
                contentStyle={s.headerContent}
            >
                <View style={s.locBox}>
                    <Text style={s.locLabel}>CURRENT LOCATION</Text>
                    {locationStatus === 'idle'
                        ? <View style={s.shimmer} />
                        : <Text style={s.locAddr} numberOfLines={1}>{address}</Text>
                    }
                </View>
                <View style={s.headerBtns}>
                    <TouchableOpacity
                        style={s.hBtn}
                        onPress={() => router.push('/(tabs)/users/standard-user/notifications')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="notifications-outline" size={20} color={T.onPrimary} />
                        {hasUnreadNotif && <View style={s.notifDot} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={s.profileBtn}
                        onPress={() => router.push('/(tabs)/users/standard-user/profile-menu')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Open profile menu"
                        accessibilityRole="button"
                    >
                        {profile?.photoUri ? (
                            <Image source={{ uri: profile.photoUri }} style={s.profileAvatar} />
                        ) : (
                            <Image
                                source={{ uri: 'https://i.pravatar.cc/150?img=47&u=demo-female' }}
                                style={s.profileAvatar}
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </PremiumBar>

            {/* ── 12px Breathing Space Spacer ──────────────────────────────── */}
            <View style={{ marginTop: 12 }} />

            {/* ── Map controls — High contrast GPS/Recenter ───────────────── */}
            <View style={[s.mapControls, { bottom: insets.bottom + SOS_BOTTOM + SOS_WRAP_SIZE - 10 }]}>
                <View style={[s.gpsPill, isEmergencyLive && s.gpsPillEmg]}>
                    <View style={[s.gpsDot, {
                        backgroundColor:
                            locationStatus === 'sharing' ? T.danger :
                                locationStatus === 'ready' ? T.success : T.ink4,
                    }]} />
                    <Text style={[s.gpsTxt, isEmergencyLive && s.gpsTxtEmg]}>
                        {locationStatus !== 'idle' ? 'GPS' : '…'}
                    </Text>
                </View>
                <TouchableOpacity style={s.ctrlBtn} onPress={goToMyLoc} accessibilityLabel="Recenter map" accessibilityRole="button">
                    <Ionicons name="locate-outline" size={22} color={T.onPrimary} />
                </TouchableOpacity>
            </View>

            {/* ── SOS Section ─────────────────────────────────────────────── */}
            <View
                pointerEvents="box-none"
                style={[s.sosSection, { top: sosTop }]}
            >
                <View style={s.sosWrap}>
                    {sosActive && cancelCountdown > 0 ? (
                        <TouchableOpacity onPress={cancelSOS} activeOpacity={0.88}>
                            <View style={s.cancelBtn}>
                                <Text style={s.cancelLabel}>CANCEL</Text>
                                <Text style={s.cancelCount}>{cancelCountdown}s</Text>
                                <Text style={s.cancelSub}>Tap to cancel</Text>
                            </View>
                        </TouchableOpacity>
                    ) : isEmergencyLive ? (
                        <LiveSOSButton onPress={confirmStop} />
                    ) : (
                        <HoldSosButton onTrigger={triggerSOS} onPhaseChange={setHoldPhase} />
                    )}

                    {sosActive && pulseAnims.map(({ scale, op }, i) => (
                        <RNAnimated.View key={i} pointerEvents="none" style={[s.pulseRing, {
                            transform: [{ scale }], opacity: op,
                            borderColor: isEmergencyLive ? `${T.danger}73` : G.sosRingDefault,
                        }]} />
                    ))}
                </View>

                {!sosActive && (
                    <View style={s.statusPill}>
                        <Text style={s.pillTxt}>
                            {holdPhase === 'idle'
                                ? 'Press and hold for 2 sec'
                                : holdPhase === 'holding'
                                    ? 'Holding...'
                                    : 'Release'
                            }
                        </Text>
                    </View>
                )}
                {sosActive && (
                    <View style={[s.statusPill, isEmergencyLive && s.statusPillLive]}>
                        <View style={[s.pillDot, { backgroundColor: T.danger }]} />
                        <Text style={[s.pillTxt, isEmergencyLive && s.pillTxtLive]}>
                            {cancelCountdown > 0
                                ? `Alert triggered · Cancel in ${cancelCountdown}s`
                                : 'Sharing your location'
                            }
                        </Text>
                    </View>
                )}
            </View>

            {/* ── Bottom Navbar ─────────────────────────────────────────── */}
            <View style={[s.navWrap, { bottom: navBottom }]} pointerEvents="box-none">
                <PremiumBar style={s.navBar} contentStyle={s.navBarContent}>
                    {NAV_TABS.map(tab => (
                        <NavTab
                            key={tab.id}
                            tab={tab}
                            isActive={activeTab === tab.id}
                            onPress={() => handleNavigation(tab.id)}
                        />
                    ))}
                </PremiumBar>
            </View>
        </View>
        </AtmosphericShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tactical Map Style — dark blue-charcoal base, visible hierarchy
// ─────────────────────────────────────────────────────────────────────────────
const TACTICAL_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#0A0A0C' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6B7A8D' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0C' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a0d' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C2333' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0A0A0C' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a6a7a' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e2530' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C3E58' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1f2a' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8090a8' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07070A' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a4060' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1f2a' }] },
    { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#4a5a70' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#6a7a90' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet — Premium Tactical Command Center
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#090514' },  // Matches AtmosphericShell gradient end

    header: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: 28,  // Bulky Glass Mandate — matches Hub cards
        zIndex: 300,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    profileBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 6, shadowColor: '#8A38F6' },
        }),
    },
    profileAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    headerContent: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingVertical: 11,
    },
    locBox: { flex: 1, marginRight: S.s3 },
    locLabel: { fontSize: 8.5, fontWeight: '800', color: T.ink4, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 1 },
    locAddr: { fontSize: 13, fontWeight: '600', color: T.ink, letterSpacing: -0.1 },
    shimmer: { height: 11, width: '68%', borderRadius: R.xs, backgroundColor: T.lineMid, marginTop: 2 },

    liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.dangerBg, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.dangerBorder, marginRight: S.s2 },
    liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.danger },
    liveChipTxt: { fontSize: 10, fontWeight: '800', color: T.dangerText, letterSpacing: 1.2 },

    headerBtns: { flexDirection: 'row', gap: S.s2, alignItems: 'center' },
    hBtn: {
        width: 36, height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    notifDot: {
        position: 'absolute', top: 7, right: 7,
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface,
    },

    mapControls: { position: 'absolute', right: 20, top: '35%', gap: 8, alignItems: 'flex-end', zIndex: 290 },
    gpsPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    gpsPillEmg: { backgroundColor: T.dangerLight, borderColor: T.dangerBorder },
    gpsDot: { width: 6, height: 6, borderRadius: 3 },
    gpsTxt: { fontSize: 10, fontWeight: '700', color: T.ink2, letterSpacing: 0.5 },
    gpsTxtEmg: { color: T.dangerText },
    ctrlBtn: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: T.surfaceBulky,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },

    markerOut: { width: 26, height: 26, borderRadius: 13, backgroundColor: T.brandGlow, alignItems: 'center', justifyContent: 'center' },
    markerIn: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: T.surface },

    sosSection: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
    sosWrap: { width: SOS_WRAP_SIZE, height: SOS_WRAP_SIZE, alignItems: 'center', justifyContent: 'center' },
    pulseRing: {
        position: 'absolute',
        width: SOS_BTN_SIZE,
        height: SOS_BTN_SIZE,
        borderRadius: SOS_BTN_SIZE / 2,
        borderWidth: 2.5,
    },

    sosBtn: {
        width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.40, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 12 },
        }),
    },
    sosBtnEmg: {
        ...Platform.select({
            ios: { shadowColor: '#E23636', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 12 },
        }),
    },
    sosBtnDangerFill: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: SOS_BTN_SIZE / 2,
        backgroundColor: '#D92D20',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },

    sosTxt: { color: T.onPrimary, fontSize: 38, fontWeight: '900', letterSpacing: 1.5 },
    sosSubTxt: { color: `${T.onPrimary}B3`, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4 },

    cancelBtn: {
        width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2,
        backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#E23636', shadowOpacity: 0.20, shadowRadius: 18, shadowOffset: { width: 0, height: 5 } },
            android: { elevation: 10 },
        }),
    },
    cancelLabel: { color: T.ink3, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
    cancelCount: { color: T.danger, fontSize: 48, fontWeight: '900', lineHeight: 52 },
    cancelSub: { color: T.ink4, fontSize: 12, fontWeight: '700', marginTop: 3 },

    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.full,
        paddingHorizontal: 16, paddingVertical: 8, marginTop: 22,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 3 },
        }),
    },
    statusPillLive: {
        backgroundColor: T.dangerBg,
        borderColor: T.dangerBorder,
    },
    pillDot: { width: 7, height: 7, borderRadius: 3.5 },
    pillTxt: { fontSize: 12, fontWeight: '700', color: T.ink3, letterSpacing: 0.4, textTransform: 'uppercase' },
    pillTxtLive: { color: T.dangerText },

    navWrap: {
        position: 'absolute',
        left: 0, right: 0,
        alignItems: 'center',
        zIndex: 200,
    },
    navBar: {
        width: width * 0.88,
        borderRadius: R.pill,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    navBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    navTab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    navTabInner: {
        alignItems: 'center',
        gap: 0,
    },
    navUnderline: {
        width: 16, height: 3,
        borderRadius: 1.5,
        marginTop: 5,
    },
    navIconBox: {
        width: 36, height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    navIconBoxActive: {
        backgroundColor: 'rgba(138,56,246,0.12)',
        borderColor: `${T.violet}40`,
    },

    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
    drawer: {
        position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.76,
        backgroundColor: T.surface,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 28, shadowOffset: { width: 4, height: 0 } },
            android: { elevation: 20 },
        }),
    },
    drawerHd: { paddingTop: 52, paddingBottom: 26, paddingHorizontal: 20 },
    drawerAvatarRing: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: `${T.onPrimary}2E`, borderWidth: 2, borderColor: `${T.onPrimary}47`,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    drawerAppName: { color: T.onPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
    drawerSub: { color: `${T.onPrimary}A6`, fontSize: 12, marginTop: 2, fontWeight: '500' },
    drawerRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.lineMid,
    },
    drawerIconBox: { width: 36, height: 36, borderRadius: R.sm, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    drawerIconBoxDanger: { backgroundColor: `${T.danger}18` },
    drawerLabel: { flex: 1, fontSize: 14, color: T.ink, fontWeight: '600' },
    drawerLabelDanger: { color: T.danger },
    drawerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: T.lineMid, marginHorizontal: 18, marginVertical: 6 },
});

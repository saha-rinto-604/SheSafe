/**
 * app/(tabs)/users/standard-user/sos_screen.tsx
 * Premium Tactical Command Center - SOS Screen
 *
 * Features:
 * - Reanimated-powered heartbeat aura (double-pulse rhythm + haptic sync)
 * - Enhanced 24-rule "Encrypted Professional" map style
 * - Custom Electric Violet glow markers (no default Google pins)
 * - LIVE button heartbeat scale sync (1.0 <-> 1.05)
 * - High-contrast GPS/recenter for low-light accessibility
 * - 60fps native-thread animations throughout
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, StatusBar, Platform,
    Modal, ScrollView, ViewStyle, TextInput, ActivityIndicator,
    AppState,
 Animated as RNAnimated, Easing } from 'react-native';
import { useAuth } from '../../../../src/context/AuthContext';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withSequence,
    withRepeat, Easing as REasing, runOnJS,
} from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_GOOGLE, type MapViewRef } from '../../../../src/components/shared/MapViewCompat';
import { useMapRenderDiagnostics } from '../../../../src/components/shared/MapRenderDiagnostics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather , Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import { G } from '../../../../src/constants/gradients';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import SheSafeLogo from '../../../../src/components/SheSafeLogo';
import SheSafeMark from '../../../../src/components/SheSafeMark';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import { incidentService } from '../../../../src/services/incidentService';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { incidentHistory } from '../../../../src/services/incidentHistory';
import { notificationStore, subscribeUnread } from '../../../../src/services/notificationStore';
import AICopilotFloatingButton from '../../../../components/AICopilotFloatingButton';

// -----------------------------------------------------------------------------
// PremiumBar - dark glassmorphism surface for header + navbar
// -----------------------------------------------------------------------------
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
        backgroundColor: 'rgba(30,21,58,0.65)',  // T.surfaceBulky at 65% - lets blur show through
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',     // Global 1px white translucent stroke
        overflow: 'hidden',
    },
    tint: {
        ...StyleSheet.absoluteFill,
        backgroundColor: T.surfaceOverlay,  // Violet tint overlay for glass depth
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

// -----------------------------------------------------------------------------
// Layout constants
// -----------------------------------------------------------------------------
const { width, height } = Dimensions.get('window');

const SOS_BTN_SIZE = 156;
const SOS_WRAP_SIZE = 320;
const ARC_SIZE = SOS_BTN_SIZE + 20;
const ARC_RADIUS = ARC_SIZE / 2;

// CANCEL_DURATION is now loaded from SafetySettings (default 10 sec)
const CANCEL_DURATION_DEFAULT = 10;
const HOLD_MS = 2000;

const NAV_HEIGHT = 58;
const ACTIVE_SOS_STATUSES = new Set(['ACTIVE', 'LIVE', 'IN_PROGRESS', 'ACCEPTED', 'ASSISTING']);

type ReviewVolunteer = {
    id: string;
    name: string;
    avatarUri: string | null;
};

function isUsableVolunteerId(value: unknown) {
    const id = String(value ?? '').trim();
    return !!id && id !== 'undefined' && id !== 'null' && id !== 'NaN';
}

function isLiveSosStatus(status: unknown) {
    const normalized = String(status || '').trim().toUpperCase().replace(/\s+/g, '_');
    return ACTIVE_SOS_STATUSES.has(normalized);
}

function reviewDisplayName(volunteer: any) {
    const username = String(volunteer?.username || '').trim();
    if (username) return username.startsWith('@') ? username : `@${username}`;
    const name = String(volunteer?.name || '').trim();
    if (name) return name;
    const fullName = [volunteer?.firstName ?? volunteer?.first_name, volunteer?.lastName ?? volunteer?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
    return fullName || 'Volunteer';
}

function buildReviewQueue(responders: any): ReviewVolunteer[] {
    const volunteers = Array.isArray(responders?.volunteers) ? responders.volunteers : [];
    const reviewed = new Set((Array.isArray(responders?.reviewedVolunteerIds) ? responders.reviewedVolunteerIds : []).map((id: unknown) => String(id)));
    const seen = new Set<string>();
    const queue: ReviewVolunteer[] = [];

    for (const volunteer of volunteers) {
        const id = String(volunteer?.id ?? volunteer?.volunteerId ?? volunteer?.userId ?? '').trim();
        if (!isUsableVolunteerId(id) || seen.has(id) || reviewed.has(id) || volunteer?.alreadyReviewed) continue;
        const role = String(volunteer?.role || 'volunteer').toLowerCase();
        if (role && role !== 'volunteer') continue;
        seen.add(id);
        queue.push({
            id,
            name: reviewDisplayName(volunteer),
            avatarUri: volunteer?.photoUri ?? volunteer?.profile_image ?? volunteer?.photo_url ?? volunteer?.avatarUri ?? null,
        });
    }

    return queue;
}

const NAV_BOT_OFFSET = 14;
const SOS_BOTTOM = NAV_BOT_OFFSET + NAV_HEIGHT + 28;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.014, longitudeDelta: 0.014,
};

// -----------------------------------------------------------------------------
// Nav tab definitions - Ionicons
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Pulse Radar (idle state - locating)
// -----------------------------------------------------------------------------
const PulseRadar = memo(function PulseRadar() {
    const [a0] = useState(() => new RNAnimated.Value(0));
    const [a1] = useState(() => new RNAnimated.Value(0));
    const [a2] = useState(() => new RNAnimated.Value(0));
    const anims = useMemo(() => [a0, a1, a2], [a0, a1, a2]);

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
    }, [anims]);

    return (
        <View style={rdr.wrap} pointerEvents="none">
            {anims.map((a, i) => (
                <RNAnimated.View key={i} style={[rdr.ring, {
                    transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.6] }) }],
                    opacity: a.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.6, 0.25, 0] }),
                }]} />
            ))}
            <View style={rdr.dot} />
            <Text style={rdr.label}>Locating...</Text>
        </View>
    );
});
const rdr = StyleSheet.create({
    wrap: { position: 'absolute', alignSelf: 'center', top: height * 0.3, alignItems: 'center', zIndex: 5 },
    ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: T.brandGlow, overflow: 'hidden' },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: T.surface, overflow: 'hidden' },
    label: { marginTop: 14, fontSize: 11, fontWeight: '600', color: T.violet, letterSpacing: 0.3 },
});

// -----------------------------------------------------------------------------
// Emergency Border Overlay - Reanimated (native thread, 60fps)
// -----------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    }, [opacity]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, {
                borderWidth: 2.5, borderColor: T.dangerBorder, zIndex: 999,
            }, animStyle]}
        />
    );
});

// -----------------------------------------------------------------------------
// Emergency Heartbeat Aura - Reanimated double-pulse + haptic sync
// Rhythm: lub (0.02->0.12) - dub (0.04->0.12) - rest (->0.02)
// Haptics fire on each peak via runOnJS for NFR-006 reliability
// -----------------------------------------------------------------------------
const fireHapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const HeartbeatAura = memo(function HeartbeatAura() {
    const pulse = useSharedValue(0.02);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                // Lub - first peak
                withTiming(0.12, { duration: 250, easing: REasing.out(REasing.quad) }),
                withTiming(0.04, { duration: 150, easing: REasing.in(REasing.quad) }),
                // Dub - second peak
                withTiming(0.12, { duration: 250, easing: REasing.out(REasing.quad) }),
                // Rest
                withTiming(0.02, { duration: 800, easing: REasing.inOut(REasing.ease) }),
            ),
            -1, // infinite
        );
    }, [pulse]);

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
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 1 }, animStyle]}>
            <LinearGradient
                colors={G.sosAuraPulse.colors}
                start={G.sosAuraPulse.start}
                end={G.sosAuraPulse.end}
                style={StyleSheet.absoluteFill}
            />
        </Animated.View>
    );
});

// -----------------------------------------------------------------------------
// Custom Marker - Electric Violet Glow (idle state)
// Replaces default Google pin with branded glow marker
// -----------------------------------------------------------------------------
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
        overflow: 'hidden',
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
        overflow: 'hidden',
    },
    innerDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: T.onPrimary,
        overflow: 'hidden',
    },
});

// -----------------------------------------------------------------------------
// Hold SOS Button - two-semicircle arc progress ring (RN Animated for arc)
// -----------------------------------------------------------------------------
const HoldSosButton = memo(function HoldSosButton({
    onTrigger,
    onPhaseChange,
}: {
    onTrigger: () => void;
    onPhaseChange?: (phase: 'idle' | 'holding' | 'armed') => void;
}) {
    const [progress] = useState(() => new RNAnimated.Value(0));
    const [scale] = useState(() => new RNAnimated.Value(1));
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
            <RNAnimated.View style={[StyleSheet.absoluteFill, {
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

            {/* SOS button - Electric Violet gradient with glow */}
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

// -----------------------------------------------------------------------------
// LIVE SOS Button - Heartbeat scale sync (1.0 <-> 1.05) via Reanimated
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Side Drawer - Feather icons
// -----------------------------------------------------------------------------
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

const Drawer = memo(function Drawer({
    visible, onClose, onLogoutRequest, onNavigate,
}: {
    visible: boolean;
    onClose: () => void;
    onLogoutRequest: () => void;
    onNavigate: (label: string) => void;
}) {
    const [slideX] = useState(() => new RNAnimated.Value(-width * 0.76));
    useEffect(() => {
        RNAnimated.spring(slideX, {
            toValue: visible ? 0 : -width * 0.76,
            useNativeDriver: true, tension: 62, friction: 13,
        }).start();
    }, [slideX, visible]);

    const handleItem = useCallback((item: typeof DRAWER_ITEMS[number]) => {
        if (item.danger) {
            onClose();
            onLogoutRequest();
        } else {
            onClose();
            onNavigate(item.label);
        }
    }, [onClose, onLogoutRequest, onNavigate]);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={s.drawerOverlay} activeOpacity={1} onPress={onClose} />
            <RNAnimated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
                <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={s.drawerHd}>
                    <View style={s.drawerAvatarRing}><SheSafeMark size={50} /></View>
                    <SheSafeLogo size={26} center />
                    <Text style={s.drawerSub}>Emergency Assistance Platform</Text>
                </LinearGradient>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    {DRAWER_ITEMS.map((item, i) => (
                        <React.Fragment key={i}>
                            {item.danger && <View style={s.drawerDivider} />}
                            <TouchableOpacity style={s.drawerRow} onPress={() => handleItem(item)} activeOpacity={0.65}>
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

// -----------------------------------------------------------------------------
// NavTab - icon + underline active indicator
// -----------------------------------------------------------------------------
const NavTab = memo(function NavTab({
    tab, isActive, onPress,
}: { tab: typeof NAV_TABS[number]; isActive: boolean; onPress: () => void }) {
    const [scale] = useState(() => new RNAnimated.Value(1));

    const handlePress = useCallback(() => {
        RNAnimated.sequence([
            RNAnimated.timing(scale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
            RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 14 }),
        ]).start();
        onPress();
    }, [onPress, scale]);

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

// -----------------------------------------------------------------------------
// Live Beacon Marker (emergency state - pulsing red rings)
// -----------------------------------------------------------------------------
const LiveBeacon = memo(function LiveBeacon() {
    const [ring1] = useState(() => new RNAnimated.Value(0));
    const [ring2] = useState(() => new RNAnimated.Value(0));
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
    }, [ring1, ring2]);
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
    ring: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: T.danger, top: -3, overflow: 'hidden' },
    core: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.onDanger, overflow: 'hidden' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.onDanger, overflow: 'hidden' },
    label: { marginTop: 3, fontSize: 8, fontWeight: '800', color: T.danger, letterSpacing: 1.1 },
});

// -----------------------------------------------------------------------------
// Main Screen - Premium Tactical Command Center
// -----------------------------------------------------------------------------
export default function SOSScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapViewRef>(null);
    const isMountedRef = useRef(true);
    const { signOut, setSosLive, isSosLive } = useAuth();

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
    const sosCreateSeqRef = useRef(0);
    const activeSosHydrateSeqRef = useRef(0);
    const isEmergencyLive = sosActive && cancelCountdown === 0;
    const [hasUnreadNotif, setHasUnreadNotif] = useState(false);
    const [endSosModalVisible, setEndSosModalVisible] = useState(false);
    const [logoutBlockModalVisible, setLogoutBlockModalVisible] = useState(false);
    const [deactivateSheetVisible, setDeactivateSheetVisible] = useState(false);
    const [stopConfirmMode, setStopConfirmMode] = useState<'cancel' | 'resolve'>('cancel');

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Review Popup States
    const [reviewVisible, setReviewVisible] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewQueue, setReviewQueue] = useState<ReviewVolunteer[]>([]);
    const [reviewIncidentId, setReviewIncidentId] = useState<string | null>(null);
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewRemovingId, setReviewRemovingId] = useState<string | null>(null);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewExitAnim] = useState(() => new RNAnimated.Value(0));

    // Load profile picture on screen focus
    useFocusEffect(
        useCallback(() => {
            getUserProfile().then(setProfile);
        }, []),
    );

    // Subscribe to unread count so the red dot updates in real-time.
    useEffect(() => {
        const unsub = subscribeUnread(count => setHasUnreadNotif(count > 0));
        // Initialise the cache if it hasn't been loaded yet.
        notificationStore.getUnreadCount().catch(() => {});
        return unsub;
    }, []);

    // (navigation now happens immediately inside triggerSOS, not here)

    const applyActiveStandardSos = useCallback(async (incident: any, options?: { showNotice?: boolean }) => {
        const id = String(incident?.incidentId ?? incident?.id ?? '').trim();
        if (!id || !isLiveSosStatus(incident?.status)) return false;

        const lat = incident.latitude == null ? null : Number(incident.latitude);
        const lng = incident.longitude == null ? null : Number(incident.longitude);
        navigatedRef.current = true;
        setActiveIncidentId(id);
        setSosActive(true);
        setCancelCountdown(0);
        setLocationStatus('sharing');
        setHoldPhase('idle');
        setSosLive(true);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setUserLoc(prev => prev ?? { latitude: lat as number, longitude: lng as number });
        }
        if (incident.address) {
            setAddress(prev => prev || String(incident.address));
        }

        try {
            const SecureStore = await import('expo-secure-store');
            await SecureStore.setItemAsync('resqher_active_sos_v1', JSON.stringify({
                incidentId: id,
                displayNumber: Number(id),
                lat,
                lng,
                address: incident.address || '',
                createdAt: incident.createdAt || new Date().toISOString(),
            }));
        } catch { /* cache write is best-effort */ }

        if (options?.showNotice) {
            notificationStore.add({
                type: 'sos_triggered',
                title: 'Your SOS is still active',
                body: 'SheSafe restored your live emergency state from the server.',
                incidentId: id,
                createdAt: new Date().toISOString(),
            }).catch(() => undefined);
        }
        return true;
    }, [setSosLive]);

    const clearRestoredStandardSos = useCallback(async () => {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.deleteItemAsync('resqher_active_sos_v1');
        await SecureStore.deleteItemAsync('resqher_sos_autosent_v1');
        if (!isMountedRef.current) return;
        setSosActive(false);
        setSosLive(false);
        setActiveIncidentId(null);
        setCancelCountdown(0);
    }, [setSosLive]);

    const hydrateActiveStandardSos = useCallback(async (options?: { showNotice?: boolean; clearWhenMissing?: boolean }) => {
        const seq = ++activeSosHydrateSeqRef.current;
        try {
            const incident = await incidentService.getMyActiveSos();
            if (!isMountedRef.current || seq !== activeSosHydrateSeqRef.current) return null;
            if (incident && isLiveSosStatus(incident.status)) {
                await applyActiveStandardSos(incident, options);
                return incident;
            }
            if (options?.clearWhenMissing) {
                await clearRestoredStandardSos();
            }
            return null;
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[SOS] Unable to verify active SOS from backend:', error instanceof Error ? error.message : error);
            }
            try {
                const SecureStore = await import('expo-secure-store');
                const raw = await SecureStore.getItemAsync('resqher_active_sos_v1');
                if (!raw || !isMountedRef.current || seq !== activeSosHydrateSeqRef.current) return null;
                const parsed = JSON.parse(raw);
                const cachedIncident = {
                    id: parsed?.incidentId,
                    incidentId: parsed?.incidentId,
                    status: 'ACTIVE',
                    latitude: parsed?.lat,
                    longitude: parsed?.lng,
                    address: parsed?.address,
                    createdAt: parsed?.createdAt,
                };
                await applyActiveStandardSos(cachedIncident);
                return cachedIncident;
            } catch {
                return null;
            }
        }
    }, [applyActiveStandardSos, clearRestoredStandardSos]);

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

    // Reset active tab and restore SOS state from backend when screen regains focus.
    useFocusEffect(
        useCallback(() => {
            let isFocused = true;
            setActiveTab('Home');
            (async () => {
                if (!isFocused) return;
                await hydrateActiveStandardSos({ clearWhenMissing: true });
            })();

            return () => { isFocused = false; };
        }, [hydrateActiveStandardSos])
    );

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                hydrateActiveStandardSos({ clearWhenMissing: true }).catch(() => undefined);
            }
        });
        return () => sub.remove();
    }, [hydrateActiveStandardSos]);

    // Pulse ring anims (SOS active state - RN Animated for compatibility)
    const [p0s] = useState(() => new RNAnimated.Value(1)); const [p0o] = useState(() => new RNAnimated.Value(0));
    const [p1s] = useState(() => new RNAnimated.Value(1)); const [p1o] = useState(() => new RNAnimated.Value(0));
    const [p2s] = useState(() => new RNAnimated.Value(1)); const [p2o] = useState(() => new RNAnimated.Value(0));
    const pulseAnims = useMemo(() => [
        { scale: p0s, op: p0o },
        { scale: p1s, op: p1o },
        { scale: p2s, op: p2o },
    ], [p0o, p0s, p1o, p1s, p2o, p2s]);

    // Location
    const refreshAndRecenterMap = useCallback(async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
                incidentService.getMyIncidents().catch(() => undefined);
                return;
            }

            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (!isMountedRef.current) return;
            const { latitude, longitude } = pos.coords;
            setUserLoc({ latitude, longitude });
            setLocationStatus('ready');
            mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 700);
            incidentService.getMyIncidents().catch(() => undefined);
        } catch (err) {
            console.warn('[SOS] Unable to refresh map location:', err);
            if (isMountedRef.current) mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
        }
    }, []);

    const handleNavigation = useCallback((tabId: string) => {
        if (tabId === activeTab && tabId === 'Home') {
            refreshAndRecenterMap();
            return;
        }
        setActiveTab(tabId);
        if (tabId === 'Chat') {
            router.push('/(tabs)/users/standard-user/chat_home');
        } else if (tabId === 'Explore') {
            router.push('/(tabs)/users/standard-user/ExploreScreen');
        } else if (tabId === 'Medical') {
            router.push('/(tabs)/users/standard-user/MedicalDashboard');
        }
    }, [activeTab, refreshAndRecenterMap, router]);

    useFocusEffect(
        useCallback(() => {
            refreshAndRecenterMap();
        }, [refreshAndRecenterMap])
    );

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { console.warn('[SOS] Location permission denied'); return; }
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
    }, [pulseAnims]);

    // SOS logic - create incident and start cancel countdown
    const completeSOSCountdown = useCallback(async (createSeq: number) => {
        let lat = userLoc?.latitude;
        let lng = userLoc?.longitude;

        try {
            if (!lat || !lng) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') throw new Error('Location permission is required to send an SOS.');
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                if (isMountedRef.current) setUserLoc({ latitude: lat, longitude: lng });
            }

            const incident = await incidentService.createIncident({
                latitude: lat,
                longitude: lng,
                address: address || undefined,
                sourceRole: 'standard_user',
            });

            if (sosCreateSeqRef.current !== createSeq || !isMountedRef.current) {
                incidentService.cancelIncident(incident.id).catch(() => undefined);
                return;
            }

            const id = String(incident.id);
            const displayNumber = Number(incident.id);
            if (!id || !Number.isFinite(displayNumber)) {
                throw new Error('Incident response did not include a valid backend incident ID.');
            }
            setActiveIncidentId(id);
            setSosLive(true);

            const SecureStore = await import('expo-secure-store');
            await SecureStore.deleteItemAsync('resqher_sos_count_v1');
            const createdAt = new Date().toISOString();
            await SecureStore.setItemAsync('resqher_active_sos_v1', JSON.stringify({
                incidentId: id, displayNumber, lat, lng, address: address || '', createdAt,
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
                createdAt: new Date().toISOString(),
            });
        } catch (error: any) {
            if (sosCreateSeqRef.current !== createSeq || !isMountedRef.current) return;
            const code = error?.response?.data?.code || error?.code;
            if (code === 'ACTIVE_SOS_EXISTS') {
                const existingSos = await hydrateActiveStandardSos({ showNotice: true });
                if (existingSos) return;
            }
            setSosActive(false);
            setCancelCountdown(0);
            setLocationStatus('ready');
            setHoldPhase('idle');
            setSosLive(false);
        }
    }, [address, hydrateActiveStandardSos, setSosLive, userLoc]);

    const triggerSOS = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (activeIncidentId || isEmergencyLive) {
            const existingSos = await hydrateActiveStandardSos({ showNotice: true });
            if (existingSos) return;
        }
        const existingSos = await hydrateActiveStandardSos({ showNotice: true });
        if (existingSos) return;
        setHoldPhase('idle');
        setSosActive(true);
        setLocationStatus('sharing');
        setCancelCountdown(cancelDuration);
        setSosLive(false);
        setActiveIncidentId(null);
        navigatedRef.current = false;
        sosCreateSeqRef.current += 1;
    }, [activeIncidentId, cancelDuration, hydrateActiveStandardSos, isEmergencyLive, setSosLive]);

    useEffect(() => {
        if (!sosActive || cancelCountdown <= 0) return;
        cancelTimerRef.current = setInterval(() => {
            setCancelCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(cancelTimerRef.current!);
                    completeSOSCountdown(sosCreateSeqRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (cancelTimerRef.current) clearInterval(cancelTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sosActive, cancelCountdown === cancelDuration, completeSOSCountdown]);

    // Navigate to chat room once the cancel window expires and SOS is still active
    useEffect(() => {
        if (!isEmergencyLive || navigatedRef.current) return;
        if (!activeIncidentId) return;
        navigatedRef.current = true;
        const lat = userLoc?.latitude;
        const lng = userLoc?.longitude;
        const incId = activeIncidentId;
        // Push (not replace) so user can return to SOS screen from chat
        router.push({
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
        setEndSosModalVisible(false);
        sosCreateSeqRef.current += 1;
        navigatedRef.current = false;
        setSosActive(false); setCancelCountdown(0); setLocationStatus('ready');
        setHoldPhase('idle');
        setSosLive(false);
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);

        const incId = activeIncidentId;
        setActiveIncidentId(null);

        import('expo-secure-store').then(SecureStore => {
            SecureStore.deleteItemAsync('resqher_active_sos_v1');
            SecureStore.deleteItemAsync('resqher_sos_autosent_v1');
        });

        if (incId) {
            if (!incId.startsWith('temp-') && incId !== 'sos-new') {
                incidentService.cancelIncident(incId).catch(() => { });
            }
            incidentHistory.updateStatus(incId, 'CANCELLED');
            notificationStore.add({
                type: 'incident_cancelled',
                title: 'SOS Cancelled',
                body: 'Your emergency has been cancelled.',
                incidentId: incId,
                createdAt: new Date().toISOString(),
            });
        }
    }, [activeIncidentId, setSosLive]);

    const resetReviewFlow = useCallback(() => {
        setReviewVisible(false);
        setReviewLoading(false);
        setReviewQueue([]);
        setReviewIncidentId(null);
        setReviewFeedback('');
        setReviewRating(5);
        setReviewRemovingId(null);
        setReviewSubmitting(false);
        reviewExitAnim.setValue(0);
    }, [reviewExitAnim]);

    const loadReviewVolunteers = useCallback(async (incidentId: string) => {
        const responders = await incidentService.getIncidentResponders(incidentId);
        return buildReviewQueue(responders);
    }, []);

    const openReviewPopup = useCallback(async (incidentId: string | null) => {
        if (!incidentId || incidentId.startsWith('temp-') || incidentId === 'sos-new') return;
        // Show the card immediately so there is no perceived delay.
        setReviewIncidentId(incidentId);
        setReviewQueue([]);
        setReviewFeedback('');
        setReviewRating(5);
        setReviewRemovingId(null);
        setReviewSubmitting(false);
        reviewExitAnim.setValue(0);
        setReviewVisible(true);
        setReviewLoading(true);
        try {
            const volunteers = await loadReviewVolunteers(incidentId);
            if (!isMountedRef.current) return;
            if (!volunteers.length) {
                setReviewVisible(false);
                setReviewLoading(false);
                return;
            }
            setReviewQueue(volunteers);
        } catch (error) {
            console.warn('[SOS] Unable to load responders for review:', error);
            if (isMountedRef.current) setReviewVisible(false);
        } finally {
            if (isMountedRef.current) setReviewLoading(false);
        }
    }, [loadReviewVolunteers, reviewExitAnim]);

    const closeReviewPopup = useCallback(() => {
        resetReviewFlow();
    }, [resetReviewFlow]);

    const submitVolunteerReview = useCallback(async () => {
        const currentVolunteer = reviewQueue[0];
        if (!currentVolunteer) {
            resetReviewFlow();
            return;
        }
        if (!reviewIncidentId || reviewSubmitting) return;

        setReviewSubmitting(true);
        try {
            await incidentService.submitIncidentReview(reviewIncidentId, {
                volunteerId: currentVolunteer.id,
                rating: reviewRating,
                feedback: reviewFeedback,
            });
        } catch (error) {
            console.warn('[SOS] Unable to submit volunteer review:', error);
        } finally {
            if (isMountedRef.current) setReviewSubmitting(false);
        }

        setReviewRemovingId(currentVolunteer.id);
        RNAnimated.timing(reviewExitAnim, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start(() => {
            const nextQueue = reviewQueue.slice(1);

            if (!nextQueue.length) {
                resetReviewFlow();
                return;
            }

            setReviewQueue(nextQueue);
            setReviewFeedback('');
            setReviewRating(5);
            setReviewRemovingId(null);
            reviewExitAnim.setValue(0);
        });
    }, [resetReviewFlow, reviewExitAnim, reviewFeedback, reviewIncidentId, reviewQueue, reviewRating, reviewSubmitting]);

    const resolveSOSAndEnd = useCallback(async () => {
        // Full resolution: update backend status to RESOLVED, clear local state
        setEndSosModalVisible(false);
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
        setSosActive(false);
        setCancelCountdown(0);
        setLocationStatus('ready');
        setHoldPhase('idle');
        setSosLive(false);
        navigatedRef.current = false;
        const incId = activeIncidentId;
        openReviewPopup(incId);
        setActiveIncidentId(null);
        void (async () => {
            try {
                await import('expo-secure-store').then(ss => {
                    ss.deleteItemAsync('resqher_active_sos_v1');
                    ss.deleteItemAsync('resqher_sos_autosent_v1');
                });
                if (incId && !incId.startsWith('temp-') && incId !== 'sos-new') {
                    await incidentService.resolveIncident(incId);
                }
                if (incId) {
                    const { incidentHistory } = await import('../../../../src/services/incidentHistory');
                    await incidentHistory.updateStatus(incId, 'RESOLVED');
                    const { notificationStore } = await import('../../../../src/services/notificationStore');
                    await notificationStore.add({
                        type: 'incident_resolved',
                        title: 'SOS Resolved',
                        body: 'Your emergency has been marked as resolved.',
                        incidentId: incId,
                        createdAt: new Date().toISOString(),
                    });
                }
            } catch { /* best-effort */ }
        })();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [activeIncidentId, setSosLive, openReviewPopup]);

    const confirmStop = useCallback(() => {
        setDeactivateSheetVisible(true);
    }, []);

    const handleDrawerNavigate = useCallback((label: string) => {
        if (label === 'Edit Profile') router.push('/(tabs)/users/standard-user/edit-profile');
        else if (label === 'Emergency Contacts') router.push('/(tabs)/users/standard-user/emergency-contacts');
        else if (label === 'Safety Settings') router.push('/(tabs)/users/standard-user/safety-settings');
        else if (label === 'Volunteer Verification') router.push('/(tabs)/users/standard-user/volunteer-verification');
        else if (label === 'Incident History') router.push('/(tabs)/users/standard-user/incident-history');
        else if (label === 'Privacy & Security') router.push('/(tabs)/users/standard-user/privacy-security');
    }, [router]);

    const handleLogoutRequest = useCallback(async () => {
        if (isSosLive) {
            setLogoutBlockModalVisible(true);
        } else {
            const signedOut = await signOut(() => setLogoutBlockModalVisible(true));
            if (signedOut) {
                router.replace('/(auth)/login');
            }
        }
    }, [isSosLive, signOut, router]);

    const goToMyLoc = () => {
        if (userLoc) mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600);
    };

    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;
    const currentReviewVolunteer = reviewQueue[0] ?? null;

    // Restored from the pre-regression layout: center the full-width SOS wrapper
    // in the usable map area, clamped between the header and bottom nav.
    const targetCenterY = height * 0.62;
    const headerSafeTop = insets.top + 120;
    const bottomSafe = navBottom + NAV_HEIGHT + 18;
    const extraBelowWrap = 76;
    const maxTop = Math.max(headerSafeTop, height - bottomSafe - (SOS_WRAP_SIZE + extraBelowWrap));
    const sosTop = Math.min(Math.max(targetCenterY - SOS_WRAP_SIZE / 2, headerSafeTop), maxTop);

    const mapDiagnostics = useMapRenderDiagnostics({
        screenName: 'StandardSosMap',
        location: userLoc,
        regionSource: userLoc ? 'user-location' : 'fallback-dhaka',
        overlayState: {
            drawerOpen,
            sosActive,
            cancelCountdown,
            isEmergencyLive,
            reviewVisible,
            endSosModalVisible,
            logoutBlockModalVisible,
            deactivateSheetVisible,
            locationStatus,
        },
    });

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                {/* Live-state overlays removed (keep ring pulse only) */}
                <Drawer
                    visible={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onLogoutRequest={handleLogoutRequest}
                    onNavigate={handleDrawerNavigate}
                />

                {/* ── STEP 1: GLASSMORPHIC STATUS UPDATE BOTTOM SHEET ── */}
                <Modal
                    visible={deactivateSheetVisible}
                    animationType="slide"
                    transparent={true}
                    statusBarTranslucent
                    onRequestClose={() => setDeactivateSheetVisible(false)}
                >
                    <View style={s.responderSheetOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setDeactivateSheetVisible(false)} />
                        <View style={s.responderSheetContainer}>
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={s.responderSheetTint} pointerEvents="none" />

                            <View style={s.responderSheetGrabberWrap}>
                                <View style={s.responderSheetGrabber} />
                            </View>

                            <View style={s.responderSheetContent}>
                                <Text style={s.responderSheetTitle}>Update Emergency Status</Text>

                                <TouchableOpacity
                                    style={[s.responderSheetBtn, s.responderSheetBtnResolve]}
                                    onPress={() => { setDeactivateSheetVisible(false); setStopConfirmMode('resolve'); setEndSosModalVisible(true); }}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                                    <Text style={[s.responderSheetBtnText, s.responderSheetBtnTextResolve]}>RESOLVE</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[s.responderSheetBtn, s.responderSheetBtnCancel]}
                                    onPress={() => { setDeactivateSheetVisible(false); setStopConfirmMode('cancel'); setEndSosModalVisible(true); }}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                                    <Text style={[s.responderSheetBtnText, s.responderSheetBtnTextCancel]}>CANCEL</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={s.sheetCloseLink} onPress={() => setDeactivateSheetVisible(false)}>
                                    <Text style={s.sheetCloseLinkText}>Back to live tracking map</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* ── STEP 2: BRAND IDENTICAL CONFIRMATION DIALOG BOX ── */}
                <Modal visible={endSosModalVisible} transparent animationType="fade" onRequestClose={() => setEndSosModalVisible(false)}>
                    <View style={s.modalOverlay}>
                        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,18,0.52)' }]} pointerEvents="none" />
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEndSosModalVisible(false)} />

                        <View style={s.modalCard}>
                            <View style={[
                                s.modalIconWrap,
                                stopConfirmMode === 'resolve' && { backgroundColor: 'rgba(52,199,89,0.14)', borderColor: 'rgba(52,199,89,0.28)' }
                            ]}>
                                <Feather
                                    name={stopConfirmMode === 'resolve' ? "check-circle" : "alert-triangle"}
                                    size={24}
                                    color={stopConfirmMode === 'resolve' ? T.success : T.danger}
                                />
                            </View>
                            <Text style={s.modalTitle}>
                                {stopConfirmMode === 'resolve' ? 'Resolve Emergency?' : 'Stop Emergency Alert?'}
                            </Text>
                            <Text style={s.modalBody}>
                                {stopConfirmMode === 'resolve'
                                    ? 'Are you completely secure? This will mark the incident tracking window as successfully resolved.'
                                    : 'Your active live tracking stream will cut off and no longer share real-time location vectors.'
                                }
                            </Text>

                            <TouchableOpacity
                                style={s.modalBtnPrimary}
                                onPress={() => setEndSosModalVisible(false)}
                                activeOpacity={0.82}
                            >
                                <Text style={s.modalBtnPrimaryText}>No, Keep Active</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.modalBtnSecondary}
                                onPress={stopConfirmMode === 'resolve' ? resolveSOSAndEnd : cancelSOS}
                                activeOpacity={0.75}
                            >
                                <Text style={[s.modalBtnSecondaryText, { color: stopConfirmMode === 'resolve' ? T.success : T.danger }]}>
                                    {stopConfirmMode === 'resolve' ? 'Yes, Resolve' : 'Yes, Stop'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* ── Logout Blocked Modal ────────────────────────────────────── */}
                <Modal visible={logoutBlockModalVisible} transparent animationType="fade" onRequestClose={() => setLogoutBlockModalVisible(false)}>
                    <View style={s.modalOverlay}>
                        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,18,0.52)' }]} pointerEvents="none" />
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setLogoutBlockModalVisible(false)} />

                        <View style={s.modalCard}>
                            <View style={[s.modalIconWrap, s.modalIconWrapWarning]}>
                                <Feather name="log-out" size={24} color={T.accent} />
                            </View>
                            <Text style={s.modalTitle}>Cannot Logout</Text>
                            <Text style={s.modalBody}>
                                You have an active SOS emergency. Please stop or resolve the SOS before logging out.
                            </Text>

                            <TouchableOpacity
                                style={s.modalBtnPrimary}
                                onPress={() => setLogoutBlockModalVisible(false)}
                                activeOpacity={0.82}
                            >
                                <Text style={s.modalBtnPrimaryText}>Stay in SOS</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.modalBtnSecondary}
                                onPress={() => { setLogoutBlockModalVisible(false); setEndSosModalVisible(true); }}
                                activeOpacity={0.75}
                            >
                                <Text style={s.modalBtnSecondaryText}>Resolve SOS First</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* ── STEP 3: VOLUNTEER REVIEW DIALOGUE ── */}
                <Modal
                    visible={reviewVisible}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={closeReviewPopup}
                >
                    <View style={s.reviewOverlay}>
                        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.reviewScrim} pointerEvents="none" />
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeReviewPopup} />

                        <View style={s.reviewCard}>
                            <Text style={s.reviewEyebrow}>Volunteer Review</Text>
                            {reviewLoading ? (
                                <ActivityIndicator
                                    color={T.violet}
                                    size="large"
                                    style={{ marginVertical: 40 }}
                                />
                            ) : currentReviewVolunteer ? (<>
                            <View style={s.reviewAvatarRow}>
                                <RNAnimated.View
                                    key={currentReviewVolunteer.id}
                                    style={[
                                        s.reviewAvatarWrap,
                                        s.reviewAvatarWrapCurrent,
                                        currentReviewVolunteer.id === reviewRemovingId && s.reviewAvatarWrapRemoving,
                                        currentReviewVolunteer.id === reviewRemovingId && {
                                            opacity: reviewExitAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                                            transform: [{ translateY: reviewExitAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }],
                                        },
                                    ]}
                                >
                                    <UserAvatar
                                        uri={currentReviewVolunteer.avatarUri}
                                        size={68}
                                        style={s.reviewAvatarImg}
                                    />
                                </RNAnimated.View>
                            </View>
                            <Text style={s.reviewSelectedName} numberOfLines={1}>
                                {currentReviewVolunteer.name || 'Volunteer'}
                            </Text>
                            <Text style={s.reviewSelectedMeta} numberOfLines={1}>
                                {reviewQueue.length} volunteer{reviewQueue.length === 1 ? '' : 's'} left to review
                            </Text>

                            <TextInput
                                value={reviewFeedback}
                                onChangeText={setReviewFeedback}
                                placeholder="Write your feedback here..."
                                placeholderTextColor={T.ink4}
                                multiline
                                editable={!reviewSubmitting}
                                textAlignVertical="top"
                                style={s.reviewInput}
                            />

                            <View style={s.reviewStarsRow}>
                                {[1, 2, 3, 4, 5].map(star => {
                                    const active = star <= reviewRating;
                                    return (
                                        <TouchableOpacity key={star} onPress={() => setReviewRating(star)} disabled={reviewSubmitting} activeOpacity={0.8}>
                                            <Ionicons name={active ? 'star' : 'star-outline'} size={24} color={active ? '#FBBF24' : T.ink4} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity style={[s.reviewSubmitBtn, reviewSubmitting && { opacity: 0.65 }]} onPress={submitVolunteerReview} disabled={reviewSubmitting} activeOpacity={0.9}>
                                <LinearGradient
                                    colors={[T.violet, '#7C3AED']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={s.reviewSubmitFill}
                                >
                                    <Text style={s.reviewSubmitText}>{reviewSubmitting ? 'Submitting...' : 'Submit Review'}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            </>) : null}
                        </View>
                    </View>
                </Modal>

                {/* Map - Encrypted Professional Dark Tactical Style */}
                <MapView
                    key={mapDiagnostics.mapKey}
                    ref={mapRef}
                    debugName="StandardSosMap"
                    style={StyleSheet.absoluteFill}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={DEFAULT_REGION}
                    onLayout={mapDiagnostics.onMapLayout}
                    onMapReady={mapDiagnostics.onMapReady}
                    onMapLoaded={mapDiagnostics.onMapLoaded}
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

                {/* -- Header --------------------------------------------------- */}
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
                            <UserAvatar uri={profile?.photoUri} size={36} style={s.profileAvatar} />
                        </TouchableOpacity>
                    </View>
                </PremiumBar>

                {/* -- 12px Breathing Space Spacer -------------------------------- */}
                <View style={{ marginTop: 12 }} />

                {/* -- Map controls - High contrast GPS/Recenter ----------------- */}
                <View style={[s.mapControls, { bottom: insets.bottom + SOS_BOTTOM + SOS_WRAP_SIZE - 10 }]}>
                    <View style={[s.gpsPill, isEmergencyLive && s.gpsPillEmg]}>
                        <View style={[s.gpsDot, {
                            backgroundColor:
                                locationStatus === 'sharing' ? T.danger :
                                    locationStatus === 'ready' ? T.success : T.ink4,
                        }]} />
                        <Text style={[s.gpsTxt, isEmergencyLive && s.gpsTxtEmg]}>
                            {locationStatus !== 'idle' ? 'GPS' : '...'}
                        </Text>
                    </View>
                    <TouchableOpacity style={s.ctrlBtn} onPress={goToMyLoc} accessibilityLabel="Recenter map" accessibilityRole="button">
                        <Ionicons name="locate-outline" size={22} color={T.onPrimary} />
                    </TouchableOpacity>
                </View>

                {/* -- SOS Section ----------------------------------------------- */}
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
                                    ? `Alert triggered - Cancel in ${cancelCountdown}s`
                                    : 'Sharing your location'
                                }
                            </Text>
                        </View>
                    )}
                </View>

                {/* -- Bottom Navbar ------------------------------------------- */}
                <AICopilotFloatingButton
                    role="standard"
                    storageKey="standard-home"
                    bottom={NAV_BOT_OFFSET + NAV_HEIGHT + 22}
                    hidden={
                        sosActive
                        || drawerOpen
                        || reviewVisible
                        || deactivateSheetVisible
                        || endSosModalVisible
                        || logoutBlockModalVisible
                    }
                />

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

// -----------------------------------------------------------------------------
// Tactical Map Style - dark blue-charcoal base, visible hierarchy
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// StyleSheet - Premium Tactical Command Center
// -----------------------------------------------------------------------------
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#090514' },  // Matches AtmosphericShell gradient end

    header: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: 28,  // Bulky Glass Mandate - matches Hub cards
        zIndex: 300,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    profileBtn: {
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    profileAvatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
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

    sosSection: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 390, elevation: 20 },
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
        ...StyleSheet.absoluteFill,
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
        backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    cancelLabel: { color: T.ink, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
    cancelCount: { color: T.danger, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
    cancelSub: { color: T.ink3, fontSize: 10, fontWeight: '700', marginTop: 2 },

    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.full,
        paddingHorizontal: 16, paddingVertical: 8,
        marginTop: 22,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 3 },
        }),
    },
    statusPillLive: {
        backgroundColor: `${T.danger}15`,
        borderColor: `${T.danger}30`,
    },
    pillDot: { width: 7, height: 7, borderRadius: 3.5 },
    pillTxt: { fontSize: 12, fontWeight: '700', color: T.ink3, letterSpacing: 0.4, textAlign: 'center', flexShrink: 1, lineHeight: 15 },
    pillTxtLive: { color: T.danger },

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

    drawerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)' },
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

    // -- Themed Confirmation Modals -------------------------------------------
    modalOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        backgroundColor: 'rgba(4,6,12,0.45)',
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        paddingHorizontal: 22,
        paddingTop: 22,
        paddingBottom: 18,
        backgroundColor: 'rgba(24,16,40,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
            android: { elevation: 18 },
        }),
    },
    modalIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(217,45,32,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(217,45,32,0.28)',
        marginBottom: 14,
    },
    modalIconWrapWarning: {
        backgroundColor: 'rgba(245,158,11,0.14)',
        borderColor: 'rgba(245,158,11,0.28)',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    modalBody: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: T.ink2,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 22,
    },
    modalBtnPrimary: {
        width: '100%',
        minHeight: 48,
        borderRadius: R.pill,
        backgroundColor: T.violet,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    modalBtnPrimaryText: {
        color: T.onPrimary,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    modalBtnSecondary: {
        width: '100%',
        minHeight: 48,
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnSecondaryText: {
        color: T.ink3,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    // ── Themed Slide-up Reason Sheets ──
    responderSheetOverlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(4,3,8,0.45)',
        zIndex: 999,
    },
    responderSheetContainer: {
        backgroundColor: T.surfaceOverlay,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        paddingBottom: Platform.OS === 'ios' ? 42 : 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    responderSheetTint: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    responderSheetGrabberWrap: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    responderSheetGrabber: {
        width: 42,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    responderSheetContent: {
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    responderSheetTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 20,
        letterSpacing: -0.2,
    },
    responderSheetBtn: {
        width: '100%',
        minHeight: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        borderWidth: 1,
        marginBottom: 12,
    },
    responderSheetBtnCancel: {
        backgroundColor: `${T.danger}1A`,
        borderColor: `${T.danger}59`,
    },
    responderSheetBtnResolve: {
        backgroundColor: `${T.violet}1F`,
        borderColor: `${T.violet}59`,
    },
    responderSheetBtnText: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.6,
        marginLeft: 8,
    },
    responderSheetBtnTextCancel: {
        color: T.danger,
    },
    responderSheetBtnTextResolve: {
        color: T.violet,
    },
    sheetCloseLink: {
        marginTop: 4,
        paddingVertical: 8,
    },
    sheetCloseLinkText: {
        color: T.navIconInactive,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    reviewOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        backgroundColor: 'rgba(4,6,12,0.45)',
    },
    reviewScrim: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(8,8,16,0.58)',
    },
    reviewCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 18,
        backgroundColor: 'rgba(24,16,40,0.76)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
            android: { elevation: 18 },
        }),
    },
    reviewEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: T.ink4,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        alignSelf: 'center',
    },
    reviewAvatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 16,
        marginBottom: 12,
        minHeight: 74,
    },
    reviewAvatarWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.18)',
        overflow: 'hidden',
        backgroundColor: T.violetDim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewAvatarWrapCurrent: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderColor: `${T.violet}55`,
    },
    reviewAvatarWrapRemoving: {
        borderColor: `${T.danger}55`,
    },
    reviewAvatarImg: {
        borderWidth: 0,
    },
    reviewSelectedName: {
        fontSize: 18,
        fontWeight: '800',
        color: T.ink,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    reviewSelectedMeta: {
        fontSize: 12,
        fontWeight: '600',
        color: T.ink3,
        textAlign: 'center',
        marginTop: 4,
    },
    reviewInput: {
        minHeight: 96,
        marginTop: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: T.surfaceBulky,
        color: T.ink,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    reviewStarsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginTop: 14,
    },
    reviewSubmitBtn: {
        marginTop: 18,
        borderRadius: R.pill,
        overflow: 'hidden',
        minHeight: 48,
    },
    reviewSubmitFill: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewSubmitText: {
        color: T.onPrimary,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
});

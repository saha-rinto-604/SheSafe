/**
 * app/(tabs)/users/sos_screen.tsx
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
    Modal, ScrollView, ViewStyle, Image, TextInput,
} from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withSequence,
    withDelay, withRepeat, Easing as REasing, runOnJS,
    interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Animated as RNAnimated, Easing } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { T, R, S } from '../../../src/constants/theme';
import { G } from '../../../src/constants/gradients';
import AtmosphericShell from '../../../src/components/AtmosphericShell';
import { getUserProfile, UserProfile } from '../../../src/services/profile';

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

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const SAFE_PLACE_LOCATION = { latitude: 23.7924, longitude: 90.4072, name: 'United International University' };
const NOTUNBAZAR_LOC = { latitude: 23.8067, longitude: 90.4199 };
const MOCK_SAFE_PLACE_ROUTE = [
    NOTUNBAZAR_LOC,
    { latitude: 23.8057, longitude: 90.4186 },
    { latitude: 23.8044, longitude: 90.4164 },
    { latitude: 23.8031, longitude: 90.4144 },
    { latitude: 23.8014, longitude: 90.4126 },
    { latitude: 23.7994, longitude: 90.4106 },
    { latitude: 23.7975, longitude: 90.4089 },
    SAFE_PLACE_LOCATION,
];

const REVIEW_VOLUNTEERS = [
    { id: 'rv-1', name: 'Amin Rahman', avatarUri: 'https://i.pravatar.cc/150?img=15&u=rv-1' },
    { id: 'rv-2', name: 'Nusrat Chowdhury', avatarUri: 'https://i.pravatar.cc/150?img=32&u=rv-2' },
    { id: 'rv-3', name: 'Jamal Ahmed', avatarUri: 'https://i.pravatar.cc/150?img=12&u=rv-3' },
];

function haversineDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const radius = 6371000;
    const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(hav));
}

function decodePolyline(encoded: string) {
    const coords: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += deltaLat;

        shift = 0;
        result = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += deltaLng;

        coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }

    return coords;
}

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

type SosLiveButtonStage = 'requesting' | 'responding';

const SosLiveButton = memo(function SosLiveButton({
    stage,
    animatedStyle,
}: {
    stage: SosLiveButtonStage;
    animatedStyle?: any;
}) {
    return (
        <RNAnimated.View style={animatedStyle}>
            <View style={[s.sosBtn, s.sosBtnEmg]}>
                <View style={s.sosBtnDangerFill}>
                    <Ionicons
                        name={stage === 'responding' ? 'pulse' : 'location-sharp'}
                        size={stage === 'responding' ? 22 : 24}
                        color={T.onDanger}
                    />
                    <Text style={[s.sosTxt, stage === 'responding' && s.sosTxtCompact]}>
                        {stage === 'responding' ? 'LIVE' : 'SOS'}
                    </Text>
                    <Text style={[s.sosSubTxt, stage === 'responding' && s.sosSubTxtCompact]}>
                        {stage === 'responding' ? 'VOLUNTEER ACCEPTED' : 'SHARING LOCATION'}
                    </Text>
                </View>
            </View>
        </RNAnimated.View>
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
    const [isEmergencyLive, setIsEmergencyLive] = useState(false);
    const [sosStage, setSosStage] = useState<'idle' | 'requesting' | 'responding'>('idle');
    const sosTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sosTransitionAnim = useRef(new RNAnimated.Value(0)).current;
    const [cancelDuration, setCancelDuration] = useState(CANCEL_DURATION_DEFAULT);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready' | 'sharing'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState('');
    const [showSafePlace, setShowSafePlace] = useState(false);
    const [safePlaceCoords, setSafePlaceCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [safePlaceDistance, setSafePlaceDistance] = useState<number | null>(null);
    const [safePlaceLoading, setSafePlaceLoading] = useState(false);
    const [stopConfirmVisible, setStopConfirmVisible] = useState(false);
    const [reviewVisible, setReviewVisible] = useState(false);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [reviewQueue, setReviewQueue] = useState(REVIEW_VOLUNTEERS);
    const [reviewRemovingId, setReviewRemovingId] = useState<string | null>(null);
    const reviewExitAnim = useRef(new RNAnimated.Value(0)).current;
    const [holdPhase, setHoldPhase] = useState<'idle' | 'holding' | 'armed'>('idle');
    const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load profile picture on screen focus
    useFocusEffect(
        useCallback(() => {
            getUserProfile().then(setProfile);
        }, []),
    );

    // Load persisted SOS cancel timer setting on mount
    useEffect(() => {
        import('../../../src/constants/theme').then(() => {
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

    // SOS logic
    const triggerSOS = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setHoldPhase('idle');
        setSosActive(true);
        setSosStage('requesting');
        setIsEmergencyLive(false);
        sosTransitionAnim.setValue(0);
        setLocationStatus('sharing');
        setCancelCountdown(cancelDuration);

        if (sosTransitionRef.current) clearTimeout(sosTransitionRef.current);
        sosTransitionRef.current = setTimeout(() => {
            setIsEmergencyLive(true);
            setSosStage('responding');
            RNAnimated.timing(sosTransitionAnim, {
                toValue: 1,
                duration: 380,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        }, 5000);
    }, [cancelDuration, sosTransitionAnim]);

    useEffect(() => {
        if (!sosActive || cancelCountdown <= 0) return;
        cancelTimerRef.current = setInterval(() => {
            setCancelCountdown(prev => {
                if (prev <= 1) { clearInterval(cancelTimerRef.current!); setIsEmergencyLive(true); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => { if (cancelTimerRef.current) clearInterval(cancelTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sosActive, cancelCountdown === cancelDuration]);

    const cancelSOS = useCallback(() => {
        setSosActive(false); setCancelCountdown(0); setLocationStatus('ready');
        setHoldPhase('idle');
        setIsEmergencyLive(false);
        setSosStage('idle');
        sosTransitionAnim.setValue(0);
        if (sosTransitionRef.current) clearTimeout(sosTransitionRef.current);
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    }, [sosTransitionAnim]);

    const handleSafePlaceToggle = useCallback(() => {
        setShowSafePlace(prev => {
            const next = !prev;
            if (prev && !next && userLoc) {
                setTimeout(() => {
                    mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600);
                }, 200);
            }
            return next;
        });
    }, [userLoc]);

    useEffect(() => {
        let aborted = false;

        const fetchSafePlaceRoute = async () => {
            if (!showSafePlace) {
                setSafePlaceCoords([]);
                setSafePlaceDistance(null);
                setSafePlaceLoading(false);
                return;
            }

            setSafePlaceLoading(true);
            try {
                let coords = MOCK_SAFE_PLACE_ROUTE;

                if (GOOGLE_MAPS_API_KEY) {
                    const origin = `${NOTUNBAZAR_LOC.latitude},${NOTUNBAZAR_LOC.longitude}`;
                    const destination = `${SAFE_PLACE_LOCATION.latitude},${SAFE_PLACE_LOCATION.longitude}`;
                    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=walking&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    const encoded = data?.routes?.[0]?.overview_polyline?.points;
                    const decoded = encoded ? decodePolyline(encoded) : [];
                    if (decoded.length > 1) {
                        coords = decoded;
                    }
                }

                if (!aborted) {
                    setSafePlaceCoords(coords);
                    setSafePlaceDistance(haversineDistance(NOTUNBAZAR_LOC, SAFE_PLACE_LOCATION) / 1000);
                    mapRef.current?.fitToCoordinates(coords, {
                        edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 },
                        animated: true,
                    });
                }
            } catch {
                if (!aborted) {
                    setSafePlaceCoords(MOCK_SAFE_PLACE_ROUTE);
                    setSafePlaceDistance(haversineDistance(NOTUNBAZAR_LOC, SAFE_PLACE_LOCATION) / 1000);
                }
            } finally {
                if (!aborted) setSafePlaceLoading(false);
            }
        };

        fetchSafePlaceRoute();
        return () => { aborted = true; };
    }, [showSafePlace, userLoc]);

    const confirmStop = useCallback(() => {
        setStopConfirmVisible(true);
    }, []);

    const closeStopConfirm = useCallback(() => {
        setStopConfirmVisible(false);
    }, []);

    const handleStopAlert = useCallback(() => {
        setStopConfirmVisible(false);
        cancelSOS();
    }, [cancelSOS]);

    const resetReviewFlow = useCallback(() => {
        setReviewVisible(false);
        setReviewQueue(REVIEW_VOLUNTEERS);
        setReviewFeedback('');
        setReviewRating(5);
        setReviewRemovingId(null);
        reviewExitAnim.setValue(0);
    }, [reviewExitAnim]);

    const openReviewPopup = useCallback(() => {
        if (!reviewQueue.length) {
            cancelSOS();
            return;
        }
        setReviewVisible(true);
    }, [cancelSOS, reviewQueue.length]);

    const closeReviewPopup = useCallback(() => {
        setReviewVisible(false);
    }, []);

    const submitVolunteerReview = useCallback(() => {
        const currentVolunteer = reviewQueue[0];
        if (!currentVolunteer) {
            resetReviewFlow();
            cancelSOS();
            return;
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
                cancelSOS();
                return;
            }

            setReviewQueue(nextQueue);
            setReviewFeedback('');
            setReviewRating(5);
            setReviewRemovingId(null);
            reviewExitAnim.setValue(0);
        });
    }, [cancelSOS, resetReviewFlow, reviewExitAnim, reviewQueue]);

    const goToMyLoc = () => {
        if (userLoc) mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600);
    };

    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    // SOS overlay placement: below map center (thumb-reachable) and clamped
    const targetCenterY = height * 0.56; // slightly higher for thumb reach and nav clearance
    const headerSafeTop = insets.top + 120;
    const bottomSafe = navBottom + NAV_HEIGHT + 18;
    const extraBelowWrap = 120; // increase reserved space below SOS wrap (pill + buttons)
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

                {showSafePlace && safePlaceCoords.length > 1 && (
                    <>
                        <Polyline
                            coordinates={safePlaceCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                        <Marker coordinate={safePlaceCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                            <View style={s.safePlaceMarkerWrap}>
                                <View style={[s.safePlaceMarkerIcon, s.safePlaceMarkerStart, { borderColor: T.violet }]}> 
                                    <Ionicons name="person" size={18} color={T.violet} />
                                </View>
                            </View>
                        </Marker>
                        <Marker coordinate={safePlaceCoords[safePlaceCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                            <View style={s.safePlaceMarkerWrap}>
                                <View style={[s.safePlaceMarkerIcon, s.safePlaceMarkerEnd, { borderColor: T.success }]}> 
                                    <Ionicons name="shield" size={16} color={T.success} />
                                </View>
                            </View>
                        </Marker>
                    </>
                )}
            </MapView>

            <Modal
                visible={stopConfirmVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={closeStopConfirm}
            >
                <View style={s.stopConfirmOverlay}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={s.stopConfirmScrim} pointerEvents="none" />
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeStopConfirm} />
                    <View style={s.stopConfirmCard}>
                        <View style={s.stopConfirmIconWrap}>
                            <Feather name="alert-triangle" size={24} color={T.danger} />
                        </View>
                        <Text style={s.stopConfirmTitle}>Stop Emergency Alert?</Text>
                        <Text style={s.stopConfirmMessage}>Your location will no longer be shared.</Text>
                        <View style={s.stopConfirmActions}>
                            <TouchableOpacity style={s.stopConfirmSecondaryBtn} onPress={closeStopConfirm} activeOpacity={0.85}>
                                <Text style={s.stopConfirmSecondaryTxt}>Keep Active</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.stopConfirmPrimaryBtn} onPress={handleStopAlert} activeOpacity={0.9}>
                                <LinearGradient
                                    colors={["#D92D20", "#F04444"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={s.stopConfirmPrimaryFill}
                                >
                                    <Text style={s.stopConfirmPrimaryTxt}>Stop Alert</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                        <View style={s.reviewAvatarRow}>
                            {reviewQueue.map((volunteer, index) => {
                                const isCurrent = index === 0;
                                const isRemoving = volunteer.id === reviewRemovingId;
                                const animatedStyle = isRemoving ? {
                                    opacity: reviewExitAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                                    transform: [{ translateY: reviewExitAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }],
                                } : undefined;

                                return (
                                    <RNAnimated.View
                                        key={volunteer.id}
                                        style={[
                                            s.reviewAvatarWrap,
                                            isCurrent && s.reviewAvatarWrapCurrent,
                                            isRemoving && s.reviewAvatarWrapRemoving,
                                            animatedStyle,
                                        ]}
                                    >
                                        <Image source={{ uri: volunteer.avatarUri }} style={s.reviewAvatarImg} />
                                    </RNAnimated.View>
                                );
                            })}
                        </View>
                        <Text style={s.reviewSelectedName} numberOfLines={1}>
                            {reviewQueue[0]?.name ?? 'Volunteer'}
                        </Text>
                        <Text style={s.reviewSelectedMeta} numberOfLines={1}>
                            {reviewQueue.length} volunteer{reviewQueue.length === 1 ? '' : 's'} participated
                        </Text>

                        <TextInput
                            value={reviewFeedback}
                            onChangeText={setReviewFeedback}
                            placeholder="Write your feedback here..."
                            placeholderTextColor={T.ink4}
                            multiline
                            textAlignVertical="top"
                            style={s.reviewInput}
                        />

                        <View style={s.reviewStarsRow}>
                            {[1, 2, 3, 4, 5].map(star => {
                                const active = star <= reviewRating;
                                return (
                                    <TouchableOpacity key={star} onPress={() => setReviewRating(star)} activeOpacity={0.8}>
                                        <Ionicons name={active ? 'star' : 'star-outline'} size={24} color={active ? '#FBBF24' : T.ink4} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity style={s.reviewSubmitBtn} onPress={submitVolunteerReview} activeOpacity={0.9}>
                            <LinearGradient
                                colors={[T.violet, '#7C3AED']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.reviewSubmitFill}
                            >
                                <Text style={s.reviewSubmitText}>Submit Review</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
                        <View style={s.notifDot} />
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

            {/* ── Map controls — High contrast GPS/Recenter + Safe Place toggle ── */}
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

            {/* ── SOS Section — hidden when safe place is active ───────────── */}
            {!showSafePlace && (
                <View
                    pointerEvents="box-none"
                    style={[s.sosSection, { top: sosTop }]}
                >
                    <View style={s.sosWrap}>
                                    {sosStage === 'idle' ? (
                                        <HoldSosButton onTrigger={triggerSOS} onPhaseChange={setHoldPhase} />
                                    ) : (
                                        <SosLiveButton
                                            stage={sosStage === 'responding' ? 'responding' : 'requesting'}
                                            animatedStyle={{
                                                transform: [
                                                    {
                                                        translateY: sosTransitionAnim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [0, 38],
                                                        }),
                                                    },
                                                ],
                                            }}
                                        />
                                    )}

                                    {sosActive && pulseAnims.map(({ scale, op }, i) => (
                                        <RNAnimated.View
                                            key={i}
                                            pointerEvents="none"
                                            style={[
                                                s.pulseRing,
                                                {
                                                    transform: [{ scale }],
                                                    opacity: op,
                                                    borderColor: isEmergencyLive ? `${T.danger}73` : G.sosRingDefault,
                                                },
                                            ]}
                                        />
                                    ))}

                                    {/* action buttons rendered below the status pill */}
                                </View>

                        {sosStage === 'idle' ? (
                            <View style={s.statusPill}>
                                <Text style={s.pillTxt} numberOfLines={1}>
                                    {holdPhase === 'idle'
                                        ? 'Press and hold for 2 sec'
                                        : holdPhase === 'holding'
                                            ? 'Holding...'
                                            : 'Release'
                                    }
                                </Text>
                            </View>
                        ) : sosStage === 'requesting' ? (
                            <View style={s.statusPill}>
                                <View style={[s.pillDot, { backgroundColor: T.danger }]} />
                                <Text style={[s.pillTxt, s.pillTxtLive]} numberOfLines={1}>
                                    Sharing your location...
                                </Text>
                            </View>
                        ) : (
                            <View style={[s.statusPill, s.statusPillLive]}>
                                <View style={[s.pillDot, { backgroundColor: T.danger }]} />
                                <Text style={[s.pillTxt, s.pillTxtLive]} numberOfLines={1}>
                                    Volunteer Responding • Sharing your location...
                                </Text>
                            </View>
                        )}

                        {sosStage === 'responding' && (
                            <View style={s.reviewActionRow}>
                                <TouchableOpacity style={[s.reviewActionBtn, s.reviewActionCancel]} onPress={confirmStop} activeOpacity={0.85}>
                                    <Text style={[s.reviewActionBtnText, s.reviewActionCancelText]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[s.reviewActionBtn, s.reviewActionResolve]} onPress={openReviewPopup} activeOpacity={0.85}>
                                    <Text style={[s.reviewActionBtnText, s.reviewActionResolveText]}>Resolve</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                </View>
            )}

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
    safePlaceMarkerWrap: { alignItems: 'center', justifyContent: 'center' },
    safePlaceMarkerIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.surface,
        borderWidth: 2,
    },
    safePlaceMarkerStart: {
        backgroundColor: T.surface,
    },
    safePlaceMarkerEnd: {
        backgroundColor: T.surface,
    },

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
    sosTxtCompact: { fontSize: 34 },
    sosSubTxtCompact: { fontSize: 10.5 },

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
        position: 'absolute',
        bottom: -48,
        alignSelf: 'center',
        width: 360,
        gap: 6,
        backgroundColor: T.surfaceBulky,
        borderRadius: 18,
        paddingHorizontal: 12, paddingVertical: 9,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
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
    stopConfirmOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        backgroundColor: 'rgba(4,6,12,0.45)',
    },
    stopConfirmScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,8,18,0.52)',
    },
    stopConfirmCard: {
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
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
            android: { elevation: 18 },
        }),
    },
    stopConfirmIconWrap: {
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
    stopConfirmTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.3,
    },
    stopConfirmMessage: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: T.ink2,
        fontWeight: '500',
    },
    stopConfirmActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 22,
    },
    stopConfirmSecondaryBtn: {
        flex: 1,
        minHeight: 48,
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopConfirmSecondaryTxt: {
        color: T.ink3,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    stopConfirmPrimaryBtn: {
        flex: 1,
        borderRadius: R.pill,
        overflow: 'hidden',
        minHeight: 48,
    },
    stopConfirmPrimaryFill: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopConfirmPrimaryTxt: {
        color: T.onPrimary,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    reviewOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        backgroundColor: 'rgba(4,6,12,0.45)',
    },
    reviewScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,8,18,0.52)',
    },
    reviewCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 26,
        padding: 24,
        backgroundColor: 'rgba(24,16,40,0.96)',
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
        width: '100%',
        height: '100%',
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
    reviewActionRow: {
        position: 'absolute',
        bottom: -98,
        flexDirection: 'row',
        gap: 10,
        width: 340,
        justifyContent: 'center',
    },
    reviewActionBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: R.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    reviewActionCancel: {
        backgroundColor: T.dangerBg,
        borderColor: T.dangerBorder,
    },
    reviewActionResolve: {
        backgroundColor: T.safeLight,
        borderColor: `${T.success}40`,
    },
    reviewActionBtnText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    reviewActionCancelText: { color: T.dangerText },
    reviewActionResolveText: { color: T.success },
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

/**
 * app/(tabs)/users/sos_screen.tsx
 * Canonical SOS screen — (tabs)/users/ group.
 */

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert,
    Animated, Easing, Dimensions, StatusBar, Platform,
    Modal, ScrollView, ViewStyle,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { T, R, S } from '../../../src/constants/theme';
import { G } from '../../../src/constants/gradients';

// ─────────────────────────────────────────────────────────────────────────────
// PremiumBar — shared glass surface for header + navbar
// Layer 1: T.surfaceGlass  (92% white base)
// Layer 2: T.surfaceOverlay (7% solid violet tint — no gradient, map-safe)
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
            <View style={pb.tint} pointerEvents="none" />
            <View style={[pb.content, contentStyle]}>{children}</View>
        </View>
    );
});

const pb = StyleSheet.create({
    bar: {
        backgroundColor: T.surfaceGlass,
        borderWidth: 1,
        borderColor: `${T.violet}22`,   // ~13% violet — subtle
        overflow: 'hidden',              // clips tint to borderRadius
    },
    tint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: T.surfaceOverlay, // rgba(168,85,247,0.07)
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

const CANCEL_DURATION = 10;
const HOLD_MS = 2000;
const HINT_HIDE_MS = 2200; // auto-hide the "hold 2s" hint after this

// Pill navbar sits 14px above the safe-area bottom inset
const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14; // gap from bottom safe edge
const SOS_BOTTOM = NAV_BOT_OFFSET + NAV_HEIGHT + 28;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.014, longitudeDelta: 0.014,
};

// ─────────────────────────────────────────────────────────────────────────────
// Nav tab definitions — Ionicons throughout
// Active tab uses FILLED icon variant for bold visual weight (matches reference)
// Inactive uses OUTLINE for clean minimal look
// ─────────────────────────────────────────────────────────────────────────────
const NAV_TABS: {
    id: string;
    label: string;
    iconActive: string;   // filled/solid variant — shows when tab is active
    iconOutline: string;  // outline variant — shows when tab is inactive
}[] = [
        { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline' },
        { id: 'Chat', label: 'Chat', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline' },
        { id: 'Explore', label: 'Explore', iconActive: 'compass', iconOutline: 'compass-outline' },
        { id: 'Medical', label: 'Medical', iconActive: 'medkit', iconOutline: 'medkit-outline' },
    ];

const ACTIVE_COLOR = T.violet;
// T.navIconMuted = '#C4B5FD' (violet-300) — premium soft lavender, on-brand inactive
const INACTIVE_COLOR = T.navIconMuted;

// ─────────────────────────────────────────────────────────────────────────────
// Pulse Radar (idle state)
// ─────────────────────────────────────────────────────────────────────────────
const PulseRadar = memo(function PulseRadar() {
    const a0 = useRef(new Animated.Value(0)).current;
    const a1 = useRef(new Animated.Value(0)).current;
    const a2 = useRef(new Animated.Value(0)).current;
    const anims = [a0, a1, a2];

    useEffect(() => {
        anims.forEach((a, i) => {
            const loop = () => {
                a.setValue(0);
                Animated.timing(a, {
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
                <Animated.View key={i} style={[rdr.ring, {
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
    ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: `${T.violet}80` },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: T.surface },
    label: { marginTop: 14, fontSize: 11, fontWeight: '600', color: T.violet, letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Emergency border overlay (LIVE state only)
// Uses dangerBorder token — subtle rose ring, not full-screen red
// ─────────────────────────────────────────────────────────────────────────────
const EmergencyOverlay = memo(function EmergencyOverlay() {
    const op = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        Animated.loop(Animated.sequence([
            Animated.timing(op, { toValue: 0.08, duration: 1000, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0.30, duration: 1000, useNativeDriver: true }),
        ])).start();
    }, []);
    return (
        <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, {
                borderWidth: 2.5, borderColor: T.dangerBorder, zIndex: 999, opacity: op,
            }]}
        />
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Hold SOS Button — two-semicircle arc progress ring
// ─────────────────────────────────────────────────────────────────────────────
const HoldSosButton = memo(function HoldSosButton({ onTrigger }: { onTrigger: () => void }) {
    const progress = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const holdRef = useRef<Animated.CompositeAnimation | null>(null);
    const [holding, setHolding] = useState(false);

    const startHold = useCallback(() => {
        setHolding(true);
        Haptics.selectionAsync();                         // haptic at hold start
        Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 10 }).start();
        holdRef.current = Animated.timing(progress, {
            toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false,
        });
        holdRef.current.start(({ finished }) => {
            if (finished) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); // haptic on success
                onTrigger();
                progress.setValue(0);
                scale.setValue(1);
                setHolding(false);
            }
        });
    }, [onTrigger]);

    const cancelHold = useCallback(() => {
        holdRef.current?.stop();
        setHolding(false);
        Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
            Animated.timing(progress, { toValue: 0, duration: 240, useNativeDriver: false }),
        ]).start();
    }, []);

    const rightRot = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '180deg', '180deg'], extrapolate: 'clamp' });
    const leftRot = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '0deg', '180deg'], extrapolate: 'clamp' });
    const arcOp = progress.interpolate({ inputRange: [0, 0.03, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            {/* Arc progress ring */}
            <Animated.View style={[StyleSheet.absoluteFillObject, {
                width: ARC_SIZE, height: ARC_SIZE,
                left: -(ARC_SIZE - SOS_BTN_SIZE) / 2,
                top: -(ARC_SIZE - SOS_BTN_SIZE) / 2,
                opacity: arcOp,
            }]} pointerEvents="none">
                <View style={hs.arcTrack} />
                <View style={[hs.halfClip, hs.rightClip]}>
                    <Animated.View style={[hs.halfFill, hs.rightFill, { transform: [{ rotate: rightRot }] }]} />
                </View>
                <View style={[hs.halfClip, hs.leftClip]}>
                    <Animated.View style={[hs.halfFill, hs.leftFill, { transform: [{ rotate: leftRot }] }]} />
                </View>
            </Animated.View>

            {/* SOS button */}
            <TouchableOpacity onPressIn={startHold} onPressOut={cancelHold} activeOpacity={1}>
                <LinearGradient
                    colors={G.navActive.colors}
                    start={G.navActive.start}
                    end={G.navActive.end}
                    style={s.sosBtn}
                >
                    <Text style={s.sosTxt}>SOS</Text>
                    <Text style={s.sosSubTxt}>{holding ? 'Release' : 'Hold 2s'}</Text>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
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
// Side Drawer — Feather icons (Feather has better stroke-consistency for lists)
// ─────────────────────────────────────────────────────────────────────────────
const DRAWER_ITEMS: { icon: React.ComponentProps<typeof Feather>['name']; label: string }[] = [
    { icon: 'shield', label: 'Safety Dashboard' },
    { icon: 'message-circle', label: 'Group Chat' },
    { icon: 'activity', label: 'Medical Help' },
    { icon: 'phone-call', label: 'Emergency Contacts' },
    { icon: 'settings', label: 'Settings' },
    { icon: 'log-out', label: 'Logout' },
];

const Drawer = memo(function Drawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const slideX = useRef(new Animated.Value(-width * 0.76)).current;
    useEffect(() => {
        Animated.spring(slideX, {
            toValue: visible ? 0 : -width * 0.76,
            useNativeDriver: true, tension: 62, friction: 13,
        }).start();
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={s.drawerOverlay} activeOpacity={1} onPress={onClose} />
            <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
                <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={s.drawerHd}>
                    <View style={s.drawerAvatarRing}><Feather name="shield" size={26} color={T.onPrimary} /></View>
                    <Text style={s.drawerAppName}>ResQher</Text>
                    <Text style={s.drawerSub}>Emergency Assistance Platform</Text>
                </LinearGradient>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    {DRAWER_ITEMS.map((item, i) => (
                        <TouchableOpacity key={i} style={s.drawerRow} onPress={onClose} activeOpacity={0.65}>
                            <View style={s.drawerIconBox}><Feather name={item.icon} size={18} color={T.violet} /></View>
                            <Text style={s.drawerLabel}>{item.label}</Text>
                            <Feather name="chevron-right" size={14} color={T.ink4} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Animated.View>
        </Modal>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// NavTab — icon + label + 2px underline active indicator
// Spring micro-animation on press. No active blob/pill behind icon.
// ─────────────────────────────────────────────────────────────────────────────
const NavTab = memo(function NavTab({
    tab, isActive, onPress,
}: { tab: typeof NAV_TABS[number]; isActive: boolean; onPress: () => void }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePress = useCallback(() => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 14 }),
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
            <Animated.View style={[s.navTabInner, { transform: [{ scale }] }]}>
                {/* Active = filled/solid icon, Inactive = outline icon */}
                <Ionicons
                    name={(isActive ? tab.iconActive : tab.iconOutline) as any}
                    size={26}
                    color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
                />
                {/* 3px×16px dot — active indicator */}
                <View style={[s.navUnderline, { backgroundColor: isActive ? ACTIVE_COLOR : 'transparent' }]} />
            </Animated.View>
        </TouchableOpacity>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Live Beacon Marker (map marker in LIVE state)
// ─────────────────────────────────────────────────────────────────────────────
const LiveBeacon = memo(function LiveBeacon() {
    const ring1 = useRef(new Animated.Value(0)).current;
    const ring2 = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const pulse = (a: Animated.Value, delay: number) => {
            const loop = () => {
                a.setValue(0);
                Animated.timing(a, {
                    toValue: 1, duration: 1600,
                    easing: Easing.out(Easing.ease), useNativeDriver: true, delay,
                }).start(() => loop());
            };
            loop();
        };
        pulse(ring1, 0); pulse(ring2, 700);
    }, []);
    const ringStyle = (a: Animated.Value) => ({
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
        opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.18, 0] }),
    });
    return (
        <View style={lb.wrap}>
            <Animated.View style={[lb.ring, ringStyle(ring1)]} />
            <Animated.View style={[lb.ring, ringStyle(ring2)]} />
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
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function SOSScreen() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Safety');
    const [sosActive, setSosActive] = useState(false);
    const [cancelCountdown, setCancelCountdown] = useState(0);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready' | 'sharing'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState('');
    const [showHint, setShowHint] = useState(true);   // auto-hides after HINT_HIDE_MS
    const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isEmergencyLive = sosActive && cancelCountdown === 0;

    // Pulse ring anims (SOS active state)
    const p0s = useRef(new Animated.Value(1)).current; const p0o = useRef(new Animated.Value(0)).current;
    const p1s = useRef(new Animated.Value(1)).current; const p1o = useRef(new Animated.Value(0)).current;
    const p2s = useRef(new Animated.Value(1)).current; const p2o = useRef(new Animated.Value(0)).current;
    const pulseAnims = [
        { scale: p0s, op: p0o },
        { scale: p1s, op: p1o },
        { scale: p2s, op: p2o },
    ];

    // Auto-hide hint banner after HINT_HIDE_MS
    useEffect(() => {
        hintTimerRef.current = setTimeout(() => setShowHint(false), HINT_HIDE_MS);
        return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
    }, []);

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
    // Fires once on mount; continues as long as component exists.
    // scale 1.0 → 1.6; opacity 0.5 → 0.
    useEffect(() => {
        pulseAnims.forEach(({ scale, op }, i) => {
            const loop = () => {
                scale.setValue(1); op.setValue(0.55);
                Animated.parallel([
                    Animated.timing(scale, { toValue: 1.6, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    Animated.timing(op, { toValue: 0, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                ]).start(() => loop());
            };
            setTimeout(loop, i * 700); // staggered entry
        });
    }, []);

    // SOS logic
    const triggerSOS = useCallback(() => {
        setSosActive(true); setLocationStatus('sharing'); setCancelCountdown(CANCEL_DURATION);
    }, []);

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
    }, [sosActive, cancelCountdown === CANCEL_DURATION]);

    const cancelSOS = useCallback(() => {
        setSosActive(false); setCancelCountdown(0); setLocationStatus('ready');
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    }, []);

    const confirmStop = useCallback(() => {
        Alert.alert('Stop Emergency Alert?', 'Your location will no longer be shared.', [
            { text: 'Keep Active', style: 'cancel' },
            { text: 'Stop Alert', style: 'destructive', onPress: cancelSOS },
        ]);
    }, [cancelSOS]);

    const goToMyLoc = () => {
        if (userLoc) mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600);
    };

    // Derived bottom position for navbar — accounts for inset properly
    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            {isEmergencyLive && <EmergencyOverlay />}
            <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

            {/* Map */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                initialRegion={DEFAULT_REGION}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={false}
                moveOnMarkerPress={false}
                customMapStyle={mapStyle}
            >
                {userLoc && !isEmergencyLive && (
                    <Marker coordinate={userLoc} tracksViewChanges={false}>
                        <View style={s.markerOut}><View style={s.markerIn} /></View>
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
            {/* R.lg (16) radius — same surface family as navbar, less rounded */}
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
                    {/* LIVE chip inside header — only shown when live state */}
                    {isEmergencyLive && (
                        <View style={s.liveChip}>
                            <View style={s.liveDot} />
                            <Text style={s.liveChipTxt}>LIVE</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        style={s.hBtn}
                        onPress={() => Alert.alert('Notifications', 'No new notifications.')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="notifications-outline" size={20} color={T.ink2} />
                        <View style={s.notifDot} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={s.hBtn}
                        onPress={() => setDrawerOpen(true)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="menu-outline" size={22} color={T.ink2} />
                    </TouchableOpacity>
                </View>
            </PremiumBar>

            {/* ── Map controls (GPS pill + locate button) ─────────────────── */}
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
                <TouchableOpacity style={s.ctrlBtn} onPress={goToMyLoc}>
                    <Ionicons name="locate-outline" size={20} color={T.violet} />
                </TouchableOpacity>
            </View>

            {/* ── SOS Section ─────────────────────────────────────────────── */}
            {/* Anchored to screen vertical center + fixed offset — does NOT shift with pill banner */}
            <View
                pointerEvents="box-none"
                style={[
                    s.sosSection,
                    {
                        top: height / 2 - SOS_WRAP_SIZE / 2 - 20,
                    },
                ]}
            >
                <View style={s.sosWrap}>
                    {/* SOS button state machine */}
                    {sosActive && cancelCountdown > 0 ? (
                        // CANCEL state — countdown
                        <TouchableOpacity onPress={cancelSOS} activeOpacity={0.88}>
                            <View style={s.cancelBtn}>
                                <Text style={s.cancelLabel}>CANCEL</Text>
                                <Text style={s.cancelCount}>{cancelCountdown}s</Text>
                                <Text style={s.cancelSub}>Tap to cancel</Text>
                            </View>
                        </TouchableOpacity>
                    ) : isEmergencyLive ? (
                        // LIVE state — Android-safe circular button
                        <TouchableOpacity onPress={confirmStop} activeOpacity={0.82}>
                            <View style={[s.sosBtn, s.sosBtnEmg]}>
                                <View style={s.sosBtnDangerFill}>
                                    <Ionicons name="location-sharp" size={24} color={T.onDanger} />
                                    <Text style={s.sosTxt}>LIVE</Text>
                                    <Text style={s.sosSubTxt}>TAP TO STOP</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        // IDLE state — hold button
                        <HoldSosButton onTrigger={triggerSOS} />
                    )}

                    {/* Pulse rings — rendered AFTER button so waves are visible on top */}
                    {sosActive && pulseAnims.map(({ scale, op }, i) => (
                        <Animated.View key={i} pointerEvents="none" style={[s.pulseRing, {
                            transform: [{ scale }], opacity: op,
                            // Use T.danger directly for live state waves for max vibrance
                            borderColor: isEmergencyLive ? `${T.danger}73` : G.sosRingDefault,
                        }]} />
                    ))}
                </View>

                {/* Status pill banners */}
                {!sosActive && showHint && (
                    <View style={s.statusPill}>
                        <Text style={s.pillTxt}>Hold 2s to send emergency alert</Text>
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
                            onPress={() => setActiveTab(tab.id)}
                        />
                    ))}
                </PremiumBar>
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps custom style (clean, neutral)
// ─────────────────────────────────────────────────────────────────────────────
const mapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#F9FAFB' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#F9FAFB' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#F3F4F6' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E0E7FF' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F3F4F6' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },

    // ── Header — R.lg (16), same PremiumBar surface, slightly less round than navbar
    header: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: R.lg,   // 16
        zIndex: 300,
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 3 },
        }),
    },
    headerContent: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingVertical: 11,
    },
    locBox: { flex: 1, marginRight: S.s3 },
    locLabel: { fontSize: 8.5, fontWeight: '800', color: T.ink4, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 1 },
    locAddr: { fontSize: 13, fontWeight: '600', color: T.ink, letterSpacing: -0.1 },
    shimmer: { height: 11, width: '68%', borderRadius: R.xs, backgroundColor: T.line, marginTop: 2 },
    wText: { color: T.onPrimary },

    // LIVE chip inside header — minimal, uses dangerBg + dangerText tokens
    liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.dangerBg, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.dangerBorder, marginRight: S.s2 },
    liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.danger },
    liveChipTxt: { fontSize: 10, fontWeight: '800', color: T.dangerText, letterSpacing: 1.2 },

    // Header icon buttons — R.hBtn (13): consistent rounded-square
    headerBtns: { flexDirection: 'row', gap: S.s2, alignItems: 'center' },
    hBtn: {
        width: 36, height: 36,
        borderRadius: R.hBtn,  // 13
        backgroundColor: 'rgba(255,255,255,0.84)',
        borderWidth: 1, borderColor: `${T.violet}20`,
        alignItems: 'center', justifyContent: 'center',
    },
    notifDot: {
        position: 'absolute', top: 7, right: 7,
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface,
    },

    // ── Map controls (GPS status + locate crosshair)
    mapControls: { position: 'absolute', right: 14, gap: 8, alignItems: 'flex-end' },
    gpsPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: `${T.surface}F2`,
        borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5,
        borderWidth: 1, borderColor: T.line,
    },
    gpsPillEmg: { backgroundColor: `${T.dangerLight}F2`, borderColor: T.dangerBorder },
    gpsDot: { width: 6, height: 6, borderRadius: 3 },
    gpsTxt: { fontSize: 10, fontWeight: '700', color: T.ink2, letterSpacing: 0.5 },
    gpsTxtEmg: { color: T.dangerText },
    ctrlBtn: {
        width: 38, height: 38, borderRadius: R.hBtn,
        backgroundColor: T.surfaceGlass,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: `${T.violet}22`,
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 2 },
        }),
    },

    // ── Map markers
    markerOut: { width: 26, height: 26, borderRadius: 13, backgroundColor: `${T.violet}26`, alignItems: 'center', justifyContent: 'center' },
    markerIn: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: '#FFFFFF' },

    // ── SOS section
    // Note: NO explicit backgroundColor here — natural View transparency renders
    // the pulse rings (border-only Animated.Views) correctly on Android.
    // White square was caused by elevation on child buttons (now removed).
    sosSection: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
    sosWrap: { width: SOS_WRAP_SIZE, height: SOS_WRAP_SIZE, alignItems: 'center', justifyContent: 'center' },
    pulseRing: {
        position: 'absolute',
        width: SOS_BTN_SIZE,
        height: SOS_BTN_SIZE,
        borderRadius: SOS_BTN_SIZE / 2,
        borderWidth: 2.5,  // slightly thicker for presence
    },

    // SOS idle button — shadow on iOS only; no Android elevation (avoids white backdrop)
    sosBtn: {
        width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.13, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
            android: {},
        }),
    },
    // LIVE button outer shell — no elevation on Android for same reason
    sosBtnEmg: {
        ...Platform.select({
            ios: { shadowColor: T.danger, shadowOpacity: 0.20, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
            android: {},  // no elevation on Android — circle fill handles the visual
        }),
    },
    // LIVE fill: fills sosBtn circle with T.danger, clipped to circle shape.
    // No elevation here either — this is purely the color fill layer.
    sosBtnDangerFill: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: SOS_BTN_SIZE / 2,
        backgroundColor: T.danger,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },

    sosTxt: { color: T.onPrimary, fontSize: 32, fontWeight: '900', letterSpacing: 1 },
    sosSubTxt: { color: `${T.onPrimary}B3`, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

    // Cancel button (countdown state)
    cancelBtn: {
        width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2,
        backgroundColor: T.ink, borderWidth: 1.5, borderColor: `${T.dangerBorder}66`,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: T.ink, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
            android: { elevation: 8 },
        }),
    },
    cancelLabel: { color: `${T.onPrimary}8C`, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
    cancelCount: { color: T.dangerMid, fontSize: 40, fontWeight: '900', lineHeight: 44 },
    cancelSub: { color: `${T.onPrimary}59`, fontSize: 10, fontWeight: '500', marginTop: 3 },

    // Status pill (below SOS) — calm glass surface in idle/cancel, danger tint in LIVE
    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: T.surfaceGlass,
        borderRadius: R.full,
        paddingHorizontal: 16, paddingVertical: 8, marginTop: 16,
        borderWidth: 1, borderColor: `${T.violet}18`,
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 2 },
        }),
    },
    statusPillLive: {
        backgroundColor: T.dangerBg,
        borderColor: T.dangerBorder,
    },
    pillDot: { width: 7, height: 7, borderRadius: 3.5 },
    pillTxt: { fontSize: 10, fontWeight: '600', color: T.ink3, letterSpacing: 0.3, textTransform: 'uppercase' },
    pillTxtLive: { color: T.dangerText },

    // ── TRUE CAPSULE PILL NAVBAR — icons-only, bold active/outline inactive
    // Total height ≈ 50px: paddingV(11) + icon(26) + dot(3) + paddingV(11) = 51px
    // Generous top/bottom so icons never touch the pill edges (reference visual)
    navWrap: {
        position: 'absolute',
        left: 0, right: 0,
        alignItems: 'center',
        zIndex: 200,
    },
    navBar: {
        width: width * 0.88,
        borderRadius: R.pill,   // 999 — true capsule
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },
    navBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        paddingVertical: 8,     // balanced: not cramped, not bulky — ~46px total height
    },
    navTab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,          // accessible touch target, enough breathing room
    },
    navTabInner: {
        alignItems: 'center',
        gap: 0,
    },
    navLabel: {
        // not rendered; kept for TS compat only
        fontSize: 10, letterSpacing: 0.1,
    },
    // 3px × 16px pill dot — slim modern active indicator
    navUnderline: {
        width: 16, height: 3,
        borderRadius: 1.5,
        marginTop: 5,
    },

    // ── Drawer
    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: `${T.ink}61` },
    drawer: {
        position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.76,
        backgroundColor: T.surface,
        ...Platform.select({
            ios: { shadowColor: T.ink, shadowOpacity: 0.09, shadowRadius: 28, shadowOffset: { width: 4, height: 0 } },
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
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line,
    },
    drawerIconBox: { width: 36, height: 36, borderRadius: R.sm, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    drawerLabel: { flex: 1, fontSize: 14, color: T.ink, fontWeight: '600' },
});

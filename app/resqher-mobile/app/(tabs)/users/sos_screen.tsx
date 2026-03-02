/**
 * app/(tabs)/users/sos_screen.tsx
 * Canonical SOS screen — moved into the (tabs)/users/ group.
 * Import paths updated: ../../ → ../../../ (one level deeper)
 */

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert,
    Animated, Easing, Dimensions, StatusBar, Platform,
    Modal, ScrollView,
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

const { width, height } = Dimensions.get('window');

const SOS_BTN_SIZE = 156;
const SOS_WRAP_SIZE = 320;
const ARC_SIZE = SOS_BTN_SIZE + 20;
const ARC_RADIUS = ARC_SIZE / 2;

const CANCEL_DURATION = 10;
const HOLD_MS = 2000;

const NAV_HEIGHT = 60;
const NAV_BOTTOM_GAP = 10;
const SOS_BOTTOM = NAV_BOTTOM_GAP + NAV_HEIGHT + 24;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.014, longitudeDelta: 0.014,
};

// ─── Nav tab definition (Ionicons) ───────────────────────────────────────────
const NAV_TABS = [
    { id: 'Home', label: 'Home', icon: 'home-outline' as const },
    { id: 'Chat', label: 'Chat', icon: 'chatbubble-ellipses-outline' as const },
    { id: 'Explore', label: 'Explore', icon: 'compass-outline' as const },
    { id: 'Medical', label: 'Medical', icon: 'medkit-outline' as const },
] as const;

// ─── Pulse Radar ─────────────────────────────────────────────────────────────
const PulseRadar = memo(function PulseRadar() {
    const a0 = useRef(new Animated.Value(0)).current;
    const a1 = useRef(new Animated.Value(0)).current;
    const a2 = useRef(new Animated.Value(0)).current;
    const anims = [a0, a1, a2];

    useEffect(() => {
        anims.forEach((a, i) => {
            const loop = () => {
                a.setValue(0);
                Animated.timing(a, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true, delay: i * 660 }).start(() => loop());
            };
            loop();
        });
    }, []);

    return (
        <View style={rdr.wrap} pointerEvents="none">
            {anims.map((a, i) => (
                <Animated.View key={i} style={[rdr.ring, {
                    transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.6] }) }],
                    opacity: a.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.65, 0.3, 0] }),
                }]} />
            ))}
            <View style={rdr.dot} />
            <Text style={rdr.label}>Locating…</Text>
        </View>
    );
});
const rdr = StyleSheet.create({
    wrap: { position: 'absolute', alignSelf: 'center', top: height * 0.3, alignItems: 'center', zIndex: 5 },
    ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: `${T.violet}80` }, // T.violet with 50% opacity
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: T.surface },
    label: { marginTop: 14, fontSize: 11, fontWeight: '600', color: T.violet, letterSpacing: 0.3 },
});

// ─── Emergency border overlay ───────────────────────────────────────────────────
const EmergencyOverlay = memo(function EmergencyOverlay() {
    const op = useRef(new Animated.Value(0.35)).current;
    useEffect(() => {
        Animated.loop(Animated.sequence([
            Animated.timing(op, { toValue: 0.10, duration: 900, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        ])).start();
    }, []);
    // Subtle 2pt border ring using dangerBorder (soft rose) — not jarring full-screen red
    return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderWidth: 2, borderColor: T.dangerBorder, zIndex: 999, opacity: op }]} />;
});

// ─── Hold SOS Button (two-semicircle arc) ────────────────────────────────────
const HoldSosButton = memo(function HoldSosButton({ onTrigger }: { onTrigger: () => void }) {
    const progress = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const holdRef = useRef<Animated.CompositeAnimation | null>(null);
    const [holding, setHolding] = useState(false);

    const startHold = useCallback(() => {
        setHolding(true);
        Haptics.selectionAsync();
        Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 10 }).start();
        holdRef.current = Animated.timing(progress, {
            toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false,
        });
        holdRef.current.start(({ finished }) => {
            if (finished) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
    // Arc track ring: use violet to match the inactive SOS button
    arcTrack: { position: 'absolute', width: ARC_SIZE, height: ARC_SIZE, borderRadius: ARC_RADIUS, borderWidth: 4, borderColor: `${T.violet}33` },
    halfClip: { position: 'absolute', width: ARC_SIZE / 2, height: ARC_SIZE, overflow: 'hidden' },
    rightClip: { left: ARC_SIZE / 2 },
    leftClip: { left: 0 },
    // Arc fill: use primary violet for the progress arc
    halfFill: { position: 'absolute', width: ARC_SIZE, height: ARC_SIZE, borderRadius: ARC_RADIUS, borderWidth: 4, borderColor: T.violet, backgroundColor: 'transparent' },
    rightFill: { left: -ARC_SIZE / 2 },
    leftFill: { left: 0 },
});

// ─── Side Drawer ──────────────────────────────────────────────────────────────
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
        Animated.spring(slideX, { toValue: visible ? 0 : -width * 0.76, useNativeDriver: true, tension: 62, friction: 13 }).start();
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

// ─── Nav Tab ──────────────────────────────────────────────────────────────────
const ACTIVE_COLOR = T.violet;
const INACTIVE_COLOR = T.ink4;

const NavTab = memo(function NavTab({
    tab, isActive, onPress,
}: { tab: typeof NAV_TABS[number]; isActive: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity style={s.navTab} onPress={onPress} activeOpacity={0.7}
            accessibilityRole="tab" accessibilityState={{ selected: isActive }} accessibilityLabel={tab.label}>
            <Ionicons name={tab.icon} size={20} color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR} />
            <Text style={[s.navLabel, { color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR, fontWeight: isActive ? '700' : '500' }]}>
                {tab.label}
            </Text>
            <View style={[s.navUnderline, { backgroundColor: isActive ? ACTIVE_COLOR : 'transparent' }]} />
        </TouchableOpacity>
    );
});

// ─── Live Beacon Marker (shown on map when SOS is LIVE) ───────────────────────
const LiveBeacon = memo(function LiveBeacon() {
    const ring1 = useRef(new Animated.Value(0)).current;
    const ring2 = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const pulse = (a: Animated.Value, delay: number) => {
            const loop = () => {
                a.setValue(0);
                Animated.timing(a, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true, delay }).start(() => loop());
            };
            loop();
        };
        pulse(ring1, 0);
        pulse(ring2, 700);
    }, []);
    const ringStyle = (a: Animated.Value) => ({
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
        opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.2, 0] }),
    });
    return (
        <View style={lb.wrap}>
            <Animated.View style={[lb.ring, ringStyle(ring1)]} />
            <Animated.View style={[lb.ring, ringStyle(ring2)]} />
            <View style={lb.core}>
                <View style={lb.dot} />
            </View>
            <Text style={lb.label}>LIVE</Text>
        </View>
    );
});
const lb = StyleSheet.create({
    wrap: { alignItems: 'center' },
    ring: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: T.danger, top: -3 },
    core: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
    label: { marginTop: 3, fontSize: 8, fontWeight: '800', color: T.danger, letterSpacing: 1.1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SOSScreen() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Home');
    const [sosActive, setSosActive] = useState(false);
    const [cancelCountdown, setCancelCountdown] = useState(0);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready' | 'sharing'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState('');
    const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isEmergencyLive = sosActive && cancelCountdown === 0;

    const p0s = useRef(new Animated.Value(1)).current; const p0o = useRef(new Animated.Value(0)).current;
    const p1s = useRef(new Animated.Value(1)).current; const p1o = useRef(new Animated.Value(0)).current;
    const p2s = useRef(new Animated.Value(1)).current; const p2o = useRef(new Animated.Value(0)).current;
    const pulseAnims = [{ scale: p0s, op: p0o }, { scale: p1s, op: p1o }, { scale: p2s, op: p2o }];

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

    // Pulse rings
    useEffect(() => {
        pulseAnims.forEach(({ scale, op }, i) => {
            const loop = () => {
                scale.setValue(1); op.setValue(0.55);
                Animated.parallel([
                    Animated.timing(scale, { toValue: 1.55, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    Animated.timing(op, { toValue: 0, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                ]).start(() => loop());
            };
            setTimeout(loop, i * 800);
        });
    }, []);

    // SOS logic
    const triggerSOS = useCallback(() => {
        setSosActive(true); setLocationStatus('sharing'); setCancelCountdown(CANCEL_DURATION);
    }, []);

    useEffect(() => {
        if (!sosActive || cancelCountdown <= 0) return;
        cancelTimerRef.current = setInterval(() => {
            setCancelCountdown(prev => { if (prev <= 1) { clearInterval(cancelTimerRef.current!); return 0; } return prev - 1; });
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

    return (
        <View style={s.root}>
            <StatusBar barStyle={isEmergencyLive ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
            {isEmergencyLive && <EmergencyOverlay />}
            <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

            <MapView ref={mapRef} style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE} initialRegion={DEFAULT_REGION}
                showsUserLocation showsMyLocationButton={false} showsCompass={false}
                moveOnMarkerPress={false} customMapStyle={mapStyle}>
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

            {/* Header — stays neutral glass even in LIVE state */}
            <View style={[s.header, { top: insets.top + 8 }]}>
                <View style={s.locBox}>
                    <Text style={s.locLabel}>CURRENT LOCATION</Text>
                    {locationStatus === 'idle'
                        ? <View style={s.shimmer} />
                        : <Text style={s.locAddr} numberOfLines={1}>{address}</Text>
                    }
                </View>
                <View style={s.headerBtns}>
                    <TouchableOpacity style={s.hBtn}
                        onPress={() => Alert.alert('Notifications', 'No new notifications.')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="bell" size={19} color={T.ink} />
                        <View style={s.notifDot} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.hBtn}
                        onPress={() => setDrawerOpen(true)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="menu" size={20} color={T.ink} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* GPS + crosshair */}
            <View style={[s.mapControls, { bottom: insets.bottom + SOS_BOTTOM + SOS_WRAP_SIZE - 10 }]}>
                <View style={[s.gpsPill, isEmergencyLive && s.gpsPillEmg]}>
                    <View style={[s.gpsDot, { backgroundColor: locationStatus === 'sharing' ? T.danger : locationStatus === 'ready' ? T.success : T.ink4 }]} />
                    <Text style={[s.gpsTxt, isEmergencyLive && s.gpsTxtEmg]}>
                        {locationStatus === 'sharing' || locationStatus === 'ready' ? 'GPS' : '…'}
                    </Text>
                </View>
                <TouchableOpacity style={s.ctrlBtn} onPress={goToMyLoc}>
                    <Feather name="crosshair" size={17} color={T.violet} />
                </TouchableOpacity>
            </View>

            {/* SOS section */}
            <View pointerEvents="box-none" style={[s.sosSection, { bottom: insets.bottom + SOS_BOTTOM }]}>
                <View style={s.sosWrap}>
                    {sosActive && pulseAnims.map(({ scale, op }, i) => (
                        <Animated.View key={i} pointerEvents="none" style={[s.pulseRing, {
                            transform: [{ scale }], opacity: op,
                            borderColor: isEmergencyLive ? G.sosRingLive : G.sosRingDefault,
                        }]} />
                    ))}
                    {sosActive && cancelCountdown > 0 ? (
                        <TouchableOpacity onPress={cancelSOS} activeOpacity={0.88}>
                            <View style={s.cancelBtn}>
                                <Text style={s.cancelLabel}>CANCEL</Text>
                                <Text style={s.cancelCount}>{cancelCountdown}s</Text>
                                <Text style={s.cancelSub}>Tap to cancel</Text>
                            </View>
                        </TouchableOpacity>
                    ) : isEmergencyLive ? (
                        <TouchableOpacity onPress={confirmStop} activeOpacity={0.88}>
                            <LinearGradient colors={G.sosDanger.colors} start={G.sosDanger.start} end={G.sosDanger.end} style={[s.sosBtn, s.sosBtnEmg]}>
                                <Feather name="map-pin" size={20} color={T.onPrimary} />
                                <Text style={s.sosTxt}>LIVE</Text>
                                <Text style={s.sosSubTxt}>Tap to stop</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <HoldSosButton onTrigger={triggerSOS} />
                    )}
                </View>
                {!sosActive && <View style={s.pill}><Text style={s.pillTxt}>Hold 2s to send emergency alert</Text></View>}
                {sosActive && (
                    <View style={s.pill}>
                        <View style={[s.pillDot, { backgroundColor: cancelCountdown > 0 ? T.danger : T.violet }]} />
                        <Text style={s.pillTxt}>
                            {cancelCountdown > 0 ? `Alert triggered · Cancel in ${cancelCountdown}s` : 'Your location is being shared'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Navbar */}
            <View style={[s.navWrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
                <View style={s.navBar}>
                    {NAV_TABS.map(tab => (
                        <NavTab key={tab.id} tab={tab} isActive={activeTab === tab.id} onPress={() => setActiveTab(tab.id)} />
                    ))}
                </View>
            </View>
        </View>
    );
}

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

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },
    header: {
        position: 'absolute', left: 12, right: 12,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: T.surface,
        borderRadius: R.md, paddingHorizontal: S.s4, paddingVertical: 10,
        zIndex: 300, borderWidth: 1, borderColor: `${T.violet}20`,
        ...Platform.select({
            ios: { shadowColor: T.ink, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 6 },
        }),
    },
    // LIVE chip — small inline badge inside header
    liveChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: T.dangerBg,
        borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4,
        borderWidth: 1, borderColor: T.dangerBorder,
    },
    liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.danger },
    liveChipTxt: { fontSize: 10, fontWeight: '800', color: T.dangerText, letterSpacing: 1.2 },
    locBox: { flex: 1, marginRight: S.s3 },
    locLabel: { fontSize: 8.5, fontWeight: '800', color: T.ink4, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 1 },
    locAddr: { fontSize: 13, fontWeight: '600', color: T.ink, letterSpacing: -0.1 },
    // wText kept for any future dark-bg elements
    wText: { color: T.onPrimary },
    shimmer: { height: 11, width: '68%', borderRadius: R.xs, backgroundColor: T.line, marginTop: 2 },
    headerBtns: { flexDirection: 'row', gap: S.s2, alignItems: 'center' },
    hBtn: {
        width: 36, height: 36, borderRadius: R.sm,
        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: T.line,
        alignItems: 'center', justifyContent: 'center',
    },
    // hBtnEmg kept for any future dark-bg headers
    hBtnEmg: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)' },
    notifDot: {
        position: 'absolute', top: 7, right: 7,
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface,
    },
    mapControls: { position: 'absolute', right: 12, gap: 7, alignItems: 'flex-end' },
    gpsPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: `${T.surface}F0`,
        borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 5,
        borderWidth: 0.5, borderColor: T.line,
        ...Platform.select({
            ios: { shadowColor: T.ink, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 2 },
        }),
    },
    // LIVE state GPS pill: soft rose background, not saturated red
    gpsPillEmg: { backgroundColor: `${T.dangerLight}F0`, borderColor: T.dangerBorder },
    gpsDot: { width: 6, height: 6, borderRadius: 3 },
    gpsTxt: { fontSize: 10, fontWeight: '700', color: T.ink2, letterSpacing: 0.5 },
    gpsTxtEmg: { color: T.dangerText },
    ctrlBtn: {
        width: 36, height: 36, borderRadius: R.sm,
        backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: T.line,
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 2 },
        }),
    },
    markerOut: { width: 26, height: 26, borderRadius: 13, backgroundColor: `${T.violet}26`, alignItems: 'center', justifyContent: 'center' }, // 15% alpha
    markerIn: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: '#FFFFFF' },
    sosSection: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
    sosWrap: { width: SOS_WRAP_SIZE, height: SOS_WRAP_SIZE, alignItems: 'center', justifyContent: 'center' },
    pulseRing: { position: 'absolute', width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2, borderWidth: 2 },
    sosBtn: {
        width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
            android: { elevation: 10 },
        }),
    },
    sosBtnEmg: {
        ...Platform.select({
            ios: { shadowColor: T.danger, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
            android: { elevation: 10 },
        }),
    },
    sosTxt: { color: T.onPrimary, fontSize: 32, fontWeight: '900', letterSpacing: 1 },
    sosSubTxt: { color: `${T.onPrimary}B3`, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
    cancelBtn: {
        width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2,
        backgroundColor: T.ink, borderWidth: 1.5, borderColor: `${T.dangerBorder}66`,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: T.ink, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 10 },
        }),
    },
    cancelLabel: { color: `${T.onPrimary}8C`, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
    cancelCount: { color: T.dangerMid, fontSize: 40, fontWeight: '900', lineHeight: 44 },
    cancelSub: { color: `${T.onPrimary}59`, fontSize: 10, fontWeight: '500', marginTop: 3 },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 8, marginTop: 16,
        borderWidth: 1, borderColor: T.line,
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 2 },
        }),
    },
    pillDot: { width: 8, height: 8, borderRadius: 4 },
    pillTxt: { fontSize: 11, fontWeight: '700', color: T.ink2, letterSpacing: 0.2, textTransform: 'uppercase' },
    navWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 },
    navBar: {
        flexDirection: 'row', marginHorizontal: 12,
        backgroundColor: `${T.surface}F8`, // Slightly more opaque for the bottom bar
        borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 4,
        marginBottom: 10, justifyContent: 'space-around', alignItems: 'center',
        borderWidth: 1, borderColor: `${T.violet}20`,
        ...Platform.select({
            ios: { shadowColor: T.ink, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 6 },
        }),
    },
    navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 3, minHeight: 38, gap: 2 },
    navLabel: { fontSize: 9.5, letterSpacing: 0.1, marginTop: 1 },
    navUnderline: { width: 24, height: 3, borderRadius: 1.5, marginTop: 3 },
    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: `${T.ink}61` }, // 61 = ~38%
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
        backgroundColor: `${T.onPrimary}2E`, borderWidth: 2, borderColor: `${T.onPrimary}47`, // 2E = 18%, 47 = 28%
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    drawerAppName: { color: T.onPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
    drawerSub: { color: `${T.onPrimary}A6`, fontSize: 12, marginTop: 2, fontWeight: '500' }, // A6 = 65%
    drawerRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line,
    },
    drawerIconBox: { width: 36, height: 36, borderRadius: R.sm, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    drawerLabel: { flex: 1, fontSize: 14, color: T.ink, fontWeight: '600' },
});

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Animated,
    Easing,
    Dimensions,
    StatusBar,
    Platform,
    Modal,
    ScrollView,
    SafeAreaView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R, S, Ty } from '../../src/constants/theme';

const { width, height } = Dimensions.get('window');
const MAPS_KEY = 'AIzaSyBSdciGcsJ3mnlvBjGwKtE3ypIj-4llEq8';
const MAP_HEIGHT = height * 0.37;
const SOS_SIZE = 140;

// ─── Local color aliases for backward compatibility ───────────────────────
// Maps old hardcoded values to new global theme values
const LocalTheme = {
    primary: T.violet,           // Active color → brand purple
    primaryDark: T.violetDark,   // Dark state → dark purple
    bg: T.bgMuted,              // Muted background
    surface: T.surface,         // Pure white
    text: T.ink,                // Dark text
    muted: T.navIconMuted,      // Inactive icons → now #9B8AB5 (professional muted purple)
    mutedDark: T.ink3,          // Secondary text
    border: T.lineMid,          // Borders
    danger: T.danger,           // Alert/emergency
    success: T.success,         // Success state
};

const DEFAULT_REGION = {
    latitude: 23.8103,
    longitude: 90.4125,
    latitudeDelta: 0.014,
    longitudeDelta: 0.014,
};

// ────────────────────────────────────────────────────────────────────────────
// Drawer
// ────────────────────────────────────────────────────────────────────────────
function Drawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const slideX = useRef(new Animated.Value(-width * 0.76)).current;

    useEffect(() => {
        Animated.spring(slideX, {
            toValue: visible ? 0 : -width * 0.76,
            useNativeDriver: true,
            tension: 60,
            friction: 12,
        }).start();
    }, [visible]);

    const items: { icon: React.ComponentProps<typeof Feather>['name']; label: string }[] = [
        { icon: 'home', label: 'Home' },
        { icon: 'message-circle', label: 'Group Chat' },
        { icon: 'activity', label: 'Medical Help' },
        { icon: 'phone-call', label: 'Emergency Contacts' },
        { icon: 'settings', label: 'Settings' },
        { icon: 'log-out', label: 'Logout' },
    ];

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={s.drawerOverlay} activeOpacity={1} onPress={onClose} />
            <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
                <LinearGradient
                    colors={['#7C3AED', '#4C1D95']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.drawerHeader}
                >
                    <View style={s.drawerAvatarRing}>
                        <Feather name="shield" size={28} color="#fff" />
                    </View>
                    <Text style={s.drawerAppName}>ResQher</Text>
                    <Text style={s.drawerSub}>Emergency Assistance Platform</Text>
                </LinearGradient>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    {items.map((item, i) => (
                        <TouchableOpacity key={i} style={s.drawerItem} onPress={onClose} activeOpacity={0.65}>
                            <View style={s.drawerIconBox}>
                                <Feather name={item.icon} size={19} color={LocalTheme.primary} />
                            </View>
                            <Text style={s.drawerItemLabel}>{item.label}</Text>
                            <Feather name="chevron-right" size={15} color={LocalTheme.muted} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={s.drawerFooter}>
                    <Text style={s.drawerFooterTxt}>ResQher v1.0.0 · Stay safe</Text>
                </View>
            </Animated.View>
        </Modal>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Bottom Nav
// ────────────────────────────────────────────────────────────────────────────
function BottomNav({ active, onChange }: { active: string; onChange: (t: string) => void }) {
    const tabs: { id: string; label: string; icon: React.ComponentProps<typeof Feather>['name']; badge?: number }[] = [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'chat', label: 'Group Chat', icon: 'message-circle' },
        { id: 'medical', label: 'Medical', icon: 'activity', badge: 2 },
    ];

    return (
        <View style={s.bottomNav}>
            {tabs.map((tab) => {
                const isActive = active === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        style={s.navTab}
                        onPress={() => onChange(tab.id)}
                        activeOpacity={0.72}
                    >
                        {isActive && <View style={s.navPill} />}
                        <View style={[s.navIconBox, isActive && s.navIconBoxActive]}>
                            <Feather name={tab.icon} size={21} color={isActive ? LocalTheme.primary : LocalTheme.muted} />
                            {!!tab.badge && (
                                <View style={s.badge}>
                                    <Text style={s.badgeTxt}>{tab.badge}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[s.navLabel, isActive && s.navLabelActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Fullscreen Map Modal
// ────────────────────────────────────────────────────────────────────────────
function FullscreenModal({
    visible,
    region,
    markerCoord,
    userLoc,
    onClose,
}: {
    visible: boolean;
    region: typeof DEFAULT_REGION;
    markerCoord: { latitude: number; longitude: number } | null;
    userLoc: { latitude: number; longitude: number } | null;
    onClose: () => void;
}) {
    const fsRef = useRef<MapView>(null);

    useEffect(() => {
        if (visible) setTimeout(() => fsRef.current?.animateToRegion(region, 400), 350);
    }, [visible]);

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <View style={{ flex: 1 }}>
                <MapView
                    ref={fsRef}
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={region}
                    showsUserLocation
                    showsMyLocationButton={false}
                    showsCompass
                    customMapStyle={mapStyle}
                >
                    {markerCoord && (
                        <Marker coordinate={markerCoord} tracksViewChanges={false}>
                            <View style={s.markerOuter}><View style={s.markerInner} /></View>
                        </Marker>
                    )}
                </MapView>

                <SafeAreaView style={s.fsBar} pointerEvents="box-none">
                    <TouchableOpacity style={s.fsBtn} onPress={onClose} activeOpacity={0.85}>
                        <Feather name="arrow-left" size={20} color={LocalTheme.text} />
                    </TouchableOpacity>
                    <View style={s.fsTitlePill}>
                        <Feather name="map-pin" size={13} color={LocalTheme.primary} style={{ marginRight: 5 }} />
                        <Text style={s.fsTitleTxt}>Full Map View</Text>
                    </View>
                    <TouchableOpacity
                        style={s.fsBtn}
                        onPress={() =>
                            userLoc && fsRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500)
                        }
                        activeOpacity={0.85}
                    >
                        <Feather name="crosshair" size={20} color={LocalTheme.primary} />
                    </TouchableOpacity>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Screen
// ────────────────────────────────────────────────────────────────────────────
export default function SOSScreen() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const searchRef = useRef<any>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('home');
    const [sosActive, setSosActive] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready' | 'sharing'>('idle');

    const [currentRegion, setCurrentRegion] = useState(DEFAULT_REGION);
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [markerCoord, setMarkerCoord] = useState<{ latitude: number; longitude: number } | null>(null);

    // Animations
    const ring1Scale = useRef(new Animated.Value(1)).current;
    const ring1Op = useRef(new Animated.Value(0.55)).current;
    const ring2Scale = useRef(new Animated.Value(1)).current;
    const ring2Op = useRef(new Animated.Value(0.3)).current;
    const btnScale = useRef(new Animated.Value(1)).current;

    // ── Location ───────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location access is required for emergency assistance.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const { latitude, longitude } = pos.coords;
            setUserLoc({ latitude, longitude });
            setMarkerCoord({ latitude, longitude });
            const r = { latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 };
            setCurrentRegion(r);
            setTimeout(() => mapRef.current?.animateToRegion(r, 800), 600);

            const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geo.length > 0) {
                const g = geo[0];
                searchRef.current?.setAddressText(`${g.street ?? ''} ${g.city ?? ''}`.trim());
            }
            setLocationStatus('ready');
        })();
    }, []);

    // ── Pulse loop ─────────────────────────────────────────
    useEffect(() => {
        const loop = () => {
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(ring1Scale, { toValue: 1.2, duration: 750, easing: Easing.out(Easing.sin), useNativeDriver: true }),
                    Animated.timing(ring1Scale, { toValue: 1, duration: 750, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(ring1Op, { toValue: 0.05, duration: 750, useNativeDriver: true }),
                    Animated.timing(ring1Op, { toValue: 0.55, duration: 750, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(ring2Scale, { toValue: 1.45, duration: 1200, easing: Easing.out(Easing.sin), useNativeDriver: true }),
                    Animated.timing(ring2Scale, { toValue: 1, duration: 250, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(ring2Op, { toValue: 0, duration: 1200, useNativeDriver: true }),
                    Animated.timing(ring2Op, { toValue: 0.3, duration: 250, useNativeDriver: true }),
                ]),
            ]).start(() => loop());
        };
        loop();
    }, []);

    // ── SOS ────────────────────────────────────────────────
    const handleSOS = useCallback(() => {
        Animated.sequence([
            Animated.timing(btnScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
            Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 90, friction: 5 }),
        ]).start();

        setSosActive((prev) => {
            const next = !prev;
            setLocationStatus(next ? 'sharing' : 'ready');
            Alert.alert(
                next ? 'SOS Triggered' : 'SOS Cancelled',
                next ? 'Emergency services and contacts have been alerted with your location.' : 'Emergency alert has been cancelled.',
                [{ text: 'OK' }]
            );
            return next;
        });
    }, []);

    // ── Go to my location ──────────────────────────────────
    const goToMyLoc = () => {
        if (userLoc) {
            const r = { ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 };
            setCurrentRegion(r);
            mapRef.current?.animateToRegion(r, 600);
        }
    };

    const statusLabel =
        locationStatus === 'sharing'
            ? 'Your location is being shared'
            : locationStatus === 'ready'
                ? 'Location ready to share'
                : 'Detecting your location...';

    const statusColor =
        locationStatus === 'sharing' ? LocalTheme.danger
            : locationStatus === 'ready' ? LocalTheme.success
                : LocalTheme.muted;

    return (
        <SafeAreaView style={[s.root, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

            <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
            <FullscreenModal
                visible={fullscreen}
                region={currentRegion}
                markerCoord={markerCoord}
                userLoc={userLoc}
                onClose={() => setFullscreen(false)}
            />

            {/* ── HEADER ─────────────────────────────────────── */}
            <View style={s.header}>
                {/* Hamburger */}
                <TouchableOpacity
                    style={s.iconBtn}
                    onPress={() => setDrawerOpen(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                >
                    <Feather name="menu" size={22} color={LocalTheme.text} />
                </TouchableOpacity>

                {/* Search bar wrapper — icons are absolutely positioned inside */}
                <View style={s.searchWrap}>
                    {/* Search icon (left) */}
                    <View style={s.searchLeadIcon} pointerEvents="none">
                        <Feather name="search" size={17} color={LocalTheme.muted} />
                    </View>

                    {/* ── Google Places Autocomplete ─────────────── */}
                    <GooglePlacesAutocomplete
                        ref={searchRef}
                        placeholder="Search Google Maps"
                        fetchDetails
                        keyboardShouldPersistTaps="always"
                        enablePoweredByContainer={false}
                        listViewDisplayed="auto"
                        onPress={(data, details = null) => {
                            const loc = details?.geometry?.location;
                            if (!loc) return;
                            const newRegion = {
                                latitude: loc.lat,
                                longitude: loc.lng,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            };
                            setMarkerCoord({ latitude: loc.lat, longitude: loc.lng });
                            setCurrentRegion(newRegion);
                            mapRef.current?.animateToRegion(newRegion, 800);
                        }}
                        query={{ key: MAPS_KEY, language: 'en' }}
                        styles={{
                            container: {
                                flex: 1,
                                zIndex: 999,
                            },
                            textInputContainer: {
                                backgroundColor: 'transparent',
                                borderTopWidth: 0,
                                borderBottomWidth: 0,
                                marginHorizontal: 0,
                                paddingHorizontal: 0,
                            },
                            textInput: {
                                height: 44,
                                borderRadius: 14,
                                backgroundColor: LocalTheme.surface,
                                paddingLeft: 42,
                                paddingRight: 46,
                                fontSize: 14.5,
                                color: LocalTheme.text,
                                fontWeight: '500',
                                marginHorizontal: 0,
                                marginTop: 0,
                                shadowColor: LocalTheme.primaryDark,
                                shadowOpacity: 0.08,
                                shadowRadius: 10,
                                shadowOffset: { width: 0, height: 3 },
                                elevation: 3,
                            },
                            listView: {
                                position: 'absolute',
                                top: 50,
                                left: 0,
                                right: 0,
                                backgroundColor: T.surface,
                                borderRadius: 18,
                                overflow: 'hidden',
                                shadowColor: '#000',
                                shadowOpacity: 0.12,
                                shadowRadius: 16,
                                shadowOffset: { width: 0, height: 6 },
                                elevation: 14,
                                zIndex: 1000,
                            },
                            row: {
                                backgroundColor: T.surface,
                                paddingVertical: 0,
                                paddingHorizontal: 0,
                            },
                            separator: {
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: T.border,
                                marginHorizontal: 14,
                            },
                            poweredContainer: { display: 'none' },
                            powered: { display: 'none' },
                        }}
                        renderRow={(rowData) => (
                            <View style={s.suggRow}>
                                <View style={s.suggIconBox}>
                                    <Feather name="clock" size={14} color={LocalTheme.muted} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.suggMain} numberOfLines={1}>
                                        {rowData.structured_formatting?.main_text ?? rowData.description}
                                    </Text>
                                    {!!rowData.structured_formatting?.secondary_text && (
                                        <Text style={s.suggSub} numberOfLines={1}>
                                            {rowData.structured_formatting.secondary_text}
                                        </Text>
                                    )}
                                </View>
                                <Feather name="arrow-up-left" size={13} color={LocalTheme.muted} />
                            </View>
                        )}
                    />

                    {/* Crosshair button (right) */}
                    <TouchableOpacity style={s.searchTrailBtn} onPress={goToMyLoc} activeOpacity={0.75}>
                        <Feather name="crosshair" size={17} color={T.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── MAP ──────────────────────────────────────────── */}
            <View style={s.mapWrap}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={DEFAULT_REGION}
                    onRegionChangeComplete={setCurrentRegion}
                    showsUserLocation
                    showsMyLocationButton={false}
                    showsCompass={false}
                    moveOnMarkerPress={false}
                    customMapStyle={mapStyle}
                >
                    {markerCoord && (
                        <Marker coordinate={markerCoord} tracksViewChanges={false}>
                            <View style={s.markerOuter}><View style={s.markerInner} /></View>
                        </Marker>
                    )}
                </MapView>

                {/* Top-left fullscreen chip */}
                <TouchableOpacity style={s.fullChip} onPress={() => setFullscreen(true)} activeOpacity={0.85}>
                    <MaterialIcons name="fullscreen" size={16} color="#fff" />
                    <Text style={s.fullChipTxt}>Full map</Text>
                </TouchableOpacity>

                {/* Right side controls */}
                <View style={s.mapControls}>
                    <TouchableOpacity style={s.mapCtrlBtn} onPress={goToMyLoc}>
                        <Feather name="crosshair" size={19} color={T.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.mapCtrlBtn}>
                        <Ionicons name="navigate-outline" size={19} color={T.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── CONTENT ──────────────────────────────────────── */}
            <View style={s.content}>
                {/* Title */}
                <Text style={s.title}>Emergency Assistance</Text>

                {/* Status row — dot + label, centered */}
                <View style={s.statusRow}>
                    <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[s.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
                </View>

                {/* SOS Button */}
                <View style={s.sosWrapper}>
                    <Animated.View
                        style={[
                            s.ringOuter,
                            {
                                transform: [{ scale: ring2Scale }],
                                opacity: ring2Op,
                                backgroundColor: sosActive ? 'rgba(239,68,68,0.1)' : 'rgba(124,58,237,0.1)',
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            s.ringInner,
                            {
                                transform: [{ scale: ring1Scale }],
                                opacity: ring1Op,
                                backgroundColor: sosActive ? 'rgba(239,68,68,0.18)' : 'rgba(124,58,237,0.18)',
                            },
                        ]}
                    />
                    <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                        <TouchableOpacity onPress={handleSOS} activeOpacity={0.88}>
                            <LinearGradient
                                colors={['#f87171', '#EF4444', '#b91c1c']}
                                start={{ x: 0.1, y: 0 }}
                                end={{ x: 0.9, y: 1 }}
                                style={s.sosBtn}
                            >
                                <View style={s.sosGloss} />
                                <Feather name="alert-triangle" size={18} color="rgba(255,255,255,0.88)" style={{ marginBottom: 3 }} />
                                <Text style={s.sosTxt}>SOS</Text>
                                <Text style={s.sosSubTxt}>
                                    {sosActive ? 'Tap to cancel' : 'Tap to trigger\nemergency'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* Tip */}
                <View style={s.tipRow}>
                    <Feather name="info" size={12} color={T.muted} />
                    <Text style={s.tipTxt}> Keep location permission ON for faster response.</Text>
                </View>
            </View>

            {/* ── BOTTOM NAV ───────────────────────────────────── */}
            <BottomNav active={activeTab} onChange={setActiveTab} />
        </SafeAreaView>
    );
}

// ─── Map Style ──────────────────────────────────────────────────────────────
const mapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#ede9fe' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#1E1B4B' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#ddd6fe' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a78bfa' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f3ff' }] },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },

    // ── Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 6,
        paddingBottom: 10,
        backgroundColor: T.bg,
        gap: 10,
        zIndex: 200,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: T.surface,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: T.primaryDark,
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
        flexShrink: 0,
    },

    // ── Search
    searchWrap: {
        flex: 1,
        position: 'relative',
        zIndex: 999,
    },
    searchLeadIcon: {
        position: 'absolute',
        left: 14,
        top: 13,
        zIndex: 10,
    },
    searchTrailBtn: {
        position: 'absolute',
        right: 10,
        top: 10,
        zIndex: 10,
        width: 28,
        height: 28,
        borderRadius: 9,
        backgroundColor: 'rgba(124,58,237,0.09)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Suggestion rows
    suggRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    suggIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: T.bg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 11,
    },
    suggMain: { fontSize: 14, fontWeight: '600', color: T.text },
    suggSub: { fontSize: 12, color: T.muted, marginTop: 1 },

    // ── Map
    mapWrap: {
        width: '100%',
        height: MAP_HEIGHT,
        overflow: 'hidden',
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
        shadowColor: '#4C1D95',
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    fullChip: {
        position: 'absolute',
        top: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30,27,75,0.74)',
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 5,
    },
    fullChipTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
    mapControls: { position: 'absolute', right: 12, top: 12, gap: 8 },
    mapCtrlBtn: {
        width: 40,
        height: 40,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    markerOuter: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(124,58,237,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerInner: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: T.primary,
        borderWidth: 2.5,
        borderColor: '#fff',
    },

    // ── Content
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 6,
    },
    title: {
        fontSize: 21,
        fontWeight: '800',
        color: T.text,
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        gap: 7,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusLabel: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },

    // ── SOS Button
    sosWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        width: SOS_SIZE + 80,
        height: SOS_SIZE + 80,
    },
    ringOuter: {
        position: 'absolute',
        width: SOS_SIZE + 74,
        height: SOS_SIZE + 74,
        borderRadius: (SOS_SIZE + 74) / 2,
    },
    ringInner: {
        position: 'absolute',
        width: SOS_SIZE + 34,
        height: SOS_SIZE + 34,
        borderRadius: (SOS_SIZE + 34) / 2,
    },
    sosBtn: {
        width: SOS_SIZE,
        height: SOS_SIZE,
        borderRadius: SOS_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#DC2626',
        shadowOpacity: 0.55,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 10 },
        elevation: 14,
    },
    sosGloss: {
        position: 'absolute',
        top: 12,
        left: 22,
        width: SOS_SIZE * 0.5,
        height: SOS_SIZE * 0.24,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    sosTxt: {
        color: '#fff',
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: 2.5,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    sosSubTxt: {
        color: 'rgba(255,255,255,0.82)',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 3,
        lineHeight: 15,
    },

    // Tip
    tipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    tipTxt: { color: T.muted, fontSize: 12, fontWeight: '500' },

    // ── Bottom Nav
    bottomNav: {
        flexDirection: 'row',
        backgroundColor: T.surface,
        borderTopWidth: 1,
        borderTopColor: T.border,
        paddingBottom: Platform.OS === 'ios' ? 22 : 10,
        paddingTop: 8,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -2 },
        elevation: 10,
    },
    navTab: { flex: 1, alignItems: 'center', paddingTop: 2, position: 'relative' },
    navPill: {
        position: 'absolute',
        top: -8,
        width: 28,
        height: 3,
        borderRadius: 2,
        backgroundColor: T.primary,
    },
    navIconBox: {
        width: 42,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navIconBoxActive: { backgroundColor: 'rgba(124,58,237,0.1)' },
    navLabel: { fontSize: 10.5, color: T.muted, fontWeight: '500', marginTop: 2 },
    navLabelActive: { color: T.primary, fontWeight: '700' },
    badge: {
        position: 'absolute',
        top: -1,
        right: -1,
        backgroundColor: T.danger,
        borderRadius: 7,
        minWidth: 15,
        height: 15,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },

    // ── Drawer
    drawerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(30,27,75,0.45)',
    },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: width * 0.76,
        backgroundColor: T.surface,
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 22,
    },
    drawerHeader: {
        paddingTop: 56,
        paddingBottom: 30,
        paddingHorizontal: 22,
    },
    drawerAvatarRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    drawerAppName: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    drawerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 3, fontWeight: '500' },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: T.border,
    },
    drawerIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(124,58,237,0.07)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    drawerItemLabel: { flex: 1, fontSize: 14.5, color: T.text, fontWeight: '600' },
    drawerFooter: {
        paddingVertical: 18,
        alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: T.border,
    },
    drawerFooterTxt: { color: T.muted, fontSize: 12, fontWeight: '500' },

    // ── Fullscreen modal
    fsBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: Platform.OS === 'ios' ? 8 : 16,
        paddingBottom: 10,
        gap: 10,
    },
    fsBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.96)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    fsTitlePill: {
        flex: 1,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.96)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    fsTitleTxt: { color: T.text, fontSize: 14.5, fontWeight: '700' },
});



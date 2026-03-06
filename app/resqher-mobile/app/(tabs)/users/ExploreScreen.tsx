/**
 * app/(tabs)/users/ExploreScreen.tsx
 * Explore — Map view with animated search header, location card, and nav bar.
 */

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert,
    Dimensions, StatusBar, Platform, ViewStyle,
    TextInput, Keyboard, Pressable, Modal, ScrollView, Image,
} from 'react-native';
import { Animated as RNAnimated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { G } from '../../../src/constants/gradients';
import { T, R, S } from '../../../src/constants/theme';

const { width, height } = Dimensions.get('window');

const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.014, longitudeDelta: 0.014,
};

const ACTIVE_COLOR = T.violet;
const INACTIVE_COLOR = T.navIconInactive;

const NAV_TABS: { id: string; label: string; iconActive: string; iconOutline: string }[] = [
    { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline' },
    { id: 'Chat', label: 'Chat', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline' },
    { id: 'Explore', label: 'Explore', iconActive: 'compass', iconOutline: 'compass-outline' },
    { id: 'Medical', label: 'Medical', iconActive: 'medkit', iconOutline: 'medkit-outline' },
];

// ── PremiumBar — identical to SOS screen ────────────────────────────────────
const PremiumBar = memo(function PremiumBar({
    style, contentStyle, children,
}: { style?: ViewStyle | ViewStyle[]; contentStyle?: ViewStyle; children: React.ReactNode }) {
    return (
        <View style={[pb.bar, style]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={pb.tint} pointerEvents="none" />
            <View style={[pb.content, contentStyle]}>{children}</View>
        </View>
    );
});
const pb = StyleSheet.create({
    bar: { backgroundColor: T.surfaceGlass, borderWidth: 1, borderColor: `${T.violet}22`, overflow: 'hidden' },
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: T.surfaceOverlay },
    content: { flexDirection: 'row', alignItems: 'center' },
});

// ── PulseRadar — identical to SOS screen (locating state) ───────────────────
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

// ── Side Drawer ─────────────────────────────────────────────────────────────
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
            <TouchableOpacity style={dr.overlay} activeOpacity={1} onPress={onClose} />
            <RNAnimated.View style={[dr.drawer, { transform: [{ translateX: slideX }] }]}>
                <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={dr.hd}>
                    <View style={dr.avatarRing}><Feather name="shield" size={26} color={T.onPrimary} /></View>
                    <Text style={dr.appName}>ResQher</Text>
                    <Text style={dr.sub}>Emergency Assistance Platform</Text>
                </LinearGradient>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    {DRAWER_ITEMS.map((item, i) => (
                        <React.Fragment key={i}>
                            {item.danger && <View style={dr.divider} />}
                            <TouchableOpacity style={dr.row} onPress={onClose} activeOpacity={0.65}>
                                <View style={[dr.iconBox, item.danger && dr.iconBoxDanger]}>
                                    <Feather name={item.icon} size={18} color={item.danger ? T.danger : T.violet} />
                                </View>
                                <Text style={[dr.label, item.danger && dr.labelDanger]}>{item.label}</Text>
                                {!item.danger && <Feather name="chevron-right" size={14} color={T.ink4} />}
                            </TouchableOpacity>
                        </React.Fragment>
                    ))}
                </ScrollView>
            </RNAnimated.View>
        </Modal>
    );
});
const dr = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
    drawer: {
        position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.76,
        backgroundColor: T.surface,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 28, shadowOffset: { width: 4, height: 0 } },
            android: { elevation: 20 },
        }),
    },
    hd: { paddingTop: 52, paddingBottom: 26, paddingHorizontal: 20 },
    avatarRing: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: `${T.onPrimary}2E`, borderWidth: 2, borderColor: `${T.onPrimary}47`,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    appName: { color: T.onPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
    sub: { color: `${T.onPrimary}A6`, fontSize: 12, marginTop: 2, fontWeight: '500' },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.lineMid,
    },
    iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    iconBoxDanger: { backgroundColor: `${T.danger}18` },
    label: { flex: 1, fontSize: 14, color: T.ink, fontWeight: '600' },
    labelDanger: { color: T.danger },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.lineMid, marginHorizontal: 18, marginVertical: 6 },
});

// ── NavTab — identical to SOS screen ────────────────────────────────────────
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

// ── ExploreScreen ────────────────────────────────────────────────────────────
export default function ExploreScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const searchInputRef = useRef<TextInput>(null);

    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState('');
    const [searchActive, setSearchActive] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showLocationCard, setShowLocationCard] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Animation values
    const searchProgress = useRef(new RNAnimated.Value(0)).current; // 0 collapsed → 1 expanded
    const locationCardY = useRef(new RNAnimated.Value(300)).current;
    const locationCardOpacity = useRef(new RNAnimated.Value(0)).current;

    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    // Location
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location required', 'Please grant location access.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = pos.coords;
            setUserLoc({ latitude, longitude });
            setTimeout(() => mapRef.current?.animateToRegion(
                { latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 800
            ), 600);
            setLocationStatus('ready');
            try {
                const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geo.length > 0) {
                    const g = geo[0];
                    setAddress(
                        [g.street, g.district ?? g.subregion, g.city ?? g.region]
                            .filter(Boolean).join(', ') || 'Current location'
                    );
                }
            } catch {
                setAddress('Current location');
            }
        })();
    }, []);

    // Animate search bar expand
    const activateSearch = useCallback(() => {
        if (searchActive) return;
        setSearchActive(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
        RNAnimated.timing(searchProgress, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [searchActive, searchProgress]);

    // Animate search bar collapse
    const deactivateSearch = useCallback(() => {
        Keyboard.dismiss();
        setSearchActive(false);
        setSearchText('');
        RNAnimated.timing(searchProgress, {
            toValue: 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [searchProgress]);

    // Show location card
    const openLocationCard = useCallback(() => {
        if (!userLoc) return;
        setShowLocationCard(true);
        locationCardY.setValue(300);
        locationCardOpacity.setValue(0);
        mapRef.current?.animateToRegion(
            { ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600
        );
        RNAnimated.parallel([
            RNAnimated.spring(locationCardY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
            RNAnimated.timing(locationCardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
    }, [locationCardOpacity, locationCardY, userLoc]);

    // Hide location card
    const closeLocationCard = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(locationCardY, { toValue: 300, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(locationCardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setShowLocationCard(false));
    }, []);

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

            {/* ── Map ─────────────────────────────────────────────────────── */}
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
            />

            {locationStatus === 'idle' && <PulseRadar />}

            
            

            {/* ── Header with Animated Search ──────────────────────────────── */}
            <PremiumBar
                style={[s.header, { top: insets.top + 8 }]}
                contentStyle={s.headerContent}
            >
                {/** Back button — animates in when search expands */}
                <RNAnimated.View
                    style={{
                        width: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 36] }),
                        opacity: searchProgress,
                        transform: [{
                            translateX: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }),
                        }],
                        marginRight: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
                        overflow: 'hidden',
                    }}
                >
                    <TouchableOpacity
                        style={s.hBtn}
                        onPress={deactivateSearch}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="arrow-back" size={20} color={T.ink2} />
                    </TouchableOpacity>
                </RNAnimated.View>

                {/* Search bar — always visible, expands on focus */}
                <TouchableOpacity
                    style={s.searchBarWrap}
                    activeOpacity={1}
                    onPress={activateSearch}
                >
                    <Ionicons name="search-outline" size={16} color={T.ink4} style={s.searchIcon} />
                    <TextInput
                        ref={searchInputRef}
                        style={s.searchInput}
                        placeholder="Search location…"
                        placeholderTextColor={T.ink4}
                        value={searchText}
                        onChangeText={setSearchText}
                        onFocus={activateSearch}
                        returnKeyType="search"
                        selectionColor={T.violet}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={16} color={T.ink4} />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>

                {/** Notification + burger — animate out AND release space so search expands */}
                <RNAnimated.View
                    style={{
                        width: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [88, 0] }),
                        opacity: searchProgress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.25, 0] }),
                        transform: [{
                            translateX: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }),
                        }],
                        overflow: 'hidden',
                    }}
                    pointerEvents={searchActive ? 'none' : 'auto'}
                >
                    <View style={s.headerBtns}>
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
                        onPress={() => router.push('/(tabs)/users/profile-menu')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Open profile menu"
                        accessibilityRole="button"
                    >
                        <Image
                            source={require('../../../assets/images/icon.png')}
                            style={s.profileAvatar}
                        />
                    </TouchableOpacity>
                    </View>
                </RNAnimated.View>
            </PremiumBar>

            {/* ── Current location button ──────────────────────────────────── */}
            <View style={[s.mapControls, { top: height * 0.50 }]}>
                <TouchableOpacity
                    style={s.ctrlBtn}
                    onPress={openLocationCard}
                    accessibilityLabel="Show my location"
                    accessibilityRole="button"
                >
                    <Ionicons name="locate-outline" size={22} color={T.violet} />
                </TouchableOpacity>
            </View>

            {/* ── Location Card — slides up from bottom ───────────────────── */}
            {showLocationCard && (
                <>
                    <RNAnimated.View style={[s.locationBackdrop, { opacity: locationCardOpacity }]}> 
                        <Pressable style={StyleSheet.absoluteFill} onPress={closeLocationCard} />
                    </RNAnimated.View>

                    <RNAnimated.View style={[
                        s.locationCard,
                        { bottom: navBottom + NAV_HEIGHT + 16 },
                        { opacity: locationCardOpacity, transform: [{ translateY: locationCardY }] },
                    ]}>
                        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.locationCardTint} pointerEvents="none" />
                        <View style={s.locationCardGrabberWrap}>
                            <View style={s.locationCardGrabber} />
                        </View>
                        <View style={s.locationCardContent}>
                            <View style={s.locationCardLeft}>
                                <View style={s.locationCardIconWrap}>
                                    <Ionicons name="location" size={20} color={T.violet} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.locationCardTitle}>Your Location</Text>
                                    <Text style={s.locationCardAddr} numberOfLines={2}>
                                        {address || 'Fetching address…'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={s.locationCardClose}
                                onPress={closeLocationCard}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="chevron-down" size={22} color={T.ink3} />
                            </TouchableOpacity>
                        </View>
                    </RNAnimated.View>
                </>
            )}

            {/* ── Bottom Navbar ─────────────────────────────────────────────── */}
            <View style={[s.navWrap, { bottom: navBottom }]} pointerEvents="box-none">
                <PremiumBar style={s.navBar} contentStyle={s.navBarContent}>
                    {NAV_TABS.map(tab => (
                        <NavTab
                            key={tab.id}
                            tab={tab}
                            isActive={tab.id === 'Explore'}
                            onPress={() => {
                                if (tab.id === 'Home') {
                                    router.replace('/(tabs)/users/sos_screen');
                                    return;
                                }
                            }}
                        />
                    ))}
                </PremiumBar>
            </View>
        </View>
    );
}

// ── Tactical Map Style — identical to SOS screen ─────────────────────────────
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

// ── StyleSheet ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },

    // ── Crosshair ──────────────────────────────────────────────────────────
    crosshairWrap: {
        position: 'absolute', alignSelf: 'center',
        top: height * 0.29, // higher than center, closer to SOS screen feel
        alignItems: 'center', justifyContent: 'center',
        zIndex: 10, width: 40, height: 40,
    },
    crosshairH: {
        position: 'absolute', width: 28, height: 1.5,
        backgroundColor: T.violet, opacity: 0.85, borderRadius: 1,
    },
    crosshairV: {
        position: 'absolute', width: 1.5, height: 28,
        backgroundColor: T.violet, opacity: 0.85, borderRadius: 1,
    },
    crosshairDot: {
        width: 5, height: 5, borderRadius: 2.5,
        backgroundColor: T.violet,
    },

    // ── Header ─────────────────────────────────────────────────────────────
    header: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: R.lg, zIndex: 300,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    headerContent: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s3, paddingVertical: 9,
    },
    headerBtns: { flexDirection: 'row', gap: S.s2, alignItems: 'center', marginLeft: S.s2 },
    hBtn: {
        width: 36, height: 36, borderRadius: R.hBtn,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
    },
    profileAvatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
    },
    notifDot: {
        position: 'absolute', top: 7, right: 7,
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface,
    },

    // ── Search Bar ─────────────────────────────────────────────────────────
    searchBarWrap: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: T.surfaceCard,
        borderRadius: R.md,
        borderWidth: 1, borderColor: T.lineMid,
        paddingHorizontal: 10,
        height: 38,
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
        flex: 1,
        fontSize: 13, fontWeight: '500',
        color: T.ink,
        height: 38,
        padding: 0,
    },

    // ── Map controls ───────────────────────────────────────────────────────
    mapControls: { position: 'absolute', right: 14, gap: 8, alignItems: 'flex-end' },
    ctrlBtn: {
        width: 44, height: 44, borderRadius: R.hBtn,
        backgroundColor: T.surfaceGlass,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: T.lineBold,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },

    // ── Location Card ──────────────────────────────────────────────────────
    locationBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(3,3,8,0.26)',
        zIndex: 220,
    },
    locationCard: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: R.lg, overflow: 'hidden',
        borderWidth: 1, borderColor: `${T.violet}30`,
        zIndex: 250,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    locationCardGrabberWrap: {
        alignItems: 'center',
        paddingTop: 10,
    },
    locationCardGrabber: {
        width: 42,
        height: 4,
        borderRadius: 2,
        backgroundColor: T.lineBold,
        opacity: 0.75,
    },
    locationCardTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.80)' },
    locationCardContent: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingTop: 10, paddingBottom: 14,
        gap: S.s3,
    },
    locationCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.s3 },
    locationCardIconWrap: {
        width: 40, height: 40, borderRadius: R.hBtn,
        backgroundColor: `${T.violet}18`,
        borderWidth: 1, borderColor: `${T.violet}30`,
        alignItems: 'center', justifyContent: 'center',
    },
    locationCardTitle: { fontSize: 11, fontWeight: '700', color: T.ink4, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
    locationCardAddr: { fontSize: 13, fontWeight: '600', color: T.ink, letterSpacing: -0.1, lineHeight: 18 },
    locationCardClose: {
        width: 36, height: 36, borderRadius: R.hBtn,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
    },

    // ── Nav Bar ────────────────────────────────────────────────────────────
    navWrap: {
        position: 'absolute', left: 0, right: 0,
        alignItems: 'center', zIndex: 200,
    },
    navBar: {
        width: width * 0.88, borderRadius: R.pill,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    navBarContent: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8, paddingVertical: 8,
    },
    navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    navTabInner: { alignItems: 'center', gap: 0 },
    navUnderline: { width: 16, height: 3, borderRadius: 1.5, marginTop: 5 },
    navIconBox: {
        width: 36, height: 36, borderRadius: R.hBtn,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
    },
    navIconBoxActive: {
        backgroundColor: 'rgba(138,56,246,0.12)',
        borderColor: `${T.violet}40`,
    },
});


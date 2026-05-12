/**
 * MedicalMapView.tsx — Map-First Discovery Screen (V3.0)
 * ─────────────────────────────────────────────────────────────────────────
 * Full-screen map with:
 *  • Interactive provider pins (contextual to selected category)
 *  • Horizontal Quick Selector Chips above navbar
 *  • Bulky Glass callout bottom sheet on pin tap
 *  • Auto-triggered Electric Violet safe route polyline + Red Zone circles
 *  • Persistent Medical navbar tab glow
 *
 * Design: AtmosphericShell + Bulky Glass material + Tactical Dark Map.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, StatusBar,
    Dimensions, Platform, ScrollView, ViewStyle, Image,
} from 'react-native';
import { Animated as RNAnimated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { G } from '../../../../src/constants/gradients';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import {
    DOCTORS, HOSPITALS, AMBULANCES, DIAGNOSTICS, PHARMACIES,
    RED_ZONES, DEMO_SAFE_ROUTE,
    SPECIALIST_CHIPS, AMBULANCE_CHIPS, GENERIC_CHIPS,
} from '../../../../src/data/medicalMockData';
import type { MedicalCategory, ShiftFilter, QuickChip } from '../../../../src/types/medical';

const { width, height } = Dimensions.get('window');

const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14;
const ACTIVE_COLOR = T.violet;
const INACTIVE_COLOR = T.navIconInactive;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.03, longitudeDelta: 0.03,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
const D = {
    cardFill: T.surfaceBulky,
    cardFillActive: T.surfaceBulkyActive,
    hairline: 'rgba(255, 255, 255, 0.1)',
    hairlineActive: 'rgba(255, 255, 255, 0.1)',
    title: '#FFFFFF',
    subtitle: '#C4C1D4',
    muted: '#A09CB2',
    safeColor: '#10B981',
    dangerColor: 'rgba(255,59,48,0.3)',
    cardRadius: 16,
} as const;

// ── Nav tabs ────────────────────────────────────────────────────────────────
const NAV_TABS: { id: string; label: string; iconActive: string; iconOutline: string }[] = [
    { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline' },
    { id: 'Messages', label: 'Messages', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline' },
    { id: 'Activity', label: 'Activity', iconActive: 'time', iconOutline: 'time-outline' },
    { id: 'Medical', label: 'Medical', iconActive: 'medkit', iconOutline: 'medkit-outline' },
];

// ── Tactical Map Style ────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// PremiumBar — Bulky Glass bar (identical pattern across screens)
// ═══════════════════════════════════════════════════════════════════════════════
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
    bar: { backgroundColor: 'rgba(30,21,58,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: T.surfaceOverlay },
    content: { flexDirection: 'row', alignItems: 'center' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// NavTab — reusable nav item
// ═══════════════════════════════════════════════════════════════════════════════
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
            style={st.navTab}
            onPress={handlePress}
            activeOpacity={1}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
        >
            <RNAnimated.View style={[st.navTabInner, { transform: [{ scale }] }]}>
                <View style={[st.navIconBox, isActive && st.navIconBoxActive]}>
                    <Ionicons
                        name={(isActive ? tab.iconActive : tab.iconOutline) as any}
                        size={20}
                        color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
                    />
                </View>
                <View style={[st.navUnderline, { backgroundColor: isActive ? ACTIVE_COLOR : 'transparent' }]} />
            </RNAnimated.View>
        </TouchableOpacity>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// QuickChipRow — Horizontal scrolling chip selector
// ═══════════════════════════════════════════════════════════════════════════════
const QuickChipRow = memo(function QuickChipRow({
    chips, selected, onSelect,
}: { chips: QuickChip[]; selected: string; onSelect: (id: string) => void }) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.chipRowContent}
            style={st.chipRow}
        >
            {chips.map(chip => (
                <TouchableOpacity
                    key={chip.id}
                    style={[st.chip, selected === chip.id && st.chipActive]}
                    onPress={() => {
                        Haptics.selectionAsync();
                        onSelect(chip.id);
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={chip.icon as any}
                        size={14}
                        color={selected === chip.id ? T.violet : D.muted}
                    />
                    <Text style={[st.chipText, selected === chip.id && st.chipTextActive]}>
                        {chip.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper — generate a simple safe route between two points
// ═══════════════════════════════════════════════════════════════════════════════
function generateSafeRoute(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
): { latitude: number; longitude: number }[] {
    // Simple multi-point route with slight offset to simulate avoidance
    const midLat = (from.latitude + to.latitude) / 2;
    const midLng = (from.longitude + to.longitude) / 2;
    const offset = 0.003; // small detour
    return [
        from,
        { latitude: from.latitude - 0.002, longitude: from.longitude + offset },
        { latitude: midLat, longitude: midLng + offset * 0.5 },
        { latitude: to.latitude + 0.002, longitude: to.longitude - offset * 0.5 },
        to,
    ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MedicalMapView — Main Screen
// ═══════════════════════════════════════════════════════════════════════════════
export default function MedicalMapView() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ category?: string; shift?: string }>();
    const category = (params.category ?? 'specialists') as MedicalCategory;
    const shift = (params.shift ?? 'now') as ShiftFilter;

    const mapRef = useRef<MapView>(null);
    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedChip, setSelectedChip] = useState('all');
    const [selectedPin, setSelectedPin] = useState<string | null>(null);
    const [showCallout, setShowCallout] = useState(false);
    const [safeRoute, setSafeRoute] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const [returnFromWebView, setReturnFromWebView] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Load profile picture on screen focus
    useFocusEffect(
        useCallback(() => {
            getUserProfile().then(setProfile);
        }, []),
    );

    // Animations
    const calloutY = useRef(new RNAnimated.Value(400)).current;
    const calloutOpacity = useRef(new RNAnimated.Value(0)).current;

    // ── Contextual chips ────────────────────────────────────────────────────
    const chips = useMemo(() => {
        switch (category) {
            case 'specialists': return SPECIALIST_CHIPS;
            case 'ambulance': return AMBULANCE_CHIPS;
            default: return GENERIC_CHIPS;
        }
    }, [category]);

    // ── Provider pins data ──────────────────────────────────────────────────
    const providers = useMemo(() => {
        switch (category) {
            case 'specialists': {
                let docs = DOCTORS.filter(d => d.shift === shift);
                if (selectedChip !== 'all') {
                    docs = docs.filter(d => d.specialty === selectedChip);
                }
                return docs.map(d => ({
                    id: d.id, name: d.name,
                    latitude: d.latitude, longitude: d.longitude,
                    rating: d.rating ?? 0,
                    affiliation: d.affiliation ?? d.hospital,
                    bookingUrl: d.bookingUrl,
                    icon: 'medkit' as const,
                }));
            }
            case 'hospital':
                return HOSPITALS.map(h => ({
                    id: h.id, name: h.name,
                    latitude: h.latitude, longitude: h.longitude,
                    rating: h.rating ?? 0,
                    affiliation: h.affiliation ?? '',
                    bookingUrl: h.bookingUrl,
                    icon: 'business' as const,
                }));
            case 'ambulance': {
                let ambs = [...AMBULANCES];
                if (selectedChip !== 'all') {
                    ambs = ambs.filter(a => a.type === selectedChip);
                }
                return ambs.map(a => ({
                    id: a.id, name: a.providerName,
                    latitude: a.latitude, longitude: a.longitude,
                    rating: a.rating ?? 0,
                    affiliation: a.affiliation ?? '',
                    bookingUrl: '',
                    icon: 'car' as const,
                }));
            }
            case 'diagnostics':
                return DIAGNOSTICS.map(d => ({
                    id: d.id, name: d.name,
                    latitude: d.latitude, longitude: d.longitude,
                    rating: d.rating ?? 0,
                    affiliation: d.affiliation ?? '',
                    bookingUrl: d.bookingUrl,
                    icon: 'flask' as const,
                }));
            case 'pharmacy':
                return PHARMACIES.map(p => ({
                    id: p.id, name: p.name,
                    latitude: p.latitude, longitude: p.longitude,
                    rating: p.rating ?? 0,
                    affiliation: p.affiliation ?? '',
                    bookingUrl: '',
                    icon: 'bandage' as const,
                }));
            default:
                return [];
        }
    }, [category, shift, selectedChip]);

    // ── Selected provider details ───────────────────────────────────────────
    const selectedProvider = useMemo(() =>
        providers.find(p => p.id === selectedPin) ?? null,
        [providers, selectedPin]
    );

    // ── Screen title ────────────────────────────────────────────────────────
    const screenTitle = useMemo(() => {
        switch (category) {
            case 'specialists': return 'Specialists';
            case 'hospital': return 'Hospitals';
            case 'ambulance': return 'Ambulance';
            case 'diagnostics': return 'Diagnostics';
            case 'pharmacy': return 'Pharmacy';
            default: return 'Medical';
        }
    }, [category]);

    // ── Get user location ───────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setUserLoc(loc);
            setTimeout(() => {
                mapRef.current?.animateToRegion(
                    { ...loc, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 800
                );
            }, 600);
        })();
    }, []);

    // ── Pin tap handler — auto-trigger safe route ───────────────────────────
    const handlePinPress = useCallback((providerId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedPin(providerId);
        setShowCallout(true);

        // Animate callout in
        calloutY.setValue(400);
        calloutOpacity.setValue(0);
        RNAnimated.parallel([
            RNAnimated.spring(calloutY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
            RNAnimated.timing(calloutOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();

        // Auto-trigger safe route
        const provider = providers.find(p => p.id === providerId);
        if (provider && userLoc) {
            const route = generateSafeRoute(userLoc, { latitude: provider.latitude, longitude: provider.longitude });
            setSafeRoute(route);

            // Zoom to show both user and provider
            mapRef.current?.fitToCoordinates(
                [userLoc, { latitude: provider.latitude, longitude: provider.longitude }],
                { edgePadding: { top: 120, right: 60, bottom: 360, left: 60 }, animated: true }
            );
        }
    }, [providers, userLoc, calloutY, calloutOpacity]);

    // ── Close callout ───────────────────────────────────────────────────────
    const closeCallout = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(calloutY, { toValue: 400, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(calloutOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            setShowCallout(false);
            setSelectedPin(null);
            setSafeRoute(null);
        });
    }, [calloutY, calloutOpacity]);

    // ── Book Now → WebView ──────────────────────────────────────────────────
    const handleBookNow = useCallback(() => {
        if (!selectedProvider) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        router.push({
            pathname: '/(tabs)/users/standard-user/HospitalBookingWebView',
            params: {
                bookingUrl: selectedProvider.bookingUrl,
                hospitalName: selectedProvider.name,
                returnToMap: 'true',
            },
        } as any);
    }, [selectedProvider, router]);

    // ── Nav press ───────────────────────────────────────────────────────────
    const handleNavPress = useCallback((tabId: string) => {
        if (tabId === 'Home') {
            router.replace('/(tabs)/users/volunteer' as any);
        } else if (tabId === 'Messages') {
            router.push('/(tabs)/users/volunteer/messages' as any);
        } else if (tabId === 'Activity') {
            router.push('/(tabs)/users/volunteer/activity' as any);
        } else if (tabId === 'Medical') {
            // Already here
        }
    }, [router]);

    // ── Go back to dashboard ────────────────────────────────────────────────
    const handleBack = useCallback(() => {
        Haptics.selectionAsync();
        router.back();
    }, [router]);

    return (
        <AtmosphericShell>
            <View style={st.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Full-screen Map ── */}
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
                    onPress={() => {
                        if (showCallout) closeCallout();
                    }}
                >
                    {/* Provider Pins */}
                    {providers.map(p => (
                        <Marker
                            key={p.id}
                            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                            onPress={() => handlePinPress(p.id)}
                            tracksViewChanges={false}
                        >
                            <View style={[
                                st.pinContainer,
                                selectedPin === p.id && st.pinContainerActive,
                            ]}>
                                <Ionicons
                                    name={p.icon as any}
                                    size={18}
                                    color={selectedPin === p.id ? '#FFFFFF' : T.violet}
                                />
                            </View>
                        </Marker>
                    ))}

                    {/* Red Zone Circles — Always visible */}
                    {RED_ZONES.map(zone => (
                        <Circle
                            key={zone.id}
                            center={{ latitude: zone.latitude, longitude: zone.longitude }}
                            radius={zone.radiusMeters}
                            fillColor={D.dangerColor}
                            strokeColor="rgba(255,59,48,0.6)"
                            strokeWidth={1.5}
                        />
                    ))}

                    {/* Safe Route Polyline — Auto-triggered on pin select */}
                    {safeRoute && (
                        <Polyline
                            coordinates={safeRoute}
                            strokeColor={T.violet}
                            strokeWidth={5}
                            lineDashPattern={[0]}
                            lineJoin="round"
                            lineCap="round"
                        />
                    )}
                </MapView>

                {/* ── Top Header ── */}
                <View style={[st.topBar, { top: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={st.headerBtn}
                        onPress={handleBack}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Feather name="chevron-left" size={22} color={D.title} />
                    </TouchableOpacity>
                    <View style={st.headerTitleArea}>
                        <Text style={st.headerTitle}>{screenTitle}</Text>
                        <Text style={st.headerSubtitle}>Map Discovery</Text>
                    </View>
                    {/* Right spacer — matches back button width to center title */}
                    <TouchableOpacity
                        style={st.profileBtn}
                        onPress={() => router.push('/(tabs)/users/volunteer/profile-menu' as any)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Open profile menu"
                        accessibilityRole="button"
                    >
                        {profile?.photoUri ? (
                            <Image source={{ uri: profile.photoUri }} style={st.profileAvatar} />
                        ) : (
                            <Image
                                source={{ uri: 'https://i.pravatar.cc/150?img=47&u=demo-female' }}
                                style={st.profileAvatar}
                            />
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── 12px Breathing Space Spacer ──────────────────────────────── */}
                <View style={{ marginTop: 12 }} />

                {/* ── GPS / Recenter — Right-side floating glass container (SOS standard) ── */}
                <View style={[st.mapControls, { top: '35%' }]}>
                    <TouchableOpacity
                        style={st.ctrlBtn}
                        onPress={() => {
                            if (userLoc) {
                                mapRef.current?.animateToRegion(
                                    { ...userLoc, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600
                                );
                            }
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Recenter map"
                        accessibilityRole="button"
                    >
                        <Ionicons name="locate-outline" size={22} color={T.violet} />
                    </TouchableOpacity>
                </View>

                {/* ── Results Count Badge — 12px below header for breathing room ── */}
                <View style={[st.resultsBadge, { top: insets.top + 8 + 58 + 12 }]}>
                    <Text style={st.resultsBadgeText}>
                        {providers.length} {providers.length === 1 ? 'result' : 'results'}
                    </Text>
                </View>

                {/* ── Callout Bottom Sheet ── */}
                {showCallout && selectedProvider && (
                    <RNAnimated.View style={[
                        st.calloutWrap,
                        { bottom: navBottom + NAV_HEIGHT + 80 },
                        { opacity: calloutOpacity, transform: [{ translateY: calloutY }] },
                    ]}>
                        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={st.calloutTint} pointerEvents="none" />
                        <View style={st.calloutGrabberWrap}>
                            <View style={st.calloutGrabber} />
                        </View>
                        <View style={st.calloutContent}>
                            {/* Left — Info */}
                            <View style={st.calloutInfo}>
                                <View style={st.calloutIconWrap}>
                                    <Ionicons name={selectedProvider.icon as any} size={22} color={T.violet} />
                                </View>
                                <View style={st.calloutTextWrap}>
                                    <Text style={st.calloutName} numberOfLines={1}>
                                        {selectedProvider.name}
                                    </Text>
                                    <View style={st.calloutMetaRow}>
                                        <Ionicons name="star" size={12} color="#F59E0B" />
                                        <Text style={st.calloutRating}>
                                            {selectedProvider.rating.toFixed(1)}
                                        </Text>
                                    </View>
                                    {selectedProvider.affiliation ? (
                                        <Text style={st.calloutAffiliation} numberOfLines={1}>
                                            {selectedProvider.affiliation}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                            {/* Right — Actions */}
                            <View style={st.calloutActions}>
                                {selectedProvider.bookingUrl ? (
                                    <TouchableOpacity
                                        style={st.bookNowBtn}
                                        onPress={handleBookNow}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={G.navActive.colors}
                                            start={G.navActive.start}
                                            end={G.navActive.end}
                                            style={st.bookNowGradient}
                                        >
                                            <Text style={st.bookNowText}>Book Now</Text>
                                            <Ionicons name="arrow-forward" size={14} color={T.onPrimary} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={st.callBtn}
                                        onPress={() => Haptics.selectionAsync()}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="call" size={18} color={T.onPrimary} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={st.dismissBtn}
                                    onPress={closeCallout}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="close" size={16} color={D.muted} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {/* Safe Route Indicator */}
                        {safeRoute && (
                            <View style={st.safeRouteIndicator}>
                                <Ionicons name="shield-checkmark" size={14} color={D.safeColor} />
                                <Text style={st.safeRouteText}>Safe route calculated • Avoids red zones</Text>
                            </View>
                        )}
                    </RNAnimated.View>
                )}

                {/* ── Quick Selector Chips ── */}
                <View style={[st.chipContainer, { bottom: navBottom + NAV_HEIGHT + 12 }]}>
                    <QuickChipRow
                        chips={chips}
                        selected={selectedChip}
                        onSelect={setSelectedChip}
                    />
                </View>

                {/* ── Bottom Navbar ── */}
                <View style={[st.navWrap, { bottom: navBottom }]} pointerEvents="box-none">
                    <PremiumBar style={st.navBar} contentStyle={st.navBarContent}>
                        {NAV_TABS.map(tab => (
                            <NavTab
                                key={tab.id}
                                tab={tab}
                                isActive={tab.id === 'Medical'}
                                onPress={() => handleNavPress(tab.id)}
                            />
                        ))}
                    </PremiumBar>
                </View>
            </View>
        </AtmosphericShell>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
    root: { flex: 1 },

    // ── Top Header — Glassmorphic Pill (SOS standard) ────────────────────
    topBar: {
        position: 'absolute', left: 14, right: 14,
        flexDirection: 'row', alignItems: 'center',
        zIndex: 300,
        height: 58,
        borderRadius: 28,
        backgroundColor: 'rgba(30,21,58,0.65)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        paddingHorizontal: S.s4, paddingVertical: 8,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    headerBtn: {
        width: 36, height: 36, borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
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
    headerTitleArea: { flex: 1, alignItems: 'center' },
    headerTitle: {
        fontSize: 20, fontWeight: '700', color: D.title,
        letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
    },
    headerSubtitle: {
        fontSize: 11, fontWeight: '500', color: D.muted,
        marginTop: 0,
    },

    // ── GPS / Map Controls — right side floating glass (SOS standard) ──────
    mapControls: { position: 'absolute', right: 20, alignItems: 'flex-end', zIndex: 290 },
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

    // ── Results Badge ──────────────────────────────────────────────────────────
    resultsBadge: {
        position: 'absolute', left: 14,
        backgroundColor: D.cardFill,
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
        borderWidth: 1, borderColor: D.hairline,
        zIndex: 290,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },
    resultsBadgeText: {
        fontSize: 11, fontWeight: '700', color: T.violet,
        letterSpacing: 0.3,
    },

    // ── Pin ─────────────────────────────────────────────────────────────────
    pinContainer: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: D.cardFill,
        borderWidth: 2, borderColor: T.violet,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 8 },
        }),
    },
    pinContainerActive: {
        backgroundColor: T.violet,
        borderColor: '#FFFFFF',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 12 },
        }),
    },

    // ── Callout Bottom Sheet ────────────────────────────────────────────────
    calloutWrap: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: D.cardRadius, overflow: 'hidden',
        borderWidth: 1, borderColor: `${T.violet}30`,
        zIndex: 250,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    calloutTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.85)' },
    calloutGrabberWrap: { alignItems: 'center', paddingTop: 10 },
    calloutGrabber: {
        width: 42, height: 4, borderRadius: 2,
        backgroundColor: T.lineBold, opacity: 0.75,
    },
    calloutContent: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingTop: 12, paddingBottom: 14,
        gap: S.s3,
    },
    calloutInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.s3 },
    calloutIconWrap: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: `${T.violet}18`,
        borderWidth: 1, borderColor: `${T.violet}30`,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    calloutTextWrap: { flex: 1, gap: 2 },
    calloutName: {
        fontSize: 15, fontWeight: '700', color: D.title,
        letterSpacing: -0.1,
    },
    calloutMetaRow: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    calloutRating: {
        fontSize: 12, fontWeight: '700', color: '#F59E0B',
    },
    calloutAffiliation: {
        fontSize: 11, fontWeight: '500', color: D.muted,
    },
    calloutActions: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    bookNowBtn: {
        borderRadius: 12, overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    bookNowGradient: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 12,
    },
    bookNowText: {
        fontSize: 13, fontWeight: '800', color: T.onPrimary,
    },
    callBtn: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: T.success,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },
    dismissBtn: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: D.hairline,
        alignItems: 'center', justifyContent: 'center',
    },

    // ── Safe Route Indicator ────────────────────────────────────────────────
    safeRouteIndicator: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: S.s4, paddingBottom: 10,
    },
    safeRouteText: {
        fontSize: 10, fontWeight: '600', color: D.safeColor,
        letterSpacing: 0.2,
    },

    // ── Quick Selector Chips ────────────────────────────────────────────────
    chipContainer: {
        position: 'absolute', left: 0, right: 0,
        zIndex: 200,
    },
    chipRow: {
        paddingVertical: 4,
    },
    chipRowContent: {
        paddingHorizontal: 14, gap: 8,
    },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: D.cardFill,
        borderWidth: 1, borderColor: D.hairline,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },
    chipActive: {
        backgroundColor: D.cardFillActive,
        borderColor: D.hairlineActive,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    chipText: {
        fontSize: 12, fontWeight: '600', color: D.muted,
    },
    chipTextActive: {
        color: T.violet,
    },

    // ── Nav Bar ─────────────────────────────────────────────────────────────
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
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    navIconBoxActive: {
        backgroundColor: 'rgba(138,56,246,0.12)',
        borderColor: `${T.violet}40`,
    },
});

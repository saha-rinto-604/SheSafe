/**
 * app/(tabs)/users/standard-user/ExploreScreen.tsx
 * Explore — Map view with animated search header, location card, and nav bar.
 * Upgraded with dynamic Yellow/Red zoning rules and custom glass scan UI overlay.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert,
    Dimensions, StatusBar, Platform, ViewStyle,
    TextInput, Keyboard, KeyboardAvoidingView, Pressable, Modal, ScrollView, Image, PanResponder,
} from 'react-native';
import { Animated as RNAnimated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { G } from '../../../../src/constants/gradients';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import { incidentService, normalizeIncidentZone, safePlaceService, type IncidentZone } from '../../../../src/services/incidentService';
import api from '../../../../src/services/api';
import type { PlaceIncident } from '../../../../src/data/dhakaIncidents';
import { evaluateRouteSafety, haversineDistance, type LatLng } from '../../../../src/utils/routeSafety';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const { width, height } = Dimensions.get('window');

const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.014, longitudeDelta: 0.014,
};

/** Zero-trust coordinate sanitizer — validates lat/lng before forwarding to any external service. */
function sanitizeCoordinate(lat: number, lng: number): { latitude: number; longitude: number } | null {
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
}

/** Exponential backoff retry for network requests. */
async function fetchWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 500,
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
            }
        }
    }
    throw lastError;
}

function isRedIncidentZone(zone: any): boolean {
    const incidentCount = Number(zone?.incidentCount ?? zone?.incident_count ?? zone?.count ?? zone?.incidents?.length ?? 0);
    return incidentCount >= 5;
}

function formatIncidentTime(value?: string | Date | null): string {
    if (!value) return 'Recently';
    const date = value instanceof Date ? value : new Date(value);
    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs)) return 'Recently';
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/** Returns an object indicating safety and the name of the avoided zone if applicable. */
function checkRouteSafety(coordinates: LatLng[], zones: any[]): { isSafe: boolean; blockedZoneName?: string } {
    if (coordinates.length === 0) return { isSafe: true };

    for (let i = 0; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];

        for (const zone of zones) {
            if (!isRedIncidentZone(zone)) continue;
            if (haversineDistance(p1, zone) <= zone.radius) {
                return { isSafe: false, blockedZoneName: zone.name };
            }
        }

        const dist = haversineDistance(p1, p2);
        const SEGMENT_CHECK_INTERVAL_M = 20;

        if (dist > SEGMENT_CHECK_INTERVAL_M) {
            const steps = Math.ceil(dist / SEGMENT_CHECK_INTERVAL_M);
            for (let j = 1; j < steps; j++) {
                const fraction = j / steps;
                const interpPoint = {
                    latitude: p1.latitude + (p2.latitude - p1.latitude) * fraction,
                    longitude: p1.longitude + (p2.longitude - p1.longitude) * fraction
                };

                for (const zone of zones) {
                    if (!isRedIncidentZone(zone)) continue;
                    if (haversineDistance(interpPoint, zone) <= zone.radius) {
                        return { isSafe: false, blockedZoneName: zone.name };
                    }
                }
            }
        }
    }

    const lastPoint = coordinates[coordinates.length - 1];
    for (const zone of zones) {
        if (!isRedIncidentZone(zone)) continue;
        if (haversineDistance(lastPoint, zone) <= zone.radius) {
            return { isSafe: false, blockedZoneName: zone.name };
        }
    }

    return { isSafe: true };
}

/** Computes route risk dynamically — heavily penalizes Red blocks while tracking Yellow cells gently */
function getRouteRiskScore(coordinates: LatLng[], zones: any[]): number {
    let score = 0;
    if (coordinates.length === 0) return 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];

        for (const zone of zones) {
            if (haversineDistance(p1, zone) <= zone.radius) {
                score += isRedIncidentZone(zone) ? 25 : 1;
            }
        }

        const dist = haversineDistance(p1, p2);
        if (dist > 20) {
            const steps = Math.ceil(dist / 20);
            for (let j = 1; j < steps; j++) {
                const fraction = j / steps;
                const interpPoint = {
                    latitude: p1.latitude + (p2.latitude - p1.latitude) * fraction,
                    longitude: p1.longitude + (p2.longitude - p1.longitude) * fraction
                };
                for (const zone of zones) {
                    if (haversineDistance(interpPoint, zone) <= zone.radius) {
                        score += isRedIncidentZone(zone) ? 25 : 1;
                    }
                }
            }
        }
    }
    return score;
}

const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, '');

type NavStep = {
    instruction: string;
    distance: string;
    maneuver?: string;
    endLocation?: LatLng;
};

function getManeuverIcon(maneuver?: string): string {
    if (!maneuver) return 'arrow-up';
    const m = maneuver.toLowerCase();
    if (m.includes('uturn')) return 'return-up-back';
    if (m.includes('left')) return 'arrow-back';
    if (m.includes('right')) return 'arrow-forward';
    if (m.includes('merge')) return 'git-merge';
    if (m.includes('roundabout')) return 'sync';
    if (m.includes('fork')) return 'git-branch';
    return 'arrow-up';
}

const ACTIVE_COLOR = T.violet;
const INACTIVE_COLOR = T.navIconInactive;

const NAV_TABS: { id: string; label: string; iconActive: string; iconOutline: string }[] = [
    { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline' },
    { id: 'Chat', label: 'Chat', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline' },
    { id: 'Explore', label: 'Explore', iconActive: 'compass', iconOutline: 'compass-outline' },
    { id: 'Medical', label: 'Medical', iconActive: 'medkit', iconOutline: 'medkit-outline' },
];

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

type PlacePrediction = {
    id: string;
    name: string;
    address: string;
    placeId: string;
};

type PlaceSuggestion = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    placeId?: string;
};

const AUTOCOMPLETE_DEBOUNCE_MS = 260;
const createSessionToken = () => Math.random().toString(36).slice(2);

const buildAutocompleteUrl = (input: string, sessionToken: string, bias: LatLng) => {
    const encodedInput = encodeURIComponent(input);
    const location = `${bias.latitude},${bias.longitude}`;
    const radius = 50000;
    return `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedInput}&key=${GOOGLE_MAPS_API_KEY}&location=${location}&radius=${radius}&components=country:bd&language=en&sessiontoken=${sessionToken}`;
};

const buildPlaceDetailsUrl = (placeId: string, sessionToken: string) => (
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry/location&key=${GOOGLE_MAPS_API_KEY}&language=en&sessiontoken=${sessionToken}`
);

function decodePolyline(encoded: string): LatLng[] {
    let index = 0, lat = 0, lng = 0;
    const coordinates: LatLng[] = [];

    while (index < encoded.length) {
        let result = 0, shift = 0, byte = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += deltaLat;

        result = 0; shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += deltaLng;

        coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return coordinates;
}

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
    ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: T.brandGlow, overflow: 'hidden' },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: T.surface, overflow: 'hidden' },
    label: { marginTop: 14, fontSize: 11, fontWeight: '600', color: T.violet, letterSpacing: 0.3 },
});

// ── Redesigned Premium Safety Scan Overlay (Unified Glassmorphic UI Modal System) ──
type ScanState = 'SCANNING' | 'PARTIAL_SAFETY' | 'NO_ROUTE' | 'TRANSIT_ERROR' | null;

const SafetyScanOverlay = memo(function SafetyScanOverlay({
    scanState, spinAnim, r0, r1, r2, zoneName, onClose
}: {
    scanState: ScanState; spinAnim: RNAnimated.Value;
    r0: RNAnimated.Value; r1: RNAnimated.Value; r2: RNAnimated.Value;
    zoneName: string | null;
    onClose: () => void;
}) {
    if (!scanState) return null;

    const isScanning = scanState === 'SCANNING';

    let icon = 'shield-checkmark';
    let color = '#8A38F6';
    let title = 'Safety Scan Running';
    let subtitle = `Checking safe route around ${zoneName ?? 'current path'}...`;

    if (scanState === 'PARTIAL_SAFETY') {
        icon = 'warning';
        color = '#E25B3A';
        title = 'Partial Safety';
        subtitle = 'No fully safe route found. Showing the least risky option.';
    } else if (scanState === 'NO_ROUTE') {
        icon = 'close-circle';
        color = '#EF4444';
        title = 'No Safe Route';
        subtitle = 'All available routes pass through restricted zones.';
    } else if (scanState === 'TRANSIT_ERROR') {
        icon = 'bus';
        color = '#E25B3A';
        title = 'Fixed Transit Lines';
        subtitle = 'Public transit follows fixed routes and cannot be detoured around this Red Zone.';
    }

    return (
        <View style={scanStyles.backdrop}>
            <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={scanStyles.card}>
                <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={scanStyles.cardTint} />

                {/* Concentric Glow Sonar Assembly */}
                <View style={scanStyles.iconOuterContainer}>
                    {isScanning && [r0, r1, r2].map((a, i) => (
                        <RNAnimated.View key={i} style={[scanStyles.pulseRing, {
                            borderColor: color,
                            transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.45] }) }],
                            opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.65, 0.3, 0] }),
                        }]} />
                    ))}
                    <View style={[scanStyles.iconCircle, { backgroundColor: color }]}>
                        <Ionicons name={icon as any} size={26} color="#FFFFFF" />
                    </View>
                </View>

                <Text style={scanStyles.title}>{title}</Text>
                <Text style={scanStyles.subtitle}>{subtitle}</Text>

                {!isScanning && (
                    <TouchableOpacity style={[scanStyles.btn, { backgroundColor: color }]} onPress={onClose}>
                        <Text style={scanStyles.btnText}>Acknowledge</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
});

const scanStyles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(3, 2, 6, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    card: {
        width: width * 0.82,
        paddingVertical: 36,
        paddingHorizontal: 24,
        borderRadius: 24,
        overflow: 'hidden',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
            android: { elevation: 12 },
        }),
    },
    cardTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 11, 28, 0.88)',
        zIndex: -1,
    },
    iconOuterContainer: {
        width: 90,
        height: 90,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#8A38F6',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    pulseRing: {
        position: 'absolute',
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 1.5,
        borderColor: '#8A38F6',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: -0.2,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#C4C1D4',
        textAlign: 'center',
        lineHeight: 18,
    },
    btn: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 999,
        width: '100%',
        alignItems: 'center',
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

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
                    <Text style={dr.appName}>SheSafe</Text>
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
        position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.76, backgroundColor: T.surface,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 28, shadowOffset: { width: 4, height: 0 } },
            android: { elevation: 20 },
        }),
    },
    hd: { paddingTop: 52, paddingBottom: 26, paddingHorizontal: 20 },
    avatarRing: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: `${T.onPrimary}2E`, borderWidth: 2, borderColor: `${T.onPrimary}47`,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden',
    },
    appName: { color: T.onPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
    sub: { color: `${T.onPrimary}A6`, fontSize: 12, marginTop: 2, fontWeight: '500' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.lineMid },
    iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    iconBoxDanger: { backgroundColor: `${T.danger}18` },
    label: { flex: 1, fontSize: 14, color: T.ink, fontWeight: '600' },
    labelDanger: { color: T.danger },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.lineMid, marginHorizontal: 18, marginVertical: 6 },
});

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

export default function ExploreScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const searchInputRef = useRef<TextInput>(null);
    const startInputRef = useRef<TextInput>(null);

    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
    const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'motorcycle' | 'transit'>('walking');
    const [isLiveNav, setIsLiveNav] = useState(false);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [completedRouteCoords, setCompletedRouteCoords] = useState<LatLng[]>([]);
    const [remainingRouteCoords, setRemainingRouteCoords] = useState<LatLng[]>([]);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [address, setAddress] = useState('');
    const [searchActive, setSearchActive] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showLocationCard, setShowLocationCard] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
    const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
    const [placeIncidents, setPlaceIncidents] = useState<PlaceIncident[]>([]);
    const [placeSheetOpen, setPlaceSheetOpen] = useState(false);
    const [placeSheetIsDangerZone, setPlaceSheetIsDangerZone] = useState(false);
    const [directionsMode, setDirectionsMode] = useState(false);
    const [startLocation, setStartLocation] = useState<PlaceSuggestion | null>(null);
    const [endLocation, setEndLocation] = useState<PlaceSuggestion | null>(null);
    const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
    const [startSearchActive, setStartSearchActive] = useState(false);
    const [startSearchText, setStartSearchText] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState<PlacePrediction[]>([]);
    const [startSuggestions, setStartSuggestions] = useState<PlacePrediction[]>([]);
    const [searchStatus, setSearchStatus] = useState<string | null>(null);
    const [startStatus, setStartStatus] = useState<string | null>(null);
    const searchSessionTokenRef = useRef<string | null>(null);
    const startSessionTokenRef = useRef<string | null>(null);
    const searchRequestIdRef = useRef(0);
    const startRequestIdRef = useRef(0);
    const [navInstructions, setNavInstructions] = useState<NavStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    // ── Live Navigation Audio Engine ──
    const lastSpokenStepRef = useRef<number>(-1);
    useEffect(() => {
        if (isLiveNav && audioEnabled && navInstructions.length > 0 && currentStepIdx !== lastSpokenStepRef.current) {
            const instruction = navInstructions[currentStepIdx]?.instruction;
            if (instruction) {
                Speech.stop();
                setTimeout(() => {
                    Speech.speak(instruction, {
                        language: 'en',
                        pitch: 1.0,
                        rate: Platform.OS === 'android' ? 0.9 : 0.95,
                    });
                }, 100);
                lastSpokenStepRef.current = currentStepIdx;
            }
        }
        if (!isLiveNav) {
            lastSpokenStepRef.current = -1;
        }
    }, [isLiveNav, audioEnabled, currentStepIdx, navInstructions]);

    const [placeSheetMode, setPlaceSheetMode] = useState<'incidents' | 'safe_place'>('incidents');
    const [safePlaceAnswer, setSafePlaceAnswer] = useState('');
    const [safePlaceSubmitState, setSafePlaceSubmitState] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [safePlaceError, setSafePlaceError] = useState<string | null>(null);
    const safePlaceSuccessAnim = useRef(new RNAnimated.Value(0)).current;

    const [routeUnsafe, setRouteUnsafe] = useState(false);
    const [blockedZoneName, setBlockedZoneName] = useState<string | null>(null);
    const [scanState, setScanState] = useState<ScanState>(null);
    const [unsafeRouteCoords, setUnsafeRouteCoords] = useState<LatLng[]>([]);
    const [safeRouteCoords, setSafeRouteCoords] = useState<LatLng[]>([]);
    const [showSafePath, setShowSafePath] = useState(false);
    const scanAnim = useRef(new RNAnimated.Value(0)).current;
    const radarAnim0 = useRef(new RNAnimated.Value(0)).current;
    const radarAnim1 = useRef(new RNAnimated.Value(0)).current;
    const radarAnim2 = useRef(new RNAnimated.Value(0)).current;

    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const isMountedRef = useRef(true);
    const routeRequestIdRef = useRef(0);
    const safePathRequestIdRef = useRef(0);
    const navigationGuardRef = useRef(false);

    const navigateSafely = useCallback((path: string, replace = false) => {
        if (navigationGuardRef.current) return;
        navigationGuardRef.current = true;
        Keyboard.dismiss();
        Speech.stop();
        routeRequestIdRef.current += 1;
        safePathRequestIdRef.current += 1;
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        setIsLiveNav(false);
        setAudioEnabled(false);
        setSearchActive(false);
        setStartSearchActive(false);
        setShowLocationCard(false);
        setPlaceSheetOpen(false);
        setDrawerOpen(false);
        setScanState(null);
        if (replace) {
            router.replace(path as any);
        } else {
            router.push(path as any);
        }
        setTimeout(() => { navigationGuardRef.current = false; }, 800);
    }, [router]);

    const [incidentZones, setIncidentZones] = useState<IncidentZone[]>([]);
    const [zonesLoading, setZonesLoading] = useState(true);
    const [zonesError, setZonesError] = useState<string | null>(null);

    const normalizedIncidentZones = useMemo(() => {
        return (incidentZones || [])
            .map(normalizeIncidentZone)
            .filter((zone): zone is IncidentZone => zone !== null && zone.incidentCount >= 1);
    }, [incidentZones]);

    const clearRouteState = useCallback(() => {
        routeRequestIdRef.current += 1;
        safePathRequestIdRef.current += 1;
        setDirectionsMode(false);
        setIsLiveNav(false);
        setStartSearchActive(false);
        setStartSearchText('');
        setStartSuggestions([]);
        setStartStatus(null);
        startSessionTokenRef.current = null;
        startRequestIdRef.current = 0;
        setStartLocation(null);
        setEndLocation(null);
        setRouteCoords([]);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setRouteUnsafe(false);
        setBlockedZoneName(null);
        setShowSafePath(false);
        setScanState(null);
        setSafeRouteCoords([]);
        setUnsafeRouteCoords([]);
        Speech.stop();
    }, []);

    const fetchLiveZones = useCallback(async () => {
        try {
            const zones = await fetchWithRetry(() => incidentService.getZones(), 3, 500);
            const sanitized = (zones || []).filter(z => {
                const valid = sanitizeCoordinate(Number(z?.latitude), Number(z?.longitude));
                return valid !== null;
            });
            if (!isMountedRef.current) return;
            setIncidentZones(sanitized);
            setZonesError(null);
        } catch (err) {
            console.warn('[ExploreScreen] Failed to fetch incident zones:', err);
            if (isMountedRef.current) {
                setZonesError(err instanceof Error ? err.message : 'Unable to fetch incident zones');
            }
        } finally {
            if (isMountedRef.current) setZonesLoading(false);
        }
    }, []);

    const refreshAndRecenterMap = useCallback(async () => {
        fetchLiveZones();
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (!isMountedRef.current) return;
            const { latitude, longitude } = pos.coords;
            setUserLoc({ latitude, longitude });
            setLocationStatus('ready');
            mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 700);
        } catch (err) {
            console.warn('[ExploreScreen] Unable to refresh map location:', err);
            if (isMountedRef.current) mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
        }
    }, [fetchLiveZones]);

    useEffect(() => {
        isMountedRef.current = true;
        fetchLiveZones();
        const interval = setInterval(fetchLiveZones, 60_000);
        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
            safePathRequestIdRef.current += 1;
            routeRequestIdRef.current += 1;
        };
    }, [fetchLiveZones]);

    useFocusEffect(
        useCallback(() => {
            getUserProfile().then((nextProfile) => {
                if (isMountedRef.current) setProfile(nextProfile);
            });
            refreshAndRecenterMap();
        }, [refreshAndRecenterMap]),
    );

    const searchProgress = useRef(new RNAnimated.Value(0)).current;
    const locationCardY = useRef(new RNAnimated.Value(300)).current;
    const locationCardOpacity = useRef(new RNAnimated.Value(0)).current;
    const placeSheetY = useRef(new RNAnimated.Value(height)).current;
    const placeSheetOpacity = useRef(new RNAnimated.Value(0)).current;
    const placeSheetDragY = useRef(new RNAnimated.Value(0)).current;
    const directionsProgress = useRef(new RNAnimated.Value(0)).current;

    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location required', 'Please grant location access.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (!isMountedRef.current) return;
            const { latitude, longitude } = pos.coords;
            setUserLoc({ latitude, longitude });
            setTimeout(() => {
                if (isMountedRef.current) {
                    mapRef.current?.animateToRegion(
                        { latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 800
                    );
                }
            }, 600);
            setLocationStatus('ready');
            try {
                const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (!isMountedRef.current) return;
                if (geo.length > 0) {
                    const g = geo[0];
                    setAddress(
                        [g.street, g.district ?? g.subregion, g.city ?? g.region]
                            .filter(Boolean).join(', ') || 'Current location'
                    );
                }
            } catch {
                if (!isMountedRef.current) return;
                setAddress('Current location');
            }

            let lastTelemetryTs = 0;
            const TELEMETRY_INTERVAL_MS = 10_000;

            locationSubRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 2000,
                    distanceInterval: 5,
                },
                (loc) => {
                    if (!isMountedRef.current) return;
                    const newLoc = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        heading: loc.coords.heading ?? undefined,
                    };
                    setUserLoc(newLoc);

                    const now = Date.now();
                    if (now - lastTelemetryTs >= TELEMETRY_INTERVAL_MS) {
                        lastTelemetryTs = now;
                        const sanitized = sanitizeCoordinate(newLoc.latitude, newLoc.longitude);
                        if (sanitized) {
                            api.post('/api/locations', {
                                latitude: sanitized.latitude,
                                longitude: sanitized.longitude,
                            }).catch(() => { });
                        }
                    }
                }
            );
        })();

        return () => {
            if (locationSubRef.current) {
                locationSubRef.current.remove();
            }
        };
    }, []);

    useEffect(() => {
        if (!directionsMode || !userLoc || !isLiveNav) return;

        mapRef.current?.animateCamera({
            center: { latitude: userLoc.latitude, longitude: userLoc.longitude },
            pitch: 45,
            heading: userLoc.heading ?? 0,
            zoom: 19,
        }, { duration: 1000 });

        if (navInstructions.length > 0 && currentStepIdx < navInstructions.length - 1) {
            const currentStep = navInstructions[currentStepIdx];
            if (currentStep.endLocation) {
                const dist = haversineDistance(userLoc, currentStep.endLocation);
                if (dist <= 25) {
                    setCurrentStepIdx(prev => prev + 1);
                }
            }
        }

        if (routeCoords.length > 0) {
            let closestIdx = 0;
            let minD = Infinity;
            routeCoords.forEach((pt, i) => {
                const d = haversineDistance(userLoc, pt);
                if (d < minD) { minD = d; closestIdx = i; }
            });
            setCompletedRouteCoords(routeCoords.slice(0, closestIdx + 1));
            setRemainingRouteCoords(routeCoords.slice(closestIdx));
        }
    }, [userLoc, directionsMode, navInstructions, currentStepIdx, isLiveNav, routeCoords]);

    // ── Decoupled Audio Alert Engine: Standalone thread — always stops previous utterance first ──
    useEffect(() => {
        if (!isLiveNav || !audioEnabled) return;
        if (navInstructions.length === 0 || currentStepIdx >= navInstructions.length) return;
        // Stop any previous utterance before queueing the next to prevent TTS buildup on Android/iOS
        Speech.stop();
        const tid = setTimeout(() => {
            Speech.speak(navInstructions[currentStepIdx].instruction, {
                language: 'en',
                pitch: 1.0,
                rate: Platform.OS === 'android' ? 0.9 : 0.95,
            });
        }, 80);
        return () => clearTimeout(tid);
    }, [isLiveNav, audioEnabled, currentStepIdx, navInstructions]);

    const activateSearch = useCallback(() => {
        if (searchActive) return;
        setSearchActive(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
        RNAnimated.timing(searchProgress, {
            toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }).start();
    }, [searchActive, searchProgress]);

    const deactivateSearch = useCallback((clearText: boolean) => {
        Keyboard.dismiss();
        setSearchActive(false);
        if (clearText) setSearchText('');
        RNAnimated.timing(searchProgress, {
            toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }).start();
    }, [searchProgress]);

    const query = searchText.trim();
    const startQuery = startSearchText.trim();

    const fetchAutocomplete = useCallback(async (input: string, sessionToken: string, bias: LatLng) => {
        if (!GOOGLE_MAPS_API_KEY) {
            return { results: [] as PlacePrediction[], status: 'MISSING_KEY' };
        }
        try {
            const res = await fetch(buildAutocompleteUrl(input, sessionToken, bias));
            const data = await res.json();
            if (data?.status !== 'OK') {
                return { results: [] as PlacePrediction[], status: data?.status ?? 'ERROR' };
            }
            return {
                results: (data.predictions ?? []).map((p: any) => ({
                    id: p.place_id,
                    placeId: p.place_id,
                    name: p.structured_formatting?.main_text ?? p.description,
                    address: p.structured_formatting?.secondary_text ?? p.description,
                })),
                status: 'OK',
            };
        } catch {
            return { results: [] as PlacePrediction[], status: 'ERROR' };
        }
    }, []);

    const resolvePlaceDetails = useCallback(async (prediction: PlacePrediction, sessionToken: string) => {
        if (!GOOGLE_MAPS_API_KEY) return null;
        try {
            const res = await fetch(buildPlaceDetailsUrl(prediction.placeId, sessionToken));
            const data = await res.json();
            if (data?.status !== 'OK') return null;
            const loc = data.result?.geometry?.location;
            if (!loc) return null;
            return {
                id: prediction.placeId,
                placeId: prediction.placeId,
                name: data.result?.name ?? prediction.name,
                address: data.result?.formatted_address ?? prediction.address,
                latitude: loc.lat,
                longitude: loc.lng,
            };
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        if (!searchActive) return;
        if (query.length < 1) {
            setSearchSuggestions([]);
            setSearchStatus(null);
            searchSessionTokenRef.current = null;
            return;
        }
        const requestId = ++searchRequestIdRef.current;
        if (!searchSessionTokenRef.current) searchSessionTokenRef.current = createSessionToken();
        const token = searchSessionTokenRef.current;
        const bias = userLoc ?? DEFAULT_REGION;
        const handle = setTimeout(async () => {
            const { results, status } = await fetchAutocomplete(query, token, bias);
            if (searchRequestIdRef.current === requestId) {
                setSearchSuggestions(results);
                setSearchStatus(status);
            }
        }, AUTOCOMPLETE_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [fetchAutocomplete, query, searchActive, userLoc]);

    useEffect(() => {
        if (!startSearchActive) return;
        if (startQuery.length < 1) {
            setStartSuggestions([]);
            setStartStatus(null);
            startSessionTokenRef.current = null;
            return;
        }
        const requestId = ++startRequestIdRef.current;
        if (!startSessionTokenRef.current) startSessionTokenRef.current = createSessionToken();
        const token = startSessionTokenRef.current;
        const bias = userLoc ?? DEFAULT_REGION;
        const handle = setTimeout(async () => {
            const { results, status } = await fetchAutocomplete(startQuery, token, bias);
            if (startRequestIdRef.current === requestId) {
                setStartSuggestions(results);
                setStartStatus(status);
            }
        }, AUTOCOMPLETE_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [fetchAutocomplete, startQuery, startSearchActive, userLoc]);

    useEffect(() => {
        const buildRoute = async () => {
            if (!startLocation || !endLocation) return;
            const requestId = ++routeRequestIdRef.current;
            if (!GOOGLE_MAPS_API_KEY) {
                if (!isMountedRef.current || routeRequestIdRef.current !== requestId) return;
                setRouteCoords([
                    { latitude: startLocation.latitude, longitude: startLocation.longitude },
                    { latitude: endLocation.latitude, longitude: endLocation.longitude },
                ]);
                return;
            }

            const origin = `${startLocation.latitude},${startLocation.longitude}`;
            const destination = `${endLocation.latitude},${endLocation.longitude}`;
            const apiMode = travelMode === 'motorcycle' ? 'two_wheeler' : travelMode;
            const baseUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${apiMode}&alternatives=true&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;

            try {
                const res = await fetch(baseUrl);
                const data = await res.json();
                if (!isMountedRef.current || routeRequestIdRef.current !== requestId) return;

                if (!data?.routes?.length) {
                    Alert.alert('Route error', 'No route found between these locations.');
                    return;
                }

                const chosenRoute = data.routes[0];
                const chosenCoords = decodePolyline(chosenRoute.overview_polyline?.points ?? '');

                let latestZones = normalizedIncidentZones;
                try {
                    const fetchedZones = await incidentService.getZones();
                    if (!isMountedRef.current || routeRequestIdRef.current !== requestId) return;
                    latestZones = (fetchedZones || [])
                        .map(normalizeIncidentZone)
                        .filter((zone): zone is IncidentZone => zone !== null && zone.incidentCount >= 1);
                    setIncidentZones(latestZones);
                    setZonesError(null);
                } catch (zoneErr) {
                    console.warn('[ExploreScreen] Route check could not refresh incident zones:', zoneErr);
                    if (isMountedRef.current) {
                        setZonesError(zoneErr instanceof Error ? zoneErr.message : 'Unable to refresh incident zones');
                    }
                    if (latestZones.length === 0) {
                        Alert.alert('Safety zones unavailable', 'Unable to refresh incident zones, so this route cannot be safety-checked yet.');
                    }
                }

                // ── Dynamic Hazard Whitelisting: filter out zones the user is currently inside ──
                // This is computed BEFORE setting any coords so we can decide the safety split accurately.
                const startPoint = chosenCoords[0];
                const effectiveZones = startPoint
                    ? latestZones.filter(z => haversineDistance(startPoint, z) > z.radius)
                    : latestZones;

                const routeEvaluation = evaluateRouteSafety(chosenCoords, effectiveZones);

                // routeCoords = the primary draw path (may be unsafe initially)
                // unsafeRouteCoords = permanent snapshot of original unsafe route (shown as crimson ghost)
                // safeRouteCoords = only populated after a confirmed detour; starts empty
                setRouteCoords(chosenCoords);
                setCompletedRouteCoords([]);
                setRemainingRouteCoords(chosenCoords);

                if (!routeEvaluation.isUnsafe) {
                    // Route is clean — no crimson ghost, no safe path needed
                    setUnsafeRouteCoords([]);
                    setSafeRouteCoords([]);
                    setRouteUnsafe(false);
                    setBlockedZoneName(null);
                    setShowSafePath(false);
                } else {
                    // Route intersects a danger zone — snapshot the original as the crimson ghost
                    setUnsafeRouteCoords(chosenCoords);
                    setSafeRouteCoords([]);
                    setRouteUnsafe(true);
                    setBlockedZoneName(routeEvaluation.redZoneName ?? null);
                    setShowSafePath(true);
                }

                const steps = chosenRoute?.legs?.[0]?.steps ?? [];
                const instructions: NavStep[] = steps.map((step: any) => ({
                    instruction: stripHtml(step.html_instructions ?? ''),
                    distance: step.distance?.text ?? '',
                    maneuver: step.maneuver,
                    endLocation: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : undefined,
                }));
                setNavInstructions(instructions);
                setCurrentStepIdx(0);

                if (chosenCoords.length > 1) {
                    mapRef.current?.fitToCoordinates(chosenCoords, {
                        edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 },
                        animated: true,
                    });
                }
            } catch {
                if (!isMountedRef.current || routeRequestIdRef.current !== requestId) return;
                setRouteCoords([
                    { latitude: startLocation.latitude, longitude: startLocation.longitude },
                    { latitude: endLocation.latitude, longitude: endLocation.longitude },
                ]);
                setNavInstructions([]);
            }
        };

        if (directionsMode) {
            buildRoute();
        }
    }, [directionsMode, endLocation, startLocation, travelMode]);

    const startScanAnimation = useCallback(() => {
        const radarAnims = [radarAnim0, radarAnim1, radarAnim2];
        radarAnims.forEach((a, i) => {
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
        const spinLoop = () => {
            scanAnim.setValue(0);
            RNAnimated.timing(scanAnim, {
                toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true,
            }).start(() => spinLoop());
        };
        spinLoop();
    }, [radarAnim0, radarAnim1, radarAnim2, scanAnim]);

    const stopScanAnimation = useCallback(() => {
        [radarAnim0, radarAnim1, radarAnim2, scanAnim].forEach(a => a.stopAnimation());
    }, [radarAnim0, radarAnim1, radarAnim2, scanAnim]);

    const triggerSafetyRecalculation = useCallback(async () => {
        if (!startLocation || !endLocation || !GOOGLE_MAPS_API_KEY) return;
        const requestId = ++safePathRequestIdRef.current;

        setScanState('SCANNING');
        setShowSafePath(false);
        startScanAnimation();

        await new Promise(r => setTimeout(r, 1800));
        if (!isMountedRef.current || safePathRequestIdRef.current !== requestId) return;

        const origin = `${startLocation.latitude},${startLocation.longitude}`;
        const destination = `${endLocation.latitude},${endLocation.longitude}`;
        const apiMode = travelMode === 'motorcycle' ? 'two_wheeler' : travelMode;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${apiMode}&alternatives=true&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!isMountedRef.current || safePathRequestIdRef.current !== requestId) return;

            if (!data?.routes?.length) {
                stopScanAnimation();
                setScanState('NO_ROUTE');
                return;
            }

            let latestZones: IncidentZone[] = [];
            try {
                const fetchedZones = await incidentService.getZones();
                if (!isMountedRef.current || safePathRequestIdRef.current !== requestId) return;
                latestZones = (fetchedZones || [])
                    .map(normalizeIncidentZone)
                    .filter((zone): zone is IncidentZone => zone !== null && zone.incidentCount >= 1);
                setIncidentZones(latestZones);
                setZonesError(null);
            } catch (zoneErr) {
                console.warn('[ExploreScreen] Safe Path could not refresh incident zones:', zoneErr);
                if (isMountedRef.current) {
                    setZonesError(zoneErr instanceof Error ? zoneErr.message : 'Unable to refresh incident zones');
                }
                stopScanAnimation();
                setShowSafePath(true);
                setScanState(null);
                Alert.alert('Safety zones unavailable', 'Unable to refresh incident zones, so Safe Path cannot be recalculated yet.');
                return;
            }

            // Dynamic Hazard Whitelisting: filter out zones that the user is currently inside
            const initialStartPoint = { latitude: startLocation.latitude, longitude: startLocation.longitude };
            const effectiveZones = latestZones.filter(z => haversineDistance(initialStartPoint, z) > z.radius);

            let bestRoute: { route: any; coords: LatLng[]; safety: ReturnType<typeof evaluateRouteSafety> } | null = null;
            let bestScore = Infinity;

            for (const route of data.routes) {
                const coords = decodePolyline(route.overview_polyline?.points ?? '');
                const safety = evaluateRouteSafety(coords, effectiveZones);
                const score = safety.riskScore;

                if (score < bestScore) {
                    bestScore = score;
                    bestRoute = { route, coords, safety };
                }
            }

            if (__DEV__) {
                console.log('[ExploreScreen] Safe Path route evaluation', {
                    zones: latestZones.length,
                    effectiveZones: effectiveZones.length,
                    routes: data.routes.length,
                    bestRiskScore: bestRoute?.safety.riskScore ?? null,
                    bestIsUnsafe: bestRoute?.safety.isUnsafe ?? null,
                    redHits: bestRoute?.safety.redHits ?? null,
                    yellowHits: bestRoute?.safety.yellowHits ?? null,
                    redZoneName: bestRoute?.safety.redZoneName ?? null,
                });
            }

            if (bestRoute?.safety.isUnsafe) {
                if (travelMode === 'transit') {
                    stopScanAnimation();
                    if (bestRoute) {
                        setSafeRouteCoords(bestRoute.coords);
                        setRouteCoords(bestRoute.coords);
                    }
                    setRouteUnsafe(true);
                    setScanState('TRANSIT_ERROR');
                    return;
                }

                if (bestRoute) {
                    const firstBadPoint = bestRoute.coords.find((p: LatLng) =>
                        effectiveZones.some((z: any) => z.incidentCount >= 5 && haversineDistance(p, z) <= z.radius)
                    );

                    if (firstBadPoint) {
                        const matchedZone = effectiveZones.find((z: any) => z.incidentCount >= 5 && haversineDistance(firstBadPoint, z) <= z.radius);

                        if (matchedZone) {
                            const directions = [
                                { lat: 0, lng: 1 },
                                { lat: 0, lng: -1 },
                                { lat: 1, lng: 0 },
                                { lat: -1, lng: 0 }
                            ];

                            let foundPerfectDetour = false;
                            const pushDistanceMeters = matchedZone.radius * 3;

                            for (const dir of directions) {
                                if (foundPerfectDetour) break;

                                const rawWpLat = matchedZone.latitude + (dir.lat * pushDistanceMeters) / 111320;
                                const rawWpLng = matchedZone.longitude + (dir.lng * pushDistanceMeters) / (111320 * Math.cos(matchedZone.latitude * (Math.PI / 180)));

                                let wpLat = rawWpLat;
                                let wpLng = rawWpLng;
                                try {
                                    const roadsUrl = `https://roads.googleapis.com/v1/nearestRoads?points=${rawWpLat},${rawWpLng}&key=${GOOGLE_MAPS_API_KEY}`;
                                    const roadsRes = await fetch(roadsUrl);
                                    const roadsData = await roadsRes.json();
                                    if (!isMountedRef.current || safePathRequestIdRef.current !== requestId) return;
                                    if (roadsData?.snappedPoints?.length > 0) {
                                        const snapped = roadsData.snappedPoints[0]?.location;
                                        if (snapped?.latitude && snapped?.longitude) {
                                            wpLat = Number(snapped.latitude);
                                            wpLng = Number(snapped.longitude);
                                        }
                                    }
                                } catch (snapErr) {
                                    console.log('[Roads API] Snap failed, using raw offset:', snapErr);
                                }

                                const wpUrl = `${url}&waypoints=via:${wpLat},${wpLng}`;

                                try {
                                    const wpRes = await fetch(wpUrl);
                                    const wpData = await wpRes.json();
                                    if (!isMountedRef.current || safePathRequestIdRef.current !== requestId) return;

                                    if (wpData?.routes?.length) {
                                        const wpRoute = wpData.routes[0];
                                        const wpCoords = decodePolyline(wpRoute.overview_polyline?.points ?? '');
                                        const wpSafety = evaluateRouteSafety(wpCoords, effectiveZones);
                                        const wpScore = wpSafety.riskScore;

                                        if (wpScore === 0) {
                                            bestRoute = { route: wpRoute, coords: wpCoords, safety: wpSafety };
                                            bestScore = wpScore;
                                            foundPerfectDetour = true;
                                        } else if (wpScore < bestScore) {
                                            bestRoute = { route: wpRoute, coords: wpCoords, safety: wpSafety };
                                            bestScore = wpScore;
                                        }
                                    }
                                } catch (error) {
                                    console.log(`Waypoint fallback failed for direction ${dir.lat},${dir.lng}`, error);
                                }
                            }
                        }
                    }
                }
            }

            if (!bestRoute) {
                stopScanAnimation();
                setScanState('NO_ROUTE');
                return;
            }

            const finalCoords = bestRoute.coords;
            const steps = bestRoute.route?.legs?.[0]?.steps ?? [];
            const instructions: NavStep[] = steps.map((step: any) => ({
                instruction: stripHtml(step.html_instructions ?? ''),
                distance: step.distance?.text ?? '',
                maneuver: step.maneuver,
                endLocation: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : undefined,
            }));

            // ── Polyline Isolation ──
            // safeRouteCoords = the new detour (purple with glow)
            // unsafeRouteCoords = original route snapshot (stays as crimson ghost ONLY if still partially risky)
            // If a perfect safe detour was found (score === 0), clear the crimson ghost entirely.
            setSafeRouteCoords(finalCoords);
            setRouteCoords(finalCoords);
            setCompletedRouteCoords([]);
            setRemainingRouteCoords(finalCoords);
            setNavInstructions(instructions);
            setCurrentStepIdx(0);
            setShowSafePath(false);

            stopScanAnimation(); // Always stop animation before setting result state

            mapRef.current?.fitToCoordinates(finalCoords, {
                edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 },
                animated: true,
            });

            if (!bestRoute.safety.isUnsafe) {
                // Perfect detour found — erase the crimson ghost, mark route as safe
                setUnsafeRouteCoords([]);
                setRouteUnsafe(false);
                setBlockedZoneName(null);
                setScanState(bestRoute.safety.riskScore === 0 ? null : 'PARTIAL_SAFETY');
                Speech.stop();
                if (bestRoute.safety.riskScore === 0) {
                    setTimeout(() => {
                        Speech.speak('Safety update: Safest route selected, avoiding all high risk areas.', {
                            language: 'en', pitch: 1.0, rate: Platform.OS === 'android' ? 0.9 : 0.95,
                        });
                    }, 80);
                }
            } else {
                // Partial detour — keep crimson ghost visible, show partial safety modal
                setRouteUnsafe(true);
                setBlockedZoneName(bestRoute.safety.redZoneName ?? blockedZoneName);
                setScanState('PARTIAL_SAFETY');
            }
        } catch {
            stopScanAnimation();
            setScanState('NO_ROUTE');
        }
    }, [startLocation, endLocation, travelMode, startScanAnimation, stopScanAnimation, normalizedIncidentZones, blockedZoneName]);

    const closePlaceSheet = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(placeSheetY, { toValue: height, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(placeSheetOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setPlaceSheetOpen(false);
            setPlaceSheetIsDangerZone(false);
            setTimeout(() => setPlaceSheetMode('incidents'), 200);
        });
        placeSheetDragY.setValue(0);
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

    const closeLocationCard = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(locationCardY, { toValue: 300, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(locationCardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setShowLocationCard(false));
    }, []);

    const openLocationCard = useCallback(() => {
        if (!userLoc) return;
        if (placeSheetOpen) closePlaceSheet();
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
    }, [closePlaceSheet, locationCardOpacity, locationCardY, placeSheetOpen, userLoc]);

    const openPlaceSheet = useCallback((place: PlaceSuggestion, isDangerZone = false) => {
        setPlaceSheetIsDangerZone(isDangerZone);
        setPlaceSheetOpen(true);
        placeSheetY.setValue(height);
        placeSheetOpacity.setValue(0);
        placeSheetDragY.setValue(0);
        (async () => {
            try {
                const zones = await incidentService.getZones();
                const nearby = (zones || []).filter((z: IncidentZone) => {
                    const dist = haversineDistance(
                        { latitude: place.latitude, longitude: place.longitude },
                        { latitude: Number(z?.latitude) || 0, longitude: Number(z?.longitude) || 0 }
                    );
                    return dist <= 500;
                });
                const incidents: PlaceIncident[] = nearby.flatMap((z: IncidentZone) =>
                    (z?.incidents || []).map((inc: any, index: number) => ({
                        id: String(inc?.id ?? `${z.id}-incident-${index}`),
                        reporter: String(inc?.reporterName ?? inc?.userName ?? inc?.reporter ?? 'Unknown'),
                        time: formatIncidentTime(inc?.time ?? inc?.createdAt ?? inc?.created_at),
                        status: (inc?.status as PlaceIncident['status']) ?? 'ACTIVE',
                    }))
                );
                if (!isMountedRef.current) return;
                setPlaceIncidents(incidents);
            } catch {
                if (!isMountedRef.current) return;
                setPlaceIncidents([]);
            }
        })();
        RNAnimated.parallel([
            RNAnimated.spring(placeSheetY, { toValue: height * 0.5, useNativeDriver: true, tension: 70, friction: 12 }),
            RNAnimated.timing(placeSheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

    const openZoneSheet = useCallback((zone: IncidentZone) => {
        const place: PlaceSuggestion = {
            id: `zone-${zone.id}`,
            name: zone.name || (zone.isRed ? 'Red Zone' : 'Yellow Zone'),
            address: zone.name || 'Incident zone',
            latitude: zone.latitude,
            longitude: zone.longitude,
        };
        setSelectedPlace(place);
        if (showLocationCard) closeLocationCard();
        const incidents = (zone.incidents || []).map((inc: any, index: number) => ({
            id: String(inc?.id ?? `${zone.id}-incident-${index}`),
            reporter: String(inc?.reporterName ?? inc?.userName ?? inc?.reporter ?? 'Unknown'),
            time: formatIncidentTime(inc?.time ?? inc?.createdAt ?? inc?.created_at),
            status: (String(inc?.status ?? 'ACTIVE').toUpperCase() as PlaceIncident['status']),
        }));
        setPlaceIncidents(incidents);
        mapRef.current?.animateToRegion({
            latitude: zone.latitude - 0.003,
            longitude: zone.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
        }, 650);
        openPlaceSheet(place, true);
    }, [closeLocationCard, openPlaceSheet, showLocationCard]);

    const handleResolvedPlaceSelect = useCallback((place: PlaceSuggestion) => {
        setSelectedPlace(place);
        setSearchText(place.name);
        setRecentPlaces(prev => [
            place,
            ...prev.filter(item => item.id !== place.id),
        ].slice(0, 6));
        deactivateSearch(false);
        if (showLocationCard) closeLocationCard();
        const latitudeDelta = 0.012;
        const longitudeDelta = 0.012;
        const offsetLat = latitudeDelta * 0.25;
        mapRef.current?.animateToRegion({
            latitude: place.latitude - offsetLat,
            longitude: place.longitude,
            latitudeDelta,
            longitudeDelta,
        }, 700);
        openPlaceSheet(place);
    }, [closeLocationCard, deactivateSearch, openPlaceSheet, showLocationCard]);

    const handlePlaceSelect = useCallback(async (prediction: PlacePrediction) => {
        if (!GOOGLE_MAPS_API_KEY) {
            Alert.alert('Google Places not configured', 'Missing Google Maps API key.');
            return;
        }
        const sessionToken = searchSessionTokenRef.current ?? createSessionToken();
        const place = await resolvePlaceDetails(prediction, sessionToken);
        searchSessionTokenRef.current = null;
        if (!isMountedRef.current) return;
        if (!place) {
            Alert.alert('Place not found', 'Unable to fetch location details.');
            return;
        }
        handleResolvedPlaceSelect(place);
    }, [handleResolvedPlaceSelect, resolvePlaceDetails]);

    const openAddSafePlace = useCallback(() => {
        setPlaceSheetMode('safe_place');
        setSafePlaceAnswer('');
        setSafePlaceSubmitState('idle');
        setSafePlaceError(null);
        safePlaceSuccessAnim.setValue(0);
    }, [safePlaceSuccessAnim]);

    const cancelAddSafePlace = useCallback(() => {
        setPlaceSheetMode('incidents');
        setSafePlaceAnswer('');
        setSafePlaceError(null);
    }, []);

    const submitAddSafePlace = useCallback(async () => {
        if (safePlaceAnswer.trim().length === 0) {
            setSafePlaceError('Please provide a brief description.');
            return;
        }
        if (!selectedPlace) {
            setSafePlaceError('No place selected.');
            return;
        }
        const sanitized = sanitizeCoordinate(selectedPlace.latitude, selectedPlace.longitude);
        if (!sanitized) {
            setSafePlaceError('Invalid location coordinates.');
            return;
        }

        setSafePlaceSubmitState('submitting');
        try {
            await safePlaceService.submitSafePlace({
                latitude: sanitized.latitude,
                longitude: sanitized.longitude,
                name: selectedPlace.name || 'Safe Place',
                description: safePlaceAnswer.trim(),
                address: selectedPlace.address || null,
            });
            if (!isMountedRef.current) return;
            setSafePlaceSubmitState('success');
            RNAnimated.timing(safePlaceSuccessAnim, {
                toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
            }).start();
            setTimeout(() => {
                closePlaceSheet();
            }, 2500);
        } catch (err: any) {
            if (!isMountedRef.current) return;
            setSafePlaceSubmitState('idle');
            setSafePlaceError(err?.message ?? 'Failed to submit safe place. Please try again.');
        }
    }, [safePlaceAnswer, selectedPlace, closePlaceSheet, safePlaceSuccessAnim]);

    const enterDirectionsMode = useCallback((destination: PlaceSuggestion) => {
        clearRouteState();
        setDirectionsMode(true);
        setEndLocation(destination);
        setRouteCoords([]);
        RNAnimated.timing(directionsProgress, {
            toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }).start();
        closePlaceSheet();
    }, [clearRouteState, closePlaceSheet, directionsProgress]);

    const exitDirectionsMode = useCallback(() => {
        clearRouteState();
        RNAnimated.timing(directionsProgress, {
            toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }).start();
    }, [clearRouteState, directionsProgress]);

    const resetExploreState = useCallback(() => {
        deactivateSearch(true);
        setSearchSuggestions([]);
        setSearchStatus(null);
        searchSessionTokenRef.current = null;
        searchRequestIdRef.current = 0;

        setStartSearchActive(false);
        setStartSearchText('');
        setStartSuggestions([]);
        setStartStatus(null);
        startSessionTokenRef.current = null;
        startRequestIdRef.current = 0;

        if (placeSheetOpen) closePlaceSheet();
        if (showLocationCard) closeLocationCard();

        setSelectedPlace(null);
        setPlaceIncidents([]);
        setEndLocation(null);

        if (directionsMode) {
            exitDirectionsMode();
        } else {
            setRouteCoords([]);
            setNavInstructions([]);
            setCurrentStepIdx(0);
            setRouteUnsafe(false);
            setBlockedZoneName(null);
            setShowSafePath(false);
            setScanState(null);
            setSafeRouteCoords([]);
            setUnsafeRouteCoords([]);
        }

        if (userLoc) {
            mapRef.current?.animateToRegion(
                { latitude: userLoc.latitude, longitude: userLoc.longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 },
                700
            );
        } else {
            mapRef.current?.animateToRegion(DEFAULT_REGION, 700);
        }
    }, [closeLocationCard, closePlaceSheet, deactivateSearch, directionsMode, exitDirectionsMode, placeSheetOpen, showLocationCard, userLoc]);

    const handleStartSelect = useCallback((place: PlaceSuggestion) => {
        setStartLocation(place);
        setStartSearchText(place.name);
        setStartSearchActive(false);
    }, []);

    const handleStartPredictionSelect = useCallback(async (prediction: PlacePrediction) => {
        if (!GOOGLE_MAPS_API_KEY) {
            Alert.alert('Google Places not configured', 'Missing Google Maps API key.');
            return;
        }
        const sessionToken = startSessionTokenRef.current ?? createSessionToken();
        const place = await resolvePlaceDetails(prediction, sessionToken);
        startSessionTokenRef.current = null;
        if (!isMountedRef.current) return;
        if (!place) {
            Alert.alert('Place not found', 'Unable to fetch location details.');
            return;
        }
        setRecentPlaces(prev => [
            place,
            ...prev.filter(item => item.id !== place.id),
        ].slice(0, 6));
        handleStartSelect(place);
    }, [handleStartSelect, resolvePlaceDetails]);

    const openStartSearch = useCallback(() => {
        setStartSearchActive(true);
        setTimeout(() => startInputRef.current?.focus(), 60);
    }, []);

    const handleStartCurrentLocation = useCallback(() => {
        if (!userLoc) return;
        const current: PlaceSuggestion = {
            id: 'current-location',
            name: 'Your location',
            address: address || 'Current location',
            latitude: userLoc.latitude,
            longitude: userLoc.longitude,
        };
        handleStartSelect(current);
    }, [address, handleStartSelect, userLoc]);

    const sheetPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
            onPanResponderMove: (_, gesture) => {
                if (gesture.dy > 0) placeSheetDragY.setValue(gesture.dy);
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dy > 120) {
                    closePlaceSheet();
                } else {
                    RNAnimated.spring(placeSheetDragY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
                }
            },
        })
    ).current;

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Map Framework ── */}
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={DEFAULT_REGION}
                    showsUserLocation={!isLiveNav}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    moveOnMarkerPress={false}
                    customMapStyle={TACTICAL_MAP_STYLE}
                >
                    {/* ── Dynamic Circle Color Mapping: Handles Red vs Yellow Thresholds ── */}
                    {normalizedIncidentZones.map(zone => {
                        const zoneIsRed = zone.isRed || zone.incidentCount >= 5;
                        const zoneColor = zoneIsRed ? '#EF4444' : '#FACC15';
                        return (
                            <React.Fragment key={zone.id}>
                                <Circle
                                    center={{ latitude: zone.latitude, longitude: zone.longitude }}
                                    radius={zone.radius}
                                    fillColor={zoneIsRed ? "rgba(239, 68, 68, 0.26)" : "rgba(250, 204, 21, 0.24)"}
                                    strokeColor={zoneIsRed ? "rgba(239, 68, 68, 0.85)" : "rgba(250, 204, 21, 0.85)"}
                                    strokeWidth={2}
                                    zIndex={zoneIsRed ? 20 : 10}
                                />
                                <Marker
                                    coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                    tracksViewChanges={false}
                                    zIndex={zoneIsRed ? 40 : 30}
                                    onPress={() => openZoneSheet(zone)}
                                >
                                    <View style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: 7,
                                        backgroundColor: zoneColor,
                                        borderWidth: 2,
                                        borderColor: '#FFFFFF',
                                    }} />
                                </Marker>
                            </React.Fragment>
                        );
                    })}

                    {selectedPlace && (
                        <Marker
                            key={selectedPlace.id}
                            coordinate={{ latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }}
                            anchor={{ x: 0.5, y: 1 }}
                            calloutAnchor={{ x: 0.5, y: 0 }}
                            tracksViewChanges={true}
                            zIndex={999}
                            onPress={() => openPlaceSheet(selectedPlace, selectedPlace.id.startsWith('zone-'))}
                        >
                            <View style={s.placeMarkerWrap}>
                                <View style={s.placeMarkerIconWrap}>
                                    <Ionicons name="location" size={26} color={T.violet} />
                                </View>
                                <View style={s.placeMarkerStem} />
                            </View>
                        </Marker>
                    )}

                    {/* ── Live Navigation Modern Tracking Arrow ── */}
                    {isLiveNav && userLoc && (
                        <Marker
                            coordinate={{ latitude: userLoc.latitude, longitude: userLoc.longitude }}
                            anchor={{ x: 0.5, y: 0.5 }}
                            rotation={userLoc.heading || 0}
                            flat={true}
                            zIndex={1000}
                        >
                            <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{
                                    position: 'absolute', width: 48, height: 48, borderRadius: 24,
                                    backgroundColor: 'rgba(138,56,246,0.2)',
                                    borderWidth: 1, borderColor: 'rgba(138,56,246,0.4)',
                                }} />
                                <View style={{
                                    width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF',
                                    alignItems: 'center', justifyContent: 'center',
                                    shadowColor: '#8A38F6', shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
                                    elevation: 8,
                                }}>
                                    <Ionicons name="navigate" size={18} color="#8A38F6" style={{ transform: [{ rotate: '-45deg' }, { translateY: -1 }] }} />
                                </View>
                            </View>
                        </Marker>
                    )}

                    {/*
                     * ── Polyline Rendering Architecture ──
                     * LAYER 1 (bottom): unsafeRouteCoords — Crimson ghost of the ORIGINAL dangerous route.
                     *   Shown only when a safe detour exists alongside it. Never shares data with safe path.
                     * LAYER 2 (middle): completedRouteCoords — Blue progress trail during live navigation.
                     * LAYER 3 (top):   remainingRouteCoords / routeCoords — Purple core + translucent glow.
                     *   This is the active navigation path (safe detour or clean original route).
                     */}

                    {/* LAYER 1 — Crimson ghost: original unsafe route snapshot (only if a safe detour also exists) */}
                    {unsafeRouteCoords.length > 1 && safeRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={unsafeRouteCoords}
                            strokeColor="rgba(185, 28, 28, 0.12)"
                            strokeWidth={9}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={1}
                        />
                    )}
                    {/* Muted crimson core, dashed */}
                    {unsafeRouteCoords.length > 1 && safeRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={unsafeRouteCoords}
                            strokeColor="rgba(220, 38, 38, 0.55)"
                            strokeWidth={2.5}
                            lineDashPattern={[5, 5]}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={2}
                        />
                    )}

                    {/* LAYER 2 — Blue progress trail (live nav: completed segments) */}
                    {completedRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={completedRouteCoords}
                            strokeColor="#3B82F6"
                            strokeWidth={5}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={3}
                        />
                    )}

                    {/* LAYER 3 — Active safe track: remaining path during live nav */}
                    {remainingRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={remainingRouteCoords}
                            strokeColor="rgba(138, 56, 246, 0.22)"
                            strokeWidth={10}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={4}
                        />
                    )}
                    {/* High-contrast purple core */}
                    {remainingRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={remainingRouteCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={5}
                        />
                    )}

                    {/* LAYER 3 — Active safe track: static preview (before live nav starts) */}
                    {completedRouteCoords.length === 0 && routeCoords.length > 1 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeColor="rgba(138, 56, 246, 0.22)"
                            strokeWidth={10}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={4}
                        />
                    )}
                    {/* High-contrast purple core */}
                    {completedRouteCoords.length === 0 && routeCoords.length > 1 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={5}
                        />
                    )}
                </MapView>

                {locationStatus === 'idle' && <PulseRadar />}
                {__DEV__ && zonesError && (
                    <View style={[s.zoneDebugBanner, { top: insets.top + 62 }]}>
                        <Text style={s.zoneDebugText}>Zones unavailable: {zonesError}</Text>
                    </View>
                )}

                {/* ── Header with Animated Search ── */}
                {!isLiveNav && (
                    <PremiumBar
                        style={[s.header, { top: insets.top + 8 }]}
                        contentStyle={s.headerContent}
                    >
                        {directionsMode ? (
                            startSearchActive ? null : (
                                <RNAnimated.View
                                    style={[
                                        s.directionsHeaderWrap,
                                        {
                                            height: directionsProgress.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [48, 140],
                                            }),
                                            opacity: directionsProgress,
                                            flexDirection: 'column',
                                            alignItems: 'stretch',
                                        },
                                    ]}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <TouchableOpacity
                                            style={s.hBtn}
                                            onPress={exitDirectionsMode}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="arrow-back" size={20} color={T.ink2} />
                                        </TouchableOpacity>

                                        <View style={s.directionsFields}>
                                            <TouchableOpacity
                                                style={s.directionsInput}
                                                activeOpacity={0.8}
                                                onPress={openStartSearch}
                                            >
                                                <Ionicons name="radio-button-off" size={14} color={T.ink4} style={s.directionsIcon} />
                                                <Text style={s.directionsInputText}>
                                                    {startLocation ? startLocation.name : 'Choose start location'}
                                                </Text>
                                            </TouchableOpacity>
                                            <View style={s.directionsDivider} />
                                            <View style={s.directionsInput}>
                                                <Ionicons name="location" size={14} color={T.violet} style={s.directionsIcon} />
                                                <Text style={s.directionsInputText} numberOfLines={1}>
                                                    {endLocation?.name ?? 'Destination'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={s.travelModeWrap}>
                                        {(['driving', 'walking', 'motorcycle', 'transit'] as const).map((mode) => (
                                            <TouchableOpacity
                                                key={mode}
                                                style={[s.travelModeBtn, travelMode === mode && s.travelModeBtnActive]}
                                                onPress={() => setTravelMode(mode)}
                                            >
                                                <Ionicons
                                                    name={mode === 'driving' ? 'car' : mode === 'walking' ? 'walk' : mode === 'motorcycle' ? 'bicycle' : 'bus'}
                                                    size={16}
                                                    color={travelMode === mode ? T.onPrimary : T.ink3}
                                                />
                                                <Text style={[s.travelModeText, travelMode === mode && s.travelModeTextActive]}>
                                                    {mode === 'motorcycle' ? 'Bike' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </RNAnimated.View>
                            )
                        ) : (
                            <>
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
                                        onPress={() => {
                                            deactivateSearch(true);
                                            setSelectedPlace(null);
                                            setPlaceIncidents([]);
                                            clearRouteState();
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="arrow-back" size={20} color={T.ink2} />
                                    </TouchableOpacity>
                                </RNAnimated.View>

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
                                        onChangeText={(text) => {
                                            setSearchText(text);
                                            if (text.trim().length === 0) {
                                                setSelectedPlace(null);
                                                setPlaceIncidents([]);
                                                clearRouteState();
                                            }
                                        }}
                                        onFocus={activateSearch}
                                        returnKeyType="search"
                                        selectionColor={T.violet}
                                    />
                                    {searchText.length > 0 && (
                                        <TouchableOpacity onPress={resetExploreState} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Ionicons name="close-circle" size={16} color={T.ink4} />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>

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
                                            onPress={() => navigateSafely('/(tabs)/users/standard-user/notifications')}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="notifications-outline" size={20} color={T.ink2} />
                                            <View style={s.notifDot} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={s.profileBtn}
                                            onPress={() => navigateSafely('/(tabs)/users/standard-user/profile-menu')}
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
                                </RNAnimated.View>
                            </>
                        )}
                    </PremiumBar>
                )}

                {/* ── Top Live Banner ── */}
                {isLiveNav && navInstructions.length > 0 && (
                    <PremiumBar
                        style={[lb.bannerWrap, { top: insets.top + 8 }]}
                        contentStyle={lb.bannerBody}
                    >
                        <View style={ns.iconWrap}>
                            <Ionicons
                                name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver) as any}
                                size={28}
                                color={T.violet}
                            />
                        </View>
                        <View style={lb.textWrap}>
                            <Text style={lb.distText}>
                                {navInstructions[currentStepIdx]?.distance}
                            </Text>
                            <Text style={lb.instrText} numberOfLines={2}>
                                {navInstructions[currentStepIdx]?.instruction}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={lb.audioBtn}
                            onPress={() => {
                                setAudioEnabled(prev => {
                                    if (prev) Speech.stop();
                                    return !prev;
                                });
                            }}
                            activeOpacity={0.7}
                            accessibilityLabel="Toggle audio guidance"
                        >
                            <Ionicons name={audioEnabled ? "volume-high" : "volume-mute"} size={22} color={audioEnabled ? T.violet : T.ink4} />
                        </TouchableOpacity>
                    </PremiumBar>
                )}

                {/* ── Search Overlay ── */}
                {searchActive && (
                    <View style={s.searchOverlay}>
                        <Pressable
                            style={s.searchOverlayBackdrop}
                            onPress={() => deactivateSearch(false)}
                            pointerEvents="box-only"
                        />
                        <View style={[s.searchOverlayContent, { paddingTop: insets.top + 76 }]}>
                            {query.length === 0 ? (
                                <>
                                    <Text style={s.searchSectionTitle}>Recent searches</Text>
                                    {recentPlaces.length === 0 ? (
                                        <Text style={s.searchEmptyText}>No recent searches yet</Text>
                                    ) : (
                                        recentPlaces.map(place => (
                                            <TouchableOpacity
                                                key={place.id}
                                                style={s.searchRow}
                                                onPress={() => handleResolvedPlaceSelect(place)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={s.searchIconWrap}>
                                                    <Ionicons name="time-outline" size={16} color={T.violet} />
                                                </View>
                                                <View style={s.searchTextWrap}>
                                                    <Text style={s.searchTitle}>{place.name}</Text>
                                                    <Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </>
                            ) : (
                                <>
                                    <Text style={s.searchSectionTitle}>Suggestions</Text>
                                    {searchSuggestions.length === 0 ? (
                                        <Text style={s.searchEmptyText}>
                                            {searchStatus === 'MISSING_KEY'
                                                ? 'Missing Google Maps API key'
                                                : searchStatus && searchStatus !== 'OK'
                                                    ? `Places API error: ${searchStatus}`
                                                    : 'No results found'}
                                        </Text>
                                    ) : (
                                        searchSuggestions.slice(0, 10).map(place => (
                                            <TouchableOpacity
                                                key={place.id}
                                                style={s.searchRow}
                                                onPress={() => handlePlaceSelect(place)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={s.searchIconWrap}>
                                                    <Ionicons name="location" size={16} color={T.violet} />
                                                </View>
                                                <View style={s.searchTextWrap}>
                                                    <Text style={s.searchTitle}>{place.name}</Text>
                                                    <Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* ── Start Location Overlay ── */}
                {startSearchActive && (
                    <View style={s.searchOverlay}>
                        <Pressable
                            style={s.searchOverlayBackdrop}
                            onPress={() => setStartSearchActive(false)}
                            pointerEvents="box-only"
                        />
                        <View style={[s.searchOverlayContent, { paddingTop: insets.top + 56 }]}>
                            <View style={s.startSearchHeader}>
                                <Ionicons name="search-outline" size={16} color={T.ink4} style={s.searchIcon} />
                                <TextInput
                                    ref={startInputRef}
                                    style={s.startSearchInput}
                                    placeholder="Choose start location"
                                    placeholderTextColor={T.ink4}
                                    value={startSearchText}
                                    onChangeText={setStartSearchText}
                                    returnKeyType="search"
                                    selectionColor={T.violet}
                                />
                                {startSearchText.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setStartSearchText('')}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={16} color={T.ink4} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text style={s.searchSectionTitle}>Start location</Text>
                            <TouchableOpacity
                                style={s.searchRow}
                                onPress={handleStartCurrentLocation}
                                activeOpacity={0.7}
                            >
                                <View style={s.searchIconWrap}>
                                    <Ionicons name="locate" size={16} color={T.violet} />
                                </View>
                                <View style={s.searchTextWrap}>
                                    <Text style={s.searchTitle}>Your location</Text>
                                    <Text style={s.searchSubtitle} numberOfLines={1}>Use current GPS location</Text>
                                </View>
                            </TouchableOpacity>

                            {startQuery.length === 0 ? (
                                <>
                                    <Text style={s.searchSectionTitle}>Recent searches</Text>
                                    {recentPlaces.length === 0 ? (
                                        <Text style={s.searchEmptyText}>No recent searches yet</Text>
                                    ) : (
                                        recentPlaces.map(place => (
                                            <TouchableOpacity
                                                key={place.id}
                                                style={s.searchRow}
                                                onPress={() => handleStartSelect(place)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={s.searchIconWrap}>
                                                    <Ionicons name="time-outline" size={16} color={T.violet} />
                                                </View>
                                                <View style={s.searchTextWrap}>
                                                    <Text style={s.searchTitle}>{place.name}</Text>
                                                    <Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </>
                            ) : (
                                <>
                                    <Text style={s.searchSectionTitle}>Suggestions</Text>
                                    {startSuggestions.length === 0 ? (
                                        <Text style={s.searchEmptyText}>
                                            {startStatus === 'MISSING_KEY'
                                                ? 'Missing Google Maps API key'
                                                : startStatus && startStatus !== 'OK'
                                                    ? `Places API error: ${startStatus}`
                                                    : 'No results found'}
                                        </Text>
                                    ) : (
                                        startSuggestions.slice(0, 10).map(place => (
                                            <TouchableOpacity
                                                key={place.id}
                                                style={s.searchRow}
                                                onPress={() => handleStartPredictionSelect(place)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={s.searchIconWrap}>
                                                    <Ionicons name="location" size={16} color={T.violet} />
                                                </View>
                                                <View style={s.searchTextWrap}>
                                                    <Text style={s.searchTitle}>{place.name}</Text>
                                                    <Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* ── Current location control button ── */}
                {!directionsMode && !selectedPlace && (
                    <View style={s.mapControls}>
                        <TouchableOpacity
                            style={s.ctrlBtn}
                            onPress={openLocationCard}
                            accessibilityLabel="Show my location"
                            accessibilityRole="button"
                        >
                            <Ionicons name="locate-outline" size={22} color={T.violet} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Location Card ── */}
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

                {/* ── Place Detail Sheet ── */}
                {placeSheetOpen && selectedPlace && (
                    <>
                        <RNAnimated.View style={[s.placeSheetBackdrop, { opacity: placeSheetOpacity }]}>
                            <Pressable style={StyleSheet.absoluteFill} onPress={closePlaceSheet} />
                        </RNAnimated.View>

                        <RNAnimated.View
                            style={[
                                s.placeSheet,
                                { transform: [{ translateY: RNAnimated.add(placeSheetY, placeSheetDragY) }] },
                                { opacity: placeSheetOpacity },
                            ]}
                            {...sheetPanResponder.panHandlers}
                        >
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={s.placeSheetTint} pointerEvents="none" />

                            <View style={s.placeSheetHandleWrap}>
                                <View style={s.placeSheetHandle} />
                            </View>

                            <View style={s.placeSheetHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.placeSheetTitle}>{selectedPlace.name}</Text>
                                    <Text style={s.placeSheetSubtitle} numberOfLines={1}>{selectedPlace.address}</Text>
                                </View>
                            </View>

                            <View style={s.placeSheetActions}>
                                <TouchableOpacity
                                    style={[s.placeSheetActionBtn, s.placeSheetActionBtnPrimary]}
                                    onPress={() => enterDirectionsMode(selectedPlace)}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="navigate" size={16} color={T.onPrimary} />
                                    <Text style={s.placeSheetActionBtnTextPrimary}>Directions</Text>
                                </TouchableOpacity>

                                {!placeSheetIsDangerZone && (
                                    <TouchableOpacity
                                        style={[s.placeSheetActionBtn, s.placeSheetActionBtnSecondary]}
                                        onPress={openAddSafePlace}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="shield-checkmark-outline" size={16} color={T.violet} />
                                        <Text style={s.placeSheetActionBtnTextSecondary}>Add Safe Place</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                keyboardVerticalOffset={insets.top + 56}
                                style={s.safePlaceKeyboardAvoiding}
                            >
                                <View style={s.placeSheetSection}>
                                    {placeSheetMode === 'incidents' || placeSheetIsDangerZone ? (
                                        <>
                                            <Text style={s.placeSheetSectionTitle}>Incidents at this location</Text>
                                            {placeIncidents.length === 0 ? (
                                                <Text style={s.placeSheetEmpty}>No reported incidents yet</Text>
                                            ) : (
                                                placeIncidents.map(inc => (
                                                    <View key={inc.id} style={s.placeIncidentRow}>
                                                        <View style={s.placeIncidentInfo}>
                                                            <Text style={s.placeIncidentName}>{inc.reporter}</Text>
                                                            <Text style={s.placeIncidentTime}>{inc.time}</Text>
                                                        </View>
                                                        <View style={[
                                                            s.placeIncidentPill,
                                                            inc.status === 'ACTIVE' && s.placeIncidentPillActive,
                                                            inc.status === 'RESOLVED' && s.placeIncidentPillResolved,
                                                            inc.status === 'CANCELLED' && s.placeIncidentPillCancelled,
                                                        ]}>
                                                            <Text style={s.placeIncidentPillText}>{inc.status}</Text>
                                                        </View>
                                                    </View>
                                                ))
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Text style={s.placeSheetSectionTitle}>Add Safe Place</Text>
                                            {safePlaceSubmitState === 'success' ? (
                                                <RNAnimated.View
                                                    style={[
                                                        s.safePlaceSuccessWrap,
                                                        {
                                                            opacity: safePlaceSuccessAnim,
                                                            transform: [{
                                                                translateY: safePlaceSuccessAnim.interpolate({
                                                                    inputRange: [0, 1],
                                                                    outputRange: [10, 0],
                                                                }),
                                                            }],
                                                        },
                                                    ]}
                                                >
                                                    <View style={s.safePlaceSuccessIcon}>
                                                        <Ionicons name="checkmark" size={18} color={T.onPrimary} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={s.safePlaceSuccessTitle}>Sent to admin</Text>
                                                        <Text style={s.safePlaceSuccessSubtitle}>
                                                            Your safe place request was sent to admin for confirmation.
                                                        </Text>
                                                    </View>
                                                </RNAnimated.View>
                                            ) : (
                                                <>
                                                    <Text style={s.safePlaceQuestion}>
                                                        Why is this place safe? (Describe briefly)
                                                    </Text>
                                                    <TextInput
                                                        value={safePlaceAnswer}
                                                        onChangeText={(v) => {
                                                            setSafePlaceAnswer(v);
                                                            if (safePlaceError) setSafePlaceError(null);
                                                        }}
                                                        placeholder="Type your answer…"
                                                        placeholderTextColor={T.ink4}
                                                        multiline
                                                        textAlignVertical="top"
                                                        style={s.safePlaceInput}
                                                        selectionColor={T.violet}
                                                    />
                                                    {!!safePlaceError && (
                                                        <Text style={s.safePlaceError}>{safePlaceError}</Text>
                                                    )}
                                                    <View style={s.safePlaceActions}>
                                                        <TouchableOpacity
                                                            style={[s.safePlaceBtn, s.safePlaceBtnCancel]}
                                                            onPress={cancelAddSafePlace}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Text style={s.safePlaceBtnTextCancel}>Cancel</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[
                                                                s.safePlaceBtn,
                                                                s.safePlaceBtnSecondary,
                                                                safePlaceAnswer.trim().length === 0 && s.safePlaceBtnPrimaryDisabled,
                                                            ]}
                                                            onPress={safePlaceAnswer.trim().length === 0 ? undefined : submitAddSafePlace}
                                                            activeOpacity={safePlaceAnswer.trim().length === 0 ? 1 : 0.8}
                                                        >
                                                            <Text style={s.safePlaceBtnTextSecondary}>Submit</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </>
                                            )}
                                        </>
                                    )}
                                </View>
                            </KeyboardAvoidingView>
                        </RNAnimated.View>
                    </>
                )}

                {/* ── Step-by-Step Instruction Card ── */}
                {directionsMode && navInstructions.length > 0 && (
                    <View style={[ns.cardWrap, { bottom: navBottom + NAV_HEIGHT + 16 }]}>
                        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={ns.cardTint} pointerEvents="none" />
                        {routeUnsafe && scanState !== 'SCANNING' && (
                            <View style={ns.warningBadge}>
                                <Ionicons name="warning" size={12} color="#E25B3A" style={{ marginRight: 4 }} />
                                <Text style={ns.warningBadgeText}>Route passes through {blockedZoneName ?? 'a red zone'}</Text>
                            </View>
                        )}
                        <View style={ns.cardBody}>
                            <View style={ns.iconWrap}>
                                <Ionicons
                                    name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver) as any}
                                    size={22}
                                    color={T.violet}
                                />
                            </View>
                            <View style={ns.textWrap}>
                                <Text style={ns.instrText} numberOfLines={2}>
                                    {navInstructions[currentStepIdx]?.instruction}
                                </Text>
                                <Text style={ns.distText}>
                                    {navInstructions[currentStepIdx]?.distance}
                                </Text>
                            </View>
                        </View>
                        <View style={ns.cardFooter}>
                            <Text style={ns.stepCounter}>
                                Step {currentStepIdx + 1} of {navInstructions.length}
                            </Text>
                            {!isLiveNav ? (
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    {showSafePath && scanState !== 'SCANNING' && (
                                        <TouchableOpacity
                                            style={ns.safePathBtn}
                                            onPress={triggerSafetyRecalculation}
                                            activeOpacity={0.75}
                                        >
                                            <Ionicons name="shield-checkmark" size={13} color={T.onPrimary} style={{ marginRight: 4 }} />
                                            <Text style={ns.safePathBtnText}>SAFE PATH</Text>
                                        </TouchableOpacity>
                                    )}
                                    {currentStepIdx > 0 && (
                                        <TouchableOpacity
                                            style={ns.navBtn}
                                            onPress={() => setCurrentStepIdx(prev => Math.max(prev - 1, 0))}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="chevron-back" size={16} color={T.ink2} />
                                        </TouchableOpacity>
                                    )}
                                    {currentStepIdx < navInstructions.length - 1 && (
                                        <TouchableOpacity
                                            style={ns.navBtn}
                                            onPress={() => setCurrentStepIdx(prev => Math.min(prev + 1, navInstructions.length - 1))}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="chevron-forward" size={16} color={T.ink2} />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={ns.goLiveBtn}
                                        onPress={() => setIsLiveNav(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="navigate" size={12} color={T.onPrimary} style={{ marginRight: 4 }} />
                                        <Text style={ns.goLiveBtnText}>GO LIVE</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[ns.goLiveBtn, { backgroundColor: 'rgba(138,56,246,0.15)', borderColor: 'rgba(138,56,246,0.3)' }]}
                                        onPress={() => setIsReviewMode(!isReviewMode)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="list" size={14} color={T.violet} style={{ marginRight: 4 }} />
                                        <Text style={[ns.goLiveBtnText, { color: T.violet }]}>{isReviewMode ? 'CLOSE' : 'REVIEW'}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={ns.endLiveBtn}
                                    onPress={() => setIsLiveNav(false)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={ns.endLiveBtnText}>Exit Live Mode</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* ── Redesigned Architecture Scan Overlay Container ── */}
                <SafetyScanOverlay
                    scanState={scanState}
                    spinAnim={scanAnim}
                    r0={radarAnim0} r1={radarAnim1} r2={radarAnim2}
                    zoneName={blockedZoneName}
                    onClose={() => setScanState(null)}
                />

                {/* ── Bottom Navbar ── */}
                <View style={[s.navWrap, { bottom: navBottom }]} pointerEvents="box-none">
                    <PremiumBar style={s.navBar} contentStyle={s.navBarContent}>
                        {NAV_TABS.map(tab => (
                            <NavTab
                                key={tab.id}
                                tab={tab}
                                isActive={tab.id === 'Explore'}
                                onPress={() => {
                                    if (tab.id === 'Explore') {
                                        refreshAndRecenterMap();
                                    } else if (tab.id === 'Home') {
                                        navigateSafely('/(tabs)/users/standard-user/sos_screen', true);
                                    } else if (tab.id === 'Chat') {
                                        navigateSafely('/(tabs)/users/standard-user/chat_home');
                                    } else if (tab.id === 'Medical') {
                                        navigateSafely('/(tabs)/users/standard-user/MedicalDashboard');
                                    }
                                }}
                            />
                        ))}
                    </PremiumBar>
                </View>
            </View>
        </AtmosphericShell>
    );
}

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

const s = StyleSheet.create({
    root: { flex: 1 },
    crosshairWrap: {
        position: 'absolute', alignSelf: 'center',
        top: height * 0.29, zIndex: 10, width: 40, height: 40,
        alignItems: 'center', justifyContent: 'center',
    },
    crosshairH: { position: 'absolute', width: 28, height: 1.5, backgroundColor: T.violet, opacity: 0.85, borderRadius: 1 },
    crosshairV: { position: 'absolute', width: 1.5, height: 28, backgroundColor: T.violet, opacity: 0.85, borderRadius: 1 },
    crosshairDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.violet },
    header: {
        position: 'absolute', left: 14, right: 14, borderRadius: 28, zIndex: 300,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingVertical: 11 },
    directionsHeaderWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
    directionsFields: { flex: 1, backgroundColor: T.surfaceBulky, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 6, paddingHorizontal: 10, gap: 6 },
    directionsInput: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    directionsInputText: { fontSize: 13, fontWeight: '600', color: T.ink },
    directionsIcon: { width: 16, textAlign: 'center' },
    directionsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 2 },
    travelModeWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
    travelModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, backgroundColor: T.surfaceBulky, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    travelModeBtnActive: { backgroundColor: T.violet, borderColor: `${T.violet}80` },
    travelModeText: { fontSize: 11, fontWeight: '600', color: T.ink3 },
    travelModeTextActive: { color: T.onPrimary },
    startSearchHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surfaceBulky, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, height: 38, marginBottom: 12 },
    startSearchInput: { flex: 1, fontSize: 13, fontWeight: '500', color: T.ink, height: 38, padding: 0 },
    headerBtns: { flexDirection: 'row', gap: S.s2, alignItems: 'center', marginLeft: S.s2 },
    hBtn: { width: 36, height: 36, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    profileBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 6, shadowColor: '#8A38F6' },
        }),
    },
    profileAvatar: { width: 38, height: 38, borderRadius: 19 },
    notifDot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface },
    searchBarWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: T.surfaceBulky, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, height: 38 },
    searchIcon: { marginRight: 6 },
    searchInput: { flex: 1, fontSize: 13, fontWeight: '500', color: T.ink, height: 38, padding: 0 },
    searchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0B0716', zIndex: 240 },
    searchOverlayBackdrop: { ...StyleSheet.absoluteFillObject },
    searchOverlayContent: { paddingHorizontal: 16, gap: 12 },
    searchSectionTitle: { fontSize: 11, fontWeight: '700', color: T.ink3, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
    searchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 8 },
    searchIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: T.violetDim, borderWidth: 1, borderColor: `${T.violet}35`, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    searchTextWrap: { flex: 1 },
    searchTitle: { fontSize: 14, fontWeight: '700', color: T.ink, letterSpacing: -0.2 },
    searchSubtitle: { fontSize: 12, fontWeight: '500', color: T.ink3, marginTop: 2 },
    searchEmptyText: { fontSize: 13, color: T.ink4, marginTop: 4 },
    mapControls: { position: 'absolute', right: 20, top: '35%', gap: 8, alignItems: 'flex-end', zIndex: 290 },
    zoneDebugBanner: { position: 'absolute', left: 16, right: 16, zIndex: 310, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', paddingHorizontal: 12, paddingVertical: 8 },
    zoneDebugText: { color: '#FCA5A5', fontSize: 11, fontWeight: '700' },
    ctrlBtn: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: T.surfaceBulky, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },
    placeMarkerWrap: { alignItems: 'center', justifyContent: 'center', width: 26, height: 26 },
    placeMarkerIconWrap: {
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 7, shadowColor: '#8A38F6' },
        }),
    },
    placeMarkerStem: { width: 0, height: 0 },
    placeSheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,3,8,0.35)', zIndex: 230 },
    placeSheet: {
        position: 'absolute', left: 0, right: 0, height: height * 0.5, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', zIndex: 240, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 12 },
        }),
    },
    placeSheetTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,9,22,0.92)' },
    placeSheetHandleWrap: { alignItems: 'center', paddingTop: 10 },
    placeSheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: T.lineBold, opacity: 0.6 },
    placeSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
    placeSheetTitle: { fontSize: 18, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
    placeSheetSubtitle: { fontSize: 12, fontWeight: '500', color: T.ink3, marginTop: 4 },
    placeSheetActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
    placeSheetActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
    placeSheetActionBtnPrimary: { backgroundColor: T.violet, borderColor: `${T.violet}70` },
    placeSheetActionBtnSecondary: { backgroundColor: T.surfaceBulky, borderColor: `${T.violet}45` },
    placeSheetActionBtnTextPrimary: { fontSize: 12, fontWeight: '800', color: T.onPrimary, letterSpacing: 0.2 },
    placeSheetActionBtnTextSecondary: { fontSize: 12, fontWeight: '800', color: T.violet, letterSpacing: 0.2 },
    safePlaceQuestion: { fontSize: 12, fontWeight: '600', color: T.ink3, lineHeight: 16 },
    safePlaceInput: { minHeight: 96, borderRadius: 14, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: T.ink },
    safePlaceError: { fontSize: 12, fontWeight: '600', color: T.danger, marginTop: -4 },
    safePlaceActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    safePlaceSuccessWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, backgroundColor: `${T.success}14`, borderWidth: 1, borderColor: `${T.success}35`, marginTop: 6 },
    safePlaceSuccessIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center' },
    safePlaceSuccessTitle: { fontSize: 13, fontWeight: '800', color: T.ink, letterSpacing: -0.2 },
    safePlaceSuccessSubtitle: { marginTop: 2, fontSize: 12, fontWeight: '600', color: T.ink3, lineHeight: 16 },
    safePlaceBtn: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    safePlaceBtnSecondary: { backgroundColor: T.surfaceBulky, borderColor: `${T.violet}45` },
    safePlaceBtnCancel: { backgroundColor: T.dangerLight, borderColor: T.dangerBorder },
    safePlaceBtnPrimary: { backgroundColor: T.violet, borderColor: `${T.violet}70` },
    safePlaceBtnPrimaryDisabled: { backgroundColor: `${T.violet}40`, borderColor: `${T.violet}40` },
    safePlaceBtnTextSecondary: { fontSize: 12, fontWeight: '800', color: T.violet, letterSpacing: 0.2 },
    safePlaceBtnTextCancel: { fontSize: 12, fontWeight: '800', color: T.danger, letterSpacing: 0.2 },
    safePlaceBtnTextPrimary: { fontSize: 12, fontWeight: '800', color: T.onPrimary, letterSpacing: 0.2 },
    safePlaceKeyboardAvoiding: { width: '100%' },
    placeSheetSection: { paddingHorizontal: 18, paddingTop: 6, gap: 10 },
    placeSheetSectionTitle: { fontSize: 11, fontWeight: '700', color: T.ink3, letterSpacing: 1.0, textTransform: 'uppercase' },
    placeSheetEmpty: { fontSize: 13, color: T.ink4 },
    placeIncidentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    placeIncidentInfo: { flex: 1 },
    placeIncidentName: { fontSize: 13, fontWeight: '700', color: T.ink },
    placeIncidentTime: { fontSize: 11, fontWeight: '500', color: T.ink3, marginTop: 2 },
    placeIncidentPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    placeIncidentPillActive: { backgroundColor: T.violetDim, borderColor: `${T.violet}55` },
    placeIncidentPillResolved: { backgroundColor: T.safeLight, borderColor: `${T.success}40` },
    placeIncidentPillCancelled: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' },
    placeIncidentPillText: { fontSize: 10, fontWeight: '700', color: T.ink, letterSpacing: 0.6 },
    locationBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,3,8,0.26)', zIndex: 220 },
    locationCard: {
        position: 'absolute', left: 14, right: 14, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: `${T.violet}30`, zIndex: 250,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    locationCardGrabberWrap: { alignItems: 'center', paddingTop: 10 },
    locationCardGrabber: { width: 42, height: 4, borderRadius: 2, backgroundColor: T.lineBold, opacity: 0.75 },
    locationCardTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.80)' },
    locationCardContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: 10, paddingBottom: 14, gap: S.s3 },
    locationCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.s3 },
    locationCardIconWrap: { width: 40, height: 40, borderRadius: R.hBtn, backgroundColor: `${T.violet}18`, borderWidth: 1, borderColor: `${T.violet}30`, alignItems: 'center', justifyContent: 'center' },
    locationCardTitle: { fontSize: 11, fontWeight: '700', color: T.ink4, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
    locationCardAddr: { fontSize: 13, fontWeight: '600', color: T.ink, letterSpacing: -0.1, lineHeight: 18 },
    locationCardClose: { width: 36, height: 36, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    navWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 200 },
    navBar: {
        width: width * 0.88, borderRadius: R.pill,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    navBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, paddingVertical: 8 },
    navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    navTabInner: { alignItems: 'center', gap: 0 },
    navUnderline: { width: 16, height: 3, borderRadius: 1.5, marginTop: 5 },
    navIconBox: { width: 36, height: 36, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    navIconBoxActive: { backgroundColor: 'rgba(138,56,246,0.12)', borderColor: `${T.violet}40` },
});

const ns = StyleSheet.create({
    cardWrap: {
        position: 'absolute', left: 14, right: 14, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 260,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    cardTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.88)' },
    cardBody: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: S.s4, paddingBottom: S.s2, gap: S.s3 },
    iconWrap: { width: 44, height: 44, borderRadius: R.sm, backgroundColor: T.violetDim, borderWidth: 1, borderColor: `${T.violet}35`, alignItems: 'center', justifyContent: 'center' },
    textWrap: { flex: 1 },
    instrText: { fontSize: 14, fontWeight: '700', color: T.ink, letterSpacing: -0.2, lineHeight: 20 },
    distText: { fontSize: 12, fontWeight: '600', color: T.ink3, marginTop: 2 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.s4, paddingBottom: S.s3, paddingTop: S.s2 },
    stepCounter: { fontSize: 11, fontWeight: '600', color: T.ink4, letterSpacing: 0.4 },
    autoAdvanceText: { fontSize: 11, fontWeight: '500', color: T.violet, letterSpacing: 0.2 },
    navBtn: { width: 32, height: 32, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    goLiveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 32, borderRadius: R.pill, backgroundColor: T.violet, borderWidth: 1, borderColor: `${T.violet}70` },
    goLiveBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.2 },
    endLiveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    endLiveBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.2 },
    safePathBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 32, borderRadius: R.pill, backgroundColor: '#E25B3A', borderWidth: 1, borderColor: 'rgba(226,91,58,0.6)' },
    safePathBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.3 },
    warningBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: S.s2, paddingBottom: 2 },
    warningBadgeText: { fontSize: 11, fontWeight: '600', color: '#E25B3A', letterSpacing: 0.2 },
});

const lb = StyleSheet.create({
    bannerWrap: { position: 'absolute', left: 14, right: 14, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 360 },
    bannerTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.85)' },
    bannerBody: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingVertical: S.s4, gap: S.s4 },
    textWrap: { flex: 1 },
    distText: { fontSize: 16, fontWeight: '800', color: T.violet, marginBottom: 4, letterSpacing: -0.2 },
    instrText: { fontSize: 18, fontWeight: '700', color: T.ink, letterSpacing: -0.3, lineHeight: 22 },
    audioBtn: { width: 44, height: 44, borderRadius: R.hBtn, backgroundColor: `${T.violet}10`, borderWidth: 1, borderColor: `${T.violet}25`, alignItems: 'center', justifyContent: 'center' },
});

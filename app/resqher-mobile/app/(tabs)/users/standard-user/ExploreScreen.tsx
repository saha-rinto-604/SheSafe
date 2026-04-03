/**
 * app/(tabs)/users/standard-user/ExploreScreen.tsx
 * Explore — Map view with animated search header, location card, and nav bar.
 */

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert,
    Dimensions, StatusBar, Platform, ViewStyle,
    TextInput, Keyboard, Pressable, Modal, ScrollView, Image, PanResponder,
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
import { DHAKA_INCIDENTS, type PlaceIncident } from '../../../../src/data/dhakaIncidents';
import { incidentService, type IncidentZone } from '../../../../src/services/api';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const { width, height } = Dimensions.get('window');

const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14;

const DEFAULT_REGION = {
    latitude: 23.8103, longitude: 90.4125,
    latitudeDelta: 0.014, longitudeDelta: 0.014,
};

// ── Incident Zones ──────────────────────────────────────────────────────────
// Default zones are always visible. API-fetched SOS zones merge on top.
// 1-4 incidents → Yellow zone, 5+ incidents → Red zone.
const ZONE_REFRESH_INTERVAL_MS = 30_000; // refresh every 30 seconds

const DEFAULT_INCIDENT_ZONES: IncidentZone[] = [
    { id: 'z1', name: 'Syednagar', latitude: 23.7981, longitude: 90.4495, radius: 200, incidentCount: 8, incidents: [] },
    { id: 'z2', name: 'Pragati Sarani', latitude: 23.8135, longitude: 90.4216, radius: 200, incidentCount: 3, incidents: [] },
    { id: 'z3', name: 'Kawran Bazar', latitude: 23.8155, longitude: 90.4255, radius: 200, incidentCount: 7, incidents: [] },
    { id: 'z4', name: 'Mirpur 10 Circle', latitude: 23.8069, longitude: 90.3687, radius: 200, incidentCount: 2, incidents: [] },
    { id: 'z5', name: 'Dhanmondi Lake', latitude: 23.7465, longitude: 90.3760, radius: 200, incidentCount: 6, incidents: [] },
    { id: 'z6', name: 'Gulshan 2', latitude: 23.7931, longitude: 90.4148, radius: 200, incidentCount: 1, incidents: [] },
    { id: 'z7', name: 'Banani', latitude: 23.7940, longitude: 90.4043, radius: 200, incidentCount: 9, incidents: [] },
    { id: 'z8', name: 'Mohakhali', latitude: 23.7788, longitude: 90.3989, radius: 200, incidentCount: 4, incidents: [] },
    { id: 'z9', name: 'Farmgate', latitude: 23.7561, longitude: 90.3872, radius: 200, incidentCount: 5, incidents: [] },
    { id: 'z10', name: 'Mohammadpur', latitude: 23.7658, longitude: 90.3584, radius: 200, incidentCount: 10, incidents: [] },
    { id: 'z11', name: 'Shyamoli', latitude: 23.7718, longitude: 90.3631, radius: 200, incidentCount: 2, incidents: [] },
    { id: 'z12', name: 'Banasree', latitude: 23.7634, longitude: 90.4323, radius: 200, incidentCount: 6, incidents: [] },
    { id: 'z13', name: 'Motijheel', latitude: 23.7286, longitude: 90.4173, radius: 200, incidentCount: 3, incidents: [] },
    { id: 'z14', name: 'Uttara Sector 11', latitude: 23.8732, longitude: 90.3952, radius: 200, incidentCount: 11, incidents: [] },
    { id: 'z15', name: 'Khilgaon', latitude: 23.7378, longitude: 90.4251, radius: 200, incidentCount: 4, incidents: [] },
    { id: 'z16', name: 'Lalbagh', latitude: 23.7176, longitude: 90.3855, radius: 200, incidentCount: 7, incidents: [] },
    { id: 'z17', name: 'Agargaon', latitude: 23.7784, longitude: 90.3756, radius: 200, incidentCount: 1, incidents: [] },
    { id: 'z18', name: 'Rampura', latitude: 23.7612, longitude: 90.4208, radius: 200, incidentCount: 3, incidents: [] },
];

const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance in metres.
 * d = 2R · arcsin( √( sin²((φ₂−φ₁)/2) + cos(φ₁)·cos(φ₂)·sin²((λ₂−λ₁)/2) ) )
 */
function haversineDistance(a: LatLng, b: LatLng): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Returns an object indicating safety and the name of the avoided zone if applicable.
 *  Both Yellow (1-4 incidents) and Red (5+ incidents) zones trigger route avoidance. */
function checkRouteSafety(coordinates: LatLng[], zones: IncidentZone[]): { isSafe: boolean; blockedZoneName?: string } {
    for (let i = 0; i < coordinates.length; i++) {
        const point = coordinates[i];
        for (const zone of zones) {
            // Both Yellow and Red zones block navigation
            if (zone.incidentCount >= 1 && haversineDistance(point, zone) <= zone.radius) {
                return { isSafe: false, blockedZoneName: zone.name };
            }
        }
    }
    return { isSafe: true };
}

/** Strip HTML tags from Google's html_instructions. */
const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, '');

type NavStep = {
    instruction: string;
    distance: string;
    maneuver?: string;
    endLocation?: LatLng;
};

/** Map Google maneuver strings → Ionicons names with string-contains fallback. */
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
    bar: { backgroundColor: 'rgba(30,21,58,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: T.surfaceOverlay },
    content: { flexDirection: 'row', alignItems: 'center' },
});

type LatLng = { latitude: number; longitude: number };

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
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates: LatLng[] = [];

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += deltaLat;

        result = 0;
        shift = 0;
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
    const startInputRef = useRef<TextInput>(null);

    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
    const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'motorcycle' | 'transit'>('driving');
    const [isLiveNav, setIsLiveNav] = useState(false);
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
    const [incidentZones, setIncidentZones] = useState<IncidentZone[]>(DEFAULT_INCIDENT_ZONES);

    const locationSubRef = useRef<Location.LocationSubscription | null>(null);

    // Load profile picture on screen focus
    useFocusEffect(
        useCallback(() => {
            getUserProfile().then(setProfile);
        }, []),
    );

    // Fetch incident zones from backend on mount + every 30 seconds
    // API zones merge with defaults: if an API zone is within 500m of a default,
    // the default's count is increased; otherwise the API zone is added as new.
    useEffect(() => {
        const mergeZones = (apiZones: IncidentZone[]): IncidentZone[] => {
            const merged = DEFAULT_INCIDENT_ZONES.map(d => ({ ...d }));
            for (const apiZone of apiZones) {
                let found = false;
                for (const m of merged) {
                    if (haversineDistance(apiZone, m) <= 500) {
                        m.incidentCount += apiZone.incidentCount;
                        m.incidents = [...(m.incidents || []), ...(apiZone.incidents || [])];
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    merged.push({ ...apiZone });
                }
            }
            return merged;
        };

        const fetchZones = () => {
            incidentService.getIncidentZones()
                .then((apiZones) => setIncidentZones(mergeZones(apiZones)))
                .catch((err) => console.warn('[Explore] Failed to fetch zones:', err?.message));
        };
        fetchZones(); // initial fetch
        const interval = setInterval(fetchZones, ZONE_REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    // Animation values
    const searchProgress = useRef(new RNAnimated.Value(0)).current; // 0 collapsed → 1 expanded
    const locationCardY = useRef(new RNAnimated.Value(300)).current;
    const locationCardOpacity = useRef(new RNAnimated.Value(0)).current;
    const placeSheetY = useRef(new RNAnimated.Value(height)).current;
    const placeSheetOpacity = useRef(new RNAnimated.Value(0)).current;
    const placeSheetDragY = useRef(new RNAnimated.Value(0)).current;
    const directionsProgress = useRef(new RNAnimated.Value(0)).current;

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

            locationSubRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 2000,
                    distanceInterval: 5,
                },
                (loc) => {
                    setUserLoc({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        heading: loc.coords.heading ?? undefined,
                    });
                }
            );
        })();

        return () => {
            if (locationSubRef.current) {
                locationSubRef.current.remove();
            }
        };
    }, []);

    // Auto-Camera & Auto-Step Advance
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
    }, [userLoc, directionsMode, navInstructions, currentStepIdx, isLiveNav]);

    // Audio Guidance
    useEffect(() => {
        if (isLiveNav && audioEnabled && navInstructions.length > 0 && currentStepIdx < navInstructions.length) {
            Speech.speak(navInstructions[currentStepIdx].instruction);
        }
    }, [isLiveNav, audioEnabled, currentStepIdx, navInstructions]);

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
    const deactivateSearch = useCallback((clearText: boolean) => {
        Keyboard.dismiss();
        setSearchActive(false);
        if (clearText) setSearchText('');
        RNAnimated.timing(searchProgress, {
            toValue: 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
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

            console.log(`[Google Places API] Autocomplete status for "${input}":`, data?.status);

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
        if (!GOOGLE_MAPS_API_KEY) return null as PlaceSuggestion | null;
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
            if (!GOOGLE_MAPS_API_KEY) {
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
                // 1️⃣  Fetch all routes
                const res = await fetch(baseUrl);
                const data = await res.json();

                if (!data?.routes?.length) {
                    Alert.alert('Route error', 'No route found between these locations.');
                    return;
                }

                let chosenRoute = data.routes[0];
                let chosenCoords = decodePolyline(chosenRoute.overview_polyline?.points ?? '');

                // 2️⃣  Red-Zone safety check with "Memory"
                let safetyCheck = checkRouteSafety(chosenCoords, incidentZones);
                let foundSafe = safetyCheck.isSafe;
                const primaryAvoidedArea = safetyCheck.blockedZoneName;

                if (!foundSafe && data.routes.length > 1) {
                    for (let i = 1; i < data.routes.length; i++) {
                        const route = data.routes[i];
                        const altCoords = decodePolyline(route.overview_polyline?.points ?? '');
                        const altCheck = checkRouteSafety(altCoords, incidentZones);
                        if (altCheck.isSafe) {
                            chosenRoute = route;
                            chosenCoords = altCoords;
                            foundSafe = true;
                            break;
                        }
                    }
                }

                // 3️⃣  Apply polyline
                setRouteCoords(chosenCoords);

                // 4️⃣  Extract turn-by-turn instructions
                const steps = chosenRoute?.legs?.[0]?.steps ?? [];
                const instructions: NavStep[] = steps.map((step: any) => ({
                    instruction: stripHtml(step.html_instructions ?? ''),
                    distance: step.distance?.text ?? '',
                    maneuver: step.maneuver,
                    endLocation: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : undefined,
                }));
                setNavInstructions(instructions);
                setCurrentStepIdx(0);

                // 5️⃣  Fit map to safe route and trigger Notification
                if (chosenCoords.length > 1) {
                    mapRef.current?.fitToCoordinates(chosenCoords, {
                        edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 },
                        animated: true,
                    });
                }

                if (primaryAvoidedArea) {
                    setTimeout(() => {
                        if (foundSafe) {
                            Alert.alert(
                                '🛡️ Secure Path Active',
                                `Safety Optimization: We have bypassed the standard ${primaryAvoidedArea} route due to security cautions and selected the safest alternative for your journey.`
                            );
                            Speech.speak("Safety update: Redirecting to avoid high risk areas.");
                        } else {
                            Alert.alert(
                                '⚠️ Security Alert',
                                'No fully safe route identified. Proceed with extreme caution.'
                            );
                        }
                    }, 800);
                }
            } catch {
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
    }, [directionsMode, endLocation, startLocation, travelMode, incidentZones]);

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
        if (!place) {
            Alert.alert('Place not found', 'Unable to fetch location details.');
            return;
        }
        handleResolvedPlaceSelect(place);
    }, [handleResolvedPlaceSelect, resolvePlaceDetails]);

    // Show location card
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

    // Hide location card
    const closeLocationCard = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(locationCardY, { toValue: 300, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(locationCardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setShowLocationCard(false));
    }, []);

    const openPlaceSheet = useCallback((place: PlaceSuggestion) => {
        setPlaceSheetOpen(true);
        placeSheetY.setValue(height);
        placeSheetOpacity.setValue(0);
        placeSheetDragY.setValue(0);
        setPlaceIncidents(DHAKA_INCIDENTS[place.id] ?? []);
        RNAnimated.parallel([
            RNAnimated.spring(placeSheetY, { toValue: height * 0.5, useNativeDriver: true, tension: 70, friction: 12 }),
            RNAnimated.timing(placeSheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

    const openZoneSheet = useCallback((zone: IncidentZone) => {
        const mockPlace: PlaceSuggestion = {
            id: zone.id,
            name: `${zone.name} Area`,
            address: `${zone.incidentCount >= 5 ? 'High Risk' : 'Caution'} Zone - ${zone.incidentCount} reported incidents.`,
            latitude: zone.latitude,
            longitude: zone.longitude
        };
        setSelectedPlace(mockPlace);
        setPlaceSheetOpen(true);
        placeSheetY.setValue(height);
        placeSheetOpacity.setValue(0);
        placeSheetDragY.setValue(0);
        
        let incidents: PlaceIncident[] = [];
        
        // Add real incidents if available
        if (zone.incidents && zone.incidents.length > 0) {
            incidents = zone.incidents.map(i => {
                let timeStr = 'A while ago';
                if (i.time) {
                    const diffMs = Date.now() - new Date(i.time).getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    if (diffMins < 60) timeStr = `${diffMins || 1} min ago`;
                    else if (diffMins < 1440) timeStr = `${Math.floor(diffMins/60)} hr ago`;
                    else timeStr = `${Math.floor(diffMins/1440)} days ago`;
                }

                return {
                    id: String(i.id || `rnd-${zone.id}-${Math.random()}`),
                    reporter: i.reporter || 'Anonymous User',
                    time: timeStr,
                    status: i.status || 'ACTIVE'
                };
            });
        }

        // Pad with mock data for default zones that don't have real incidents yet
        const missing = Math.max(0, zone.incidentCount - incidents.length);
        const statuses: ('ACTIVE' | 'RESOLVED' | 'CANCELLED')[] = ['ACTIVE', 'ACTIVE', 'RESOLVED', 'CANCELLED'];
        const names = ['Ayesha K.', 'Fatima R.', 'Nadia A.', 'Anonymous User', 'Sadia M.', 'Officer Rahim', 'Rafiq Islam', 'Nabil Hasan'];
        
        for (let i = 0; i < Math.min(missing, 15 - incidents.length); i++) {
            incidents.push({
                id: `mock-${zone.id}-${i}`,
                reporter: names[Math.floor(Math.random() * names.length)],
                time: `${Math.floor(Math.random() * 59) + 1} min ago`,
                status: statuses[Math.floor(Math.random() * statuses.length)]
            });
        }
        
        setPlaceIncidents(incidents.sort((a,b) => a.status === 'ACTIVE' ? -1 : 1));

        RNAnimated.parallel([
            RNAnimated.spring(placeSheetY, { toValue: height * 0.5, useNativeDriver: true, tension: 70, friction: 12 }),
            RNAnimated.timing(placeSheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

    const closePlaceSheet = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(placeSheetY, { toValue: height, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(placeSheetOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => setPlaceSheetOpen(false));
        placeSheetDragY.setValue(0);
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

    const enterDirectionsMode = useCallback((destination: PlaceSuggestion) => {
        setDirectionsMode(true);
        setEndLocation(destination);
        setRouteCoords([]);
        RNAnimated.timing(directionsProgress, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        closePlaceSheet();
    }, [closePlaceSheet, directionsProgress]);

    const exitDirectionsMode = useCallback(() => {
        setDirectionsMode(false);
        setIsLiveNav(false);
        setStartSearchActive(false);
        setStartSearchText('');
        setStartLocation(null);
        setRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        RNAnimated.timing(directionsProgress, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [directionsProgress]);

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

    // ── Map Long Press → Auto-route from current location ──────────────────────
    const handleMapLongPress = useCallback(async (event: any) => {
        if (directionsMode || searchActive || placeSheetOpen || showLocationCard) return;
        const { latitude, longitude } = event.nativeEvent.coordinate;
        if (!userLoc) return;

        // Reverse-geocode the tapped location
        let placeName = 'Selected Location';
        let placeAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
            const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geo.length > 0) {
                const g = geo[0];
                placeName = g.name || g.street || placeName;
                placeAddress = [g.street, g.district ?? g.subregion, g.city ?? g.region]
                    .filter(Boolean).join(', ') || placeAddress;
            }
        } catch { /* use defaults */ }

        // Create destination place
        const destination: PlaceSuggestion = {
            id: `tap-${Date.now()}`,
            name: placeName,
            address: placeAddress,
            latitude,
            longitude,
        };

        // Create start from current location
        const start: PlaceSuggestion = {
            id: 'current-location',
            name: 'Your location',
            address: address || 'Current location',
            latitude: userLoc.latitude,
            longitude: userLoc.longitude,
        };

        // Set selected place marker
        setSelectedPlace(destination);

        // Enter directions mode with auto-start
        setStartLocation(start);
        setEndLocation(destination);
        setRouteCoords([]);
        setDirectionsMode(true);
        RNAnimated.timing(directionsProgress, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [directionsMode, searchActive, placeSheetOpen, showLocationCard, userLoc, address, directionsProgress]);


    return (
        <AtmosphericShell>
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
                    onLongPress={handleMapLongPress}
                >
                    {incidentZones.map(zone => {
                        const isRed = zone.incidentCount >= 5;
                        const isYellow = zone.incidentCount >= 1 && zone.incidentCount < 5;
                        if (!isRed && !isYellow) return null;
                        
                        const fillColor = isRed ? "rgba(255, 60, 60, 0.15)" : "rgba(255, 180, 0, 0.15)";
                        const strokeColor = isRed ? "rgba(255, 60, 60, 0.5)" : "rgba(255, 180, 0, 0.5)";
                        const badgeBg = isRed ? T.danger : '#F5A623';

                        return (
                            <React.Fragment key={zone.id}>
                                <Circle
                                    center={{ latitude: zone.latitude, longitude: zone.longitude }}
                                    radius={zone.radius}
                                    fillColor={fillColor}
                                    strokeColor={strokeColor}
                                    strokeWidth={1}
                                />
                                <Marker
                                    coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                    tracksViewChanges={false}
                                    onPress={() => openZoneSheet(zone)}
                                >
                                    <View style={{ backgroundColor: badgeBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#fff' }}>
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{zone.incidentCount}</Text>
                                    </View>
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
                            onPress={() => openPlaceSheet(selectedPlace)}
                        >
                            <View style={s.placeMarkerWrap}>
                                <View style={s.placeMarkerIconWrap}>
                                    <Ionicons name="location" size={26} color={T.violet} />
                                </View>
                                <View style={s.placeMarkerStem} />
                            </View>
                        </Marker>
                    )}

                    {routeCoords.length > 1 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                </MapView>

                {locationStatus === 'idle' && <PulseRadar />}




                {/* ── Header with Animated Search ──────────────────────────────── */}
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

                                    {/* Travel Mode Selector */}
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
                                        onPress={() => deactivateSearch(true)}
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
                                </RNAnimated.View>
                            </>
                        )}
                    </PremiumBar>
                )}

                {/* ── Top Live Banner ────────────────────────────────────────── */}
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

                {/* ── Search Overlay — suggestions + recent (map hidden) ───────── */}
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

                {/* ── Start Location Overlay ─────────────────────────────── */}
                {startSearchActive && (
                    <View style={s.searchOverlay}>
                        <Pressable
                            style={s.searchOverlayBackdrop}
                            onPress={() => setStartSearchActive(false)}
                            pointerEvents="box-only"
                        />
                        <View style={[s.searchOverlayContent, { paddingTop: insets.top + 56 }]}
                        >
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

                {/* ── Current location button (35% from top) ───────────────────── */}
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

                {/* ── Place Detail Sheet — half screen ─────────────────────── */}
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
                                <TouchableOpacity
                                    style={s.placeSheetDirectionBtn}
                                    onPress={() => enterDirectionsMode(selectedPlace)}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="navigate" size={16} color={T.onPrimary} />
                                    <Text style={s.placeSheetDirectionText}>Directions</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={s.placeSheetSection}>
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
                            </View>
                        </RNAnimated.View>
                    </>
                )}

                {/* ── Step-by-Step Instruction Card ────────────────────────────── */}
                {directionsMode && navInstructions.length > 0 && (
                    <View style={[ns.cardWrap, { bottom: navBottom + NAV_HEIGHT + 16 }]}>
                        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={ns.cardTint} pointerEvents="none" />
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
                                    } else if (tab.id === 'Chat') {
                                        router.push('/(tabs)/users/standard-user/chat_home');
                                    } else if (tab.id === 'Medical') {
                                        router.push('/(tabs)/users/standard-user/MedicalDashboard');
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
    root: { flex: 1 },

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
        borderRadius: 28, zIndex: 300,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    headerContent: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingVertical: 11,
    },
    directionsHeaderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: '100%',
    },
    directionsFields: {
        flex: 1,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 6,
        paddingHorizontal: 10,
        gap: 6,
    },
    directionsInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
    },
    directionsInputText: {
        fontSize: 13,
        fontWeight: '600',
        color: T.ink,
    },
    directionsIcon: {
        width: 16,
        textAlign: 'center',
    },
    directionsDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginVertical: 2,
    },
    travelModeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        gap: 8,
    },
    travelModeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    travelModeBtnActive: {
        backgroundColor: T.violet,
        borderColor: `${T.violet}80`,
    },
    travelModeText: {
        fontSize: 11,
        fontWeight: '600',
        color: T.ink3,
    },
    travelModeTextActive: {
        color: T.onPrimary,
    },

    // ── Start search input ─────────────────────────────────────────────
    startSearchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceBulky,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        height: 38,
        marginBottom: 12,
    },
    startSearchInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: T.ink,
        height: 38,
        padding: 0,
    },
    headerBtns: { flexDirection: 'row', gap: S.s2, alignItems: 'center', marginLeft: S.s2 },
    hBtn: {
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
    notifDot: {
        position: 'absolute', top: 7, right: 7,
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface,
    },

    // ── Search Bar ─────────────────────────────────────────────────────────
    searchBarWrap: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: T.surfaceBulky,
        borderRadius: R.md,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
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

    // ── Search Overlay ───────────────────────────────────────────────────
    searchOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#0B0716',
        zIndex: 240,
    },
    searchOverlayBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    searchOverlayContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    searchSectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 8,
    },
    searchIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    searchTextWrap: { flex: 1 },
    searchTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.2,
    },
    searchSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: T.ink3,
        marginTop: 2,
    },
    searchEmptyText: {
        fontSize: 13,
        color: T.ink4,
        marginTop: 4,
    },

    // ── Map controls ───────────────────────────────────────────────────────
    mapControls: { position: 'absolute', right: 20, top: '35%', gap: 8, alignItems: 'flex-end', zIndex: 290 },
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

    // ── Selected Place Marker ───────────────────────────────────────────
    placeMarkerWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
    },
    placeMarkerIconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 7, shadowColor: '#8A38F6' },
        }),
    },
    placeMarkerStem: {
        width: 0,
        height: 0,
    },

    // ── Place Detail Sheet ──────────────────────────────────────────────
    placeSheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(3,3,8,0.35)',
        zIndex: 230,
    },
    placeSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: height * 0.5,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        zIndex: 240,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 12 },
        }),
    },
    placeSheetTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(12,9,22,0.92)',
    },
    placeSheetHandleWrap: {
        alignItems: 'center',
        paddingTop: 10,
    },
    placeSheetHandle: {
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: T.lineBold,
        opacity: 0.6,
    },
    placeSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 18,
        paddingTop: 8,
        paddingBottom: 12,
    },
    placeSheetTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.3,
    },
    placeSheetSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: T.ink3,
        marginTop: 4,
    },
    placeSheetDirectionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: T.violet,
        borderWidth: 1,
        borderColor: `${T.violet}70`,
    },
    placeSheetDirectionText: {
        fontSize: 12,
        fontWeight: '700',
        color: T.onPrimary,
        letterSpacing: 0.2,
    },
    placeSheetSection: {
        paddingHorizontal: 18,
        paddingTop: 6,
        gap: 10,
    },
    placeSheetSectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.0,
        textTransform: 'uppercase',
    },
    placeSheetEmpty: {
        fontSize: 13,
        color: T.ink4,
    },
    placeIncidentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    placeIncidentInfo: {
        flex: 1,
    },
    placeIncidentName: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink,
    },
    placeIncidentTime: {
        fontSize: 11,
        fontWeight: '500',
        color: T.ink3,
        marginTop: 2,
    },
    placeIncidentPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeIncidentPillActive: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}55`,
    },
    placeIncidentPillResolved: {
        backgroundColor: T.safeLight,
        borderColor: `${T.success}40`,
    },
    placeIncidentPillCancelled: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.15)',
    },
    placeIncidentPillText: {
        fontSize: 10,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: 0.6,
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
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
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
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    navIconBoxActive: {
        backgroundColor: 'rgba(138,56,246,0.12)',
        borderColor: `${T.violet}40`,
    },
});

// ── Navigation Instruction Card Styles ───────────────────────────────────────
const ns = StyleSheet.create({
    cardWrap: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: R.lg, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 260,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    cardTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,10,18,0.88)',
    },
    cardBody: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingTop: S.s4, paddingBottom: S.s2,
        gap: S.s3,
    },
    iconWrap: {
        width: 44, height: 44, borderRadius: R.sm,
        backgroundColor: T.violetDim,
        borderWidth: 1, borderColor: `${T.violet}35`,
        alignItems: 'center', justifyContent: 'center',
    },
    textWrap: { flex: 1 },
    instrText: {
        fontSize: 14, fontWeight: '700',
        color: T.ink, letterSpacing: -0.2,
        lineHeight: 20,
    },
    distText: {
        fontSize: 12, fontWeight: '600',
        color: T.ink3, marginTop: 2,
    },
    cardFooter: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: S.s4, paddingBottom: S.s3, paddingTop: S.s2,
    },
    stepCounter: {
        fontSize: 11, fontWeight: '600',
        color: T.ink4, letterSpacing: 0.4,
    },
    autoAdvanceText: {
        fontSize: 11, fontWeight: '500',
        color: T.violet, letterSpacing: 0.2,
    },
    navBtn: {
        width: 32, height: 32, borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    goLiveBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, height: 32,
        borderRadius: R.pill,
        backgroundColor: T.violet,
        borderWidth: 1, borderColor: `${T.violet}70`,
    },
    goLiveBtnText: {
        fontSize: 11, fontWeight: '700',
        color: T.onPrimary, letterSpacing: 0.2,
    },
    endLiveBtn: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    endLiveBtnText: {
        fontSize: 11, fontWeight: '700',
        color: T.onPrimary, letterSpacing: 0.2,
    },
});

// ── Top Live Banner Styles ───────────────────────────────────────────
const lb = StyleSheet.create({
    bannerWrap: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: R.lg, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 360,
    },
    bannerTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,10,18,0.85)',
    },
    bannerBody: {
        width: '100%',
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingVertical: S.s4,
        gap: S.s4,
    },
    textWrap: { flex: 1 },
    distText: {
        fontSize: 16, fontWeight: '800',
        color: T.violet, marginBottom: 4, letterSpacing: -0.2,
    },
    instrText: {
        fontSize: 18, fontWeight: '700',
        color: T.ink, letterSpacing: -0.3,
        lineHeight: 22,
    },
    audioBtn: {
        width: 44, height: 44, borderRadius: R.hBtn,
        backgroundColor: `${T.violet}10`,
        borderWidth: 1, borderColor: `${T.violet}25`,
        alignItems: 'center', justifyContent: 'center',
    },
});


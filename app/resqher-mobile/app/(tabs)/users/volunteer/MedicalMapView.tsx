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
    Dimensions, Platform, ScrollView, ViewStyle, Image, Alert, Linking,
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
    DOCTORS, HOSPITALS, PHARMACIES, AMBULANCES,
    RED_ZONES,
    SPECIALIST_CHIPS, AMBULANCE_CHIPS, GENERIC_CHIPS,
} from '../../../../src/data/medicalMockData';
import type { MedicalCategory, ShiftFilter, QuickChip } from '../../../../src/types/medical';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14;
const ACTIVE_COLOR = T.violet;
const INACTIVE_COLOR = T.navIconInactive;

const KHILKHET_ORIGIN = { latitude: 23.8249, longitude: 90.4234 };
const JAMUNA_FUTURE_PARK = { latitude: 23.813334, longitude: 90.424164 };
const DEFAULT_REGION = {
    latitude: KHILKHET_ORIGIN.latitude,
    longitude: KHILKHET_ORIGIN.longitude,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
};

type MedicalCategoryView = 'specialists' | 'hospital' | 'pharmacy' | 'ambulance';
type ProviderCard = {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    rating: number;
    affiliation?: string;
    address?: string;
    degree?: string;
    specialty?: string;
    hospital?: string;
    shift?: ShiftFilter;
    phone?: string;
    hotline?: string;
    type: MedicalCategoryView;
};

type LatLng = { latitude: number; longitude: number };
type NavStep = {
    instruction: string;
    distance: string;
    maneuver?: string;
    endLocation?: LatLng;
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
    safeColor: '#3B82F6',
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

const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, '');

function haversineDistance(a: LatLng, b: LatLng): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusM = 6_371_000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

function getManeuverIcon(maneuver?: string): React.ComponentProps<typeof Ionicons>['name'] {
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

function formatDuration(seconds: number | null): string | null {
    if (seconds === null || seconds === undefined) return null;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MedicalMapView — Main Screen
// ═══════════════════════════════════════════════════════════════════════════════
export default function MedicalMapView() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ category?: string; shift?: string }>();
    const rawCategory = (params.category ?? 'specialists') as MedicalCategory;
    const category: MedicalCategory = (rawCategory === 'specialists' || rawCategory === 'hospital' || rawCategory === 'pharmacy' || rawCategory === 'ambulance')
        ? rawCategory
        : 'specialists';
    const shift = (params.shift ?? 'now') as ShiftFilter;

    const mapRef = useRef<MapView>(null);
    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [selectedChip, setSelectedChip] = useState('all');
    const [selectedPin, setSelectedPin] = useState<string | null>(null);
    const [showCallout, setShowCallout] = useState(false);
    const [safeRoute, setSafeRoute] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const [navInstructions, setNavInstructions] = useState<NavStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [routeEta, setRouteEta] = useState<string | null>(null);
    const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
    const [isRouting, setIsRouting] = useState(false);
    const [isLiveNav, setIsLiveNav] = useState(false);
    const [medProfile, setMedProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        getUserProfile().then(setMedProfile).catch(() => {});
    }, []);
    const [travelMode, setTravelMode] = useState<'walking' | 'driving' | 'motorcycle' | 'transit'>('walking');
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [completedRouteCoords, setCompletedRouteCoords] = useState<LatLng[]>([]);
    const [remainingRouteCoords, setRemainingRouteCoords] = useState<LatLng[]>([]);
    const [locationPermitted, setLocationPermitted] = useState(false);
    const [showRouteOverview, setShowRouteOverview] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const lastRerouteOriginRef = useRef<LatLng | null>(null);
    const routeOverlaySlideY = useRef(new RNAnimated.Value(0)).current;

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
        if (category === 'specialists') return SPECIALIST_CHIPS;
        if (category === 'ambulance') return AMBULANCE_CHIPS;
        return GENERIC_CHIPS;
    }, [category]);

    useEffect(() => {
        if (category !== 'specialists' && selectedChip !== 'all') {
            setSelectedChip('all');
        }
    }, [category, selectedChip]);

    // ── Provider pins data ──────────────────────────────────────────────────
    const providers = useMemo<ProviderCard[]>(() => {
        switch (category) {
            case 'specialists': {
                const doctor = DOCTORS[0];
                return [
                    {
                        id: 'jamuna-doctor',
                        name: doctor?.name ?? 'Dr. Sarah Ahmed',
                        latitude: JAMUNA_FUTURE_PARK.latitude,
                        longitude: JAMUNA_FUTURE_PARK.longitude,
                        rating: doctor?.rating ?? 4.8,
                        affiliation: doctor?.affiliation ?? 'Jamuna Future Park Area',
                        degree: doctor?.degree ?? 'MBBS, FCPS',
                        specialty: doctor?.specialty ?? 'Cardiologist',
                        hospital: doctor?.hospital ?? 'Jamuna Future Park Medical Wing',
                        shift,
                        phone: doctor?.phone ?? '01XXXXXXXXX',
                        type: 'specialists',
                    },
                ];
            }
            case 'hospital':
                {
                    const hospital = HOSPITALS[0];
                    return hospital
                        ? [
                            {
                                id: 'jamuna-hospital',
                                name: hospital.name,
                                latitude: JAMUNA_FUTURE_PARK.latitude,
                                longitude: JAMUNA_FUTURE_PARK.longitude,
                                rating: hospital.rating ?? 0,
                                affiliation: hospital.affiliation ?? '',
                                address: hospital.address,
                                type: 'hospital',
                            },
                        ]
                        : [];
                }
            case 'ambulance': {
                let ambs = [...AMBULANCES];
                if (selectedChip !== 'all') {
                    ambs = ambs.filter(a => a.type === selectedChip);
                }
                return ambs.map(a => ({
                    id: a.id,
                    name: a.affiliation ?? a.providerName,
                    latitude: JAMUNA_FUTURE_PARK.latitude,
                    longitude: JAMUNA_FUTURE_PARK.longitude,
                    rating: a.rating ?? 0,
                    affiliation: a.affiliation ?? '',
                    address: a.affiliation ?? '',
                    hotline: a.contactNumber ?? '999 / 017XXXXXXXX',
                    type: 'ambulance',
                }));
            }
            case 'pharmacy':
                {
                    const pharmacy = PHARMACIES[0];
                    return pharmacy
                        ? [
                            {
                                id: 'jamuna-pharmacy',
                                name: pharmacy.name,
                                latitude: JAMUNA_FUTURE_PARK.latitude,
                                longitude: JAMUNA_FUTURE_PARK.longitude,
                                rating: pharmacy.rating ?? 0,
                                affiliation: pharmacy.affiliation ?? '',
                                address: pharmacy.address,
                                type: 'pharmacy',
                            },
                        ]
                        : [];
                }
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
            case 'pharmacy': return 'Pharmacy';
            default: return 'Medical';
        }
    }, [category]);

    // ── Get user location ───────────────────────────────────────────────────
    useEffect(() => {
        setTimeout(() => {
            mapRef.current?.animateToRegion(
                { ...KHILKHET_ORIGIN, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800
            );
        }, 600);
    }, []);

    useEffect(() => {
        let mounted = true;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (!mounted) return;
            if (status !== 'granted') {
                setLocationPermitted(false);
                return;
            }

            setLocationPermitted(true);

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            if (!mounted) return;
            setUserLoc({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                heading: position.coords.heading ?? undefined,
            });
        })();

        return () => {
            mounted = false;
            if (locationSubRef.current) {
                locationSubRef.current.remove();
                locationSubRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!isLiveNav || !locationPermitted) {
            if (locationSubRef.current) {
                locationSubRef.current.remove();
                locationSubRef.current = null;
            }
            return;
        }

        (async () => {
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
                },
            );
        })();

        return () => {
            if (locationSubRef.current) {
                locationSubRef.current.remove();
                locationSubRef.current = null;
            }
        };
    }, [isLiveNav, locationPermitted]);

    useEffect(() => {
        if (!mapReady || !providers.length) return;
        const coords = [KHILKHET_ORIGIN, ...providers.map(p => ({ latitude: p.latitude, longitude: p.longitude }))];
        mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 140, right: 80, bottom: 360, left: 80 },
            animated: true,
        });
    }, [mapReady, providers]);

    const buildLiveRoute = useCallback(async (
        origin: LatLng,
        destination: LatLng,
        fitMap = true,
    ) => {
        if (!GOOGLE_MAPS_API_KEY) {
            Alert.alert('Missing Maps API key', 'Directions API key is not configured.');
            return;
        }

        setIsRouting(true);
        const originParam = `${origin.latitude},${origin.longitude}`;
        const destinationParam = `${destination.latitude},${destination.longitude}`;
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}&destination=${destinationParam}&mode=${travelMode === 'motorcycle' ? 'two_wheeler' : travelMode}&alternatives=true&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;

        try {
            const res = await fetch(directionsUrl);
            const data = await res.json();
            const route = data?.routes?.[0];

            if (!route) {
                Alert.alert('Route unavailable', 'No route found for this doctor right now.');
                return;
            }

            const routeCoords = decodePolyline(route.overview_polyline?.points ?? '');
            if (!routeCoords.length) {
                Alert.alert('Route unavailable', 'Could not decode route path.');
                return;
            }

            setSafeRoute(routeCoords);
            setCompletedRouteCoords([]);
            setRemainingRouteCoords(routeCoords);

            const steps = route?.legs?.[0]?.steps ?? [];
            const instructions: NavStep[] = steps.map((step: any) => ({
                instruction: stripHtml(step.html_instructions ?? ''),
                distance: step.distance?.text ?? '',
                maneuver: step.maneuver,
                endLocation: step.end_location
                    ? {
                        latitude: step.end_location.lat,
                        longitude: step.end_location.lng,
                    }
                    : undefined,
            }));
            setNavInstructions(instructions);
            setCurrentStepIdx(0);
            const durSec = route?.legs?.[0]?.duration?.value ?? null;
            const distM = route?.legs?.[0]?.distance?.value ?? null;
            setRouteEta(formatDuration(durSec));
            setRouteDistanceKm(distM ? +(distM / 1000).toFixed(1) : null);

            if (fitMap && routeCoords.length > 1) {
                mapRef.current?.fitToCoordinates(routeCoords, {
                    edgePadding: { top: 120, right: 60, bottom: 360, left: 60 },
                    animated: true,
                });
            }

            lastRerouteOriginRef.current = origin;
        } catch {
            Alert.alert('Route error', 'Unable to fetch live route right now.');
        } finally {
            setIsRouting(false);
        }
    }, []);

    // ── Pin tap handler — open doctor details ───────────────────────────────
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

    }, [calloutY, calloutOpacity]);

    // ── Close callout ───────────────────────────────────────────────────────
    const closeCallout = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(calloutY, { toValue: 400, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(calloutOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            setShowCallout(false);
            setSelectedPin(null);
        });
    }, [calloutY, calloutOpacity]);

    const hideCalloutKeepRoute = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(calloutY, { toValue: 400, duration: 240, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(calloutOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setShowCallout(false);
        });
    }, [calloutY, calloutOpacity]);

    const getDistanceKm = useCallback((from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
        const toRad = (value: number) => (value * Math.PI) / 180;
        const earthRadiusKm = 6371;
        const dLat = toRad(to.latitude - from.latitude);
        const dLng = toRad(to.longitude - from.longitude);
        const lat1 = toRad(from.latitude);
        const lat2 = toRad(to.latitude);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }, []);

    const selectedDistanceKm = useMemo(() => {
        if (!selectedProvider) return null;
        return getDistanceKm(KHILKHET_ORIGIN, {
            latitude: selectedProvider.latitude,
            longitude: selectedProvider.longitude,
        });
    }, [getDistanceKm, selectedProvider]);

    const handleDirections = useCallback(() => {
        if (!selectedProvider) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const destination = {
            latitude: selectedProvider.latitude,
            longitude: selectedProvider.longitude,
        };

        hideCalloutKeepRoute();
        setIsLiveNav(false);
        setShowRouteOverview(true);

        // Animate route overview header in
        routeOverlaySlideY.setValue(-100);
        RNAnimated.spring(routeOverlaySlideY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();

        buildLiveRoute(KHILKHET_ORIGIN, destination, true);
    }, [buildLiveRoute, hideCalloutKeepRoute, selectedProvider, routeOverlaySlideY]);

    const handleCallHotline = useCallback(async () => {
        if (!selectedProvider?.hotline) return;
        const hotline = selectedProvider.hotline.replace(/\s/g, '');
        const url = `tel:${hotline}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                Alert.alert('Call failed', 'This device cannot place a call right now.');
                return;
            }
            await Linking.openURL(url);
        } catch {
            Alert.alert('Call failed', 'Unable to start a call right now.');
        }
    }, [selectedProvider]);

    const closeRouteOverview = useCallback(() => {
        RNAnimated.timing(routeOverlaySlideY, {
            toValue: -100,
            duration: 260,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            setShowRouteOverview(false);
            setSafeRoute(null);
            setNavInstructions([]);
            setCurrentStepIdx(0);
        });
    }, [routeOverlaySlideY]);

    const handleStartLive = useCallback(() => {
        if (!selectedProvider) return;
        if (!locationPermitted || !userLoc) {
            Alert.alert('Location required', 'Enable location access to use Live Mode.');
            return;
        }

        setIsLiveNav(true);
        buildLiveRoute(
            { latitude: userLoc.latitude, longitude: userLoc.longitude },
            { latitude: selectedProvider.latitude, longitude: selectedProvider.longitude },
            false,
        );
    }, [buildLiveRoute, locationPermitted, selectedProvider, userLoc]);

    const handleExitLive = useCallback(() => {
        setIsLiveNav(false);
        setCurrentStepIdx(0);
    }, []);

    useEffect(() => {
        if (!isLiveNav || !userLoc) return;
        mapRef.current?.animateCamera(
            {
                center: { latitude: userLoc.latitude, longitude: userLoc.longitude },
                pitch: 45,
                heading: userLoc.heading ?? 0,
                zoom: 19,
            },
            { duration: 900 },
        );
    }, [isLiveNav, userLoc]);

    useEffect(() => {
        if (!isLiveNav || !selectedProvider || !userLoc || isRouting) return;

        if (navInstructions.length > 0 && currentStepIdx < navInstructions.length - 1) {
            const currentStep = navInstructions[currentStepIdx];
            if (currentStep.endLocation) {
                const dist = haversineDistance(userLoc, currentStep.endLocation);
                if (dist <= 25) {
                    setCurrentStepIdx(prev => prev + 1);
                }
            }
        }

        // Progress polyline update
        if (safeRoute && safeRoute.length > 0) {
            let closestIdx = 0;
            let minD = Infinity;
            safeRoute.forEach((pt, i) => {
                const d = haversineDistance(userLoc, pt);
                if (d < minD) { minD = d; closestIdx = i; }
            });
            setCompletedRouteCoords(safeRoute.slice(0, closestIdx + 1));
            setRemainingRouteCoords(safeRoute.slice(closestIdx));
        }

        const lastOrigin = lastRerouteOriginRef.current;
        if (lastOrigin && haversineDistance(lastOrigin, userLoc) < 50) return;

        buildLiveRoute(
            { latitude: userLoc.latitude, longitude: userLoc.longitude },
            { latitude: selectedProvider.latitude, longitude: selectedProvider.longitude },
            false,
        );
    }, [
        buildLiveRoute,
        currentStepIdx,
        isLiveNav,
        isRouting,
        navInstructions,
        selectedProvider,
        userLoc,
        safeRoute,
    ]);

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

    
    // Re-fetch route when travel mode changes
    useEffect(() => {
        if (showRouteOverview && selectedProvider) {
            buildLiveRoute(
                KHILKHET_ORIGIN,
                { latitude: selectedProvider.latitude, longitude: selectedProvider.longitude },
                true
            );
        }
    }, [travelMode]);
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
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    moveOnMarkerPress={false}
                    customMapStyle={TACTICAL_MAP_STYLE}
                    onMapReady={() => setMapReady(true)}
                    onPress={() => {
                        if (showCallout) closeCallout();
                    }}
                >
                    {/* User Origin Marker */}
                    <Marker
                        coordinate={KHILKHET_ORIGIN}
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={998}
                    >
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: T.violet, borderWidth: 2, borderColor: '#fff' }} />
                    </Marker>

                    {/* Live User Marker */}
                    {isLiveNav && userLoc && (
                        <Marker
                            coordinate={{ latitude: userLoc.latitude, longitude: userLoc.longitude }}
                            anchor={{ x: 0.5, y: 0.5 }}
                            zIndex={1000}
                        >
                            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#fff' }} />
                        </Marker>
                    )}

                    {/* Provider Pins */}
                    {providers.map(p => (
                        <Marker
                            key={p.id}
                            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                            onPress={() => handlePinPress(p.id)}
                            tracksViewChanges
                        >
                            <View style={[
                                st.pinContainer,
                                selectedPin === p.id && st.pinContainerActive,
                            ]}>
                                <Ionicons
                                    name={
                                        p.type === 'specialists'
                                            ? 'medkit'
                                            : p.type === 'hospital'
                                                ? 'business'
                                                : p.type === 'ambulance'
                                                    ? 'car'
                                                    : 'bandage'
                                    }
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
                    {/* Completed route (green) */}
                    {completedRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={completedRouteCoords}
                            strokeColor="#3B82F6"
                            strokeWidth={5}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                    {/* Remaining route (violet) */}
                    {remainingRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={remainingRouteCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                    {/* Fallback: full route if no progress split yet */}
                    {completedRouteCoords.length === 0 && safeRoute && safeRoute.length > 1 && (
                        <Polyline
                            coordinates={safeRoute}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                </MapView>

                {/* ── Route Overview Header (Floating Capsule) ── */}
                {showRouteOverview && (
                    <RNAnimated.View style={[st.routeOverlayWrap, { top: insets.top + 8, transform: [{ translateY: routeOverlaySlideY }] }]}>
                        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={st.routeOverlayTint} pointerEvents="none" />
                        <View style={st.routeOverlayInner}>
                            <TouchableOpacity
                                style={st.routeOverlayCloseBtn}
                                onPress={closeRouteOverview}
                                activeOpacity={0.7}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <Ionicons name="close" size={20} color={D.title} />
                            </TouchableOpacity>

                            <Text style={st.routeOverlayTitle}>Route Overview</Text>
                        </View>
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, paddingHorizontal: 16 }}>
                                {(['walking', 'driving', 'motorcycle', 'transit'] as const).map(mode => (
                                    <TouchableOpacity
                                        key={mode}
                                        style={{
                                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                                            paddingVertical: 8, borderRadius: 999,
                                            backgroundColor: travelMode === mode ? T.violet : 'rgba(255,255,255,0.06)',
                                            borderWidth: 1, borderColor: travelMode === mode ? T.violet : 'rgba(255,255,255,0.08)',
                                        }}
                                        onPress={() => setTravelMode(mode)}
                                    >
                                        <Ionicons
                                            name={mode === 'driving' ? 'car' : mode === 'walking' ? 'walk' : mode === 'motorcycle' ? 'bicycle' : 'bus'}
                                            size={16}
                                            color={travelMode === mode ? T.onPrimary : T.ink3}
                                        />
                                        <Text style={{ color: travelMode === mode ? '#fff' : '#A09CB2', fontSize: 11, fontWeight: '700' }}>
                                            {mode === 'motorcycle' ? 'Bike' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                    </RNAnimated.View>
                )}

                {/* ── Top Header ── */}
                {!showRouteOverview && (
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
                )}

                {/* ── 12px Breathing Space Spacer ──────────────────────────────── */}
                <View style={{ marginTop: 12 }} />

                {/* ── GPS / Recenter — Right-side floating glass container (SOS standard) ── */}
                {!showRouteOverview && (
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
                )}

                {/* ── Results Count Badge — 12px below header for breathing room ── */}
                {!showRouteOverview && (
                    <View style={[st.resultsBadge, { top: insets.top + 8 + 58 + 12 }]}>
                        <Text style={st.resultsBadgeText}>
                            {providers.length} {providers.length === 1 ? 'result' : 'results'}
                        </Text>
                    </View>
                )}

                {safeRoute && selectedProvider && (
                    <View style={[st.livePanel, { bottom: navBottom + NAV_HEIGHT + (category === 'specialists' ? 80 : 12) }]}>
                        <Text style={st.livePanelTitle}>Route to {selectedProvider.name}</Text>
                        {(routeEta || routeDistanceKm != null) ? (
                            <View style={st.livePanelMetaRow}>
                                {routeEta && (
                                    <View style={st.routeMetaItem}>
                                        <Ionicons name="time-outline" size={14} color={T.violet} />
                                        <Text style={st.routeMetaText}>{routeEta}</Text>
                                    </View>
                                )}
                                {routeDistanceKm != null && (
                                    <View style={st.routeMetaItem}>
                                        <Ionicons name="location-outline" size={14} color={T.violet} />
                                        <Text style={st.routeMetaText}>{routeDistanceKm} km</Text>
                                    </View>
                                )}
                            </View>
                        ) : null}
                        {navInstructions.length > 0 ? (
                            <View style={st.liveStepRow}>
                                <Ionicons
                                    name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver)}
                                    size={16}
                                    color={T.violet}
                                />
                                <Text style={st.liveStepText} numberOfLines={2}>
                                    {navInstructions[currentStepIdx]?.instruction || 'Continue on the route'}
                                </Text>
                            </View>
                        ) : null}
                        <View style={st.liveActionsRow}>
                            {!isLiveNav ? (
                                <TouchableOpacity
                                    style={st.liveActionBtn}
                                    onPress={handleStartLive}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="navigate" size={12} color={T.onPrimary} style={{ marginRight: 6 }} />
                                    <Text style={st.liveActionText}>GO LIVE</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[st.liveActionBtn, st.liveActionExit]}
                                    onPress={handleExitLive}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="close-circle" size={14} color={T.onPrimary} />
                                    <Text style={st.liveActionText}>Exit Live Mode</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* ── Callout Bottom Sheet ── */}
                {showCallout && selectedProvider && (
                    <>
                        <TouchableOpacity
                            style={st.calloutBackdrop}
                            onPress={closeCallout}
                            activeOpacity={1}
                        />
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
                            <View style={st.calloutContentStack}>
                                <View style={st.calloutTextWrapFull}>
                                    <Text style={st.calloutName} numberOfLines={1}>
                                        {selectedProvider.name}
                                    </Text>
                                    {selectedProvider.type === 'specialists' ? (
                                        <>
                                            <Text style={st.calloutAffiliation} numberOfLines={1}>
                                                {selectedProvider.specialty}
                                            </Text>
                                            <Text style={st.calloutMetaText} numberOfLines={1}>
                                                {selectedProvider.degree}
                                            </Text>
                                            <Text style={st.calloutMetaText} numberOfLines={1}>
                                                {selectedProvider.hospital}
                                            </Text>
                                            <Text style={st.calloutMetaText} numberOfLines={1}>
                                                Shift: {selectedProvider.shift}
                                            </Text>
                                            <Text style={st.calloutMetaText}>
                                                Phone: {selectedProvider.phone ?? '01XXXXXXXXX'}
                                            </Text>
                                        </>
                                    ) : selectedProvider.type === 'ambulance' ? (
                                        <>
                                            <Text style={st.calloutAffiliation} numberOfLines={2}>
                                                {selectedProvider.name}
                                            </Text>
                                            <Text style={st.calloutMetaLabel}>Ambulance Hotline:</Text>
                                            <Text style={st.calloutMetaText}>
                                                {selectedProvider.hotline ?? '999 / 017XXXXXXXX'}
                                            </Text>
                                            {selectedDistanceKm !== null ? (
                                                <Text style={st.calloutMetaText}>
                                                    Distance: {selectedDistanceKm.toFixed(1)} km
                                                </Text>
                                            ) : null}
                                        </>
                                    ) : (
                                        <>
                                            {selectedProvider.address ? (
                                                <Text style={st.calloutAffiliation} numberOfLines={2}>
                                                    {selectedProvider.address}
                                                </Text>
                                            ) : null}
                                            {selectedDistanceKm !== null ? (
                                                <Text style={st.calloutMetaText}>
                                                    Distance: {selectedDistanceKm.toFixed(1)} km
                                                </Text>
                                            ) : null}
                                        </>
                                    )}
                                </View>

                                {selectedProvider.type === 'ambulance' ? (
                                    <View style={st.calloutActionRow}>
                                        <TouchableOpacity
                                            style={st.calloutActionBtn}
                                            onPress={handleCallHotline}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="call" size={14} color={T.violet} />
                                            <Text style={st.calloutActionText}>Call</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[st.bookNowBtnFull, st.calloutActionPrimary]}
                                            onPress={handleDirections}
                                            activeOpacity={0.85}
                                        >
                                            <LinearGradient
                                                colors={G.navActive.colors}
                                                start={G.navActive.start}
                                                end={G.navActive.end}
                                                style={st.bookNowGradient}
                                            >
                                                <Text style={st.bookNowText}>Direction</Text>
                                                <Ionicons name="navigate" size={14} color={T.onPrimary} />
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={st.bookNowBtnFull}
                                        onPress={handleDirections}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={G.navActive.colors}
                                            start={G.navActive.start}
                                            end={G.navActive.end}
                                            style={st.bookNowGradient}
                                        >
                                            <Text style={st.bookNowText}>Directions</Text>
                                            <Ionicons name="navigate" size={14} color={T.onPrimary} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </RNAnimated.View>
                    </>
                )}

                {/* ── Quick Selector Chips ── */}
                {(category === 'specialists' || category === 'ambulance') && (
                    <View style={[st.chipContainer, { bottom: navBottom + NAV_HEIGHT + 12 }]}>
                        <QuickChipRow
                            chips={chips}
                            selected={selectedChip}
                            onSelect={setSelectedChip}
                        />
                    </View>
                )}

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
    originMarker: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: T.violet,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    liveUserMarker: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
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
    doctorIconMarker: {
        padding: 2,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 10 },
        }),
    },
    doctorIconMarkerActive: {
        backgroundColor: T.violet,
        borderRadius: 20,
        padding: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
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
    calloutBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 220,
    },
    calloutTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.85)' },
    calloutGrabberWrap: { alignItems: 'center', paddingTop: 10 },
    calloutGrabber: {
        width: 42, height: 4, borderRadius: 2,
        backgroundColor: T.lineBold, opacity: 0.75,
    },
    calloutContentStack: {
        paddingHorizontal: S.s4,
        paddingTop: 12,
        paddingBottom: 16,
        gap: S.s3,
    },
    calloutTextWrapFull: {
        width: '100%',
        gap: 4,
    },
    calloutName: {
        fontSize: 15, fontWeight: '700', color: D.title,
        letterSpacing: -0.1,
    },
    calloutAffiliation: {
        fontSize: 11, fontWeight: '500', color: D.muted,
    },
    calloutMetaLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: D.subtitle,
        marginTop: 2,
    },
    calloutMetaText: {
        fontSize: 11,
        fontWeight: '500',
        color: D.muted,
    },
    calloutActionRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    calloutActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: `${T.violet}40`,
    },
    calloutActionText: {
        fontSize: 12,
        fontWeight: '700',
        color: T.violet,
    },
    calloutActionPrimary: {
        flex: 1,
    },
    bookNowBtn: {
        borderRadius: 12, overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    bookNowBtnFull: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
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

    // ── Safe Route Indicator ────────────────────────────────────────────────
    safeRouteIndicator: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: S.s4, paddingBottom: 10,
    },
    safeRouteText: {
        fontSize: 10, fontWeight: '600', color: D.safeColor,
        letterSpacing: 0.2,
    },

    livePanel: {
        position: 'absolute',
        left: 14,
        right: 14,
        backgroundColor: 'rgba(22,15,44,0.92)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        zIndex: 230,
        gap: 6,
    },
    livePanelTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: D.title,
    },
    livePanelMeta: {
        fontSize: 11,
        color: D.muted,
        fontWeight: '600',
    },
    liveStepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    liveStepText: {
        flex: 1,
        fontSize: 11,
        color: D.subtitle,
        fontWeight: '600',
        lineHeight: 16,
    },
    liveActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    liveActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 32,
        borderRadius: R.pill,
        backgroundColor: T.violet,
        borderWidth: 1,
        borderColor: `${T.violet}70`,
    },
    liveActionExit: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    liveActionText: {
        color: T.onPrimary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    // ── Route Overview Header (Floating Capsule) ──────────────────────────
    routeOverlayWrap: {
        position: 'absolute',
        left: 14,
        right: 14,
        borderRadius: R.pill,
        overflow: 'hidden',
        backgroundColor: 'rgba(30,21,58,0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 320,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 8 },
        }),
    },
    routeOverlayTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: T.surfaceOverlay,
    },
    routeOverlayInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: S.s3,
        paddingVertical: 12,
        minHeight: 52,
        position: 'relative',
    },
    routeOverlayCloseBtn: {
        position: 'absolute',
        left: S.s3,
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    routeOverlayContent: {
        flex: 1,
        gap: 4,
    },
    routeOverlayLabel: {
        fontSize: 10,
        color: D.muted,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    routeOverlayTitle: {
        fontSize: 16,
        color: D.title,
        fontWeight: '700',
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    routeOverlayMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    routeMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    routeMetaText: {
        fontSize: 11,
        color: T.violet,
        fontWeight: '600',
    },

    livePanelMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
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

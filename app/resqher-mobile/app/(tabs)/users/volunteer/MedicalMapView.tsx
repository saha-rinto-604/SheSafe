/**
 * MedicalMapView.tsx — Map-First Discovery Screen (V3.0)
 * ─────────────────────────────────────────────────────────────────────────
 * Full-screen map with:
 *  • Interactive provider pins (contextual to selected category)
 *  • Horizontal Quick Selector Chips above navbar
 *  • Bulky Glass callout bottom sheet on pin tap
 *  • Auto-triggered Electric Violet safe route polyline
 *  • Persistent Medical navbar tab glow
 *
 * Design: AtmosphericShell + Bulky Glass material + Tactical Dark Map.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, StatusBar,
    Platform, ScrollView, Image, Alert, Linking,
} from 'react-native';
import { Animated as RNAnimated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import VolunteerNavbar, { VOLUNTEER_NAV_BAR_HEIGHT, VOLUNTEER_NAV_BOTTOM_OFFSET } from '../../../../src/components/VolunteerBottomNav';
import { T, R, S } from '../../../../src/constants/theme';
import { G } from '../../../../src/constants/gradients';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import { medicalService } from '../../../../src/services/api';
import {
    SPECIALIST_CHIPS, GENERIC_CHIPS,
} from '../../../../src/data/medicalMockData';
import type { MedicalCategory, ShiftFilter, QuickChip } from '../../../../src/types/medical';
import {
    getForwardRouteProgress,
    OFF_ROUTE_THRESHOLD_M,
    REROUTE_DELAY_MS,
    REROUTE_THROTTLE_MS,
} from '../../../../src/utils/routeRealtime';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const NAV_HEIGHT = VOLUNTEER_NAV_BAR_HEIGHT;
const NAV_BOT_OFFSET = VOLUNTEER_NAV_BOTTOM_OFFSET;

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

const isValidLatLng = (point: LatLng | null | undefined): point is LatLng => (
    !!point
    && Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && point.longitude >= -180
    && point.longitude <= 180
);

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
    cardRadius: 16,
} as const;

// ── Nav tabs ────────────────────────────────────────────────────────────────
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
// PremiumBar — Bulky Glass bar
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// NavTab — reusable nav item
// ═══════════════════════════════════════════════════════════════════════════════
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

    // Animations
    const calloutY = useRef(new RNAnimated.Value(400)).current;
    const calloutOpacity = useRef(new RNAnimated.Value(0)).current;

    // Reset UI state when filter chips or categories change to avoid mapping dead nodes
    useEffect(() => {
        routeRequestIdRef.current += 1;
        Speech.stop();
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        setSelectedChip('all');
        setSelectedPin(null);
        setShowCallout(false);
        setSafeRoute(null);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setRouteEta(null);
        setRouteDistanceKm(null);
        setShowRouteOverview(false);
        setIsLiveNav(false);
        setIsReviewMode(false);
        calloutY.setValue(400);
        calloutOpacity.setValue(0);
    }, [category]);

    useEffect(() => {
        routeRequestIdRef.current += 1;
        Speech.stop();
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        setSelectedPin(null);
        setShowCallout(false);
        setSafeRoute(null);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setRouteEta(null);
        setRouteDistanceKm(null);
        setShowRouteOverview(false);
        setIsLiveNav(false);
        setIsReviewMode(false);
        calloutY.setValue(400);
        calloutOpacity.setValue(0);
    }, [selectedChip]);

    const [travelMode, setTravelMode] = useState<'walking' | 'driving' | 'motorcycle' | 'transit'>('walking');
    const [completedRouteCoords, setCompletedRouteCoords] = useState<LatLng[]>([]);
    const [remainingRouteCoords, setRemainingRouteCoords] = useState<LatLng[]>([]);
    const [locationPermitted, setLocationPermitted] = useState(false);
    const [showRouteOverview, setShowRouteOverview] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const routeRequestIdRef = useRef(0);
    const mountedRef = useRef(true);
    const lastRerouteOriginRef = useRef<LatLng | null>(null);
    const offRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRerouteAtRef = useRef(0);
    const routeOverlaySlideY = useRef(new RNAnimated.Value(0)).current;

    // ── Live Nav & Review Mode States ──
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const liveHeaderY = useRef(new RNAnimated.Value(-150)).current;
    const liveFooterY = useRef(new RNAnimated.Value(150)).current;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            routeRequestIdRef.current += 1;
            Speech.stop();
            locationSubRef.current?.remove();
            locationSubRef.current = null;
            if (offRouteTimerRef.current) {
                clearTimeout(offRouteTimerRef.current);
                offRouteTimerRef.current = null;
            }
        };
    }, []);

    const clearRouteState = useCallback((options?: { keepProvider?: boolean }) => {
        routeRequestIdRef.current += 1;
        Speech.stop();
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        setSafeRoute(null);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setRouteEta(null);
        setRouteDistanceKm(null);
        setShowRouteOverview(false);
        setIsLiveNav(false);
        setIsReviewMode(false);
        setIsRouting(false);
        lastRerouteOriginRef.current = null;
        if (offRouteTimerRef.current) {
            clearTimeout(offRouteTimerRef.current);
            offRouteTimerRef.current = null;
        }
        lastRerouteAtRef.current = 0;
        if (!options?.keepProvider) {
            setSelectedPin(null);
            setShowCallout(false);
        }
    }, []);

    const toggleReviewMode = useCallback(() => {
        setIsReviewMode(prev => {
            const next = !prev;
            if (next && safeRoute && safeRoute.length > 1) {
                setCompletedRouteCoords([]);
                setRemainingRouteCoords(safeRoute);
                mapRef.current?.fitToCoordinates(safeRoute, {
                    edgePadding: { top: 120, right: 60, bottom: 360, left: 60 },
                    animated: true,
                });
            }
            return next;
        });
    }, [safeRoute]);

    useEffect(() => {
        if (isLiveNav) {
            RNAnimated.parallel([
                RNAnimated.spring(liveHeaderY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
                RNAnimated.spring(liveFooterY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
            ]).start();
        } else {
            RNAnimated.parallel([
                RNAnimated.timing(liveHeaderY, { toValue: -150, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
                RNAnimated.timing(liveFooterY, { toValue: 150, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            ]).start();
            setIsReviewMode(false); // Reset review mode when exiting live
        }
    }, [isLiveNav, liveHeaderY, liveFooterY]);

    // ── Live Backend Data ──────────────────────────────────────────────────
    const [liveDoctors, setLiveDoctors] = useState<any[]>([]);
    const [liveHospitals, setLiveHospitals] = useState<any[]>([]);
    const [livePharmacies, setLivePharmacies] = useState<any[]>([]);
    const [liveAmbulances, setLiveAmbulances] = useState<any[]>([]);
    const [providersLoading, setProvidersLoading] = useState(true);

    // Fetch all providers from backend on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const allProviders = await medicalService.getProviders();
                if (cancelled) return;
                // Categorize backend providers by type
                const doctors = allProviders.filter((p: any) => p?.type === 'specialists');
                const hospitals = allProviders.filter((p: any) => p?.type === 'hospital');
                const pharmacies = allProviders.filter((p: any) => p?.type === 'pharmacy');
                const ambulances = allProviders.filter((p: any) => p?.type === 'ambulance');

                setLiveDoctors(doctors);
                setLiveHospitals(hospitals);
                setLivePharmacies(pharmacies);
                setLiveAmbulances(ambulances);
            } catch (err) {
                console.warn('[MedicalMapView] Failed to fetch providers:', err);
            } finally {
                if (!cancelled) setProvidersLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Load profile picture on screen focus
    useFocusEffect(
        useCallback(() => {
            let active = true;
            getUserProfile()
                .then(nextProfile => {
                    if (active) setProfile(nextProfile);
                })
                .catch(() => { });
            return () => {
                active = false;
            };
        }, []),
    );

    // ── Contextual chips ────────────────────────────────────────────────────
    const chips = useMemo(() => {
        if (category === 'specialists') return SPECIALIST_CHIPS;
        if (category === 'ambulance') {
            return [{ id: 'all', label: 'All Ambulances', icon: 'car' }];
        }
        return GENERIC_CHIPS;
    }, [category]);

    // ── Provider pins data (LIVE from backend) ────────────────────────
    const providers = useMemo<ProviderCard[]>(() => {
        switch (category) {
            case 'specialists': {
                // Use live data, fall back to a single placeholder if backend is empty
                let docs = liveDoctors.length > 0 ? liveDoctors : [{
                    id: 'placeholder-doc',
                    name: 'Dr. Sarah Ahmed',
                    latitude: JAMUNA_FUTURE_PARK.latitude,
                    longitude: JAMUNA_FUTURE_PARK.longitude,
                    rating: 4.8,
                    affiliation: 'Jamuna Future Park Area',
                    degree: 'MBBS, FCPS',
                    specialty: 'Cardiologist',
                    hospitalAffiliation: 'Jamuna Future Park Medical Wing',
                }];

                // Filter by specialty if a specific chip is chosen
                if (selectedChip !== 'all') {
                    docs = docs.filter((doctor: any) => {
                        const specialty = (doctor?.specialty || '').toLowerCase();
                        const chipId = selectedChip.toLowerCase();
                        return specialty.includes(chipId) || chipId.includes(specialty) || doctor?.type === selectedChip;
                    });
                }

                return docs.map((doctor: any) => ({
                    id: String(doctor?.id ?? `doc-${Math.random()}`),
                    name: doctor?.name ?? 'Doctor',
                    latitude: Number(doctor?.latitude) || JAMUNA_FUTURE_PARK.latitude,
                    longitude: Number(doctor?.longitude) || JAMUNA_FUTURE_PARK.longitude,
                    rating: Number(doctor?.rating) || 0,
                    affiliation: doctor?.affiliation ?? doctor?.hospitalAffiliation ?? '',
                    degree: doctor?.degree ?? '',
                    specialty: doctor?.specialty ?? '',
                    hospital: doctor?.hospitalAffiliation ?? doctor?.hospital ?? '',
                    shift,
                    phone: doctor?.contactNumber ?? '01XXXXXXXXX',
                    type: 'specialists' as const,
                }));
            }
            case 'hospital': {
                const hosps = liveHospitals.length > 0 ? liveHospitals : [];
                return hosps.map((hospital: any) => ({
                    id: String(hospital?.id ?? `hosp-${Math.random()}`),
                    name: hospital?.name ?? 'Hospital',
                    latitude: Number(hospital?.latitude) || JAMUNA_FUTURE_PARK.latitude,
                    longitude: Number(hospital?.longitude) || JAMUNA_FUTURE_PARK.longitude,
                    rating: Number(hospital?.rating) || 0,
                    affiliation: hospital?.affiliation ?? '',
                    address: hospital?.address ?? '',
                    type: 'hospital' as const,
                }));
            }
            case 'ambulance': {
                let ambs = liveAmbulances.length > 0 ? [...liveAmbulances] : [];
                return ambs.map((a: any) => ({
                    id: String(a?.id ?? `amb-${Math.random()}`),
                    name: a?.affiliation ?? a?.name ?? 'Ambulance',
                    latitude: Number(a?.latitude) || JAMUNA_FUTURE_PARK.latitude,
                    longitude: Number(a?.longitude) || JAMUNA_FUTURE_PARK.longitude,
                    rating: Number(a?.rating) || 0,
                    affiliation: a?.affiliation ?? '',
                    address: a?.affiliation ?? '',
                    hotline: a?.contactNumber ?? '999 / 017XXXXXXXX',
                    type: 'ambulance' as const,
                }));
            }
            case 'pharmacy': {
                const pharms = livePharmacies.length > 0 ? livePharmacies : [];
                return pharms.map((pharmacy: any) => ({
                    id: String(pharmacy?.id ?? `pharm-${Math.random()}`),
                    name: pharmacy?.name ?? 'Pharmacy',
                    latitude: Number(pharmacy?.latitude) || JAMUNA_FUTURE_PARK.latitude,
                    longitude: Number(pharmacy?.longitude) || JAMUNA_FUTURE_PARK.longitude,
                    rating: Number(pharmacy?.rating) || 0,
                    affiliation: pharmacy?.affiliation ?? '',
                    address: pharmacy?.address ?? '',
                    type: 'pharmacy' as const,
                }));
            }
            default:
                return [];
        }
    }, [category, shift, selectedChip, liveDoctors, liveHospitals, liveAmbulances, livePharmacies]);

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

        let cancelled = false;
        (async () => {
            const subscription = await Location.watchPositionAsync(
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
            if (cancelled) {
                subscription.remove();
                return;
            }
            locationSubRef.current = subscription;
        })();

        return () => {
            cancelled = true;
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

        const requestId = ++routeRequestIdRef.current;
        setIsRouting(true);
        setSafeRoute(null);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setIsReviewMode(false);
        const originParam = `${origin.latitude},${origin.longitude}`;
        const destinationParam = `${destination.latitude},${destination.longitude}`;
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}&destination=${destinationParam}&mode=${travelMode === 'motorcycle' ? 'two_wheeler' : travelMode}&alternatives=true&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;

        try {
            const res = await fetch(directionsUrl);
            const data = await res.json();
            if (!mountedRef.current || requestId !== routeRequestIdRef.current) return;
            const route = data?.routes?.[0];

            if (!route) {
                Alert.alert('Route unavailable', 'No route found for this provider right now.');
                return;
            }

            const routeCoords = decodePolyline(route.overview_polyline?.points ?? '');
            if (!routeCoords.length) {
                Alert.alert('Route unavailable', 'Could not decode route path.');
                return;
            }

            setIsReviewMode(false);
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
            if (mountedRef.current && requestId === routeRequestIdRef.current) {
                Alert.alert('Route error', 'Unable to fetch live route right now.');
            }
        } finally {
            if (mountedRef.current && requestId === routeRequestIdRef.current) {
                setIsRouting(false);
            }
        }
    }, [travelMode]);

    // ── Pin tap handler — auto-trigger callout ───────────────────────────
    const handlePinPress = useCallback((providerId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        clearRouteState({ keepProvider: true });
        setSelectedPin(providerId);
        setShowCallout(true);

        // Animate callout in
        calloutY.setValue(400);
        calloutOpacity.setValue(0);
        RNAnimated.parallel([
            RNAnimated.spring(calloutY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
            RNAnimated.timing(calloutOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();

    }, [calloutY, calloutOpacity, clearRouteState]);

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

    // ── Book Now → Route Preview ──────────────────────────────────────────────
    const handleDirections = useCallback(async () => {
        if (!selectedProvider) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const destination = {
            latitude: selectedProvider.latitude,
            longitude: selectedProvider.longitude,
        };
        let origin: { latitude: number; longitude: number; heading?: number } = userLoc ?? KHILKHET_ORIGIN;
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
                origin = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    heading: position.coords.heading ?? undefined,
                };
                if (mountedRef.current) setUserLoc(origin);
            }
        } catch (err) {
            console.warn('[MedicalMapView] Unable to refresh route origin:', err);
        }

        clearRouteState({ keepProvider: true });
        hideCalloutKeepRoute();
        setShowRouteOverview(true);

        // Animate route overview header in
        routeOverlaySlideY.setValue(-100);
        RNAnimated.spring(routeOverlaySlideY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();

        buildLiveRoute(origin, destination, true);
    }, [buildLiveRoute, clearRouteState, hideCalloutKeepRoute, selectedProvider, routeOverlaySlideY, userLoc]);

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
        clearRouteState({ keepProvider: true });
        RNAnimated.timing(routeOverlaySlideY, {
            toValue: -100,
            duration: 260,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
        }).start();
    }, [clearRouteState, routeOverlaySlideY]);

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
        clearRouteState({ keepProvider: true });
    }, [clearRouteState]);

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

        if (safeRoute && safeRoute.length > 0) {
            const progress = getForwardRouteProgress(userLoc, safeRoute);
            setCompletedRouteCoords(progress.completedRouteCoords);
            setRemainingRouteCoords(progress.remainingRouteCoords);

            if (progress.nearestDistanceM > OFF_ROUTE_THRESHOLD_M) {
                if (!offRouteTimerRef.current) {
                    offRouteTimerRef.current = setTimeout(() => {
                        offRouteTimerRef.current = null;
                        if (!mountedRef.current || !isLiveNav || !userLoc || !selectedProvider) return;
                        const now = Date.now();
                        if (now - lastRerouteAtRef.current < REROUTE_THROTTLE_MS) return;
                        lastRerouteAtRef.current = now;
                        buildLiveRoute(
                            { latitude: userLoc.latitude, longitude: userLoc.longitude },
                            { latitude: selectedProvider.latitude, longitude: selectedProvider.longitude },
                            false,
                        );
                    }, REROUTE_DELAY_MS);
                }
            } else if (offRouteTimerRef.current) {
                clearTimeout(offRouteTimerRef.current);
                offRouteTimerRef.current = null;
            }
        }
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

    // ── Live Navigation Audio Engine ──
    const lastSpokenStepRef = useRef<number>(-1);
    useEffect(() => {
        if (isLiveNav && !isAudioMuted && navInstructions.length > 0 && currentStepIdx !== lastSpokenStepRef.current) {
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
    }, [isLiveNav, isAudioMuted, currentStepIdx, navInstructions]);

    // ── Handlers ───────────────────────────────────────────────────────────
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
    }, [travelMode, buildLiveRoute, selectedProvider, showRouteOverview]);

    const fullRouteCoords = useMemo(() => (safeRoute ?? []).filter(isValidLatLng), [safeRoute]);
    const completedRoutePreviewCoords = useMemo(() => completedRouteCoords.filter(isValidLatLng), [completedRouteCoords]);
    const remainingRoutePreviewCoords = useMemo(() => remainingRouteCoords.filter(isValidLatLng), [remainingRouteCoords]);

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
                        pinColor={T.violet}
                        title="You"
                        description="Current location"
                        zIndex={998}
                    />

                    {/* Live User Marker */}
                    {isLiveNav && userLoc && (
                        <Marker
                            coordinate={{ latitude: userLoc.latitude, longitude: userLoc.longitude }}
                            pinColor={T.violet}
                            title="You"
                            description="Current location"
                            zIndex={1000}
                        />
                    )}

                    {/* Provider Pins */}
                    {providers
                        .filter(p => !((showRouteOverview || isLiveNav) && selectedProvider?.id === p.id))
                        .map(p => (
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

                    {(showRouteOverview || isLiveNav) && selectedProvider && (
                        <Marker
                            coordinate={{ latitude: selectedProvider.latitude, longitude: selectedProvider.longitude }}
                            pinColor={T.violet}
                            title={selectedProvider.name}
                            description={selectedProvider.address || 'Route destination'}
                            zIndex={999}
                        />
                    )}

                    {/* Safe Route Polyline — Auto-triggered on pin select */}
                    {/* Completed route (blue) */}
                    {!isReviewMode && completedRoutePreviewCoords.length > 1 && (
                        <Polyline
                            coordinates={completedRoutePreviewCoords}
                            strokeColor="#3B82F6"
                            strokeWidth={5}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                    {/* Remaining route (violet) */}
                    {!isReviewMode && remainingRoutePreviewCoords.length > 1 && (
                        <Polyline
                            coordinates={remainingRoutePreviewCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                    {/* Fallback: full route if no progress split yet */}
                    {(isReviewMode || completedRoutePreviewCoords.length === 0) && fullRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={fullRouteCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                </MapView>

                {/* ── Route Overview Header (Floating Capsule) ── */}
                {showRouteOverview && !isLiveNav && (
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
                    </RNAnimated.View>
                )}

                {/* ── Floating Travel Modes Bar ── */}
                {showRouteOverview && !isLiveNav && (
                    <RNAnimated.View style={[st.travelModeBarWrap, { top: insets.top + 72, transform: [{ translateY: routeOverlaySlideY }] }]}>
                        <View style={st.travelModeBar}>
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
                {!showRouteOverview && !isLiveNav && (
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
                                <Ionicons name="person" size={20} color={T.ink2} />
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── 12px Breathing Space Spacer ──────────────────────────────── */}
                <View style={{ marginTop: 12 }} />

                {/* ── GPS / Recenter — Right-side floating glass container (SOS standard) ── */}
                {!showRouteOverview && !isLiveNav && (
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
                {!showRouteOverview && !isLiveNav && (
                    <View style={[st.resultsBadge, { top: insets.top + 8 + 58 + 12 }]}>
                        <Text style={st.resultsBadgeText}>
                            {providers.length} {providers.length === 1 ? 'result' : 'results'}
                        </Text>
                    </View>
                )}

                {/* ── Step-by-Step Instruction Card (Replaces Live Panel) ── */}
                {safeRoute && selectedProvider && navInstructions.length > 0 && (
                    <RNAnimated.View style={[ns.cardWrap, { bottom: navBottom + NAV_HEIGHT + (!isLiveNav && category === 'specialists' ? 80 : 16) }]}>
                        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={ns.cardTint} pointerEvents="none" />
                        <View style={ns.cardBody}>
                            <View style={ns.iconWrap}>
                                <Ionicons
                                    name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver)}
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
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingLeft: 8 }}
                                    style={{ flexShrink: 1, marginLeft: 8 }}
                                >
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
                                        style={[ns.goLiveBtn, { backgroundColor: 'rgba(138,56,246,0.15)', borderColor: 'rgba(138,56,246,0.3)' }]}
                                        onPress={toggleReviewMode}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="list" size={14} color={T.violet} style={{ marginRight: 4 }} />
                                        <Text style={[ns.goLiveBtnText, { color: T.violet }]}>{isReviewMode ? 'CLOSE' : 'REVIEW'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={ns.goLiveBtn}
                                        onPress={handleStartLive}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="navigate" size={12} color={T.onPrimary} style={{ marginRight: 4 }} />
                                        <Text style={ns.goLiveBtnText}>GO LIVE</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            ) : (
                                <TouchableOpacity
                                    style={ns.endLiveBtn}
                                    onPress={handleExitLive}
                                    activeOpacity={0.7}
                                >
                                    <Text style={ns.endLiveBtnText}>Exit Live Mode</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </RNAnimated.View>
                )}

                {/* ── Immersive Live Navigation Top Banner ── */}
                {isLiveNav && navInstructions.length > 0 && (
                    <RNAnimated.View style={[lb.bannerWrap, { top: insets.top + 10, transform: [{ translateY: liveHeaderY }] }]}>
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={lb.bannerTint} pointerEvents="none" />
                        <View style={lb.bannerBody}>
                            <View style={ns.iconWrap}>
                                <Ionicons
                                    name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver)}
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
                                onPress={() => setIsAudioMuted(!isAudioMuted)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name={!isAudioMuted ? 'volume-high' : 'volume-mute'} size={22} color={!isAudioMuted ? T.violet : T.ink4} />
                            </TouchableOpacity>
                        </View>
                    </RNAnimated.View>
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
                {(category === 'specialists' || category === 'ambulance') && !isLiveNav && (
                    <View style={[st.chipContainer, { bottom: navBottom + NAV_HEIGHT + 12 }]}>
                        <QuickChipRow
                            chips={chips}
                            selected={selectedChip}
                            onSelect={setSelectedChip}
                        />
                    </View>
                )}

                {/* ── Bottom Navbar ── */}
                {!isLiveNav && (
                    <VolunteerNavbar activeTab="Medical" />
                )}
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
        justifyContent: 'center',
    },
    bookNowText: {
        fontSize: 13, fontWeight: '800', color: T.onPrimary,
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
    livePanelMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
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
    routeOverlayTitle: {
        fontSize: 16,
        color: D.title,
        fontWeight: '700',
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    routeMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    travelModeBarWrap: {
        position: 'absolute', left: 14, right: 14, zIndex: 290,
    },
    travelModeBar: {
        flexDirection: 'row', padding: 6, gap: 6,
        backgroundColor: 'rgba(30,21,58,0.7)', borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 6 },
        }),
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
});

// ── Navigation Instruction Card Styles (ns) ──
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
    navBtn: { width: 32, height: 32, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    goLiveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 32, borderRadius: R.pill, backgroundColor: T.violet, borderWidth: 1, borderColor: `${T.violet}70` },
    goLiveBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.2 },
    endLiveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    endLiveBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.2 },
});

// ── Top Live Banner Styles (lb) ──
const lb = StyleSheet.create({
    bannerWrap: { position: 'absolute', left: 14, right: 14, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 360 },
    bannerTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.85)' },
    bannerBody: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingVertical: S.s4, gap: S.s4 },
    textWrap: { flex: 1 },
    distText: { fontSize: 16, fontWeight: '800', color: T.violet, marginBottom: 4, letterSpacing: -0.2 },
    instrText: { fontSize: 18, fontWeight: '700', color: T.ink, letterSpacing: -0.3, lineHeight: 22 },
    audioBtn: { width: 44, height: 44, borderRadius: R.hBtn, backgroundColor: `${T.violet}10`, borderWidth: 1, borderColor: `${T.violet}25`, alignItems: 'center', justifyContent: 'center' },
});

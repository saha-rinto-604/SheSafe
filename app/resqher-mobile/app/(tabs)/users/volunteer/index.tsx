/**
 * app/(tabs)/users/volunteer/index.tsx
 * Volunteer Home — Map view with animated search header, location card, and nav bar.
 * Upgraded with dynamic Yellow/Red zoning rules, custom glass scan UI overlay, and TTS fixes.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert,
    Dimensions, StatusBar, Platform, ViewStyle,
    TextInput, Keyboard, KeyboardAvoidingView, Pressable, Modal, ScrollView, Image, PanResponder,
    BackHandler, AppState,
} from 'react-native';
import { Animated as RNAnimated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Circle, type MapViewRef } from '../../../../src/components/shared/MapViewCompat';
import Svg, { Path, Circle as SvgCircle, Rect, Text as SvgText } from 'react-native-svg';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { G } from '../../../../src/constants/gradients';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import VolunteerNavbar from '../../../../src/components/VolunteerBottomNav';

import { useAuth } from '../../../../src/context/AuthContext';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import { incidentService, normalizeIncidentZone, safePlaceService, type IncidentZone, type NearbyIncident } from '../../../../src/services/incidentService';
import { getConfirmedSafePlaces, mapSafePlaceToDestination, type SafePlace } from '../../../../src/services/safePlaceService';
import api from '../../../../src/services/api';
import { useDispatchSocket } from '../../../../src/hooks/useDispatchSocket';
import { loadVerificationRecord, type VerificationRecord } from '../standard-user/volunteer-verification';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { evaluateRouteSafety, haversineDistance, type LatLng } from '../../../../src/utils/routeSafety';
import {
    getForwardRouteProgress,
    OFF_ROUTE_THRESHOLD_M,
    REROUTE_DELAY_MS,
    REROUTE_THROTTLE_MS,
} from '../../../../src/utils/routeRealtime';
import { useRouteAudio } from '../../../../src/hooks/useRouteAudio';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const { width, height } = Dimensions.get('window');

const NAV_HEIGHT = 58;
const NAV_BOT_OFFSET = 14;

const SOS_BTN_SIZE = 156;
const SOS_WRAP_SIZE = 320;
const ARC_SIZE = SOS_BTN_SIZE + 20;
const ARC_RADIUS = ARC_SIZE / 2;
const HOLD_MS = 2000;
const CANCEL_DURATION_DEFAULT = 10;

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

type SosRequest = NearbyIncident;

type PlaceIncident = {
    id: string;
    reporter: string;
    time: string;
    status: string;
};

function isLiveSosStatus(status?: string): boolean {
    return String(status || '').toUpperCase() === 'ACTIVE';
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

function isRedIncidentZone(zone: any): boolean {
    const incidentCount = Number(zone?.incidentCount ?? zone?.incident_count ?? zone?.count ?? zone?.incidents?.length ?? 0);
    return incidentCount >= 5;
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

const PurpleSosSquareIcon = ({ size = 26 }: { size?: number }) => (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Rect x="2" y="3" width="20" height="20" rx="5" fill="#A78BFA" fillOpacity="0.4" />
        <Rect x="2" y="2" width="20" height="20" rx="5" fill="#A78BFA" />
        <SvgText x="12" y="14" fill="#F5F5F7" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" alignmentBaseline="middle">SOS</SvgText>
    </Svg>
);

const PurpleSosBellIcon = ({ size = 22 }: { size?: number }) => (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Path d="M5 7 Q 2 12 5 17" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <Path d="M7 9 Q 5 12 7 15" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <Path d="M19 7 Q 22 12 19 17" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <Path d="M17 9 Q 19 12 17 15" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <SvgCircle cx="12" cy="4" r="1.5" fill="#A78BFA" />
        <Path d="M12 5 C 9 5 8 8 8 11 L 6.5 16.5 L 17.5 16.5 L 16 11 C 16 8 15 5 12 5 Z" fill="#A78BFA" />
        <Path d="M10 17.5 A 2 2 0 0 0 14 17.5 Z" fill="#A78BFA" />
        <SvgText x="12" y="13.5" fill="#F5F5F7" fontSize="4.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" alignmentBaseline="middle">SOS</SvgText>
    </Svg>
);

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
    zoneSeverity?: 'red' | 'yellow';
    source?: 'search' | 'zone' | 'safe_place';
    description?: string | null;
    status?: string;
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
    ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: T.brandGlow },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.violet, borderWidth: 2, borderColor: T.surface },
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

const MaxRespondersModal = memo(function MaxRespondersModal({
    visible,
    onClose,
}: {
    visible: boolean;
    onClose: () => void;
}) {
    if (!visible) return null;

    return (
        <View style={scanStyles.backdrop}>
            <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={scanStyles.card}>
                <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={scanStyles.cardTint} />
                <View style={scanStyles.iconOuterContainer}>
                    <View style={[scanStyles.iconCircle, { backgroundColor: '#E25B3A' }]}>
                        <Ionicons name="people" size={26} color="#FFFFFF" />
                    </View>
                </View>
                <Text style={scanStyles.title}>Maximum Responders Reached</Text>
                <Text style={scanStyles.subtitle}>
                    This SOS already has 3 accepted volunteers. You can still monitor for other nearby emergencies.
                </Text>
                <TouchableOpacity style={[scanStyles.btn, { backgroundColor: '#E25B3A' }]} onPress={onClose}>
                    <Text style={scanStyles.btnText}>Acknowledge</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

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


// ── Volunteer Home Screen ────────────────────────────────────────────────────
export default function VolunteerHome() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const mapRef = useRef<MapViewRef>(null);
    const { signOut } = useAuth();
    const searchInputRef = useRef<TextInput>(null);
    const startInputRef = useRef<TextInput>(null);
    const { playRouteAudio, stopRouteAudio } = useRouteAudio('VolunteerHome');

    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready' | 'sharing'>('idle');
    const [locationRetryKey, setLocationRetryKey] = useState(0);
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
    const userLocRef = useRef<{ latitude: number; longitude: number; heading?: number } | null>(null);
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
    const [sosPanelOpen, setSosPanelOpen] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [verificationRecord, setVerificationRecord] = useState<VerificationRecord | null>(null);
    const [verificationGateVisible, setVerificationGateVisible] = useState(false);
    const verificationNavRef = useRef(false);
    const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
    const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
    const [placeIncidents, setPlaceIncidents] = useState<PlaceIncident[]>([]);
    const [placeSheetOpen, setPlaceSheetOpen] = useState(false);
    const [placeSheetIsDangerZone, setPlaceSheetIsDangerZone] = useState(false);
    const [placeSheetMode, setPlaceSheetMode] = useState<'incidents' | 'add_safe_place'>('incidents');
    const [safePlaceAnswer, setSafePlaceAnswer] = useState('');
    const [safePlaceError, setSafePlaceError] = useState<string | null>(null);
    const [safePlaceSubmitState, setSafePlaceSubmitState] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [isSosButtonVisible, setIsSosButtonVisible] = useState(false);
    const [holdPhase, setHoldPhase] = useState<'idle' | 'holding' | 'armed'>('idle');
    const [sosActive, setSosActive] = useState(false);
    const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
    const [cancelCountdown, setCancelCountdown] = useState(CANCEL_DURATION_DEFAULT);
    const [isEmergencyLive, setIsEmergencyLive] = useState(false);
    const [sosStage, setSosStage] = useState<'idle' | 'requesting' | 'responding'>('idle');
    const [stopConfirmVisible, setStopConfirmVisible] = useState(false);
    const [reviewVisible, setReviewVisible] = useState(false);
    const [reviewQueue, setReviewQueue] = useState<{ id: string; name: string; avatarUri: string | null }[]>([]);
    const [reviewIncidentId, setReviewIncidentId] = useState<string | null>(null);
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewRemovingId, setReviewRemovingId] = useState<string | null>(null);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    // UI Flows Hook Setup
    const [responderSheetVisible, setResponderSheetVisible] = useState(false);
    const [stopConfirmMode, setStopConfirmMode] = useState<'cancel' | 'resolve'>('cancel');

    const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sosTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sosTransitionAnim = useRef(new RNAnimated.Value(0)).current;
    const reviewExitAnim = useRef(new RNAnimated.Value(0)).current;
    const safePlaceSuccessAnim = useRef(new RNAnimated.Value(0)).current;
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
    const [routeUnsafe, setRouteUnsafe] = useState(false);
    const [blockedZoneName, setBlockedZoneName] = useState<string | null>(null);
    const [showSafePath, setShowSafePath] = useState(false);
    const [scanState, setScanState] = useState<ScanState>(null);
    const [unsafeRouteCoords, setUnsafeRouteCoords] = useState<LatLng[]>([]);
    const [safeRouteCoords, setSafeRouteCoords] = useState<LatLng[]>([]);
    const [showSafePlace, setShowSafePlace] = useState(false);
    const [locationErrorVisible, setLocationErrorVisible] = useState(false);
    const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);
    const [safePlaceCoords, setSafePlaceCoords] = useState<LatLng[]>([]);
    const [activeSosView, setActiveSosView] = useState<SosRequest | null>(null);
    const [sosRequests, setSosRequests] = useState<SosRequest[]>([]);
    const [acceptingSosId, setAcceptingSosId] = useState<string | null>(null);
    const [maxRespondersVisible, setMaxRespondersVisible] = useState(false);
    const [sosPathCoords, setSosPathCoords] = useState<LatLng[]>([]);
    const [sosRouteStartPoint, setSosRouteStartPoint] = useState<LatLng | null>(null);
    const [sosRouteEndPoint, setSosRouteEndPoint] = useState<LatLng | null>(null);
    const [sosRouteDistance, setSosRouteDistance] = useState<string>('');
    const [sosRouteDuration, setSosRouteDuration] = useState<string>('');
    const rejectedSosIdsRef = useRef<Set<string>>(new Set());

    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const isMountedRef = useRef(true);
    const routeRequestIdRef = useRef(0);
    const safePathRequestIdRef = useRef(0);
    const navigationGuardRef = useRef(false);
    const offRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRerouteAtRef = useRef(0);
    const volunteerSosCreateSeqRef = useRef(0);

    const navigateSafely = useCallback((path: string, replace = false) => {
        if (navigationGuardRef.current) return;
        navigationGuardRef.current = true;
        Keyboard.dismiss();
        void stopRouteAudio();
        routeRequestIdRef.current += 1;
        safePathRequestIdRef.current += 1;
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        if (offRouteTimerRef.current) {
            clearTimeout(offRouteTimerRef.current);
            offRouteTimerRef.current = null;
        }
        setIsLiveNav(false);
        setAudioEnabled(false);
        setSearchActive(false);
        setStartSearchActive(false);
        setShowLocationCard(false);
        setPlaceSheetOpen(false);
        setSosPanelOpen(false);
        setShowSafePlace(false);
        setResponderSheetVisible(false);
        setLocationErrorVisible(false);
        setStopConfirmVisible(false);
        setReviewVisible(false);
        setVerificationGateVisible(false);
        setIsSosButtonVisible(false);
        setScanState(null);
        if (replace) {
            router.replace(path as any);
        } else {
            router.push(path as any);
        }
        setTimeout(() => { navigationGuardRef.current = false; }, 800);
    }, [router, stopRouteAudio]);

    const [incidentZones, setIncidentZones] = useState<IncidentZone[]>([]);
    const [zonesLoading, setZonesLoading] = useState(true);
    const [zonesError, setZonesError] = useState<string | null>(null);
    const [confirmedSafePlaces, setConfirmedSafePlaces] = useState<SafePlace[]>([]);
    const safePlaceTapRef = useRef<{ id: string; at: number } | null>(null);

    const normalizedIncidentZones = useMemo(() => {
        return (incidentZones || [])
            .map(normalizeIncidentZone)
            .filter((zone): zone is IncidentZone => zone !== null && zone.incidentCount >= 1);
    }, [incidentZones]);
    const selectedPlaceZoneSeverity = useMemo(() => {
        if (!selectedPlace?.id.startsWith('zone-')) return selectedPlace?.zoneSeverity;
        const zone = normalizedIncidentZones.find(item => selectedPlace.id === `zone-${item.id}`);
        if (!zone) return selectedPlace.zoneSeverity;
        return zone.incidentCount >= 5 ? 'red' : 'yellow';
    }, [normalizedIncidentZones, selectedPlace]);
    const selectedPlaceMarkerColor = selectedPlaceZoneSeverity === 'yellow'
        ? '#FACC15'
        : selectedPlaceZoneSeverity === 'red'
            ? '#EF4444'
            : T.violet;

    const safePlaceToSuggestion = useCallback((place: SafePlace): PlaceSuggestion => mapSafePlaceToDestination(place), []);

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
        setShowSafePlace(false);
        setSafePlaceCoords([]);
        if (offRouteTimerRef.current) {
            clearTimeout(offRouteTimerRef.current);
            offRouteTimerRef.current = null;
        }
        lastRerouteAtRef.current = 0;
        void stopRouteAudio();
    }, [stopRouteAudio]);

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
            console.warn('[VolunteerHome] Failed to fetch incident zones:', err);
            if (isMountedRef.current) {
                setZonesError(err instanceof Error ? err.message : 'Unable to fetch incident zones');
            }
        } finally {
            if (isMountedRef.current) setZonesLoading(false);
        }
    }, []);

    const fetchConfirmedSafePlaces = useCallback(async () => {
        try {
            const places = await getConfirmedSafePlaces();
            if (!isMountedRef.current) return;
            setConfirmedSafePlaces(places);
        } catch (err) {
            console.warn('[VolunteerHome] Failed to fetch safe places:', err);
            if (isMountedRef.current) setConfirmedSafePlaces([]);
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        fetchLiveZones();
        fetchConfirmedSafePlaces();
        const interval = setInterval(() => {
            fetchLiveZones();
            fetchConfirmedSafePlaces();
        }, 60_000);
        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
            if (offRouteTimerRef.current) {
                clearTimeout(offRouteTimerRef.current);
                offRouteTimerRef.current = null;
            }
            safePathRequestIdRef.current += 1;
            routeRequestIdRef.current += 1;
        };
    }, [fetchConfirmedSafePlaces, fetchLiveZones]);

    const fetchNearbySosRequests = useCallback(async () => {
        const loc = userLocRef.current;
        const sanitized = loc ? sanitizeCoordinate(loc.latitude, loc.longitude) : null;

        try {
            const nearby = await incidentService.getNearbyIncidents(sanitized ?? undefined);
            const liveRequests = (nearby || [])
                .filter(req => isLiveSosStatus(req.status))
                .filter(req => !rejectedSosIdsRef.current.has(String(req.id)));

            if (!isMountedRef.current) return;
            setSosRequests(liveRequests);
        } catch (err) {
            console.warn('[VolunteerHome] Failed to fetch nearby SOS requests:', err);
        }
    }, []);

    const refreshAndRecenterMap = useCallback(async () => {
        setSelectedPlace(null);
        setPlaceSheetOpen(false);
        setPlaceSheetIsDangerZone(false);
        fetchLiveZones();
        fetchConfirmedSafePlaces();
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
                fetchNearbySosRequests();
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (!isMountedRef.current) return;
            const { latitude, longitude } = pos.coords;
            const nextLoc = { latitude, longitude };
            userLocRef.current = nextLoc;
            setUserLoc(nextLoc);
            setLocationStatus('ready');
            mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 700);
            fetchNearbySosRequests();
        } catch (err) {
            console.warn('[VolunteerHome] Unable to refresh map location:', err);
            if (isMountedRef.current) mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
        }
    }, [fetchConfirmedSafePlaces, fetchLiveZones, fetchNearbySosRequests]);

    useEffect(() => {
        if (!userLoc) return;
        fetchNearbySosRequests();
    }, [fetchNearbySosRequests, userLoc]);

    useDispatchSocket({
        onNewSos: useCallback((incident: SosRequest) => {
            if (rejectedSosIdsRef.current.has(String(incident.id))) return;
            setSosRequests(prev => {
                const withoutDuplicate = prev.filter(item => item.id !== incident.id);
                return [incident, ...withoutDuplicate];
            });
        }, []),
        onAccepted: useCallback(({ incidentId, volunteer }: { incidentId: string; volunteer: { id: string; name: string; photoUrl: string | null } }) => {
            setReviewQueue(prev => {
                if (prev.some(item => item.id === volunteer.id)) return prev;
                return [...prev, { id: volunteer.id, name: volunteer.name, avatarUri: volunteer.photoUrl }];
            });
            setSosRequests(prev => prev.filter(item => item.id !== incidentId));
        }, []),
        onClaimed: useCallback((incidentId: string) => {
            setSosRequests(prev => prev.filter(item => item.id !== incidentId));
            setActiveSosView(prev => prev?.id === incidentId ? null : prev);
        }, []),
    });

    const refreshVolunteerAccess = useCallback(async () => {
        const [nextProfile, nextVerification] = await Promise.all([getUserProfile(), loadVerificationRecord()]);
        if (!isMountedRef.current) return;

        setProfile(nextProfile);
        setVerificationRecord(nextVerification || null);

        const status = nextVerification?.status || 'not_applied';
        if (status === 'verified') {
            setVerificationGateVisible(false);
            return;
        }
        if (status === 'pending') {
            setVerificationGateVisible(true);
            return;
        }
        if ((status === 'not_applied' || status === 'draft' || status === 'rejected') && !verificationNavRef.current) {
            verificationNavRef.current = true;
            navigateSafely('/(tabs)/users/volunteer/volunteer-verification', true);
        }
    }, [navigateSafely]);

    // Load profile picture and verification status from backend on screen focus.
    useFocusEffect(
        useCallback(() => {
            refreshVolunteerAccess().catch((err) => console.warn('[VolunteerHome] Verification refresh failed:', err));
            refreshAndRecenterMap();

            return undefined;
        }, [refreshVolunteerAccess, refreshAndRecenterMap]),
    );

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                refreshVolunteerAccess().catch((err) => console.warn('[VolunteerHome] Verification resume refresh failed:', err));
            }
        });
        return () => sub.remove();
    }, [refreshVolunteerAccess]);

    useEffect(() => {
        if (verificationRecord?.status !== 'pending') return;
        const interval = setInterval(() => {
            refreshVolunteerAccess().catch((err) => console.warn('[VolunteerHome] Verification polling failed:', err));
        }, 15000);
        return () => clearInterval(interval);
    }, [refreshVolunteerAccess, verificationRecord?.status]);

    const handleVerificationLogout = useCallback(async () => {
        setVerificationGateVisible(false);
        await signOut();
        navigateSafely('/(auth)/login', true);
    }, [navigateSafely, signOut]);

    const needsVolunteerVerification = verificationRecord?.status !== 'verified';

    // Animation values
    const searchProgress = useRef(new RNAnimated.Value(0)).current;
    const locationCardY = useRef(new RNAnimated.Value(300)).current;
    const locationCardOpacity = useRef(new RNAnimated.Value(0)).current;
    const placeSheetY = useRef(new RNAnimated.Value(height)).current;
    const placeSheetOpacity = useRef(new RNAnimated.Value(0)).current;
    const placeSheetDragY = useRef(new RNAnimated.Value(0)).current;
    const directionsProgress = useRef(new RNAnimated.Value(0)).current;
    const scanAnim = useRef(new RNAnimated.Value(0)).current;
    const radarAnim0 = useRef(new RNAnimated.Value(0)).current;
    const radarAnim1 = useRef(new RNAnimated.Value(0)).current;
    const radarAnim2 = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim0 = useRef(new RNAnimated.Value(1)).current;
    const pulseAnim0Op = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim1 = useRef(new RNAnimated.Value(1)).current;
    const pulseAnim1Op = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim2 = useRef(new RNAnimated.Value(1)).current;
    const pulseAnim2Op = useRef(new RNAnimated.Value(0)).current;
    const pulseAnims = [
        { scale: pulseAnim0, op: pulseAnim0Op },
        { scale: pulseAnim1, op: pulseAnim1Op },
        { scale: pulseAnim2, op: pulseAnim2Op },
    ];

    const completeVolunteerSOSCountdown = useCallback(async (createSeq: number) => {
        try {
            let loc = userLocRef.current ?? userLoc;
            let safeLoc = loc ? sanitizeCoordinate(loc.latitude, loc.longitude) : null;

            if (!safeLoc) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    throw new Error('Location permission is required to send an SOS.');
                }
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                safeLoc = sanitizeCoordinate(loc.latitude, loc.longitude);
                if (safeLoc && isMountedRef.current) {
                    userLocRef.current = safeLoc;
                    setUserLoc(safeLoc);
                }
            }

            if (!safeLoc) {
                throw new Error('Unable to determine your current location.');
            }

            const incident = await incidentService.createSosIncident({
                latitude: safeLoc.latitude,
                longitude: safeLoc.longitude,
                address: address || undefined,
                sourceRole: 'volunteer',
            });

            if (volunteerSosCreateSeqRef.current !== createSeq) {
                incidentService.cancelIncident(incident.id).catch(() => undefined);
                return;
            }
            if (!isMountedRef.current) return;
            setActiveIncidentId(String(incident.id));
            setIsEmergencyLive(true);
            setSosStage('responding');
            RNAnimated.timing(sosTransitionAnim, {
                toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true,
            }).start();
        } catch (error: any) {
            console.warn('[VolunteerHome] Unable to create volunteer SOS incident:', error);
            if (volunteerSosCreateSeqRef.current !== createSeq || !isMountedRef.current) return;
            volunteerSosCreateSeqRef.current += 1;
            setSosActive(false);
            setActiveIncidentId(null);
            setCancelCountdown(0);
            setLocationStatus('ready');
            setHoldPhase('idle');
            setIsEmergencyLive(false);
            setSosStage('idle');
            sosTransitionAnim.setValue(0);
            if (sosTransitionRef.current) clearTimeout(sosTransitionRef.current);
            if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
            setLocationErrorMessage(error?.message || 'Unable to send SOS. Please enable location services and try again.');
            setLocationErrorVisible(true);
        }
    }, [address, sosTransitionAnim, userLoc]);

    const triggerSOS = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setHoldPhase('idle');
        setSosActive(true);
        setActiveIncidentId(null);
        setSosStage('requesting');
        setIsEmergencyLive(false);
        sosTransitionAnim.setValue(0);
        setLocationStatus('sharing');
        setCancelCountdown(CANCEL_DURATION_DEFAULT);
        volunteerSosCreateSeqRef.current += 1;

        if (sosTransitionRef.current) clearTimeout(sosTransitionRef.current);
    }, [sosTransitionAnim]);

    const resetLocalSOS = useCallback(() => {
        volunteerSosCreateSeqRef.current += 1;
        setSosActive(false);
        setActiveIncidentId(null);
        setCancelCountdown(0);
        setLocationStatus('ready');
        setHoldPhase('idle');
        setIsEmergencyLive(false);
        setSosStage('idle');
        sosTransitionAnim.setValue(0);
        if (sosTransitionRef.current) clearTimeout(sosTransitionRef.current);
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    }, [sosTransitionAnim]);

    const cancelSOS = useCallback(() => {
        const incidentId = activeIncidentId;
        resetLocalSOS();
        if (incidentId) {
            incidentService.cancelIncident(incidentId).catch(() => undefined);
        }
    }, [activeIncidentId, resetLocalSOS]);

    const confirmStop = useCallback((mode: 'cancel' | 'resolve') => {
        setStopConfirmMode(mode);
        setStopConfirmVisible(true);
    }, []);

    const closeStopConfirm = useCallback(() => {
        setStopConfirmVisible(false);
    }, []);

    const resetReviewFlow = useCallback(() => {
        setReviewVisible(false);
        setReviewQueue([]);
        setReviewIncidentId(null);
        setReviewFeedback('');
        setReviewRating(5);
        setReviewRemovingId(null);
        setReviewSubmitting(false);
        reviewExitAnim.setValue(0);
    }, [reviewExitAnim]);

    const loadReviewVolunteers = useCallback(async (incidentId: string) => {
        const responders = await incidentService.getIncidentResponders(incidentId);
        return (responders.volunteers || []).map((volunteer) => ({
            id: String(volunteer.id),
            name: volunteer.name || 'Volunteer',
            avatarUri: volunteer.photoUri ?? null,
        }));
    }, []);

    const openReviewPopup = useCallback(async (incidentId: string | null) => {
        if (!incidentId) {
            resetLocalSOS();
            return;
        }
        try {
            const volunteers = await loadReviewVolunteers(incidentId);
            if (!isMountedRef.current) return;
            if (!volunteers.length) {
                resetLocalSOS();
                return;
            }
            setReviewIncidentId(incidentId);
            setReviewQueue(volunteers);
            setReviewFeedback('');
            setReviewRating(5);
            setReviewVisible(true);
        } catch (error) {
            console.warn('[VolunteerHome] Unable to load responders for review:', error);
            resetLocalSOS();
        }
    }, [loadReviewVolunteers, resetLocalSOS]);

    const handleStopAlert = useCallback(async () => {
        setStopConfirmVisible(false);
        if (stopConfirmMode === 'cancel') {
            cancelSOS();
        } else {
            const incidentId = activeIncidentId;
            if (incidentId) {
                await incidentService.resolveIncident(incidentId).catch(() => undefined);
            }
            openReviewPopup(incidentId);
        }
    }, [activeIncidentId, cancelSOS, openReviewPopup, stopConfirmMode]);

    const closeReviewPopup = useCallback(() => {
        resetReviewFlow();
        resetLocalSOS();
    }, [resetLocalSOS, resetReviewFlow]);

    const submitVolunteerReview = useCallback(async () => {
        const currentVolunteer = reviewQueue[0];
        if (!currentVolunteer) {
            resetReviewFlow();
            resetLocalSOS();
            return;
        }
        if (!reviewIncidentId || reviewSubmitting) return;

        setReviewSubmitting(true);
        try {
            await incidentService.submitIncidentReview(reviewIncidentId, {
                volunteerId: currentVolunteer.id,
                rating: reviewRating,
                feedback: reviewFeedback,
            });
        } catch (error) {
            console.warn('[VolunteerHome] Unable to submit volunteer review:', error);
        } finally {
            if (isMountedRef.current) setReviewSubmitting(false);
        }

        setReviewRemovingId(currentVolunteer.id);
        RNAnimated.timing(reviewExitAnim, {
            toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }).start(() => {
            const nextQueue = reviewQueue.slice(1);
            if (!nextQueue.length) {
                resetReviewFlow();
                resetLocalSOS();
                return;
            }
            setReviewQueue(nextQueue);
            setReviewFeedback('');
            setReviewRating(5);
            setReviewRemovingId(null);
            reviewExitAnim.setValue(0);
        });
    }, [resetLocalSOS, resetReviewFlow, reviewExitAnim, reviewFeedback, reviewIncidentId, reviewQueue, reviewRating, reviewSubmitting]);

    useEffect(() => {
        if (!sosActive || cancelCountdown <= 0) return;
        cancelTimerRef.current = setInterval(() => {
            setCancelCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(cancelTimerRef.current!);
                    completeVolunteerSOSCountdown(volunteerSosCreateSeqRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (cancelTimerRef.current) clearInterval(cancelTimerRef.current); };
    }, [sosActive, cancelCountdown === CANCEL_DURATION_DEFAULT, completeVolunteerSOSCountdown]);

    useEffect(() => {
        pulseAnims.forEach(({ scale, op }, i) => {
            const loop = () => {
                scale.setValue(1);
                op.setValue(0.55);
                RNAnimated.parallel([
                    RNAnimated.timing(scale, { toValue: 1.6, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    RNAnimated.timing(op, { toValue: 0, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                ]).start(() => loop());
            };
            setTimeout(loop, i * 700);
        });
    }, []);

    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

    // Location
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocationErrorMessage('Please grant location access in your device settings.');
                    setLocationErrorVisible(true);
                    return;
                }

                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (!isMountedRef.current) return;
                const { latitude, longitude } = pos.coords;
                const currentLoc = { latitude, longitude };
                userLocRef.current = currentLoc;
                setUserLoc(currentLoc);
                setTimeout(() => {
                    if (isMountedRef.current) {
                        mapRef.current?.animateToRegion(
                            { latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 800
                        );
                    }
                }, 600);
                setLocationStatus('ready');

                const initialCoordinate = sanitizeCoordinate(latitude, longitude);
                if (initialCoordinate) {
                    api.post('/api/locations', {
                        latitude: initialCoordinate.latitude,
                        longitude: initialCoordinate.longitude,
                    })
                        .catch(() => { });
                }

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
                        userLocRef.current = newLoc;
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
            } catch (err: any) {
                console.error('Location init error:', err);
                if (!isMountedRef.current) return;
                setLocationErrorMessage(err?.message ?? 'Unable to access location services.');
                setLocationErrorVisible(true);
            }
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

        // Progress polyline update
        if (routeCoords.length > 0) {
            const progress = getForwardRouteProgress(userLoc, routeCoords);
            setCompletedRouteCoords(progress.completedRouteCoords);
            setRemainingRouteCoords(progress.remainingRouteCoords);

            if (progress.nearestDistanceM > OFF_ROUTE_THRESHOLD_M) {
                if (!offRouteTimerRef.current) {
                    offRouteTimerRef.current = setTimeout(() => {
                        offRouteTimerRef.current = null;
                        if (!isMountedRef.current || !isLiveNav || !userLoc || !endLocation) return;
                        const now = Date.now();
                        if (now - lastRerouteAtRef.current < REROUTE_THROTTLE_MS) return;
                        lastRerouteAtRef.current = now;
                        setStartLocation({
                            id: 'live-reroute-start',
                            name: 'Current location',
                            address: 'Live GPS position',
                            latitude: userLoc.latitude,
                            longitude: userLoc.longitude,
                        });
                        setCompletedRouteCoords([]);
                        setRemainingRouteCoords([]);
                    }, REROUTE_DELAY_MS);
                }
            } else if (offRouteTimerRef.current) {
                clearTimeout(offRouteTimerRef.current);
                offRouteTimerRef.current = null;
            }
        }
    }, [userLoc, directionsMode, navInstructions, currentStepIdx, isLiveNav, routeCoords, endLocation]);

    // ── Decoupled Audio Alert Engine: Standalone thread — always stops previous utterance first ──
    const lastSpokenStepRef = useRef<number>(-1);
    useEffect(() => {
        if (!isLiveNav || !audioEnabled) {
            lastSpokenStepRef.current = -1;
            return;
        }
        if (navInstructions.length === 0 || currentStepIdx >= navInstructions.length) return;

        if (currentStepIdx !== lastSpokenStepRef.current) {
            const instruction = navInstructions[currentStepIdx].instruction;
            // Stop any previous utterance before queueing the next to prevent TTS buildup
            Speech.stop();
            const tid = setTimeout(() => {
                Speech.speak(instruction, {
                    language: 'en',
                    pitch: 1.0,
                    rate: Platform.OS === 'android' ? 0.9 : 0.95,
                });
            }, 80);
            lastSpokenStepRef.current = currentStepIdx;
            return () => clearTimeout(tid);
        }
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

        if (placeSheetOpen) closePlaceSheet();
        if (showLocationCard) closeLocationCard();

        if (userLoc) {
            mapRef.current?.animateToRegion(
                { latitude: userLoc.latitude, longitude: userLoc.longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 },
                700
            );
        } else {
            mapRef.current?.animateToRegion(DEFAULT_REGION, 700);
        }
    }, [deactivateSearch, directionsMode, placeSheetOpen, showLocationCard, userLoc]);

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
            const requestId = ++routeRequestIdRef.current;
            setRouteCoords([]);
            setCompletedRouteCoords([]);
            setRemainingRouteCoords([]);
            setNavInstructions([]);
            setCurrentStepIdx(0);
            setRouteUnsafe(false);
            setBlockedZoneName(null);
            setShowSafePath(false);
            setSafeRouteCoords([]);
            setUnsafeRouteCoords([]);
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
                    console.warn('[VolunteerHome] Route check could not refresh incident zones:', zoneErr);
                    if (isMountedRef.current) {
                        setZonesError(zoneErr instanceof Error ? zoneErr.message : 'Unable to refresh incident zones');
                    }
                    if (latestZones.length === 0) {
                        Alert.alert('Safety zones unavailable', 'Unable to refresh incident zones, so this route cannot be safety-checked yet.');
                    }
                }

                const routeEvaluation = evaluateRouteSafety(chosenCoords, latestZones, {
                    ignoreStartingRedZoneUntilExit: true,
                });

                setRouteCoords(chosenCoords);
                setCompletedRouteCoords([]);
                setRemainingRouteCoords(chosenCoords);

                if (!routeEvaluation.isUnsafe) {
                    setUnsafeRouteCoords([]);
                    setSafeRouteCoords([]);
                    setRouteUnsafe(false);
                    setBlockedZoneName(null);
                    setShowSafePath(false);
                } else {
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
                toValue: 1, duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
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
                console.warn('[VolunteerHome] Safe Path could not refresh incident zones:', zoneErr);
                if (isMountedRef.current) {
                    setZonesError(zoneErr instanceof Error ? zoneErr.message : 'Unable to refresh incident zones');
                }
                stopScanAnimation();
                setShowSafePath(true);
                setScanState(null);
                Alert.alert('Safety zones unavailable', 'Unable to refresh incident zones, so Safe Path cannot be recalculated yet.');
                return;
            }

            let bestRoute: { route: any; coords: LatLng[]; safety: ReturnType<typeof evaluateRouteSafety> } | null = null;
            let bestScore = Infinity;

            for (const route of data.routes) {
                const coords = decodePolyline(route.overview_polyline?.points ?? '');
                const safety = evaluateRouteSafety(coords, latestZones, {
                    ignoreStartingRedZoneUntilExit: true,
                });
                const score = safety.riskScore;

                if (score < bestScore) {
                    bestScore = score;
                    bestRoute = { route, coords, safety };
                }
            }

            if (__DEV__) {
                console.log('[VolunteerHome] Safe Path route evaluation', {
                    zones: latestZones.length,
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
                    void playRouteAudio('partial');
                    return;
                }

                if (bestRoute) {
                    const firstBadPoint = bestRoute.coords.find((p: LatLng) =>
                        latestZones.some((z: any) => z.incidentCount >= 5 && haversineDistance(p, z) <= z.radius)
                    );

                    if (firstBadPoint) {
                        const matchedZone = latestZones.find((z: any) => z.incidentCount >= 5 && haversineDistance(firstBadPoint, z) <= z.radius);

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
                                        const wpSafety = evaluateRouteSafety(wpCoords, latestZones, {
                                            ignoreStartingRedZoneUntilExit: true,
                                        });
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

            setSafeRouteCoords(finalCoords);
            setRouteCoords(finalCoords);
            setCompletedRouteCoords([]);
            setRemainingRouteCoords(finalCoords);
            setNavInstructions(instructions);
            setCurrentStepIdx(0);
            setShowSafePath(false);

            stopScanAnimation();

            mapRef.current?.fitToCoordinates(finalCoords, {
                edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 },
                animated: true,
            });

            if (!bestRoute.safety.isUnsafe) {
                setUnsafeRouteCoords([]);
                setRouteUnsafe(false);
                setBlockedZoneName(null);
                setScanState(bestRoute.safety.riskScore === 0 ? null : 'PARTIAL_SAFETY');
                if (bestRoute.safety.riskScore === 0) {
                    void playRouteAudio('safe');
                } else {
                    void playRouteAudio('partial');
                }
            } else {
                setRouteUnsafe(true);
                setBlockedZoneName(bestRoute.safety.redZoneName ?? blockedZoneName);
                setScanState('PARTIAL_SAFETY');
                void playRouteAudio('partial');
            }
        } catch {
            stopScanAnimation();
            setScanState('NO_ROUTE');
        }
    }, [startLocation, endLocation, travelMode, startScanAnimation, stopScanAnimation, normalizedIncidentZones, blockedZoneName, playRouteAudio]);

    useEffect(() => {
        if (!isLiveNav || !showSafePath || !routeUnsafe || scanState === 'SCANNING') return;
        triggerSafetyRecalculation();
    }, [isLiveNav, routeUnsafe, scanState, showSafePath, triggerSafetyRecalculation]);

    const closeLocationCard = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(locationCardY, { toValue: 300, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(locationCardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setShowLocationCard(false));
    }, [locationCardOpacity, locationCardY]);

    const openPlaceSheet = useCallback((place: PlaceSuggestion, isDangerZone = false) => {
        setPlaceSheetIsDangerZone(isDangerZone);
        setPlaceSheetOpen(true);
        setPlaceSheetMode('incidents');
        setSafePlaceAnswer('');
        setSafePlaceError(null);
        setSafePlaceSubmitState('idle');
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
                        status: String(inc?.status ?? 'ACTIVE'),
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
            name: zone.name || (zone.incidentCount >= 5 ? 'Red Zone' : 'Yellow Zone'),
            address: zone.name || 'Incident zone',
            latitude: zone.latitude,
            longitude: zone.longitude,
            zoneSeverity: zone.incidentCount >= 5 ? 'red' : 'yellow',
        };
        setSelectedPlace(place);
        if (showLocationCard) closeLocationCard();
        const incidents: PlaceIncident[] = (zone.incidents || []).map((inc: any, index: number) => ({
            id: String(inc?.id ?? `${zone.id}-incident-${index}`),
            reporter: String(inc?.reporterName ?? inc?.userName ?? inc?.reporter ?? 'Unknown'),
            time: formatIncidentTime(inc?.time ?? inc?.createdAt ?? inc?.created_at),
            status: String(inc?.status ?? 'ACTIVE'),
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

    const closePlaceSheet = useCallback(() => {
        RNAnimated.parallel([
            RNAnimated.timing(placeSheetY, { toValue: height, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            RNAnimated.timing(placeSheetOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setPlaceSheetOpen(false);
            setSelectedPlace(null);
            setPlaceIncidents([]);
            setPlaceSheetIsDangerZone(false);
            setTimeout(() => setPlaceSheetMode('incidents'), 200);
        });
        placeSheetDragY.setValue(0);
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

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

    const openSosPanel = useCallback(() => {
        if (showLocationCard) closeLocationCard();
        if (placeSheetOpen) closePlaceSheet();
        setShowSafePlace(false);
        setSosPanelOpen(true);
        fetchNearbySosRequests();
    }, [closeLocationCard, closePlaceSheet, fetchNearbySosRequests, placeSheetOpen, showLocationCard]);

    const closeSosPanel = useCallback(() => {
        setSosPanelOpen(false);
        setActiveSosView(null);
        setSosPathCoords([]);
        setSosRouteStartPoint(null);
        setSosRouteEndPoint(null);
        setSosRouteDistance('');
        setSosRouteDuration('');
        setSelectedPlace(null);
        if (userLoc) {
            setTimeout(() => {
                mapRef.current?.animateToRegion(
                    { ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600
                );
            }, 200);
        }
    }, [userLoc]);

    const exitSosView = useCallback(() => {
        setActiveSosView(null);
        setSosPathCoords([]);
        setSosRouteStartPoint(null);
        setSosRouteEndPoint(null);
        setSosRouteDistance('');
        setSosRouteDuration('');
        setSosPanelOpen(true);
    }, []);

    const handleViewSos = useCallback(async (req: SosRequest) => {
        const volunteerLoc = userLoc ?? DEFAULT_REGION;
        const routeStartPoint = sanitizeCoordinate(volunteerLoc.latitude, volunteerLoc.longitude);
        const routeEndPoint = sanitizeCoordinate(req.latitude, req.longitude);
        if (!routeStartPoint || !routeEndPoint) {
            console.warn('[VolunteerHome] SOS route preview skipped due to invalid coordinates', {
                volunteerLoc,
                request: { id: req.id, latitude: req.latitude, longitude: req.longitude },
            });
            return;
        }
        const fallbackRoute = [routeStartPoint, routeEndPoint];
        const fitRoute = (coords: LatLng[]) => {
            mapRef.current?.fitToCoordinates(coords.length > 1 ? coords : fallbackRoute, {
                edgePadding: { top: 120, right: 60, bottom: 360, left: 60 },
                animated: true,
            });
        };

        const showRoutePreview = (coords: LatLng[]) => {
            setActiveSosView(req);
            setSosRouteStartPoint(routeStartPoint);
            setSosRouteEndPoint(routeEndPoint);
            setSosPathCoords(coords);
            fitRoute(coords);
        };

        setSosPanelOpen(false);

        if (!GOOGLE_MAPS_API_KEY) {
            if (!isMountedRef.current) return;
            setSosRouteDistance(`${req.distanceKm.toFixed(1)} km`);
            setSosRouteDuration(`~${Math.round(req.distanceKm / 0.4)} min`);
            showRoutePreview(fallbackRoute);
            return;
        }

        const origin = `${volunteerLoc.latitude},${volunteerLoc.longitude}`;
        const destination = `${req.latitude},${req.longitude}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!isMountedRef.current) return;

            if (data?.routes?.length > 0) {
                const points = data.routes[0].overview_polyline.points;
                const coords = decodePolyline(points);
                const leg = data.routes[0].legs?.[0];

                setSosRouteDistance(leg?.distance?.text ?? `${req.distanceKm.toFixed(1)} km`);
                setSosRouteDuration(leg?.duration?.text ?? '');
                showRoutePreview(coords);
            } else {
                console.warn('[VolunteerHome] Directions API returned no route; using straight SOS route fallback.');
                setSosRouteDistance(`${req.distanceKm.toFixed(1)} km`);
                setSosRouteDuration(`~${Math.max(1, Math.round(req.distanceKm / 0.4))} min`);
                showRoutePreview(fallbackRoute);
            }
        } catch (error) {
            console.warn('[VolunteerHome] Directions API failed; using straight SOS route fallback.', error);
            if (!isMountedRef.current) return;
            setSosRouteDistance(`${req.distanceKm.toFixed(1)} km`);
            setSosRouteDuration(`~${Math.max(1, Math.round(req.distanceKm / 0.4))} min`);
            showRoutePreview(fallbackRoute);
        }
    }, [decodePolyline, userLoc]);

    const handleRejectSos = useCallback(async (req: SosRequest) => {
        try {
            await incidentService.rejectIncident(req.id);
            if (!isMountedRef.current) return;
            rejectedSosIdsRef.current.add(String(req.id));
            setSosRequests(prev => prev.filter(item => item.id !== req.id));
            fetchNearbySosRequests();
            if (activeSosView?.id === req.id) exitSosView();
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || 'Please try again.';
            Alert.alert('Unable to reject SOS', msg);
        }
    }, [activeSosView?.id, exitSosView, fetchNearbySosRequests]);

    const handleAcceptSos = useCallback(async (req: SosRequest) => {
        setAcceptingSosId(req.id);
        try {
            const result = await incidentService.acceptIncident(req.id);
            const chatRoomId = result.chatRoom.incidentId;
            if (!isMountedRef.current) return;
            rejectedSosIdsRef.current.add(String(req.id));
            setSosRequests(prev => prev.filter(item => item.id !== req.id));
            fetchNearbySosRequests();
            exitSosView();
            navigateSafely(`/(tabs)/users/volunteer/chat_room?incidentId=${chatRoomId}&category=ASSISTED`);
        } catch (error: any) {
            if (error?.code === 'MAX_RESPONDERS_EXCEEDED' || error?.response?.data?.code === 'MAX_RESPONDERS_EXCEEDED') {
                setSosRequests(prev => prev.filter(item => item.id !== req.id));
                fetchNearbySosRequests();
                if (activeSosView?.id === req.id) exitSosView();
                setMaxRespondersVisible(true);
                return;
            }
            const status = error?.response?.status;
            if (status === 409 || status === 400) {
                setSosRequests(prev => prev.filter(item => item.id !== req.id));
                fetchNearbySosRequests();
                if (activeSosView?.id === req.id) exitSosView();
            }
            const msg = error?.response?.data?.message || error?.message || 'This incident may have already been claimed.';
            Alert.alert('Unable to accept SOS', msg);
        } finally {
            if (isMountedRef.current) setAcceptingSosId(null);
        }
    }, [activeSosView?.id, exitSosView, fetchNearbySosRequests, navigateSafely]);

    const openAddSafePlace = useCallback(() => {
        setPlaceSheetMode('add_safe_place');
        setSafePlaceError(null);
        setSafePlaceSubmitState('idle');
        safePlaceSuccessAnim.setValue(0);
    }, [safePlaceSuccessAnim]);

    const cancelAddSafePlace = useCallback(() => {
        setPlaceSheetMode('incidents');
        setSafePlaceAnswer('');
        setSafePlaceError(null);
        setSafePlaceSubmitState('idle');
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

    const enterDirectionsMode = useCallback(async (destination: PlaceSuggestion) => {
        clearRouteState();
        let origin = userLocRef.current;
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
                origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, heading: pos.coords.heading ?? undefined };
                if (isMountedRef.current) {
                    userLocRef.current = origin;
                    setUserLoc(origin);
                }
            }
        } catch (err) {
            console.warn('[VolunteerHome] Unable to refresh route origin:', err);
        }
        setDirectionsMode(true);
        if (origin) {
            setStartLocation({
                id: 'current-location',
                name: 'Your location',
                address: address || 'Current location',
                latitude: origin.latitude,
                longitude: origin.longitude,
            });
        }
        setEndLocation(destination);
        setRouteCoords([]);
        RNAnimated.timing(directionsProgress, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        closePlaceSheet();
    }, [address, clearRouteState, closePlaceSheet, directionsProgress]);

    const handleSafePlaceMarkerPress = useCallback((place: SafePlace) => {
        const suggestion = safePlaceToSuggestion(place);
        const now = Date.now();
        const lastTap = safePlaceTapRef.current;
        const isDoubleTap = lastTap?.id === suggestion.id && now - lastTap.at <= 450;
        safePlaceTapRef.current = { id: suggestion.id, at: now };

        if (isDoubleTap) {
            enterDirectionsMode(suggestion);
            return;
        }

        handleResolvedPlaceSelect(suggestion);
    }, [enterDirectionsMode, handleResolvedPlaceSelect, safePlaceToSuggestion]);

    const exitDirectionsMode = useCallback(() => {
        clearRouteState();
        setSelectedPlace(null);
        setSearchText('');
        setPlaceSheetOpen(false);

        RNAnimated.timing(directionsProgress, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();

        if (userLoc) {
            setTimeout(() => {
                mapRef.current?.animateToRegion(
                    { ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600
                );
            }, 100);
        }
    }, [clearRouteState, directionsProgress, userLoc]);

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
    const visibleSosRouteCoords = useMemo(() => {
        const path = sosPathCoords
            .map(point => sanitizeCoordinate(point.latitude, point.longitude))
            .filter(Boolean) as LatLng[];

        if (path.length > 1) return path;

        const start = sosRouteStartPoint
            ? sanitizeCoordinate(sosRouteStartPoint.latitude, sosRouteStartPoint.longitude)
            : null;

        const end = sosRouteEndPoint
            ? sanitizeCoordinate(sosRouteEndPoint.latitude, sosRouteEndPoint.longitude)
            : null;

        return start && end ? [start, end] : [];
    }, [sosPathCoords, sosRouteStartPoint, sosRouteEndPoint]);

    const sosRouteMarkerStartPoint =
        visibleSosRouteCoords.length > 1 ? visibleSosRouteCoords[0] : null;

    const sosRouteMarkerEndPoint =
        visibleSosRouteCoords.length > 1
            ? visibleSosRouteCoords[visibleSosRouteCoords.length - 1]
            : null;

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Map ─────────────────────────────────────────────────────── */}
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={DEFAULT_REGION}
                    showsUserLocation={!isLiveNav && !activeSosView}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    moveOnMarkerPress={false}
                    customMapStyle={TACTICAL_MAP_STYLE}
                >
                    {/* Dynamic Circle Color Mapping: Handles Red vs Yellow Thresholds */}
                    {normalizedIncidentZones.map(zone => {
                        const zoneIsRed = zone.incidentCount >= 5;
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
                                    <View style={s.zoneTapTarget} />
                                </Marker>
                            </React.Fragment>
                        );
                    })}

                    {confirmedSafePlaces.map((place) => (
                        <Marker
                            key={`confirmed-safe-place-${place.id}`}
                            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                            anchor={{ x: 0.5, y: 1 }}
                            calloutAnchor={{ x: 0.5, y: 0 }}
                            tracksViewChanges={true}
                            zIndex={700}
                            title="Safe Place"
                            description={place.description || place.address || place.name}
                            pinColor={T.violet}
                            onPress={() => handleSafePlaceMarkerPress(place)}
                        />
                    ))}

                    {selectedPlace && !directionsMode && (
                        <Marker
                            key={`${selectedPlace.id}-${selectedPlaceMarkerColor}`}
                            coordinate={{ latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }}
                            anchor={{ x: 0.5, y: 1 }}
                            calloutAnchor={{ x: 0.5, y: 0 }}
                            tracksViewChanges={true}
                            zIndex={999}
                            pinColor={selectedPlaceMarkerColor}
                            onPress={() => {
                                if (!directionsMode) {
                                    openPlaceSheet(selectedPlace, selectedPlace.id.startsWith('zone-'));
                                }
                            }}
                        >
                            <View style={s.placeMarkerWrap}>
                                <View style={[s.placeMarkerIconWrap, { shadowColor: selectedPlaceMarkerColor }]}>
                                    <Ionicons
                                        name="location"
                                        size={26}
                                        color={selectedPlaceMarkerColor}
                                    />
                                </View>
                                <View style={s.placeMarkerStem} />
                            </View>
                        </Marker>
                    )}

                    {/* ── Live Navigation Modern Tracking Arrow ── */}
                    {directionsMode && startLocation && !isLiveNav && (
                        <Marker
                            coordinate={{ latitude: startLocation.latitude, longitude: startLocation.longitude }}
                            pinColor={T.violet}
                            title="You"
                            description="Current location"
                            zIndex={1000}
                        />
                    )}
                    {directionsMode && endLocation && (
                        <Marker
                            coordinate={{ latitude: endLocation.latitude, longitude: endLocation.longitude }}
                            pinColor={selectedPlaceMarkerColor}
                            title={selectedPlace?.name || 'Destination'}
                            description={selectedPlace?.address || 'Route destination'}
                            zIndex={999}
                        />
                    )}

                    {isLiveNav && userLoc && (
                        <Marker
                            coordinate={{ latitude: userLoc.latitude, longitude: userLoc.longitude }}
                            pinColor={T.violet}
                            title="You"
                            description="Current location"
                            zIndex={1001}
                        />
                    )}

                    {isLiveNav && userLoc && !directionsMode && (
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

                    {showSafePlace && safePlaceCoords.length > 1 && (
                        <>
                            <Polyline
                                coordinates={safePlaceCoords}
                                strokeColor={T.violet}
                                strokeWidth={4}
                                lineCap="round"
                                lineJoin="round"
                            />
                            <Marker
                                coordinate={safePlaceCoords[0]}
                                pinColor={T.violet}
                                title="You"
                                description="Current location"
                            />
                            <Marker
                                coordinate={safePlaceCoords[safePlaceCoords.length - 1]}
                                pinColor={T.success}
                                title="Safe Place"
                                description="Route destination"
                            />
                        </>
                    )}

                    {/* LAYER 1 — Crimson ghost: original unsafe route snapshot */}
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

                    {/* ── SOS Visualization ────────────────────────────────────── */}
                    {activeSosView && visibleSosRouteCoords.length > 1 && (
                        <>
                            <Polyline
                                coordinates={visibleSosRouteCoords}
                                strokeColor="rgba(138, 56, 246, 0.28)"
                                strokeWidth={10}
                                lineCap="round"
                                lineJoin="round"
                                zIndex={5000}
                            />

                            <Polyline
                                coordinates={visibleSosRouteCoords}
                                strokeColor={T.violet}
                                strokeWidth={4}
                                lineCap="round"
                                lineJoin="round"
                                zIndex={5001}
                            />
                        </>
                    )}

                    {activeSosView && sosRouteMarkerStartPoint && (
                        <Marker
                            key={`sos-volunteer-${activeSosView.id}-${sosRouteMarkerStartPoint.latitude}-${sosRouteMarkerStartPoint.longitude}`}
                            coordinate={sosRouteMarkerStartPoint}
                            pinColor={T.violet}
                            title="You"
                            description="Volunteer location"
                            zIndex={7000}
                        />
                    )}

                    {activeSosView && sosRouteMarkerEndPoint && (
                        <Marker
                            key={`sos-victim-${activeSosView.id}-${sosRouteMarkerEndPoint.latitude}-${sosRouteMarkerEndPoint.longitude}`}
                            coordinate={sosRouteMarkerEndPoint}
                            pinColor="#EF4444"
                            title={activeSosView.victimName || 'Victim'}
                            description={activeSosView.locationLabel || 'SOS location'}
                            zIndex={7001}
                        />
                    )}
                </MapView>

                {locationStatus === 'idle' && <PulseRadar />}
                {__DEV__ && zonesError && (
                    <View style={[s.zoneDebugBanner, { top: insets.top + 62 }]}>
                        <Text style={s.zoneDebugText}>Zones unavailable: {zonesError}</Text>
                    </View>
                )}

                {/* ── Header with Animated Search ──────────────────────────────── */}
                {!isLiveNav && !sosPanelOpen && (
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
                                                onPress={() => {
                                                    Keyboard.dismiss();
                                                    startInputRef.current?.blur();
                                                    searchInputRef.current?.blur();
                                                    setTravelMode(mode);
                                                }}
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
                                {activeSosView && (
                                    <TouchableOpacity
                                        style={[s.hBtn, { marginRight: 8 }]}
                                        onPress={exitSosView}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="arrow-back" size={20} color={T.ink2} />
                                    </TouchableOpacity>
                                )}
                                {!activeSosView && (
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
                                )}

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
                                            onPress={() => navigateSafely('/(tabs)/users/volunteer/notifications')}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="notifications-outline" size={20} color={T.ink2} />
                                            {sosRequests.length > 0 && <View style={s.notifDot} />}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={s.profileBtn}
                                            onPress={() => navigateSafely('/(tabs)/users/volunteer/profile-menu')}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            accessibilityLabel="Open profile menu"
                                            accessibilityRole="button"
                                        >
                                            <UserAvatar
                                                uri={profile?.photoUri}
                                                size={36}
                                                style={s.profileAvatar}
                                                iconColor={T.violet}
                                                backgroundColor={T.violetDim}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </RNAnimated.View>
                            </>
                        )}
                    </PremiumBar>
                )}



                {/* ── Top Live Banner ────────────────────────────────────────── */}
                {isLiveNav && navInstructions.length > 0 && !sosPanelOpen && (
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

                {/* ── Current location button (35% from top) ───────────────────── */}
                {!directionsMode && !selectedPlace && !sosPanelOpen && !searchActive && !startSearchActive && (
                    <View style={s.mapControls}>
                        <TouchableOpacity
                            style={[s.ctrlBtn, { borderColor: '#A78BFA' }]}
                            onPress={() => setIsSosButtonVisible(visible => !visible)}
                            accessibilityLabel="Emergency SOS"
                            accessibilityRole="button"
                        >
                            <PurpleSosSquareIcon size={26} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={s.ctrlBtn}
                            onPress={openLocationCard}
                            accessibilityLabel="Show my location"
                            accessibilityRole="button"
                        >
                            <Ionicons name="locate-outline" size={22} color={T.violet} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[s.sosReqBtn, { borderColor: '#A78BFA' }]}
                            onPress={openSosPanel}
                            activeOpacity={0.85}
                            accessibilityLabel="View SOS requests"
                            accessibilityRole="button"
                        >
                            <PurpleSosBellIcon size={30} />
                            {sosRequests.length > 0 && <View style={s.sosReqBadge} />}
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── SOS Requests Panel — floating window ─────────────────── */}
                {sosPanelOpen && (
                    <View style={{ flex: 1, position: 'absolute', width: '100%', height: '100%', zIndex: 235 }}>
                        <Pressable style={s.sosPanelBackdrop} onPress={closeSosPanel} />
                        <View style={[s.sosPanel, { bottom: navBottom + NAV_HEIGHT + 16 }]}>
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={s.sosPanelTint} pointerEvents="none" />
                            <View style={s.sosPanelHeader}>
                                <Text style={s.sosPanelTitle}>Nearby SOS Requests</Text>
                                <Text style={s.sosPanelSub}>Active now</Text>
                            </View>
                            <ScrollView
                                contentContainerStyle={s.sosPanelList}
                                showsVerticalScrollIndicator={false}
                            >
                                {sosRequests.length === 0 && (
                                    <Text style={s.placeSheetEmpty}>
                                        No live SOS requests nearby
                                    </Text>
                                )}
                                {sosRequests.map(req => (
                                    <View key={req.id} style={s.sosCard}>
                                        <UserAvatar uri={req.avatarUri ?? null} size={40} style={s.sosAvatar} />
                                        <View style={s.sosCardBody}>
                                            <View style={s.sosCardRow}>
                                                <Text style={s.sosVictimName}>{req.victimName}</Text>
                                                <Text style={s.sosDistance}>{req.distanceKm.toFixed(1)} km</Text>
                                            </View>
                                            <View style={s.sosLocationRow}>
                                                <Text style={s.sosLocationText} numberOfLines={1}>
                                                    {req.locationLabel}
                                                </Text>
                                                <TouchableOpacity
                                                    style={s.sosViewBtn}
                                                    onPress={() => handleViewSos(req)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={s.sosViewBtnText}>View</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={s.sosRequestActionRow}>
                                                <TouchableOpacity
                                                    style={s.sosRejectBtn}
                                                    onPress={() => handleRejectSos(req)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={s.sosRejectText}>Reject</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={s.sosAcceptBtn}
                                                    onPress={() => handleAcceptSos(req)}
                                                    activeOpacity={0.8}
                                                    disabled={acceptingSosId === req.id}
                                                >
                                                    <Text style={s.sosAcceptText}>
                                                        {acceptingSosId === req.id ? 'Accepting...' : 'Accept'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                )}

                {/* ── SOS Path Info Card ───────────────────────────────────────── */}
                {activeSosView && (
                    <View style={[s.sosInfoCard, { bottom: navBottom + NAV_HEIGHT + 16 }]}>
                        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.sosPanelTint} pointerEvents="none" />

                        <View style={s.sosConnectorRow}>
                            <View style={s.sosConnectorEndpoint}>
                                <View style={[s.sosConnectorCircle, s.sosConnectorCircleA]}>
                                    <UserAvatar
                                        uri={profile?.photoUri}
                                        size={48}
                                        style={s.sosConnectorAvatar}
                                        iconColor={T.violet}
                                        backgroundColor={T.violetDim}
                                    />
                                </View>
                                <Text style={s.sosConnectorPointLabel}>A</Text>
                                <Text style={s.sosConnectorLabel}>You</Text>
                                <Text style={s.sosConnectorSub} numberOfLines={1}>{address || 'Current location'}</Text>
                            </View>

                            <View style={s.sosConnectorMiddle}>
                                <View style={s.sosConnectorLineWrap}>
                                    <View style={s.sosConnectorLineDash} />
                                    <Ionicons name="arrow-forward" size={12} color={T.danger} />
                                    <View style={s.sosConnectorLineDash} />
                                </View>
                                <View style={s.sosConnectorDistChip}>
                                    <Ionicons name="navigate" size={10} color={T.violet} />
                                    <Text style={s.sosConnectorDistText}>
                                        {sosRouteDistance || `${activeSosView.distanceKm.toFixed(1)} km`}
                                    </Text>
                                </View>
                                {sosRouteDuration ? (
                                    <Text style={s.sosConnectorEta}>{sosRouteDuration}</Text>
                                ) : null}
                            </View>

                            <View style={s.sosConnectorEndpoint}>
                                <View style={[s.sosConnectorCircle, s.sosConnectorCircleB]}>
                                    <UserAvatar
                                        uri={activeSosView.avatarUri ?? null}
                                        size={48}
                                        style={s.sosConnectorAvatar}
                                        iconColor={T.danger}
                                        backgroundColor={T.dangerBg}
                                    />
                                </View>
                                <Text style={s.sosConnectorPointLabel}>B</Text>
                                <Text style={s.sosConnectorLabel} numberOfLines={1}>
                                    {activeSosView.victimName.split(' ')[0]}
                                </Text>
                                <Text style={s.sosConnectorSub} numberOfLines={1}>{activeSosView.locationLabel}</Text>
                            </View>
                        </View>

                        <View style={s.sosInfoRow}>
                            <View style={[s.sosInfoDot, { backgroundColor: T.danger }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.sosInfoName}>{activeSosView.victimName}</Text>
                                <Text style={s.sosInfoLocation} numberOfLines={1}>{activeSosView.locationLabel}</Text>
                            </View>
                        </View>

                        <View style={[s.sosRequestActionRow, { paddingHorizontal: 16, paddingBottom: 14 }]}>
                            <TouchableOpacity
                                style={s.sosRejectBtn}
                                onPress={() => handleRejectSos(activeSosView)}
                                activeOpacity={0.8}
                            >
                                <Text style={s.sosRejectText}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.sosAcceptBtn, { flexDirection: 'row', gap: 6 }]}
                                onPress={() => handleAcceptSos(activeSosView)}
                                activeOpacity={0.8}
                                disabled={acceptingSosId === activeSosView.id}
                            >
                                <Ionicons name="navigate" size={14} color={T.violet} />
                                <Text style={s.sosAcceptText}>
                                    {acceptingSosId === activeSosView.id ? 'Accepting...' : 'Accept & Navigate'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Location Card — slides up from bottom ───────────────────── */}
                {showLocationCard && (
                    <View style={{ flex: 1, position: 'absolute', width: '100%', height: '100%', zIndex: 220 }}>
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
                    </View>
                )}

                {/* ── SOS Overlay — centered on screen ───────────────────── */}
                {isSosButtonVisible && !showSafePlace && !searchActive && !startSearchActive && !sosPanelOpen && (
                    <View style={s.sosSection} pointerEvents="box-none">
                        <View style={s.sosWrap}>
                            {sosActive && cancelCountdown > 0 ? (
                                <TouchableOpacity onPress={cancelSOS} activeOpacity={0.88}>
                                    <View style={s.cancelBtn}>
                                        <Text style={s.cancelLabel}>CANCEL</Text>
                                        <Text style={s.cancelCount}>{cancelCountdown}s</Text>
                                        <Text style={s.cancelSub}>Tap to cancel</Text>
                                    </View>
                                </TouchableOpacity>
                            ) : isEmergencyLive ? (
                                <LiveSOSButton onPress={() => setResponderSheetVisible(true)} />
                            ) : (
                                <HoldSosButton onTrigger={triggerSOS} onPhaseChange={setHoldPhase} />
                            )}

                            {sosActive && pulseAnims.map(({ scale, op }, i) => (
                                <RNAnimated.View
                                    key={i}
                                    pointerEvents="none"
                                    style={[s.pulseRing, {
                                        transform: [{ scale }],
                                        opacity: op,
                                        borderColor: isEmergencyLive ? `${T.danger}73` : G.sosRingDefault,
                                    }]}
                                />
                            ))}
                        </View>

                        {/* ── Feedback Message Pillar ── */}
                        <View style={[s.sosStatusPill, isEmergencyLive && s.statusPillLive]}>
                            {!sosActive ? (
                                <Text style={s.pillTxt} numberOfLines={1}>
                                    {holdPhase === 'idle'
                                        ? 'Press and hold for 2 sec'
                                        : holdPhase === 'holding'
                                            ? 'Holding...'
                                            : 'Release'
                                    }
                                </Text>
                            ) : (
                                <>
                                    <View style={[s.pillDot, { backgroundColor: T.danger }]} />
                                    <Text style={[s.pillTxt, isEmergencyLive && s.pillTxtLive]} numberOfLines={1}>
                                        {cancelCountdown > 0
                                            ? `Alert triggered · Cancel in ${cancelCountdown}s`
                                            : 'Sharing your location'
                                        }
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                )}

                <Modal
                    visible={verificationGateVisible && needsVolunteerVerification}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={() => {}}
                >
                    <View style={s.verificationGateOverlay}>
                        <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.verificationGateScrim} pointerEvents="none" />
                        <View style={s.verificationGateCard}>
                            <View style={s.verificationGateIconWrap}>
                                <Feather name="shield" size={24} color={T.accent} />
                            </View>
                            <Text style={s.verificationGateTitle}>Verification Pending</Text>
                            <Text style={s.verificationGateMessage}>
                                Your volunteer account is currently under admin review. You will gain access after approval from administration.
                            </Text>
                            <Text style={s.verificationGateEta}>Estimated Review: 24-48h</Text>
                            <View style={s.verificationGateActions}>
                                <TouchableOpacity
                                    style={s.verificationGateOkBtn}
                                    onPress={() => navigateSafely('/(tabs)/users/volunteer/volunteer-verification', true)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={s.verificationGateOkTxt}>View Status</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={s.verificationGateLogoutBtn}
                                    onPress={handleVerificationLogout}
                                    activeOpacity={0.9}
                                >
                                    <LinearGradient
                                        colors={['#D92D20', '#F04444']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={s.verificationGateLogoutFill}
                                    >
                                        <Text style={s.verificationGateLogoutTxt}>Logout</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* ── STEP 1: GLASSMORPHIC STATUS UPDATE BOTTOM SHEET ── */}
                <Modal
                    visible={responderSheetVisible}
                    animationType="slide"
                    transparent={true}
                    statusBarTranslucent
                    onRequestClose={() => setResponderSheetVisible(false)}
                >
                    <View style={s.responderSheetOverlay}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setResponderSheetVisible(false)} />
                        <View style={s.responderSheetContainer}>
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={s.responderSheetTint} pointerEvents="none" />

                            <View style={s.responderSheetGrabberWrap}>
                                <View style={s.responderSheetGrabber} />
                            </View>

                            <View style={s.responderSheetContent}>
                                <Text style={s.responderSheetTitle}>Update Emergency Status</Text>

                                <TouchableOpacity
                                    style={[styles.sheetMainBtn, styles.btnResolve]}
                                    onPress={() => { setResponderSheetVisible(false); confirmStop('resolve'); }}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="checkmark-circle-outline" size={18} color="#3B82F6" />
                                    <Text style={styles.btnTextResolved}>RESOLVE</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.sheetMainBtn, styles.btnCancel]}
                                    onPress={() => { setResponderSheetVisible(false); confirmStop('cancel'); }}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                                    <Text style={styles.btnTextCancel}>CANCEL</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={s.sheetCloseLink} onPress={() => setResponderSheetVisible(false)}>
                                    <Text style={s.sheetCloseLinkText}>Back to live tracking map</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* ── STEP 2: BRAND IDENTICAL CONFIRMATION DIALOG BOX ── */}
                <Modal
                    visible={stopConfirmVisible}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={closeStopConfirm}
                >
                    <View style={s.stopConfirmOverlay}>
                        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.stopConfirmScrim} pointerEvents="none" />
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeStopConfirm} />
                        <View style={s.stopConfirmCard}>
                            <View style={[s.stopConfirmIconWrap, stopConfirmMode === 'resolve' && { backgroundColor: 'rgba(52,199,89,0.14)', borderColor: 'rgba(52,199,89,0.28)' }]}>
                                <Feather
                                    name={stopConfirmMode === 'resolve' ? "check-circle" : "alert-triangle"}
                                    size={24}
                                    color={stopConfirmMode === 'resolve' ? T.success : T.danger}
                                />
                            </View>
                            <Text style={s.stopConfirmTitle}>
                                {stopConfirmMode === 'resolve' ? 'Resolve Emergency?' : 'Stop Emergency Alert?'}
                            </Text>
                            <Text style={s.stopConfirmMessage}>
                                {stopConfirmMode === 'resolve'
                                    ? 'Are you completely secure? This will mark the incident tracking window as successfully resolved.'
                                    : 'Your active live tracking stream will cut off and no longer share real-time location vectors.'}
                            </Text>
                            <View style={s.stopConfirmActions}>
                                <TouchableOpacity style={[s.stopConfirmPrimaryBtn, { overflow: 'hidden' }]} onPress={closeStopConfirm} activeOpacity={0.85}>
                                    <View style={[s.stopConfirmPrimaryFill, { backgroundColor: T.violet }]}>
                                        <Text style={s.stopConfirmPrimaryTxt}>No, Keep Active</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.stopConfirmSecondaryBtn} onPress={handleStopAlert} activeOpacity={0.9}>
                                    <Text style={[s.stopConfirmSecondaryTxt, { color: stopConfirmMode === 'resolve' ? T.success : T.danger }]}>
                                        {stopConfirmMode === 'resolve' ? 'Yes, Resolve' : 'Yes, Stop'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <Modal
                    visible={locationErrorVisible}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={() => setLocationErrorVisible(false)}
                >
                    <View style={s.stopConfirmOverlay}>
                        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.stopConfirmScrim} pointerEvents="none" />
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setLocationErrorVisible(false)} />
                        <View style={s.stopConfirmCard}>
                            <View style={s.stopConfirmIconWrap}>
                                <Feather name="map-pin" size={22} color={T.violet} />
                            </View>
                            <Text style={s.stopConfirmTitle}>Location Unavailable</Text>
                            <Text style={s.stopConfirmMessage}>{locationErrorMessage ?? 'Location services unavailable.'}</Text>
                            <View style={s.stopConfirmActions}>
                                <TouchableOpacity style={s.stopConfirmSecondaryBtn} onPress={() => setLocationErrorVisible(false)} activeOpacity={0.85}>
                                    <Text style={s.stopConfirmSecondaryTxt}>Dismiss</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.stopConfirmPrimaryBtn} onPress={() => { setLocationErrorVisible(false); setLocationRetryKey(prev => prev + 1); }} activeOpacity={0.9}>
                                    <LinearGradient
                                        colors={[T.violet, '#8A38F6']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={s.stopConfirmPrimaryFill}
                                    >
                                        <Text style={s.stopConfirmPrimaryTxt}>Retry</Text>
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
                                            <UserAvatar
                                                uri={volunteer.avatarUri}
                                                size={isCurrent ? 68 : 56}
                                                style={s.reviewAvatarImg}
                                            />
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

                {/* ── Place Detail Sheet — half screen ─────────────────────── */}
                {placeSheetOpen && selectedPlace && (
                    <View style={{ flex: 1, position: 'absolute', width: '100%', height: '100%', zIndex: 230 }}>
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

                                {!placeSheetIsDangerZone && selectedPlace.source !== 'safe_place' && (
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
                                    {selectedPlace.source === 'safe_place' ? (
                                        <>
                                            <Text style={s.placeSheetSectionTitle}>Safe Place</Text>
                                            <View style={s.safePlaceInfoCard}>
                                                <View style={s.safePlaceInfoBadge}>
                                                    <Ionicons name="shield-checkmark" size={13} color={T.onPrimary} />
                                                    <Text style={s.safePlaceInfoBadgeText}>Safe Place</Text>
                                                </View>
                                                <Text style={s.safePlaceInfoTitle}>{selectedPlace.name}</Text>
                                                {!!selectedPlace.description && (
                                                    <Text style={s.safePlaceInfoText}>{selectedPlace.description}</Text>
                                                )}
                                                <View style={s.safePlaceInfoLocation}>
                                                    <Ionicons name="location" size={14} color={T.ink4} />
                                                    <Text style={s.safePlaceInfoText}>{selectedPlace.address}</Text>
                                                </View>
                                            </View>
                                        </>
                                    ) : placeSheetMode === 'incidents' || placeSheetIsDangerZone ? (
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
                    </View>
                )}

                {/* ── Step-by-Step Instruction Card ────────────────────────────── */}
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
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingLeft: 8 }}
                                    style={{ flexShrink: 1, marginLeft: 8 }}
                                >
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
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setCompletedRouteCoords([]);
                                            setRemainingRouteCoords(routeCoords);
                                            setIsLiveNav(true);
                                        }}
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
                                </ScrollView>
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

                <SafetyScanOverlay
                    scanState={scanState}
                    spinAnim={scanAnim}
                    r0={radarAnim0} r1={radarAnim1} r2={radarAnim2}
                    zoneName={blockedZoneName}
                    onClose={() => setScanState(null)}
                />

                {/* ── Bottom Navbar ─────────────────────────────────────────────── */}
                <MaxRespondersModal
                    visible={maxRespondersVisible}
                    onClose={() => setMaxRespondersVisible(false)}
                />

                <VolunteerNavbar activeTab="Home" onActiveTabPress={refreshAndRecenterMap} />
            </View>
        </AtmosphericShell>
    );
}

// ── Tactical Map Style ─────────────────────────────
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

    responderSheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(4,3,8,0.45)',
        zIndex: 999,
    },
    responderSheetContainer: {
        backgroundColor: T.surfaceOverlay,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        paddingBottom: Platform.OS === 'ios' ? 42 : 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    responderSheetTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    responderSheetGrabberWrap: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    responderSheetGrabber: {
        width: 42,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    responderSheetContent: {
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    responderSheetTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 20,
        letterSpacing: -0.2,
    },
    responderSheetBtn: {
        width: '100%',
        minHeight: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        borderWidth: 1,
        marginBottom: 12,
    },
    responderSheetBtnCancel: {
        backgroundColor: `${T.danger}1A`,
        borderColor: `${T.danger}59`,
    },
    responderSheetBtnResolve: {
        backgroundColor: `${T.violet}1F`,
        borderColor: `${T.violet}59`,
    },
    responderSheetBtnText: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    responderSheetBtnTextCancel: {
        color: T.danger,
    },
    responderSheetBtnTextResolve: {
        color: T.violet,
    },
    sheetCloseLink: {
        marginTop: 4,
        paddingVertical: 8,
    },
    sheetCloseLinkText: {
        color: T.navIconInactive,
        fontSize: 12,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },

    crosshairWrap: {
        position: 'absolute', alignSelf: 'center',
        top: height * 0.29,
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
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    profileAvatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    notifDot: {
        position: 'absolute', top: 7, right: 7,
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface,
    },

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

    mapControls: { position: 'absolute', right: 20, top: '35%', gap: 8, alignItems: 'flex-end', zIndex: 390, elevation: 20 },
    zoneDebugBanner: { position: 'absolute', left: 16, right: 16, zIndex: 310, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', paddingHorizontal: 12, paddingVertical: 8 },
    zoneDebugText: { color: '#FCA5A5', fontSize: 11, fontWeight: '700' },
    zoneTapTarget: { width: 44, height: 44, backgroundColor: 'transparent' },
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
    sosBtn: {
        width: SOS_BTN_SIZE,
        height: SOS_BTN_SIZE,
        borderRadius: SOS_BTN_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.40, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 12 },
        }),
    },
    sosTxt: {
        fontSize: 38,
        fontWeight: '900',
        color: T.onPrimary,
        letterSpacing: 1.5,
    },
    sosTxtCompact: {
        fontSize: 18,
    },
    sosSubTxtCompact: {
        fontSize: 7.5,
    },
    sosSection: {
        position: 'absolute',
        top: (height - SOS_WRAP_SIZE) / 2,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 390,
        elevation: 20,
    },
    sosWrap: {
        width: SOS_WRAP_SIZE,
        height: SOS_WRAP_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sosStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.full,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginTop: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 3 },
        }),
    },
    sosStatusPillAccepted: {
        backgroundColor: T.dangerBg,
        borderColor: T.dangerBorder,
    },
    pulseRing: {
        position: 'absolute',
        width: SOS_BTN_SIZE,
        height: SOS_BTN_SIZE,
        borderRadius: SOS_BTN_SIZE / 2,
        borderWidth: 2.5,
    },
    pillTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 0.4,
        textAlign: 'center',
        flexShrink: 1,
        lineHeight: 15,
    },
    pillDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.violet,
    },
    statusPillLive: {
        backgroundColor: `${T.danger}15`,
        borderColor: `${T.danger}30`,
    },
    pillTxtLive: {
        color: T.danger,
    },
    pillTxtAccepted: {
        color: T.dangerText,
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
    sosSubTxt: {
        color: `${T.onPrimary}B3`,
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginTop: 4,
    },
    cancelBtn: {
        width: SOS_BTN_SIZE,
        height: SOS_BTN_SIZE,
        borderRadius: SOS_BTN_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    cancelLabel: {
        fontSize: 14,
        fontWeight: '900',
        color: T.ink,
        letterSpacing: 0.5,
    },
    cancelCount: {
        fontSize: 24,
        fontWeight: '900',
        color: T.danger,
        letterSpacing: -0.5,
        marginTop: 4,
    },
    cancelSub: {
        fontSize: 10,
        fontWeight: '700',
        color: T.ink3,
        marginTop: 2,
    },
    sosResponderActionRow: {
        position: 'absolute',
        bottom: -118,
        flexDirection: 'row',
        gap: 10,
        width: 340,
        justifyContent: 'center',
    },
    sosResponderActionBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: R.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    sosResponderActionBtnCancelled: {
        backgroundColor: T.dangerBg,
        borderColor: T.dangerBorder,
    },
    sosResponderActionBtnResolved: {
        backgroundColor: T.safeLight,
        borderColor: `${T.success}40`,
    },
    sosResponderActionBtnText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sosResponderActionBtnTextCancelled: {
        color: T.dangerText,
    },
    sosResponderActionBtnTextResolved: {
        color: T.success,
    },
    sosReqBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: T.dangerBorder,
        ...Platform.select({
            ios: { shadowColor: '#E23636', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4, shadowColor: '#E23636' },
        }),
    },
    sosReqBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: T.danger,
        borderWidth: 1.5,
        borderColor: T.surface,
    },

    verificationGateOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        backgroundColor: 'rgba(4,6,12,0.45)',
    },
    verificationGateScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,8,18,0.52)',
    },
    verificationGateCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        paddingHorizontal: 22,
        paddingTop: 22,
        paddingBottom: 18,
        backgroundColor: 'rgba(24,16,40,0.76)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
            android: { elevation: 18 },
        }),
    },
    verificationGateIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(138,56,246,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(138,56,246,0.28)',
        marginBottom: 14,
    },
    verificationGateTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.3,
    },
    verificationGateMessage: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: T.ink2,
        fontWeight: '500',
    },
    verificationGateEta: {
        marginTop: 10,
        fontSize: 12,
        lineHeight: 18,
        color: T.ink3,
        fontWeight: '700',
    },
    verificationGateActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 22,
    },
    verificationGateOkBtn: {
        flex: 1,
        minHeight: 48,
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    verificationGateOkTxt: {
        color: T.ink3,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    verificationGateLogoutBtn: {
        flex: 1,
        borderRadius: R.pill,
        overflow: 'hidden',
        minHeight: 48,
    },
    verificationGateLogoutFill: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verificationGateLogoutTxt: {
        color: T.onPrimary,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },

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
        paddingHorizontal: 18,
        backgroundColor: 'rgba(4,6,12,0.45)',
    },
    reviewScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(8,8,16,0.58)',
    },
    reviewCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 18,
        backgroundColor: 'rgba(24,16,40,0.76)',
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
        alignItems: 'center',
        justifyContent: 'center',
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
        borderWidth: 0,
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

    sosPanelBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(3,3,8,0.35)',
        zIndex: 235,
    },
    sosPanel: {
        position: 'absolute',
        left: 14,
        right: 14,
        maxHeight: height * 0.62,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        zIndex: 240,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    sosPanelTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(12,9,22,0.9)',
    },
    sosPanelHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
    },
    sosPanelTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.2,
    },
    sosPanelSub: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
        color: T.ink3,
    },
    sosPanelList: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    sosCard: {
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    sosAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    sosCardBody: {
        flex: 1,
        gap: 6,
    },
    sosCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sosVictimName: {
        fontSize: 14,
        fontWeight: '700',
        color: T.ink,
    },
    sosDistance: {
        fontSize: 12,
        fontWeight: '700',
        color: T.violet,
    },
    sosLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sosLocationText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: T.ink3,
    },
    sosViewBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: `${T.violet}20`,
        borderWidth: 1,
        borderColor: `${T.violet}45`,
    },
    sosViewBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.violet,
        letterSpacing: 0.2,
    },
    sosRequestActionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 2,
    },
    sosRejectBtn: {
        flex: 1,
        height: 34,
        borderRadius: 999,
        backgroundColor: T.dangerLight,
        borderWidth: 1,
        borderColor: T.dangerBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sosRejectText: {
        fontSize: 12,
        fontWeight: '800',
        color: T.danger,
        letterSpacing: 0.2,
    },
    sosAcceptBtn: {
        flex: 1,
        height: 34,
        borderRadius: 999,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sosAcceptText: {
        fontSize: 12,
        fontWeight: '800',
        color: T.violet,
        letterSpacing: 0.2,
    },

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
    safePlaceMarkerWrap: { alignItems: 'center', justifyContent: 'center' },
    safePlaceMarkerIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.violet,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.9)',
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 7, shadowColor: '#8A38F6' },
        }),
    },
    safePlaceMarkerStart: {
        backgroundColor: T.surface,
    },
    safePlaceMarkerEnd: {
        backgroundColor: T.surface,
    },

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
    placeSheetActions: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 18,
        paddingBottom: 12,
    },
    placeSheetActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
    },
    placeSheetActionBtnPrimary: {
        backgroundColor: T.violet,
        borderColor: `${T.violet}70`,
    },
    placeSheetActionBtnSecondary: {
        backgroundColor: T.surfaceBulky,
        borderColor: `${T.violet}45`,
    },
    placeSheetActionBtnTextPrimary: {
        fontSize: 12,
        fontWeight: '800',
        color: T.onPrimary,
        letterSpacing: 0.2,
    },
    placeSheetActionBtnTextSecondary: {
        fontSize: 12,
        fontWeight: '800',
        color: T.violet,
        letterSpacing: 0.2,
    },
    placeSheetSection: {
        paddingHorizontal: 18,
        paddingTop: 6,
        gap: 10,
    },
    safePlaceQuestion: {
        fontSize: 12,
        fontWeight: '600',
        color: T.ink3,
        lineHeight: 16,
    },
    safePlaceInput: {
        minHeight: 96,
        borderRadius: 14,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        fontWeight: '600',
        color: T.ink,
    },
    safePlaceError: {
        fontSize: 12,
        fontWeight: '600',
        color: T.danger,
        marginTop: -4,
    },
    safePlaceActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    safePlaceSuccessWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: `${T.success}14`,
        borderWidth: 1,
        borderColor: `${T.success}35`,
        marginTop: 6,
    },
    safePlaceSuccessIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: T.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    safePlaceSuccessTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.2,
    },
    safePlaceSuccessSubtitle: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: T.ink3,
        lineHeight: 16,
    },
    safePlaceBtn: {
        flex: 1,
        height: 40,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    safePlaceBtnSecondary: {
        backgroundColor: T.surfaceBulky,
        borderColor: `${T.violet}45`,
    },
    safePlaceBtnCancel: {
        backgroundColor: T.dangerLight,
        borderColor: T.dangerBorder,
    },
    safePlaceBtnPrimary: {
        backgroundColor: T.violet,
        borderColor: `${T.violet}70`,
    },
    safePlaceBtnPrimaryDisabled: {
        backgroundColor: `${T.violet}40`,
        borderColor: `${T.violet}40`,
    },
    safePlaceBtnTextSecondary: {
        fontSize: 12,
        fontWeight: '800',
        color: T.violet,
        letterSpacing: 0.2,
    },
    safePlaceBtnTextCancel: {
        fontSize: 12,
        fontWeight: '800',
        color: T.danger,
        letterSpacing: 0.2,
    },
    safePlaceBtnTextPrimary: {
        fontSize: 12,
        fontWeight: '800',
        color: T.onPrimary,
        letterSpacing: 0.2,
    },
    safePlaceKeyboardAvoiding: {
        width: '100%',
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
    safePlaceInfoCard: {
        gap: 8,
        backgroundColor: 'rgba(138,56,246,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(138,56,246,0.22)',
        borderRadius: 12,
        padding: 12,
    },
    safePlaceInfoBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: T.violet,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    safePlaceInfoBadgeText: { color: T.onPrimary, fontSize: 11, fontWeight: '800' },
    safePlaceInfoTitle: { color: T.ink, fontSize: 16, fontWeight: '800' },
    safePlaceInfoText: { color: T.ink3, fontSize: 13, lineHeight: 19 },
    safePlaceInfoLocation: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
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


    // ── SOS Marker styles (A/B avatar pins on map) ─────────────────────────
    sosMarkerLabel: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignItems: 'center',
    },
    sosMarkerLabelText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.3,
    },

    // ── SOS Path Info Card (bottom overlay) ───────────────────────────────
    sosInfoCard: {
        position: 'absolute',
        left: 14,
        right: 14,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        zIndex: 240,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    sosConnectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        gap: 6,
    },
    sosConnectorEndpoint: {
        alignItems: 'center',
        width: 68,
    },
    sosConnectorCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 2.5,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        backgroundColor: T.surface,
    },
    sosConnectorCircleA: {
        borderColor: T.violet,
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 6, shadowColor: T.violet },
        }),
    },
    sosConnectorCircleB: {
        borderColor: T.danger,
        ...Platform.select({
            ios: { shadowColor: T.danger, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
            android: { elevation: 6, shadowColor: T.danger },
        }),
    },
    sosConnectorAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
    },
    sosConnectorPointLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: T.violet,
        letterSpacing: 0.5,
        marginBottom: 1,
    },
    sosConnectorLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: T.ink,
        textAlign: 'center',
    },
    sosConnectorSub: {
        fontSize: 10,
        fontWeight: '500',
        color: T.ink3,
        marginTop: 1,
        textAlign: 'center',
    },
    sosConnectorMiddle: {
        flex: 1,
        alignItems: 'center',
        gap: 5,
    },
    sosConnectorLineWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: 2,
    },
    sosConnectorLineDash: {
        flex: 1,
        height: 1.5,
        backgroundColor: `${T.danger}60`,
        borderRadius: 1,
    },
    sosConnectorDistChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: `${T.violet}18`,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
    },
    sosConnectorDistText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.violet,
    },
    sosConnectorEta: {
        fontSize: 10,
        fontWeight: '600',
        color: T.ink3,
    },
    sosInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        gap: 10,
    },
    sosInfoDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    sosInfoName: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink,
    },
    sosInfoLocation: {
        fontSize: 11,
        fontWeight: '500',
        color: T.ink3,
        marginTop: 1,
    },
    sosRoutePill: {
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: `${T.violet}18`,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
        minWidth: 60,
    },
    sosRoutePillText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.violet,
    },
    sosRoutePillSub: {
        fontSize: 9,
        fontWeight: '600',
        color: T.ink3,
        marginTop: 1,
    },
});

const styles = StyleSheet.create({
    sheetMainBtn: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        marginBottom: 12,
    },
    btnResolve: {
        backgroundColor: 'rgba(138, 56, 246, 0.12)',
        borderColor: 'rgba(138, 56, 246, 0.35)',
    },
    btnCancel: {
        backgroundColor: 'rgba(217, 45, 32, 0.1)',
        borderColor: 'rgba(217, 45, 32, 0.35)',
    },
    btnTextResolved: {
        fontSize: 14,
        fontWeight: '900',
        color: '#A78BFA',
        letterSpacing: 0.5,
    },
    btnTextCancel: {
        fontSize: 14,
        fontWeight: '900',
        color: '#D92D20',
        letterSpacing: 0.5,
    },
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
    warningBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(226, 91, 58, 0.15)',
        paddingHorizontal: S.s4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(226, 91, 58, 0.25)',
    },
    warningBadgeText: { fontSize: 11, fontWeight: '700', color: '#E25B3A', letterSpacing: 0.3 },
    cardBody: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: S.s4, paddingBottom: S.s2, gap: S.s3 },
    iconWrap: { width: 44, height: 44, borderRadius: R.sm, backgroundColor: T.violetDim, borderWidth: 1, borderColor: `${T.violet}35`, alignItems: 'center', justifyContent: 'center' },
    textWrap: { flex: 1 },
    instrText: { fontSize: 14, fontWeight: '700', color: T.ink, letterSpacing: -0.2, lineHeight: 20 },
    distText: { fontSize: 12, fontWeight: '600', color: T.ink3, marginTop: 2 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.s4, paddingBottom: S.s3, paddingTop: S.s2 },
    stepCounter: { fontSize: 11, fontWeight: '600', color: T.ink4, letterSpacing: 0.4 },
    navBtn: { width: 32, height: 32, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    safePathBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 32, borderRadius: R.pill, backgroundColor: '#E25B3A', borderWidth: 1, borderColor: 'rgba(226,91,58,0.6)' },
    safePathBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.3 },
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

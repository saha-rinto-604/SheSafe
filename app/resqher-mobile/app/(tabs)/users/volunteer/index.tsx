/**
 * app/(tabs)/users/volunteer/index.tsx
 * Volunteer Home — Map view with animated search header, location card, and nav bar.
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
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { G } from '../../../../src/constants/gradients';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import SafePlaceButton from '../../../../components/SafePlaceButton';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import { DHAKA_INCIDENTS, type PlaceIncident } from '../../../../src/data/dhakaIncidents';

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

// ── Red Zones (No-Go Areas) ─────────────────────────────────────────────────
const RED_ZONES: { id: string; name: string; latitude: number; longitude: number; radius: number }[] = [
    { id: 'rz1', name: 'Pragati Sarani Area', latitude: 23.813546, longitude: 90.421659, radius: 100 },
    { id: 'rz2', name: 'Kawran Bazar', latitude: 23.8155, longitude: 90.4255, radius: 100 }
];

type SosRequest = {
    id: string;
    victimName: string;
    avatarUri: string;
    distanceKm: number;
    locationLabel: string;
    latitude: number;
    longitude: number;
};

const MOCK_SOS_REQUESTS: SosRequest[] = [
    {
        id: 'sos-101',
        victimName: 'Ayesha Rahman',
        avatarUri: 'https://i.pravatar.cc/150?img=47&u=sos-101',
        distanceKm: 0.8,
        locationLabel: 'United International University, Dhaka',
        latitude: 23.7924,
        longitude: 90.4072,
    },
    {
        id: 'sos-102',
        victimName: 'Nusrat Jahan',
        avatarUri: 'https://i.pravatar.cc/150?img=32&u=sos-102',
        distanceKm: 1.6,
        locationLabel: 'Banani 11, Dhaka',
        latitude: 23.7909,
        longitude: 90.4043,
    },
    {
        id: 'sos-103',
        victimName: 'Raisa Islam',
        avatarUri: 'https://i.pravatar.cc/150?img=15&u=sos-103',
        distanceKm: 2.3,
        locationLabel: 'Dhanmondi 27, Dhaka',
        latitude: 23.7467,
        longitude: 90.3746,
    },
    {
        id: 'sos-104',
        victimName: 'Farhana Akter',
        avatarUri: 'https://i.pravatar.cc/150?img=28&u=sos-104',
        distanceKm: 3.1,
        locationLabel: 'Mohakhali DOHS, Dhaka',
        latitude: 23.7816,
        longitude: 90.3981,
    },
    {
        id: 'sos-105',
        victimName: 'Maliha Noor',
        avatarUri: 'https://i.pravatar.cc/150?img=23&u=sos-105',
        distanceKm: 4.2,
        locationLabel: 'Bashundhara R/A, Dhaka',
        latitude: 23.8202,
        longitude: 90.4370,
    },
    {
        id: 'sos-106',
        victimName: 'Shahira Kabir',
        avatarUri: 'https://i.pravatar.cc/150?img=12&u=sos-106',
        distanceKm: 5.0,
        locationLabel: 'Mirpur 10, Dhaka',
        latitude: 23.8069,
        longitude: 90.3686,
    },
    {
        id: 'sos-107',
        victimName: 'Tahmina Khan',
        avatarUri: 'https://i.pravatar.cc/150?img=9&u=sos-107',
        distanceKm: 6.4,
        locationLabel: 'Uttara Sector 7, Dhaka',
        latitude: 23.8729,
        longitude: 90.3921,
    },
    {
        id: 'sos-108',
        victimName: 'Sumaiya Hossain',
        avatarUri: 'https://i.pravatar.cc/150?img=5&u=sos-108',
        distanceKm: 7.2,
        locationLabel: 'Tejgaon Industrial Area, Dhaka',
        latitude: 23.7635,
        longitude: 90.4000,
    },
    {
        id: 'sos-109',
        victimName: 'Nargis Sultana',
        avatarUri: 'https://i.pravatar.cc/150?img=17&u=sos-109',
        distanceKm: 8.1,
        locationLabel: 'Shahbagh, Dhaka',
        latitude: 23.7380,
        longitude: 90.3951,
    },
    {
        id: 'sos-110',
        victimName: 'Rumana Yasmin',
        avatarUri: 'https://i.pravatar.cc/150?img=44&u=sos-110',
        distanceKm: 9.0,
        locationLabel: 'Keraniganj, Dhaka',
        latitude: 23.6902,
        longitude: 90.3654,
    },
];

const SAFE_PLACE_LOCATION = { latitude: 23.7924, longitude: 90.4072, name: 'United International University' };
const NOTUNBAZAR_LOC = { latitude: 23.8067, longitude: 90.4199 };

const EARTH_RADIUS_M = 6_371_000;

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

function checkRouteSafety(coordinates: LatLng[]): { isSafe: boolean; blockedZoneName?: string } {
    if (coordinates.length === 0) return { isSafe: true };

    // 🛑 Reduced from 20 to 5 for extreme boundary accuracy
    const SEGMENT_CHECK_INTERVAL_M = 5;

    for (let i = 0; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];

        for (const zone of RED_ZONES) {
            if (haversineDistance(p1, zone) <= zone.radius) {
                return { isSafe: false, blockedZoneName: zone.name };
            }
        }

        const dist = haversineDistance(p1, p2);
        if (dist > SEGMENT_CHECK_INTERVAL_M) {
            const steps = Math.ceil(dist / SEGMENT_CHECK_INTERVAL_M);
            for (let j = 1; j < steps; j++) {
                const fraction = j / steps;
                const interpPoint = {
                    latitude: p1.latitude + (p2.latitude - p1.latitude) * fraction,
                    longitude: p1.longitude + (p2.longitude - p1.longitude) * fraction
                };

                for (const zone of RED_ZONES) {
                    if (haversineDistance(interpPoint, zone) <= zone.radius) {
                        return { isSafe: false, blockedZoneName: zone.name };
                    }
                }
            }
        }
    }

    const lastPoint = coordinates[coordinates.length - 1];
    for (const zone of RED_ZONES) {
        if (haversineDistance(lastPoint, zone) <= zone.radius) {
            return { isSafe: false, blockedZoneName: zone.name };
        }
    }

    return { isSafe: true };
}

function getRouteRiskScore(coordinates: LatLng[]): number {
    let score = 0;
    if (coordinates.length === 0) return 0;

    // 🛑 Reduced from 20 to 5
    const SEGMENT_CHECK_INTERVAL_M = 5;

    for (let i = 0; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];

        for (const zone of RED_ZONES) {
            if (haversineDistance(p1, zone) <= zone.radius) score++;
        }

        const dist = haversineDistance(p1, p2);
        if (dist > SEGMENT_CHECK_INTERVAL_M) {
            const steps = Math.ceil(dist / SEGMENT_CHECK_INTERVAL_M);
            for (let j = 1; j < steps; j++) {
                const fraction = j / steps;
                const interpPoint = {
                    latitude: p1.latitude + (p2.latitude - p1.latitude) * fraction,
                    longitude: p1.longitude + (p2.longitude - p1.longitude) * fraction
                };
                for (const zone of RED_ZONES) {
                    if (haversineDistance(interpPoint, zone) <= zone.radius) score++;
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

const NAV_TABS: { id: string; label: string; iconActive: string; iconOutline: string; iconFamily?: 'Ionicons' | 'MaterialCommunityIcons' }[] = [
    { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline', iconFamily: 'Ionicons' },
    { id: 'Messages', label: 'Messages', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline', iconFamily: 'Ionicons' },
    { id: 'Incidents', label: 'Incidents', iconActive: 'clipboard-clock', iconOutline: 'clipboard-clock-outline', iconFamily: 'MaterialCommunityIcons' },
    { id: 'Activity', label: 'Activity', iconActive: 'time', iconOutline: 'time-outline', iconFamily: 'Ionicons' },
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

type LatLng = { latitude: number; longitude: number };
type PlacePrediction = { id: string; name: string; address: string; placeId: string; };
type PlaceSuggestion = { id: string; name: string; address: string; latitude: number; longitude: number; placeId?: string; };

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

const SafetyScanOverlay = memo(function SafetyScanOverlay({
    visible, spinAnim, r0, r1, r2, zoneName,
}: {
    visible: boolean; spinAnim: RNAnimated.Value; r0: RNAnimated.Value; r1: RNAnimated.Value; r2: RNAnimated.Value; zoneName?: string | null;
}) {
    if (!visible) return null;
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <View style={scanStyles.overlay} pointerEvents="none">
            <View style={scanStyles.card}>
                <View style={scanStyles.iconWrap}>
                    <RNAnimated.View style={[scanStyles.ring, { transform: [{ scale: r0 }, { rotate: spin }] }]} />
                    <RNAnimated.View style={[scanStyles.ring, { transform: [{ scale: r1 }, { rotate: spin }] }]} />
                    <RNAnimated.View style={[scanStyles.ring, { transform: [{ scale: r2 }, { rotate: spin }] }]} />
                    <View style={scanStyles.core}>
                        <Ionicons name="shield-checkmark" size={18} color={T.onPrimary} />
                    </View>
                </View>
                <Text style={scanStyles.title}>Safety Scan Running</Text>
                <Text style={scanStyles.subtitle}>
                    {zoneName ? `Checking safe route around ${zoneName}…` : 'Recalculating safest possible route…'}
                </Text>
            </View>
        </View>
    );
});

const scanStyles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(8,6,14,0.65)', zIndex: 999 },
    card: { width: width * 0.78, backgroundColor: 'rgba(18,14,30,0.96)', borderRadius: 20, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    iconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: 'rgba(138,56,246,0.45)' },
    core: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.violet, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
    title: { fontSize: 14, fontWeight: '800', color: T.ink, letterSpacing: -0.2 },
    subtitle: { marginTop: 6, fontSize: 12, fontWeight: '500', color: T.ink3, textAlign: 'center' },
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
        RNAnimated.spring(slideX, { toValue: visible ? 0 : -width * 0.76, useNativeDriver: true, tension: 62, friction: 13 }).start();
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
    drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.76, backgroundColor: T.surface, ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 28, shadowOffset: { width: 4, height: 0 } }, android: { elevation: 20 } }) },
    hd: { paddingTop: 52, paddingBottom: 26, paddingHorizontal: 20 },
    avatarRing: { width: 50, height: 50, borderRadius: 25, backgroundColor: `${T.onPrimary}2E`, borderWidth: 2, borderColor: `${T.onPrimary}47`, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    appName: { color: T.onPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
    sub: { color: `${T.onPrimary}A6`, fontSize: 12, marginTop: 2, fontWeight: '500' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.lineMid },
    iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    iconBoxDanger: { backgroundColor: `${T.danger}18` },
    label: { flex: 1, fontSize: 14, color: T.ink, fontWeight: '600' },
    labelDanger: { color: T.danger },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.lineMid, marginHorizontal: 18, marginVertical: 6 },
});

const NavTab = memo(function NavTab({ tab, isActive, onPress }: { tab: typeof NAV_TABS[number]; isActive: boolean; onPress: () => void }) {
    const scale = useRef(new RNAnimated.Value(1)).current;
    const handlePress = useCallback(() => {
        RNAnimated.sequence([
            RNAnimated.timing(scale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
            RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 14 }),
        ]).start();
        onPress();
    }, [onPress]);

    const Icon = tab.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;

    return (
        <TouchableOpacity style={s.navTab} onPress={handlePress} activeOpacity={1} accessibilityRole="tab" accessibilityState={{ selected: isActive }} accessibilityLabel={tab.label}>
            <RNAnimated.View style={[s.navTabInner, { transform: [{ scale }] }]}>
                <View style={[s.navIconBox, isActive && s.navIconBoxActive]}>
                    <Icon name={(isActive ? tab.iconActive : tab.iconOutline) as any} size={20} color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR} />
                </View>
                <View style={[s.navUnderline, { backgroundColor: isActive ? ACTIVE_COLOR : 'transparent' }]} />
            </RNAnimated.View>
        </TouchableOpacity>
    );
});

const HoldSosButton = memo(function HoldSosButton({ onTrigger, onPhaseChange }: { onTrigger: () => void; onPhaseChange?: (phase: 'idle' | 'holding' | 'armed') => void; }) {
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
        holdRef.current = RNAnimated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false });
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
            <RNAnimated.View style={[StyleSheet.absoluteFillObject, { width: ARC_SIZE, height: ARC_SIZE, left: -(ARC_SIZE - SOS_BTN_SIZE) / 2, top: -(ARC_SIZE - SOS_BTN_SIZE) / 2, opacity: arcOp }]} pointerEvents="none">
                <View style={hs.arcTrack} />
                <View style={[hs.halfClip, hs.rightClip]}><RNAnimated.View style={[hs.halfFill, hs.rightFill, { transform: [{ rotate: rightRot }] }]} /></View>
                <View style={[hs.halfClip, hs.leftClip]}><RNAnimated.View style={[hs.halfFill, hs.leftFill, { transform: [{ rotate: leftRot }] }]} /></View>
            </RNAnimated.View>
            <TouchableOpacity onPressIn={startHold} onPressOut={endHold} activeOpacity={1}>
                <LinearGradient colors={G.sosIdle.colors} start={G.sosIdle.start} end={G.sosIdle.end} style={s.sosBtn}>
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

export default function VolunteerHome() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const searchInputRef = useRef<TextInput>(null);
    const startInputRef = useRef<TextInput>(null);

    // 🛑 Request ID to kill ghost fetches
    const routeRequestId = useRef(0);

    const [locationStatus, setLocationStatus] = useState<'idle' | 'ready' | 'sharing'>('idle');
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
    const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'motorcycle' | 'transit'>('driving');
    const [isLiveNav, setIsLiveNav] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [address, setAddress] = useState('');
    const [searchActive, setSearchActive] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showLocationCard, setShowLocationCard] = useState(false);
    const [sosPanelOpen, setSosPanelOpen] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
    const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
    const [placeIncidents, setPlaceIncidents] = useState<PlaceIncident[]>([]);
    const [placeSheetOpen, setPlaceSheetOpen] = useState(false);
    const [placeSheetMode, setPlaceSheetMode] = useState<'incidents' | 'add_safe_place'>('incidents');
    const [safePlaceAnswer, setSafePlaceAnswer] = useState('');
    const [safePlaceError, setSafePlaceError] = useState<string | null>(null);
    const [safePlaceSubmitState, setSafePlaceSubmitState] = useState<'idle' | 'success'>('idle');
    const [showSOS, setShowSOS] = useState(false);
    const [holdPhase, setHoldPhase] = useState<'idle' | 'holding' | 'armed'>('idle');
    const [sosActive, setSosActive] = useState(false);
    const [cancelCountdown, setCancelCountdown] = useState(CANCEL_DURATION_DEFAULT);
    const [isEmergencyLive, setIsEmergencyLive] = useState(false);
    const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const safePlaceSuccessAnim = useRef(new RNAnimated.Value(0)).current;
    const safePlaceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const [isScanAnimating, setIsScanAnimating] = useState(false);
    const [unsafeRouteCoords, setUnsafeRouteCoords] = useState<LatLng[]>([]);
    const [safeRouteCoords, setSafeRouteCoords] = useState<LatLng[]>([]);
    const [showSafePlace, setShowSafePlace] = useState(false);
    const [safePlaceCoords, setSafePlaceCoords] = useState<LatLng[]>([]);
    const [safePlaceDistance, setSafePlaceDistance] = useState<number | null>(null);
    const [safePlaceLoading, setSafePlaceLoading] = useState(false);
    const [activeSosView, setActiveSosView] = useState<SosRequest | null>(null);
    const [sosPathCoords, setSosPathCoords] = useState<LatLng[]>([]);
    const [sosRouteDistance, setSosRouteDistance] = useState<string>('');
    const [sosRouteDuration, setSosRouteDuration] = useState<string>('');
    const [drawerOpen, setDrawerOpen] = useState(false);

    const locationSubRef = useRef<Location.LocationSubscription | null>(null);

    useFocusEffect(useCallback(() => { getUserProfile().then(setProfile); }, []));

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
    const pulseAnim0 = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim0Op = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim1 = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim1Op = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim2 = useRef(new RNAnimated.Value(0)).current;
    const pulseAnim2Op = useRef(new RNAnimated.Value(0)).current;
    const pulseAnims = [{ scale: pulseAnim0, op: pulseAnim0Op }, { scale: pulseAnim1, op: pulseAnim1Op }, { scale: pulseAnim2, op: pulseAnim2Op }];

    const triggerSOS = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setHoldPhase('idle'); setSosActive(true); setLocationStatus('sharing'); setCancelCountdown(CANCEL_DURATION_DEFAULT);
    }, []);

    const cancelSOS = useCallback(() => {
        setSosActive(false); setCancelCountdown(0); setLocationStatus('ready'); setHoldPhase('idle'); setIsEmergencyLive(false);
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    }, []);

    const confirmStop = useCallback(() => {
        Alert.alert('Stop Emergency Alert?', 'Your location will no longer be shared.', [
            { text: 'Keep Active', style: 'cancel' },
            { text: 'Stop Alert', style: 'destructive', onPress: cancelSOS },
        ]);
    }, [cancelSOS]);

    useEffect(() => {
        if (!sosActive || cancelCountdown <= 0) return;
        cancelTimerRef.current = setInterval(() => {
            setCancelCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(cancelTimerRef.current!);
                    setIsEmergencyLive(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (cancelTimerRef.current) clearInterval(cancelTimerRef.current); };
    }, [sosActive, cancelCountdown === CANCEL_DURATION_DEFAULT]);

    useEffect(() => {
        pulseAnims.forEach(({ scale, op }, i) => {
            const loop = () => {
                scale.setValue(1); op.setValue(0.55);
                RNAnimated.parallel([
                    RNAnimated.timing(scale, { toValue: 1.6, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    RNAnimated.timing(op, { toValue: 0, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                ]).start(() => loop());
            };
            setTimeout(loop, i * 700);
        });
    }, []);

    const navBottom = Math.max(insets.bottom, 0) + NAV_BOT_OFFSET;

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

            locationSubRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
                (loc) => { setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, heading: loc.coords.heading ?? undefined }); }
            );
        })();
        return () => { if (locationSubRef.current) locationSubRef.current.remove(); };
    }, []);

    useEffect(() => {
        if (!directionsMode || !userLoc || !isLiveNav) return;
        mapRef.current?.animateCamera({ center: { latitude: userLoc.latitude, longitude: userLoc.longitude }, pitch: 45, heading: userLoc.heading ?? 0, zoom: 19 }, { duration: 1000 });
        if (navInstructions.length > 0 && currentStepIdx < navInstructions.length - 1) {
            const currentStep = navInstructions[currentStepIdx];
            if (currentStep.endLocation && haversineDistance(userLoc, currentStep.endLocation) <= 25) {
                setCurrentStepIdx(prev => prev + 1);
            }
        }
    }, [userLoc, directionsMode, navInstructions, currentStepIdx, isLiveNav]);

    useEffect(() => {
        if (isLiveNav && audioEnabled && navInstructions.length > 0 && currentStepIdx < navInstructions.length) {
            Speech.speak(navInstructions[currentStepIdx].instruction);
        }
    }, [isLiveNav, audioEnabled, currentStepIdx, navInstructions]);

    const activateSearch = useCallback(() => {
        if (searchActive) return;
        setSearchActive(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
        RNAnimated.timing(searchProgress, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }, [searchActive, searchProgress]);

    const deactivateSearch = useCallback((clearText: boolean) => {
        Keyboard.dismiss(); setSearchActive(false);
        if (clearText) setSearchText('');
        RNAnimated.timing(searchProgress, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }, [searchProgress]);

    const resetExploreState = useCallback(() => {
        deactivateSearch(true);
        setSearchSuggestions([]); setSearchStatus(null); searchSessionTokenRef.current = null; searchRequestIdRef.current = 0;
        setStartSearchActive(false); setStartSearchText(''); setStartSuggestions([]); setStartStatus(null); startSessionTokenRef.current = null; startRequestIdRef.current = 0;
        if (placeSheetOpen) closePlaceSheet();
        if (showLocationCard) closeLocationCard();
        setSelectedPlace(null); setPlaceIncidents([]); setEndLocation(null);

        if (directionsMode) { exitDirectionsMode(); } else {
            setRouteCoords([]); setNavInstructions([]); setCurrentStepIdx(0); setRouteUnsafe(false); setBlockedZoneName(null); setShowSafePath(false); setIsScanAnimating(false); setSafeRouteCoords([]); setUnsafeRouteCoords([]);
        }

        if (userLoc) mapRef.current?.animateToRegion({ latitude: userLoc.latitude, longitude: userLoc.longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 700);
        else mapRef.current?.animateToRegion(DEFAULT_REGION, 700);
    }, [closeLocationCard, closePlaceSheet, deactivateSearch, directionsMode, exitDirectionsMode, placeSheetOpen, showLocationCard, userLoc]);

    const query = searchText.trim();
    const startQuery = startSearchText.trim();

    const fetchAutocomplete = useCallback(async (input: string, sessionToken: string, bias: LatLng) => {
        if (!GOOGLE_MAPS_API_KEY) return { results: [] as PlacePrediction[], status: 'MISSING_KEY' };
        try {
            const res = await fetch(buildAutocompleteUrl(input, sessionToken, bias));
            const data = await res.json();
            if (data?.status !== 'OK') return { results: [] as PlacePrediction[], status: data?.status ?? 'ERROR' };
            return {
                results: (data.predictions ?? []).map((p: any) => ({ id: p.place_id, placeId: p.place_id, name: p.structured_formatting?.main_text ?? p.description, address: p.structured_formatting?.secondary_text ?? p.description })),
                status: 'OK',
            };
        } catch { return { results: [] as PlacePrediction[], status: 'ERROR' }; }
    }, []);

    const resolvePlaceDetails = useCallback(async (prediction: PlacePrediction, sessionToken: string) => {
        if (!GOOGLE_MAPS_API_KEY) return null as PlaceSuggestion | null;
        try {
            const res = await fetch(buildPlaceDetailsUrl(prediction.placeId, sessionToken));
            const data = await res.json();
            if (data?.status !== 'OK') return null;
            const loc = data.result?.geometry?.location;
            if (!loc) return null;
            return { id: prediction.placeId, placeId: prediction.placeId, name: data.result?.name ?? prediction.name, address: data.result?.formatted_address ?? prediction.address, latitude: loc.lat, longitude: loc.lng };
        } catch { return null; }
    }, []);

    useEffect(() => {
        if (!searchActive) return;
        if (query.length < 1) { setSearchSuggestions([]); setSearchStatus(null); searchSessionTokenRef.current = null; return; }
        const requestId = ++searchRequestIdRef.current;
        if (!searchSessionTokenRef.current) searchSessionTokenRef.current = createSessionToken();
        const token = searchSessionTokenRef.current;
        const bias = userLoc ?? DEFAULT_REGION;
        const handle = setTimeout(async () => {
            const { results, status } = await fetchAutocomplete(query, token, bias);
            if (searchRequestIdRef.current === requestId) { setSearchSuggestions(results); setSearchStatus(status); }
        }, AUTOCOMPLETE_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [fetchAutocomplete, query, searchActive, userLoc]);

    useEffect(() => {
        if (!startSearchActive) return;
        if (startQuery.length < 1) { setStartSuggestions([]); setStartStatus(null); startSessionTokenRef.current = null; return; }
        const requestId = ++startRequestIdRef.current;
        if (!startSessionTokenRef.current) startSessionTokenRef.current = createSessionToken();
        const token = startSessionTokenRef.current;
        const bias = userLoc ?? DEFAULT_REGION;
        const handle = setTimeout(async () => {
            const { results, status } = await fetchAutocomplete(startQuery, token, bias);
            if (startRequestIdRef.current === requestId) { setStartSuggestions(results); setStartStatus(status); }
        }, AUTOCOMPLETE_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [fetchAutocomplete, startQuery, startSearchActive, userLoc]);

    useEffect(() => {
        const buildRoute = async () => {
            if (!startLocation || !endLocation) return;

            const fetchId = ++routeRequestId.current;

            // ── THE ERASER ───────────────────────────────────────────────────
            setRouteCoords([]);
            setRouteUnsafe(false);
            setBlockedZoneName(null);
            setShowSafePath(false);
            setSafeRouteCoords([]);
            setUnsafeRouteCoords([]);
            setIsScanAnimating(false);

            if (!GOOGLE_MAPS_API_KEY) {
                setRouteCoords([{ latitude: startLocation.latitude, longitude: startLocation.longitude }, { latitude: endLocation.latitude, longitude: endLocation.longitude }]);
                return;
            }

            const origin = `${startLocation.latitude},${startLocation.longitude}`;
            const destination = `${endLocation.latitude},${endLocation.longitude}`;
            const apiMode = travelMode === 'motorcycle' ? 'two_wheeler' : travelMode;
            const baseUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${apiMode}&alternatives=true&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;

            try {
                const res = await fetch(baseUrl);
                const data = await res.json();

                if (fetchId !== routeRequestId.current) return;

                if (!data?.routes?.length) { Alert.alert('Route error', 'No route found between these locations.'); return; }

                const chosenRoute = data.routes[0];
                const chosenCoords = decodePolyline(chosenRoute.overview_polyline?.points ?? '');

                setRouteCoords(chosenCoords);
                setUnsafeRouteCoords(chosenCoords);

                const steps = chosenRoute?.legs?.[0]?.steps ?? [];
                const instructions: NavStep[] = steps.map((step: any) => ({
                    instruction: stripHtml(step.html_instructions ?? ''), distance: step.distance?.text ?? '', maneuver: step.maneuver,
                    endLocation: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : undefined,
                }));
                setNavInstructions(instructions);
                setCurrentStepIdx(0);

                const safetyCheck = checkRouteSafety(chosenCoords);
                if (!safetyCheck.isSafe) {
                    setRouteUnsafe(true); setBlockedZoneName(safetyCheck.blockedZoneName ?? null); setShowSafePath(true);
                } else {
                    setRouteUnsafe(false); setBlockedZoneName(null); setShowSafePath(false);
                }

                if (chosenCoords.length > 1) {
                    mapRef.current?.fitToCoordinates(chosenCoords, { edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 }, animated: true });
                }
            } catch {
                if (fetchId !== routeRequestId.current) return;
                setRouteCoords([{ latitude: startLocation.latitude, longitude: startLocation.longitude }, { latitude: endLocation.latitude, longitude: endLocation.longitude }]);
                setNavInstructions([]);
            }
        };

        if (directionsMode) buildRoute();
    }, [directionsMode, endLocation, startLocation, travelMode]);

    useEffect(() => {
        let aborted = false;

        const fetchSafePlaceRoute = async () => {
            if (!showSafePlace) {
                setSafePlaceCoords([]); setSafePlaceDistance(null); setSafePlaceLoading(false); return;
            }

            setSafePlaceLoading(true);

            try {
                if (!GOOGLE_MAPS_API_KEY) {
                    const coords = [{ latitude: NOTUNBAZAR_LOC.latitude, longitude: NOTUNBAZAR_LOC.longitude }, { latitude: SAFE_PLACE_LOCATION.latitude, longitude: SAFE_PLACE_LOCATION.longitude }];
                    if (!aborted) { setSafePlaceCoords(coords); setSafePlaceDistance(haversineDistance(NOTUNBAZAR_LOC, SAFE_PLACE_LOCATION) / 1000); mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 }, animated: true }); }
                } else {
                    const origin = `${NOTUNBAZAR_LOC.latitude},${NOTUNBAZAR_LOC.longitude}`;
                    const destination = `${SAFE_PLACE_LOCATION.latitude},${SAFE_PLACE_LOCATION.longitude}`;
                    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=walking&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (!data?.routes?.length) {
                        if (!aborted) {
                            const coords = [{ latitude: NOTUNBAZAR_LOC.latitude, longitude: NOTUNBAZAR_LOC.longitude }, { latitude: SAFE_PLACE_LOCATION.latitude, longitude: SAFE_PLACE_LOCATION.longitude }];
                            setSafePlaceCoords(coords); setSafePlaceDistance(haversineDistance(NOTUNBAZAR_LOC, SAFE_PLACE_LOCATION) / 1000); mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 }, animated: true });
                        }
                    } else {
                        const chosen = data.routes[0];
                        const coords = decodePolyline(chosen.overview_polyline?.points ?? '');
                        if (!aborted) {
                            setSafePlaceCoords(coords.length ? coords : [{ latitude: NOTUNBAZAR_LOC.latitude, longitude: NOTUNBAZAR_LOC.longitude }, { latitude: SAFE_PLACE_LOCATION.latitude, longitude: SAFE_PLACE_LOCATION.longitude }]);
                            const leg = chosen?.legs?.[0];
                            const distKm = leg?.distance?.value ? leg.distance.value / 1000 : haversineDistance(NOTUNBAZAR_LOC, SAFE_PLACE_LOCATION) / 1000;
                            setSafePlaceDistance(distKm);
                            if (coords.length > 1) { mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 }, animated: true }); }
                        }
                    }
                }
            } catch (err) {
                if (!aborted) {
                    const coords = [{ latitude: NOTUNBAZAR_LOC.latitude, longitude: NOTUNBAZAR_LOC.longitude }, { latitude: SAFE_PLACE_LOCATION.latitude, longitude: SAFE_PLACE_LOCATION.longitude }];
                    setSafePlaceCoords(coords); setSafePlaceDistance(haversineDistance(NOTUNBAZAR_LOC, SAFE_PLACE_LOCATION) / 1000);
                }
            } finally {
                if (!aborted) setSafePlaceLoading(false);
            }
        };

        fetchSafePlaceRoute();
        return () => { aborted = true; };
    }, [showSafePlace]);

    const startScanAnimation = useCallback(() => {
        const radarAnims = [radarAnim0, radarAnim1, radarAnim2];
        radarAnims.forEach((a, i) => {
            const loop = () => {
                a.setValue(0);
                RNAnimated.timing(a, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true, delay: i * 660 }).start(() => loop());
            };
            loop();
        });
        const spinLoop = () => {
            scanAnim.setValue(0);
            RNAnimated.timing(scanAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }).start(() => spinLoop());
        };
        spinLoop();
    }, [radarAnim0, radarAnim1, radarAnim2, scanAnim]);

    const stopScanAnimation = useCallback(() => {
        [radarAnim0, radarAnim1, radarAnim2, scanAnim].forEach(a => a.stopAnimation());
    }, [radarAnim0, radarAnim1, radarAnim2, scanAnim]);

    const triggerSafetyRecalculation = useCallback(async () => {
        if (!startLocation || !endLocation || !GOOGLE_MAPS_API_KEY) return;

        const fetchId = routeRequestId.current;

        setIsScanAnimating(true);
        setShowSafePath(false);
        startScanAnimation();

        await new Promise(r => setTimeout(r, 1800));

        if (fetchId !== routeRequestId.current) return;

        const origin = `${startLocation.latitude},${startLocation.longitude}`;
        const destination = `${endLocation.latitude},${endLocation.longitude}`;
        const apiMode = travelMode === 'motorcycle' ? 'two_wheeler' : travelMode;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${apiMode}&alternatives=true&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (fetchId !== routeRequestId.current) return;

            if (!data?.routes?.length) {
                stopScanAnimation(); setIsScanAnimating(false);
                Alert.alert('No safe route found', 'All available routes pass through restricted zones.');
                return;
            }

            let bestRoute: { route: any; coords: LatLng[]; score: number } | null = null;
            let bestScore = Infinity;

            for (const route of data.routes) {
                const coords = decodePolyline(route.overview_polyline?.points ?? '');
                const score = getRouteRiskScore(coords);

                if (score < bestScore) {
                    bestScore = score; bestRoute = { route, coords, score };
                }
            }

            if (bestScore > 0) {
                if (travelMode === 'transit') {
                    stopScanAnimation(); setIsScanAnimating(false);
                    Alert.alert('🚍 Fixed Transit Lines', 'Public transit follows fixed routes and cannot be detoured around this Red Zone. Please switch to Driving, Walking, or Bike mode to calculate a custom safe path.');
                    if (bestRoute) { setSafeRouteCoords(bestRoute.coords); setRouteCoords(bestRoute.coords); }
                    setRouteUnsafe(true);
                    return;
                }

                if (bestRoute) {
                    const firstBadPoint = bestRoute.coords.find(p => RED_ZONES.some(z => haversineDistance(p, z) <= z.radius));
                    if (firstBadPoint) {
                        const matchedZone = RED_ZONES.find(z => haversineDistance(firstBadPoint, z) <= z.radius);
                        if (matchedZone) {
                            const directions = [{ lat: 0, lng: 1 }, { lat: 0, lng: -1 }, { lat: 1, lng: 0 }, { lat: -1, lng: 0 }];
                            let foundPerfectDetour = false;
                            const pushDistanceMeters = matchedZone.radius * 3;

                            for (const dir of directions) {
                                if (foundPerfectDetour) break;
                                const wpLat = matchedZone.latitude + (dir.lat * pushDistanceMeters) / 111320;
                                const wpLng = matchedZone.longitude + (dir.lng * pushDistanceMeters) / (111320 * Math.cos(matchedZone.latitude * (Math.PI / 180)));
                                const wpUrl = `${url}&waypoints=via:${wpLat},${wpLng}`;

                                try {
                                    const wpRes = await fetch(wpUrl);
                                    const wpData = await wpRes.json();
                                    if (fetchId !== routeRequestId.current) return;

                                    if (wpData?.routes?.length) {
                                        const wpRoute = wpData.routes[0];
                                        const wpCoords = decodePolyline(wpRoute.overview_polyline?.points ?? '');
                                        const wpScore = getRouteRiskScore(wpCoords);

                                        if (wpScore === 0) {
                                            bestRoute = { route: wpRoute, coords: wpCoords, score: wpScore }; bestScore = wpScore; foundPerfectDetour = true;
                                        } else if (wpScore < bestScore) {
                                            bestRoute = { route: wpRoute, coords: wpCoords, score: wpScore }; bestScore = wpScore;
                                        }
                                    }
                                } catch (error) { console.log(`Waypoint fallback failed`, error); }
                            }
                        }
                    }
                }
            }

            if (!bestRoute) { stopScanAnimation(); setIsScanAnimating(false); return; }

            const finalCoords = bestRoute.coords;
            const steps = bestRoute.route?.legs?.[0]?.steps ?? [];
            const instructions: NavStep[] = steps.map((step: any) => ({
                instruction: stripHtml(step.html_instructions ?? ''), distance: step.distance?.text ?? '', maneuver: step.maneuver, endLocation: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : undefined,
            }));

            setSafeRouteCoords(finalCoords);
            setRouteCoords(finalCoords);
            setNavInstructions(instructions);
            setCurrentStepIdx(0);
            setRouteUnsafe(bestScore > 0);
            setShowSafePath(false);
            stopScanAnimation();
            setIsScanAnimating(false);

            mapRef.current?.fitToCoordinates(finalCoords, { edgePadding: { top: 120, right: 40, bottom: height * 0.45, left: 40 }, animated: true });

            if (bestScore === 0) Speech.speak('Safety update: Safest route selected, avoiding high risk areas.');
            else Alert.alert('⚠️ Partial safety', 'No fully safe route found. Showing the least risky option.');

        } catch {
            stopScanAnimation(); setIsScanAnimating(false);
            Alert.alert('Error', 'Failed to calculate safe route.');
        }
    }, [startLocation, endLocation, travelMode, startScanAnimation, stopScanAnimation]);

    const closeLocationCard = useCallback(() => {
        RNAnimated.parallel([RNAnimated.timing(locationCardY, { toValue: 300, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }), RNAnimated.timing(locationCardOpacity, { toValue: 0, duration: 200, useNativeDriver: true })]).start(() => setShowLocationCard(false));
    }, []);

    const openPlaceSheet = useCallback((place: PlaceSuggestion) => {
        setPlaceSheetOpen(true); setPlaceSheetMode('incidents'); setSafePlaceAnswer(''); setSafePlaceError(null); setSafePlaceSubmitState('idle'); placeSheetY.setValue(height); placeSheetOpacity.setValue(0); placeSheetDragY.setValue(0); setPlaceIncidents(DHAKA_INCIDENTS[place.id] ?? []);
        RNAnimated.parallel([RNAnimated.spring(placeSheetY, { toValue: height * 0.5, useNativeDriver: true, tension: 70, friction: 12 }), RNAnimated.timing(placeSheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true })]).start();
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

    const closePlaceSheet = useCallback(() => {
        RNAnimated.parallel([RNAnimated.timing(placeSheetY, { toValue: height, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: true }), RNAnimated.timing(placeSheetOpacity, { toValue: 0, duration: 180, useNativeDriver: true })]).start(() => setPlaceSheetOpen(false));
        placeSheetDragY.setValue(0); setPlaceSheetMode('incidents'); setSafePlaceAnswer(''); setSafePlaceError(null); setSafePlaceSubmitState('idle');
        if (safePlaceTimeoutRef.current) { clearTimeout(safePlaceTimeoutRef.current); safePlaceTimeoutRef.current = null; }
    }, [placeSheetDragY, placeSheetOpacity, placeSheetY]);

    const handleResolvedPlaceSelect = useCallback((place: PlaceSuggestion) => {
        setSelectedPlace(place); setSearchText(place.name);
        setRecentPlaces(prev => [place, ...prev.filter(item => item.id !== place.id)].slice(0, 6));
        deactivateSearch(false);
        if (showLocationCard) closeLocationCard();
        mapRef.current?.animateToRegion({ latitude: place.latitude - 0.003, longitude: place.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 700);
        openPlaceSheet(place);
    }, [closeLocationCard, deactivateSearch, openPlaceSheet, showLocationCard]);

    const handlePlaceSelect = useCallback(async (prediction: PlacePrediction) => {
        if (!GOOGLE_MAPS_API_KEY) { Alert.alert('Google Places not configured', 'Missing Google Maps API key.'); return; }
        const sessionToken = searchSessionTokenRef.current ?? createSessionToken();
        const place = await resolvePlaceDetails(prediction, sessionToken);
        searchSessionTokenRef.current = null;
        if (!place) { Alert.alert('Place not found', 'Unable to fetch location details.'); return; }
        handleResolvedPlaceSelect(place);
    }, [handleResolvedPlaceSelect, resolvePlaceDetails]);

    const openLocationCard = useCallback(() => {
        if (!userLoc) return;
        if (placeSheetOpen) closePlaceSheet();
        setShowLocationCard(true); locationCardY.setValue(300); locationCardOpacity.setValue(0);
        mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600);
        RNAnimated.parallel([RNAnimated.spring(locationCardY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }), RNAnimated.timing(locationCardOpacity, { toValue: 1, duration: 250, useNativeDriver: true })]).start();
    }, [closePlaceSheet, locationCardOpacity, locationCardY, placeSheetOpen, userLoc]);

    const openSosPanel = useCallback(() => {
        if (showLocationCard) closeLocationCard();
        if (placeSheetOpen) closePlaceSheet();
        setShowSafePlace(false);
        setSosPanelOpen(true);
    }, [closeLocationCard, closePlaceSheet, placeSheetOpen, showLocationCard]);

    const closeSosPanel = useCallback(() => {
        setSosPanelOpen(false); setActiveSosView(null); setSosPathCoords([]); setSosRouteDistance(''); setSosRouteDuration(''); setSelectedPlace(null);
        if (userLoc) setTimeout(() => { mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600); }, 200);
    }, [userLoc]);

    const exitSosView = useCallback(() => {
        setActiveSosView(null); setSosPathCoords([]); setSosRouteDistance(''); setSosRouteDuration(''); setSosPanelOpen(true);
    }, []);

    const handleSafePlaceToggle = useCallback(() => {
        setShowSafePlace(prev => {
            const willShow = !prev;
            if (prev && !willShow && userLoc) setTimeout(() => { mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600); }, 200);
            return willShow;
        });
    }, [userLoc]);

    const handleViewSos = useCallback(async (req: SosRequest) => {
        const VOLUNTEER_LOC = { latitude: 23.8293, longitude: 90.4182 }; // Khilkhet
        setSosPanelOpen(false);

        if (!GOOGLE_MAPS_API_KEY) {
            const steps = 10;
            const coords: LatLng[] = Array.from({ length: steps + 1 }, (_, i) => ({ latitude: VOLUNTEER_LOC.latitude + (req.latitude - VOLUNTEER_LOC.latitude) * (i / steps), longitude: VOLUNTEER_LOC.longitude + (req.longitude - VOLUNTEER_LOC.longitude) * (i / steps) }));
            setActiveSosView(req); setSosPathCoords(coords); setSosRouteDistance(`${req.distanceKm.toFixed(1)} km`); setSosRouteDuration(`~${Math.round(req.distanceKm / 0.4)} min`);
            mapRef.current?.fitToCoordinates([VOLUNTEER_LOC, { latitude: req.latitude, longitude: req.longitude }], { edgePadding: { top: 140, right: 60, bottom: 280, left: 60 }, animated: true });
            return;
        }

        const origin = `${VOLUNTEER_LOC.latitude},${VOLUNTEER_LOC.longitude}`;
        const destination = `${req.latitude},${req.longitude}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

        try {
            const res = await fetch(url); const data = await res.json();
            if (data?.routes?.length > 0) {
                const points = data.routes[0].overview_polyline.points; const coords = decodePolyline(points); const leg = data.routes[0].legs?.[0];
                setActiveSosView(req); setSosPathCoords(coords); setSosRouteDistance(leg?.distance?.text ?? `${req.distanceKm.toFixed(1)} km`); setSosRouteDuration(leg?.duration?.text ?? '');
                mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 140, right: 60, bottom: 280, left: 60 }, animated: true });
            } else { setSosPanelOpen(true); Alert.alert('Route Error', 'Unable to find a path to the victim.'); }
        } catch (error) { setSosPanelOpen(true); Alert.alert('Network Error', 'Failed to fetch the path visualization.'); }
    }, []);

    const openAddSafePlace = useCallback(() => {
        setPlaceSheetMode('add_safe_place'); setSafePlaceError(null); setSafePlaceSubmitState('idle');
        if (safePlaceTimeoutRef.current) { clearTimeout(safePlaceTimeoutRef.current); safePlaceTimeoutRef.current = null; }
    }, []);

    const cancelAddSafePlace = useCallback(() => {
        setPlaceSheetMode('incidents'); setSafePlaceAnswer(''); setSafePlaceError(null); setSafePlaceSubmitState('idle');
        if (safePlaceTimeoutRef.current) { clearTimeout(safePlaceTimeoutRef.current); safePlaceTimeoutRef.current = null; }
    }, []);

    const submitAddSafePlace = useCallback(() => {
        const trimmed = safePlaceAnswer.trim();
        if (!trimmed) { setSafePlaceError('Answer is required.'); return; }
        setSafePlaceSubmitState('success'); safePlaceSuccessAnim.setValue(0);
        RNAnimated.timing(safePlaceSuccessAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        if (safePlaceTimeoutRef.current) clearTimeout(safePlaceTimeoutRef.current);
        safePlaceTimeoutRef.current = setTimeout(() => {
            setPlaceSheetMode('incidents'); if (selectedPlace) setPlaceIncidents(DHAKA_INCIDENTS[selectedPlace.id] ?? []);
            setSafePlaceAnswer(''); setSafePlaceError(null); setSafePlaceSubmitState('idle'); safePlaceTimeoutRef.current = null;
        }, 5200);
    }, [safePlaceAnswer, selectedPlace, safePlaceSuccessAnim]);

    useEffect(() => { return () => { if (safePlaceTimeoutRef.current) { clearTimeout(safePlaceTimeoutRef.current); safePlaceTimeoutRef.current = null; } }; }, []);

    const enterDirectionsMode = useCallback((destination: PlaceSuggestion) => {
        setDirectionsMode(true); setEndLocation(destination); setRouteCoords([]);
        RNAnimated.timing(directionsProgress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        closePlaceSheet();
    }, [closePlaceSheet, directionsProgress]);

    const exitDirectionsMode = useCallback(() => {
        setDirectionsMode(false); setIsLiveNav(false); setStartSearchActive(false); setStartSearchText(''); setStartLocation(null); setEndLocation(null); setRouteCoords([]); setSafeRouteCoords([]); setUnsafeRouteCoords([]); setNavInstructions([]); setCurrentStepIdx(0); setRouteUnsafe(false); setBlockedZoneName(null); setShowSafePath(false); setIsScanAnimating(false); setSelectedPlace(null); setSearchText(''); setPlaceSheetOpen(false);
        RNAnimated.timing(directionsProgress, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        if (userLoc) setTimeout(() => { mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 600); }, 100);
    }, [directionsProgress, userLoc]);

    const handleStartSelect = useCallback((place: PlaceSuggestion) => { setStartLocation(place); setStartSearchText(place.name); setStartSearchActive(false); }, []);

    const handleStartPredictionSelect = useCallback(async (prediction: PlacePrediction) => {
        if (!GOOGLE_MAPS_API_KEY) { Alert.alert('Google Places not configured', 'Missing Google Maps API key.'); return; }
        const sessionToken = startSessionTokenRef.current ?? createSessionToken();
        const place = await resolvePlaceDetails(prediction, sessionToken);
        startSessionTokenRef.current = null;
        if (!place) { Alert.alert('Place not found', 'Unable to fetch location details.'); return; }
        setRecentPlaces(prev => [place, ...prev.filter(item => item.id !== place.id)].slice(0, 6)); handleStartSelect(place);
    }, [handleStartSelect, resolvePlaceDetails]);

    const openStartSearch = useCallback(() => { setStartSearchActive(true); setTimeout(() => startInputRef.current?.focus(), 60); }, []);

    const handleStartCurrentLocation = useCallback(() => {
        if (!userLoc) return;
        const current: PlaceSuggestion = { id: 'current-location', name: 'Your location', address: address || 'Current location', latitude: userLoc.latitude, longitude: userLoc.longitude };
        handleStartSelect(current);
    }, [address, handleStartSelect, userLoc]);

    const sheetPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
            onPanResponderMove: (_, gesture) => { if (gesture.dy > 0) placeSheetDragY.setValue(gesture.dy); },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dy > 120) closePlaceSheet();
                else RNAnimated.spring(placeSheetDragY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
            },
        })
    ).current;

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

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
                >
                    {RED_ZONES.map(zone => (
                        <Circle
                            key={zone.id}
                            center={{ latitude: zone.latitude, longitude: zone.longitude }}
                            radius={zone.radius}
                            fillColor="rgba(255, 60, 60, 0.15)"
                            strokeColor="rgba(255, 60, 60, 0.5)"
                            strokeWidth={1}
                        />
                    ))}

                    {selectedPlace && (
                        <Marker
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

                    {showSafePlace && safePlaceCoords.length > 1 && (
                        <>
                            <Polyline
                                coordinates={safePlaceCoords}
                                strokeColor={T.violet}
                                strokeWidth={4}
                                lineCap="round"
                                lineJoin="round"
                            />
                            <Marker coordinate={safePlaceCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                                <View style={s.placeMarkerWrap}><View style={[s.placeMarkerIconWrap, { backgroundColor: T.violet }]}><Ionicons name="person" size={18} color={T.onPrimary} /></View></View>
                            </Marker>
                            <Marker coordinate={safePlaceCoords[safePlaceCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                                <View style={s.placeMarkerWrap}><View style={[s.placeMarkerIconWrap, { backgroundColor: T.accent }]}><Ionicons name="shield" size={16} color={T.onPrimary} /></View></View>
                            </Marker>
                        </>
                    )}

                    {/* ── Gray dashed Comparison Line ── */}
                    {safeRouteCoords.length > 0 && !routeUnsafe && !isScanAnimating && (
                        <Polyline
                            coordinates={unsafeRouteCoords}
                            strokeColor="rgba(160,160,175,0.45)"
                            strokeWidth={3}
                            lineDashPattern={[8, 6]}
                            lineCap="round"
                        />
                    )}

                    {/* ── Active Route Line ── */}
                    {routeCoords.length > 1 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeColor={T.violet}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}

                    {activeSosView && sosPathCoords.length > 1 && (
                        <>
                            <Polyline
                                coordinates={sosPathCoords}
                                strokeColor={T.violet}
                                strokeWidth={4}
                                lineCap="round"
                                lineJoin="round"
                            />
                            <Marker coordinate={sosPathCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                                <View style={s.sosMarkerOuter}>
                                    <View style={[s.sosMarkerInner, { borderColor: T.violet }]}>
                                        <Image source={{ uri: profile?.photoUri || 'https://i.pravatar.cc/150?img=11' }} style={s.sosMarkerAvatar} resizeMode="cover" />
                                    </View>
                                </View>
                            </Marker>
                            <Marker coordinate={sosPathCoords[sosPathCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                                <View style={s.sosMarkerOuter}>
                                    <View style={[s.sosMarkerInner, { borderColor: T.danger }]}>
                                        <Image source={{ uri: activeSosView.avatarUri }} style={s.sosMarkerAvatar} resizeMode="cover" />
                                    </View>
                                </View>
                            </Marker>
                        </>
                    )}
                </MapView>

                {locationStatus === 'idle' && <PulseRadar />}

                {!isLiveNav && !sosPanelOpen && (
                    <PremiumBar style={[s.header, { top: insets.top + 8 }]} contentStyle={s.headerContent}>
                        {directionsMode ? (
                            startSearchActive ? null : (
                                <RNAnimated.View style={[s.directionsHeaderWrap, { height: directionsProgress.interpolate({ inputRange: [0, 1], outputRange: [48, 140] }), opacity: directionsProgress, flexDirection: 'column', alignItems: 'stretch' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <TouchableOpacity style={s.hBtn} onPress={exitDirectionsMode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Ionicons name="arrow-back" size={20} color={T.ink2} />
                                        </TouchableOpacity>
                                        <View style={s.directionsFields}>
                                            <TouchableOpacity style={s.directionsInput} activeOpacity={0.8} onPress={openStartSearch}>
                                                <Ionicons name="radio-button-off" size={14} color={T.ink4} style={s.directionsIcon} />
                                                <Text style={s.directionsInputText}>{startLocation ? startLocation.name : 'Choose start location'}</Text>
                                            </TouchableOpacity>
                                            <View style={s.directionsDivider} />
                                            <View style={s.directionsInput}>
                                                <Ionicons name="location" size={14} color={T.violet} style={s.directionsIcon} />
                                                <Text style={s.directionsInputText} numberOfLines={1}>{endLocation?.name ?? 'Destination'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={s.travelModeWrap}>
                                        {(['driving', 'walking', 'motorcycle', 'transit'] as const).map((mode) => (
                                            <TouchableOpacity key={mode} style={[s.travelModeBtn, travelMode === mode && s.travelModeBtnActive]} onPress={() => setTravelMode(mode)}>
                                                <Ionicons name={mode === 'driving' ? 'car' : mode === 'walking' ? 'walk' : mode === 'motorcycle' ? 'bicycle' : 'bus'} size={16} color={travelMode === mode ? T.onPrimary : T.ink3} />
                                                <Text style={[s.travelModeText, travelMode === mode && s.travelModeTextActive]}>{mode === 'motorcycle' ? 'Bike' : mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </RNAnimated.View>
                            )
                        ) : (
                            <>
                                <RNAnimated.View style={{ width: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 36] }), opacity: searchProgress, transform: [{ translateX: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }], marginRight: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }), overflow: 'hidden' }}>
                                    <TouchableOpacity style={s.hBtn} onPress={() => deactivateSearch(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Ionicons name="arrow-back" size={20} color={T.ink2} />
                                    </TouchableOpacity>
                                </RNAnimated.View>
                                <TouchableOpacity style={s.searchBarWrap} activeOpacity={1} onPress={activateSearch}>
                                    <Ionicons name="search-outline" size={16} color={T.ink4} style={s.searchIcon} />
                                    <TextInput ref={searchInputRef} style={s.searchInput} placeholder="Search location…" placeholderTextColor={T.ink4} value={searchText} onChangeText={setSearchText} onFocus={activateSearch} returnKeyType="search" selectionColor={T.violet} />
                                    {searchText.length > 0 && (
                                        <TouchableOpacity onPress={resetExploreState} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Ionicons name="close-circle" size={16} color={T.ink4} />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                                <RNAnimated.View style={{ width: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [88, 0] }), opacity: searchProgress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.25, 0] }), transform: [{ translateX: searchProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }], overflow: 'hidden' }} pointerEvents={searchActive ? 'none' : 'auto'}>
                                    <View style={s.headerBtns}>
                                        <TouchableOpacity style={s.hBtn} onPress={() => router.push('/(tabs)/users/volunteer/notifications')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Ionicons name="notifications-outline" size={20} color={T.ink2} />
                                            <View style={s.notifDot} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={s.profileBtn} onPress={() => setDrawerOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            {profile?.photoUri ? <Image source={{ uri: profile.photoUri }} style={s.profileAvatar} /> : <Image source={{ uri: 'https://i.pravatar.cc/150?img=47&u=demo-female' }} style={s.profileAvatar} />}
                                        </TouchableOpacity>
                                    </View>
                                </RNAnimated.View>
                            </>
                        )}
                    </PremiumBar>
                )}

                {isLiveNav && navInstructions.length > 0 && !sosPanelOpen && (
                    <PremiumBar style={[lb.bannerWrap, { top: insets.top + 8 }]} contentStyle={lb.bannerBody}>
                        <View style={ns.iconWrap}><Ionicons name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver) as any} size={28} color={T.violet} /></View>
                        <View style={lb.textWrap}>
                            <Text style={lb.distText}>{navInstructions[currentStepIdx]?.distance}</Text>
                            <Text style={lb.instrText} numberOfLines={2}>{navInstructions[currentStepIdx]?.instruction}</Text>
                        </View>
                        <TouchableOpacity style={lb.audioBtn} onPress={() => setAudioEnabled(prev => { if (prev) Speech.stop(); return !prev; })} activeOpacity={0.7}>
                            <Ionicons name={audioEnabled ? "volume-high" : "volume-mute"} size={22} color={audioEnabled ? T.violet : T.ink4} />
                        </TouchableOpacity>
                    </PremiumBar>
                )}

                {searchActive && (
                    <View style={s.searchOverlay}>
                        <Pressable style={s.searchOverlayBackdrop} onPress={() => deactivateSearch(false)} pointerEvents="box-only" />
                        <View style={[s.searchOverlayContent, { paddingTop: insets.top + 76 }]}>
                            {query.length === 0 ? (
                                <>
                                    <Text style={s.searchSectionTitle}>Recent searches</Text>
                                    {recentPlaces.length === 0 ? <Text style={s.searchEmptyText}>No recent searches yet</Text> : recentPlaces.map(place => (
                                        <TouchableOpacity key={place.id} style={s.searchRow} onPress={() => handleResolvedPlaceSelect(place)} activeOpacity={0.7}>
                                            <View style={s.searchIconWrap}><Ionicons name="time-outline" size={16} color={T.violet} /></View>
                                            <View style={s.searchTextWrap}><Text style={s.searchTitle}>{place.name}</Text><Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text></View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <Text style={s.searchSectionTitle}>Suggestions</Text>
                                    {searchSuggestions.length === 0 ? <Text style={s.searchEmptyText}>{searchStatus === 'MISSING_KEY' ? 'Missing Google Maps API key' : searchStatus && searchStatus !== 'OK' ? `Places API error: ${searchStatus}` : 'No results found'}</Text> : searchSuggestions.slice(0, 10).map(place => (
                                        <TouchableOpacity key={place.id} style={s.searchRow} onPress={() => handlePlaceSelect(place)} activeOpacity={0.7}>
                                            <View style={s.searchIconWrap}><Ionicons name="location" size={16} color={T.violet} /></View>
                                            <View style={s.searchTextWrap}><Text style={s.searchTitle}>{place.name}</Text><Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text></View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </View>
                    </View>
                )}

                {startSearchActive && (
                    <View style={s.searchOverlay}>
                        <Pressable style={s.searchOverlayBackdrop} onPress={() => setStartSearchActive(false)} pointerEvents="box-only" />
                        <View style={[s.searchOverlayContent, { paddingTop: insets.top + 56 }]}>
                            <View style={s.startSearchHeader}>
                                <Ionicons name="search-outline" size={16} color={T.ink4} style={s.searchIcon} />
                                <TextInput ref={startInputRef} style={s.startSearchInput} placeholder="Choose start location" placeholderTextColor={T.ink4} value={startSearchText} onChangeText={setStartSearchText} returnKeyType="search" selectionColor={T.violet} />
                                {startSearchText.length > 0 && <TouchableOpacity onPress={() => setStartSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={16} color={T.ink4} /></TouchableOpacity>}
                            </View>
                            <Text style={s.searchSectionTitle}>Start location</Text>
                            <TouchableOpacity style={s.searchRow} onPress={handleStartCurrentLocation} activeOpacity={0.7}>
                                <View style={s.searchIconWrap}><Ionicons name="locate" size={16} color={T.violet} /></View>
                                <View style={s.searchTextWrap}><Text style={s.searchTitle}>Your location</Text><Text style={s.searchSubtitle} numberOfLines={1}>Use current GPS location</Text></View>
                            </TouchableOpacity>

                            {startQuery.length === 0 ? (
                                <>
                                    <Text style={s.searchSectionTitle}>Recent searches</Text>
                                    {recentPlaces.length === 0 ? <Text style={s.searchEmptyText}>No recent searches yet</Text> : recentPlaces.map(place => (
                                        <TouchableOpacity key={place.id} style={s.searchRow} onPress={() => handleStartSelect(place)} activeOpacity={0.7}>
                                            <View style={s.searchIconWrap}><Ionicons name="time-outline" size={16} color={T.violet} /></View>
                                            <View style={s.searchTextWrap}><Text style={s.searchTitle}>{place.name}</Text><Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text></View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <Text style={s.searchSectionTitle}>Suggestions</Text>
                                    {startSuggestions.length === 0 ? <Text style={s.searchEmptyText}>{startStatus === 'MISSING_KEY' ? 'Missing Google Maps API key' : startStatus && startStatus !== 'OK' ? `Places API error: ${startStatus}` : 'No results found'}</Text> : startSuggestions.slice(0, 10).map(place => (
                                        <TouchableOpacity key={place.id} style={s.searchRow} onPress={() => handleStartPredictionSelect(place)} activeOpacity={0.7}>
                                            <View style={s.searchIconWrap}><Ionicons name="location" size={16} color={T.violet} /></View>
                                            <View style={s.searchTextWrap}><Text style={s.searchTitle}>{place.name}</Text><Text style={s.searchSubtitle} numberOfLines={1}>{place.address}</Text></View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </View>
                    </View>
                )}

                {!directionsMode && !selectedPlace && !sosPanelOpen && !activeSosView && !searchActive && !startSearchActive && (
                    <View style={s.mapControls}>
                        <TouchableOpacity style={s.ctrlBtn} onPress={() => !sosActive && setShowSOS(!showSOS)}>
                            <Ionicons name="warning-outline" size={20} color={T.danger} />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.ctrlBtn} onPress={openLocationCard}>
                            <Ionicons name="locate-outline" size={22} color={T.violet} />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.sosReqBtn} onPress={openSosPanel}>
                            <Ionicons name="alarm-outline" size={20} color={T.danger} />
                            <View style={s.sosReqBadge} />
                        </TouchableOpacity>
                        <SafePlaceButton onPress={handleSafePlaceToggle} isActive={showSafePlace} distance={safePlaceDistance} />
                    </View>
                )}

                {sosPanelOpen && (
                    <>
                        <Pressable style={s.sosPanelBackdrop} onPress={closeSosPanel} />
                        <View style={[s.sosPanel, { bottom: navBottom + NAV_HEIGHT + 16 }]}>
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={s.sosPanelTint} pointerEvents="none" />
                            <View style={s.sosPanelHeader}>
                                <Text style={s.sosPanelTitle}>Nearby SOS Requests</Text>
                                <Text style={s.sosPanelSub}>Active now</Text>
                            </View>
                            <ScrollView contentContainerStyle={s.sosPanelList} showsVerticalScrollIndicator={false}>
                                {MOCK_SOS_REQUESTS.map(req => (
                                    <View key={req.id} style={s.sosCard}>
                                        <Image source={{ uri: req.avatarUri }} style={s.sosAvatar} />
                                        <View style={s.sosCardBody}>
                                            <View style={s.sosCardRow}>
                                                <Text style={s.sosVictimName}>{req.victimName}</Text>
                                                <Text style={s.sosDistance}>{req.distanceKm.toFixed(1)} km</Text>
                                            </View>
                                            <View style={s.sosLocationRow}>
                                                <Text style={s.sosLocationText} numberOfLines={1}>{req.locationLabel}</Text>
                                                <TouchableOpacity style={s.sosViewBtn} onPress={() => handleViewSos(req)}>
                                                    <Text style={s.sosViewBtnText}>View</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={s.sosActionRow}>
                                                <TouchableOpacity style={s.sosRejectBtn} onPress={() => { }}><Text style={s.sosRejectText}>Reject</Text></TouchableOpacity>
                                                <TouchableOpacity style={s.sosAcceptBtn} onPress={() => { }}><Text style={s.sosAcceptText}>Accept</Text></TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    </>
                )}

                {activeSosView && (
                    <View style={[s.sosInfoCard, { bottom: navBottom + NAV_HEIGHT + 16 }]}>
                        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.sosPanelTint} pointerEvents="none" />
                        <View style={s.sosConnectorRow}>
                            <View style={s.sosConnectorEndpoint}>
                                <View style={[s.sosConnectorCircle, s.sosConnectorCircleA]}>
                                    <Image source={{ uri: profile?.photoUri || 'https://i.pravatar.cc/150?img=11' }} style={s.sosConnectorAvatar} />
                                </View>
                                <Text style={s.sosConnectorPointLabel}>A</Text>
                                <Text style={s.sosConnectorLabel}>You</Text>
                                <Text style={s.sosConnectorSub} numberOfLines={1}>Khilkhet</Text>
                            </View>
                            <View style={s.sosConnectorMiddle}>
                                <View style={s.sosConnectorLineWrap}>
                                    <View style={s.sosConnectorLineDash} />
                                    <Ionicons name="arrow-forward" size={12} color={T.danger} />
                                    <View style={s.sosConnectorLineDash} />
                                </View>
                                <View style={s.sosConnectorDistChip}>
                                    <Ionicons name="navigate" size={10} color={T.violet} />
                                    <Text style={s.sosConnectorDistText}>{sosRouteDistance || `${activeSosView.distanceKm.toFixed(1)} km`}</Text>
                                </View>
                                {sosRouteDuration ? <Text style={s.sosConnectorEta}>{sosRouteDuration}</Text> : null}
                            </View>
                            <View style={s.sosConnectorEndpoint}>
                                <View style={[s.sosConnectorCircle, s.sosConnectorCircleB]}>
                                    <Image source={{ uri: activeSosView.avatarUri }} style={s.sosConnectorAvatar} />
                                </View>
                                <Text style={s.sosConnectorPointLabel}>B</Text>
                                <Text style={s.sosConnectorLabel} numberOfLines={1}>{activeSosView.victimName.split(' ')[0]}</Text>
                                <Text style={s.sosConnectorSub} numberOfLines={1}>UIU</Text>
                            </View>
                        </View>
                        <View style={s.sosInfoRow}>
                            <View style={[s.sosInfoDot, { backgroundColor: T.danger }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.sosInfoName}>{activeSosView.victimName}</Text>
                                <Text style={s.sosInfoLocation} numberOfLines={1}>{activeSosView.locationLabel}</Text>
                            </View>
                        </View>
                        <View style={[s.sosActionRow, { paddingHorizontal: 16, paddingBottom: 14 }]}>
                            <TouchableOpacity style={s.sosRejectBtn} onPress={exitSosView}><Text style={s.sosRejectText}>Decline</Text></TouchableOpacity>
                            <TouchableOpacity style={[s.sosAcceptBtn, { flexDirection: 'row', gap: 6 }]} onPress={() => { router.push({ pathname: '/(tabs)/users/volunteer/chat_room', params: { incidentId: activeSosView.id } }); exitSosView(); }}>
                                <Ionicons name="navigate" size={14} color={T.violet} />
                                <Text style={s.sosAcceptText}>Accept & Navigate</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {showLocationCard && (
                    <>
                        <RNAnimated.View style={[s.locationBackdrop, { opacity: locationCardOpacity }]}><Pressable style={StyleSheet.absoluteFill} onPress={closeLocationCard} /></RNAnimated.View>
                        <RNAnimated.View style={[s.locationCard, { bottom: navBottom + NAV_HEIGHT + 16 }, { opacity: locationCardOpacity, transform: [{ translateY: locationCardY }] }]}>
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={s.locationCardTint} pointerEvents="none" />
                            <View style={s.locationCardGrabberWrap}><View style={s.locationCardGrabber} /></View>
                            <View style={s.locationCardContent}>
                                <View style={s.locationCardLeft}>
                                    <View style={s.locationCardIconWrap}><Ionicons name="location" size={20} color={T.violet} /></View>
                                    <View style={{ flex: 1 }}><Text style={s.locationCardTitle}>Your Location</Text><Text style={s.locationCardAddr} numberOfLines={2}>{address || 'Fetching address…'}</Text></View>
                                </View>
                                <TouchableOpacity style={s.locationCardClose} onPress={closeLocationCard}><Ionicons name="chevron-down" size={22} color={T.ink3} /></TouchableOpacity>
                            </View>
                        </RNAnimated.View>
                    </>
                )}

                {placeSheetOpen && selectedPlace && (
                    <>
                        <RNAnimated.View style={[s.placeSheetBackdrop, { opacity: placeSheetOpacity }]}><Pressable style={StyleSheet.absoluteFill} onPress={closePlaceSheet} /></RNAnimated.View>
                        <RNAnimated.View style={[s.placeSheet, { transform: [{ translateY: RNAnimated.add(placeSheetY, placeSheetDragY) }] }, { opacity: placeSheetOpacity }]} {...sheetPanResponder.panHandlers}>
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={s.placeSheetTint} pointerEvents="none" />
                            <View style={s.placeSheetHandleWrap}><View style={s.placeSheetHandle} /></View>
                            <View style={s.placeSheetHeader}>
                                <View style={{ flex: 1 }}><Text style={s.placeSheetTitle}>{selectedPlace.name}</Text><Text style={s.placeSheetSubtitle} numberOfLines={1}>{selectedPlace.address}</Text></View>
                            </View>
                            <View style={s.placeSheetActions}>
                                <TouchableOpacity style={[s.placeSheetActionBtn, s.placeSheetActionBtnPrimary]} onPress={() => enterDirectionsMode(selectedPlace)}><Ionicons name="navigate" size={16} color={T.onPrimary} /><Text style={s.placeSheetActionBtnTextPrimary}>Directions</Text></TouchableOpacity>
                                <TouchableOpacity style={[s.placeSheetActionBtn, s.placeSheetActionBtnSecondary]} onPress={openAddSafePlace}><Ionicons name="shield-checkmark-outline" size={16} color={T.violet} /><Text style={s.placeSheetActionBtnTextSecondary}>Add Safe Place</Text></TouchableOpacity>
                            </View>
                            <View style={s.placeSheetSection}>
                                {placeSheetMode === 'incidents' ? (
                                    <>
                                        <Text style={s.placeSheetSectionTitle}>Incidents at this location</Text>
                                        {placeIncidents.length === 0 ? <Text style={s.placeSheetEmpty}>No reported incidents yet</Text> : placeIncidents.map(inc => (
                                            <View key={inc.id} style={s.placeIncidentRow}>
                                                <View style={s.placeIncidentInfo}><Text style={s.placeIncidentName}>{inc.reporter}</Text><Text style={s.placeIncidentTime}>{inc.time}</Text></View>
                                                <View style={[s.placeIncidentPill, inc.status === 'ACTIVE' && s.placeIncidentPillActive, inc.status === 'RESOLVED' && s.placeIncidentPillResolved, inc.status === 'CANCELLED' && s.placeIncidentPillCancelled]}><Text style={s.placeIncidentPillText}>{inc.status}</Text></View>
                                            </View>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <Text style={s.placeSheetSectionTitle}>Add Safe Place</Text>
                                        {safePlaceSubmitState === 'success' ? (
                                            <RNAnimated.View style={[s.safePlaceSuccessWrap, { opacity: safePlaceSuccessAnim, transform: [{ translateY: safePlaceSuccessAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
                                                <View style={s.safePlaceSuccessIcon}><Ionicons name="checkmark" size={18} color={T.onPrimary} /></View>
                                                <View style={{ flex: 1 }}><Text style={s.safePlaceSuccessTitle}>Sent to admin</Text><Text style={s.safePlaceSuccessSubtitle}>Your safe place request was sent to admin for confirmation.</Text></View>
                                            </RNAnimated.View>
                                        ) : (
                                            <>
                                                <Text style={s.safePlaceQuestion}>Why is this place safe? (Describe briefly)</Text>
                                                <TextInput value={safePlaceAnswer} onChangeText={(v) => { setSafePlaceAnswer(v); if (safePlaceError) setSafePlaceError(null); }} placeholder="Type your answer…" placeholderTextColor={T.ink4} multiline textAlignVertical="top" style={s.safePlaceInput} selectionColor={T.violet} />
                                                {!!safePlaceError && <Text style={s.safePlaceError}>{safePlaceError}</Text>}
                                                <View style={s.safePlaceActions}>
                                                    <TouchableOpacity style={[s.safePlaceBtn, s.safePlaceBtnSecondary]} onPress={cancelAddSafePlace}><Text style={s.safePlaceBtnTextSecondary}>Cancel</Text></TouchableOpacity>
                                                    <TouchableOpacity style={[s.safePlaceBtn, s.safePlaceBtnPrimary, safePlaceAnswer.trim().length === 0 && s.safePlaceBtnPrimaryDisabled]} onPress={safePlaceAnswer.trim().length === 0 ? undefined : submitAddSafePlace}><Text style={s.safePlaceBtnTextPrimary}>Submit</Text></TouchableOpacity>
                                                </View>
                                            </>
                                        )}
                                    </>
                                )}
                            </View>
                        </RNAnimated.View>
                    </>
                )}

                {directionsMode && navInstructions.length > 0 && (
                    <View style={[ns.cardWrap, { bottom: navBottom + NAV_HEIGHT + 16 }]}>
                        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={ns.cardTint} pointerEvents="none" />
                        {routeUnsafe && !isScanAnimating && blockedZoneName && (
                            <View style={ns.warningBadge}><Ionicons name="warning" size={12} color="#E25B3A" style={{ marginRight: 4 }} /><Text style={ns.warningBadgeText}>Route passes through {blockedZoneName}</Text></View>
                        )}
                        <View style={ns.cardBody}>
                            <View style={ns.iconWrap}><Ionicons name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver) as any} size={22} color={T.violet} /></View>
                            <View style={ns.textWrap}>
                                <Text style={ns.instrText} numberOfLines={2}>{navInstructions[currentStepIdx]?.instruction}</Text>
                                <Text style={ns.distText}>{navInstructions[currentStepIdx]?.distance}</Text>
                            </View>
                        </View>
                        <View style={ns.cardFooter}>
                            <Text style={ns.stepCounter}>Step {currentStepIdx + 1} of {navInstructions.length}</Text>
                            {!isLiveNav ? (
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    {showSafePath && !isScanAnimating && (
                                        <TouchableOpacity style={ns.safePathBtn} onPress={triggerSafetyRecalculation}>
                                            <Ionicons name="shield-checkmark" size={13} color={T.onPrimary} style={{ marginRight: 4 }} />
                                            <Text style={ns.safePathBtnText}>SAFE PATH</Text>
                                        </TouchableOpacity>
                                    )}
                                    {currentStepIdx > 0 && <TouchableOpacity style={ns.navBtn} onPress={() => setCurrentStepIdx(prev => Math.max(prev - 1, 0))}><Ionicons name="chevron-back" size={16} color={T.ink2} /></TouchableOpacity>}
                                    {currentStepIdx < navInstructions.length - 1 && <TouchableOpacity style={ns.navBtn} onPress={() => setCurrentStepIdx(prev => Math.min(prev + 1, navInstructions.length - 1))}><Ionicons name="chevron-forward" size={16} color={T.ink2} /></TouchableOpacity>}
                                    <TouchableOpacity style={ns.goLiveBtn} onPress={() => setIsLiveNav(true)}><Ionicons name="navigate" size={12} color={T.onPrimary} style={{ marginRight: 4 }} /><Text style={ns.goLiveBtnText}>GO LIVE</Text></TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={ns.endLiveBtn} onPress={() => setIsLiveNav(false)}><Text style={ns.endLiveBtnText}>Exit Live Mode</Text></TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {showSOS && (
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
                            <LiveSOSButton onPress={confirmStop} />
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

                        {sosActive && (
                            <View style={[s.statusPill, isEmergencyLive && s.statusPillLive]}>
                                <View style={[s.pillDot, { backgroundColor: T.danger }]} />
                                <Text style={[s.pillTxt, isEmergencyLive && s.pillTxtLive]} numberOfLines={1}>
                                    {cancelCountdown > 0
                                        ? `Alert triggered · Cancel in ${cancelCountdown}s`
                                        : 'Sharing your location'
                                    }
                                </Text>
                            </View>
                        )}
                        {!sosActive && (
                            <View style={s.statusPill}>
                                <Text style={s.pillTxt} numberOfLines={1}>
                                    {holdPhase === 'idle'
                                        ? 'Press and hold for 2 sec'
                                        : holdPhase === 'holding'
                                            ? 'Holding...'
                                            : 'Release'
                                    }
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <SafetyScanOverlay visible={isScanAnimating} spinAnim={scanAnim} r0={radarAnim0} r1={radarAnim1} r2={radarAnim2} zoneName={blockedZoneName} />

                <View style={[s.navWrap, { bottom: navBottom }]} pointerEvents="box-none">
                    <PremiumBar style={s.navBar} contentStyle={s.navBarContent}>
                        {NAV_TABS.map(tab => (
                            <NavTab key={tab.id} tab={tab} isActive={tab.id === 'Home'} onPress={() => {
                                if (tab.id === 'Messages') router.push('/(tabs)/users/volunteer/messages');
                                else if (tab.id === 'Incidents') router.push('/(tabs)/users/volunteer/incidents');
                                else if (tab.id === 'Activity') router.push('/(tabs)/users/volunteer/activity');
                            }} />
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
    crosshairWrap: { position: 'absolute', alignSelf: 'center', top: height * 0.29, alignItems: 'center', justifyContent: 'center', zIndex: 10, width: 40, height: 40 },
    crosshairH: { position: 'absolute', width: 28, height: 1.5, backgroundColor: T.violet, opacity: 0.85, borderRadius: 1 },
    crosshairV: { position: 'absolute', width: 1.5, height: 28, backgroundColor: T.violet, opacity: 0.85, borderRadius: 1 },
    crosshairDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.violet },
    header: { position: 'absolute', left: 14, right: 14, borderRadius: 28, zIndex: 300, ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 6 } }) },
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
    profileBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }, android: { elevation: 6, shadowColor: '#8A38F6' } }) },
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
    ctrlBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.surfaceBulky, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 4 } }) },
    sosBtn: { width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 8, shadowColor: '#8A38F6' } }) },
    sosTxt: { fontSize: 18, fontWeight: '900', color: T.onPrimary, letterSpacing: 0.5 },
    sosWrap: { position: 'absolute', alignSelf: 'center', top: height * 0.4, width: SOS_WRAP_SIZE, height: SOS_WRAP_SIZE, alignItems: 'center', justifyContent: 'center', zIndex: 300 },
    pulseRing: { position: 'absolute', width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2, borderWidth: 2.5 },
    statusPill: { position: 'absolute', bottom: -56, alignSelf: 'center', minWidth: 120, maxWidth: SOS_WRAP_SIZE - 48, borderRadius: 18, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 8, ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }) },
    pillTxt: { fontSize: 12, fontWeight: '700', color: T.ink3, letterSpacing: 0.4 },
    pillDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.violet },
    statusPillLive: { backgroundColor: `${T.danger}15`, borderColor: `${T.danger}30` },
    pillTxtLive: { color: T.danger },
    sosBtnEmg: { backgroundColor: T.danger, borderColor: T.dangerBorder },
    sosBtnDangerFill: { alignItems: 'center', justifyContent: 'center', gap: 2 },
    sosSubTxt: { fontSize: 8, fontWeight: '900', color: T.onDanger, letterSpacing: 0.5, marginTop: 2 },
    cancelBtn: { width: SOS_BTN_SIZE, height: SOS_BTN_SIZE, borderRadius: SOS_BTN_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    cancelLabel: { fontSize: 14, fontWeight: '900', color: T.ink, letterSpacing: 0.5 },
    cancelCount: { fontSize: 24, fontWeight: '900', color: T.danger, letterSpacing: -0.5, marginTop: 4 },
    cancelSub: { fontSize: 10, fontWeight: '700', color: T.ink3, marginTop: 2 },
    sosReqBtn: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: T.dangerBorder, ...Platform.select({ ios: { shadowColor: '#E23636', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 4, shadowColor: '#E23636' } }) },
    sosReqBadge: { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 4.5, backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.surface },
    sosPanelBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,3,8,0.35)', zIndex: 235 },
    sosPanel: { position: 'absolute', left: 14, right: 14, maxHeight: height * 0.62, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', zIndex: 240, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 10 } }) },
    sosPanelTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,9,22,0.9)' },
    sosPanelHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
    sosPanelTitle: { fontSize: 16, fontWeight: '800', color: T.ink, letterSpacing: -0.2 },
    sosPanelSub: { marginTop: 4, fontSize: 12, fontWeight: '600', color: T.ink3 },
    sosPanelList: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
    sosCard: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    sosAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    sosCardBody: { flex: 1, gap: 6 },
    sosCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sosVictimName: { fontSize: 14, fontWeight: '700', color: T.ink },
    sosDistance: { fontSize: 12, fontWeight: '700', color: T.violet },
    sosLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sosLocationText: { flex: 1, fontSize: 12, fontWeight: '600', color: T.ink3 },
    sosViewBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: `${T.violet}20`, borderWidth: 1, borderColor: `${T.violet}45` },
    sosViewBtnText: { fontSize: 11, fontWeight: '800', color: T.violet, letterSpacing: 0.2 },
    sosActionRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
    sosRejectBtn: { flex: 1, height: 34, borderRadius: 999, backgroundColor: T.dangerLight, borderWidth: 1, borderColor: T.dangerBorder, alignItems: 'center', justifyContent: 'center' },
    sosRejectText: { fontSize: 12, fontWeight: '800', color: T.danger, letterSpacing: 0.2 },
    sosAcceptBtn: { flex: 1, height: 34, borderRadius: 999, backgroundColor: T.violetDim, borderWidth: 1, borderColor: `${T.violet}55`, alignItems: 'center', justifyContent: 'center' },
    sosAcceptText: { fontSize: 12, fontWeight: '800', color: T.violet, letterSpacing: 0.2 },
    placeMarkerWrap: { alignItems: 'center', justifyContent: 'center', width: 26, height: 26 },
    placeMarkerIconWrap: { alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 7, shadowColor: '#8A38F6' } }) },
    placeMarkerStem: { width: 0, height: 0 },
    placeSheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,3,8,0.35)', zIndex: 230 },
    placeSheet: { position: 'absolute', left: 0, right: 0, height: height * 0.5, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', zIndex: 240, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 12 } }) },
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
    safePlaceBtnSecondary: { backgroundColor: T.surfaceBulky, borderColor: 'rgba(255,255,255,0.14)' },
    safePlaceBtnPrimary: { backgroundColor: T.violet, borderColor: `${T.violet}70` },
    safePlaceBtnPrimaryDisabled: { backgroundColor: `${T.violet}40`, borderColor: `${T.violet}40` },
    safePlaceBtnTextSecondary: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.2 },
    safePlaceBtnTextPrimary: { fontSize: 12, fontWeight: '800', color: T.onPrimary, letterSpacing: 0.2 },
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
    locationCard: { position: 'absolute', left: 14, right: 14, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: `${T.violet}30`, zIndex: 250, ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 10 } }) },
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
    navBar: { width: width * 0.88, borderRadius: R.pill, ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 6 } }) },
    navBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, paddingVertical: 8 },
    navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    navTabInner: { alignItems: 'center', gap: 0 },
    navUnderline: { width: 16, height: 3, borderRadius: 1.5, marginTop: 5 },
    navIconBox: { width: 36, height: 36, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    navIconBoxActive: { backgroundColor: 'rgba(138,56,246,0.12)', borderColor: `${T.violet}40` },
    sosMarkerOuter: { alignItems: 'center', gap: 2 },
    sosMarkerInner: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 8 } }) },
    sosMarkerAvatar: { width: 48, height: 48, borderRadius: 24 },
    sosInfoCard: { position: 'absolute', left: 14, right: 14, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', zIndex: 240, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 10 } }) },
    sosConnectorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 6 },
    sosConnectorEndpoint: { alignItems: 'center', width: 68 },
    sosConnectorCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, overflow: 'hidden', marginBottom: 4 },
    sosConnectorCircleA: { borderColor: T.violet, ...Platform.select({ ios: { shadowColor: T.violet, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }, android: { elevation: 6, shadowColor: T.violet } }) },
    sosConnectorCircleB: { borderColor: T.danger, ...Platform.select({ ios: { shadowColor: T.danger, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }, android: { elevation: 6, shadowColor: T.danger } }) },
    sosConnectorAvatar: { width: '100%', height: '100%' },
    sosConnectorPointLabel: { fontSize: 11, fontWeight: '900', color: T.violet, letterSpacing: 0.5, marginBottom: 1 },
    sosConnectorLabel: { fontSize: 12, fontWeight: '700', color: T.ink, textAlign: 'center' },
    sosConnectorSub: { fontSize: 10, fontWeight: '500', color: T.ink3, marginTop: 1, textAlign: 'center' },
    sosConnectorMiddle: { flex: 1, alignItems: 'center', gap: 5 },
    sosConnectorLineWrap: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 2 },
    sosConnectorLineDash: { flex: 1, height: 1.5, backgroundColor: `${T.danger}60`, borderRadius: 1 },
    sosConnectorDistChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${T.violet}18`, borderWidth: 1, borderColor: `${T.violet}35` },
    sosConnectorDistText: { fontSize: 11, fontWeight: '800', color: T.violet },
    sosConnectorEta: { fontSize: 10, fontWeight: '600', color: T.ink3 },
    sosInfoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
    sosInfoDot: { width: 8, height: 8, borderRadius: 4 },
    sosInfoName: { fontSize: 13, fontWeight: '700', color: T.ink },
    sosInfoLocation: { fontSize: 11, fontWeight: '500', color: T.ink3, marginTop: 1 },
});

const ns = StyleSheet.create({
    cardWrap: { position: 'absolute', left: 14, right: 14, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 260, ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 10 } }) },
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
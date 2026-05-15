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
    Modal, TextInput, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Animated as RNAnimated, Easing } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { G } from '../../../../src/constants/gradients';
import { getUserProfile, UserProfile } from '../../../../src/services/profile';
import {
    SPECIALIST_CHIPS, AMBULANCE_CHIPS, GENERIC_CHIPS,
} from '../../../../src/data/medicalMockData';
import { medicalService } from '../../../../src/services/api';
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
    { id: 'Chat', label: 'Chat', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline' },
    { id: 'Explore', label: 'Explore', iconActive: 'compass', iconOutline: 'compass-outline' },
    { id: 'Medical', label: 'Medical', iconActive: 'medkit', iconOutline: 'medkit-outline' },
];

// ── Provider pin config per icon key ─────────────────────────────────────────
const PROVIDER_PIN = {
    medkit:  { icon: 'medkit',   color: '#8A38F6' },
    business:{ icon: 'business', color: '#8A38F6' },
    car:     { icon: 'car-sport',color: '#8A38F6' },
    bandage: { icon: 'bandage',  color: '#8A38F6' },
    flask:   { icon: 'flask',    color: '#8A38F6' },
} as const;

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
            {chips.map(chip => {
                const isActive = selected === chip.id;
                return (
                    <TouchableOpacity
                        key={chip.id}
                        style={[st.chip, isActive && st.chipActive]}
                        onPress={() => { Haptics.selectionAsync(); onSelect(chip.id); }}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={chip.icon as any}
                            size={13}
                            color={isActive ? '#fff' : D.muted}
                        />
                        <Text style={[st.chipText, isActive && st.chipTextActive]}>
                            {chip.label}
                        </Text>
                        {isActive && (
                            <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                    </TouchableOpacity>
                );
            })}
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
// Helper
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK PROVIDERS — Fallback when backend is unavailable
// ═══════════════════════════════════════════════════════════════════════════════
const MOCK_PROVIDERS: any[] = [
    // Specialists (14)
    { id: 'doc-001', type: 'specialists', name: 'Dr. Anika Sultana', degree: 'MBBS, FCPS (Cardiology)', specialty: 'Cardiologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.evercaredhaka.com/appointments', latitude: 23.8173, longitude: 90.4280, rating: 4.9, affiliation: 'Evercare Hospital Dhaka' },
    { id: 'doc-002', type: 'specialists', name: 'Dr. Rafiq Hasan', degree: 'MBBS, MD (Neurology)', specialty: 'Neurologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.uhlbd.com/appointment', latitude: 23.7926, longitude: 90.4167, rating: 4.7, affiliation: 'United Hospital Ltd.' },
    { id: 'doc-003', type: 'specialists', name: 'Dr. Tasneem Akhter', degree: 'MBBS, MS (Orthopedics)', specialty: 'Orthopedic Surgeon', shift: 'now', safeRouteVerified: false, bookingUrl: 'https://www.populardiagnostic.com/appointment', latitude: 23.7465, longitude: 90.3747, rating: 4.5, affiliation: 'Popular Diagnostic Centre' },
    { id: 'doc-004', type: 'specialists', name: 'Dr. Kabir Ahmed', degree: 'MBBS, FCPS (Gynecology)', specialty: 'Gynecologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.evercaredhaka.com/appointments', latitude: 23.8180, longitude: 90.4275, rating: 4.8, affiliation: 'Evercare Hospital Dhaka' },
    { id: 'doc-005', type: 'specialists', name: 'Dr. Nusrat Jahan', degree: 'MBBS, DCH (Pediatrics)', specialty: 'Pediatrician', shift: 'now', safeRouteVerified: true, bookingUrl: 'https://www.uhlbd.com/appointment', latitude: 23.7935, longitude: 90.4175, rating: 4.9, affiliation: 'United Hospital Ltd.' },
    { id: 'doc-006', type: 'specialists', name: 'Dr. Faisal Rahman', degree: 'MBBS, FCPS (Dermatology)', specialty: 'Dermatologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.ibnsinatrust.com/appointment', latitude: 23.7450, longitude: 90.3730, rating: 4.6, affiliation: 'Ibn Sina Trust' },
    { id: 'doc-007', type: 'specialists', name: 'Dr. Shirin Begum', degree: 'MBBS, MD (Psychiatry)', specialty: 'Psychiatrist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.nimhbd.org/', latitude: 23.7780, longitude: 90.3770, rating: 4.6, affiliation: 'NIMH Dhaka' },
    { id: 'doc-008', type: 'specialists', name: 'Dr. Mahbub Alam', degree: 'MBBS, MS (General Surgery)', specialty: 'General Surgeon', shift: 'now', safeRouteVerified: true, bookingUrl: 'https://dmch.gov.bd/', latitude: 23.7260, longitude: 90.3985, rating: 4.5, affiliation: 'DMCH' },
    { id: 'doc-009', type: 'specialists', name: 'Dr. Roksana Islam', degree: 'MBBS, FCPS (Ophthalmology)', specialty: 'Eye Specialist', shift: 'morning', safeRouteVerified: false, bookingUrl: null, latitude: 23.7612, longitude: 90.4002, rating: 4.4, affiliation: 'Eye Care BD' },
    { id: 'doc-010', type: 'specialists', name: 'Dr. Tariq Morshed', degree: 'MBBS, MD (Endocrinology)', specialty: 'Endocrinologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.birdem-general-hospital.com/', latitude: 23.7388, longitude: 90.3940, rating: 4.8, affiliation: 'BIRDEM Hospital' },
    { id: 'doc-011', type: 'specialists', name: 'Dr. Parvin Sultana', degree: 'MBBS, FCPS (Rheumatology)', specialty: 'Rheumatologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.squarehospital.com/', latitude: 23.7512, longitude: 90.3815, rating: 4.7, affiliation: 'Square Hospital Ltd.' },
    { id: 'doc-012', type: 'specialists', name: 'Dr. Aminul Islam', degree: 'MBBS, DLO (ENT)', specialty: 'ENT Specialist', shift: 'now', safeRouteVerified: false, bookingUrl: null, latitude: 23.8040, longitude: 90.3660, rating: 4.3, affiliation: 'Mirpur ENT Centre' },
    { id: 'doc-013', type: 'specialists', name: 'Dr. Laila Anjum', degree: 'MBBS, MD (Oncology)', specialty: 'Oncologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://ahsaniamissioncancerhospital.com/', latitude: 23.7895, longitude: 90.3780, rating: 4.9, affiliation: 'Ahsania Mission' },
    { id: 'doc-014', type: 'specialists', name: 'Dr. Zubayer Chowdhury', degree: 'MBBS, FCPS (Urology)', specialty: 'Urologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://labaid.com.bd/', latitude: 23.7480, longitude: 90.3755, rating: 4.5, affiliation: 'Labaid Group' },
    // Hospitals (10)
    { id: 'hosp-001', type: 'hospital', name: 'Evercare Hospital', address: 'Plot 81, Block E, Bashundhara R/A', latitude: 23.8173, longitude: 90.4280, bookingUrl: 'https://www.evercaredhaka.com/appointments', safeRouteVerified: true, rating: 4.8, affiliation: 'Evercare Group' },
    { id: 'hosp-002', type: 'hospital', name: 'United Hospital', address: 'Plot 15, Road 71, Gulshan', latitude: 23.7926, longitude: 90.4167, bookingUrl: 'https://www.uhlbd.com/appointment', safeRouteVerified: true, rating: 4.7, affiliation: 'United Group' },
    { id: 'hosp-003', type: 'hospital', name: 'Popular Diagnostic Centre', address: 'House 16, Road 2, Dhanmondi', latitude: 23.7465, longitude: 90.3747, bookingUrl: 'https://www.populardiagnostic.com/appointment', safeRouteVerified: false, rating: 4.5, affiliation: 'Popular Group' },
    { id: 'hosp-004', type: 'hospital', name: 'Ibn Sina Hospital', address: 'House 48, Road 9/A, Dhanmondi', latitude: 23.7450, longitude: 90.3730, bookingUrl: 'https://www.ibnsinatrust.com/appointment', safeRouteVerified: true, rating: 4.6, affiliation: 'Ibn Sina Trust' },
    { id: 'hosp-005', type: 'hospital', name: 'Dhaka Medical College Hospital', address: 'Bakshibazar, Dhaka 1000', latitude: 23.7260, longitude: 90.3985, bookingUrl: 'https://dmch.gov.bd/', safeRouteVerified: true, rating: 4.4, affiliation: 'Government' },
    { id: 'hosp-006', type: 'hospital', name: 'Square Hospital', address: 'West Panthapath, Dhaka', latitude: 23.7512, longitude: 90.3815, bookingUrl: 'https://www.squarehospital.com/', safeRouteVerified: true, rating: 4.7, affiliation: 'Square Group' },
    { id: 'hosp-007', type: 'hospital', name: 'Labaid Specialized Hospital', address: 'House 1, Road 4, Dhanmondi', latitude: 23.7480, longitude: 90.3755, bookingUrl: 'https://labaid.com.bd/', safeRouteVerified: true, rating: 4.5, affiliation: 'Labaid Group' },
    { id: 'hosp-008', type: 'hospital', name: 'BIRDEM General Hospital', address: 'Shahbag, Dhaka', latitude: 23.7388, longitude: 90.3940, bookingUrl: 'https://www.birdem-general-hospital.com/', safeRouteVerified: true, rating: 4.6, affiliation: 'BIRDEM' },
    { id: 'hosp-009', type: 'hospital', name: 'Mugda Medical College Hospital', address: 'Mugda, Dhaka', latitude: 23.7334, longitude: 90.4310, bookingUrl: null, safeRouteVerified: false, rating: 4.1, affiliation: 'Government' },
    { id: 'hosp-010', type: 'hospital', name: 'Shaheed Suhrawardy Medical College', address: 'Sher-E-Bangla Nagar, Dhaka', latitude: 23.7770, longitude: 90.3755, bookingUrl: null, safeRouteVerified: true, rating: 4.3, affiliation: 'Government' },
    // Ambulances (10)
    { id: 'amb-001', type: 'ambulance', name: 'Evercare Ambulance', ambulanceType: 'icu_ccu', contactNumber: '+880-1711-000001', eta: '8 min', safeRouteVerified: true, latitude: 23.8165, longitude: 90.4270, rating: 4.9, affiliation: 'Evercare Hospital' },
    { id: 'amb-002', type: 'ambulance', name: 'United Rapid Response', ambulanceType: 'ac', contactNumber: '+880-1711-000002', eta: '12 min', safeRouteVerified: true, latitude: 23.7940, longitude: 90.4160, rating: 4.7, affiliation: 'United Hospital' },
    { id: 'amb-003', type: 'ambulance', name: 'Red Crescent Ambulance', ambulanceType: 'standard', contactNumber: '+880-1711-000003', eta: '15 min', safeRouteVerified: false, latitude: 23.8100, longitude: 90.4220, rating: 4.3, affiliation: 'Bangladesh Red Crescent' },
    { id: 'amb-004', type: 'ambulance', name: 'Bashundhara Medical', ambulanceType: 'standard', contactNumber: '+880-1711-000004', eta: '10 min', safeRouteVerified: true, latitude: 23.8120, longitude: 90.4240, rating: 4.4, affiliation: 'Bashundhara Group' },
    { id: 'amb-005', type: 'ambulance', name: 'Praava Health ICU', ambulanceType: 'icu_ccu', contactNumber: '+880-1711-000005', eta: '18 min', safeRouteVerified: true, latitude: 23.7950, longitude: 90.4030, rating: 4.8, affiliation: 'Praava Health' },
    { id: 'amb-006', type: 'ambulance', name: 'DMCH Emergency Ambulance', ambulanceType: 'standard', contactNumber: '+880-1711-000006', eta: '20 min', safeRouteVerified: true, latitude: 23.7265, longitude: 90.3990, rating: 4.2, affiliation: 'Dhaka Medical College' },
    { id: 'amb-007', type: 'ambulance', name: 'Square Hospital Ambulance', ambulanceType: 'ac', contactNumber: '+880-1711-000007', eta: '14 min', safeRouteVerified: true, latitude: 23.7508, longitude: 90.3820, rating: 4.6, affiliation: 'Square Hospital' },
    { id: 'amb-008', type: 'ambulance', name: 'Ibn Sina ICU Ambulance', ambulanceType: 'icu_ccu', contactNumber: '+880-1711-000008', eta: '11 min', safeRouteVerified: true, latitude: 23.7455, longitude: 90.3738, rating: 4.7, affiliation: 'Ibn Sina Trust' },
    { id: 'amb-009', type: 'ambulance', name: 'Mirpur Fire & Rescue EMS', ambulanceType: 'standard', contactNumber: '+880-1711-000009', eta: '22 min', safeRouteVerified: false, latitude: 23.8060, longitude: 90.3690, rating: 4.0, affiliation: 'Fire Service BD' },
    { id: 'amb-010', type: 'ambulance', name: 'Gulshan Emergency Care', ambulanceType: 'ac', contactNumber: '+880-1711-000010', eta: '9 min', safeRouteVerified: true, latitude: 23.7840, longitude: 90.4120, rating: 4.5, affiliation: 'Gulshan Clinic' },
    // Pharmacies (7)
    { id: 'pharm-001', type: 'pharmacy', name: 'Lazz Pharma', address: 'Bashundhara R/A, Dhaka', isDeliveryAvailable: true, contactNumber: '+880-1711-100001', safeRouteVerified: true, latitude: 23.8140, longitude: 90.4260, rating: 4.5, affiliation: 'Lazz Group' },
    { id: 'pharm-002', type: 'pharmacy', name: 'ACME Pharmacy', address: 'Gulshan 2, Dhaka', isDeliveryAvailable: true, contactNumber: '+880-1711-100002', safeRouteVerified: true, latitude: 23.7920, longitude: 90.4150, rating: 4.4, affiliation: 'ACME Laboratories' },
    { id: 'pharm-003', type: 'pharmacy', name: 'Model Pharmacy', address: 'Vatara, Dhaka', isDeliveryAvailable: false, contactNumber: '+880-1711-100003', safeRouteVerified: false, latitude: 23.8090, longitude: 90.4190, rating: 4.2, affiliation: 'Independent' },
    { id: 'pharm-004', type: 'pharmacy', name: 'Nipa Drug House', address: 'Dhanmondi 27, Dhaka', isDeliveryAvailable: true, contactNumber: '+880-1711-100004', safeRouteVerified: true, latitude: 23.7465, longitude: 90.3760, rating: 4.3, affiliation: 'Independent' },
    { id: 'pharm-005', type: 'pharmacy', name: 'Gonoshasthaya Pharmacy', address: 'Panthapath, Dhaka', isDeliveryAvailable: false, contactNumber: '+880-1711-100005', safeRouteVerified: true, latitude: 23.7512, longitude: 90.3820, rating: 4.6, affiliation: 'Gonoshasthaya Kendra' },
    { id: 'pharm-006', type: 'pharmacy', name: 'Popular Pharmacy', address: 'Bakshibazar, Dhaka', isDeliveryAvailable: false, contactNumber: '+880-1711-100006', safeRouteVerified: false, latitude: 23.7260, longitude: 90.3985, rating: 4.1, affiliation: 'Popular Group' },
    { id: 'pharm-007', type: 'pharmacy', name: 'Square Pharmacy', address: 'Gulshan 1, Dhaka', isDeliveryAvailable: true, contactNumber: '+880-1711-100007', safeRouteVerified: true, latitude: 23.7935, longitude: 90.4175, rating: 4.7, affiliation: 'Square Group' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── BookingModal ─────────────────────────────────────────────────────────────
const BOOKINGS_KEY = 'resqher_bookings_v1';

function BookingModal({
    provider, visible, done, onDone, onClose,
}: {
    provider: any;
    visible: boolean;
    done: boolean;
    onDone: () => void;
    onClose: () => void;
}) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = name.trim() && phone.trim() && date.trim() && time.trim();

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const existing = await SecureStore.getItemAsync(BOOKINGS_KEY);
            const list: any[] = existing ? JSON.parse(existing) : [];
            const booking = {
                id: `bk-${Date.now()}`,
                providerName: provider.name,
                providerType: provider.type || provider.provider_type,
                affiliation: provider.affiliation || '',
                patientName: name.trim(),
                phone: phone.trim(),
                date: date.trim(),
                time: time.trim(),
                reason: reason.trim(),
                bookedAt: new Date().toISOString(),
            };
            list.unshift(booking);
            await SecureStore.setItemAsync(BOOKINGS_KEY, JSON.stringify(list));
            onDone();
        } catch {
            Alert.alert('Error', 'Could not save booking. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
                <View style={bm.backdrop}>
                    <View style={bm.card}>
                        <View style={bm.successIcon}>
                            <Ionicons name="checkmark-circle" size={52} color="#10B981" />
                        </View>
                        <Text style={bm.successTitle}>Booking Confirmed!</Text>
                        <Text style={bm.successSub}>
                            Your appointment with {provider.name} has been requested for {date} at {time}.
                            {'\n'}You will receive a confirmation shortly.
                        </Text>
                        <TouchableOpacity style={bm.successBtn} onPress={onClose} activeOpacity={0.85}>
                            <Text style={bm.successBtnTxt}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={bm.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={bm.card}>
                    {/* Header */}
                    <View style={bm.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={bm.headerTitle}>Book Appointment</Text>
                            <Text style={bm.headerSub} numberOfLines={1}>{provider.name} · {provider.affiliation || ''}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {[
                            { label: 'Full Name *', value: name, onChange: setName, placeholder: 'Enter your full name', keyboard: 'default' as const },
                            { label: 'Phone Number *', value: phone, onChange: setPhone, placeholder: '01XXXXXXXXX', keyboard: 'phone-pad' as const },
                            { label: 'Preferred Date *', value: date, onChange: setDate, placeholder: 'e.g. 20 Jun 2026', keyboard: 'default' as const },
                            { label: 'Preferred Time *', value: time, onChange: setTime, placeholder: 'e.g. 10:30 AM', keyboard: 'default' as const },
                            { label: 'Reason / Chief Complaint', value: reason, onChange: setReason, placeholder: 'Brief description of your concern', keyboard: 'default' as const },
                        ].map(field => (
                            <View key={field.label} style={bm.fieldWrap}>
                                <Text style={bm.fieldLabel}>{field.label}</Text>
                                <TextInput
                                    style={bm.fieldInput}
                                    value={field.value}
                                    onChangeText={field.onChange}
                                    placeholder={field.placeholder}
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    keyboardType={field.keyboard}
                                    autoCapitalize="words"
                                    selectionColor={T.violet}
                                />
                            </View>
                        ))}
                        <Text style={bm.note}>* Required fields. Booking requests are reviewed by the provider.</Text>
                    </ScrollView>

                    <TouchableOpacity
                        style={[bm.submitBtn, !canSubmit && bm.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!canSubmit || submitting}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="calendar-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={bm.submitBtnTxt}>{submitting ? 'Booking…' : 'Confirm Booking'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const bm = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    card: {
        backgroundColor: '#120C26', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36,
        maxHeight: '90%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
    fieldWrap: { marginBottom: 14 },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, marginBottom: 6 },
    fieldInput: {
        height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14,
        fontSize: 14, fontWeight: '600', color: '#fff',
    },
    note: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 18, lineHeight: 16 },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: T.violet, borderRadius: 14, height: 50,
        marginTop: 4,
    },
    submitBtnDisabled: { backgroundColor: 'rgba(138,56,246,0.35)' },
    submitBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
    successIcon: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
    successTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 10 },
    successSub: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    successBtn: {
        backgroundColor: '#10B981', borderRadius: 14, height: 50,
        alignItems: 'center', justifyContent: 'center',
    },
    successBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

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
    // Reset chip filter whenever category changes
    useEffect(() => { setSelectedChip('all'); }, [category]);

    // Auto-zoom map to show all filtered provider pins when chip or category changes
    useEffect(() => {
        if (!mapRef.current || sortedProviders.length === 0) return;
        const coords = sortedProviders
            .filter(p => p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0)
            .map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }));
        if (coords.length === 0) return;

        const delay = setTimeout(() => {
            if (coords.length === 1) {
                mapRef.current?.animateToRegion(
                    { latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 },
                    600
                );
            } else {
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 140, right: 60, bottom: 320, left: 60 },
                    animated: true,
                });
            }
        }, 300);
        return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChip, category]);
    const [selectedPin, setSelectedPin] = useState<string | null>(null);
    const [showCallout, setShowCallout] = useState(false);
    const [safeRoute, setSafeRoute] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const [returnFromWebView, setReturnFromWebView] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [bookingDone, setBookingDone] = useState(false);
    // Start with MOCK_PROVIDERS so pins are visible immediately.
    // Backend data replaces mock data if the server has seeded records.
    const [backendProviders, setBackendProviders] = useState<any[]>(MOCK_PROVIDERS);

    useEffect(() => {
        medicalService.getProviders().then((data: any[]) => {
            if (data && data.length > 0) {
                setBackendProviders(data);
            }
            // If backend returns empty, keep showing MOCK_PROVIDERS
        }).catch(() => { /* keep MOCK_PROVIDERS on error */ });
    }, []);

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
        let baseProviders: any[] = [];
        let mapped = backendProviders.map(p => ({
            ...p,
            latitude: Number(p.latitude) || 0,
            longitude: Number(p.longitude) || 0
        }));
        let filtered = mapped.filter(p => {
            const pType = (p.type || p.provider_type || '').toLowerCase();
            if (category === 'specialists') return pType === 'specialists';
            if (category === 'hospital')    return pType === 'hospital';
            if (category === 'ambulance')   return pType === 'ambulance';
            if (category === 'diagnostics') return pType === 'diagnostics';
            if (category === 'pharmacy')    return pType === 'pharmacy';
            if (category === 'others')      return pType === 'others' || pType === 'diagnostics';
            return true; // unknown category: show all
        });

        switch (category) {
            case 'specialists': {
                let docs = filtered.filter(d => shift === 'now' || d.shift === shift);
                if (selectedChip !== 'all') {
                    docs = docs.filter(d => d.specialty === selectedChip);
                }
                baseProviders = docs.map(d => ({
                    ...d,
                    safeRouteVerified: Boolean(d.safeRouteVerified || d.safe_route_verified),
                    icon: 'medkit' as const,
                }));
                break;
            }
            case 'hospital':
                baseProviders = filtered.map(h => ({
                    ...h,
                    safeRouteVerified: Boolean(h.safeRouteVerified || h.safe_route_verified),
                    icon: 'business' as const,
                }));
                break;
            case 'ambulance': {
                let ambs = [...filtered];
                if (selectedChip !== 'all') {
                    ambs = ambs.filter(a => (a.ambulanceType || a.ambulance_type) === selectedChip);
                }
                baseProviders = ambs.map(a => ({
                    ...a,
                    safeRouteVerified: Boolean(a.safeRouteVerified || a.safe_route_verified),
                    ambulanceType: a.ambulanceType || a.ambulance_type,
                    icon: 'car' as const,
                }));
                break;
            }
            case 'diagnostics':
                baseProviders = filtered.map(d => ({
                    ...d,
                    safeRouteVerified: Boolean(d.safeRouteVerified || d.safe_route_verified),
                    icon: 'flask' as const,
                }));
                break;
            case 'pharmacy':
                baseProviders = filtered.map(p => ({
                    ...p,
                    safeRouteVerified: Boolean(p.safeRouteVerified || p.safe_route_verified),
                    isDeliveryAvailable: Boolean(p.isDeliveryAvailable || p.is_delivery_available),
                    icon: 'bandage' as const,
                }));
                break;
            case 'others':
            default:
                // 'others' covers diagnostics + misc — show everything that passed the type filter
                baseProviders = filtered.map(p => ({
                    ...p,
                    safeRouteVerified: Boolean(p.safeRouteVerified || p.safe_route_verified),
                    icon: 'flask' as const,
                }));
                break;
        }
        
        // Uses backend API data when available, MOCK_PROVIDERS fallback otherwise
        return baseProviders;
    }, [category, shift, selectedChip, backendProviders]);

    // ── Sort providers by distance to user ──────────────────────────────────
    const sortedProviders = useMemo(() => {
        if (!userLoc) return providers.map(p => ({ ...p, distM: 0, distLabel: '' }));
        const EARTH_RADIUS_M = 6371000;
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        
        const dist = (p: {latitude: number, longitude: number}) => {
            const dLat = toRad(p.latitude - userLoc.latitude);
            const dLon = toRad(p.longitude - userLoc.longitude);
            const lat1 = toRad(userLoc.latitude);
            const lat2 = toRad(p.latitude);
            const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
            return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
        };

        return [...providers].map(p => {
            const m = dist(p);
            const km = (m / 1000).toFixed(1);
            return {
                ...p,
                distM: m,
                distLabel: m < 1000 ? `${Math.round(m)} m away` : `${km} km away`,
            };
        }).sort((a, b) => a.distM - b.distM);
    }, [providers, userLoc]);

    // ── Selected provider details ───────────────────────────────────────────
    const selectedProvider = useMemo(() =>
        sortedProviders.find(p => p.id === selectedPin) ?? null,
        [sortedProviders, selectedPin]
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

        const provider = sortedProviders.find(p => p.id === providerId);
        if (provider && userLoc) {
            // Zoom to show both user and provider
            mapRef.current?.fitToCoordinates(
                [userLoc, { latitude: provider.latitude, longitude: provider.longitude }],
                { edgePadding: { top: 120, right: 60, bottom: 360, left: 60 }, animated: true }
            );
        }
    }, [sortedProviders, userLoc, calloutY, calloutOpacity]);

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

    // ── Previous / Next near options ────────────────────────────────────────
    const handleNextPrev = useCallback((direction: 'next' | 'prev') => {
        if (!selectedPin || sortedProviders.length < 2) return;
        const idx = sortedProviders.findIndex(p => p.id === selectedPin);
        if (idx === -1) return;
        
        let newIdx = direction === 'next' ? idx + 1 : idx - 1;
        if (newIdx < 0) newIdx = sortedProviders.length - 1;
        if (newIdx >= sortedProviders.length) newIdx = 0;
        
        handlePinPress(sortedProviders[newIdx].id);
    }, [selectedPin, sortedProviders, handlePinPress]);

    // ── Book Now → open in-app booking modal ───────────────────────────────
    const handleBookNow = useCallback(() => {
        if (!selectedProvider) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setBookingDone(false);
        setBookingModalOpen(true);
    }, [selectedProvider]);

    // ── Nav press ───────────────────────────────────────────────────────────
    const handleNavPress = useCallback((tabId: string) => {
        if (tabId === 'Home') {
            router.replace('/(tabs)/users/standard-user/sos_screen' as any);
        } else if (tabId === 'Chat') {
            router.push('/(tabs)/users/standard-user/chat_home' as any);
        } else if (tabId === 'Explore') {
            router.push('/(tabs)/users/standard-user/ExploreScreen' as any);
        } else if (tabId === 'Medical') {
            router.push('/(tabs)/users/standard-user/MedicalDashboard' as any);
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
                    {/* Provider pins — icon and colour per category */}
                    {sortedProviders.map(p => {
                        const isSelected = selectedPin === p.id;
                        const cfg = PROVIDER_PIN[p.icon as keyof typeof PROVIDER_PIN] ?? PROVIDER_PIN.medkit;
                        const pinSize = isSelected ? 52 : 42;
                        const iconSize = isSelected ? 24 : 20;
                        return (
                            <Marker
                                key={p.id}
                                coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                                onPress={() => handlePinPress(p.id)}
                                tracksViewChanges={isSelected}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                {/* Padding wrapper so Android shadow doesn't clip the icon */}
                                <View style={{ padding: 4 }}>
                                    <View style={{
                                        width: pinSize, height: pinSize,
                                        borderRadius: pinSize / 2,
                                        backgroundColor: cfg.color,
                                        borderWidth: isSelected ? 3 : 2,
                                        borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.5)',
                                        alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden',
                                    }}>
                                        <Ionicons
                                            name={cfg.icon as any}
                                            size={iconSize}
                                            color="#FFFFFF"
                                        />
                                    </View>
                                </View>
                            </Marker>
                        );
                    })}
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
                        onPress={() => router.push('/(tabs)/users/standard-user/profile-menu' as any)}
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
                        {sortedProviders.length} {sortedProviders.length === 1 ? 'result' : 'results'}
                    </Text>
                </View>

                {/* ── Full Info Card — shows all provider details ── */}
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

                        {/* Header Row — Name + Type Badge + Close */}
                        <View style={st.calloutHeader}>
                            <View style={st.calloutIconWrap}>
                                <Ionicons name={selectedProvider.icon as any} size={22} color="#10B981" />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                                <Text style={st.calloutName} numberOfLines={2}>
                                    {selectedProvider.name}
                                </Text>
                                <View style={st.calloutBadgeRow}>
                                    <View style={st.typeBadge}>
                                        <Text style={st.typeBadgeText}>
                                            {(selectedProvider.type || selectedProvider.provider_type || category).toUpperCase()}
                                        </Text>
                                    </View>
                                    {selectedProvider.rating != null && (
                                        <View style={st.calloutMetaRow}>
                                            <Ionicons name="star" size={12} color="#F59E0B" />
                                            <Text style={st.calloutRating}>{Number(selectedProvider.rating).toFixed(1)}</Text>
                                        </View>
                                    )}
                                    {selectedProvider.safeRouteVerified && (
                                        <View style={st.safeBadge}>
                                            <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                                            <Text style={st.safeBadgeText}>Safe Route</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity style={st.dismissBtn} onPress={closeCallout} activeOpacity={0.7}>
                                <Ionicons name="close" size={16} color={D.muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Detail Rows */}
                        <View style={st.detailSection}>
                            {selectedProvider.affiliation ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="business-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>{selectedProvider.affiliation}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.address ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="location-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>{selectedProvider.address}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.degree ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="school-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>{selectedProvider.degree}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.specialty ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="medkit-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>{selectedProvider.specialty}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.shift ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="time-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>Shift: {selectedProvider.shift}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.eta ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="speedometer-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>ETA: {selectedProvider.eta}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.ambulanceType ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="car-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>Type: {selectedProvider.ambulanceType.toUpperCase()}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.contactNumber ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="call-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>{selectedProvider.contactNumber}</Text>
                                </View>
                            ) : null}
                            {selectedProvider.isDeliveryAvailable != null ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="bicycle-outline" size={14} color={D.muted} />
                                    <Text style={st.detailText}>
                                        Delivery: {selectedProvider.isDeliveryAvailable ? 'Available' : 'Not available'}
                                    </Text>
                                </View>
                            ) : null}
                            {selectedProvider.distLabel ? (
                                <View style={st.detailRow}>
                                    <Ionicons name="navigate-outline" size={14} color="#10B981" />
                                    <Text style={[st.detailText, { color: '#10B981', fontWeight: '700' }]}>
                                        {selectedProvider.distLabel}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        {/* Action Row */}
                        <View style={st.actionRow}>
                            {selectedProvider.bookingUrl ? (
                                <TouchableOpacity style={st.bookNowBtn} onPress={handleBookNow} activeOpacity={0.85}>
                                    <LinearGradient
                                        colors={['#10B981', '#059669']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        style={st.bookNowGradient}
                                    >
                                        <Text style={st.bookNowText}>Book Now</Text>
                                        <Ionicons name="arrow-forward" size={14} color={T.onPrimary} />
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : selectedProvider.contactNumber ? (
                                <TouchableOpacity style={st.callActionBtn} onPress={() => Haptics.selectionAsync()} activeOpacity={0.85}>
                                    <Ionicons name="call" size={16} color={T.onPrimary} />
                                    <Text style={st.callActionText}>Call</Text>
                                </TouchableOpacity>
                            ) : null}
                            {/* Pagination */}
                            {sortedProviders.length > 1 && (
                                <View style={st.paginationRow}>
                                    <TouchableOpacity style={st.navArrowBtn} onPress={() => handleNextPrev('prev')}>
                                        <Feather name="chevron-left" size={18} color={D.subtitle} />
                                    </TouchableOpacity>
                                    <Text style={st.paginationText}>
                                        {sortedProviders.findIndex(p => p.id === selectedPin) + 1}/{sortedProviders.length}
                                    </Text>
                                    <TouchableOpacity style={st.navArrowBtn} onPress={() => handleNextPrev('next')}>
                                        <Feather name="chevron-right" size={18} color={D.subtitle} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
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

            {/* ── Booking Modal ──────────────────────────────────────────────── */}
            {bookingModalOpen && selectedProvider && (
                <BookingModal
                    provider={selectedProvider}
                    visible={bookingModalOpen}
                    done={bookingDone}
                    onDone={() => setBookingDone(true)}
                    onClose={() => { setBookingModalOpen(false); setBookingDone(false); }}
                />
            )}
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

    // ── Provider pin marker ───────────────────────────────────────────────
    providerPin: {
        width: 44, height: 44, borderRadius: 22,
        borderWidth: 2.5,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'visible',
        ...Platform.select({
            ios: { shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 8 },
        }),
    },
    providerPinSelected: {
        width: 54, height: 54, borderRadius: 27,
        borderWidth: 3,
        ...Platform.select({
            ios: { shadowOpacity: 0.65, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 14 },
        }),
    },
    // kept for reference — not used in renders any more
    greenCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
    greenCircleActive: { transform: [{ scale: 1.2 }] },

    // ── Callout Info Card ────────────────────────────────────────────────────
    calloutWrap: {
        position: 'absolute', left: 14, right: 14,
        borderRadius: D.cardRadius, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
        zIndex: 250,
        ...Platform.select({
            ios: { shadowColor: '#10B981', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 10 },
        }),
    },
    calloutTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.92)' },
    calloutGrabberWrap: { alignItems: 'center', paddingTop: 10 },
    calloutGrabber: { width: 42, height: 4, borderRadius: 2, backgroundColor: T.lineBold, opacity: 0.75 },
    calloutHeader: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: S.s4, paddingTop: 12, paddingBottom: 10, gap: S.s3,
    },
    calloutIconWrap: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: 'rgba(16,185,129,0.15)',
        borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    calloutName: { fontSize: 15, fontWeight: '700', color: D.title, letterSpacing: -0.1 },
    calloutBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
    typeBadge: {
        backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    typeBadgeText: { fontSize: 9, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 },
    calloutMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    calloutRating: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
    safeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2,
    },
    safeBadgeText: { fontSize: 9, fontWeight: '700', color: '#10B981' },
    dismissBtn: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: D.hairline,
        alignItems: 'center', justifyContent: 'center',
    },
    detailSection: {
        paddingHorizontal: S.s4, paddingBottom: 12, gap: 7,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: 10,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    detailText: { fontSize: 12, fontWeight: '500', color: D.subtitle, flex: 1 },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: S.s4, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    bookNowBtn: {
        borderRadius: 12, overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    bookNowGradient: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    },
    bookNowText: { fontSize: 13, fontWeight: '800', color: T.onPrimary },
    callActionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#10B981', borderRadius: 12,
        paddingHorizontal: 16, paddingVertical: 10,
    },
    callActionText: { fontSize: 13, fontWeight: '800', color: T.onPrimary },
    paginationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    paginationText: { fontSize: 12, fontWeight: '700', color: D.subtitle },
    navArrowBtn: { padding: 4 },

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
        backgroundColor: T.violet,
        borderColor: T.violet,
    },
    chipText: {
        fontSize: 12, fontWeight: '600', color: D.muted,
    },
    chipTextActive: {
        color: '#fff', fontWeight: '700',
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

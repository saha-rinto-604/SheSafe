// ─── ResQher Medical Module — Seeded Mock Data ──────────────────────────────
// UIU / Bashundhara / Vatara demo context (Dhaka)
// V3.0 — All providers have map coordinates, ratings, and affiliations

import type {
    Doctor, Hospital, Ambulance, DiagnosticCenter,
    Pharmacy, RedZone, CategoryItem, QuickChip,
} from '../types/medical';

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════
export const CATEGORIES: CategoryItem[] = [
    { id: 'specialists', label: 'Specialists', icon: 'medkit-outline', description: 'Find specialist doctors' },
    { id: 'hospital', label: 'Hospitals', icon: 'business-outline', description: 'Navigate to hospitals' },
    { id: 'ambulance', label: 'Ambulance', icon: 'car-outline', description: 'Request ambulance' },
    { id: 'diagnostics', label: 'Diagnostics', icon: 'flask-outline', description: 'Lab & pathology' },
    { id: 'pharmacy', label: 'Pharmacy', icon: 'bandage-outline', description: 'Medicine delivery' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK SELECTOR CHIPS — Map bottom bar
// ═══════════════════════════════════════════════════════════════════════════════
export const SPECIALIST_CHIPS: QuickChip[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'Cardiologist', label: 'Cardiology', icon: 'heart-outline' },
    { id: 'Neurologist', label: 'Neurology', icon: 'pulse-outline' },
    { id: 'Pediatrician', label: 'Pediatrics', icon: 'people-outline' },
    { id: 'Orthopedic Surgeon', label: 'Orthopedics', icon: 'fitness-outline' },
    { id: 'Gynecologist', label: 'Gynecology', icon: 'female-outline' },
    { id: 'Dermatologist', label: 'Dermatology', icon: 'body-outline' },
];

export const AMBULANCE_CHIPS: QuickChip[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'standard', label: 'Standard', icon: 'car-outline' },
    { id: 'ac', label: 'AC', icon: 'snow-outline' },
    { id: 'icu_ccu', label: 'ICU/CCU', icon: 'medkit-outline' },
];

export const GENERIC_CHIPS: QuickChip[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTORS — with coordinates (Bashundhara / Gulshan / Banani area)
// ═══════════════════════════════════════════════════════════════════════════════
export const DOCTORS: Doctor[] = [
    {
        id: 'doc-001',
        name: 'Dr. Anika Sultana',
        degree: 'MBBS, FCPS (Cardiology)',
        hospital: 'Evercare Hospital',
        specialty: 'Cardiologist',
        shift: 'morning',
        safeRouteVerified: true,
        bookingUrl: 'https://www.evercaredhaka.com/appointments',
        latitude: 23.8173,
        longitude: 90.4280,
        rating: 4.9,
        affiliation: 'Evercare Hospital Dhaka',
    },
    {
        id: 'doc-002',
        name: 'Dr. Rafiq Hasan',
        degree: 'MBBS, MD (Neurology)',
        hospital: 'United Hospital',
        specialty: 'Neurologist',
        shift: 'evening',
        safeRouteVerified: true,
        bookingUrl: 'https://www.uhlbd.com/appointment',
        latitude: 23.7926,
        longitude: 90.4167,
        rating: 4.7,
        affiliation: 'United Hospital Ltd.',
    },
    {
        id: 'doc-003',
        name: 'Dr. Tasneem Akhter',
        degree: 'MBBS, MS (Orthopedics)',
        hospital: 'Popular Diagnostic Centre',
        specialty: 'Orthopedic Surgeon',
        shift: 'now',
        safeRouteVerified: false,
        bookingUrl: 'https://www.populardiagnostic.com/appointment',
        latitude: 23.7465,
        longitude: 90.3747,
        rating: 4.5,
        affiliation: 'Popular Diagnostic Centre',
    },
    {
        id: 'doc-004',
        name: 'Dr. Kabir Ahmed',
        degree: 'MBBS, FCPS (Gynecology)',
        hospital: 'Evercare Hospital',
        specialty: 'Gynecologist',
        shift: 'morning',
        safeRouteVerified: true,
        bookingUrl: 'https://www.evercaredhaka.com/appointments',
        latitude: 23.8180,
        longitude: 90.4275,
        rating: 4.8,
        affiliation: 'Evercare Hospital Dhaka',
    },
    {
        id: 'doc-005',
        name: 'Dr. Nusrat Jahan',
        degree: 'MBBS, DCH (Pediatrics)',
        hospital: 'United Hospital',
        specialty: 'Pediatrician',
        shift: 'now',
        safeRouteVerified: true,
        bookingUrl: 'https://www.uhlbd.com/appointment',
        latitude: 23.7935,
        longitude: 90.4175,
        rating: 4.9,
        affiliation: 'United Hospital Ltd.',
    },
    {
        id: 'doc-006',
        name: 'Dr. Faisal Rahman',
        degree: 'MBBS, FCPS (Dermatology)',
        hospital: 'Ibn Sina Hospital',
        specialty: 'Dermatologist',
        shift: 'evening',
        safeRouteVerified: true,
        bookingUrl: 'https://www.ibnsinatrust.com/appointment',
        latitude: 23.7450,
        longitude: 90.3730,
        rating: 4.6,
        affiliation: 'Ibn Sina Trust',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HOSPITALS
// ═══════════════════════════════════════════════════════════════════════════════
export const HOSPITALS: Hospital[] = [
    {
        id: 'hosp-001',
        name: 'Evercare Hospital',
        address: 'Plot 81, Block E, Bashundhara R/A, Dhaka',
        latitude: 23.8173,
        longitude: 90.4280,
        bookingUrl: 'https://www.evercaredhaka.com/appointments',
        safeRouteVerified: true,
        rating: 4.8,
        affiliation: 'Evercare Group',
    },
    {
        id: 'hosp-002',
        name: 'United Hospital',
        address: 'Plot 15, Road 71, Gulshan, Dhaka',
        latitude: 23.7926,
        longitude: 90.4167,
        bookingUrl: 'https://www.uhlbd.com/appointment',
        safeRouteVerified: true,
        rating: 4.7,
        affiliation: 'United Group',
    },
    {
        id: 'hosp-003',
        name: 'Popular Diagnostic Centre',
        address: 'House 16, Road 2, Dhanmondi, Dhaka',
        latitude: 23.7465,
        longitude: 90.3747,
        bookingUrl: 'https://www.populardiagnostic.com/appointment',
        safeRouteVerified: false,
        rating: 4.5,
        affiliation: 'Popular Group',
    },
    {
        id: 'hosp-004',
        name: 'Ibn Sina Hospital',
        address: 'House 48, Road 9/A, Dhanmondi, Dhaka',
        latitude: 23.7450,
        longitude: 90.3730,
        bookingUrl: 'https://www.ibnsinatrust.com/appointment',
        safeRouteVerified: true,
        rating: 4.6,
        affiliation: 'Ibn Sina Trust',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// AMBULANCES — with coordinates
// ═══════════════════════════════════════════════════════════════════════════════
export const AMBULANCES: Ambulance[] = [
    {
        id: 'amb-001',
        providerName: 'Evercare Ambulance',
        type: 'icu_ccu',
        contactNumber: '+880-1711-000001',
        eta: '8 min',
        safeRouteVerified: true,
        latitude: 23.8165,
        longitude: 90.4270,
        rating: 4.9,
        affiliation: 'Evercare Hospital',
    },
    {
        id: 'amb-002',
        providerName: 'United Rapid Response',
        type: 'ac',
        contactNumber: '+880-1711-000002',
        eta: '12 min',
        safeRouteVerified: true,
        latitude: 23.7940,
        longitude: 90.4160,
        rating: 4.7,
        affiliation: 'United Hospital',
    },
    {
        id: 'amb-003',
        providerName: 'Red Crescent Ambulance',
        type: 'standard',
        contactNumber: '+880-1711-000003',
        eta: '15 min',
        safeRouteVerified: false,
        latitude: 23.8100,
        longitude: 90.4220,
        rating: 4.3,
        affiliation: 'Bangladesh Red Crescent',
    },
    {
        id: 'amb-004',
        providerName: 'Bashundhara Medical',
        type: 'standard',
        contactNumber: '+880-1711-000004',
        eta: '10 min',
        safeRouteVerified: true,
        latitude: 23.8120,
        longitude: 90.4240,
        rating: 4.4,
        affiliation: 'Bashundhara Group',
    },
    {
        id: 'amb-005',
        providerName: 'Praava Health ICU',
        type: 'icu_ccu',
        contactNumber: '+880-1711-000005',
        eta: '18 min',
        safeRouteVerified: true,
        latitude: 23.7950,
        longitude: 90.4030,
        rating: 4.8,
        affiliation: 'Praava Health',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC CENTERS — with coordinates
// ═══════════════════════════════════════════════════════════════════════════════
export const DIAGNOSTICS: DiagnosticCenter[] = [
    {
        id: 'diag-001',
        name: 'Popular Diagnostic Centre',
        address: 'Bashundhara R/A Branch, Dhaka',
        bookingUrl: 'https://www.populardiagnostic.com/',
        safeRouteVerified: true,
        latitude: 23.8130,
        longitude: 90.4255,
        rating: 4.6,
        affiliation: 'Popular Group',
    },
    {
        id: 'diag-002',
        name: 'Ibn Sina Diagnostic',
        address: 'Gulshan Branch, Dhaka',
        bookingUrl: 'https://www.ibnsinatrust.com/',
        safeRouteVerified: true,
        latitude: 23.7900,
        longitude: 90.4140,
        rating: 4.5,
        affiliation: 'Ibn Sina Trust',
    },
    {
        id: 'diag-003',
        name: 'Praava Health Lab',
        address: 'Banani, Dhaka',
        bookingUrl: 'https://praavahealth.com/',
        safeRouteVerified: false,
        latitude: 23.7945,
        longitude: 90.4035,
        rating: 4.7,
        affiliation: 'Praava Health',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PHARMACIES — with coordinates
// ═══════════════════════════════════════════════════════════════════════════════
export const PHARMACIES: Pharmacy[] = [
    {
        id: 'pharm-001',
        name: 'Lazz Pharma',
        address: 'Bashundhara R/A, Dhaka',
        isDeliveryAvailable: true,
        contactNumber: '+880-1711-100001',
        safeRouteVerified: true,
        latitude: 23.8140,
        longitude: 90.4260,
        rating: 4.5,
        affiliation: 'Lazz Group',
    },
    {
        id: 'pharm-002',
        name: 'ACME Pharmacy',
        address: 'Gulshan 2, Dhaka',
        isDeliveryAvailable: true,
        contactNumber: '+880-1711-100002',
        safeRouteVerified: true,
        latitude: 23.7920,
        longitude: 90.4150,
        rating: 4.4,
        affiliation: 'ACME Laboratories',
    },
    {
        id: 'pharm-003',
        name: 'Model Pharmacy',
        address: 'Vatara, Dhaka',
        isDeliveryAvailable: false,
        contactNumber: '+880-1711-100003',
        safeRouteVerified: false,
        latitude: 23.8090,
        longitude: 90.4190,
        rating: 4.2,
        affiliation: 'Independent',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RED ZONES — Demo Seeder (Notun Bazar + Sayednagar)
// ═══════════════════════════════════════════════════════════════════════════════
export const RED_ZONES: RedZone[] = [
    {
        id: 'rz-001',
        latitude: 23.8150,
        longitude: 90.4250,
        label: 'Notun Bazar Hotspot',
        radiusMeters: 100,
        activatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    },
    {
        id: 'rz-002',
        latitude: 23.8200,
        longitude: 90.4180,
        label: 'Sayednagar Alert',
        radiusMeters: 100,
        activatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO SAFE ROUTE — UIU Campus → United Hospital (bypass Red Zones)
// ═══════════════════════════════════════════════════════════════════════════════
export const DEMO_SAFE_ROUTE = [
    { latitude: 23.8157, longitude: 90.4236 }, // UIU Campus
    { latitude: 23.8140, longitude: 90.4210 }, // Detour south
    { latitude: 23.8110, longitude: 90.4200 }, // Bypass Notun Bazar
    { latitude: 23.8070, longitude: 90.4180 }, // Continue south
    { latitude: 23.8030, longitude: 90.4170 }, // Approach Gulshan
    { latitude: 23.7970, longitude: 90.4165 }, // Gulshan connector
    { latitude: 23.7926, longitude: 90.4167 }, // United Hospital
];

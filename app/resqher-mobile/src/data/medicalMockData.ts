// ─── ResQher Medical Module — Seeded Mock Data ──────────────────────────────
// UIU / Bashundhara / Vatara demo context (Dhaka)
// V3.0 — All providers have map coordinates, ratings, and affiliations

import type { CategoryItem, QuickChip } from '../types/medical';

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════
export const CATEGORIES: CategoryItem[] = [
    { id: 'specialists', label: 'Specialists', icon: 'medkit-outline', description: 'Find specialist doctors' },
    { id: 'hospital', label: 'Hospitals', icon: 'business-outline', description: 'Navigate to hospitals' },
    { id: 'ambulance', label: 'Ambulance', icon: 'car-outline', description: 'Request ambulance' },
    { id: 'pharmacy', label: 'Pharmacy', icon: 'bandage-outline', description: 'Find nearby pharmacy' },
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

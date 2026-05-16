// ─── ResQher Medical Module Domain Types ────────────────────────────────────
// V3.0 — Map-Centric Discovery & Tactical Emergency Response

export type MedicalCategory =
    | 'specialists'
    | 'hospital'
    | 'ambulance'
    | 'diagnostics'
    | 'pharmacy';

export type ShiftFilter = 'morning' | 'evening' | 'now';

export type AmbulanceType = 'standard' | 'ac' | 'icu_ccu';

export interface Doctor {
    id: string;
    name: string;
    degree: string;
    hospital: string;
    specialty: string;
    shift: ShiftFilter;
    imageUrl?: string;
    phone?: string;
    safeRouteVerified: boolean;
    bookingUrl: string;
    latitude: number;
    longitude: number;
    rating?: number;
    affiliation?: string;
}

export interface Hospital {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    bookingUrl: string;
    safeRouteVerified: boolean;
    rating?: number;
    affiliation?: string;
}

export interface Ambulance {
    id: string;
    providerName: string;
    type: AmbulanceType;
    contactNumber: string;
    eta: string; // e.g. "12 min"
    safeRouteVerified: boolean;
    latitude: number;
    longitude: number;
    rating?: number;
    affiliation?: string;
}

export interface DiagnosticCenter {
    id: string;
    name: string;
    address: string;
    bookingUrl: string;
    safeRouteVerified: boolean;
    latitude: number;
    longitude: number;
    rating?: number;
    affiliation?: string;
}

export interface Pharmacy {
    id: string;
    name: string;
    address: string;
    isDeliveryAvailable: boolean;
    contactNumber: string;
    safeRouteVerified: boolean;
    latitude: number;
    longitude: number;
    rating?: number;
    affiliation?: string;
}

export interface RedZone {
    id: string;
    latitude: number;
    longitude: number;
    label: string;
    radiusMeters: number;
    /** ISO timestamp — active for 60 minutes */
    activatedAt: string;
}

export interface CategoryItem {
    id: MedicalCategory;
    label: string;
    icon: string; // Ionicons name
    description: string;
}

/** Union type for any map-pinnable provider */
export type MapProvider =
    | (Doctor & { _type: 'doctor' })
    | (Hospital & { _type: 'hospital' })
    | (Ambulance & { _type: 'ambulance' })
    | (DiagnosticCenter & { _type: 'diagnostics' })
    | (Pharmacy & { _type: 'pharmacy' });

/** Quick Selector Chip for bottom of map */
export interface QuickChip {
    id: string;
    label: string;
    icon: string; // Ionicons name
}

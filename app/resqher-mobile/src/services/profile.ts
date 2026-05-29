/**
 * profile.ts — User Profile Service (API + SecureStore fallback)
 * ─────────────────────────────────────────────────────────────────
 * Syncs profile data with the backend via API calls.
 * Falls back to SecureStore for offline resilience.
 *
 * All write operations hit the backend first, then update local cache.
 * Read operations try API first, then fall back to local cache.
 */

import * as SecureStore from 'expo-secure-store';
import api from './api';
import type { Identity, Role } from '../identity/identity.types';

// ── Storage key ──────────────────────────────────────────────────────────────
export const PROFILE_KEY = 'resqher_user_profile_v1';

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserProfile = {
    firstName: string;
    lastName: string;
    phone: string;
    /** ISO date string, e.g. "1995-06-15" */
    dobISO: string;
    gender: string;
    bloodGroup: string;
    medicalInfo: string[];
    homeAddress: string;
    /** Cloudinary URL from backend, or local URI from image picker */
    photoUri: string | null;
    verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | string | null;
    policeProfile?: {
        policeStationOrUnit?: string;
        badgeNumber?: string;
        nidCardUrl?: string;
        selfieUrl?: string;
        jobIdCardUrl?: string;
        rejectionReason?: string;
    } | null;
};

const DEFAULT_PROFILE: UserProfile = {
    firstName: '',
    lastName: '',
    phone: '+880 1XXX-XXXXXX',
    dobISO: '',
    gender: '',
    bloodGroup: '',
    medicalInfo: [],
    homeAddress: '',
    photoUri: null,
    verificationStatus: null,
    policeProfile: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Transform backend API response to local UserProfile shape. */
function apiToProfile(apiUser: any): UserProfile {
    return {
        firstName: apiUser.firstName || '',
        lastName: apiUser.lastName || '',
        phone: apiUser.phoneNumber || '+880 1XXX-XXXXXX',
        dobISO: apiUser.dobISO || '',
        gender: apiUser.gender || '',
        bloodGroup: apiUser.bloodGroup || '',
        medicalInfo: Array.isArray(apiUser.medicalInfo) ? apiUser.medicalInfo : [],
        homeAddress: apiUser.homeAddress || '',
        photoUri: apiUser.photoUrl || null,
        verificationStatus: apiUser.verificationStatus || null,
        policeProfile: apiUser.policeProfile || null,
    };
}

/** Cache profile locally for offline access. */
async function cacheLocally(profile: UserProfile): Promise<void> {
    try {
        await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
    } catch { /* best-effort cache */ }
}

/** Load cached profile from SecureStore. */
async function loadFromCache(): Promise<UserProfile> {
    try {
        const raw = await SecureStore.getItemAsync(PROFILE_KEY);
        if (raw) {
            const stored = JSON.parse(raw) as Partial<UserProfile>;
            return { ...DEFAULT_PROFILE, ...stored };
        }
    } catch { /* return defaults */ }
    return { ...DEFAULT_PROFILE };
}

/**
 * Fetch profile from backend API.
 * Falls back to local cache if API is unreachable.
 */
export async function getUserProfile(): Promise<UserProfile> {
    try {
        const { data } = await api.get('/api/users/me');
        if (data?.user) {
            const profile = apiToProfile(data.user);
            await cacheLocally(profile);
            return profile;
        }
    } catch (err) {
        console.log('[PROFILE] API fetch failed, using local cache:', (err as Error).message);
    }
    return loadFromCache();
}

/**
 * Save profile to backend API, then update local cache.
 * Sends PATCH /api/users/me with changed fields.
 */
export async function saveUserProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    const { data } = await api.patch('/api/users/me', {
        firstName: patch.firstName,
        lastName: patch.lastName,
        phoneNumber: patch.phone,
        dobISO: patch.dobISO,
        gender: patch.gender,
        bloodGroup: patch.bloodGroup,
        medicalInfo: patch.medicalInfo,
        homeAddress: patch.homeAddress,
    });

    if (data?.user) {
        const profile = apiToProfile(data.user);
        await cacheLocally(profile);
        return profile;
    }

    throw new Error('Unexpected response from server.');
}

/**
 * Upload profile photo to backend.
 * POST /api/users/me/photo (multipart/form-data)
 */
export async function uploadProfilePhoto(localUri: string): Promise<UserProfile> {
    const formData = new FormData();
    const filename = localUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('photo', {
        uri: localUri,
        name: filename,
        type,
    } as any);

    try {
        const { data } = await api.post('/api/users/me/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (data?.user) {
            const profile = apiToProfile(data.user);
            await cacheLocally(profile);
            return profile;
        }
    } catch (err) {
        console.log('[PROFILE] Photo upload failed:', (err as Error).message);
    }
    // Fallback: store local URI
    const current = await loadFromCache();
    const updated = { ...current, photoUri: localUri };
    await cacheLocally(updated);
    return updated;
}

/** Derive display name from first/last; falls back to "Your Name". */
export function displayName(profile: UserProfile): string {
    const full = `${profile.firstName} ${profile.lastName}`.trim();
    return full || 'Your Name';
}

/** Format an ISO date string to "DD MMM YYYY" for display. */
export function formatDob(isoDate: string): string {
    if (!isoDate) return '';
    try {
        return new Date(isoDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return isoDate;
    }
}

// ── Identity-layer bridge ────────────────────────────────────────────────────
export function toIdentity(
    profile: UserProfile,
    id: string | null,
    role: Role,
): Identity {
    return { ...profile, id, role };
}

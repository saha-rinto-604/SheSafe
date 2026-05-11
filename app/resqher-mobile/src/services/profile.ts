/**
 * profile.ts — Local user profile service
 * ─────────────────────────────────────────
 * Backs profile fields with SecureStore so Profile Menu, Profile Information,
 * and Edit Profile all read/write the same data.
 * TODO: Replace SecureStore stubs with PATCH / GET /api/v1/users/me/ calls
 *       when the backend profile endpoint is ready.
 */

import * as SecureStore from 'expo-secure-store';
import type { Identity, Role } from '../identity/identity.types';
// import api from './api'; // uncomment when backend is ready

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
    /** Local URI from image picker — cleared when synced to backend */
    photoUri: string;
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
    photoUri: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Load profile from SecureStore, filling in defaults for any missing fields. */
export async function getUserProfile(): Promise<UserProfile> {
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
 * Merge patch into the stored profile and persist.
 * Returns the updated profile.
 * TODO: also call PATCH /api/v1/users/me/ with the patch fields when backend is ready.
 */
export async function saveUserProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    const current = await getUserProfile();
    const updated: UserProfile = { ...current, ...patch };
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(updated));
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
// Converts a local UserProfile into the Identity shape consumed by AuthContext.
// The "id" and "role" come from the auth layer, not from SecureStore.
export function toIdentity(
    profile: UserProfile,
    id: string | null,
    role: Role,
): Identity {
    return { ...profile, id, role };
}

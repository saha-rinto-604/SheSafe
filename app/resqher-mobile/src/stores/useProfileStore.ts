/**
 * useProfileStore.ts — Global Profile State (Zustand)
 * ──────────────────────────────────────────────────────────────────────
 * Why Zustand instead of React Context:
 *   React Context re-renders every consumer on ANY state change.
 *   Zustand uses selectors — components only re-render when the specific
 *   slice they subscribe to changes. For a profile photo change, only
 *   the Drawer avatar, Home header, and Profile page re-render — not
 *   the entire component tree.
 *
 * Cache Busting:
 *   When the user uploads a new profile photo, the Cloudinary URL may stay
 *   the same (overwrite mode). `photoVersion` is a monotonically increasing
 *   counter appended as a query parameter (e.g., ?v=3) to force React Native's
 *   Image component to bypass its cache and fetch the new image.
 *
 * Usage in any component:
 *   const profile = useProfileStore(s => s.profile);
 *   const photoUri = useProfileStore(s => s.avatarUri);
 */

import { create } from 'zustand';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserProfile = {
  id: number;
  role: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  photoUrl: string;
  dobISO: string;
  gender: string;
  bloodGroup: string;
  medicalInfo: string[];
  homeAddress: string;
  entryTime?: string;
};

type ProfileState = {
  /** The current user profile, null if not loaded yet. */
  profile: UserProfile | null;

  /**
   * Monotonically increasing version counter for cache busting.
   * Append ?v={photoVersion} to photoUrl in <Image> source props.
   */
  photoVersion: number;

  /** Loading state for profile fetches. */
  loading: boolean;

  /** Derived avatar URI with cache buster. */
  avatarUri: string;

  // ── Actions ─────────────────────────────────────────────────────────────
  /** Fetch profile from backend GET /api/users/me. */
  fetchProfile: () => Promise<void>;

  /** Set profile directly (e.g., after signup/login response). */
  setProfile: (profile: UserProfile) => void;

  /** Update specific fields (e.g., after edit-profile save). */
  patchProfile: (patch: Partial<UserProfile>) => void;

  /** Set photo URL and bump version (e.g., after photo upload response). */
  setPhoto: (url: string) => void;

  /** Clear profile on logout. */
  clearProfile: () => void;
};

// ── Helper: build avatar URI with cache buster ───────────────────────────────
function buildAvatarUri(photoUrl: string, version: number): string {
  if (!photoUrl) return '';
  const separator = photoUrl.includes('?') ? '&' : '?';
  return `${photoUrl}${separator}v=${version}`;
}

// ── Store Definition ─────────────────────────────────────────────────────────
export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  photoVersion: 1,
  loading: false,
  avatarUri: '',

  fetchProfile: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/api/users/me');
      const profile = data.user as UserProfile;
      const version = get().photoVersion;
      set({
        profile,
        avatarUri: buildAvatarUri(profile.photoUrl, version),
        loading: false,
      });
    } catch (err) {
      console.error('[PROFILE_STORE] fetchProfile failed:', err);
      set({ loading: false });
    }
  },

  setProfile: (profile) => {
    const version = get().photoVersion;
    set({
      profile,
      avatarUri: buildAvatarUri(profile.photoUrl, version),
    });
  },

  patchProfile: (patch) => {
    const current = get().profile;
    if (!current) return;
    const updated = { ...current, ...patch };
    const version = patch.photoUrl !== undefined
      ? get().photoVersion + 1
      : get().photoVersion;
    set({
      profile: updated,
      photoVersion: version,
      avatarUri: buildAvatarUri(updated.photoUrl, version),
    });
  },

  setPhoto: (url) => {
    const current = get().profile;
    if (!current) return;
    const newVersion = get().photoVersion + 1;
    const updated = { ...current, photoUrl: url };
    set({
      profile: updated,
      photoVersion: newVersion,
      avatarUri: buildAvatarUri(url, newVersion),
    });
  },

  clearProfile: () => {
    set({ profile: null, photoVersion: 1, avatarUri: '' });
  },
}));

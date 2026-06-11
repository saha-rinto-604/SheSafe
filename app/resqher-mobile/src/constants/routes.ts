/**
 * routes.ts — Centralized navigation strings
 * ─────────────────────────────────────────────
 * Single source of truth for all Expo Router paths used programmatically.
 * File paths in app/ must match these strings exactly.
 */

import type { Role } from '../identity/identity.types';

// ── Per-role default landing screen after login / signup ─────────────────────
export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  USER: '/(tabs)/users/standard-user/sos_screen',
  VOLUNTEER: '/(tabs)/users/volunteer',
  POLICE: '/(tabs)/users/police/dashboard',
  ADMIN: '/(tabs)/users/admin/dashboard',
};

// ── Auth routes ──────────────────────────────────────────────────────────────
export const AUTH = {
  LOGIN: '/(auth)/login',
  ADMIN_LOGIN: '/(auth)/admin-login',
  SIGNUP: '/(auth)/signup',
} as const;

// ── Standard-user routes ─────────────────────────────────────────────────────
export const STANDARD_USER = {
  SOS: '/(tabs)/users/standard-user/sos_screen',
  EXPLORE: '/(tabs)/users/standard-user/ExploreScreen',
  PROFILE_MENU: '/(tabs)/users/standard-user/profile-menu',
  PROFILE_INFO: '/(tabs)/users/standard-user/profile-information',
  EDIT_PROFILE: '/(tabs)/users/standard-user/edit-profile',
  EMERGENCY_CONTACTS: '/(tabs)/users/standard-user/emergency-contacts',
  SAFETY_SETTINGS: '/(tabs)/users/standard-user/safety-settings',
  VOLUNTEER_VERIFICATION: '/(tabs)/users/standard-user/volunteer-verification',
  INCIDENT_HISTORY: '/(tabs)/users/standard-user/incident-history',
  PRIVACY_SECURITY: '/(tabs)/users/standard-user/privacy-security',
  CHAT_HOME: '/(tabs)/users/standard-user/chat_home',
  CHAT_ROOM: '/(tabs)/users/standard-user/chat_room',
  MEDICAL_DASHBOARD: '/(tabs)/users/standard-user/MedicalDashboard',
  MEDICAL_MAP: '/(tabs)/users/standard-user/MedicalMapView',
  NOTIFICATIONS: '/(tabs)/users/standard-user/notifications',
  BLOCKED_USERS: '/(tabs)/users/standard-user/blocked-users',
  CHANGE_PASSWORD: '/(tabs)/users/standard-user/change-password',
  TWO_FACTOR_AUTH: '/(tabs)/users/standard-user/two-factor-auth',
} as const;

// ── Volunteer routes ─────────────────────────────────────────────────────────
export const VOLUNTEER = {
  HOME: '/(tabs)/users/volunteer',
  DASHBOARD: '/(tabs)/users/volunteer/dashboard',
  CHAT_ROOM: '/(tabs)/users/volunteer/chat_room',
  MESSAGES: '/(tabs)/users/volunteer/messages',
  INCIDENTS: '/(tabs)/users/volunteer/incidents',
  ACTIVITY: '/(tabs)/users/volunteer/activity',
  MEDICAL: '/(tabs)/users/volunteer/medical',
  PROFILE_MENU: '/(tabs)/users/volunteer/profile-menu',
  NOTIFICATIONS: '/(tabs)/users/volunteer/notifications',
  VOLUNTEER_VERIFICATION: '/(tabs)/users/volunteer/volunteer-verification',
  INDEX: '/(tabs)/users/volunteer',
} as const;

// ── Police / Admin routes ────────────────────────────────────────────────────
export const POLICE = {
  DASHBOARD: '/(tabs)/users/police/dashboard',
  VERIFICATION: '/(tabs)/users/police/verification',
  PENDING: '/(tabs)/users/police/pending',
  REJECTED: '/(tabs)/users/police/rejected',
  MAP: '/(tabs)/users/police/live-map',
  NOTIFICATIONS: '/(tabs)/users/police/notifications',
} as const;

export function routeForPoliceStatus(
  status?: string | null,
  policeProfile?: { nidCardUrl?: string | null; selfieUrl?: string | null; jobIdCardUrl?: string | null } | null
) {
  const normalized = String(status || '').toUpperCase();
  if (!normalized || normalized === 'NOT_SUBMITTED' || normalized === 'NOT SUBMITTED' || !policeProfile) return POLICE.VERIFICATION;
  const hasRequiredDocuments = !!policeProfile?.nidCardUrl && !!policeProfile?.selfieUrl && !!policeProfile?.jobIdCardUrl;
  if (normalized === 'PENDING' && !hasRequiredDocuments) return POLICE.VERIFICATION;
  if (normalized === 'PENDING') return POLICE.PENDING;
  if (normalized === 'REJECTED') return POLICE.REJECTED;
  return POLICE.DASHBOARD;
}

export const ADMIN = {
  DASHBOARD: '/(tabs)/users/admin/dashboard',
} as const;

export function routeForRoleStatus(
  role: Role,
  verificationStatus?: string | null,
  user?: { policeProfile?: Parameters<typeof routeForPoliceStatus>[1] } | null
) {
  if (role === 'POLICE') {
    if (!verificationStatus) return ROLE_DEFAULT_ROUTE.POLICE;
    return routeForPoliceStatus(verificationStatus, user?.policeProfile);
  }
  if (role === 'VOLUNTEER') {
    const normalized = String(verificationStatus || '').trim().toLowerCase();
    if (!normalized || normalized === 'verified' || normalized === 'approved' || normalized === 'active') {
      return ROLE_DEFAULT_ROUTE.VOLUNTEER;
    }
    return VOLUNTEER.VOLUNTEER_VERIFICATION;
  }
  return ROLE_DEFAULT_ROUTE[role];
}

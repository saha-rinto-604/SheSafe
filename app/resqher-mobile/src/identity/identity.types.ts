/**
 * identity.types.ts — Shared identity type definitions
 * ─────────────────────────────────────────────────────────
 * "Who is this user?" lives here.
 * Role, Identity, and Permission are consumed by AuthContext,
 * usePermissions, profile.service, and screen-level guards.
 */

// ── Role ─────────────────────────────────────────────────────────────────────
export type Role = 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN';

// ── Identity ─────────────────────────────────────────────────────────────────
// Superset of what profile.ts calls UserProfile, plus role metadata.
// Screens read this from AuthContext.identityCache after login.
export type Identity = {
  /** Server-assigned user ID (opaque string). Null until first profile fetch. */
  id: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  /** ISO date string, e.g. "1995-06-15" */
  dobISO: string;
  gender: string;
  bloodGroup: string;
  medicalInfo: string[];
  homeAddress: string;
  /** Local URI from image picker */
  photoUri: string;
  /** Authenticated role for this session */
  role: Role;
};

// ── Permission ───────────────────────────────────────────────────────────────
// Actions that can be gated by role via usePermissions().can(action).
export type Permission =
  | 'view_medical_info'
  | 'accept_sos'
  | 'access_medical_dashboard'
  | 'file_case'
  | 'view_evidence'
  | 'manage_users'
  | 'view_incidents'
  | 'edit_own_profile';

// ── Per-role permission sets ─────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: ['view_medical_info', 'access_medical_dashboard', 'edit_own_profile'],
  VOLUNTEER: ['view_medical_info', 'accept_sos', 'access_medical_dashboard', 'view_incidents', 'edit_own_profile'],
  POLICE: ['file_case', 'accept_sos', 'view_evidence', 'view_incidents', 'edit_own_profile'],
  ADMIN: ['manage_users', 'view_evidence', 'view_incidents', 'file_case', 'accept_sos', 'edit_own_profile'],
};

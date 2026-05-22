/**
 * privacySecurity.ts — Privacy & Security service layer
 * ─────────────────────────────────────────────────────
 * All functions expose stable signatures that mirror expected REST endpoints.
 * Currently backed by local SecureStore stubs — replace the TODO blocks with
 * real api.post / api.get / api.delete calls when the backend is ready.
 */

import * as SecureStore from 'expo-secure-store';
// import api from './api'; // uncomment and use in TODO blocks when backend is ready

// ── Storage keys ──────────────────────────────────────────────────────────────
const TWO_FACTOR_KEY = 'shesafe_2fa_enabled_v1';
const BLOCKED_USERS_KEY = 'shesafe_blocked_users_v1';

// ── Types (export so screens can import them) ─────────────────────────────────
export type BlockedUser = {
    id: string;
    name: string;
};

// ── Seed data ─────────────────────────────────────────────────────────────────
const DUMMY_BLOCKED: BlockedUser[] = [
    { id: 'user-0001', name: 'John Doe' },
];

// ── Account Security ──────────────────────────────────────────────────────────

/**
 * Change the authenticated user's password.
 * TODO: replace stub with:
 *   await api.post('/api/v1/auth/change-password/', { current_password: currentPassword, new_password: newPassword });
 */
export async function changePassword(
    _currentPassword: string,
    _newPassword: string,
): Promise<void> {
    // Simulate network delay
    await new Promise<void>(resolve => setTimeout(resolve, 700));
    // No local persistence — passwords must never be stored client-side.
}

// ── Two-Factor Authentication ─────────────────────────────────────────────────

/**
 * Get current 2FA enabled state.
 * TODO: replace stub with:
 *   const res = await api.get('/api/v1/auth/2fa/');
 *   return res.data.enabled as boolean;
 */
export async function getTwoFactorState(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(TWO_FACTOR_KEY);
    return val === 'true';
}

/**
 * Enable or disable 2FA.
 * TODO: replace stub with:
 *   await api.post('/api/v1/auth/2fa/', { enabled });
 */
export async function setTwoFactorEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(TWO_FACTOR_KEY, enabled ? 'true' : 'false');
}

// ── Blocked Users ─────────────────────────────────────────────────────────────

/**
 * List all blocked users.
 * TODO: replace stub with:
 *   const res = await api.get('/api/v1/users/blocked/');
 *   return res.data as BlockedUser[];
 */
export async function listBlockedUsers(): Promise<BlockedUser[]> {
    const raw = await SecureStore.getItemAsync(BLOCKED_USERS_KEY);
    if (raw !== null) {
        try { return JSON.parse(raw) as BlockedUser[]; } catch { /* fall through to seed */ }
    }
    // First-run: seed with dummy data
    await SecureStore.setItemAsync(BLOCKED_USERS_KEY, JSON.stringify(DUMMY_BLOCKED));
    return [...DUMMY_BLOCKED];
}

/**
 * Unblock a user by id.
 * TODO: replace stub with:
 *   await api.delete(`/api/v1/users/blocked/${userId}/`);
 */
export async function unblockUser(userId: string): Promise<void> {
    const current = await listBlockedUsers();
    const updated = current.filter(u => u.id !== userId);
    await SecureStore.setItemAsync(BLOCKED_USERS_KEY, JSON.stringify(updated));
}

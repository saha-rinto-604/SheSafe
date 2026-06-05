/**
 * Privacy & Security service layer.
 */

import * as SecureStore from 'expo-secure-store';
import api from './api';

const TWO_FACTOR_KEY = 'resqher_2fa_enabled_v1';

export type ConnectedUser = {
    userId: number;
    displayName: string;
    role: 'standard_user' | 'volunteer' | string;
    avatarUrl: string | null;
    lastIncidentId: number | null;
    lastIncidentCode: string | null;
    lastConnectedAt: string | null;
    connectionLabel: string;
    isBlocked: boolean;
};

export type BlockedUser = {
    userId: number;
    displayName: string;
    role: 'standard_user' | 'volunteer' | string;
    avatarUrl: string | null;
    blockedAt: string | null;
    reason?: string | null;
};

export async function changePassword(
    _currentPassword: string,
    _newPassword: string,
): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 700));
}

export async function getTwoFactorState(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(TWO_FACTOR_KEY);
    return val === 'true';
}

export async function setTwoFactorEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(TWO_FACTOR_KEY, enabled ? 'true' : 'false');
}

export async function listConnectedUsers(): Promise<ConnectedUser[]> {
    const res = await api.get<{ success: boolean; data: ConnectedUser[] }>('/api/users/connected-users');
    return Array.isArray(res.data?.data) ? res.data.data : [];
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
    const res = await api.get<{ success: boolean; data: BlockedUser[] }>('/api/users/blocked-users');
    return Array.isArray(res.data?.data) ? res.data.data : [];
}

export async function blockUser(blockedUserId: number | string, reason?: string): Promise<void> {
    await api.post('/api/users/block', {
        blockedUserId: Number(blockedUserId),
        reason,
    });
}

export async function unblockUser(userId: number | string): Promise<void> {
    await api.delete(`/api/users/block/${userId}`);
}

import * as SecureStore from 'expo-secure-store';

// Scoped per logged-in user so two accounts on the same device never share notifications.
let _uid = 'anon';

const idxKey = () => `resqher_notif_index_${_uid}_v1`;
const seqKey = () => `resqher_notif_seq_${_uid}_v1`;
const seedKeyFor = () => `resqher_notif_seeded_${_uid}_v1`;

function recordKey(n: number) {
    return `resqher_notif_${_uid}_${n}`;
}

// In-memory unread count cache. -1 means not yet initialised from SecureStore.
let _unreadCount = -1;
const _subs: Set<(count: number) => void> = new Set();

function _emit(count: number) {
    _unreadCount = count;
    _subs.forEach(cb => cb(count));
}

/** Call after every login/logout so all subsequent store ops use the correct bucket. */
export function setCurrentUser(userId: string): void {
    _uid = userId || 'anon';
    _unreadCount = -1; // reset cache on user switch
}

/**
 * Subscribe to real-time unread count changes.
 * The callback fires immediately if the count is already cached.
 * Returns an unsubscribe function.
 */
export function subscribeUnread(cb: (count: number) => void): () => void {
    _subs.add(cb);
    if (_unreadCount >= 0) cb(_unreadCount);
    return () => { _subs.delete(cb); };
}

export type NotifType =
    | 'sos_triggered'
    | 'message_received'
    | 'volunteer_joined'
    | 'incident_resolved'
    | 'incident_cancelled'
    | 'system';

export interface AppNotification {
    n: number;
    id: string;
    type: NotifType;
    title: string;
    body: string;
    createdAt: string;
    read: boolean;
    incidentId?: string;
}

async function getIndex(): Promise<number[]> {
    const raw = await SecureStore.getItemAsync(idxKey());
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

async function saveIndex(idx: number[]): Promise<void> {
    await SecureStore.setItemAsync(idxKey(), JSON.stringify(idx));
}

async function nextSeq(): Promise<number> {
    const raw = await SecureStore.getItemAsync(seqKey());
    const n = raw ? parseInt(raw, 10) + 1 : 1;
    await SecureStore.setItemAsync(seqKey(), String(n));
    return n;
}

const MAX_NOTIFS = 50;

export const notificationStore = {
    async add(payload: Omit<AppNotification, 'n' | 'id' | 'read' | 'createdAt'> & { createdAt?: string }): Promise<void> {
        const n = await nextSeq();
        const notif: AppNotification = {
            n,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            read: false,
            ...payload,
            createdAt: payload.createdAt ?? new Date().toISOString(),
        };
        await SecureStore.setItemAsync(recordKey(n), JSON.stringify(notif));
        let idx = await getIndex();
        idx.push(n);
        if (idx.length > MAX_NOTIFS) {
            const toRemove = idx.splice(0, idx.length - MAX_NOTIFS);
            for (const old of toRemove) {
                await SecureStore.deleteItemAsync(recordKey(old));
            }
        }
        await saveIndex(idx);
        // Optimistically increment the cached count so subscribers get an instant update.
        if (_unreadCount >= 0) _emit(_unreadCount + 1);
    },

    async getAll(): Promise<AppNotification[]> {
        const idx = await getIndex();
        const results: AppNotification[] = [];
        for (const n of idx) {
            const raw = await SecureStore.getItemAsync(recordKey(n));
            if (!raw) continue;
            try { results.push(JSON.parse(raw)); } catch { /* skip corrupted */ }
        }
        return results.reverse();
    },

    async markAllRead(): Promise<void> {
        const idx = await getIndex();
        for (const n of idx) {
            const raw = await SecureStore.getItemAsync(recordKey(n));
            if (!raw) continue;
            try {
                const notif: AppNotification = JSON.parse(raw);
                if (!notif.read) {
                    notif.read = true;
                    await SecureStore.setItemAsync(recordKey(n), JSON.stringify(notif));
                }
            } catch { /* skip */ }
        }
        _emit(0);
    },

    async markRead(n: number): Promise<void> {
        const raw = await SecureStore.getItemAsync(recordKey(n));
        if (!raw) return;
        try {
            const notif: AppNotification = JSON.parse(raw);
            if (!notif.read) {
                notif.read = true;
                await SecureStore.setItemAsync(recordKey(n), JSON.stringify(notif));
                if (_unreadCount > 0) _emit(_unreadCount - 1);
            }
        } catch { /* skip */ }
    },

    async remove(n: number): Promise<void> {
        // Check whether the notification being removed was unread before deleting it.
        const raw = await SecureStore.getItemAsync(recordKey(n));
        let wasUnread = false;
        if (raw) {
            try { wasUnread = !JSON.parse(raw).read; } catch { /* ignore */ }
        }
        await SecureStore.deleteItemAsync(recordKey(n));
        const idx = await getIndex();
        await saveIndex(idx.filter(i => i !== n));
        if (wasUnread && _unreadCount > 0) _emit(_unreadCount - 1);
    },

    async getUnreadCount(): Promise<number> {
        const idx = await getIndex();
        let count = 0;
        for (const n of idx) {
            const raw = await SecureStore.getItemAsync(recordKey(n));
            if (!raw) continue;
            try {
                const notif: AppNotification = JSON.parse(raw);
                if (!notif.read) count++;
            } catch { /* skip */ }
        }
        _emit(count);
        return count;
    },
};

const DEFAULT_NOTIFS = [
    {
        type: 'system' as const,
        title: 'Welcome to ResQher',
        body: 'Your account is active and ready. Hold the SOS button for 3 seconds to trigger an emergency alert.',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        type: 'system' as const,
        title: 'Safe Zone Confirmed',
        body: 'A verified safe zone has been confirmed near Mirpur-10, Dhaka. Stay aware of your surroundings.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        type: 'system' as const,
        title: 'Privacy Checkup',
        body: 'Review your location sharing settings under Privacy & Security to stay in control of your data.',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        type: 'system' as const,
        title: 'Responders Near You',
        body: 'There are 5 active volunteers registered within 3 km of your location.',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
];

export async function seedDefaultNotifications(): Promise<void> {
    const already = await SecureStore.getItemAsync(seedKeyFor());
    if (already) return;
    for (const payload of DEFAULT_NOTIFS) {
        await notificationStore.add(payload);
    }
    await SecureStore.setItemAsync(seedKeyFor(), '1');
}

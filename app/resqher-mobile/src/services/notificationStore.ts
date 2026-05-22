import * as SecureStore from 'expo-secure-store';

const INDEX_KEY = 'shesafe_notif_index_v1';
const SEQ_KEY = 'shesafe_notif_seq_v1';
const MAX_NOTIFS = 50;

function recordKey(n: number) {
    return `shesafe_notif_${n}`;
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
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

async function saveIndex(idx: number[]): Promise<void> {
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(idx));
}

async function nextSeq(): Promise<number> {
    const raw = await SecureStore.getItemAsync(SEQ_KEY);
    const n = raw ? parseInt(raw, 10) + 1 : 1;
    await SecureStore.setItemAsync(SEQ_KEY, String(n));
    return n;
}

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
    },

    async markRead(n: number): Promise<void> {
        const raw = await SecureStore.getItemAsync(recordKey(n));
        if (!raw) return;
        try {
            const notif: AppNotification = JSON.parse(raw);
            notif.read = true;
            await SecureStore.setItemAsync(recordKey(n), JSON.stringify(notif));
        } catch { /* skip */ }
    },

    async remove(n: number): Promise<void> {
        await SecureStore.deleteItemAsync(recordKey(n));
        const idx = await getIndex();
        await saveIndex(idx.filter(i => i !== n));
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
        return count;
    },
};

const SEED_KEY = 'shesafe_notif_seeded_v1';

const DEFAULT_NOTIFS = [
    {
        type: 'system' as const,
        title: 'Welcome to SheSafe',
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
    const already = await SecureStore.getItemAsync(SEED_KEY);
    if (already) return;
    for (const payload of DEFAULT_NOTIFS) {
        await notificationStore.add(payload);
    }
    await SecureStore.setItemAsync(SEED_KEY, '1');
}

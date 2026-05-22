import * as SecureStore from 'expo-secure-store';
import type { Message } from '../types/chat';

const MAX_CACHED = 10;

interface Slim {
    id: string; sId: string; sN: string; sR: string;
    c: string; t: string; ts: string; eid?: string;
}

function cacheKey(incidentId: string) {
    return `shesafe_cc_${incidentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
}

function slim(m: Message): Slim {
    return {
        id: m.id, sId: m.sender.id, sN: m.sender.name,
        sR: m.sender.role, c: m.content.slice(0, 120),
        t: m.type, ts: m.timestamp,
        ...(m.evidenceId ? { eid: m.evidenceId } : {}),
    };
}

function expand(m: Slim, incidentId: string): Message {
    return {
        id: m.id, incidentId,
        sender: { id: m.sId, name: m.sN, role: m.sR as any },
        content: m.c, type: m.t as any,
        timestamp: m.ts,
        ...(m.eid ? { evidenceId: m.eid } : {}),
    };
}

export const chatStore = {
    async save(incidentId: string, messages: Message[]): Promise<void> {
        const last = messages.slice(-MAX_CACHED).map(slim);
        try {
            await SecureStore.setItemAsync(cacheKey(incidentId), JSON.stringify(last));
        } catch { /* storage full — best effort */ }
    },

    async load(incidentId: string): Promise<Message[]> {
        try {
            const raw = await SecureStore.getItemAsync(cacheKey(incidentId));
            if (!raw) return [];
            const parsed: Slim[] = JSON.parse(raw);
            return parsed.map(m => expand(m, incidentId));
        } catch { return []; }
    },
};

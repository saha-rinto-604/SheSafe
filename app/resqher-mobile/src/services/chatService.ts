// ─── ResQher Chat Service — API + Mock Data ─────────────────────────────────
// SF-04 — Backend-ready endpoints with mock data fallback

import api from './api';
import type { Incident, Message } from '../types/chat';

// ─── Mock Data ──────────────────────────────────────────────────────────────
const MOCK_INCIDENTS: Incident[] = [
    {
        id: 'inc-001',
        type: 'SOS Alert',
        status: 'LIVE',
        location: { latitude: 23.8103, longitude: 90.4125, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'I need help, someone is following me near Gulshan-2',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            timestamp: new Date(Date.now() - 60000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 3,
        createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    {
        id: 'inc-002',
        type: 'Medical Emergency',
        status: 'LIVE',
        location: { latitude: 23.7461, longitude: 90.3742, updatedAt: new Date(Date.now() - 120000).toISOString() },
        latestMessage: {
            content: 'Volunteer en route, ETA 4 minutes',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date(Date.now() - 30000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 2,
        createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    {
        id: 'inc-003',
        type: 'Harassment Report',
        status: 'RESOLVED',
        location: { latitude: 23.7806, longitude: 90.4194, updatedAt: new Date(Date.now() - 3600000).toISOString() },
        latestMessage: {
            content: 'Case filed. Reference: BD-2026-03-04-0891',
            sender: { id: 'p1', name: 'Officer Alam', role: 'POLICE' },
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 4,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
    'inc-001': [
        {
            id: 'm-sys-1', incidentId: 'inc-001',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Emergency incident created. Responders notified.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 300000).toISOString(),
        },
        {
            id: 'm1', incidentId: 'inc-001',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            content: 'I need help, someone is following me near Gulshan-2',
            type: 'TEXT', timestamp: new Date(Date.now() - 240000).toISOString(),
        },
        {
            id: 'm2', incidentId: 'inc-001',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'Stay calm, I\'m nearby. Can you share your exact location?',
            type: 'TEXT', timestamp: new Date(Date.now() - 180000).toISOString(),
        },
        {
            id: 'm3', incidentId: 'inc-001',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            content: 'I\'m at the bus stop opposite Gulshan-2 DCC market',
            type: 'TEXT', timestamp: new Date(Date.now() - 120000).toISOString(),
        },
        {
            id: 'm-sys-2', incidentId: 'inc-001',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: '📎 New evidence uploaded · [View]',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 90000).toISOString(),
            evidenceId: 'ev-001',
        },
        {
            id: 'm4', incidentId: 'inc-001',
            sender: { id: 'p1', name: 'Officer Alam', role: 'POLICE' },
            content: 'Unit dispatched to your location. Stay visible and in a lighted area.',
            type: 'TEXT', timestamp: new Date(Date.now() - 60000).toISOString(),
        },
        {
            id: 'm5', incidentId: 'inc-001',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'I can see you. Wearing a blue vest, approaching from the north side.',
            type: 'TEXT', timestamp: new Date(Date.now() - 30000).toISOString(),
        },
    ],
    'inc-002': [
        {
            id: 'm-sys-3', incidentId: 'inc-002',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Medical emergency reported. Nearest volunteers alerted.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 600000).toISOString(),
        },
        {
            id: 'm6', incidentId: 'inc-002',
            sender: { id: 'u2', name: 'Nadia Akter', role: 'USER' },
            content: 'My friend collapsed, we\'re at Dhanmondi Lake park area',
            type: 'TEXT', timestamp: new Date(Date.now() - 500000).toISOString(),
        },
        {
            id: 'm7', incidentId: 'inc-002',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'Volunteer en route, ETA 4 minutes',
            type: 'TEXT', timestamp: new Date(Date.now() - 30000).toISOString(),
        },
    ],
    'inc-003': [
        {
            id: 'm-sys-4', incidentId: 'inc-003',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Incident resolved by Officer Alam.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 1900000).toISOString(),
        },
        {
            id: 'm8', incidentId: 'inc-003',
            sender: { id: 'p1', name: 'Officer Alam', role: 'POLICE' },
            content: 'Case filed. Reference: BD-2026-03-04-0891',
            type: 'TEXT', timestamp: new Date(Date.now() - 1800000).toISOString(),
        },
    ],
};

// ─── Service ────────────────────────────────────────────────────────────────

export const chatService = {
    /** Fetch all incidents for the current user */
    async getIncidents(): Promise<Incident[]> {
        try {
            const res = await api.get('/api/v1/chat/incidents/');
            return res.data?.results ?? res.data;
        } catch {
            // Fallback to mock data when backend isn't available
            return MOCK_INCIDENTS;
        }
    },

    /** Fetch messages for an incident (paginated) */
    async getMessages(incidentId: string, _cursor?: string): Promise<Message[]> {
        try {
            const res = await api.get(`/api/v1/chat/${incidentId}/messages/`);
            return res.data?.results ?? res.data;
        } catch {
            return MOCK_MESSAGES[incidentId] ?? [];
        }
    },

    /** Send a message to an incident chat room */
    async sendMessage(
        incidentId: string,
        body: { content: string; type: 'TEXT' | 'IMAGE' | 'AUDIO' },
    ): Promise<Message> {
        try {
            const res = await api.post(`/api/v1/chat/${incidentId}/messages/`, body);
            return res.data;
        } catch {
            // Mock response for offline dev
            const msg: Message = {
                id: `m-${Date.now()}`,
                incidentId,
                sender: { id: 'self', name: 'You', role: 'USER' },
                content: body.content,
                type: body.type,
                timestamp: new Date().toISOString(),
            };
            return msg;
        }
    },

    /** Get a single incident by ID */
    async getIncident(incidentId: string): Promise<Incident | null> {
        try {
            const res = await api.get(`/api/v1/chat/incidents/${incidentId}/`);
            return res.data;
        } catch {
            return MOCK_INCIDENTS.find(i => i.id === incidentId) ?? null;
        }
    },
};

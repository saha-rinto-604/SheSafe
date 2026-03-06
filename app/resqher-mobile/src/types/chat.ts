// ─── ResQher Chat Domain Types ──────────────────────────────────────────────
// SF-04 — Incident Group Chat Messaging

export type Role = 'USER' | 'VOLUNTEER' | 'POLICE';
export type IncidentStatus = 'LIVE' | 'RESOLVED';
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'SYSTEM';

export interface Participant {
    id: string;
    name: string;
    role: Role;
    avatarUrl?: string;
}

export interface IncidentLocation {
    latitude: number;
    longitude: number;
    updatedAt: string;
}

export interface Message {
    id: string;
    incidentId: string;
    sender: Participant;
    content: string;
    type: MessageType;
    timestamp: string;
    /** URL for IMAGE type messages */
    mediaUrl?: string;
    /** Evidence vault reference for SYSTEM deep-links */
    evidenceId?: string;
}

export interface Incident {
    id: string;
    type: string;
    status: IncidentStatus;
    location: IncidentLocation;
    latestMessage?: Pick<Message, 'content' | 'sender' | 'timestamp' | 'type'>;
    participantCount: number;
    createdAt: string;
}

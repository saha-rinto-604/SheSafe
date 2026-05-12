// ─── ResQher Chat Domain Types ──────────────────────────────────────────────
// SF-04 — Incident Group Chat Messaging

// Central placeholder group name (easy to swap when backend provides it)
export const DEFAULT_GROUP_CHAT_NAME = 'ResQher Emergency Chat' as const;

export type Role = 'USER' | 'VOLUNTEER' | 'POLICE';
export type IncidentStatus = 'LIVE' | 'RESOLVED' | 'CANCELLED';
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'SYSTEM';

/**
 * Volunteer incident category:
 * ASSISTED     — volunteer responded to someone else's SOS (previously helped others)
 * MY_EMERGENCY — volunteer triggered their own SOS (they were the victim)
 */
export type IncidentCategory = 'ASSISTED' | 'MY_EMERGENCY';

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

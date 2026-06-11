// ─── SheSafe Chat Domain Types ──────────────────────────────────────────────
// SF-04 — Incident Group Chat Messaging

// Central placeholder group name (easy to swap when backend provides it)
export const DEFAULT_GROUP_CHAT_NAME = 'SheSafe Emergency Chat' as const;

export type Role = 'USER' | 'VOLUNTEER' | 'POLICE';
export type IncidentStatus = 'ACTIVE' | 'IN_PROGRESS' | 'LIVE' | 'RESOLVED' | 'CANCELLED';
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'SYSTEM' | 'VIDEO';

/**
 * Volunteer incident category:
 * ASSISTED     — volunteer responded to someone else's SOS (previously helped others)
 * MY_EMERGENCY — volunteer triggered their own SOS (they were the victim)
 */
export type IncidentCategory = 'ASSISTED' | 'MY_EMERGENCY';

export interface Participant {
    id: string;
    name: string;
    username?: string;
    notificationName?: string;
    role: Role;
    avatarUrl?: string;
}

export interface IncidentLocation {
    latitude: number;
    longitude: number;
    heading?: number | null;
    updatedAt: string;
    userId?: string;
    role?: Role | 'standard_user' | 'volunteer' | string;
}

export interface Message {
    id: string;
    incidentId: string;
    sender: Participant;
    content: string;
    type: MessageType;
    timestamp: string;
    /** URL for IMAGE/VIDEO type messages */
    mediaUrl?: string;
    mediaPublicId?: string;
    mediaMimeType?: string;
    mediaFilename?: string;
    mediaSizeBytes?: number;
    /** Evidence vault reference for SYSTEM deep-links */
    evidenceId?: string;
}

export interface Incident {
    id: string;
    type: string;
    status: IncidentStatus;
    location: IncidentLocation;
    address?: string | null;
    reporter?: string;
    reporterPhotoUrl?: string | null;
    latestMessage?: Pick<Message, 'content' | 'sender' | 'timestamp' | 'type'> | string | null;
    participantCount: number;
    acceptedAt?: string | null;
    createdAt: string;
}

export type LiveVideoRequestStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'STREAMING'
    | 'RECORDING'
    | 'STOPPED'
    | 'DECLINED'
    | 'EXPIRED'
    | 'FAILED'
    | 'COMPLETED';

export interface LiveVideoRequest {
    id: string;
    incidentId: string;
    requesterId: string;
    victimId: string;
    status: LiveVideoRequestStatus;
    createdAt?: string | null;
    updatedAt?: string | null;
    expiresAt?: string | null;
    requester?: {
        id: string;
        name?: string;
        username?: string;
        photoUrl?: string | null;
    };
}

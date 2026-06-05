export type IncidentChatOrderingInput = {
  id?: number | string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  lastMessageAt?: string | null;
  last_message_at?: string | null;
  latestMessageAt?: string | null;
  latest_message_at?: string | null;
  latest_message_created_at?: string | null;
  latestActivityAt?: string | null;
  latest_activity_at?: string | null;
  lastMessage?: {
    createdAt?: string | null;
    created_at?: string | null;
    timestamp?: string | null;
  } | null;
  latestMessage?: {
    createdAt?: string | null;
    created_at?: string | null;
    timestamp?: string | null;
  } | string | null;
};

export function parseIncidentChatTime(value: unknown): number {
  if (!value) return 0;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function getIncidentChatActivityTimestamp(incident: IncidentChatOrderingInput): string {
  const timestamp = getIncidentChatActivityCandidates(incident).find(value => parseIncidentChatTime(value) > 0);
  return String(timestamp ?? incident.createdAt ?? incident.created_at ?? new Date(0).toISOString());
}

export function getIncidentChatActivityTime(incident: IncidentChatOrderingInput): number {
  for (const timestamp of getIncidentChatActivityCandidates(incident)) {
    const time = parseIncidentChatTime(timestamp);
    if (time > 0) return time;
  }
  return 0;
}

export function compareIncidentChatsByLatestActivity<T extends IncidentChatOrderingInput>(a: T, b: T): number {
  const aTime = getIncidentChatActivityTime(a);
  const bTime = getIncidentChatActivityTime(b);
  const byVisibleAge = compareVisibleAgeBuckets(aTime, bTime);
  if (byVisibleAge !== 0) return byVisibleAge;
  const byIncidentId = incidentNumericId(b) - incidentNumericId(a);
  if (byIncidentId !== 0) return byIncidentId;
  return bTime - aTime;
}

export function sortIncidentChatsByLatestActivity<T extends IncidentChatOrderingInput>(incidents: readonly T[]): T[] {
  return [...incidents].sort(compareIncidentChatsByLatestActivity);
}

export function getIncidentChatCreatedTimestamp(incident: IncidentChatOrderingInput): string {
  const timestamp = [incident.createdAt, incident.created_at].find(value => parseIncidentChatTime(value) > 0);
  return String(timestamp ?? getIncidentChatActivityTimestamp(incident));
}

export function compareIncidentChatsByNewestIncident<T extends IncidentChatOrderingInput>(a: T, b: T): number {
  const byIncidentId = incidentNumericId(b) - incidentNumericId(a);
  if (byIncidentId !== 0) return byIncidentId;
  return parseIncidentChatTime(getIncidentChatCreatedTimestamp(b)) - parseIncidentChatTime(getIncidentChatCreatedTimestamp(a));
}

export function sortIncidentChatsByNewestIncident<T extends IncidentChatOrderingInput>(incidents: readonly T[]): T[] {
  return [...incidents].sort(compareIncidentChatsByNewestIncident);
}

function getIncidentChatActivityCandidates(incident: IncidentChatOrderingInput): unknown[] {
  const latestMessage = typeof incident.latestMessage === 'object' ? incident.latestMessage : null;
  return [
    incident.lastMessage?.createdAt,
    incident.lastMessage?.created_at,
    incident.lastMessage?.timestamp,
    latestMessage?.createdAt,
    latestMessage?.created_at,
    latestMessage?.timestamp,
    incident.lastMessageAt,
    incident.last_message_at,
    incident.latestMessageAt,
    incident.latest_message_at,
    incident.latest_message_created_at,
    incident.latestActivityAt,
    incident.latest_activity_at,
    incident.updatedAt,
    incident.updated_at,
    incident.createdAt,
    incident.created_at,
  ];
}

function incidentNumericId(incident: IncidentChatOrderingInput): number {
  const id = Number(String(incident.id ?? '').replace(/\D/g, ''));
  return Number.isFinite(id) ? id : 0;
}

function compareVisibleAgeBuckets(aTime: number, bTime: number): number {
  const aBucket = visibleAgeBucket(aTime);
  const bBucket = visibleAgeBucket(bTime);
  if (aBucket.group !== bBucket.group) return aBucket.group - bBucket.group;
  return aBucket.value - bBucket.value;
}

function visibleAgeBucket(time: number): { group: number; value: number } {
  if (time <= 0) return { group: 4, value: Number.MAX_SAFE_INTEGER };

  const diffMs = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return { group: 0, value: 0 };
  if (minutes < 60) return { group: 1, value: minutes };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { group: 2, value: hours };

  return { group: 3, value: Math.floor(hours / 24) };
}

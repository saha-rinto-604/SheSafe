import api from './api';

export const INCIDENT_ZONE_RADIUS_METERS = 200;

export interface IncidentZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  incidentCount: number;
  count: number;
  isRed?: boolean;
  isYellow?: boolean;
  incidents: { id: string; reporter: string; time: string; status: string }[];
}

export interface SafePlace {
  id: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  status?: string;
  radius: number;
  createdAt?: string;
}

export function normalizeIncidentZone(zone: any): IncidentZone | null {
  const latitude = Number(zone?.latitude ?? zone?.lat ?? zone?.center?.latitude ?? zone?.center?.lat);
  const longitude = Number(zone?.longitude ?? zone?.lng ?? zone?.center?.longitude ?? zone?.center?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.warn('[incidentService] Ignoring invalid incident zone:', zone?.id ?? zone?.name ?? zone);
    return null;
  }

  const incidents = Array.isArray(zone?.incidents) ? zone.incidents : [];
  const incidentCount = Number(
    zone?.incidentCount ??
    zone?.incident_count ??
    zone?.count ??
    zone?.total ??
    incidents.length ??
    0
  );
  const safeIncidentCount = Number.isFinite(incidentCount) ? incidentCount : 0;
  const isRed = safeIncidentCount >= 5;
  const isYellow = safeIncidentCount >= 1 && safeIncidentCount < 5;
  const fallbackId = `${zone?.name ?? 'zone'}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`;

  return {
    ...zone,
    id: String(zone?.id ?? fallbackId),
    name: String(zone?.name ?? 'Incident Zone'),
    latitude,
    longitude,
    radius: INCIDENT_ZONE_RADIUS_METERS,
    incidentCount: safeIncidentCount,
    count: safeIncidentCount,
    isRed,
    isYellow,
    incidents,
  };
}

export interface NearbyIncident {
  id: string;
  creatorUserId?: string;
  creatorRole?: string;
  victimName: string;
  avatarUri?: string | null;
  distanceKm: number;
  locationLabel: string;
  latitude: number;
  longitude: number;
  status: string;
  createdAt: string;
}

export type VolunteerNotificationType =
  | 'SOS_ALERT'
  | 'VOLUNTEER_SOS_ALERT'
  | 'MESSAGE'
  | 'INCIDENT_CANCELLED'
  | 'INCIDENT_RESOLVED'
  | 'RESPONDER_UPDATE'
  | 'GENERAL';

export interface VolunteerNotification {
  id: string;
  type: VolunteerNotificationType;
  title: string;
  body: string;
  relatedIncidentId?: string | null;
  relatedChatId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface AcceptedIncidentResponse {
  incident: {
    id: string;
    status: string;
    victimName: string;
    latitude: number;
    longitude: number;
    address: string | null;
    acceptedAt: string | null;
  };
  chatRoom: {
    incidentId: string;
    victimUserId: string;
    volunteerId: string;
  };
  responders?: IncidentRespondersResponse;
}

export interface IncidentResponder {
  id: string;
  name: string;
  photoUri?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  role: 'volunteer';
  acceptedAt?: string | null;
}

export interface IncidentSosUser {
  id: string;
  name: string;
  photoUri?: string | null;
  role: 'standard_user';
}

export interface IncidentChatParticipant {
  id: string;
  name: string;
  photoUri?: string | null;
  role?: string;
  status?: string | null;
  leftAt?: string | null;
  archivedAt?: string | null;
  deletedForUserAt?: string | null;
}

export interface IncidentRespondersResponse {
  incidentId: number | string;
  sosUser: IncidentSosUser;
  volunteers: IncidentResponder[];
  activeParticipants?: IncidentChatParticipant[];
  totalMembers: number;
  maxVolunteerResponders: number;
}

export interface IncidentMessageResponse {
  id: string;
  incidentId: string;
  senderId: string;
  senderName: string;
  senderRole: 'volunteer' | 'standard_user' | 'system' | string;
  senderPhotoUri?: string | null;
  text: string;
  createdAt: string;
}

export interface VolunteerCaseDetails {
  notes?: string;
  condition?: string;
  actionsTaken?: string;
  additionalInfo?: string;
  updatedAt?: string;
}

export interface IncidentRouteContext {
  incidentId: number | string;
  status: string;
  victim: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    photoUri?: string | null;
  };
  volunteer?: {
    id: string;
    name: string;
    latitude?: number | null;
    longitude?: number | null;
    photoUri?: string | null;
  } | null;
  volunteers?: Array<{
    id: string;
    name: string;
    latitude?: number | null;
    longitude?: number | null;
    photoUri?: string | null;
    acceptedAt?: string | null;
  }>;
}

export interface IncidentReviewPayload {
  volunteerId: string;
  rating: number;
  feedback?: string;
}

export interface VolunteerActivityLog {
  id: string;
  incidentId: string;
  status: 'ACTIVE' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED' | string;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt?: string | null;
  cancelledAt?: string | null;
  volunteer: {
    id: string;
    name: string;
    photoUri?: string | null;
  };
  victim: {
    id: string;
    name: string;
    photoUri?: string | null;
  };
}

export interface VolunteerLeaderboardRow {
  id: string;
  name: string;
  photoUri?: string | null;
  rank: number;
  points: number;
  resolvedIncidentCount: number;
  assistedIncidentCount: number;
  averageRating: number;
  ratingCount: number;
}

export interface VolunteerLeaderboardResponse {
  me: VolunteerLeaderboardRow | null;
  rankings: VolunteerLeaderboardRow[];
}

export interface VolunteerCertificateData {
  name: string;
  assistedIncidents: number;
  totalPoints: number;
}

export type LawEnforcementRequestStatus =
  | 'PENDING_ADMIN_REVIEW'
  | 'ASSIGNED_TO_POLICE'
  | 'ACCEPTED_BY_POLICE'
  | 'REJECTED_BY_POLICE'
  | 'RESOLVED'
  | 'CANCELLED';

export interface LawEnforcementStatus {
  exists: boolean;
  id?: string;
  incidentId?: string;
  status?: LawEnforcementRequestStatus;
  assignedPoliceId?: string | null;
  isAccepted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LawEnforcementAdminRequest {
  id: string;
  incidentId: string;
  incidentDisplayCode: string;
  requesterName: string;
  requesterRole: string;
  victimName: string;
  incidentStatus: string;
  address?: string | null;
  status: LawEnforcementRequestStatus;
  assignedPoliceId?: string | null;
  assignedPoliceName?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoliceTask {
  id: string;
  incidentId: string;
  incidentDisplayCode: string;
  victimName: string;
  incidentStatus: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  victimLiveLocation?: { latitude: number; longitude: number } | null;
  status: LawEnforcementRequestStatus;
  requestNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

function normalizeApiError(error: any) {
  const data = error?.response?.data;
  const next = new Error(data?.message || data?.detail || error?.message || 'Request failed') as Error & {
    code?: string;
    status?: number;
    maxResponders?: number;
  };
  next.code = data?.code;
  next.status = error?.response?.status;
  next.maxResponders = data?.maxResponders;
  return next;
}

export const incidentService = {
  async createIncident(payload: {
    latitude: number;
    longitude: number;
    address?: string;
    sourceRole?: 'standard_user' | 'volunteer' | string;
  }) {
    const res = await api.post('/api/incidents', payload);
    return res.data.incident as {
      id: number | string;
      latitude: number;
      longitude: number;
      address: string | null;
      status: string;
      created_at: string;
    };
  },

  async createSosIncident(payload: {
    latitude: number;
    longitude: number;
    address?: string;
    sourceRole?: 'standard_user' | 'volunteer' | string;
  }) {
    return this.createIncident(payload);
  },

  async cancelIncident(id: number | string) {
    const res = await api.patch(`/api/incidents/${id}/cancel`);
    return res.data.incident;
  },

  async resolveIncident(id: number | string) {
    const res = await api.patch(`/api/incidents/${id}/resolve`);
    return res.data.incident;
  },

  async getMyIncidents(): Promise<{
    id: number | string;
    incidentNumber?: number;
    latitude: number;
    longitude: number;
    location?: string;
    address?: string | null;
    occurredAt?: string;
    occurredAtLabel?: string;
    status: string;
    created_at?: string;
  }[]> {
    const res = await api.get('/api/incidents/my');
    return res.data.incidents ?? [];
  },

  async getOne(id: number | string) {
    const res = await api.get(`/api/incidents/${id}`);
    return res.data.incident;
  },

  async getZones(): Promise<IncidentZone[]> {
    const res = await api.get('/api/incidents/zones');
    return (res.data?.zones ?? [])
      .map(normalizeIncidentZone)
      .filter(Boolean) as IncidentZone[];
  },

  async getNearbyIncidents(location?: { latitude: number; longitude: number }): Promise<NearbyIncident[]> {
    const res = await api.get('/api/incidents/nearby', {
      params: location
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined,
    });
    return (res.data?.incidents ?? []) as NearbyIncident[];
  },

  async acceptIncident(id: number | string): Promise<AcceptedIncidentResponse> {
    try {
      const res = await api.post(`/api/incidents/${id}/accept`);
      return res.data as AcceptedIncidentResponse;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  async rejectIncident(id: number | string): Promise<{ incidentId: string; rejected: boolean }> {
    const res = await api.post(`/api/incidents/${id}/reject`);
    return res.data;
  },

  async getAssistedIncidents(search?: string) {
    const res = await api.get('/api/volunteer/incidents/assisted', {
      params: search?.trim() ? { search: search.trim() } : undefined,
    });
    return res.data?.incidents ?? [];
  },

  async getVolunteerAssistedIncidents(search?: string) {
    return this.getAssistedIncidents(search);
  },

  async getVolunteerNotifications(location?: { latitude: number; longitude: number }): Promise<VolunteerNotification[]> {
    const res = await api.get('/api/volunteer/notifications', {
      params: location
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined,
    });
    return (res.data?.notifications ?? []) as VolunteerNotification[];
  },

  async getUserIncidentChats(search?: string) {
    const res = await api.get('/api/user/incidents/chats', {
      params: search?.trim() ? { search: search.trim() } : undefined,
    });
    return res.data?.incidents ?? [];
  },

  async requestLawEnforcement(incidentId: number | string, requestNote?: string): Promise<LawEnforcementStatus> {
    try {
      const res = await api.post('/api/law-enforcement/request', { incidentId, requestNote });
      return res.data?.request;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  async getLawEnforcementStatus(incidentId: number | string): Promise<LawEnforcementStatus> {
    const res = await api.get(`/api/law-enforcement/incident/${incidentId}/status`);
    return res.data?.request ?? { exists: false };
  },

  async getPoliceTasks(): Promise<PoliceTask[]> {
    const res = await api.get('/api/police/tasks');
    return res.data?.tasks ?? [];
  },

  async acceptPoliceTask(requestId: number | string): Promise<LawEnforcementStatus> {
    const res = await api.post(`/api/police/tasks/${requestId}/accept`);
    return res.data?.request;
  },

  async rejectPoliceTask(requestId: number | string, reason?: string): Promise<LawEnforcementStatus> {
    const res = await api.post(`/api/police/tasks/${requestId}/reject`, { reason });
    return res.data?.request;
  },

  async resolvePoliceTask(requestId: number | string): Promise<LawEnforcementStatus> {
    const res = await api.post(`/api/police/tasks/${requestId}/resolve`);
    return res.data?.request;
  },

  async archiveChatForMe(id: number | string) {
    await api.patch(`/api/chat/${id}/archive-for-me`);
  },

  async deleteChatForMe(id: number | string) {
    await api.patch(`/api/chat/${id}/delete-for-me`);
  },

  async leaveChat(id: number | string) {
    await api.patch(`/api/chat/${id}/leave`);
  },

  async getIncidentResponders(id: number | string): Promise<IncidentRespondersResponse> {
    const res = await api.get(`/api/incidents/${id}/responders`);
    return res.data as IncidentRespondersResponse;
  },

  async getIncidentRouteContext(id: number | string): Promise<IncidentRouteContext> {
    const res = await api.get(`/api/incidents/${id}/route-context`);
    return res.data as IncidentRouteContext;
  },

  async getIncidentMessages(id: number | string): Promise<IncidentMessageResponse[]> {
    const res = await api.get(`/api/incidents/${id}/messages`);
    return res.data?.messages ?? [];
  },

  async sendIncidentMessage(id: number | string, text: string): Promise<IncidentMessageResponse> {
    const res = await api.post(`/api/incidents/${id}/messages`, { text });
    return res.data?.message;
  },

  async getVolunteerCaseDetails(id: number | string): Promise<VolunteerCaseDetails> {
    const res = await api.get(`/api/incidents/${id}/volunteer-case-details`);
    return res.data?.details ?? {};
  },

  async updateVolunteerCaseDetails(id: number | string, details: VolunteerCaseDetails): Promise<VolunteerCaseDetails> {
    const res = await api.put(`/api/incidents/${id}/volunteer-case-details`, {
      notes: details.notes ?? '',
      condition: details.condition ?? '',
      actionsTaken: details.actionsTaken ?? '',
    });
    return res.data?.details ?? {};
  },

  async getUserCaseDetails(id: number | string): Promise<VolunteerCaseDetails> {
    const res = await api.get(`/api/incidents/${id}/user-case-details`);
    return res.data?.details ?? {};
  },

  async updateUserCaseDetails(id: number | string, details: VolunteerCaseDetails): Promise<VolunteerCaseDetails> {
    const res = await api.put(`/api/incidents/${id}/user-case-details`, {
      notes: details.notes ?? '',
      condition: details.condition ?? '',
      additionalInfo: details.additionalInfo ?? '',
    });
    return res.data?.details ?? {};
  },

  async submitIncidentReview(id: number | string, payload: IncidentReviewPayload) {
    try {
      const res = await api.post(`/api/incidents/${id}/reviews`, {
        volunteerId: payload.volunteerId,
        rating: payload.rating,
        feedback: payload.feedback ?? '',
      });
      return res.data?.review;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  async getVolunteerActivity(): Promise<VolunteerActivityLog[]> {
    const res = await api.get('/api/volunteer/activity');
    return (res.data?.activities ?? []) as VolunteerActivityLog[];
  },

  async getVolunteerLeaderboard(): Promise<VolunteerLeaderboardResponse> {
    const res = await api.get('/api/volunteer/leaderboard');
    return {
      me: res.data?.me ?? null,
      rankings: res.data?.rankings ?? [],
    } as VolunteerLeaderboardResponse;
  },

  async getVolunteerCertificateData(): Promise<VolunteerCertificateData> {
    const res = await api.get('/api/volunteer/certificate-data');
    return {
      name: String(res.data?.name ?? ''),
      assistedIncidents: Number(res.data?.assistedIncidents ?? 0),
      totalPoints: Number(res.data?.totalPoints ?? 0),
    };
  },
};

export const safePlaceService = {
  async getSafePlaces(): Promise<SafePlace[]> {
    const res = await api.get('/api/safe-places');
    const places = res.data?.zones ?? res.data?.safePlaces ?? res.data?.items ?? [];
    return places.map((place: any) => ({
      ...place,
      id: String(place?.id),
      name: String(place?.name ?? 'Safe Place'),
      address: place?.address ?? null,
      latitude: Number(place?.latitude),
      longitude: Number(place?.longitude),
      description: place?.description ?? null,
      status: place?.status,
      radius: Number(place?.radius ?? 150),
      createdAt: place?.createdAt ?? place?.created_at,
    })).filter((place: SafePlace) =>
      Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    );
  },

  async submitSafePlace(payload: {
    latitude: number;
    longitude: number;
    name: string;
    address?: string | null;
    description: string;
  }): Promise<SafePlace> {
    const res = await api.post('/api/safe-places', payload);
    const place = res.data?.safePlace;
    return {
      ...place,
      id: String(place?.id),
      name: String(place?.name ?? payload.name),
      address: place?.address ?? payload.address ?? null,
      latitude: Number(place?.latitude ?? payload.latitude),
      longitude: Number(place?.longitude ?? payload.longitude),
      description: place?.description ?? payload.description,
      status: place?.status,
      radius: Number(place?.radius ?? 150),
      createdAt: place?.createdAt ?? place?.created_at,
    };
  },
};

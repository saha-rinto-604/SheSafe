import api from './api';
import {
  MOCK_INCIDENTS,
  MOCK_REPORTS,
  MOCK_SAFE_PLACES,
  MOCK_STANDARD_USERS,
  MOCK_VERIFICATIONS,
  MOCK_VOLUNTEERS,
  type MockIncident,
  type MockReport,
  type MockSafePlaceRequest,
  type MockPoliceUser,
  type MockStandardUser,
  type MockVerification,
  type MockVolunteer,
} from '../features/admin/_data/adminMockData';

export const USE_ADMIN_MOCKS = false;

type Id = string | number;

export type AdminOverview = {
  live: {
    activeSos: number;
    volunteersOnline: number;
    pendingVerifications: number;
    pendingSafePlaces: number;
    pendingReports: number;
  };
  totals: {
    totalUsers: number;
    standardUsers: number;
    totalVolunteers: number;
    verifiedVolunteers: number;
    totalIncidents: number;
    resolvedIncidents: number;
    cancelledIncidents: number;
    userReports: number;
  };
  quickActions: {
    activeIncidents: number;
    pendingVerifications: number;
    pendingSafePlaces: number;
    recentReports: number;
  };
};

export type AdminNotification = {
  id: string;
  type: 'info' | 'alert' | 'success';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

function normalizeError(error: any) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    'Admin request failed.';
  return new Error(message);
}

function timeLabel(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function roleLabel(role?: string | null) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'volunteer') return 'Volunteer';
  if (normalized === 'police' || normalized === 'law_enforcement' || normalized === 'law-enforcement') {
    return 'Police/Law Enforcement';
  }
  return 'Standard User';
}

function displayCode(id: string) {
  return id.startsWith('SOS-') || id.startsWith('#') ? id : `#${id}`;
}

export function mapIncidentToMock(item: any): MockIncident {
  const id = String(item?.id ?? '');
  const status = String(item?.status || 'ACTIVE').toUpperCase();
  return {
    id: displayCode(item?.displayCode || id),
    backendId: id,
    victim: item?.victim?.name || 'Unknown',
    location: item?.location?.address || 'Location unavailable',
    time: timeLabel(item?.createdAt),
    status: status === 'RESOLVED' ? 'RESOLVED' : status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
    volunteers: Number(item?.volunteerCount || item?.assignedVolunteers?.length || 0),
    policeEscalated: false,
    assignedVolunteers: (item?.assignedVolunteers || []).map((vol: any) => ({
      id: String(vol.id),
      name: vol.name || 'Volunteer',
      distance: vol.acceptedAt ? `Accepted ${timeLabel(vol.acceptedAt)}` : '',
    })),
    victimPhone: item?.victim?.phone || null,
    latitude: item?.location?.latitude,
    longitude: item?.location?.longitude,
    createdAt: item?.createdAt,
    updatedAt: item?.updatedAt,
    userCaseDetails: item?.userCaseDetails,
    volunteerCaseDetails: item?.volunteerCaseDetails,
  };
}

export function mapVerificationToMock(item: any): MockVerification {
  return {
    id: String(item?.id ?? ''),
    kind: 'volunteer',
    userId: item?.user?.id ? String(item.user.id) : undefined,
    typeLabel: item?.typeLabel || 'Volunteer Verification',
    name: item?.user?.name || 'Unknown',
    phone: item?.user?.phone || '',
    submitted: timeLabel(item?.submittedAt),
    idCardUrl: item?.idCardUrl || undefined,
    selfieUrl: item?.selfieUrl || undefined,
    certificateUrl: item?.certificateUrl || undefined,
    status: item?.status,
  };
}

export function mapPoliceVerificationToMock(item: any): MockVerification {
  const userId = item?.userId || item?.user?.id || item?.id;
  return {
    id: `police-${String(userId ?? '')}`,
    kind: 'police',
    userId: String(userId ?? ''),
    typeLabel: item?.typeLabel || 'Police/Law Enforcement Verification',
    name: item?.name || item?.user?.name || 'Unknown',
    phone: item?.phoneNumber || item?.phone || item?.user?.phone || '',
    submitted: timeLabel(item?.submittedAt),
    idCardUrl: item?.idCardUrl || item?.documents?.nidCardUrl || item?.nidCardUrl || undefined,
    selfieUrl: item?.selfieUrl || item?.documents?.selfieUrl || undefined,
    certificateUrl: item?.certificateUrl || item?.documents?.jobIdCardUrl || item?.jobIdCardUrl || undefined,
    jobIdCardUrl: item?.jobIdCardUrl || item?.documents?.jobIdCardUrl || undefined,
    policeStationOrUnit: item?.policeStationOrUnit || null,
    badgeNumber: item?.badgeNumber || null,
    status: item?.status || item?.verificationStatus,
  };
}

export function mapSafePlaceToMock(item: any): MockSafePlaceRequest {
  const status = String(item?.status || 'PENDING').toUpperCase();
  return {
    id: String(item?.id ?? ''),
    placeName: item?.name || 'Safe Place',
    location: item?.address || item?.location || 'Location unavailable',
    requestedBy: item?.requester?.name || 'Unknown',
    requesterPhone: item?.requester?.phone || null,
    userType: roleLabel(item?.requester?.role) as 'Standard User' | 'Volunteer',
    description: item?.description || '',
    date: timeLabel(item?.submittedAt),
    status: status === 'CONFIRMED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING',
    latitude: item?.latitude,
    longitude: item?.longitude,
    rejectionReason: item?.rejectionReason || null,
    reviewedAt: item?.reviewedAt ? timeLabel(item.reviewedAt) : null,
    reviewedBy: item?.reviewedBy?.name || null,
  };
}

export function mapReportToMock(item: any): MockReport {
  return {
    id: String(item?.id ?? ''),
    reported: item?.reportedUser?.name || 'Unknown',
    by: item?.reportedBy?.name || 'Unknown',
    date: timeLabel(item?.createdAt),
    reason: item?.reason || '',
    incidentId: item?.incidentId ? displayCode(String(item.incidentId)) : 'N/A',
    status: item?.status,
    actionNote: item?.actionNote || null,
  };
}

export function mapUserToStandard(item: any): MockStandardUser {
  return {
    id: String(item?.id ?? ''),
    name: item?.name || 'Unknown',
    phone: item?.phone || '',
    sosRequests: Number(item?.sosCount || 0),
    incidents: (item?.incidentHistory || []).map(mapIncidentToMock),
    accountStatus: item?.accountStatus || 'ACTIVE',
    warningCount: Number(item?.warningCount || 0),
    reportCount: Number(item?.reportCount || 0),
    joinedAt: item?.joinedAt,
  };
}

export function mapUserToVolunteer(item: any): MockVolunteer {
  return {
    id: String(item?.id ?? ''),
    name: item?.name || 'Unknown',
    phone: item?.phone || '',
    rank: Number(item?.rank || 0),
    points: Number(item?.points || 0),
    assistedCount: Number(item?.assistedIncidents || 0),
    assistedIncidents: (item?.assistedIncidentHistory || []).map(mapIncidentToMock),
    sosRequests: Number(item?.sosCount || 0),
    sosIncidents: (item?.incidentHistory || []).map(mapIncidentToMock),
    accountStatus: item?.accountStatus || 'ACTIVE',
    warningCount: Number(item?.warningCount || 0),
    reportCount: Number(item?.reportCount || 0),
    joinedAt: item?.joinedAt,
    isOnline: Boolean(item?.isOnline),
    verificationStatus: item?.verificationStatus || null,
  };
}

export function mapUserToPolice(item: any): MockPoliceUser {
  return {
    id: String(item?.id ?? ''),
    name: item?.name || 'Unknown',
    phone: item?.phone || '',
    accountStatus: item?.accountStatus || 'ACTIVE',
    warningCount: Number(item?.warningCount || 0),
    reportCount: Number(item?.reportCount || 0),
    joinedAt: item?.joinedAt,
    verificationStatus: item?.verificationStatus || null,
    policeStationOrUnit: item?.policeStationOrUnit || null,
    badgeNumber: item?.badgeNumber || null,
    jobIdCardUrl: item?.jobIdCardUrl || null,
    activePoliceRequests: Number(item?.activePoliceRequests || 0),
  };
}

async function request<T>(path: string, options?: { method?: 'get' | 'patch' | 'post'; body?: any; params?: any }): Promise<T> {
  try {
    const method = options?.method || 'get';
    const response = method === 'patch'
      ? await api.patch(path, options?.body || {}, { params: options?.params })
      : method === 'post'
        ? await api.post(path, options?.body || {}, { params: options?.params })
        : await api.get(path, { params: options?.params });
    return response.data as T;
  } catch (error) {
    throw normalizeError(error);
  }
}

export const adminService = {
  async getOverview() {
    if (__DEV__ && USE_ADMIN_MOCKS) {
      return {
        live: {
          activeSos: 4,
          volunteersOnline: 12,
          pendingVerifications: MOCK_VERIFICATIONS.length,
          pendingSafePlaces: MOCK_SAFE_PLACES.filter((p) => p.status === 'PENDING').length,
          pendingReports: MOCK_REPORTS.length,
        },
        totals: {
          totalUsers: 245,
          standardUsers: MOCK_STANDARD_USERS.length,
          totalVolunteers: MOCK_VOLUNTEERS.length,
          verifiedVolunteers: 38,
          totalIncidents: MOCK_INCIDENTS.length,
          resolvedIncidents: MOCK_INCIDENTS.filter((i) => i.status === 'RESOLVED').length,
          cancelledIncidents: MOCK_INCIDENTS.filter((i) => i.status === 'CANCELLED').length,
          userReports: MOCK_REPORTS.length,
        },
        quickActions: {
          activeIncidents: 4,
          pendingVerifications: MOCK_VERIFICATIONS.length,
          pendingSafePlaces: MOCK_SAFE_PLACES.filter((p) => p.status === 'PENDING').length,
          recentReports: MOCK_REPORTS.length,
        },
      } satisfies AdminOverview;
    }
    const data = await request<{ overview: AdminOverview }>('/api/admin/overview');
    return data.overview;
  },

  async getIncidents(status: 'LIVE' | 'RESOLVED' | 'CANCELLED' | 'ALL' = 'LIVE') {
    if (__DEV__ && USE_ADMIN_MOCKS) return MOCK_INCIDENTS;
    const data = await request<{ incidents: any[] }>('/api/admin/incidents', { params: { status } });
    return (data.incidents || []).map(mapIncidentToMock);
  },

  async getIncidentById(id: Id) {
    const data = await request<{ incident: any }>(`/api/admin/incidents/${id}`);
    return mapIncidentToMock(data.incident);
  },

  async getUsers(role: 'standard_user' | 'volunteer' | 'law_enforcement') {
    if (__DEV__ && USE_ADMIN_MOCKS) return role === 'volunteer' ? MOCK_VOLUNTEERS : MOCK_STANDARD_USERS;
    const data = await request<{ users: any[] }>('/api/admin/users', { params: { role } });
    if (role === 'volunteer') return (data.users || []).map(mapUserToVolunteer);
    if (role === 'law_enforcement') return (data.users || []).map(mapUserToPolice);
    return (data.users || []).map(mapUserToStandard);
  },

  async getUserById(id: Id, role?: 'standard_user' | 'volunteer' | 'law_enforcement') {
    const data = await request<{ user: any }>(`/api/admin/users/${id}`);
    if (role === 'volunteer') return mapUserToVolunteer(data.user);
    if (role === 'law_enforcement') return mapUserToPolice(data.user);
    return mapUserToStandard(data.user);
  },

  async warnUser(id: Id, reason: string) {
    const data = await request<{ user: any }>(`/api/admin/users/${id}/warn`, { method: 'patch', body: { reason } });
    return data.user;
  },

  async blockUser(id: Id, reason: string) {
    const data = await request<{ user: any }>(`/api/admin/users/${id}/block`, { method: 'patch', body: { reason } });
    return data.user;
  },

  async unblockUser(id: Id, reason?: string) {
    const data = await request<{ user: any }>(`/api/admin/users/${id}/unblock`, { method: 'patch', body: { reason } });
    return data.user;
  },

  async getVerifications(status: 'pending' | 'verified' | 'rejected' | 'all' = 'pending') {
    if (__DEV__ && USE_ADMIN_MOCKS) return MOCK_VERIFICATIONS;
    const policeStatusMap = {
      pending: 'PENDING',
      verified: 'APPROVED',
      rejected: 'REJECTED',
      all: 'ALL',
    } as const;
    const [volunteerData, policeData] = await Promise.all([
      request<{ verifications: any[] }>('/api/admin/verifications', { params: { status } }),
      request<{ policeVerifications: any[] }>('/api/admin/police/verifications', {
        params: { status: policeStatusMap[status] },
      }),
    ]);
    return [
      ...(volunteerData.verifications || []).map(mapVerificationToMock),
      ...(policeData.policeVerifications || []).map(mapPoliceVerificationToMock),
    ];
  },

  async getVerificationById(id: Id) {
    const data = await request<{ verification: any }>(`/api/admin/verifications/${id}`);
    return mapVerificationToMock(data.verification);
  },

  async approveVerification(id: Id) {
    const data = await request<{ verification: any }>(`/api/admin/verifications/${id}/approve`, { method: 'patch' });
    return mapVerificationToMock(data.verification);
  },

  async rejectVerification(id: Id, reason: string) {
    const data = await request<{ verification: any }>(`/api/admin/verifications/${id}/reject`, { method: 'patch', body: { reason } });
    return mapVerificationToMock(data.verification);
  },

  async getPoliceVerifications(status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' = 'PENDING') {
    const data = await request<{ policeVerifications: any[] }>('/api/admin/police/verifications', { params: { status } });
    return data.policeVerifications || [];
  },

  async approvePoliceVerification(userId: Id) {
    const data = await request<{ policeVerification: any }>(`/api/admin/police/verifications/${userId}/approve`, { method: 'patch' });
    return data.policeVerification;
  },

  async rejectPoliceVerification(userId: Id, reason: string) {
    const data = await request<{ policeVerification: any }>(`/api/admin/police/verifications/${userId}/reject`, { method: 'patch', body: { reason } });
    return data.policeVerification;
  },

  async getApprovedPolice() {
    const data = await request<{ police: any[] }>('/api/admin/police/approved');
    return data.police || [];
  },

  async getLawEnforcementRequests() {
    const data = await request<{ requests: any[] }>('/api/admin/law-enforcement/requests');
    return data.requests || [];
  },

  async getLawEnforcementRequest(requestId: Id) {
    const data = await request<{ request: any }>(`/api/admin/law-enforcement/requests/${requestId}`);
    return data.request;
  },

  async assignLawEnforcementRequest(requestId: Id, policeId?: Id | null, assignToAll = false) {
    const data = await request<{ request: any }>(
      `/api/admin/law-enforcement/requests/${requestId}/assign`,
      { method: 'post', body: assignToAll ? { assignToAll: true } : { policeId } }
    );
    return data.request;
  },

  async cancelLawEnforcementRequest(requestId: Id, reason?: string) {
    const data = await request<{ request: any }>(`/api/admin/law-enforcement/requests/${requestId}/cancel`, { method: 'post', body: { reason } });
    return data.request;
  },

  async getSafePlaces(status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'ALL' = 'PENDING') {
    if (__DEV__ && USE_ADMIN_MOCKS) return MOCK_SAFE_PLACES.filter((item) => item.status === 'PENDING');
    const data = await request<{ safePlaces: any[] }>('/api/admin/safe-places', { params: { status } });
    return (data.safePlaces || []).map(mapSafePlaceToMock);
  },

  async getSafePlaceById(id: Id) {
    const data = await request<{ safePlace: any }>(`/api/admin/safe-places/${id}`);
    return mapSafePlaceToMock(data.safePlace);
  },

  async approveSafePlace(id: Id) {
    const data = await request<{ safePlace: any }>(`/api/admin/safe-places/${id}/approve`, { method: 'patch' });
    return mapSafePlaceToMock(data.safePlace);
  },

  async rejectSafePlace(id: Id, reason: string) {
    const data = await request<{ safePlace: any }>(`/api/admin/safe-places/${id}/reject`, { method: 'patch', body: { reason } });
    return mapSafePlaceToMock(data.safePlace);
  },

  async getReports(status: 'PENDING' | 'ACTIONED' | 'ALL' = 'PENDING') {
    if (__DEV__ && USE_ADMIN_MOCKS) return status === 'ACTIONED' ? [] : MOCK_REPORTS;
    const data = await request<{ reports: any[] }>('/api/admin/reports', { params: { status } });
    return (data.reports || []).map(mapReportToMock);
  },

  async getReportById(id: Id) {
    const data = await request<{ report: any }>(`/api/admin/reports/${id}`);
    return mapReportToMock(data.report);
  },

  async dismissReport(id: Id, note?: string) {
    const data = await request<{ report: any }>(`/api/admin/reports/${id}/dismiss`, { method: 'patch', body: { note } });
    return mapReportToMock(data.report);
  },

  async warnFromReport(id: Id, note: string) {
    const data = await request<{ report: any }>(`/api/admin/reports/${id}/warn`, { method: 'patch', body: { note } });
    return mapReportToMock(data.report);
  },

  async blockFromReport(id: Id, note: string) {
    const data = await request<{ report: any }>(`/api/admin/reports/${id}/block`, { method: 'patch', body: { note } });
    return mapReportToMock(data.report);
  },

  async getNotifications() {
    const data = await request<{ items: AdminNotification[] }>('/api/admin/notifications');
    return data.items || [];
  },

  async getAuditLogs() {
    const data = await request<{ auditLogs: any[] }>('/api/admin/audit-logs');
    return data.auditLogs || [];
  },
};

export default adminService;

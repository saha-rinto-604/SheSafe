import api from './api';
import type { Message, Incident, Participant } from '../types/chat';

function toMessage(raw: any): Message {
  const isSystem = raw.type === 'SYSTEM' || raw.message_type === 'SYSTEM' || raw.senderRole === 'system';
  if (raw.senderName || raw.text) {
    return {
      id: String(raw.id),
      incidentId: String(raw.incidentId ?? raw.incident_id),
      sender: {
        id: String(raw.senderId ?? raw.sender_id),
        name: isSystem ? '' : raw.senderName ?? raw.name ?? '',
        role: raw.senderRole === 'volunteer' ? 'VOLUNTEER' : raw.senderRole === 'law_enforcement' ? 'POLICE' : 'USER',
        avatarUrl: raw.senderPhotoUri ?? raw.senderPhotoUrl ?? raw.photoUrl ?? raw.photo_url,
      },
      content: raw.text ?? raw.content ?? '',
      type: raw.type ?? raw.message_type ?? (isSystem ? 'SYSTEM' : 'TEXT'),
      timestamp: raw.createdAt ?? raw.timestamp ?? raw.created_at,
      mediaUrl: raw.mediaUrl ?? raw.media_url,
    };
  }

  return {
    id: String(raw.id),
    incidentId: String(raw.incidentId ?? raw.incident_id),
    sender: raw.sender
      ? {
          ...raw.sender,
          name: isSystem ? '' : raw.sender.name,
          avatarUrl: raw.sender.avatarUrl ?? raw.sender.photoUrl ?? raw.sender.photoUri,
        }
      : {
          id: String(raw.sender_id),
          name: isSystem ? '' : raw.name ?? '',
          role: raw.role ?? 'USER',
          avatarUrl: raw.senderPhotoUri ?? raw.senderPhotoUrl ?? raw.photoUrl ?? raw.photo_url,
        },
    content: raw.content,
    type: raw.type ?? raw.message_type ?? (isSystem ? 'SYSTEM' : 'TEXT'),
    timestamp: raw.timestamp ?? raw.created_at,
    mediaUrl: raw.mediaUrl ?? raw.media_url,
  };
}

export const chatService = {
  async getMessages(incidentId: string): Promise<Message[]> {
    const res = await api.get(`/api/incidents/${incidentId}/messages`);
    const msgs: any[] = res.data?.messages ?? [];
    return msgs.map(toMessage);
  },

  async sendMessage(
    incidentId: string,
    payload: { content: string; type?: 'TEXT' | 'IMAGE' | 'AUDIO' }
  ): Promise<Message> {
    const res = await api.post(`/api/incidents/${incidentId}/messages`, { text: payload.content, type: payload.type });
    return toMessage(res.data.message);
  },

  async joinIncident(incidentId: string): Promise<Participant[]> {
    const res = await api.post(`/api/chat/${incidentId}/join`);
    return (res.data?.participants ?? []) as Participant[];
  },

  async getActiveIncidents(): Promise<Incident[]> {
    const res = await api.get('/api/chat/active');
    return (res.data?.incidents ?? []) as Incident[];
  },

  async getAssistedIncidents(): Promise<Incident[]> {
    const res = await api.get('/api/volunteer/incidents/assisted');
    return (res.data?.incidents ?? []) as Incident[];
  },

  async getVolunteerAssistedIncidents(search?: string): Promise<Incident[]> {
    const res = await api.get('/api/volunteer/incidents/assisted', {
      params: search?.trim() ? { search: search.trim() } : undefined,
    });
    return (res.data?.incidents ?? []) as Incident[];
  },

  async archiveForMe(incidentId: string): Promise<void> {
    await api.patch(`/api/chat/${incidentId}/archive-for-me`);
  },

  async deleteForMe(incidentId: string): Promise<void> {
    await api.patch(`/api/chat/${incidentId}/delete-for-me`);
  },

  async leave(incidentId: string): Promise<void> {
    await api.patch(`/api/chat/${incidentId}/leave`);
  },
};

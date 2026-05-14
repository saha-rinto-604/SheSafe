import api from './api';
import type { Message, Incident, Participant } from '../types/chat';

function toMessage(raw: any): Message {
  return {
    id: String(raw.id),
    incidentId: String(raw.incidentId ?? raw.incident_id),
    sender: raw.sender ?? {
      id: String(raw.sender_id),
      name: raw.name ?? '',
      role: raw.role ?? 'USER',
    },
    content: raw.content,
    type: raw.type ?? raw.message_type ?? 'TEXT',
    timestamp: raw.timestamp ?? raw.created_at,
    mediaUrl: raw.mediaUrl ?? raw.media_url,
  };
}

export const chatService = {
  async getMessages(incidentId: string): Promise<Message[]> {
    const res = await api.get(`/api/chat/${incidentId}/messages`);
    const msgs: any[] = res.data?.messages ?? [];
    return msgs.map(toMessage);
  },

  async sendMessage(
    incidentId: string,
    payload: { content: string; type?: 'TEXT' | 'IMAGE' | 'AUDIO' }
  ): Promise<Message> {
    const res = await api.post(`/api/chat/${incidentId}/messages`, payload);
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
};

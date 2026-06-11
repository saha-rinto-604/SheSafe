import api from './api';
import type { Message, Incident, Participant } from '../types/chat';

function imageMimeType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return 'image/jpeg';
}

function toMessage(raw: any): Message {
  const isSystem = raw.type === 'SYSTEM' || raw.message_type === 'SYSTEM' || raw.senderRole === 'system';
  if (raw.senderName || raw.text) {
    return {
      id: String(raw.id),
      incidentId: String(raw.incidentId ?? raw.incident_id),
      sender: {
        id: String(raw.senderId ?? raw.sender_id),
        name: isSystem ? '' : raw.senderName ?? raw.name ?? '',
        username: raw.senderUsername ?? raw.username,
        notificationName: raw.senderNotificationName ?? raw.notificationName,
        role: raw.senderRole === 'volunteer' ? 'VOLUNTEER' : raw.senderRole === 'law_enforcement' ? 'POLICE' : 'USER',
        avatarUrl: raw.senderPhotoUri ?? raw.senderPhotoUrl ?? raw.photoUrl ?? raw.photo_url,
      },
      content: raw.text ?? raw.content ?? '',
      type: raw.type ?? raw.message_type ?? (isSystem ? 'SYSTEM' : 'TEXT'),
      timestamp: raw.createdAt ?? raw.timestamp ?? raw.created_at,
      mediaUrl: raw.mediaUrl ?? raw.media_url,
      mediaPublicId: raw.mediaPublicId ?? raw.media_public_id,
      mediaMimeType: raw.mediaMimeType ?? raw.media_mime_type,
      mediaFilename: raw.mediaFilename ?? raw.media_filename,
      mediaSizeBytes: raw.mediaSizeBytes ?? raw.media_size_bytes,
    };
  }

  return {
    id: String(raw.id),
    incidentId: String(raw.incidentId ?? raw.incident_id),
    sender: raw.sender
      ? {
          ...raw.sender,
          name: isSystem ? '' : raw.sender.name,
          username: raw.sender.username,
          notificationName: raw.sender.notificationName,
          avatarUrl: raw.sender.avatarUrl ?? raw.sender.photoUrl ?? raw.sender.photoUri,
        }
      : {
          id: String(raw.sender_id),
          name: isSystem ? '' : raw.name ?? '',
          username: raw.username,
          notificationName: raw.notificationName,
          role: raw.role ?? 'USER',
          avatarUrl: raw.senderPhotoUri ?? raw.senderPhotoUrl ?? raw.photoUrl ?? raw.photo_url,
        },
    content: raw.content,
    type: raw.type ?? raw.message_type ?? (isSystem ? 'SYSTEM' : 'TEXT'),
    timestamp: raw.timestamp ?? raw.created_at,
    mediaUrl: raw.mediaUrl ?? raw.media_url,
    mediaPublicId: raw.mediaPublicId ?? raw.media_public_id,
    mediaMimeType: raw.mediaMimeType ?? raw.media_mime_type,
    mediaFilename: raw.mediaFilename ?? raw.media_filename,
    mediaSizeBytes: raw.mediaSizeBytes ?? raw.media_size_bytes,
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

  async sendImage(incidentId: string, localUri: string): Promise<Message> {
    const formData = new FormData();
    const filename = localUri.split('/').pop()?.split('?')[0] || `chat-${Date.now()}.jpg`;
    formData.append('image', {
      uri: localUri,
      name: filename,
      type: imageMimeType(filename),
    } as any);
    const res = await api.post(`/api/chat/${incidentId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

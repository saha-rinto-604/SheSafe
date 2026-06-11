import * as FileSystem from 'expo-file-system/legacy';

import {
  API_BASE_URL,
  default as api,
  getAccessToken,
  NGROK_SKIP_BROWSER_WARNING_HEADER,
} from './api';
import type { LiveVideoRequest, Message } from '../types/chat';

type UploadError = Error & { status?: number; code?: string };

export const LIVE_VIDEO_MAX_BYTES = 60 * 1024 * 1024;
export const LIVE_VIDEO_CLIP_SECONDS = 20;

export type LiveStreamIceConfig = {
  iceServers: {
    urls: string | string[];
    username?: string;
    credential?: string;
  }[];
  hasTurn: boolean;
  role?: 'victim' | 'viewer' | string;
  request?: LiveVideoRequest | null;
};

const mimeByExtension: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
};

function createError(message: string, status?: number, code?: string): UploadError {
  const error = new Error(message) as UploadError;
  error.status = status;
  error.code = code;
  return error;
}

function getBackendMessage(data: any) {
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return '';
}

function getUriScheme(uri: string) {
  return uri.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase() || 'none';
}

function inferMimeType(uri: string) {
  const cleanUri = uri.split('?')[0];
  const extension = cleanUri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  return (extension && mimeByExtension[extension]) || 'video/mp4';
}

function inferExtension(mimeType: string, uri: string) {
  const cleanUri = uri.split('?')[0];
  const existing = cleanUri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (existing && mimeByExtension[existing]) return existing;
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/3gpp') return '3gp';
  return 'mp4';
}

async function normalizeUploadUri(sourceUri: string) {
  if (!sourceUri?.trim()) {
    throw createError('Invalid video file.', 400, 'INVALID_FILE_URI');
  }

  let normalizedUri = sourceUri.trim();
  const scheme = getUriScheme(normalizedUri);
  if (scheme === 'none' && normalizedUri.startsWith('/')) {
    normalizedUri = `file://${normalizedUri}`;
  }

  const mimeType = inferMimeType(normalizedUri);
  const extension = inferExtension(mimeType, normalizedUri);
  const filename = `live-safety-video-${Date.now()}.${extension}`;
  const uploadUri = FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}${filename}`
    : normalizedUri;

  try {
    if (getUriScheme(normalizedUri) === 'content') {
      if (!FileSystem.cacheDirectory) {
        throw createError('Invalid video file.', 400, 'CACHE_UNAVAILABLE');
      }
      await FileSystem.copyAsync({ from: normalizedUri, to: uploadUri });
      normalizedUri = uploadUri;
    }

    if (getUriScheme(normalizedUri) === 'file') {
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      if (!fileInfo.exists) {
        throw createError('Invalid video file.', 400, 'FILE_NOT_FOUND');
      }
      if ('size' in fileInfo && typeof fileInfo.size === 'number' && fileInfo.size > LIVE_VIDEO_MAX_BYTES) {
        throw createError('Video is too large. Please try again with a shorter recording.', 413, 'VIDEO_TOO_LARGE');
      }
      if (uploadUri !== normalizedUri) {
        await FileSystem.copyAsync({ from: normalizedUri, to: uploadUri });
        normalizedUri = uploadUri;
      }
    }
  } catch (error) {
    if ((error as UploadError)?.code) throw error;
    throw createError('Invalid video file.', 400, 'FILE_PREPARATION_FAILED');
  }

  return { uri: normalizedUri, mimeType, filename };
}

function normalizeRequest(raw: any): LiveVideoRequest | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    incidentId: String(raw.incidentId ?? raw.incident_id),
    requesterId: String(raw.requesterId ?? raw.requester_id),
    victimId: String(raw.victimId ?? raw.victim_id),
    status: raw.status,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    expiresAt: raw.expiresAt ?? raw.expires_at ?? null,
    requester: raw.requester,
  };
}

function normalizeMessage(raw: any): Message {
  const isSystem = raw?.type === 'SYSTEM' || raw?.message_type === 'SYSTEM' || raw?.senderRole === 'system';
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
          id: String(raw.senderId ?? raw.sender_id),
          name: isSystem ? '' : raw.senderName ?? '',
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

export const liveVideoService = {
  async requestLiveVideo(incidentId: string) {
    const res = await api.post(`/api/incidents/${incidentId}/live-video/request`);
    return {
      request: normalizeRequest(res.data?.request),
      autoStartAllowed: Boolean(res.data?.autoStartAllowed),
      created: res.data?.created !== false,
      message: res.data?.message,
    };
  },

  async getPendingLiveVideoRequest(incidentId: string) {
    const res = await api.get(`/api/incidents/${incidentId}/live-video/pending`);
    return {
      request: normalizeRequest(res.data?.request),
      autoStartAllowed: Boolean(res.data?.autoStartAllowed),
    };
  },

  async getLiveStreamIceConfig(incidentId: string): Promise<LiveStreamIceConfig> {
    const res = await api.get(`/api/incidents/${incidentId}/live-stream/ice-config`);
    return {
      iceServers: Array.isArray(res.data?.iceServers) ? res.data.iceServers : [],
      hasTurn: Boolean(res.data?.hasTurn),
      role: res.data?.role,
      request: normalizeRequest(res.data?.request),
    };
  },

  async respondLiveVideoRequest(
    incidentId: string,
    requestId: string,
    action: 'APPROVED' | 'DECLINED' | 'STOPPED',
  ) {
    const res = await api.post(`/api/incidents/${incidentId}/live-video/respond`, { requestId, action });
    return {
      request: normalizeRequest(res.data?.request),
      message: res.data?.message,
    };
  },

  async uploadLiveVideo(incidentId: string, sourceUri: string) {
    if (!API_BASE_URL) {
      throw createError('Video upload failed. Please check your connection and try again.', undefined, 'API_CONFIG_ERROR');
    }

    const token = await getAccessToken();
    if (!token) {
      throw createError('Your session expired. Please log in again.', 401, 'NO_ACCESS_TOKEN');
    }

    const prepared = await normalizeUploadUri(sourceUri);
    const endpoint = `/api/incidents/${incidentId}/live-video/upload`;
    const url = `${API_BASE_URL}${endpoint}`;
    const fileInfo = await FileSystem.getInfoAsync(prepared.uri);
    const fileSizeBytes = fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number'
      ? fileInfo.size
      : null;
    console.info('[LiveSafetyVideo] clip ready for backend upload', {
      fileSizeMb: fileSizeBytes == null ? null : Number((fileSizeBytes / (1024 * 1024)).toFixed(2)),
      uriScheme: getUriScheme(prepared.uri),
      endpoint,
      durationTargetSeconds: LIVE_VIDEO_CLIP_SECONDS,
    });

    try {
      const response = await FileSystem.uploadAsync(url, prepared.uri, {
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'video',
        mimeType: prepared.mimeType,
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true',
        },
      });

      let data: any = {};
      try {
        data = response.body ? JSON.parse(response.body) : {};
      } catch {
        data = {};
      }

      const backendMessage = getBackendMessage(data);
      if (response.status < 200 || response.status >= 300) {
        if (response.status === 413) {
          throw createError('Video is too large. Please try again with a shorter recording.', response.status, 'VIDEO_TOO_LARGE');
        }
        throw createError(
          backendMessage || 'Video upload failed. Please check your connection and try again.',
          response.status,
          'UPLOAD_REJECTED',
        );
      }

      return {
        request: normalizeRequest(data?.request),
        message: data?.message ? normalizeMessage(data.message) : null,
        video: data?.video,
      };
    } catch (error) {
      if ((error as UploadError)?.status || (error as UploadError)?.code) throw error;
      throw createError('Video upload failed. Please check your connection and try again.', undefined, 'UPLOAD_NETWORK_ERROR');
    }
  },
};

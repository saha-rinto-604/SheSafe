import * as FileSystem from 'expo-file-system/legacy';

import {
  API_BASE_URL,
  getAccessToken,
  NGROK_SKIP_BROWSER_WARNING_HEADER,
} from './api';

export type VerificationDocumentType = 'id_card' | 'selfie' | 'certificate';

type UploadError = Error & { status?: number; code?: string };

const isDevelopment = process.env.NODE_ENV !== 'production';

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

function createUploadError(message: string, status?: number, code?: string): UploadError {
  const error = new Error(message) as UploadError;
  error.status = status;
  error.code = code;
  return error;
}

function getUriScheme(uri: string) {
  return uri.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase() || 'none';
}

function inferMimeType(uri: string) {
  const cleanUri = uri.split('?')[0];
  const extension = cleanUri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  return (extension && mimeByExtension[extension]) || 'image/jpeg';
}

async function normalizeUploadUri(uri: string, type: VerificationDocumentType, filename: string) {
  if (!uri?.trim()) {
    throw createUploadError('Please select a valid image and try again.', 400, 'INVALID_FILE_URI');
  }

  let normalizedUri = uri.trim();
  const scheme = getUriScheme(normalizedUri);
  if (scheme === 'none' && normalizedUri.startsWith('/')) {
    normalizedUri = `file://${normalizedUri}`;
  }

  try {
    const uploadUri = FileSystem.cacheDirectory
      ? `${FileSystem.cacheDirectory}${filename}`
      : normalizedUri;

    if (getUriScheme(normalizedUri) === 'content') {
      if (!FileSystem.cacheDirectory) {
        throw createUploadError('The selected image could not be prepared for upload. Please select it again.', 400, 'CACHE_UNAVAILABLE');
      }
      await FileSystem.copyAsync({ from: normalizedUri, to: uploadUri });
      normalizedUri = uploadUri;
    }

    if (getUriScheme(normalizedUri) === 'file') {
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      if (!fileInfo.exists) {
        throw createUploadError('The selected image is no longer available. Please select it again.', 400, 'FILE_NOT_FOUND');
      }
      if (uploadUri !== normalizedUri) {
        await FileSystem.copyAsync({ from: normalizedUri, to: uploadUri });
        normalizedUri = uploadUri;
      }
    }
  } catch (error) {
    if ((error as UploadError)?.code) throw error;
    if (isDevelopment) {
      console.log('[verification upload] file preparation failed', {
        type,
        uriScheme: getUriScheme(normalizedUri),
      });
    }
    throw createUploadError(
      'The selected image could not be prepared for upload. Please select it again.',
      400,
      'FILE_PREPARATION_FAILED',
    );
  }

  return normalizedUri;
}

function getBackendMessage(data: any) {
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return '';
}

function messageForStatus(status: number, backendMessage: string) {
  if (status === 401) return 'Your session expired. Please log in again.';
  if (status === 413) return 'File is too large. Please upload a smaller image.';
  if (status >= 500) return 'Document upload failed. Please try again.';
  if (status === 400) return backendMessage || 'Please select a valid image and try again.';
  return backendMessage || 'Document upload failed. Please try again.';
}

export function isUploadedVerificationDocument(uri?: string) {
  return Boolean(uri && /^https?:\/\//i.test(uri));
}

export async function uploadVerificationDocument(
  type: VerificationDocumentType,
  sourceUri: string,
): Promise<string | null> {
  if (!API_BASE_URL) {
    throw createUploadError(
      'Document upload could not reach SheSafe servers. Please check your connection and try again.',
      undefined,
      'API_CONFIG_ERROR',
    );
  }

  const mimeType = inferMimeType(sourceUri);
  const extension = extensionByMime[mimeType] || 'jpg';
  const filename = `verification-${type}-${Date.now()}.${extension}`;
  const uri = await normalizeUploadUri(sourceUri, type, filename);
  const endpoint = `/api/verification/upload/${type}`;
  const url = `${API_BASE_URL}${endpoint}`;
  const token = await getAccessToken();

  if (!token) {
    throw createUploadError('Your session expired. Please log in again.', 401, 'NO_ACCESS_TOKEN');
  }

  if (isDevelopment) {
    console.log('[verification upload] native upload start', {
      transport: 'FileSystem.uploadAsync',
      endpoint,
      method: 'POST',
      baseUrl: API_BASE_URL,
      filename,
      mimeType,
      uriScheme: getUriScheme(uri),
      tokenExists: Boolean(token),
    });
  }

  try {
    const response = await FileSystem.uploadAsync(url, uri, {
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'document',
      mimeType,
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

    if (isDevelopment) {
      console.log('[verification upload] native upload response', {
        transport: 'FileSystem.uploadAsync',
        endpoint,
        status: response.status,
        message: backendMessage || undefined,
      });
    }

    if (response.status < 200 || response.status >= 300) {
      throw createUploadError(messageForStatus(response.status, backendMessage), response.status, 'UPLOAD_REJECTED');
    }

    const docs = data?.verification?.documents || {};
    if (type === 'id_card') return docs.idCardUrl || data?.verification?.idCardUrl || data?.verification?.id_card_url || null;
    if (type === 'selfie') return docs.selfieUrl || data?.verification?.selfieUrl || data?.verification?.selfie_url || null;
    return docs.certificateUrl || data?.verification?.certificateUrl || data?.verification?.certificate_url || null;
  } catch (error) {
    if ((error as UploadError)?.status) throw error;
    if (isDevelopment) {
      console.log('[verification upload] native upload network error', {
        transport: 'FileSystem.uploadAsync',
        endpoint,
        message: error instanceof Error ? error.message : 'Unknown network error',
      });
    }
    throw createUploadError(
      'Document upload could not reach SheSafe servers. Please check your connection and try again.',
      undefined,
      'UPLOAD_NETWORK_ERROR',
    );
  }
}

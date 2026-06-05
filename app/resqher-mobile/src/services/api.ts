import axios, { AxiosError, isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';

export type UserRole = 'standard_user' | 'volunteer' | 'law_enforcement';

const ACCESS_KEY = 'resqher_access_token';
const REFRESH_KEY = 'resqher_refresh_token';
const IDENTITY_KEY = 'resqher_identity_v1';

type StoredIdentity = { role: string; userId: string };
type FriendlyError = Error & { code?: string; status?: number; maxResponders?: number };

const isDevelopment = process.env.NODE_ENV !== 'production';
const AUTH_REQUEST_TIMEOUT_MS = 30000;
let apiBaseUrlError = '';

const canUseWebStorage = () => (
  Platform.OS === 'web'
  && typeof window !== 'undefined'
  && typeof window.localStorage !== 'undefined'
);

async function setStoredItem(key: string, value: string) {
  if (canUseWebStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getStoredItem(key: string) {
  if (canUseWebStorage()) {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteStoredItem(key: string) {
  if (canUseWebStorage()) {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const DB_ROLE_MAP: Record<string, string> = {
  standard_user: 'USER',
  volunteer: 'VOLUNTEER',
  law_enforcement: 'POLICE',
  admin: 'ADMIN',
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function resolveApiBaseUrl() {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    apiBaseUrlError = 'Missing EXPO_PUBLIC_API_URL. Set the backend URL before signing in.';
    if (isDevelopment) console.warn(`[api] ${apiBaseUrlError}`);
    return '';
  }

  const normalized = normalizeBaseUrl(raw);
  if (!/^https?:\/\//i.test(normalized)) {
    apiBaseUrlError = 'EXPO_PUBLIC_API_URL must start with http:// or https://.';
    if (isDevelopment) console.warn(`[api] ${apiBaseUrlError}`);
    return '';
  }

  apiBaseUrlError = '';
  return normalized;
}

function toWebSocketBaseUrl(apiBaseUrl: string) {
  if (!apiBaseUrl) return '';
  if (apiBaseUrl.startsWith('https://')) {
    return apiBaseUrl.replace(/^https:\/\//, 'wss://');
  }
  return apiBaseUrl.replace(/^http:\/\//, 'ws://');
}

export const API_BASE_URL = resolveApiBaseUrl();
export const WS_BASE_URL = toWebSocketBaseUrl(API_BASE_URL);
export const NGROK_SKIP_BROWSER_WARNING_HEADER = 'ngrok-skip-browser-warning';

export function getApiBaseUrlError() {
  return apiBaseUrlError;
}

function assertApiConfigured() {
  if (!API_BASE_URL || apiBaseUrlError) {
    const error = new Error(apiBaseUrlError || 'Backend API URL is not configured.') as FriendlyError;
    error.code = 'API_CONFIG_ERROR';
    throw error;
  }
}

export function getWebSocketUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${WS_BASE_URL}${normalizedPath}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true',
  },
});

export async function setTokens(access: string, refresh: string) {
  const decoded = jwtDecode<{ sub?: string; role?: string }>(access);
  if (!decoded.sub || !decoded.role) {
    throw new Error('Invalid token response');
  }
  const identity: StoredIdentity = {
    userId: decoded.sub,
    role: DB_ROLE_MAP[decoded.role] ?? 'USER',
  };
  await setStoredItem(ACCESS_KEY, access);
  await setStoredItem(REFRESH_KEY, refresh);
  await setStoredItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export async function clearTokens() {
  await deleteStoredItem(ACCESS_KEY);
  await deleteStoredItem(REFRESH_KEY);
  await deleteStoredItem(IDENTITY_KEY);
}

export async function getAccessToken() {
  return getStoredItem(ACCESS_KEY);
}

export async function getRefreshToken() {
  return getStoredItem(REFRESH_KEY);
}

export async function getStoredIdentity(): Promise<StoredIdentity | null> {
  const raw = await getStoredItem(IDENTITY_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredIdentity; } catch { return null; }
}

// Attach token automatically.
api.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};
  config.headers[NGROK_SKIP_BROWSER_WARNING_HEADER] = 'true';
  const path = String(config.url || '');
  const isPublicAuthRequest = /^\/api\/auth\/(login|admin-login|signup|forgot-password|reset-password)\b/.test(path);
  const token = isPublicAuthRequest ? null : await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (isPublicAuthRequest && 'Authorization' in config.headers) {
    delete config.headers.Authorization;
  }
  if (isDevelopment) {
    const method = (config.method || 'get').toUpperCase();
    console.log('[api] request', method, `${config.baseURL || ''}${config.url || ''}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (isDevelopment) {
      const method = (response.config.method || 'get').toUpperCase();
      console.log('[api] response', method, response.config.url, response.status);
    }
    return response;
  },
  (error) => {
    if (isDevelopment && isAxiosError(error)) {
      const method = (error.config?.method || 'get').toUpperCase();
      console.log('[api] error', method, error.config?.url, error.response?.status ?? 'no-response', error.code ?? 'no-code');
    }
    return Promise.reject(error);
  }
);

function createFriendlyError(message: string, code?: string, status?: number, extra?: Partial<FriendlyError>) {
  const error = new Error(message) as FriendlyError;
  error.code = code;
  error.status = status;
  if (extra?.maxResponders) error.maxResponders = extra.maxResponders;
  return error;
}

function collectBackendMessages(data: any) {
  const messages: string[] = [];
  if (!data || typeof data !== 'object') return messages;

  if (typeof data.message === 'string') messages.push(data.message);
  if (typeof data.detail === 'string') messages.push(data.detail);
  if (typeof data.error === 'string') messages.push(data.error);
  if (typeof data.error?.message === 'string') messages.push(data.error.message);
  if (Array.isArray(data.errors)) {
    for (const item of data.errors) {
      if (typeof item === 'string') {
        messages.push(item);
      } else if (typeof item?.message === 'string') {
        messages.push(item.field ? `${item.field}: ${item.message}` : item.message);
      }
    }
  }

  for (const key in data) {
    if (['message', 'detail', 'error', 'errors', 'code', 'maxResponders'].includes(key)) continue;
    if (Array.isArray(data[key])) {
      messages.push(`${key}: ${data[key].join(', ')}`);
    } else if (typeof data[key] === 'string') {
      messages.push(data[key]);
    }
  }

  return [...new Set(messages)].filter(Boolean);
}

function friendlyError(err: unknown) {
  if (isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    const data = ax.response?.data;
    const status = ax.response?.status;

    if (ax.code === 'ECONNABORTED' || /timeout/i.test(ax.message || '')) {
      return createFriendlyError('Server timed out. Please check backend/tunnel and try again.', 'TIMEOUT', status);
    }
    if (!ax.response) {
      return createFriendlyError('Cannot reach the server. Check backend URL, internet connection, or restart tunnel.', 'NETWORK_ERROR');
    }
    if (status && status >= 500) {
      return createFriendlyError('Server error. Please try again after checking backend logs.', 'SERVER_ERROR', status);
    }

    const messages = collectBackendMessages(data);
    const fallbackByStatus: Record<number, string> = {
      401: 'Invalid credentials.',
      403: 'You do not have access to this resource.',
      409: 'Phone number is already registered.',
      429: 'Too many requests. Please try again later.',
    };

    return createFriendlyError(
      messages.join('\n') || (status ? fallbackByStatus[status] : '') || ax.message || 'Request failed',
      data?.code,
      status,
      { maxResponders: data?.maxResponders }
    );
  }
  if (err instanceof Error) return err;
  return new Error('Request failed');
}

const ROLE_MAP: Record<'USER' | 'VOLUNTEER' | 'POLICE', string> = {
  USER: 'standard_user',
  VOLUNTEER: 'volunteer',
  POLICE: 'law_enforcement',
};

export const authService = {
  async requestSignupOtp(
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    role: 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN' = 'USER',
    policeDetails?: { policeStationOrUnit?: string; badgeNumber?: string; jobIdCardUrl?: string }
  ) {
    if (role === 'ADMIN') {
      throw new Error('Admin accounts cannot be created through public signup.');
    }
    try {
      assertApiConfigured();
      const res = await api.post('/api/auth/signup/request-otp', {
        phoneNumber: phone,
        password,
        firstName,
        lastName,
        role: ROLE_MAP[role],
        ...(role === 'POLICE' ? policeDetails : {}),
      }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
      return res.data as { message?: string };
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async verifySignupOtp(phoneNumber: string, otpCode: string) {
    try {
      assertApiConfigured();
      const res = await api.post('/api/auth/signup/verify-otp', { phoneNumber, otpCode }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
      const { accessToken } = res.data || {};
      if (!accessToken) throw new Error('Invalid token response');
      await setTokens(accessToken, accessToken);
      return res.data as { accessToken: string; user?: any; role?: string; verificationStatus?: string | null };
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async register(
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    role: 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN' = 'USER',
    policeDetails?: { policeStationOrUnit?: string; badgeNumber?: string; jobIdCardUrl?: string }
  ) {
    if (role === 'ADMIN') {
      throw new Error('Admin accounts cannot be created through public signup.');
    }
    try {
      assertApiConfigured();
      const res = await api.post('/api/auth/signup', {
        phoneNumber: phone,
        password,
        firstName,
        lastName,
        role: ROLE_MAP[role],
        ...(role === 'POLICE' ? policeDetails : {}),
      }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
      const { accessToken } = res.data || {};
      if (!accessToken) throw new Error('Invalid token response');
      await setTokens(accessToken, accessToken);
      return res.data;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async login(username: string, password: string) {
    try {
      assertApiConfigured();
      const res = await api.post('/api/auth/login', { phoneNumber: username, password }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
      const { accessToken } = res.data || {};
      if (!accessToken) throw new Error('Invalid token response');
      await setTokens(accessToken, accessToken);
      return res.data as { accessToken: string; user?: any };
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async adminLogin(phone: string, password: string) {
    try {
      assertApiConfigured();
      const res = await api.post('/api/auth/admin-login', { phoneNumber: phone, password }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
      const { accessToken } = res.data || {};
      if (!accessToken) throw new Error('Invalid token response');
      await setTokens(accessToken, accessToken);
      return res.data as { accessToken: string; user?: any };
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async logout() {
    await clearTokens();
  },

  async forgotPassword(phoneNumber: string) {
    try {
      assertApiConfigured();
      const res = await api.post('/api/auth/forgot-password', { phoneNumber }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
      return res.data as { message?: string };
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async resetPassword(phoneNumber: string, otpCode: string, newPassword: string) {
    try {
      assertApiConfigured();
      await api.post('/api/auth/reset-password', { phoneNumber, otpCode, newPassword }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
    } catch (e) {
      throw friendlyError(e);
    }
  },
};

export const medicalService = {
  async getProviders() {
    try {
      const res = await api.get('/api/medical/providers');
      return res.data?.providers ?? [];
    } catch {
      return [];
    }
  },
};

export default api;

import axios, { AxiosError, isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

export type UserRole = 'standard_user' | 'volunteer' | 'law_enforcement';

const ACCESS_KEY = 'resqher_access_token';
const REFRESH_KEY = 'resqher_refresh_token';
const IDENTITY_KEY = 'resqher_identity_v1';

type StoredIdentity = { role: string; userId: string };

const DB_ROLE_MAP: Record<string, string> = {
  standard_user: 'USER',
  volunteer: 'VOLUNTEER',
  law_enforcement: 'POLICE',
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function requireApiBaseUrl() {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error('Missing EXPO_PUBLIC_API_URL. Set it in app/resqher-mobile/.env before starting Expo.');
  }

  const normalized = normalizeBaseUrl(raw);
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('EXPO_PUBLIC_API_URL must start with http:// or https://.');
  }

  return normalized;
}

function toWebSocketBaseUrl(apiBaseUrl: string) {
  if (apiBaseUrl.startsWith('https://')) {
    return apiBaseUrl.replace(/^https:\/\//, 'wss://');
  }
  return apiBaseUrl.replace(/^http:\/\//, 'ws://');
}

export const API_BASE_URL = requireApiBaseUrl();
export const WS_BASE_URL = toWebSocketBaseUrl(API_BASE_URL);
export const NGROK_SKIP_BROWSER_WARNING_HEADER = 'ngrok-skip-browser-warning';

export function getWebSocketUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${WS_BASE_URL}${normalizedPath}`;
}

function redactForLog(data: unknown) {
  if (!data) return '';
  if (typeof FormData !== 'undefined' && data instanceof FormData) return '[form-data]';

  try {
    return JSON.stringify(data, (key, value) => (
      /password|token|secret|otp/i.test(key) ? '[redacted]' : value
    )).substring(0, 120);
  } catch {
    return '[unserializable body]';
  }
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
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  // Decode JWT to extract role and userId for the app
  try {
    const decoded = jwtDecode<{ sub: string; role: string }>(access);
    const identity: StoredIdentity = {
      userId: decoded.sub,
      role: DB_ROLE_MAP[decoded.role] ?? 'USER',
    };
    await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(identity));
  } catch { /* token malformed — identity stays stale */ }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(IDENTITY_KEY);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function getStoredIdentity(): Promise<StoredIdentity | null> {
  const raw = await SecureStore.getItemAsync(IDENTITY_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredIdentity; } catch { return null; }
}

// Attach token automatically + debug logger
api.interceptors.request.use(async (config) => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, redactForLog(config.data));
  config.headers = config.headers ?? {};
  config.headers[NGROK_SKIP_BROWSER_WARNING_HEADER] = 'true';
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function friendlyError(err: unknown) {
  if (isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    const data = ax.response?.data;

    if (data && typeof data === 'object') {
      // DRF returns errors in an object { fieldName: ["error string"] }
      const messages = [];
      for (const key in data) {
        if (Array.isArray(data[key])) {
          messages.push(`${key}: ${data[key].join(', ')}`);
        } else if (typeof data[key] === 'string') {
          messages.push(data[key]);
        }
      }
      if (messages.length > 0) {
        const error = new Error(messages.join('\n')) as Error & { code?: string; status?: number; maxResponders?: number };
        error.code = data.code;
        error.status = ax.response?.status;
        error.maxResponders = data.maxResponders;
        return error;
      }
    }

    const msg =
      data?.error?.message ||
      data?.detail ||
      ax.message ||
      'Request failed';
    const error = new Error(msg) as Error & { code?: string; status?: number; maxResponders?: number };
    error.code = data?.code;
    error.status = ax.response?.status;
    error.maxResponders = data?.maxResponders;
    return error;
  }
  return new Error('Request failed');
}

const ROLE_MAP: Record<string, string> = {
  USER: 'standard_user',
  VOLUNTEER: 'volunteer',
  POLICE: 'law_enforcement',
  ADMIN: 'standard_user',
};

export const authService = {
  async register(
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    role: 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN' = 'USER'
  ) {
    try {
      const res = await api.post('/api/auth/signup', {
        phoneNumber: phone,
        password,
        firstName,
        lastName,
        role: ROLE_MAP[role] ?? 'standard_user',
      });
      const { accessToken } = res.data || {};
      if (accessToken) {
        await setTokens(accessToken, accessToken);
      }
      return res.data;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async login(username: string, password: string) {
    try {
      const res = await api.post('/api/auth/login', { phoneNumber: username, password });
      const { accessToken } = res.data || {};
      if (!accessToken) throw new Error('Invalid token response');
      await setTokens(accessToken, accessToken);
      return accessToken as string;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async logout() {
    await clearTokens();
  },

  async forgotPassword(phoneNumber: string) {
    try {
      const res = await api.post('/api/auth/forgot-password', { phoneNumber });
      return res.data as { otpCode: string };
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async resetPassword(phoneNumber: string, otpCode: string, newPassword: string) {
    try {
      await api.post('/api/auth/reset-password', { phoneNumber, otpCode, newPassword });
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

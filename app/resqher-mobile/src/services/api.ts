import axios, { AxiosError, isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'resqher_access_token';
const REFRESH_KEY = 'resqher_refresh_token';

function normalizeBaseUrl(url: string) {
  // allow user to pass either with or without trailing slash
  return url.replace(/\/+$/, '');
}

// Prefer EXPO_PUBLIC_API_URL, fallback to a placeholder for LAN testing.
const BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000');

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

// Attach token automatically
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
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
        return new Error(messages.join('\n'));
      }
    }

    const msg =
      data?.error?.message ||
      data?.detail ||
      ax.message ||
      'Request failed';
    return new Error(msg);
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
      await api.post('/api/auth/signup', {
        phoneNumber: phone,
        password,
        firstName,
        lastName,
        role: ROLE_MAP[role] ?? 'standard_user',
      });
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async login(username: string, password: string) {
    // Mock logic for fast testing
    if (username === '1234' && password === '1234') {
      await setTokens('mock-access-token-1234', 'mock-refresh-token-1234');
      return 'mock-access-token-1234';
    }
    if (username === '5678' && password === '5678') {
      await setTokens('mock-access-token-5678', 'mock-refresh-token-5678');
      return 'mock-access-token-5678';
    }

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
import axios, { AxiosError, isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'resqher_access_token';
const REFRESH_KEY = 'resqher_refresh_token';

function normalizeBaseUrl(url: string) {
  // allow user to pass either with or without trailing slash
  return url.replace(/\/+$/, '');
}

// Prefer EXPO_PUBLIC_API_URL. When not set, default to the host loopback
// appropriate for the platform/emulator:
// - Android emulator: 10.0.2.2
// - iOS simulator / web: 127.0.0.1
const envUrl = process.env.EXPO_PUBLIC_API_URL;
const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';
const BASE_URL = normalizeBaseUrl(envUrl || defaultHost);

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

export const authService = {
  async register(
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    role: 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN' = 'USER'
  ) {
    try {
      await api.post('/api/v1/auth/register/', {
        phone,
        password,
        first_name: firstName,
        last_name: lastName,
        role
      });
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async login(username: string, password: string) {
    try {
      const res = await api.post('/api/v1/auth/login/', { phone: username, password });
      const { access, refresh } = res.data || {};
      if (!access || !refresh) throw new Error('Invalid token response');
      await setTokens(access, refresh);
      return access as string;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async logout() {
    await clearTokens();
  },
};

export default api;
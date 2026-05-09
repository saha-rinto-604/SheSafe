import axios, { AxiosError, isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'resqher_access_token';

export type UserRole = 'standard_user' | 'volunteer' | 'law_enforcement';

export type AuthUser = {
  id: number;
  role: UserRole;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  entryTime: string;
};

function normalizeBaseUrl(url: string) {
  // allow user to pass either with or without trailing slash
  return url.replace(/\/+$/, '');
}

// Prefer EXPO_PUBLIC_API_URL, fallback to a placeholder for LAN testing.
const BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4000');

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export async function setTokens(access: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
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

    if (!ax.response) {
      return new Error(`Cannot reach backend at ${BASE_URL}. Make sure backend server is running.`);
    }

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
  async register(payload: {
    phoneNumber: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }) {
    try {
      const res = await api.post('/api/auth/signup', {
        phoneNumber: payload.phoneNumber,
        password: payload.password,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
      });

      const { accessToken, user } = res.data || {};
      if (!accessToken || !user) throw new Error('Invalid signup response');
      await setTokens(accessToken);
      return user as AuthUser;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async login(phoneNumber: string, password: string) {
    try {
      const res = await api.post('/api/auth/login', { phoneNumber, password });
      const { accessToken, user } = res.data || {};
      if (!accessToken || !user) throw new Error('Invalid login response');
      await setTokens(accessToken);
      return user as AuthUser;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async logout() {
    await clearTokens();
  },
};

export type SavedLocation = {
  id: number;
  user_id: number;
  latitude: number;
  longitude: number;
  address: string | null;
  recorded_at: string;
};

export const locationService = {
  async saveLocation(latitude: number, longitude: number, address?: string) {
    try {
      const res = await api.post('/api/locations', { latitude, longitude, address });
      return res.data?.location as SavedLocation;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  async getLastLocation() {
    try {
      const res = await api.get('/api/locations/last');
      return res.data?.location as SavedLocation | null;
    } catch (e) {
      throw friendlyError(e);
    }
  },
};

// ── Incident Service ──────────────────────────────────────────────────────────

export type Incident = {
  id: number;
  user_id: number;
  latitude: number;
  longitude: number;
  address: string | null;
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
  created_at: string;
};

export type IncidentZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  incidentCount: number;
  incidents?: any[];
};

export const incidentService = {
  /** Report a new incident at the given coordinates (called when SOS is triggered). */
  async reportIncident(latitude: number, longitude: number, address?: string) {
    try {
      const res = await api.post('/api/incidents', { latitude, longitude, address });
      return res.data?.incident as Incident;
    } catch (e) {
      throw friendlyError(e);
    }
  },

  /** Fetch all aggregated incident zones (clustered by 500m proximity). */
  async getIncidentZones() {
    try {
      const res = await api.get('/api/incidents/zones');
      return (res.data?.zones ?? []) as IncidentZone[];
    } catch (e) {
      throw friendlyError(e);
    }
  },
};

export const medicalService = {
  async getProviders() {
    try {
      const res = await api.get('/api/medical/providers');
      return (res.data?.providers ?? []);
    } catch (e) {
      throw friendlyError(e);
    }
  }
};

export default api;
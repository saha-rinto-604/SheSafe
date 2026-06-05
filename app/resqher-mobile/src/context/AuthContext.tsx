import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authService, getAccessToken, getStoredIdentity } from '../services/api';
import { incidentService } from '../services/incidentService';
import { getUserProfile, toIdentity } from '../services/profile';
import { setCurrentUser as setNotifUser } from '../services/notificationStore';
import { deactivateCurrentPushToken } from '../services/notificationService';
import type { Role, Identity } from '../identity/identity.types';

type AuthState = {
  isLoading: boolean;
  isSignedIn: boolean;
  accessToken: string | null;
  role: Role | null;
  userId: string | null;
  identityCache: Identity | null;
  /** Global SOS live flag — true when an emergency is currently active */
  isSosLive: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (username: string, password: string) => Promise<{ role: Role; verificationStatus?: string | null; user?: any }>;
  signInAdmin: (phone: string, password: string) => Promise<{ role: Role }>;
  signUp: (
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    role?: Role,
    policeDetails?: { policeStationOrUnit?: string; badgeNumber?: string; jobIdCardUrl?: string }
  ) => Promise<{ role: Role; verificationStatus?: string | null; user?: any }>;
  requestSignupOtp: (
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    role?: Role,
    policeDetails?: { policeStationOrUnit?: string; badgeNumber?: string; jobIdCardUrl?: string }
  ) => Promise<{ message?: string }>;
  verifySignupOtp: (phone: string, otpCode: string) => Promise<{ role: Role; verificationStatus?: string | null; user?: any }>;
  /** Attempts sign out. If isSosLive is true, calls onSosBlocked() instead and returns false. */
  signOut: (onSosBlocked?: () => void) => Promise<boolean>;
  refreshIdentity: () => Promise<void>;
  /** Call this when an SOS is activated (true) or fully resolved/cancelled (false) */
  setSosLive: (live: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SOS_BLOCKED_ROLES = new Set<Role>(['USER', 'VOLUNTEER']);
const ACTIVE_SOS_STATUSES = new Set(['ACTIVE', 'LIVE', 'IN_PROGRESS']);

function isActiveSosStatus(status: unknown) {
  const normalized = String(status || '').trim().toUpperCase().replace(/\s+/g, '_');
  return ACTIVE_SOS_STATUSES.has(normalized);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [identityCache, setIdentityCache] = useState<Identity | null>(null);
  const [isSosLive, setIsSosLive] = useState(false);

  const isSignedIn = !!accessToken;

  // Hydrate identity from local profile store
  const hydrateIdentity = useCallback(async (currentRole: Role, currentUserId = userId) => {
    try {
      const profile = await getUserProfile();
      setIdentityCache(toIdentity(profile, currentUserId, currentRole));
    } catch { /* identity unavailable — non-fatal */ }
  }, [userId]);

  const resetAuthSession = useCallback(async () => {
    await authService.logout();
    setAccessToken(null);
    setRole(null);
    setUserId(null);
    setIdentityCache(null);
    setNotifUser('anon');
  }, []);

  const applyAuthSession = useCallback(async (token: string) => {
    const identity = await getStoredIdentity();
    if (!token || !identity?.userId || !identity.role) {
      throw new Error('Invalid token response');
    }
    const resolvedRole = identity.role as Role;
    setAccessToken(token);
    setRole(resolvedRole);
    setUserId(identity.userId);
    setNotifUser(identity.userId);
    await hydrateIdentity(resolvedRole, identity.userId);
    return resolvedRole;
  }, [hydrateIdentity]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const identity = await getStoredIdentity();
          if (identity?.userId && identity.role) {
            setAccessToken(token);
            setRole(identity.role as Role);
            setUserId(identity.userId);
            setNotifUser(identity.userId);
          } else {
            await resetAuthSession();
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [resetAuthSession]);

  const setSosLive = useCallback((live: boolean) => {
    setIsSosLive(live);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isSignedIn,
      accessToken,
      role,
      userId,
      identityCache,
      isSosLive,
      setSosLive,
      refreshIdentity: async () => {
        if (role) await hydrateIdentity(role);
      },
      signIn: async (username: string, password: string): Promise<{ role: Role; verificationStatus?: string | null; user?: any }> => {
        setIsLoading(true);
        try {
          await resetAuthSession();
          const loginResult = await authService.login(username, password);
          const token = loginResult.accessToken;
          const resolvedRole = await applyAuthSession(token);
          return { role: resolvedRole, verificationStatus: loginResult.user?.verificationStatus ?? null, user: loginResult.user };
        } catch (error) {
          await resetAuthSession();
          throw error;
        } finally {
          setIsLoading(false);
        }
      },
      signInAdmin: async (phone: string, password: string): Promise<{ role: Role }> => {
        setIsLoading(true);
        try {
          await resetAuthSession();
          const loginResult = await authService.adminLogin(phone, password);
          const token = loginResult.accessToken;
          const resolvedRole = await applyAuthSession(token);
          return { role: resolvedRole };
        } catch (error) {
          await resetAuthSession();
          throw error;
        } finally {
          setIsLoading(false);
        }
      },
      signUp: async (
        phone: string,
        password: string,
        firstName: string,
        lastName: string,
        signUpRole: Role = 'USER',
        policeDetails?: { policeStationOrUnit?: string; badgeNumber?: string; jobIdCardUrl?: string }
      ): Promise<{ role: Role; verificationStatus?: string | null; user?: any }> => {
        setIsLoading(true);
        try {
          await resetAuthSession();
          const registerResult = await authService.register(phone, password, firstName, lastName, signUpRole, policeDetails);
          const resolvedRole = await applyAuthSession(registerResult.accessToken);
          return { role: resolvedRole, verificationStatus: registerResult.user?.verificationStatus ?? null, user: registerResult.user };
        } catch (error) {
          await resetAuthSession();
          throw error;
        } finally {
          setIsLoading(false);
        }
      },
      requestSignupOtp: async (
        phone: string,
        password: string,
        firstName: string,
        lastName: string,
        signUpRole: Role = 'USER',
        policeDetails?: { policeStationOrUnit?: string; badgeNumber?: string; jobIdCardUrl?: string }
      ): Promise<{ message?: string }> => {
        setIsLoading(true);
        try {
          await resetAuthSession();
          return await authService.requestSignupOtp(phone, password, firstName, lastName, signUpRole, policeDetails);
        } finally {
          setIsLoading(false);
        }
      },
      verifySignupOtp: async (phone: string, otpCode: string): Promise<{ role: Role; verificationStatus?: string | null; user?: any }> => {
        setIsLoading(true);
        try {
          await resetAuthSession();
          const verifyResult = await authService.verifySignupOtp(phone, otpCode);
          const resolvedRole = await applyAuthSession(verifyResult.accessToken);
          return { role: resolvedRole, verificationStatus: verifyResult.user?.verificationStatus ?? verifyResult.verificationStatus ?? null, user: verifyResult.user };
        } catch (error) {
          await resetAuthSession();
          throw error;
        } finally {
          setIsLoading(false);
        }
      },
      signOut: async (onSosBlocked?: () => void): Promise<boolean> => {
        const shouldGuardSos = role ? SOS_BLOCKED_ROLES.has(role) : false;
        let hasActiveSos = shouldGuardSos && isSosLive;

        if (shouldGuardSos && !hasActiveSos) {
          try {
            const activeSos = await incidentService.getMyActiveSos();
            hasActiveSos = Boolean(activeSos && isActiveSosStatus(activeSos.status));
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[AuthContext] Active SOS check failed before logout:', error instanceof Error ? error.message : error);
            }
            try {
              const incidents = await incidentService.getMyIncidents();
              hasActiveSos = incidents.some((incident) => isActiveSosStatus(incident.status));
            } catch {
              // Keep logout available if the active-SOS check endpoint is unavailable.
            }
          }
        }

        if (hasActiveSos) {
          onSosBlocked?.();
          return false;
        }
        setIsLoading(true);
        try {
          await deactivateCurrentPushToken();
          await authService.logout();
          setAccessToken(null);
          setRole(null);
          setUserId(null);
          setIdentityCache(null);
          setIsSosLive(false);
          setNotifUser('anon');
          return true;
        } finally {
          setIsLoading(false);
        }
      },
    }),
    [isLoading, isSignedIn, accessToken, role, userId, identityCache, isSosLive, setSosLive, hydrateIdentity, resetAuthSession, applyAuthSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

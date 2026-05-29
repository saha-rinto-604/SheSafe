import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authService, getAccessToken, getStoredIdentity } from '../services/api';
import { getUserProfile, toIdentity } from '../services/profile';
import { setCurrentUser as setNotifUser } from '../services/notificationStore';
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
  /** Attempts sign out. If isSosLive is true, calls onSosBlocked() instead and returns false. */
  signOut: (onSosBlocked?: () => void) => Promise<boolean>;
  refreshIdentity: () => Promise<void>;
  /** Call this when an SOS is activated (true) or fully resolved/cancelled (false) */
  setSosLive: (live: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [identityCache, setIdentityCache] = useState<Identity | null>(null);
  const [isSosLive, setIsSosLive] = useState(false);

  const isSignedIn = !!accessToken;

  // Hydrate identity from local profile store
  const hydrateIdentity = useCallback(async (currentRole: Role) => {
    try {
      const profile = await getUserProfile();
      setIdentityCache(toIdentity(profile, userId, currentRole));
    } catch { /* identity unavailable — non-fatal */ }
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          setAccessToken(token);
          const identity = await getStoredIdentity();
          if (identity) {
            setRole(identity.role as Role);
            setUserId(identity.userId);
            setNotifUser(identity.userId);
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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
          console.log('[AUTH_CTX] signIn called with phone:', username);
          const loginResult = await authService.login(username, password);
          const token = loginResult.accessToken;
          console.log('[AUTH_CTX] signIn token received:', token ? 'yes' : 'no');
          setAccessToken(token);
          // Role and userId are decoded from the JWT and stored by setTokens()
          const identity = await getStoredIdentity();
          console.log('[AUTH_CTX] signIn identity:', identity);
          const resolvedRole: Role = (identity?.role as Role) ?? 'USER';
          setRole(resolvedRole);
          setUserId(identity?.userId ?? null);
          setNotifUser(identity?.userId ?? 'anon');
          await hydrateIdentity(resolvedRole);
          return { role: resolvedRole, verificationStatus: loginResult.user?.verificationStatus ?? null, user: loginResult.user };
        } finally {
          setIsLoading(false);
        }
      },
      signInAdmin: async (phone: string, password: string): Promise<{ role: Role }> => {
        setIsLoading(true);
        try {
          const loginResult = await authService.adminLogin(phone, password);
          const token = loginResult.accessToken;
          setAccessToken(token);
          const identity = await getStoredIdentity();
          const resolvedRole: Role = (identity?.role as Role) ?? 'USER';
          setRole(resolvedRole);
          setUserId(identity?.userId ?? null);
          setNotifUser(identity?.userId ?? 'anon');
          if (resolvedRole === 'ADMIN') {
            await hydrateIdentity(resolvedRole);
          }
          return { role: resolvedRole };
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
          const registerResult = await authService.register(phone, password, firstName, lastName, signUpRole, policeDetails);
          // register() now stores the token via setTokens() — read it back
          let token = await getAccessToken();
          if (!token) {
            // Fallback: login explicitly if register didn't store a token
            token = (await authService.login(phone, password)).accessToken;
          }
          setAccessToken(token);
          const identity = await getStoredIdentity();
          const resolvedRole: Role = (identity?.role as Role) ?? signUpRole;
          setRole(resolvedRole);
          setUserId(identity?.userId ?? null);
          setNotifUser(identity?.userId ?? 'anon');
          await hydrateIdentity(resolvedRole);
          return { role: resolvedRole, verificationStatus: registerResult.user?.verificationStatus ?? null, user: registerResult.user };
        } finally {
          setIsLoading(false);
        }
      },
      signOut: async (onSosBlocked?: () => void): Promise<boolean> => {
        // Guard: block logout while an SOS is live
        if (isSosLive) {
          onSosBlocked?.();
          return false;
        }
        setIsLoading(true);
        try {
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
    [isLoading, isSignedIn, accessToken, role, userId, identityCache, isSosLive, setSosLive, hydrateIdentity]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authService, getAccessToken } from '../services/api';
import { getUserProfile, toIdentity } from '../services/profile';
import type { Role, Identity } from '../identity/identity.types';

type AuthState = {
  isLoading: boolean;
  isSignedIn: boolean;
  accessToken: string | null;
  role: Role | null;
  userId: string | null;
  identityCache: Identity | null;
};

type AuthContextValue = AuthState & {
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string, firstName: string, lastName: string, role?: Role) => Promise<void>;
  signOut: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [identityCache, setIdentityCache] = useState<Identity | null>(null);

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
        setAccessToken(token);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isSignedIn,
      accessToken,
      role,
      userId,
      identityCache,
      refreshIdentity: async () => {
        if (role) await hydrateIdentity(role);
      },
      signIn: async (username: string, password: string) => {
        setIsLoading(true);
        try {
          const token = await authService.login(username, password);
          setAccessToken(token);
          // Role is not returned by login — will be set by profile hydration
          // or by the screen that knows the role. For now, default to USER.
          let inferredRole: Role = 'USER';
          if (username === '5678' && password === '5678') {
            inferredRole = 'VOLUNTEER';
          } else if (username === '1234' && password === '1234') {
            inferredRole = 'USER';
          }
          setRole(inferredRole);
          await hydrateIdentity(inferredRole);
        } finally {
          setIsLoading(false);
        }
      },
      signUp: async (phone: string, password: string, firstName: string, lastName: string, signUpRole: Role = 'USER') => {
        setIsLoading(true);
        try {
          await authService.register(phone, password, firstName, lastName, signUpRole);
          const token = await authService.login(phone, password);
          setAccessToken(token);
          setRole(signUpRole);
          await hydrateIdentity(signUpRole);
        } finally {
          setIsLoading(false);
        }
      },
      signOut: async () => {
        setIsLoading(true);
        try {
          await authService.logout();
          setAccessToken(null);
          setRole(null);
          setUserId(null);
          setIdentityCache(null);
        } finally {
          setIsLoading(false);
        }
      },
    }),
    [isLoading, isSignedIn, accessToken, role, userId, identityCache, hydrateIdentity]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
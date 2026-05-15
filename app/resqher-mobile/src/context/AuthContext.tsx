import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authService, getAccessToken, getStoredIdentity } from '../services/api';
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
  signUp: (phone: string, password: string, firstName: string, lastName: string, role?: Role) => Promise<{ role: Role }>;
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
        if (token) {
          setAccessToken(token);
          const identity = await getStoredIdentity();
          if (identity) {
            setRole(identity.role as Role);
            setUserId(identity.userId);
          }
        }
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
          console.log('[AUTH_CTX] signIn called with phone:', username);
          const token = await authService.login(username, password);
          console.log('[AUTH_CTX] signIn token received:', token ? 'yes' : 'no');
          setAccessToken(token);
          // Role and userId are decoded from the JWT and stored by setTokens()
          const identity = await getStoredIdentity();
          console.log('[AUTH_CTX] signIn identity:', identity);
          const resolvedRole: Role = (identity?.role as Role) ?? 'USER';
          setRole(resolvedRole);
          setUserId(identity?.userId ?? null);
          await hydrateIdentity(resolvedRole);
        } finally {
          setIsLoading(false);
        }
      },
      signUp: async (phone: string, password: string, firstName: string, lastName: string, signUpRole: Role = 'USER'): Promise<{ role: Role }> => {
        setIsLoading(true);
        try {
          console.log('[AUTH_CTX] signUp called:', { phone, signUpRole });
          await authService.register(phone, password, firstName, lastName, signUpRole);
          // register() now stores the token via setTokens() — read it back
          let token = await getAccessToken();
          if (!token) {
            // Fallback: login explicitly if register didn't store a token
            console.log('[AUTH_CTX] No token from register, falling back to login');
            token = await authService.login(phone, password);
          }
          setAccessToken(token);
          const identity = await getStoredIdentity();
          const resolvedRole: Role = (identity?.role as Role) ?? signUpRole;
          console.log('[AUTH_CTX] signUp resolved role:', resolvedRole, 'identity:', identity);
          setRole(resolvedRole);
          setUserId(identity?.userId ?? null);
          await hydrateIdentity(resolvedRole);
          return { role: resolvedRole };
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
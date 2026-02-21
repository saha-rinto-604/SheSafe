import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService, getAccessToken } from '../services/api';

type AuthState = {
  isLoading: boolean;
  isSignedIn: boolean;
  accessToken: string | null;
};

type AuthContextValue = AuthState & {
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string, firstName: string, lastName: string, role?: 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN') => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const isSignedIn = !!accessToken;

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
      signIn: async (username: string, password: string) => {
        setIsLoading(true);
        try {
          const token = await authService.login(username, password);
          setAccessToken(token);
        } finally {
          setIsLoading(false);
        }
      },
      signUp: async (phone: string, password: string, firstName: string, lastName: string, role = 'USER') => {
        setIsLoading(true);
        try {
          await authService.register(phone, password, firstName, lastName, role);
          const token = await authService.login(phone, password);
          setAccessToken(token);
        } finally {
          setIsLoading(false);
        }
      },
      signOut: async () => {
        setIsLoading(true);
        try {
          await authService.logout();
          setAccessToken(null);
        } finally {
          setIsLoading(false);
        }
      },
    }),
    [isLoading, isSignedIn, accessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
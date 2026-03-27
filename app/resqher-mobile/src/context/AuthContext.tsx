import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService, getAccessToken, AuthUser, UserRole } from '../services/api';

type AuthState = {
  isLoading: boolean;
  isSignedIn: boolean;
  accessToken: string | null;
  user: AuthUser | null;
};

type AuthContextValue = AuthState & {
  signIn: (phoneNumber: string, password: string) => Promise<AuthUser>;
  signUp: (phoneNumber: string, password: string, firstName: string, lastName: string, role?: UserRole) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

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
      user,
      signIn: async (phoneNumber: string, password: string) => {
        setIsLoading(true);
        try {
          const signedInUser = await authService.login(phoneNumber, password);
          const token = await getAccessToken();
          setAccessToken(token);
          setUser(signedInUser);
          return signedInUser;
        } finally {
          setIsLoading(false);
        }
      },
      signUp: async (phoneNumber: string, password: string, firstName: string, lastName: string, role: UserRole = 'standard_user') => {
        setIsLoading(true);
        try {
          const signedUpUser = await authService.register({
            phoneNumber,
            password,
            firstName,
            lastName,
            role,
          });
          const token = await getAccessToken();
          setAccessToken(token);
          setUser(signedUpUser);
          return signedUpUser;
        } finally {
          setIsLoading(false);
        }
      },
      signOut: async () => {
        setIsLoading(true);
        try {
          await authService.logout();
          setAccessToken(null);
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      },
    }),
    [isLoading, isSignedIn, accessToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
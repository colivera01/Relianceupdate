'use client';

import React, { createContext, useCallback, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  userType: 'customer' | 'vendor' | 'admin' | 'both';
  avatar?: string;
  availableProfiles?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Persist session. Pass `authToken` from the login API so it is not overwritten client-side. */
  login: (userData: AuthUser, authToken?: string | null) => void;
  logout: (redirectTo?: string) => Promise<void>;
  updateUser: (userData: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_AUTH_DEBUG =
  typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';

function readStoredUserRaw(): string | null {
  if (typeof window === 'undefined') return null;
  const primary = sessionStorage.getItem('userData');
  if (primary) return primary;
  const legacy = sessionStorage.getItem('user');
  if (legacy) {
    sessionStorage.setItem('userData', legacy);
    sessionStorage.removeItem('user');
    if (DEV_AUTH_DEBUG) {
      console.info('[AuthProvider] migrated sessionStorage key "user" -> "userData"');
    }
    return legacy;
  }
  return null;
}

function persistClientSession(userData: AuthUser, authToken?: string | null) {
  const serialized = JSON.stringify(userData);
  sessionStorage.setItem('userData', serialized);
  if (authToken && String(authToken).trim()) {
    sessionStorage.setItem('authToken', String(authToken));
    sessionStorage.setItem('auth_token', String(authToken));
  }
}

function clearClientSession() {
  sessionStorage.removeItem('userData');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('registrationSuccess');
  sessionStorage.removeItem('registrationUserType');
}

function sessionIdentityKey(userData: AuthUser | null): string {
  if (!userData) return '';
  const profiles = Array.isArray(userData.availableProfiles)
    ? [...userData.availableProfiles].map(String).sort().join(',')
    : '';
  return `${userData.id}|${userData.email}|${userData.userType}|${profiles}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname() || '';
  const isAdminScope = pathname.startsWith('/admin');
  const sessionEndpoint = isAdminScope ? '/admin/session' : '/api/auth/session';
  const userRef = useRef<AuthUser | null>(null);
  const reconcileInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const reconcileServerSession = useCallback((refreshOnChange = false) => {
    if (reconcileInFlightRef.current) return reconcileInFlightRef.current;

    const task = (async () => {
      try {
        const response = await fetch(sessionEndpoint, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const sessionJson = await response.json().catch(() => ({}));

        if (response.ok && sessionJson?.authenticated && sessionJson?.user) {
          const sessionUser = sessionJson.user as AuthUser;
          const sessionToken =
            typeof sessionJson?.token === 'string' && sessionJson.token
              ? sessionJson.token
              : null;
          const identityChanged =
            sessionIdentityKey(userRef.current) !== sessionIdentityKey(sessionUser);

          userRef.current = sessionUser;
          setUser(sessionUser);
          persistClientSession(sessionUser, sessionToken);

          if (identityChanged && refreshOnChange) {
            router.refresh();
          }
          return;
        }

        if (response.status === 401) {
          const hadClientSession = Boolean(userRef.current || readStoredUserRaw());
          userRef.current = null;
          setUser(null);
          clearClientSession();
          if (hadClientSession && refreshOnChange) {
            router.refresh();
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      }
    })().finally(() => {
      reconcileInFlightRef.current = null;
    });

    reconcileInFlightRef.current = task;
    return task;
  }, [router, sessionEndpoint]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await reconcileServerSession(false);
      } finally {
        setIsLoading(false);
      }
    };

    void checkAuth();
  }, [reconcileServerSession]);

  useEffect(() => {
    const reconcileActiveTab = () => {
      if (document.visibilityState === 'visible') {
        void reconcileServerSession(true);
      }
    };
    window.addEventListener('focus', reconcileActiveTab);
    document.addEventListener('visibilitychange', reconcileActiveTab);
    return () => {
      window.removeEventListener('focus', reconcileActiveTab);
      document.removeEventListener('visibilitychange', reconcileActiveTab);
    };
  }, [reconcileServerSession]);

  const login = (userData: AuthUser, authToken?: string | null) => {
    userRef.current = userData;
    setUser(userData);
    const resolvedToken =
      (authToken != null && String(authToken).trim()) ||
      sessionStorage.getItem('authToken') ||
      sessionStorage.getItem('auth_token');
    persistClientSession(userData, resolvedToken);
    if (DEV_AUTH_DEBUG) {
      console.info('[AuthProvider] login()', {
        userId: userData.id,
        email: userData.email,
        userType: userData.userType,
        tokenPreview: `${String(resolvedToken).slice(0, 14)}...`,
      });
    }
  };

  const logout = async (redirectTo = '/auth/login') => {
    const safeRedirectTo =
      redirectTo.startsWith('/') && !redirectTo.startsWith('//')
        ? redirectTo
        : '/auth/login';
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: isAdminScope ? 'admin' : 'general' }),
      });

      if (!response.ok) {
        console.warn('Logout API call failed, but continuing with client-side logout');
      }

      userRef.current = null;
      setUser(null);
      clearClientSession();

      router.push(safeRedirectTo);
    } catch (error) {
      console.error('Logout error:', error);
      userRef.current = null;
      setUser(null);
      clearClientSession();
      router.push(safeRedirectTo);
    }
  };

  const updateUser = (userData: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      userRef.current = updatedUser;
      setUser(updatedUser);
      sessionStorage.setItem('userData', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

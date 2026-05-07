'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

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
  logout: () => Promise<void>;
  updateUser: (userData: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_AUTH_DEBUG =
  typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';

function readStoredUserRaw(): string | null {
  if (typeof window === 'undefined') return null;
  const primary = localStorage.getItem('userData');
  if (primary) return primary;
  const legacy = localStorage.getItem('user');
  if (legacy) {
    localStorage.setItem('userData', legacy);
    localStorage.removeItem('user');
    if (DEV_AUTH_DEBUG) {
      console.info('[AuthProvider] migrated localStorage key "user" -> "userData"');
    }
    return legacy;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing user data on app load
    const checkAuth = () => {
      try {
        const userData = readStoredUserRaw();
        const authToken = localStorage.getItem('authToken') || localStorage.getItem('auth_token');

        if (userData && authToken) {
          const parsedUser = JSON.parse(userData) as AuthUser;
          setUser(parsedUser);
          if (parsedUser?.id) {
            document.cookie = `userId=${encodeURIComponent(String(parsedUser.id))}; path=/; samesite=lax`;
            document.cookie = `session_user_id=${encodeURIComponent(String(parsedUser.id))}; path=/; samesite=lax`;
          }
          if (DEV_AUTH_DEBUG) {
            console.info('[AuthProvider] hydrate session', {
              userId: parsedUser?.id,
              email: parsedUser?.email,
              userType: parsedUser?.userType,
              tokenPreview: `${String(authToken).slice(0, 14)}…`,
            });
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        // Clear invalid data
        localStorage.removeItem('userData');
        localStorage.removeItem('authToken');
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData: AuthUser, authToken?: string | null) => {
    setUser(userData);
    const serialized = JSON.stringify(userData);
    localStorage.setItem('userData', serialized);
    const resolvedToken =
      (authToken != null && String(authToken).trim()) ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('auth_token') ||
      'temp-jwt-token';
    localStorage.setItem('authToken', resolvedToken);
    localStorage.setItem('auth_token', resolvedToken);
    document.cookie = `userId=${encodeURIComponent(String(userData.id))}; path=/; samesite=lax`;
    document.cookie = `session_user_id=${encodeURIComponent(String(userData.id))}; path=/; samesite=lax`;
    if (DEV_AUTH_DEBUG) {
      console.info('[AuthProvider] login()', {
        userId: userData.id,
        email: userData.email,
        userType: userData.userType,
        tokenPreview: `${String(resolvedToken).slice(0, 14)}…`,
      });
    }
  };

  const logout = async () => {
    try {
      // Call logout API
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Logout API call failed, but continuing with client-side logout');
      }

      // Clear client-side data
      setUser(null);
      localStorage.removeItem('userData');
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('registrationSuccess');
      sessionStorage.removeItem('registrationUserType');

      // Clear cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });

      // Redirect to login
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API fails, clear client-side data
      setUser(null);
      localStorage.removeItem('userData');
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth_token');
      router.push('/auth/login');
    }
  };

  const updateUser = (userData: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('userData', JSON.stringify(updatedUser));
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
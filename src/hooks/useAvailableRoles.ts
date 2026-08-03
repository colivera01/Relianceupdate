'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'customer' | 'vendor' | 'admin';

export function useAvailableRoles(currentRole: AppRole) {
  const { user } = useAuth();
  const [fallbackUser, setFallbackUser] = useState<Record<string, any> | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || user) return;
    try {
      const raw = sessionStorage.getItem('userData') || sessionStorage.getItem('user');
      if (!raw) return;
      setFallbackUser(JSON.parse(raw) as Record<string, any>);
    } catch {
      setFallbackUser(null);
    }
  }, [user]);

  const userId = useMemo(
    () => String(user?.id || fallbackUser?.id || '').trim(),
    [fallbackUser?.id, user?.id]
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveRoles() {
      if (currentRole === 'admin') {
        if (!cancelled) setAvailableRoles(['admin']);
        return;
      }

      let roles: AppRole[] = [];
      try {
        const response = await fetch(
          `/api/profile/toggle?currentProfile=${encodeURIComponent(currentRole)}`,
          { method: 'GET', cache: 'no-store' }
        );
        if (response.ok) {
          const payload = await response.json().catch(() => ({}));
          roles = Array.isArray(payload?.availableProfiles)
            ? payload.availableProfiles.filter(
                (role: unknown): role is AppRole => role === 'customer' || role === 'vendor'
              )
            : [];
        }
      } catch {
        roles = [];
      }

      if (!cancelled) setAvailableRoles(roles);
    }

    void resolveRoles();
    return () => {
      cancelled = true;
    };
  }, [currentRole, userId]);

  return { availableRoles, userId };
}

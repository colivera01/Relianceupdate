'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';

export type AppRole = 'customer' | 'vendor' | 'admin';

function rolesFromSession(userTypeRaw: string | null | undefined, availableProfilesRaw: string[] | undefined): Set<AppRole> {
  const roles = new Set<AppRole>();
  const userType = String(userTypeRaw || '').trim().toLowerCase();
  const availableProfiles = Array.isArray(availableProfilesRaw)
    ? availableProfilesRaw.map((entry) => String(entry || '').trim().toLowerCase())
    : [];

  if (userType === 'customer' || userType === 'both') roles.add('customer');
  if (userType === 'vendor' || userType === 'both') roles.add('vendor');
  if (userType === 'admin') roles.add('admin');

  if (availableProfiles.includes('customer')) roles.add('customer');
  if (availableProfiles.includes('vendor')) roles.add('vendor');
  if (availableProfiles.includes('admin')) roles.add('admin');

  return roles;
}

export function useAvailableRoles(currentRole: AppRole) {
  const { user } = useAuth();
  const [fallbackUser, setFallbackUser] = useState<Record<string, any> | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([currentRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) return;
    try {
      const raw = sessionStorage.getItem('userData') || sessionStorage.getItem('user');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, any>;
      setFallbackUser(parsed);
    } catch {
      setFallbackUser(null);
    }
  }, [user]);

  const userId = useMemo(
    () => String(user?.id || fallbackUser?.id || '').trim(),
    [fallbackUser?.id, user?.id]
  );
  const userType = useMemo(
    () => String(user?.userType || fallbackUser?.userType || '').trim(),
    [fallbackUser?.userType, user?.userType]
  );
  const availableProfiles = useMemo(
    () =>
      Array.isArray(user?.availableProfiles)
        ? user.availableProfiles.map((p) => String(p))
        : Array.isArray(fallbackUser?.availableProfiles)
        ? fallbackUser.availableProfiles.map((p: unknown) => String(p))
        : [],
    [fallbackUser?.availableProfiles, user?.availableProfiles]
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveRoles() {
      const sessionRoles = rolesFromSession(userType, availableProfiles);
      if (sessionRoles.has('admin')) {
        if (!cancelled) {
          setAvailableRoles(['admin']);
        }
        return;
      }
      const hasExplicitSessionRoles = sessionRoles.size > 0 || Boolean(userType) || availableProfiles.length > 0;

      const headers = {
        'Content-Type': 'application/json',
        ...getClientSessionHeaders(userId || undefined),
      };

      const shouldProbeCustomer =
        !sessionRoles.has('customer') &&
        Boolean(userId) &&
        (
          currentRole === 'vendor' ||
          currentRole === 'admin' ||
          !hasExplicitSessionRoles
        );

      if (shouldProbeCustomer) {
        try {
          const customerRes = await fetch('/api/customer/profile', {
            method: 'GET',
            headers,
            cache: 'no-store',
          });
          if (customerRes.ok) {
            const customerJson = await customerRes.json().catch(() => ({}));
            if (customerJson?.profile) {
              sessionRoles.add('customer');
            }
          }
        } catch {
          // Keep best-effort behavior.
        }
      }

      const shouldProbeVendor =
        !sessionRoles.has('vendor') &&
        Boolean(userId) &&
        (
          currentRole === 'customer' ||
          currentRole === 'admin' ||
          !hasExplicitSessionRoles
        );

      if (shouldProbeVendor) {
        try {
          const vendorContextRes = await fetch('/api/vendor/context', {
            method: 'GET',
            headers,
            cache: 'no-store',
          });
          if (vendorContextRes.ok) {
            const vendorJson = await vendorContextRes.json().catch(() => ({}));
            const vendorId = String(vendorJson?.vendorId || vendorJson?.context?.vendorId || '').trim();
            if (vendorId) {
              sessionRoles.add('vendor');
            }
          }
        } catch {
          // Keep best-effort behavior.
        }
      }

      if (!sessionRoles.has(currentRole)) {
        sessionRoles.add(currentRole);
      }

      const orderedRoles = (['customer', 'vendor', 'admin'] as const).filter((role) =>
        sessionRoles.has(role)
      );

      if (!cancelled) {
        setAvailableRoles(orderedRoles);
      }
    }

    void resolveRoles();
    return () => {
      cancelled = true;
    };
  }, [availableProfiles, currentRole, userId, userType]);

  return {
    availableRoles,
    userId,
  };
}


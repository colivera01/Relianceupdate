'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';
import { OWNER_ADMIN_EMAIL, OWNER_ADMIN_PHONE } from '@/lib/internal-identities';

export type AppRole = 'customer' | 'vendor' | 'admin';

function normalizePhone(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

function hasAdminIdentity(email: string | null | undefined, phone: string | null | undefined): boolean {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);
  return normalizedEmail === OWNER_ADMIN_EMAIL || normalizedPhone === OWNER_ADMIN_PHONE;
}

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
      const raw = localStorage.getItem('userData') || localStorage.getItem('user');
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
  const email = useMemo(
    () => String((user as any)?.email || fallbackUser?.email || '').trim(),
    [fallbackUser?.email, user]
  );
  const phone = useMemo(
    () => String((user as any)?.phone || fallbackUser?.phone || '').trim(),
    [fallbackUser?.phone, user]
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
      const hasExplicitSessionRoles = sessionRoles.size > 0 || Boolean(userType) || availableProfiles.length > 0;
      const isRegisteredAdminIdentity = hasAdminIdentity(email, phone);

      if (isRegisteredAdminIdentity) {
        // The owner/admin identity intentionally keeps customer access for
        // platform-building flows. Add it up front so admin pages do not need
        // to probe /api/customer/profile just to render the Customer toggle.
        sessionRoles.add('customer');
      }

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
          !hasExplicitSessionRoles ||
          isRegisteredAdminIdentity
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
          !hasExplicitSessionRoles ||
          isRegisteredAdminIdentity
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

      if (isRegisteredAdminIdentity) {
        // Strict identity match is sufficient to show the Admin toggle.
        // The actual admin pages/APIs are protected server-side, so a UI
        // probe is informational only and should not retract the option
        // on a transient backend failure (DB outage, network blip, etc.).
        sessionRoles.add('admin');
      } else {
        sessionRoles.delete('admin');
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
  }, [availableProfiles, currentRole, email, phone, userId, userType]);

  return {
    availableRoles,
    userId,
  };
}


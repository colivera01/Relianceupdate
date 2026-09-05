'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  appendAuthNext,
  getProtectedReturnPath,
  sanitizeAuthNextPath,
} from '@/lib/auth-next';

export default function ServerRoleBoundaryActions({
  mode,
  fallbackPath,
  returnPathOverride,
}: {
  mode: 'sign-in' | 'retry' | 'switch-account';
  fallbackPath: string;
  returnPathOverride?: string;
}) {
  const { logout } = useAuth();
  const [switching, setSwitching] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnPath =
    sanitizeAuthNextPath(returnPathOverride) ||
    getProtectedReturnPath(pathname, searchParams?.toString(), fallbackPath);
  const loginHref = appendAuthNext('/auth/login', returnPath);
  const href = mode === 'sign-in' ? loginHref : returnPath;

  if (mode === 'switch-account') {
    return (
      <button
        type="button"
        disabled={switching}
        onClick={async () => {
          if (switching) return;
          setSwitching(true);
          await logout(loginHref);
        }}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
      >
        {switching ? 'Switching account...' : 'Switch Account'}
      </button>
    );
  }

  return (
    <a
      href={href}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      {mode === 'sign-in' ? 'Sign in' : 'Try again'}
    </a>
  );
}

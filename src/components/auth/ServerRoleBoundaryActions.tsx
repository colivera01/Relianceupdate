'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { appendAuthNext, getProtectedReturnPath } from '@/lib/auth-next';

export default function ServerRoleBoundaryActions({
  mode,
  fallbackPath,
}: {
  mode: 'sign-in' | 'retry';
  fallbackPath: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnPath = getProtectedReturnPath(pathname, searchParams?.toString(), fallbackPath);
  const href = mode === 'sign-in' ? appendAuthNext('/auth/login', returnPath) : returnPath;

  return (
    <a
      href={href}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      {mode === 'sign-in' ? 'Sign in' : 'Try again'}
    </a>
  );
}

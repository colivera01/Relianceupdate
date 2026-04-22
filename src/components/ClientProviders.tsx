'use client';

import { TooltipProvider } from '@radix-ui/react-tooltip';
import { ReactNode, useEffect } from 'react';
import { AuthProvider } from '../contexts/AuthContext';

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * Canonical client wrapper for the App Router (`src/app/layout.tsx`).
 * Combines Radix tooltips (previously only on the root duplicate), auth context,
 * and optional MSW when `NEXT_PUBLIC_API_MODE=mock`.
 */
export default function ClientProviders({ children }: ClientProvidersProps) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MODE !== 'mock') return;

    let cancelled = false;

    import('@/mocks/start')
      .then(({ startMockWorker }) => {
        if (!cancelled) {
          return startMockWorker();
        }
      })
      .catch((error) => {
        console.error('[ClientProviders] Failed to start mock worker:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TooltipProvider>
      <AuthProvider>{children}</AuthProvider>
    </TooltipProvider>
  );
} 
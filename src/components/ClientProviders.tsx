'use client';

import { ReactNode, useEffect } from 'react';
import { AuthProvider } from '../contexts/AuthContext';

interface ClientProvidersProps {
  children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  useEffect(() => {
    // Start MSW only when in mock mode
    if (process.env.NEXT_PUBLIC_API_MODE === 'mock') {
      import('@/mocks/start').then(({ startMockWorker }) => {
        startMockWorker();
      });
    }
  }, []);

  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
} 
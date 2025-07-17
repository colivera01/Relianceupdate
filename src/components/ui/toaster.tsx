"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the toast components to avoid SSR issues
const ToastComponents = dynamic(() => import('./toast-components'), {
  ssr: false,
  loading: () => null,
});

export function Toaster() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return <ToastComponents />;
} 
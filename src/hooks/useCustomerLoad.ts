'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readCustomerResponse } from '@/lib/customer-load-contract';

type LoadState<T> = { key: string; status: 'loading' | 'success' | 'error'; data: T | null; error: string | null };

// The request key hides previous results immediately, before the new effect runs.
export function useCustomerLoad<T>(url: string, userId: string | null | undefined, enabled: boolean, parser: { parse: (body: unknown) => T }, message: string) {
  const key = JSON.stringify([url, userId, enabled]);
  const [state, setState] = useState<LoadState<T>>({ key, status: 'loading', data: null, error: null });
  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const request = ++sequence.current;
    setState({ key, status: 'loading', data: null, error: null });
    if (enabled && userId) {
      void (async () => {
        try {
          const response = await fetch(url, { cache: 'no-store', credentials: 'include', signal: controller.signal });
          const data = await readCustomerResponse(response, parser, message);
          if (!controller.signal.aborted && request === sequence.current) setState({ key, status: 'success', data, error: null });
        } catch (error) {
          if (!controller.signal.aborted && request === sequence.current) setState({ key, status: 'error', data: null, error: error instanceof Error ? error.message : message });
        }
      })();
    }
    return () => { controller.abort(); sequence.current++; };
  }, [key, url, userId, enabled, parser, message, retry]);
  const reload = useCallback(() => {
    sequence.current++;
    setState({ key, status: 'loading', data: null, error: null });
    setRetry((value) => value + 1);
  }, [key]);
  return { ...(state.key === key ? state : { status: 'loading' as const, data: null, error: null }), reload };
}

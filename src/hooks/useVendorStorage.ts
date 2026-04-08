// src/hooks/useVendorStorage.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export interface StorageUsage {
  usedBytes: string;
  limitBytes: string;
  percentUsed: number;
  isOverLimit: boolean;
  totalMB: string;
  totalGB: string;
  limitMB: string;
  limitGB: string;
}

export function useVendorStorage(vendorId: string | null) {
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStorage = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/storage/usage`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setStorage(json.storage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  return {
    storage,
    loading,
    error,
    fetchStorage,
  };
}


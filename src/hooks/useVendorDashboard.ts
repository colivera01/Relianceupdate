// src/hooks/useVendorDashboard.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { VendorDashboardResponse } from "@/types/vendor";
import { useVendorProfile } from "@/hooks/useVendorProfile";

export function useVendorDashboard() {
  const { data: profile } = useVendorProfile();
  const vendorId = profile?.id;
  
  const [data, setData] = useState<VendorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vendors/${vendorId}/dashboard`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as VendorDashboardResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}

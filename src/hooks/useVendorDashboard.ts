// src/hooks/useVendorDashboard.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { VendorDashboardResponse } from "@/types/vendor";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";
import { useAuth } from "@/contexts/AuthContext";

export function useVendorDashboard() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { data: profile, loading: profileLoading, approvalPending, error: profileError } = useVendorProfile();
  const vendorId = profile?.id;
  
  const [data, setData] = useState<VendorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (profileLoading) {
      setLoading(true);
      return;
    }
    if (approvalPending) {
      setData(null);
      setLoading(false);
      setError("Vendor account pending approval");
      return;
    }
    if (!vendorId && profileError) {
      setData(null);
      setLoading(false);
      setError(profileError);
      return;
    }
    if (!vendorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = getClientSessionHeaders(userId);
      const res = await fetch(`/api/vendors/${vendorId}/dashboard`, {
        method: "GET",
        cache: "no-store",
        headers,
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
  }, [approvalPending, profileError, profileLoading, userId, vendorId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard, approvalPending };
}

// src/hooks/useVendorDashboard.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { VendorDashboardResponse } from "@/types/vendor";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";
import { useAuth } from "@/contexts/AuthContext";

const VENDOR_DASHBOARD_TIMEOUT_MS = 22_000;

export function useVendorDashboard() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const {
    data: profile,
    loading: profileLoading,
    approvalPending,
    error: profileError,
    resolvedVendorId,
    hasResolvedVendorContext,
  } = useVendorProfile();
  const vendorId = profile?.id || resolvedVendorId || null;
  
  const [data, setData] = useState<VendorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (profileLoading && !vendorId && !hasResolvedVendorContext) {
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
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), VENDOR_DASHBOARD_TIMEOUT_MS);
      const res = await fetch(`/api/vendors/${vendorId}/dashboard`, {
        method: "GET",
        cache: "no-store",
        headers,
        signal: controller.signal,
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as VendorDashboardResponse;
      setData(json);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Vendor dashboard took longer than expected to load. Please retry.");
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, [approvalPending, hasResolvedVendorContext, profileError, profileLoading, userId, vendorId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard, approvalPending };
}

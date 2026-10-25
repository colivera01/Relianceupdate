// src/hooks/useVendorDashboard.ts
"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { VendorDashboardResponse } from "@/types/vendor";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";
import { useAuth } from "@/contexts/AuthContext";

const VENDOR_DASHBOARD_TIMEOUT_MS = 22_000;
const VENDOR_DASHBOARD_FOCUS_REFRESH_INTERVAL_MS = 15_000;

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
  const lastSuccessfulFetchAtRef = useRef(0);

  const fetchDashboard = useCallback(async (forceRefresh = false, preserveCurrentView = false) => {
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

    if (!preserveCurrentView) {
      setLoading(true);
      setError(null);
    }

    try {
      const headers = getClientSessionHeaders(userId);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), VENDOR_DASHBOARD_TIMEOUT_MS);
      const query = forceRefresh ? "?refresh=1" : "";
      const res = await fetch(`/api/vendors/${vendorId}/dashboard${query}`, {
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
      setError(null);
      lastSuccessfulFetchAtRef.current = Date.now();
    } catch (err) {
      if (preserveCurrentView) {
        console.warn("[vendor/dashboard] background refresh unavailable", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      } else if (err instanceof Error && err.name === "AbortError") {
        setError("Vendor dashboard took longer than expected to load. Please retry.");
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (!preserveCurrentView) setLoading(false);
    }
  }, [approvalPending, hasResolvedVendorContext, profileError, profileLoading, userId, vendorId]);

  useEffect(() => {
    // Vendor pages are operational views. Load a fresh snapshot on entry so a newly
    // completed job, review, audit decision, or storage change is never hidden by the API TTL.
    void fetchDashboard(true);
  }, [fetchDashboard]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSuccessfulFetchAtRef.current < VENDOR_DASHBOARD_FOCUS_REFRESH_INTERVAL_MS) return;
      void fetchDashboard(true, true);
    };

    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [fetchDashboard]);

  const refetch = useCallback(() => fetchDashboard(true), [fetchDashboard]);

  return { data, loading, error, refetch, approvalPending };
}

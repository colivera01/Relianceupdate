"use client";
import { useEffect, useState, useCallback } from "react";
import { VendorProfileResponse, VendorProfile, VendorProfileUpdateRequest } from "@/types/vendor";
import { getClientSessionHeaders } from "@/lib/client-session";
import { useAuth } from "@/contexts/AuthContext";

export function useVendorProfile() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const userId = user?.id || null;
  const [data, setData] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!isAuthenticated || !userId) {
      setData(null);
      setApprovalPending(false);
      setLoading(false);
      setError("Vendor session context unavailable. Please sign in again.");
      return;
    }

    setLoading(true);
    setError(null);
    setApprovalPending(false);

    try {
      const headers = getClientSessionHeaders(userId);
      if (process.env.NODE_ENV !== "production") {
        console.info("[useVendorProfile] fetchProfile:start", {
          authLoading,
          isAuthenticated,
          userId,
          hasAuthHeader: Boolean(headers.Authorization),
          hasUserHeader: Boolean(headers["x-user-id"]),
        });
      }
      const res = await fetch("/api/vendor/profile", {
        method: "GET",
        cache: "no-store",
        headers,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as Record<string, any>));
        if (process.env.NODE_ENV !== "production") {
          console.warn("[useVendorProfile] fetchProfile:failed", {
            status: res.status,
            payload,
          });
        }
        const message =
          String(payload?.error || payload?.message || "").trim() ||
          `Request failed with status ${res.status}`;
        if (res.status === 401) {
          setData(null);
          setError("Vendor session context unavailable. Please sign in again.");
          return;
        }
        if (res.status === 403 && payload?.code === "VENDOR_PENDING_APPROVAL") {
          setApprovalPending(true);
          setData(null);
          setError("Vendor account pending approval");
          return;
        }
        throw new Error(message);
      }

      const json = (await res.json()) as VendorProfileResponse;
      if (process.env.NODE_ENV !== "production") {
        console.info("[useVendorProfile] fetchProfile:success", {
          vendorId: json?.profile?.id || null,
        });
      }
      if (json.success && json.profile) {
        setData(json.profile);
        setApprovalPending(false);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, userId]);

  const updateProfile = useCallback(async (updates: VendorProfileUpdateRequest) => {
    setSaving(true);
    setError(null);

    try {
      if (!isAuthenticated || !userId) {
        throw new Error("Vendor session context unavailable. Please sign in again.");
      }

      const headers = getClientSessionHeaders(userId);
      const res = await fetch("/api/vendor/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(updates),
        cache: "no-store",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as Record<string, any>));
        const message =
          String(payload?.error || payload?.message || "").trim() ||
          `Request failed with status ${res.status}`;
        if (res.status === 401) {
          throw new Error("Vendor session context unavailable. Please sign in again.");
        }
        if (res.status === 403 && payload?.code === "VENDOR_PENDING_APPROVAL") {
          setApprovalPending(true);
          throw new Error("Vendor account pending approval");
        }
        throw new Error(message);
      }

      const json = (await res.json()) as VendorProfileResponse;
      if (json.success && json.profile) {
        setData(json.profile);
        setApprovalPending(false);
        return json.profile;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err; // Re-throw so component can handle
    } finally {
      setSaving(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { 
    data, 
    loading, 
    error, 
    saving,
    approvalPending,
    refetch: fetchProfile,
    updateProfile,
  };
}




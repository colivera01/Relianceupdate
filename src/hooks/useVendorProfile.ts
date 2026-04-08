"use client";
import { useEffect, useState, useCallback } from "react";
import { VendorProfileResponse, VendorProfile, VendorProfileUpdateRequest } from "@/types/vendor";

export function useVendorProfile() {
  const [data, setData] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vendor/profile", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as VendorProfileResponse;
      if (json.success && json.profile) {
        setData(json.profile);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: VendorProfileUpdateRequest) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/vendor/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as VendorProfileResponse;
      if (json.success && json.profile) {
        setData(json.profile);
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
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { 
    data, 
    loading, 
    error, 
    saving,
    refetch: fetchProfile,
    updateProfile,
  };
}




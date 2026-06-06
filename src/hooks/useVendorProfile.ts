"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { VendorProfileResponse, VendorProfile, VendorProfileUpdateRequest } from "@/types/vendor";
import { getClientSessionHeaders } from "@/lib/client-session";
import { useAuth } from "@/contexts/AuthContext";

type VendorProfileFetchResult = {
  ok: boolean;
  status: number;
  payload: Record<string, any>;
};

const profileFetchInFlightByUserId = new Map<string, Promise<VendorProfileFetchResult>>();
const VENDOR_CONTEXT_CACHE_KEY_PREFIX = "vendorContextCache:";

type VendorContextResponse = {
  success: boolean;
  vendorId?: string;
  businessName?: string | null;
  role?: string | null;
  code?: string;
  message?: string;
  context?: Record<string, unknown>;
};

function normalizeUserId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const nestedId = (value as Record<string, unknown>).id;
    if (typeof nestedId === "string") {
      const trimmed = nestedId.trim();
      return trimmed || null;
    }
    if (typeof nestedId === "number") {
      return String(nestedId);
    }
  }
  return null;
}

async function fetchVendorProfileOnce(
  userId: string,
  headers: Record<string, string>
): Promise<VendorProfileFetchResult> {
  const key = String(userId);
  const existing = profileFetchInFlightByUserId.get(key);
  if (existing) return existing;

  const request = (async () => {
    const res = await fetch("/api/vendor/profile", {
      method: "GET",
      cache: "no-store",
      headers,
    });
    const payload = await res.json().catch(() => ({} as Record<string, any>));
    return {
      ok: res.ok,
      status: res.status,
      payload,
    };
  })();

  profileFetchInFlightByUserId.set(key, request);
  try {
    return await request;
  } finally {
    profileFetchInFlightByUserId.delete(key);
  }
}

async function fetchVendorContext(headers: Record<string, string>): Promise<VendorContextResponse> {
  const res = await fetch("/api/vendor/context", {
    method: "GET",
    cache: "no-store",
    headers,
  });
  const payload = await res.json().catch(() => ({} as Record<string, any>));
  return {
    success: res.ok && payload?.success === true,
    vendorId: payload?.vendorId ? String(payload.vendorId) : undefined,
    businessName:
      typeof payload?.businessName === "string" ? payload.businessName : null,
    role: typeof payload?.role === "string" ? payload.role : null,
    code: payload?.code ? String(payload.code) : undefined,
    message:
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
        ? payload.error
        : undefined,
    context: payload?.context && typeof payload.context === "object" ? payload.context : undefined,
  };
}

function getVendorContextCacheKey(userId: string) {
  return `${VENDOR_CONTEXT_CACHE_KEY_PREFIX}${userId}`;
}

function writeVendorContextCache(
  userId: string,
  vendorId: string,
  businessName?: string | null,
  role?: string | null
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getVendorContextCacheKey(userId),
      JSON.stringify({
        vendorId,
        businessName: businessName || null,
        role: role || null,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // No-op
  }
}

function readVendorContextCache(userId: string): { vendorId: string; businessName: string | null; role: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getVendorContextCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      vendorId?: unknown;
      businessName?: unknown;
      role?: unknown;
    };
    const vendorId = String(parsed?.vendorId || "").trim();
    if (!vendorId) return null;
    return {
      vendorId,
      businessName: typeof parsed?.businessName === "string" ? parsed.businessName : null,
      role: typeof parsed?.role === "string" ? parsed.role : null,
    };
  } catch {
    return null;
  }
}

function clearVendorContextCache(userId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getVendorContextCacheKey(userId));
  } catch {
    // No-op
  }
}

function buildFallbackVendorProfile(vendorId: string, businessName?: string | null): VendorProfile {
  return {
    id: vendorId,
    firstName: null,
    lastName: null,
    name: businessName || "Vendor",
    businessName: businessName || null,
    businessType: null,
    category: null,
    foundedYear: null,
    email: null,
    phone: null,
    city: null,
    state: null,
    address: null,
    zipCode: null,
    bio: null,
    website: null,
    licenseNumber: null,
    insuranceStatus: false,
    insuranceProvider: null,
    insuranceExpiry: null,
    bondingStatus: false,
    emergencyContact: null,
    responseTimeSettings: null,
    profilePhoto: null,
    serviceTypes: [],
    specializations: [],
    serviceAreas: [],
    totalEmployees: 0,
    yearsInBusiness: null,
    paymentsEnabled: false,
    reminders: {
      review: true,
      invoice: false,
      maintenance: true,
      followUp: true,
    },
    notificationSettings: {
      job: true,
      review: true,
      payout: false,
      support: true,
      marketing: false,
      updates: true,
    },
    twoFactorEnabled: false,
    loginNotifications: true,
    sessionTimeout: 30,
    passwordExpiry: null,
    failedLoginLockout: null,
    membershipStatus: "ACTIVE",
    isPubliclyListed: false,
    publiclyListedAt: null,
    serviceDraftCount: 0,
    publishedServiceCount: 0,
    onboarding: undefined,
  };
}

export function useVendorProfile() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const userId = normalizeUserId(user?.id);
  const [data, setData] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  const [lastResolvedVendorId, setLastResolvedVendorId] = useState<string | null>(null);
  const [hasResolvedVendorContext, setHasResolvedVendorContext] = useState(false);
  const inFlightFetchRef = useRef<Promise<void> | null>(null);
  const requestCounterRef = useRef(0);

  const fetchProfile = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!isAuthenticated || !userId) {
      setData(null);
      setApprovalPending(false);
      setLastResolvedVendorId(null);
      setHasResolvedVendorContext(false);
      setLoading(false);
      setError("Vendor session context unavailable. Please sign in again.");
      setErrorCode("VENDOR_SESSION_CONTEXT_UNAVAILABLE");
      return;
    }

    if (inFlightFetchRef.current) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[useVendorProfile] fetchProfile:deduped");
      }
      return inFlightFetchRef.current;
    }

    const requestId = ++requestCounterRef.current;
    const task = (async () => {
      const cachedContext = readVendorContextCache(userId);
      if (cachedContext?.vendorId) {
        setLastResolvedVendorId(cachedContext.vendorId);
        setHasResolvedVendorContext(true);
        setData((prev) => {
          if (prev?.id) return prev;
          return buildFallbackVendorProfile(cachedContext.vendorId, cachedContext.businessName);
        });
      }

      setLoading(true);
      setError(null);
      setErrorCode(null);
      setApprovalPending(false);

      try {
        const headers = getClientSessionHeaders(userId);
        const queryKey = `vendor-profile:${userId}`;
        if (process.env.NODE_ENV !== "production") {
          console.info("[useVendorProfile] fetchProfile:start", {
            requestId,
            hook: "useVendorProfile",
            queryKey,
            authLoading,
            isAuthenticated,
            userId,
            hasAuthHeader: Boolean(headers.Authorization),
            hasUserHeader: Boolean(headers["x-user-id"]),
          });
        }

        const { ok, status, payload } = await fetchVendorProfileOnce(userId, headers);
        if (!ok) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[useVendorProfile] fetchProfile:failed", {
              requestId,
              hook: "useVendorProfile",
              queryKey,
              status,
              payload,
            });
          }
          const message =
            String(payload?.error || payload?.message || "").trim() ||
            `Request failed with status ${status}`;
          const code = String(payload?.code || "").trim() || null;
          if (status === 401) {
            setData(null);
            setError(message || "Vendor session context unavailable. Please sign in again.");
            setErrorCode(code || "VENDOR_SESSION_CONTEXT_UNAVAILABLE");
            setHasResolvedVendorContext(false);
            setLastResolvedVendorId(null);
            clearVendorContextCache(userId);
            return;
          }
          if (status === 403 && (payload?.code === "VENDOR_PENDING_APPROVAL" || payload?.code === "MEMBERSHIP_PENDING_APPROVAL")) {
            setApprovalPending(true);
            setData(null);
            setError(String(payload?.error || "Vendor membership pending approval"));
            setErrorCode(String(payload?.code || "MEMBERSHIP_PENDING_APPROVAL"));
            setHasResolvedVendorContext(false);
            setLastResolvedVendorId(null);
            return;
          }

          // Non-blocking fallback: try lightweight vendor context resolution
          // so vendor pages can still load vendor-scoped data by vendorId.
          const fallbackContext = await fetchVendorContext(headers).catch(() => null);
          if (process.env.NODE_ENV !== "production") {
            console.info("[useVendorProfile] fetchProfile:context-fallback", {
              requestId,
              hook: "useVendorProfile",
              queryKey,
              fallbackSuccess: Boolean(fallbackContext?.success),
              fallbackVendorId: fallbackContext?.vendorId || null,
              fallbackCode: fallbackContext?.code || null,
            });
          }

          if (fallbackContext?.success && fallbackContext.vendorId) {
            setHasResolvedVendorContext(true);
            setLastResolvedVendorId(String(fallbackContext.vendorId));
            setData((prev) => {
              if (prev?.id) return prev;
              return buildFallbackVendorProfile(
                String(fallbackContext.vendorId),
                fallbackContext.businessName || cachedContext?.businessName || null
              );
            });
            writeVendorContextCache(
              userId,
              String(fallbackContext.vendorId),
              fallbackContext.businessName || null,
              fallbackContext.role || null
            );
          } else if (cachedContext?.vendorId) {
            setHasResolvedVendorContext(true);
            setLastResolvedVendorId(cachedContext.vendorId);
            setData((prev) => {
              if (prev?.id) return prev;
              return buildFallbackVendorProfile(cachedContext.vendorId, cachedContext.businessName);
            });
          }

          setErrorCode(code || "VENDOR_PROFILE_UNAVAILABLE");
          setError(message);
          return;
        }

        const json = payload as unknown as VendorProfileResponse;
        if (process.env.NODE_ENV !== "production") {
          console.info("[useVendorProfile] fetchProfile:success", {
            requestId,
            hook: "useVendorProfile",
            queryKey,
            vendorId: json?.profile?.id || null,
          });
        }
        if (json.success && json.profile) {
          setData(json.profile);
          setApprovalPending(Boolean(json.approvalPending || json.profile.membershipStatus === "PENDING"));
          setErrorCode(null);
          setHasResolvedVendorContext(true);
          setLastResolvedVendorId(String(json.profile.id));
          writeVendorContextCache(
            userId,
            String(json.profile.id),
            json.profile.businessName || json.profile.name || null,
            null
          );
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[useVendorProfile] fetchProfile:error", {
            requestId,
            hook: "useVendorProfile",
            message: err instanceof Error ? err.message : String(err),
          });
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();

    inFlightFetchRef.current = task.finally(() => {
      inFlightFetchRef.current = null;
    });
    return inFlightFetchRef.current;
  }, [authLoading, isAuthenticated, userId]);

  const updateProfile = useCallback(async (updates: VendorProfileUpdateRequest) => {
    setSaving(true);
    setError(null);
    setErrorCode(null);

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
        const code = String(payload?.code || "").trim() || null;
        if (res.status === 401) {
          setErrorCode(code || "VENDOR_SESSION_CONTEXT_UNAVAILABLE");
          throw new Error("Vendor session context unavailable. Please sign in again.");
        }
        if (res.status === 403 && (payload?.code === "VENDOR_PENDING_APPROVAL" || payload?.code === "MEMBERSHIP_PENDING_APPROVAL")) {
          setApprovalPending(true);
          setErrorCode(String(payload?.code || "MEMBERSHIP_PENDING_APPROVAL"));
          throw new Error(String(payload?.error || "Vendor membership pending approval"));
        }
        setErrorCode(code);
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
    errorCode,
    saving,
    approvalPending,
    hasResolvedVendorContext,
    resolvedVendorId: data?.id ? String(data.id) : lastResolvedVendorId,
    refetch: fetchProfile,
    updateProfile,
  };
}


"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type VendorSessionGuardPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  nextCheckInMs?: number;
};

function clearClientAuthState() {
  try {
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("registrationSuccess");
    sessionStorage.removeItem("registrationUserType");
  } catch {
    // Browser storage can be unavailable in private or locked-down contexts.
  }
}

export default function VendorSessionGuard() {
  const router = useRouter();
  const pathname = usePathname() || "/vendor/dashboard";
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    const schedule = (delayMs: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (disposed) return;
      timeoutRef.current = setTimeout(() => {
        void checkSession();
      }, Math.max(15_000, Math.min(delayMs, 60_000)));
    };

    const handleExpired = () => {
      clearClientAuthState();
      const next = encodeURIComponent(pathname || "/vendor/dashboard");
      router.replace(`/auth/login?reason=session-timeout&next=${next}`);
    };

    const checkSession = async () => {
      if (disposed || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const response = await fetch("/api/vendor/session-guard", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as VendorSessionGuardPayload;
        if (response.status === 401 && payload?.code === "VENDOR_SESSION_TIMEOUT") {
          handleExpired();
          return;
        }
        schedule(Number(payload?.nextCheckInMs || 60_000));
      } catch {
        schedule(60_000);
      } finally {
        inFlightRef.current = false;
      }
    };

    const onFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    };

    void checkSession();
    window.addEventListener("focus", onFocusOrVisibility);
    document.addEventListener("visibilitychange", onFocusOrVisibility);

    return () => {
      disposed = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener("focus", onFocusOrVisibility);
      document.removeEventListener("visibilitychange", onFocusOrVisibility);
    };
  }, [pathname, router]);

  return null;
}

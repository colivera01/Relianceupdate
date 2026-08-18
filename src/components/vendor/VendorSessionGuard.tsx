"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type VendorSessionGuardPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  nextCheckInMs?: number;
  idleExpiresAt?: string | null;
  absoluteExpiresAt?: string | null;
  warningAt?: string | null;
};

const ACTIVITY_RENEWAL_THROTTLE_MS = 60_000;

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
  const lastRenewalRef = useRef(0);
  const [warning, setWarning] = useState<VendorSessionGuardPayload | null>(null);
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    let disposed = false;

    const schedule = (delayMs: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (disposed) return;
      timeoutRef.current = setTimeout(() => void checkSession(), Math.max(15_000, Math.min(delayMs, 60_000)));
    };

    const handleExpired = () => {
      clearClientAuthState();
      const next = encodeURIComponent(pathname || "/vendor/dashboard");
      router.replace(`/auth/login?reason=session-timeout&next=${next}`);
    };

    const applyPayload = (payload: VendorSessionGuardPayload) => {
      const warningAtMs = payload.warningAt ? new Date(payload.warningAt).getTime() : 0;
      const idleExpiresAtMs = payload.idleExpiresAt ? new Date(payload.idleExpiresAt).getTime() : 0;
      if (warningAtMs && idleExpiresAtMs && Date.now() >= warningAtMs) {
        setWarning(payload);
        setRemainingSeconds(Math.max(0, Math.ceil((idleExpiresAtMs - Date.now()) / 1000)));
      } else {
        setWarning(null);
      }
      schedule(Number(payload.nextCheckInMs || 60_000));
    };

    const requestSession = async (renew: boolean) => {
      if (disposed || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const response = await fetch("/api/vendor/session-guard", {
          method: renew ? "POST" : "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as VendorSessionGuardPayload;
        if (response.status === 401 && payload?.code === "VENDOR_SESSION_TIMEOUT") {
          handleExpired();
          return;
        }
        if (response.ok) {
          if (renew) lastRenewalRef.current = Date.now();
          applyPayload(payload);
        } else {
          schedule(60_000);
        }
      } catch {
        schedule(60_000);
      } finally {
        inFlightRef.current = false;
      }
    };

    const checkSession = () => requestSession(false);
    const renewSession = () => requestSession(true);

    const onActivity = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.type === "input" || event.type === "change") {
        if (target?.closest("form, [role='dialog']")) setHasUnsavedWork(true);
      }
      if (Date.now() - lastRenewalRef.current >= ACTIVITY_RENEWAL_THROTTLE_MS) {
        void renewSession();
      }
    };

    const onFocusOrVisibility = () => {
      if (document.visibilityState === "visible") void checkSession();
    };

    // Loading a protected vendor page is authenticated activity and also migrates legacy sessions.
    void renewSession();
    for (const eventName of ["pointerdown", "keydown", "input", "change", "touchstart"]) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    window.addEventListener("focus", onFocusOrVisibility);
    document.addEventListener("visibilitychange", onFocusOrVisibility);

    return () => {
      disposed = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      for (const eventName of ["pointerdown", "keydown", "input", "change", "touchstart"]) {
        window.removeEventListener(eventName, onActivity);
      }
      window.removeEventListener("focus", onFocusOrVisibility);
      document.removeEventListener("visibilitychange", onFocusOrVisibility);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!warning?.idleExpiresAt) return;
    const expiresAtMs = new Date(warning.idleExpiresAt).getTime();
    const timer = setInterval(() => {
      const next = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) {
        clearClientAuthState();
        const nextPath = encodeURIComponent(pathname || "/vendor/dashboard");
        router.replace(`/auth/login?reason=session-timeout&next=${nextPath}`);
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [pathname, router, warning]);

  if (!warning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl border border-amber-300 bg-slate-950 p-4 text-white shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5" role="alertdialog" aria-labelledby="vendor-session-warning-title">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-5 w-5 flex-none text-amber-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="vendor-session-warning-title" className="text-sm font-semibold">You will be signed out due to inactivity</h2>
          <p className="mt-1 text-sm text-slate-300">Your vendor session expires in {minutes}:{seconds}. Stay signed in to continue working.</p>
          {hasUnsavedWork ? <p className="mt-2 text-xs text-amber-200">You may have unsaved changes. Finish or save them before signing out.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              onClick={async () => {
                const response = await fetch("/api/vendor/session-guard", { method: "POST", credentials: "same-origin", cache: "no-store" });
                if (response.ok) setWarning(null);
              }}
            >
              Stay signed in
            </button>
            <button
              type="button"
              className="border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              onClick={() => router.push("/logout")}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

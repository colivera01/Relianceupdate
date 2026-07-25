"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { appendAuthNext, sanitizeAuthNextPath } from "@/lib/auth-next";

type VerifyState = "loading" | "success" | "error";

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => String(searchParams?.get("token") || "").trim(), [searchParams]);
  const nextPath = useMemo(
    () => sanitizeAuthNextPath(searchParams?.get("next")),
    [searchParams]
  );
  const loginHref = appendAuthNext("/auth/login", nextPath);
  const [state, setState] = useState<VerifyState>(token ? "loading" : "error");
  const [message, setMessage] = useState(
    token ? "Verifying your email..." : "Verification link is missing or incomplete."
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setState("error");
          setMessage(String(json?.error || "Verification failed. Please request a new link."));
          return;
        }
        setState("success");
        setMessage(String(json?.message || "Email verified successfully."));
      } catch {
        if (cancelled) return;
        setState("error");
        setMessage("Verification failed. Please try again or request a new link.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Reliance</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Verify your email</h1>
        <p className="mt-4 text-base text-slate-600">{message}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          {state === "success" ? (
            <Link
              href={loginHref}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Continue to sign in
            </Link>
          ) : null}
          <Link
            href={loginHref}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}

function VerifyEmailPageFallback() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Reliance</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Verify your email</h1>
        <p className="mt-4 text-base text-slate-600">Preparing your verification details...</p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailPageFallback />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

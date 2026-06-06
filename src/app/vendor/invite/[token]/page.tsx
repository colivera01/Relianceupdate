"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type InviteInfo = {
  token: string;
  code: string;
  expiresAt: string;
  vendor: { id: string; name: string };
};

type InviteLoadState =
  | "loading"
  | "ready"
  | "invalid_or_expired"
  | "already_accepted_or_cancelled"
  | "backend_error";

export default function VendorInvitePage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => String(params?.token || "").trim(), [params?.token]);
  const [loading, setLoading] = useState(true);
  const [loadState, setLoadState] = useState<InviteLoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [debugDetails, setDebugDetails] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acceptDebugDetails, setAcceptDebugDetails] = useState<string | null>(null);

  const loadInvite = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    else setLoading(true);
    setError(null);
    setDebugDetails(null);
    setInvite(null);
    setLoadState("loading");
    if (!token) {
      setError("Invalid invite token.");
      setLoadState("invalid_or_expired");
      setLoading(false);
      setRetrying(false);
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(`/api/vendor/invite/${token}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.invite) {
        const code = String(json?.code || "");
        const diagnostics = json?.diagnostics;
        if (process.env.NODE_ENV !== "production" && diagnostics) {
          setDebugDetails(
            `status=${res.status} code=${code || "none"} diagnostics=${JSON.stringify(diagnostics)}`
          );
        }
        if (res.status === 409 || code === "ALREADY_ACCEPTED" || code === "CANCELLED_OR_INACTIVE") {
          setLoadState("already_accepted_or_cancelled");
          throw new Error(json?.error || "Invite has already been accepted or is no longer active.");
        }
        if (res.status >= 500) {
          setLoadState("backend_error");
          throw new Error(json?.error || "Backend error loading invite.");
        }
        setLoadState("invalid_or_expired");
        throw new Error(json?.error || "Invite is invalid or expired.");
      }
      setInvite(json.invite);
      setLoadState("ready");
    } catch (e) {
      const isAbort = e instanceof Error && e.name === "AbortError";
      if (isAbort) {
        setLoadState("backend_error");
        setError("Invite lookup timed out. Please retry.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load invite");
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => {
    void loadInvite(false);
  }, [token]);

  const onAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setAcceptDebugDetails(null);
    try {
      const res = await fetch(`/api/vendor/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const backendError = String(json?.error || "Failed to accept invite.");
        const backendCode = String(json?.code || "none");
        const backendMessage = String(json?.message || "");
        const backendStep = String(json?.step || "unknown_step");
        const backendDetails = json?.details ?? null;
        if (process.env.NODE_ENV !== "production") {
          setAcceptDebugDetails(
            `status=${res.status} error="${backendError}" code=${backendCode} message="${backendMessage}" step=${backendStep} details=${JSON.stringify(
              backendDetails
            )}`
          );
        }
        throw new Error(
          `Failed to accept invite (${res.status}) | error="${backendError}" code=${backendCode} message="${backendMessage}" step=${backendStep}`
        );
      }
      setSuccessMessage("Invite accepted. Your employee membership is now active. You can sign in and open /employee/jobs.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Team Invite</h1>
        {loading ? <p className="mt-4 text-sm text-gray-600">Loading invite...</p> : null}
        {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {!loading && loadState === "invalid_or_expired" ? (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This invite is invalid or expired. Ask your manager for a fresh invite link.
          </p>
        ) : null}
        {!loading && loadState === "already_accepted_or_cancelled" ? (
          <p className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            This invite was already accepted or cancelled. Contact your manager if you still need access.
          </p>
        ) : null}
        {!loading && loadState === "backend_error" ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>We could not load the invite due to a backend error.</p>
            <button
              type="button"
              disabled={retrying}
              onClick={() => void loadInvite(true)}
              className="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {retrying ? "Trying Again..." : "Try Again"}
            </button>
          </div>
        ) : null}
        {process.env.NODE_ENV !== "production" && debugDetails ? (
          <pre className="mt-3 overflow-auto rounded border bg-gray-100 p-2 text-[11px] text-gray-700">{debugDetails}</pre>
        ) : null}
        {invite ? (
          <div className="mt-4 space-y-4">
            <div className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900">Company: {invite.vendor.name}</p>
              <p>Role: Employee</p>
              <p>Invite code: {invite.code}</p>
              <p>Expires: {new Date(invite.expiresAt).toLocaleString()}</p>
            </div>

            {successMessage ? (
              <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p>
            ) : (
              <>
                <p className="text-xs text-gray-600">
                  Confirm your invitee details (name/email/phone) and accept.
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void onAccept()}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Accepting..." : "Accept Invite"}
                </button>
              </>
            )}
            {process.env.NODE_ENV !== "production" && acceptDebugDetails ? (
              <pre className="overflow-auto rounded border bg-gray-100 p-2 text-[11px] text-gray-700">{acceptDebugDetails}</pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}


"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mic2, ShieldCheck, UserRound, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeVerifiedDecision } from "@/components/employee/EmployeeVerifiedDecision";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";

type ConsentMembership = {
  membershipId: string;
  employeeName: string;
  vendorId: string;
  vendorName: string;
  status: "ALLOWED" | "NOT_ALLOWED" | "NOT_DECIDED" | "UPDATE_REQUIRED";
  decision: null | {
    id: string;
    decision: "ALLOW" | "DENY";
    decidedAt: string;
    policyVersion: string;
    coversLikeness: boolean;
    coversAudio: boolean;
    effectScope: string;
  };
};

type ConsentView = {
  policyVersion: string;
  consentText: string;
  consentTextAllow: string;
  consentTextDeny: string;
  memberships: ConsentMembership[];
  notifications: Array<{ id: string; title: string; message: string; createdAt: string }>;
};

export default function EmployeePublicMediaConsentPage() {
  const { user } = useAuth();
  const userId = String(user?.id || "").trim();
  const [captureToken, setCaptureToken] = useState("");
  const [participationToken, setParticipationToken] = useState("");
  const [accessInitialized, setAccessInitialized] = useState(false);
  const headers = useMemo(() => ({
    ...getClientSessionHeaders(userId),
    ...(captureToken ? { "x-employee-capture-token": captureToken } : {}),
    ...(participationToken ? { "x-employee-public-media-consent-token": participationToken } : {}),
  }), [captureToken, participationToken, userId]);
  const [view, setView] = useState<ConsentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<{ membershipId: string; decision: "ALLOW" | "DENY" } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextCapture = String(params.get("ct") || params.get("captureToken") || sessionStorage.getItem("employee_capture_token") || "").trim();
    const nextParticipation = String(params.get("pct") || params.get("consentToken") || sessionStorage.getItem("employee_public_participation_token") || "").trim();
    setCaptureToken(nextCapture);
    setParticipationToken(nextParticipation);
    if (nextCapture) sessionStorage.setItem("employee_capture_token", nextCapture);
    if (nextParticipation) sessionStorage.setItem("employee_public_participation_token", nextParticipation);
    if (params.has("ct") || params.has("captureToken") || params.has("pct") || params.has("consentToken")) {
      window.history.replaceState({}, "", "/employee/public-media-consent");
    }
    setAccessInitialized(true);
  }, []);

  const load = useCallback(async () => {
    if (!accessInitialized) return;
    if (!userId && !captureToken && !participationToken) {
      setLoading(false);
      setError("Open the secure link sent to you, or sign in with an Employee-enabled account.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/employee/public-media-consent", {
        headers,
        credentials: "include",
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "Unable to load Public Media Consent");
      setView(body.consent as ConsentView);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load Public Media Consent");
    } finally {
      setLoading(false);
    }
  }, [accessInitialized, captureToken, headers, participationToken, userId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="reliance-grid-lines min-h-screen bg-[#050a13] px-4 py-8 text-white">
      <main className="mx-auto w-full max-w-3xl space-y-5">
        {captureToken ? (
          <Link href={`/employee/jobs?ct=${encodeURIComponent(captureToken)}`} className="inline-flex items-center gap-2 text-sm font-medium text-blue-200 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to this Service Order
          </Link>
        ) : userId ? (
          <Link href="/employee/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-blue-200 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to assigned work
          </Link>
        ) : null}
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Employee privacy choice</p>
          <h1 className="text-3xl font-bold">Public Service Video Participation</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">
            Make one standing choice for each business you work with. This is separate from permission to record a service.
          </p>
        </header>

        <Card className="border-blue-400/30 bg-slate-950 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><ShieldCheck className="h-5 w-5 text-blue-300" /> What allowing means</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
            <p>{view?.consentText || "Allow your image, likeness, and voice to appear in eligible Reliance Service Videos that Customers choose to share publicly."}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><UserRound className="mb-2 h-5 w-5 text-blue-300" /><strong className="text-white">Image and likeness</strong><p>Your identifiable appearance is covered.</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><Mic2 className="mb-2 h-5 w-5 text-blue-300" /><strong className="text-white">Voice and audio</strong><p>Your identifiable voice and approved service audio are covered.</p></div>
            </div>
            <p className="rounded-lg border border-amber-300/30 bg-amber-950/25 p-3 text-amber-100">
              Allowing may apply to an eligible Service Video currently waiting for this choice and to future eligible Service Videos. A Customer must still choose Share Publicly for each Service Video.
            </p>
            <ul className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-slate-200">
              <li>The Customer remains the visibility decision-maker for every Service Video.</li>
              <li>This is one standing participation choice, not a separate approval for every job.</li>
              <li>No additional Admin approval is required after all current requirements pass.</li>
              <li>This optional Public choice does not affect employment, assignments, the underlying service, or Customer Private Proof.</li>
            </ul>
          </CardContent>
        </Card>

        {loading ? <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950 p-4 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Loading your current choice…</div> : null}
        {error ? <p role="alert" className="rounded-lg border border-red-400/40 bg-red-950/35 p-4 text-sm text-red-100">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg border border-emerald-400/40 bg-emerald-950/35 p-4 text-sm text-emerald-100">{message}</p> : null}

        {!loading && view?.memberships.length === 0 ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-950/25 p-4 text-sm text-amber-100">An active Employee membership is required to make this choice.</p>
        ) : null}

        {view?.memberships.map((membership) => {
          const pending = confirmation?.membershipId === membership.membershipId ? confirmation : null;
          return (
            <Card key={membership.membershipId} className="border-slate-700 bg-slate-950 text-white">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm text-slate-400">Business</p><CardTitle className="mt-1 text-xl">{membership.vendorName}</CardTitle></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${membership.status === "ALLOWED" ? "bg-emerald-600 text-white" : membership.status === "NOT_ALLOWED" ? "bg-slate-700 text-white" : "bg-amber-500 text-slate-950"}`}>
                    {membership.status === "ALLOWED" ? "Allowed" : membership.status === "NOT_ALLOWED" ? "Not allowed" : membership.status === "UPDATE_REQUIRED" ? "Update required" : "Choice needed"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-400">Employee recognized</dt><dd className="font-semibold text-white">{membership.employeeName}</dd></div>
                  <div><dt className="text-slate-400">Vendor</dt><dd className="font-semibold text-white">{membership.vendorName}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-slate-400">Employee membership</dt><dd className="break-all font-mono text-xs text-white">{membership.membershipId}</dd></div>
                  <div><dt className="text-slate-400">Scope</dt><dd className="text-white">Current pending and future eligible Service Videos</dd></div>
                  <div><dt className="text-slate-400">Coverage</dt><dd className="text-white">Image, likeness, voice, and audio</dd></div>
                </dl>
                <p className="text-sm text-slate-300">
                  {membership.decision
                    ? `Current choice recorded ${new Date(membership.decision.decidedAt).toLocaleString()}.`
                    : "No standing Public Media Consent choice has been recorded."}
                </p>
                {!pending ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setConfirmation({ membershipId: membership.membershipId, decision: "ALLOW" })}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Allow Public Service Video Participation
                    </Button>
                    <Button variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => setConfirmation({ membershipId: membership.membershipId, decision: "DENY" })}>
                      <XCircle className="mr-2 h-4 w-4" /> Do Not Allow
                    </Button>
                  </div>
                ) : (
                  <EmployeeVerifiedDecision
                    purpose="EMPLOYEE_STANDING_PUBLIC_MEDIA"
                    membershipId={membership.membershipId}
                    decision={pending.decision}
                    title="Public Service Videos"
                    decisionText={pending.decision === "ALLOW"
                      ? view?.consentTextAllow || "I allow my image, likeness, voice, and audio to appear in eligible Reliance Service Videos for this business when the Customer separately chooses to share the complete video publicly. I may change this choice."
                      : view?.consentTextDeny || "I do not allow Public use of my image, likeness, voice, or audio. Dependent Public videos will be removed from Public display; customer Private Proof remains available."}
                    headers={headers}
                    submitUrl="/api/employee/public-media-consent"
                    onCancel={() => setConfirmation(null)}
                    onComplete={async (body) => {
                      setMessage(pending.decision === "ALLOW"
                        ? "Public Service Video participation is allowed. Customer choice and every other Reliance requirement remain separate."
                        : body?.alreadyPublicAffected
                          ? "Public participation is no longer allowed. Dependent Public display was removed; Customer Private Proof remains available."
                          : "Public Service Video participation is not allowed. Customer Private Proof is unaffected.");
                      setConfirmation(null);
                      await load();
                    }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}

        {view?.notifications.length ? (
          <Card className="border-slate-700 bg-slate-950 text-white">
            <CardHeader><CardTitle className="text-lg">Public Service Video updates</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {view.notifications.map((notice) => <div key={notice.id} className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="font-semibold">{notice.title}</p><p className="mt-1 text-sm text-slate-300">{notice.message}</p><p className="mt-2 text-xs text-slate-500">{new Date(notice.createdAt).toLocaleString()}</p></div>)}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}

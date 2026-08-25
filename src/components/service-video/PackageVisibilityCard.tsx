"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicationWorkflowCard } from "@/components/service-video/PublicationWorkflowCard";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";

type VisibilityState =
  | "AUDIT_PENDING"
  | "AUDIT_FAILED"
  | "PRIVATE_DEFAULT"
  | "PRIVATE"
  | "PUBLIC_REVIEW_PENDING"
  | "PUBLIC";

type VisibilityResponse = {
  canDecide: boolean;
  visibility: {
    state: VisibilityState;
    auditPassed: boolean;
    privateProofReleased: boolean;
    visibilityDecision?: { decision?: string; decidedAt?: string } | null;
    proposal?: { status?: string } | null;
    legacyProposal?: { id?: string; status?: string } | null;
    package?: { id: string; version: number; packageHash: string; audioIncluded: boolean } | null;
  } | null;
};

const COPY: Record<VisibilityState, { title: string; detail: string }> = {
  AUDIT_PENDING: {
    title: "Private Proof locked",
    detail: "The complete Service Video remains locked until Reliance Audit passes.",
  },
  AUDIT_FAILED: {
    title: "Reliance Audit failed",
    detail: "No Private Proof or Public-sharing decision is available for this closed work record.",
  },
  PRIVATE_DEFAULT: {
    title: "Private by default",
    detail: "The complete approved Service Video is available as Private Proof. No Public-sharing authorization has been given.",
  },
  PRIVATE: {
    title: "Private",
    detail: "The customer chose to keep the complete approved Service Video private.",
  },
  PUBLIC_REVIEW_PENDING: {
    title: "Public Review Pending",
    detail: "The customer authorized the complete approved package to enter Reliance Public review. It is not Public yet.",
  },
  PUBLIC: {
    title: "Public",
    detail: "Reliance approved the customer-authorized complete package for Public visibility.",
  },
};

export function PackageVisibilityCard({
  bookingId,
  role,
}: {
  bookingId: string;
  role: "customer" | "vendor";
}) {
  const { user } = useAuth();
  const userId = typeof user?.id === "string" || typeof user?.id === "number" ? String(user.id) : "";
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const endpoint = `/api/bookings/${encodeURIComponent(bookingId)}/visibility`;
  const [data, setData] = useState<VisibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { credentials: "include", cache: "no-store", headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "Unable to load Service Video visibility");
      setData(body as VisibilityResponse);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load Service Video visibility");
    } finally {
      setLoading(false);
    }
  }, [endpoint, headers]);

  useEffect(() => { void load(); }, [load]);

  async function decide(decision: "KEEP_PRIVATE" | "SHARE_PUBLICLY") {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          decision,
          audioConfirmation: decision === "SHARE_PUBLICLY" && data?.visibility?.package?.audioIncluded === true,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "The visibility decision could not be saved");
      setMessage(decision === "KEEP_PRIVATE"
        ? "The complete Service Video will remain Private."
        : "The complete Service Video was sent to Reliance Public review. It is not Public yet.");
      setConfirmPublic(false);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The visibility decision could not be saved");
    } finally {
      setWorking(false);
    }
  }

  const state = data?.visibility?.state || "AUDIT_PENDING";
  const copy = COPY[state];
  const publicState = state === "PUBLIC" || state === "PUBLIC_REVIEW_PENDING";
  const canDecide = role === "customer" && data?.canDecide === true;

  return (
    <>
    <Card className="border-slate-700 bg-slate-950 text-white shadow-sm" data-testid={`package-visibility-${role}`}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            {publicState ? <Globe2 className="h-5 w-5 text-emerald-300" /> : <LockKeyhole className="h-5 w-5 text-blue-300" />}
            Service Video visibility
          </CardTitle>
          <Badge className={publicState ? "bg-emerald-600 text-white" : "bg-blue-950 text-blue-100"}>
            {state === "PUBLIC" ? "Public" : state === "PUBLIC_REVIEW_PENDING" ? "Public review" : "Private"}
          </Badge>
        </div>
        <p className="text-sm text-slate-300">The Starting Condition, Work in Progress, and Final Result stay together as one exact package.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="flex min-h-20 items-center gap-2 text-sm text-slate-300" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading visibility...</div> : null}
        {error ? <div role="alert" className="rounded-md border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100"><p>{error}</p><Button size="sm" variant="outline" className="mt-3 border-red-300/50 bg-transparent text-white" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button></div> : null}
        {message ? <div className="rounded-md border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm text-emerald-100">{message}</div> : null}
        {!loading && data?.visibility ? (
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="font-semibold text-white">{copy.title}</p>
            <p className="mt-1 text-sm text-slate-300">{copy.detail}</p>
          </div>
        ) : null}
        {!loading && data?.visibility?.legacyProposal ? (
          <div className="rounded-md border border-amber-400/30 bg-amber-950/25 p-3 text-sm text-amber-100">
            This historical record uses the earlier stage-based Public-sharing contract. Its original evidence remains readable and unchanged.
          </div>
        ) : null}
        {canDecide && !confirmPublic ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Public sharing is optional. No action keeps the complete package Private.</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={working} variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => void decide("KEEP_PRIVATE")}>
                <LockKeyhole className="mr-2 h-4 w-4" /> Keep Private
              </Button>
              <Button disabled={working} className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setConfirmPublic(true)}>
                <Globe2 className="mr-2 h-4 w-4" /> Share Publicly
              </Button>
            </div>
          </div>
        ) : null}
        {canDecide && confirmPublic ? (
          <div className="rounded-md border border-blue-400/30 bg-blue-950/30 p-4" data-testid="package-public-confirmation">
            <p className="flex items-center gap-2 font-semibold text-blue-100"><ShieldCheck className="h-4 w-4" /> Authorize the complete package?</p>
            <p className="mt-2 text-sm text-blue-100/80">This sends all three exact Admin-approved stages to Reliance Public review. Nothing becomes Public unless that separate review passes.</p>
            {data?.visibility?.package?.audioIncluded ? (
              <p className="mt-2 rounded-md border border-amber-300/30 bg-amber-950/30 p-3 text-sm font-semibold text-amber-100">
                This Service Video contains audio. If you continue, the approved video and its audio may become publicly viewable if the package passes Reliance Public review.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={working} className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void decide("SHARE_PUBLICLY")}>
                {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe2 className="mr-2 h-4 w-4" />}
                Authorize Public Review
              </Button>
              <Button disabled={working} variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => setConfirmPublic(false)}>Go Back</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
    {role === "customer" && data?.visibility?.legacyProposal ? (
      <PublicationWorkflowCard role="customer" bookingId={bookingId} />
    ) : null}
    </>
  );
}

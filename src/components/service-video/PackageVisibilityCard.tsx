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
  | "PRIVATE_ONLY"
  | "PUBLIC_VISIBILITY_HOLD"
  | "PUBLIC_WAITING_PERMISSION"
  | "PUBLIC_REVIEW_PENDING"
  | "PUBLIC";

type VisibilityResponse = {
  canDecide: boolean;
  visibility: {
    state: VisibilityState;
    auditPassed: boolean;
    privateProofReleased: boolean;
    publicDisplayEligibility?: string | null;
    publicDisplayReason?: string | null;
    publicRestrictionActive?: boolean;
    visibilityContractVersion?: number;
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
    title: "Private",
    detail: "Your Service Video is visible only to you.",
  },
  PRIVATE: {
    title: "Private",
    detail: "Your Service Video is visible only to you.",
  },
  PRIVATE_ONLY: {
    title: "Private",
    detail: "This Service Video is available as Private Proof but is not eligible for Public display.",
  },
  PUBLIC_VISIBILITY_HOLD: {
    title: "Public visibility temporarily paused",
    detail: "Reliance is investigating a reported concern. Your Public authorization and Private Proof remain preserved.",
  },
  PUBLIC_WAITING_PERMISSION: {
    title: "Waiting for Public-sharing permission",
    detail: "Your Service Video remains Private until all required participant permissions are complete.",
  },
  PUBLIC_REVIEW_PENDING: {
    title: "Public visibility pending",
    detail: "This historical record is still governed by its original Public-processing contract.",
  },
  PUBLIC: {
    title: "Public",
    detail: "Your Service Video is publicly viewable on Reliance.",
  },
};

export function PackageVisibilityCard({ bookingId, role }: { bookingId: string; role: "customer" | "vendor" }) {
  const { user } = useAuth();
  const userId = typeof user?.id === "string" || typeof user?.id === "number" ? String(user.id) : "";
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const endpoint = `/api/bookings/${encodeURIComponent(bookingId)}/visibility`;
  const [data, setData] = useState<VisibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmation, setConfirmation] = useState<"public" | "private" | null>(null);
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
        ? "Your Service Video is now Private. Your Private Proof remains available."
        : body?.proposal?.status === "PUBLIC"
          ? "Your complete Service Video is now Public."
          : "Your Service Video remains Private while required Public-sharing permission is completed.");
      setConfirmation(null);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The visibility decision could not be saved");
    } finally {
      setWorking(false);
    }
  }

  const state = data?.visibility?.state || "AUDIT_PENDING";
  const copy = COPY[state];
  const isPublic = state === "PUBLIC";
  const canDecide = role === "customer" && data?.canDecide === true;
  const canShare = canDecide && ["PRIVATE_DEFAULT", "PRIVATE"].includes(state);
  const canMakePrivate = canDecide && isPublic;

  return (
    <>
      <Card className="border-slate-700 bg-slate-950 text-white shadow-sm" data-testid={`package-visibility-${role}`}>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              {isPublic ? <Globe2 className="h-5 w-5 text-emerald-300" /> : <LockKeyhole className="h-5 w-5 text-blue-300" />}
              Service Video visibility
            </CardTitle>
            <Badge className={isPublic ? "bg-emerald-600 text-white" : "bg-blue-950 text-blue-100"}>
              {isPublic ? "Public" : state === "PUBLIC_VISIBILITY_HOLD" ? "Public hold" : state === "PUBLIC_WAITING_PERMISSION" ? "Waiting for permission" : "Private"}
            </Badge>
          </div>
          <p className="text-sm text-slate-300">Starting Condition, Work in Progress, and Final Result always stay together as one exact Service Video.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <div className="flex min-h-20 items-center gap-2 text-sm text-slate-300" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading visibility...</div> : null}
          {error ? <div role="alert" className="rounded-md border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100"><p>{error}</p><Button size="sm" variant="outline" className="mt-3 border-red-300/50 bg-transparent text-white" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button></div> : null}
          {message ? <div role="status" className="rounded-md border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm text-emerald-100">{message}</div> : null}
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
          {canShare && confirmation === null ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">Public sharing is optional. No action keeps the complete package Private.</p>
              <Button disabled={working} className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setConfirmation("public")}>
                <Globe2 className="mr-2 h-4 w-4" /> Share Publicly
              </Button>
            </div>
          ) : null}
          {canMakePrivate && confirmation === null ? (
            <Button disabled={working} variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => setConfirmation("private")}>
              <LockKeyhole className="mr-2 h-4 w-4" /> Make Private
            </Button>
          ) : null}
          {canShare && confirmation === "public" ? (
            <div className="rounded-md border border-blue-400/30 bg-blue-950/30 p-4" data-testid="package-public-confirmation">
              <p className="flex items-center gap-2 font-semibold text-blue-100"><ShieldCheck className="h-4 w-4" /> Make this Service Video public?</p>
              <p className="mt-2 text-sm text-blue-100/80">Your complete Service Video, including Starting Condition, Work in Progress, and Final Result, will become publicly viewable on Reliance when all required permissions are complete.</p>
              {data?.visibility?.package?.audioIncluded ? (
                <p className="mt-2 rounded-md border border-amber-300/30 bg-amber-950/30 p-3 text-sm font-semibold text-amber-100">
                  This Service Video contains audio. If you continue, the approved video and its audio will become publicly viewable.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={working} className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void decide("SHARE_PUBLICLY")}>
                  {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe2 className="mr-2 h-4 w-4" />}
                  Confirm Share Publicly
                </Button>
                <Button disabled={working} variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => setConfirmation(null)}>Cancel</Button>
              </div>
            </div>
          ) : null}
          {canMakePrivate && confirmation === "private" ? (
            <div className="rounded-md border border-slate-500 bg-slate-900 p-4" data-testid="package-private-confirmation">
              <p className="font-semibold text-white">Make this Service Video private?</p>
              <p className="mt-2 text-sm text-slate-300">It will no longer be publicly viewable on Reliance. You will still have access through your Private Proof.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={working} onClick={() => void decide("KEEP_PRIVATE")}>
                  {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                  Confirm Make Private
                </Button>
                <Button disabled={working} variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => setConfirmation(null)}>Cancel</Button>
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

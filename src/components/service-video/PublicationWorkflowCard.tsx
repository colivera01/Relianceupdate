"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Globe2, Loader2, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Role = "vendor" | "customer" | "employee";

type PublicationStage = {
  id: string;
  stage: "INTRO" | "IN_PROGRESS" | "COMPLETED";
  mediaAssetId: string;
  containsCustomerLikeness: boolean;
  containsEmployeeLikeness: boolean;
  includesAudio: boolean;
  presentationHash: string;
};

type PublicationView = {
  proposal: {
    id: string;
    status: string;
    version: number;
    proposalHash: string;
    contractVersion?: number;
    authorizationModel?: string;
  };
  stages: PublicationStage[];
  customerDecision?: { decision?: string; decisionJson?: string } | null;
  participantDecisions?: Array<{ stageId: string; authorityType: string; decision: string }>;
  vendorDecision?: { decision?: string } | null;
  adminDecision?: { decision?: string; reason?: string | null } | null;
};

const STAGES = [
  { stage: "INTRO", label: "Starting Condition" },
  { stage: "IN_PROGRESS", label: "Work in Progress" },
  { stage: "COMPLETED", label: "Final Result" },
] as const;

const STATUS_COPY: Record<string, { title: string; detail: string }> = {
  AWAITING_CUSTOMER_DECISION: {
    title: "Waiting for the customer's exact-media decision",
    detail: "The clips remain Private until the customer reviews the exact saved versions.",
  },
  AWAITING_PARTICIPANT_DECISIONS: {
    title: "Waiting for participant approval",
    detail: "A person whose likeness or audio appears must decide before the proposal can continue.",
  },
  AWAITING_VENDOR_APPROVAL: {
    title: "Ready for vendor representation approval",
    detail: "Confirm that these exact clips fairly represent the business before admin review.",
  },
  AWAITING_ADMIN_REVIEW: {
    title: "Waiting for Reliance moderation",
    detail: "The proposal is still Private while an admin reviews the complete evidence chain.",
  },
  PUBLIC: {
    title: "Selected clips are Public",
    detail: "Only the exact approved versions may be served publicly.",
  },
  DECLINED_PRIVATE: {
    title: "Kept Private",
    detail: "The customer declined Public sharing. The complete Private proof remains available.",
  },
  CORRECTION_REQUESTED: {
    title: "Correction requested",
    detail: "The proposal stays Private until a new corrected media version begins a new approval chain.",
  },
  ADMIN_REJECTED: {
    title: "Not approved for Public sharing",
    detail: "The admin decision keeps these clips Private.",
  },
  ADMIN_FLAGGED: {
    title: "Flagged for additional review",
    detail: "The proposal remains Private and cannot be served publicly.",
  },
  SUPERSEDED: {
    title: "Replaced by a newer proposal",
    detail: "This approval chain is no longer current and cannot authorize Public playback.",
  },
};

function stageLabel(stage: string) {
  return STAGES.find((row) => row.stage === stage)?.label || stage;
}

function parseCustomerDecisions(value?: string | null): Record<string, string> {
  try {
    const parsed = value ? JSON.parse(value) : null;
    return parsed?.stages && typeof parsed.stages === "object" ? parsed.stages : {};
  } catch {
    return {};
  }
}

export function PublicationWorkflowCard({
  role,
  bookingId,
  vendorId,
}: {
  role: Role;
  bookingId: string;
  vendorId?: string;
}) {
  const { user } = useAuth();
  const userId = typeof user?.id === "string" || typeof user?.id === "number" ? String(user.id) : "";
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const endpoint = role === "vendor"
    ? `/api/vendors/${encodeURIComponent(vendorId || "")}/jobs/${encodeURIComponent(bookingId)}/publication`
    : role === "customer"
      ? `/api/bookings/${encodeURIComponent(bookingId)}/publication`
      : `/api/employee/jobs/${encodeURIComponent(bookingId)}/publication`;
  const [publication, setPublication] = useState<PublicationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedStages, setSelectedStages] = useState<Record<string, boolean>>({ COMPLETED: true });
  const [stageRisks, setStageRisks] = useState<Record<string, { customer: boolean; employee: boolean; audio: boolean }>>({});
  const [customerSelections, setCustomerSelections] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!bookingId || (role === "vendor" && !vendorId)) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { headers, cache: "no-store", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "Unable to load Public sharing status");
      const next = (body?.publication || null) as PublicationView | null;
      setPublication(next);
      if (next?.stages?.length) {
        setCustomerSelections(Object.fromEntries(next.stages.map((stage) => [stage.id, true])));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load Public sharing status");
    } finally {
      setLoading(false);
    }
  }, [bookingId, endpoint, headers, role, vendorId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) throw new Error(result?.error || "The decision could not be saved");
      setMessage("Decision saved. The evidence chain has been updated.");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The decision could not be saved");
    } finally {
      setSubmitting(false);
    }
  }

  if (role !== "vendor" && !loading && !publication && !error) return null;

  const status = publication?.proposal?.status || "PRIVATE_ONLY";
  const immediatePublication =
    Number(publication?.proposal?.contractVersion || 0) >= 3 &&
    publication?.proposal?.authorizationModel ===
      "CUSTOMER_COMPLETE_PACKAGE_IMMEDIATE_PUBLICATION";
  const statusCopy = immediatePublication && status === "AWAITING_PARTICIPANT_DECISIONS"
    ? {
        title: "Waiting for Public-sharing permission",
        detail:
          "The complete Service Video remains Private until every required participant permission is complete.",
      }
    : immediatePublication && status === "PUBLIC"
      ? {
          title: "Complete Service Video is Public",
          detail:
            "The exact Reliance-audited three-stage package is publicly viewable.",
        }
      : STATUS_COPY[status];
  const customerDecisions = parseCustomerDecisions(publication?.customerDecision?.decisionJson);

  return (
    <Card className="border-slate-700 bg-slate-950 text-white shadow-sm" data-testid={`publication-${role}-card`}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            {status === "PUBLIC" ? <Globe2 className="h-5 w-5 text-emerald-300" /> : <LockKeyhole className="h-5 w-5 text-blue-300" />}
            Service Video visibility
          </CardTitle>
          <Badge className={status === "PUBLIC" ? "bg-emerald-600 text-white" : "bg-blue-950 text-blue-100"}>
            {status === "PUBLIC" ? "Public" : "Private"}
          </Badge>
        </div>
        <p className="text-sm text-slate-300">
          Public sharing is optional. The complete Reliance-audited Service Video remains the exact package of record.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-24 items-center gap-2 text-sm text-slate-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sharing status...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">
            <p>{error}</p>
            <Button size="sm" variant="outline" className="mt-3 border-red-300/50 bg-transparent text-white" onClick={() => void load()}>
              <RotateCcw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : null}
        {message ? <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm text-emerald-100">{message}</div> : null}

        {!loading && !publication && role === "vendor" && !error ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-400/25 bg-blue-950/30 p-3 text-sm text-blue-100">
              <p className="font-semibold">Choose only the clips you want the customer to consider for Public sharing.</p>
              <p className="mt-1 text-blue-100/75">Final Result is selected by default. Starting Condition and Work in Progress require separate approval.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {STAGES.map((item) => {
                const selected = selectedStages[item.stage] === true;
                const risk = stageRisks[item.stage] || { customer: false, employee: false, audio: false };
                return (
                  <div key={item.stage} className={`rounded-lg border p-3 ${selected ? "border-blue-400 bg-blue-950/35" : "border-slate-700 bg-slate-900"}`}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={selected} onChange={(event) => setSelectedStages((current) => ({ ...current, [item.stage]: event.target.checked }))} />
                      {item.label}
                    </label>
                    {selected ? (
                      <div className="mt-3 space-y-2 text-xs text-slate-300">
                        <label className="flex items-start gap-2"><input type="checkbox" checked={risk.customer} onChange={(event) => setStageRisks((current) => ({ ...current, [item.stage]: { ...risk, customer: event.target.checked } }))} /> Customer likeness appears</label>
                        <label className="flex items-start gap-2"><input type="checkbox" checked={risk.employee} onChange={(event) => setStageRisks((current) => ({ ...current, [item.stage]: { ...risk, employee: event.target.checked } }))} /> Employee likeness appears</label>
                        <label className="flex items-start gap-2"><input type="checkbox" checked={risk.audio} onChange={(event) => setStageRisks((current) => ({ ...current, [item.stage]: { ...risk, audio: event.target.checked } }))} /> Authorized audio is included</label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Button
              disabled={submitting || !Object.values(selectedStages).some(Boolean)}
              onClick={() => void submit("POST", {
                stages: STAGES.filter((item) => selectedStages[item.stage]).map((item) => ({
                  stage: item.stage,
                  label: item.label,
                  containsCustomerLikeness: stageRisks[item.stage]?.customer === true,
                  containsEmployeeLikeness: stageRisks[item.stage]?.employee === true,
                  includesAudio: stageRisks[item.stage]?.audio === true,
                })),
              })}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Ask customer to review exact clips
            </Button>
          </div>
        ) : null}

        {publication && statusCopy ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <p className="font-semibold text-white">{statusCopy.title}</p>
            <p className="mt-1 text-sm text-slate-300">{statusCopy.detail}</p>
          </div>
        ) : null}

        {publication?.stages?.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {publication.stages.map((stage) => (
              <div key={stage.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{stageLabel(stage.stage)}</p>
                  {customerDecisions[stage.id] ? <Badge variant="outline" className="border-slate-500 text-slate-200">{customerDecisions[stage.id]}</Badge> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-xs text-slate-400">
                  {stage.containsCustomerLikeness ? <span>Customer likeness</span> : null}
                  {stage.containsEmployeeLikeness ? <span>Employee likeness</span> : null}
                  {stage.includesAudio ? <span>Audio</span> : null}
                  {!stage.containsCustomerLikeness && !stage.containsEmployeeLikeness && !stage.includesAudio ? <span>Property-only clip</span> : null}
                </div>
                {role === "customer" && status === "AWAITING_CUSTOMER_DECISION" ? (
                  <>
                    <video className="mt-3 aspect-video w-full rounded bg-black object-contain" controls preload="metadata" src={`/api/bookings/${encodeURIComponent(bookingId)}/media/${encodeURIComponent(stage.mediaAssetId)}/download`} />
                    <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" checked={customerSelections[stage.id] !== false} onChange={(event) => setCustomerSelections((current) => ({ ...current, [stage.id]: event.target.checked }))} />
                      Approve this exact clip
                    </label>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {role === "customer" && publication && status === "AWAITING_CUSTOMER_DECISION" ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-blue-400/25 bg-blue-950/30 p-3 text-sm text-blue-100">
              <p className="font-semibold">You are deciding only whether these exact clips may be Public.</p>
              <p className="mt-1 text-blue-100/75">Choosing No does not affect your service, your Private proof, or your ability to leave a genuine review.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={submitting || !Object.values(customerSelections).some(Boolean)} onClick={() => void submit("PATCH", { stageDecisions: Object.fromEntries(publication.stages.map((stage) => [stage.id, customerSelections[stage.id] === false ? "DECLINED" : "APPROVED"])) })} className="bg-blue-600 text-white hover:bg-blue-700">
                Approve selected clips
              </Button>
              <Button disabled={submitting} variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => void submit("PATCH", { stageDecisions: Object.fromEntries(publication.stages.map((stage) => [stage.id, "DECLINED"])) })}>
                Keep all proof Private
              </Button>
              <Button disabled={submitting} variant="outline" className="border-amber-400/60 bg-transparent text-amber-100" onClick={() => void submit("PATCH", { requestCorrection: true, reason: "Customer requested a corrected or redacted version." })}>
                Request correction
              </Button>
            </div>
          </div>
        ) : null}

        {role === "employee" && publication && status === "AWAITING_PARTICIPANT_DECISIONS" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Decide only for your own likeness or audio. Declining keeps the affected clip Private.</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={submitting} onClick={() => void submit("PATCH", { decisions: publication.stages.flatMap((stage) => [
                ...(stage.containsEmployeeLikeness ? [{ stageId: stage.id, authorityType: "EMPLOYEE_LIKENESS", decision: "APPROVED" }] : []),
                ...(stage.includesAudio ? [{ stageId: stage.id, authorityType: "EMPLOYEE_AUDIO", decision: "APPROVED" }] : []),
              ]) })} className="bg-blue-600 text-white hover:bg-blue-700">Approve my appearance and audio</Button>
              <Button disabled={submitting} variant="outline" className="border-slate-500 bg-transparent text-white" onClick={() => void submit("PATCH", { decisions: publication.stages.flatMap((stage) => [
                ...(stage.containsEmployeeLikeness ? [{ stageId: stage.id, authorityType: "EMPLOYEE_LIKENESS", decision: "DECLINED" }] : []),
                ...(stage.includesAudio ? [{ stageId: stage.id, authorityType: "EMPLOYEE_AUDIO", decision: "DECLINED" }] : []),
              ]) })}>Decline Public use</Button>
            </div>
          </div>
        ) : null}

        {role === "vendor" && publication && status === "AWAITING_VENDOR_APPROVAL" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Confirm these exact approved clips fairly represent this completed service. This cannot broaden the customer's selection.</p>
            <Button disabled={submitting} onClick={() => void submit("PATCH", {})} className="bg-blue-600 text-white hover:bg-blue-700">
              <ShieldCheck className="mr-2 h-4 w-4" /> Approve business representation
            </Button>
          </div>
        ) : null}

        {status === "PUBLIC" ? (
          <div className="flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Canonical Public visibility evidence is active.</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

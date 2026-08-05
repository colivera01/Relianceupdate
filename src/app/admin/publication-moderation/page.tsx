"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Flag, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type QueueItem = {
  proposal: { id: string; bookingId: string; vendorId: string; version: number; proposalHash: string; packageHash: string; status: string };
  stages: Array<{
    id: string;
    stage: string;
    mediaAssetId: string;
    contentHash: string;
    presentationHash: string;
    containsCustomerLikeness: boolean;
    containsEmployeeLikeness: boolean;
    includesAudio: boolean;
  }>;
  customerDecision?: { decision?: string } | null;
  participantDecisions?: Array<{ stageId: string; authorityType: string; decision: string }>;
  vendorDecision?: { decision?: string } | null;
  booking?: { title?: string | null; clientName?: string | null; vendor?: { businessName?: string | null; name?: string | null }; service?: { name?: string | null } } | null;
};

function stageLabel(stage: string) {
  if (stage === "INTRO") return "Starting Condition";
  if (stage === "IN_PROGRESS") return "Work in Progress";
  if (stage === "COMPLETED") return "Final Result";
  return stage;
}

export default function AdminPublicationModerationPage() {
  const { user } = useAuth();
  const userId = typeof user?.id === "string" || typeof user?.id === "number" ? String(user.id) : "";
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/publication-proposals", { headers, credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "Unable to load Public proof review");
      setItems(Array.isArray(body?.proposals) ? body.proposals : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load Public proof review");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  async function decide(item: QueueItem, decision: "APPROVED" | "REJECTED" | "FLAGGED" | "CORRECTION_REQUESTED") {
    const reason = String(reasons[item.proposal.id] || "").trim();
    if (decision !== "APPROVED" && !reason) {
      setError("Add a clear reason before rejecting, flagging, or requesting correction.");
      return;
    }
    setWorkingId(item.proposal.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/publication-proposals/${encodeURIComponent(item.proposal.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ decision, reason: reason || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "Unable to save moderation decision");
      setMessage(decision === "APPROVED" ? "Exact clips approved for Public proof." : "Decision saved. The media remains Private.");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save moderation decision");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="space-y-6 text-white" data-testid="admin-publication-moderation">
      <header className="reliance-operator-surface rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-200">Admin evidence review</p>
            <h1 className="mt-2 text-2xl font-bold">Public Service Video Review</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Confirm the exact media version and every required participant decision before Public visibility. Admin review may restrict a proposal, never broaden it.
            </p>
          </div>
          <Button variant="outline" className="border-white/20 bg-transparent text-white" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-lg border border-red-400/40 bg-red-950/45 p-4 text-sm text-red-100">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/45 p-4 text-sm text-emerald-100">{message}</div> : null}
      {loading ? <div className="flex min-h-36 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white/70"><Loader2 className="h-4 w-4 animate-spin" /> Loading publication evidence...</div> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-300" />
          <h2 className="mt-3 font-semibold">No Public proposals need review</h2>
          <p className="mt-1 text-sm text-white/65">Private Service Videos remain available to their authorized customers.</p>
        </div>
      ) : null}

      <div className="space-y-5">
        {items.map((item) => {
          const busy = workingId === item.proposal.id;
          const vendorName = item.booking?.vendor?.businessName || item.booking?.vendor?.name || "Vendor";
          return (
            <section key={item.proposal.id} className="reliance-operator-surface rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{item.booking?.service?.name || item.booking?.title || "Completed service"}</h2>
                  <p className="text-sm text-white/65">{vendorName} | Customer: {item.booking?.clientName || "Customer"}</p>
                </div>
                <Badge className="bg-amber-500/20 text-amber-100">Awaiting admin review</Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {item.stages.map((stage) => (
                  <article key={stage.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{stageLabel(stage.stage)}</p>
                      <Eye className="h-4 w-4 text-blue-200" />
                    </div>
                    <video className="mt-3 aspect-video w-full rounded bg-black object-contain" controls preload="metadata" src={`/api/admin/media/${encodeURIComponent(stage.mediaAssetId)}/download`} />
                    <div className="mt-3 space-y-1 text-xs text-white/65">
                      <p>Media hash: <span className="font-mono">{stage.contentHash.slice(0, 12)}...</span></p>
                      <p>Presentation hash: <span className="font-mono">{stage.presentationHash.slice(0, 12)}...</span></p>
                      <p>{stage.containsCustomerLikeness ? "Customer likeness declared" : "No customer likeness declared"}</p>
                      <p>{stage.containsEmployeeLikeness ? "Employee likeness declared" : "No employee likeness declared"}</p>
                      <p>{stage.includesAudio ? "Audio declared" : "Audio off"}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-4 grid gap-2 rounded-lg border border-emerald-400/20 bg-emerald-950/25 p-3 text-sm sm:grid-cols-3">
                <p><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-300" /> Customer: {item.customerDecision?.decision || "Missing"}</p>
                <p><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-300" /> Participant decisions: {item.participantDecisions?.length || 0}</p>
                <p><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-300" /> Vendor: {item.vendorDecision?.decision || "Missing"}</p>
              </div>

              <label className="mt-4 block text-sm font-medium text-white/80">
                Moderation reason (required for any restrictive decision)
                <textarea
                  value={reasons[item.proposal.id] || ""}
                  onChange={(event) => setReasons((current) => ({ ...current, [item.proposal.id]: event.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white placeholder:text-white/35"
                  placeholder="Explain the privacy, evidence, or presentation concern."
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void decide(item, "APPROVED")} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve exact clips
                </Button>
                <Button disabled={busy} variant="outline" className="border-amber-400/50 bg-transparent text-amber-100" onClick={() => void decide(item, "CORRECTION_REQUESTED")}>
                  <AlertTriangle className="mr-2 h-4 w-4" /> Request correction
                </Button>
                <Button disabled={busy} variant="outline" className="border-orange-400/50 bg-transparent text-orange-100" onClick={() => void decide(item, "FLAGGED")}>
                  <Flag className="mr-2 h-4 w-4" /> Flag
                </Button>
                <Button disabled={busy} variant="outline" className="border-red-400/50 bg-transparent text-red-100" onClick={() => void decide(item, "REJECTED")}>
                  <XCircle className="mr-2 h-4 w-4" /> Reject Public use
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

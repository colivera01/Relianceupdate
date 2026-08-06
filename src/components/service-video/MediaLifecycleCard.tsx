"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Loader2, RefreshCw, ShieldAlert, ShieldCheck, StopCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Role = "customer" | "vendor" | "employee";
type LifecycleResponse = {
  role: string;
  lifecycle: Array<{ mediaAssetId: string; outcome: string; deletionStatus?: string | null; caseStatus?: string | null; holdStatus?: string | null; nextAction?: string | null }>;
  cases: Array<{ id: string; category: string; status: string; decision?: string | null; decisionReason?: string | null }>;
  withdrawals: Array<{ id: string; scope: string; status: string; appliedAt: string }>;
  deletions: Array<{ id: string; mediaAssetId: string; status: string; requestedAt: string }>;
  holds: Array<{ id: string; status: string; reviewDueAt: string }>;
  appeals: Array<{ id: string; caseId: string; status: string; decision?: string | null }>;
  allowedActions: Record<string, boolean>;
};

const DISPUTE_OPTIONS = [
  ["PRIVACY", "Privacy or unintended capture"],
  ["IDENTITY", "Wrong person or identity"],
  ["AUTHORITY", "Permission or authority concern"],
  ["SAFETY", "Safety concern"],
  ["MATERIAL_MISREPRESENTATION", "Media does not truthfully represent the work"],
  ["SERVICE_QUALITY", "Service quality concern"],
] as const;

function statusCopy(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED") return "Deleted after stored-file absence was verified";
  if (normalized === "RETRY_REQUIRED") return "Deletion retry required";
  if (normalized === "ATTEMPTING" || normalized === "VERIFYING") return "Deletion is being verified";
  if (normalized === "QUEUED") return "Deletion queued, not yet deleted";
  if (normalized === "HELD") return "Restricted and held as evidence";
  if (normalized === "ACCESS_RESTRICTED" || normalized === "REQUESTED") return "Deletion requested, not yet deleted";
  if (normalized === "DENIED") return "Deletion request denied with a recorded reason";
  return normalized.replaceAll("_", " ");
}

export function MediaLifecycleCard({ role, bookingId }: { role: Role; bookingId: string }) {
  const { user } = useAuth();
  const userId = typeof user?.id === "string" || typeof user?.id === "number" ? String(user.id) : "";
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const endpoint = `/api/bookings/${encodeURIComponent(bookingId)}/lifecycle`;
  const [data, setData] = useState<LifecycleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("PRIVACY");
  const [detail, setDetail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { credentials: "include", cache: "no-store", headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "Unable to load privacy and retention status");
      setData(body as LifecycleResponse);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load privacy and retention status");
    } finally {
      setLoading(false);
    }
  }, [endpoint, headers]);

  useEffect(() => { void load(); }, [load]);

  async function act(action: string, values: Record<string, unknown> = {}) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ action, ...values }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "The lifecycle action could not be saved");
      setMessage(body.message || "Your decision was saved.");
      setDetail("");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The lifecycle action could not be saved");
    } finally {
      setWorking(false);
    }
  }

  const restricted = data?.lifecycle?.some((item) => ["RESTRICTED", "HELD", "DELETED"].includes(item.outcome));
  return (
    <Card className="border-slate-700 bg-slate-950 text-white shadow-sm" data-testid={`media-lifecycle-${role}`}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-white"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Privacy, concerns, and retention</CardTitle>
          <Badge className={restricted ? "bg-amber-500/20 text-amber-100" : "bg-emerald-600/20 text-emerald-100"}>{restricted ? "Access narrowed" : "No active restriction"}</Badge>
        </div>
        <p className="text-sm text-slate-300">Public removal, future recording, and physical deletion are separate actions. Private proof remains a complete outcome.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="flex min-h-20 items-center gap-2 text-sm text-slate-300" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading lifecycle status...</div> : null}
        {error ? <div role="alert" className="rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100"><p>{error}</p><Button size="sm" variant="outline" className="mt-3 border-red-300/50 bg-transparent text-white" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button></div> : null}
        {message ? <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm text-emerald-100">{message}</div> : null}

        {!loading && data ? (
          <>
            {(data.withdrawals.length || data.cases.length || data.deletions.length || data.holds.length) ? (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                {data.withdrawals.map((item) => <p key={item.id} className="text-sm text-slate-200"><StopCircle className="mr-2 inline h-4 w-4 text-amber-300" /> {item.scope.replaceAll("_", " ")} withdrawal is {item.status.toLowerCase()}.</p>)}
                {data.cases.map((item) => <p key={item.id} className="text-sm text-slate-200"><ShieldAlert className="mr-2 inline h-4 w-4 text-blue-300" /> {item.category.replaceAll("_", " ")} concern: {item.status.replaceAll("_", " ").toLowerCase()}.</p>)}
                {data.deletions.map((item) => <p key={item.id} className="text-sm text-slate-200"><Archive className="mr-2 inline h-4 w-4 text-violet-300" /> {statusCopy(item.status)}</p>)}
                {data.holds.filter((item) => item.status !== "RELEASED").map((item) => <p key={item.id} className="text-sm text-slate-200"><AlertTriangle className="mr-2 inline h-4 w-4 text-amber-300" /> Evidence hold: {item.status.toLowerCase()}. Admin review due {new Date(item.reviewDueAt).toLocaleDateString()}.</p>)}
              </div>
            ) : <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">No withdrawal, dispute, hold, or deletion request is active.</div>}

            <div className="grid gap-3 md:grid-cols-2">
              {data.allowedActions?.withdrawPublication ? <Button disabled={working} variant="outline" className="border-amber-400/40 bg-transparent text-amber-100" onClick={() => void act(role === "employee" ? "WITHDRAW_LIKENESS" : "WITHDRAW_PUBLICATION", { reason: "Participant withdrew future Public use." })}><StopCircle className="mr-2 h-4 w-4" /> {role === "employee" ? "Remove my likeness from Public use" : "Remove from Public view"}</Button> : null}
              {data.allowedActions?.withdrawRecording ? <Button disabled={working} variant="outline" className="border-amber-400/40 bg-transparent text-amber-100" onClick={() => void act("WITHDRAW_RECORDING", { reason: "Participant stopped future recording." })}><StopCircle className="mr-2 h-4 w-4" /> Stop future recording</Button> : null}
            </div>

            <div className="rounded-lg border border-blue-400/25 bg-blue-950/25 p-3">
              <p className="font-semibold text-blue-100">Report a concern</p>
              <p className="mt-1 text-sm text-blue-100/75">Privacy and authority concerns restrict affected Public access before review. A service-quality concern does not erase truthful Private evidence.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr]">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-white/15 bg-slate-900 p-2 text-sm text-white">{DISPUTE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={2} className="rounded-lg border border-white/15 bg-slate-900 p-2 text-sm text-white placeholder:text-slate-500" placeholder="Briefly explain what happened." />
              </div>
              <Button disabled={working || !detail.trim()} className="mt-3 bg-blue-600 text-white hover:bg-blue-700" onClick={() => void act("OPEN_DISPUTE", { category, reasonDetail: detail })}>Submit concern</Button>
            </div>

            {data.allowedActions?.requestDeletion && data.lifecycle.length ? (
              <div className="rounded-lg border border-violet-400/25 bg-violet-950/20 p-3">
                <p className="font-semibold text-violet-100">Request stored-media deletion</p>
                <p className="mt-1 text-sm text-violet-100/75">A request restricts access first. It is not deleted until retention and holds are reviewed and storage absence is verified.</p>
                <Button disabled={working} variant="outline" className="mt-3 border-violet-300/40 bg-transparent text-violet-100" onClick={() => void act("REQUEST_DELETION", { mediaAssetId: data.lifecycle[0].mediaAssetId, reason: "Participant requested deletion of this saved media." })}><Archive className="mr-2 h-4 w-4" /> Request deletion of first stage</Button>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

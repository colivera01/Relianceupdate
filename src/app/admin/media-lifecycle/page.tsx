"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Gavel, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { getAdminRequestHeaders } from "@/lib/admin-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Queue = {
  cases: Array<any>;
  deletions: Array<any>;
  holds: Array<any>;
  appeals: Array<any>;
  failedJobs: Array<any>;
};

export default function AdminMediaLifecyclePage() {
  const { user } = useAuth();
  const userId = typeof user?.id === "string" || typeof user?.id === "number" ? String(user.id) : "";
  const headers = useMemo(() => getAdminRequestHeaders(), [userId]);
  const [queue, setQueue] = useState<Queue>({ cases: [], deletions: [], holds: [], appeals: [], failedJobs: [] });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/media-lifecycle", { credentials: "include", cache: "no-store", headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.error || "Unable to load media lifecycle queue");
      setQueue({ cases: body.cases || [], deletions: body.deletions || [], holds: body.holds || [], appeals: body.appeals || [], failedJobs: body.failedJobs || [] });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load media lifecycle queue");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  async function act(key: string, body: Record<string, unknown>) {
    setWorking(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/media-lifecycle", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) throw new Error(result?.error || "Unable to save lifecycle decision");
      setMessage(result.message || "Decision saved.");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save lifecycle decision");
    } finally {
      setWorking("");
    }
  }

  const total = queue.cases.length + queue.deletions.length + queue.holds.length + queue.appeals.length + queue.failedJobs.length;
  return (
    <div className="space-y-6 text-white" data-testid="admin-media-lifecycle">
      <header className="reliance-operator-surface rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-200">Evidence-bound operations</p>
            <h1 className="mt-2 text-2xl font-bold">Media Lifecycle</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">Review scoped withdrawals, disputes, holds, appeals, and deletion work. Public exposure never increases automatically, and deletion is complete only after verified blob absence.</p>
          </div>
          <Button variant="outline" className="border-white/20 bg-transparent text-white" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
      </header>
      {error ? <div role="alert" className="rounded-lg border border-red-400/40 bg-red-950/45 p-4 text-sm text-red-100">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/45 p-4 text-sm text-emerald-100">{message}</div> : null}
      {loading ? <div className="flex min-h-36 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white/70"><Loader2 className="h-4 w-4 animate-spin" /> Loading lifecycle evidence...</div> : null}
      {!loading && total === 0 ? <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center"><Archive className="mx-auto h-8 w-8 text-emerald-300" /><h2 className="mt-3 font-semibold">No lifecycle action needs attention</h2><p className="mt-1 text-sm text-white/65">Public and Private access continue only under their existing evidence chains.</p></div> : null}

      <div className="space-y-5">
        {queue.cases.map((item) => <section key={item.id} className="reliance-operator-surface rounded-lg p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{String(item.category).replaceAll("_", " ")} concern</h2><p className="text-sm text-white/65">Work record {item.bookingId}</p></div><Badge className="bg-amber-500/20 text-amber-100">{String(item.status).replaceAll("_", " ")}</Badge></div><p className="mt-3 text-sm text-white/75">{item.reasonDetail || "No additional detail supplied."}</p><textarea className="mt-3 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white" rows={2} placeholder="Neutral evidence-based decision reason" value={reasons[item.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} /><div className="mt-3 flex flex-wrap gap-2"><Button disabled={working === item.id || !(reasons[item.id] || "").trim()} onClick={() => void act(item.id, { action: "DECIDE_CASE", caseId: item.id, decision: "RESTRICT", reason: reasons[item.id], final: false })} className="bg-blue-600 text-white"><Gavel className="mr-2 h-4 w-4" /> Record decision</Button></div></section>)}

        {queue.deletions.map((item) => <section key={item.id} className="reliance-operator-surface rounded-lg p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">Deletion review</h2><p className="text-sm text-white/65">Media {item.mediaAssetId}</p></div><Badge className="bg-violet-500/20 text-violet-100">{String(item.status).replaceAll("_", " ")}</Badge></div><div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-950/20 p-3 text-sm text-amber-100"><AlertTriangle className="mr-2 inline h-4 w-4" /> This is not deleted until storage absence is verified.</div><textarea className="mt-3 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white" rows={2} placeholder="Retention or denial reason" value={reasons[item.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} /><div className="mt-3 flex flex-wrap gap-2"><Button disabled={working === item.id || !(reasons[item.id] || "").trim()} onClick={() => void act(item.id, { action: "DECIDE_DELETION", deletionRequestId: item.id, decision: "APPROVE", reason: reasons[item.id] })} className="bg-violet-600 text-white">Queue verified deletion</Button><Button disabled={working === item.id || !(reasons[item.id] || "").trim()} variant="outline" className="border-red-400/50 bg-transparent text-red-100" onClick={() => void act(item.id, { action: "DECIDE_DELETION", deletionRequestId: item.id, decision: "DENY", reason: reasons[item.id] })}>Deny with reason</Button></div></section>)}

        {queue.appeals.map((item) => <section key={item.id} className="reliance-operator-surface rounded-lg p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">Appeal review</h2><p className="text-sm text-white/65">Case {item.caseId}</p></div><Badge className="bg-blue-500/20 text-blue-100">Separate reviewer required</Badge></div><p className="mt-3 text-sm text-white/75">{item.reason}</p><textarea className="mt-3 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white" rows={2} placeholder="Appeal decision reason" value={reasons[item.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} /><Button disabled={working === item.id || !(reasons[item.id] || "").trim()} className="mt-3 bg-blue-600 text-white" onClick={() => void act(item.id, { action: "DECIDE_APPEAL", appealId: item.id, decision: "UPHOLD", reason: reasons[item.id] })}><ShieldAlert className="mr-2 h-4 w-4" /> Decide appeal</Button></section>)}

        {queue.failedJobs.map((item) => <section key={item.id} className="rounded-lg border border-red-400/35 bg-red-950/30 p-5"><h2 className="font-bold text-red-100">Deletion needs attention</h2><p className="mt-1 text-sm text-red-100/75">{item.status === "RETRY_REQUIRED" ? "Retry required. Stored-file absence has not been verified." : "Deletion failed. The media remains restricted and is not marked deleted."}</p><Button disabled={working === item.id} variant="outline" className="mt-3 border-red-300/50 bg-transparent text-white" onClick={() => void act(item.id, { action: "RETRY_DELETION", jobId: item.id })}><RefreshCw className="mr-2 h-4 w-4" /> Queue retry</Button></section>)}
      </div>
    </div>
  );
}

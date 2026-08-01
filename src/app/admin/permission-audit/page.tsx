"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, Search, ShieldCheck, TriangleAlert } from "lucide-react";

import { getAdminRequestHeaders } from "@/lib/admin-client";

type PermissionRow = {
  id: string;
  bookingId: string;
  lifecycleStatus: string;
  verifiedDecision: boolean;
  legacyEvidence: boolean;
  recipientName: string | null;
  recipientEmailMasked: string | null;
  recipientPhoneMasked: string | null;
  recipientMismatch: boolean;
  requestedAt: string;
  vendor: { name: string | null; businessName: string | null };
  booking: { title: string | null; service: { name: string } | null };
};

const STATES = ["", "PENDING", "DELIVERED", "DELIVERY_FAILED", "ALLOWED", "DECLINED", "WRONG_RECIPIENT", "EXPIRED"];

function label(value: string) {
  return String(value || "Unknown").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PermissionAuditPage() {
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (state) params.set("state", state);
      const response = await fetch(`/api/admin/permissions?${params}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Unable to load permission records");
      setRows(Array.isArray(body.permissions) ? body.permissions : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load permission records");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query, state]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const response = await fetch(`/api/admin/permissions/${encodeURIComponent(id)}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Unable to load permission evidence");
      setDetail(body.permission);
    } catch (loadError) {
      setDetail({ error: loadError instanceof Error ? loadError.message : "Unable to load permission evidence" });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  return (
    <div className="space-y-5 pb-10 text-white">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-200">Read-only evidence</p>
          <h1 className="mt-2 text-3xl font-bold">Recording Permission Audit</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/65">
            Review identity verification, authority claims, delivery attempts, and final decisions. Admins cannot override a customer decision here.
          </p>
        </div>
        <button type="button" onClick={() => void loadRows()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-semibold hover:bg-white/10">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); void loadRows(); }} className="grid gap-3 border-b border-white/10 pb-5 md:grid-cols-[1fr_240px_auto]">
        <label className="relative">
          <span className="sr-only">Search permission records</span>
          <Search className="absolute left-3 top-3 h-4 w-4 text-white/45" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, work record, or recipient" className="h-10 w-full rounded-lg border border-white/15 bg-black/20 pl-10 pr-3 text-sm text-white placeholder:text-white/35" />
        </label>
        <select value={state} onChange={(event) => setState(event.target.value)} className="h-10 rounded-lg border border-white/15 bg-[#0b1424] px-3 text-sm text-white">
          {STATES.map((item) => <option key={item || "all"} value={item}>{item ? label(item) : "All states"}</option>)}
        </select>
        <button className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold hover:bg-blue-500">Apply</button>
      </form>

      {error ? <div className="flex items-center gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"><TriangleAlert className="h-5 w-5" />{error}</div> : null}

      <div className="grid min-h-[520px] gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <section aria-label="Permission records" className="divide-y divide-white/8 border-y border-white/10">
          {loading ? <p className="py-12 text-center text-sm text-white/55">Loading permission records...</p> : null}
          {!loading && rows.length === 0 ? <p className="py-12 text-center text-sm text-white/55">No permission records match these filters.</p> : null}
          {rows.map((row) => (
            <button key={row.id} type="button" onClick={() => void loadDetail(row.id)} className={`w-full px-3 py-4 text-left transition hover:bg-white/5 ${selectedId === row.id ? "bg-blue-500/10" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.booking.title || row.booking.service?.name || "Work record"}</p>
                  <p className="mt-1 text-sm text-white/60">{row.vendor.businessName || row.vendor.name || "Vendor"}</p>
                  <p className="mt-2 text-xs text-white/45">{row.recipientName || "Recipient"} · {row.recipientEmailMasked || row.recipientPhoneMasked || "No digital channel"}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${row.lifecycleStatus === "ALLOWED" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : row.lifecycleStatus === "DELIVERY_FAILED" || row.recipientMismatch ? "border-amber-300/30 bg-amber-400/10 text-amber-100" : "border-blue-300/25 bg-blue-400/10 text-blue-100"}`}>{label(row.lifecycleStatus)}</span>
              </div>
            </button>
          ))}
        </section>

        <aside className="border-l border-white/10 pl-5">
          {!selectedId ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-white/50"><ShieldCheck className="mb-3 h-9 w-9" /><p className="font-semibold text-white/75">Select a request</p><p className="mt-1 max-w-xs text-sm">Its verified evidence and delivery history will appear here.</p></div> : null}
          {detailLoading ? <p className="py-12 text-center text-sm text-white/55">Loading evidence...</p> : null}
          {detail?.error ? <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{detail.error}</div> : null}
          {detail && !detail.error ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase text-white/45">Selected work record</p>
                <h2 className="mt-1 text-xl font-bold">{selected?.booking.title || selected?.booking.service?.name || "Work record"}</h2>
                <p className="mt-1 break-all text-xs text-white/40">{detail.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm">
                <div><p className="text-white/45">Decision</p><p className="mt-1 font-semibold">{detail.decisionEvidence?.decision ? label(detail.decisionEvidence.decision) : "No decision"}</p></div>
                <div><p className="text-white/45">Verified</p><p className="mt-1 font-semibold">{detail.verifiedDecision ? "Yes" : "No"}</p></div>
                <div><p className="text-white/45">Method</p><p className="mt-1 font-semibold">{label(detail.decisionEvidence?.verificationMethod || "Not verified")}</p></div>
                <div><p className="text-white/45">Audio</p><p className="mt-1 font-semibold">{detail.audioEnabled ? "On" : "Off"}</p></div>
              </div>
              <div>
                <h3 className="font-semibold">Evidence timeline</h3>
                <div className="mt-3 space-y-3">
                  {detail.events?.map((event: any) => <div key={event.id} className="flex gap-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><div><p className="font-medium">{label(event.eventType)}</p><p className="text-xs text-white/45">{new Date(event.createdAt).toLocaleString()}</p></div></div>)}
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Delivery attempts</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {detail.notificationAttempts?.length ? detail.notificationAttempts.map((attempt: any) => <div key={attempt.id} className="flex items-center justify-between border-b border-white/8 py-2"><span>{label(attempt.channel)} · {attempt.destinationMasked || "Masked"}</span><span className="text-white/55">{label(attempt.status)}</span></div>) : <p className="text-white/45">No delivery attempts recorded.</p>}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

import { RoleAssentDocumentViewer } from "@/components/legal/RoleAssentDocumentViewer";
import { getClientSessionHeaders } from "@/lib/client-session";

type AssentView = {
  identity: { vendorId: string; vendorName: string; actorRole: string; membershipId: string };
  status: { current: boolean; decision: "ASSENT" | "DECLINE" | null; decidedAt: string | null };
  presentation: {
    packageKey: string;
    contentSetHash: string;
    content: Array<{
      contentKey: string;
      version: string;
      contentHash: string;
      contentSnapshot: string;
      audienceRole: string;
    }>;
  };
};

const EMPTY_ACKNOWLEDGEMENTS = {
  authority: false,
  terms: false,
  privacy: false,
  electronicRecords: false,
};

export function VendorRoleAssentGate(props: {
  userId: string;
  vendorId: string;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<AssentView | null>(null);
  const [bypass, setBypass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [acknowledgements, setAcknowledgements] = useState(EMPTY_ACKNOWLEDGEMENTS);
  const headers = useMemo(() => getClientSessionHeaders(props.userId), [props.userId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const contextResponse = await fetch(
        `/api/vendor/context?vendorId=${encodeURIComponent(props.vendorId)}`,
        { headers, cache: "no-store" },
      );
      const context = await contextResponse.json().catch(() => ({}));
      if (!contextResponse.ok) throw new Error(context?.message || "Vendor context could not be verified.");
      if (String(context?.role || "").toUpperCase() !== "MANAGER") {
        setBypass(true);
        return;
      }
      const response = await fetch(
        `/api/vendor/legal-assent?vendorId=${encodeURIComponent(props.vendorId)}`,
        { headers, cache: "no-store" },
      );
      const body = await response.json().catch(() => ({}));
      if (response.status === 404 && body?.code === "ROLE_ASSENT_NOT_ENABLED") {
        setBypass(true);
        return;
      }
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Vendor assent could not be loaded.");
      }
      setView(body as AssentView);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Vendor assent could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [props.userId, props.vendorId]);

  async function submit(decision: "ASSENT" | "DECLINE") {
    if (!view) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(
        `/api/vendor/legal-assent?vendorId=${encodeURIComponent(props.vendorId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            decision,
            acknowledgements,
            contentSetHash: view.presentation.contentSetHash,
            requestId: crypto.randomUUID(),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Vendor assent could not be saved.");
      }
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Vendor assent could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  if (bypass || view?.status.current) return <>{props.children}</>;
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-white/80">
        <Loader2 className="h-4 w-4 animate-spin" /> Verifying Vendor assent...
      </div>
    );
  }
  if (!view) {
    return (
      <section className="border-y border-rose-300/40 py-8 text-white">
        <h1 className="text-xl font-semibold">Vendor assent could not be verified</h1>
        <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p>
        <button type="button" className="mt-4 text-sm font-semibold text-blue-200" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  const allChecked = Object.values(acknowledgements).every(Boolean);
  return (
    <section className="bg-white p-6 text-slate-950 shadow-xl sm:p-8" aria-labelledby="vendor-assent-title">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Vendor organization agreement</p>
          <h1 id="vendor-assent-title" className="mt-1 text-2xl font-bold">Review and agree for {view.identity.vendorName}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This agreement is for the identified Vendor. It cannot make any Customer or Employee decision.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <RoleAssentDocumentViewer content={view.presentation.content} packageKey={view.presentation.packageKey} />
      </div>

      <fieldset className="mt-6 space-y-3 border-t border-slate-200 pt-5">
        <legend className="font-semibold">Required acknowledgments</legend>
        {[
          ["authority", "I am authorized to bind the identified Vendor and am acting for that organization."],
          ["terms", "I agree to the exact Reliance Terms of Use version shown."],
          ["privacy", "I acknowledge that I reviewed the exact Reliance Privacy Notice version shown."],
          ["electronicRecords", "I consent to receive and retain these terms, notices, receipts, and related records electronically."],
        ].map(([key, label]) => (
          <label key={key} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={acknowledgements[key as keyof typeof acknowledgements]}
              onChange={(event) =>
                setAcknowledgements((current) => ({ ...current, [key]: event.target.checked }))
              }
              className="mt-1 h-4 w-4"
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!allChecked || working}
          onClick={() => void submit("ASSENT")}
          className="inline-flex items-center gap-2 bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Agree for Vendor
        </button>
        <button
          type="button"
          disabled={working}
          onClick={() => void submit("DECLINE")}
          className="inline-flex items-center gap-2 border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800"
        >
          <XCircle className="h-4 w-4" /> I do not agree
        </button>
      </div>
      {view.status.decision === "DECLINE" ? (
        <p className="mt-4 text-sm font-medium text-amber-800">
          Vendor assent was declined. Features that require it remain unavailable. Contact Reliance Support for help.
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}

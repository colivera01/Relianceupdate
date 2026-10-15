"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, HelpCircle, Loader2, LogOut, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";

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
    vendorAcknowledgements: Array<{
      key: "authority" | "terms" | "privacy" | "electronicRecords";
      label: string;
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
  allowChildrenWhileLocked?: boolean;
  onAccessStateChange?: (locked: boolean) => void;
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

  const unlocked = bypass || Boolean(view?.status.current);
  useEffect(() => {
    props.onAccessStateChange?.(!unlocked);
  }, [props.onAccessStateChange, unlocked]);

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

  if (unlocked || (props.allowChildrenWhileLocked && !loading)) {
    return <>{props.children}</>;
  }
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
        {view.presentation.vendorAcknowledgements.map(({ key, label }) => {
          const checked = acknowledgements[key];
          return (
            <label key={key} className="flex cursor-pointer items-start gap-3 border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 focus-within:border-blue-600">
              <input
                id={`vendor-gate-${key}`}
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  setAcknowledgements((current) => ({ ...current, [key]: event.target.checked }))
                }
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-slate-500 bg-white transition peer-checked:border-blue-800 peer-checked:bg-blue-700 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2"
              >
                {checked ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
              </span>
              <span>{label}</span>
            </label>
          );
        })}
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
      <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-200 pt-5 text-sm font-semibold">
        <Link href="/vendor/support" className="inline-flex items-center gap-2 text-blue-800 underline">
          <HelpCircle className="h-4 w-4" aria-hidden="true" /> Support &amp; Help
        </Link>
        <Link href="/logout" className="inline-flex items-center gap-2 text-slate-700 underline">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Log Out
        </Link>
      </div>
    </section>
  );
}

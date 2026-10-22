"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { resolveVendorServiceOrderPresentation } from "@/lib/vendor-service-order-presentation";

type View = {
  status: { current: boolean; decidedAt: string | null };
  contextHash: string;
  contentSetHash: string;
  presentation: {
    title: string;
    attestationText: string;
    confirmationText: string;
    disclaimerText: string;
    actionLabel: string;
  };
  context: {
    assignmentGeneration: number;
    assignedMembershipIds: string[];
    assessmentGeneration: number;
    scopeHash: string;
  };
};

export function ManagerWorkRecordAttestation(props: {
  vendorId: string;
  bookingId: string;
  headers: Record<string, string>;
  serviceOrderCurrent: boolean;
}) {
  const [view, setView] = useState<View | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const serviceOrderPresentation = resolveVendorServiceOrderPresentation({
    serviceOrderCurrent: props.serviceOrderCurrent,
    serviceOrderAnyReleased: props.serviceOrderCurrent,
    managerAttestationCurrent: view?.status.current === true,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/vendors/${encodeURIComponent(props.vendorId)}/jobs/${encodeURIComponent(props.bookingId)}/manager-attestation`,
        { headers: props.headers, cache: "no-store" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Manager attestation could not be loaded.");
      }
      setView(body as View);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Manager attestation could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [props.bookingId, props.vendorId]);

  async function submit() {
    if (!view || !confirmed) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(
        `/api/vendors/${encodeURIComponent(props.vendorId)}/jobs/${encodeURIComponent(props.bookingId)}/manager-attestation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...props.headers },
          body: JSON.stringify({
            authorityConfirmed: true,
            contextHash: view.contextHash,
            contentSetHash: view.contentSetHash,
            requestId: crypto.randomUUID(),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Manager attestation could not be saved.");
      }
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Manager attestation could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Checking Manager attestation...</p>;
  }
  if (!view) {
    if (props.serviceOrderCurrent) {
      return (
        <div className="flex items-start gap-3 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{serviceOrderPresentation.attestationTitle}</p>
            <p className="mt-1 text-sm">{serviceOrderPresentation.attestationDetail}</p>
          </div>
        </div>
      );
    }
    return <p role="alert" className="text-sm text-rose-700">{error}</p>;
  }
  if (view.status.current) {
    return (
      <div className="flex items-start gap-3 text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Current Manager Work Record attestation confirmed</p>
          <p className="mt-1 text-sm">The attestation is bound to assignment generation {view.context.assignmentGeneration}, assessment generation {view.context.assessmentGeneration}, and the current recording scope.</p>
        </div>
      </div>
    );
  }
  if (serviceOrderPresentation.attestationMode === "GRANDFATHERED_CURRENT_RELEASE") {
    return (
      <div className="flex items-start gap-3 text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{serviceOrderPresentation.attestationTitle}</p>
          <p className="mt-1 text-sm">{serviceOrderPresentation.attestationDetail}</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-start gap-3">
        <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <p className="font-semibold text-slate-950">{view.presentation.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{view.presentation.attestationText}</p>
          <p className="mt-2 text-xs text-slate-500">{view.presentation.disclaimerText}</p>
        </div>
      </div>
      <label
        htmlFor="manager-work-record-attestation-confirmation"
        className={`mt-4 flex cursor-pointer items-start gap-3 border p-3 text-sm leading-6 text-slate-700 transition focus-within:border-blue-700 ${
          confirmed ? "border-blue-700 bg-blue-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <input
          id="manager-work-record-attestation-confirmation"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-slate-500 bg-white transition peer-checked:border-blue-800 peer-checked:bg-blue-700 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2"
        >
          {confirmed ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
        </span>
        <span>{view.presentation.confirmationText}</span>
      </label>
      <button
        type="button"
        disabled={!confirmed || working}
        onClick={() => void submit()}
        className="mt-4 inline-flex items-center gap-2 bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        {view.presentation.actionLabel}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

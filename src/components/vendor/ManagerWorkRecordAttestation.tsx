"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";

export const MANAGER_WORK_RECORD_ATTESTATION_TEXT =
  "I am authorized to manage this Work Record for the Vendor shown. I confirm that the assigned service professional and the job, location, recording boundary, participant roles, audio setting, purpose, and stages entered by the Vendor are accurate to the best of my knowledge. I understand that I cannot make the Customer's recording or Public choice, an Employee's job-specific Recording Participation choice, or an Employee's standing Public participation choice.";

type View = {
  status: { current: boolean; decidedAt: string | null };
  contextHash: string;
  contentSetHash: string;
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
}) {
  const [view, setView] = useState<View | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

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
  return (
    <div>
      <div className="flex items-start gap-3">
        <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <p className="font-semibold text-slate-950">Manager Work Record attestation required before Service Order release</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{MANAGER_WORK_RECORD_ATTESTATION_TEXT}</p>
          <p className="mt-2 text-xs text-slate-500">This does not replace Customer authorization, Employee participation, Reliance Audit, or certification of the underlying work.</p>
        </div>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
        <span>I confirm this exact current Work Record, assignment, and recording context for the identified Vendor.</span>
      </label>
      <button
        type="button"
        disabled={!confirmed || working}
        onClick={() => void submit()}
        className="mt-4 inline-flex items-center gap-2 bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        Confirm Work Record Attestation
      </button>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

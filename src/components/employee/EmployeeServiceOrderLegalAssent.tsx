"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Loader2, ShieldCheck, UserRoundX, XCircle } from "lucide-react";

import { EmployeeVerifiedDecision } from "@/components/employee/EmployeeVerifiedDecision";
import { RoleAssentDocumentViewer } from "@/components/legal/RoleAssentDocumentViewer";

type LegalAssentView = {
  status: { current: boolean; decision: "ASSENT" | "DECLINE" | null; decidedAt: string | null };
  identity: {
    employeeName: string;
    vendorName: string;
    serviceName: string | null;
    membershipId: string;
    bookingId: string;
  };
  serviceOrderContextHash: string;
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
  identity: false,
  terms: false,
  privacy: false,
  electronicRecords: false,
};

export function EmployeeServiceOrderLegalAssent(props: {
  membershipId: string;
  bookingId: string;
  contextHash: string;
  headers: Record<string, string>;
  onAssented: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<LegalAssentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<"ASSENT" | "DECLINE" | null>(null);
  const [correctionRequested, setCorrectionRequested] = useState(false);
  const [working, setWorking] = useState(false);
  const [acknowledgements, setAcknowledgements] = useState(EMPTY_ACKNOWLEDGEMENTS);
  const requestId = useRef(crypto.randomUUID());

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        membershipId: props.membershipId,
        bookingId: props.bookingId,
      });
      const response = await fetch(`/api/employee/legal-assent?${query.toString()}`, {
        headers: props.headers,
        credentials: "include",
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 404 && body?.code === "ROLE_ASSENT_NOT_ENABLED") {
        setView({ status: { current: true, decision: null, decidedAt: null } } as LegalAssentView);
        return;
      }
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "The Service Order agreement could not be loaded.");
      }
      setView(body as LegalAssentView);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The Service Order agreement could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [props.bookingId, props.contextHash, props.membershipId]);

  async function reportWrongRecipient() {
    if (!view) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/employee/legal-assent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...props.headers },
        body: JSON.stringify({
          membershipId: props.membershipId,
          bookingId: props.bookingId,
          contextHash: view.serviceOrderContextHash,
          decision: "WRONG_RECIPIENT",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "The identity correction could not be recorded.");
      }
      setCorrectionRequested(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The identity correction could not be recorded.");
    } finally {
      setWorking(false);
    }
  }

  if (view?.status.current) return <>{props.children}</>;
  if (loading) {
    return <p className="mt-5 flex items-center gap-2 text-sm text-blue-100/80"><Loader2 className="h-4 w-4 animate-spin" /> Loading the current Service Order agreement...</p>;
  }
  if (!view) {
    return (
      <div className="mt-5 border-y border-rose-400/40 py-5">
        <p role="alert" className="text-sm text-rose-200">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-blue-200">Retry</button>
      </div>
    );
  }
  if (correctionRequested) {
    return (
      <div className="mt-5 border-y border-amber-300/30 py-5 text-amber-100">
        <p className="font-semibold">Identity correction recorded</p>
        <p className="mt-1 text-sm leading-6">No assent or recording-participation choice was recorded. Ask the Vendor Manager to correct the assignment.</p>
      </div>
    );
  }
  const allChecked = Object.values(acknowledgements).every(Boolean);
  const roleNotice = view.presentation.content.find(
    (item) => item.contentKey === "reliance.employee-accountless-role-assent",
  );

  return (
    <div className="mt-5 border-y border-blue-300/30 py-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase text-blue-200">Before you use this Service Order</p>
          <h3 className="mt-1 text-lg font-bold text-white">Verify your own Employee agreement</h3>
          <p className="mt-1 text-sm leading-6 text-blue-50/80">
            {view.identity.vendorName} identified {view.identity.employeeName} as the assigned service professional. This agreement does not allow recording or Public use.
          </p>
        </div>
      </div>

      <div className="mt-5 bg-white p-4 text-slate-950">
        <RoleAssentDocumentViewer content={view.presentation.content} packageKey={view.presentation.packageKey} />
        <fieldset className="mt-5 space-y-3 border-t border-slate-200 pt-4">
          <legend className="font-semibold">Required acknowledgments</legend>
          {[
            ["identity", "I am the verified assigned person for this Service Order and am acting only for myself."],
            ["terms", "I agree to the exact Reliance Terms of Use version shown for this Service Order."],
            ["privacy", "I acknowledge that I reviewed the exact Reliance Privacy Notice version shown."],
            ["electronicRecords", "I consent to receive and retain this notice, the Service Order, decision receipts, and related records electronically."],
          ].map(([key, label]) => {
            const checked = acknowledgements[key as keyof typeof acknowledgements];
            return (
              <label
                key={key}
                htmlFor={`employee-service-order-${key}`}
                className={`flex cursor-pointer items-start gap-3 border p-3 text-sm leading-6 text-slate-700 transition focus-within:border-blue-700 ${
                  checked ? "border-blue-700 bg-blue-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <input
                  id={`employee-service-order-${key}`}
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

        {!choice ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!allChecked || working}
              onClick={() => setChoice("ASSENT")}
              className="inline-flex items-center gap-2 bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Agree and continue
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => void reportWrongRecipient()}
              className="inline-flex items-center gap-2 border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              <UserRoundX className="h-4 w-4" /> This Service Order is not for me
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => setChoice("DECLINE")}
              className="inline-flex items-center gap-2 border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              <XCircle className="h-4 w-4" /> I do not agree
            </button>
          </div>
        ) : null}
      </div>

      {choice ? (
        <div className="mt-4">
          <EmployeeVerifiedDecision
            purpose="EMPLOYEE_SERVICE_ORDER_LEGAL_ASSENT"
            membershipId={props.membershipId}
            bookingId={props.bookingId}
            contextHash={view.serviceOrderContextHash}
            decision={choice}
            title={choice === "ASSENT" ? "Verify and agree for yourself" : "Verify that you do not agree"}
            decisionText={
              choice === "ASSENT"
                ? "Verification confirms who is making this exact legal assent. It does not submit a recording-participation choice."
                : "Declining blocks the verified Service Order flow. It does not submit a recording-participation choice or cancel the underlying service."
            }
            headers={props.headers}
            submitUrl="/api/employee/legal-assent"
            submissionBody={{
              decision: choice,
              acknowledgements,
              contentSetHash: view.presentation.contentSetHash,
              requestId: requestId.current,
            }}
            confirmLabel={choice === "ASSENT" ? "Verify and agree" : "Verify and decline"}
            onCancel={() => setChoice(null)}
            onComplete={async () => {
              setChoice(null);
              if (choice === "ASSENT") {
                await props.onAssented();
                await load();
              } else {
                await load();
              }
            }}
          />
        </div>
      ) : null}
      {view.status.decision === "DECLINE" ? (
        <p className="mt-4 text-sm font-semibold text-amber-200">
          You did not agree. The verified Service Order flow remains unavailable. No recording choice was recorded.
        </p>
      ) : null}
      {roleNotice ? (
        <p className="mt-3 text-xs text-blue-100/60">Exact notice: {roleNotice.version} - {roleNotice.contentHash}</p>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}

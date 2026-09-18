"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageSquareText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

type Purpose =
  | "EMPLOYEE_RECORDING_PARTICIPATION"
  | "EMPLOYEE_STANDING_PUBLIC_MEDIA";

type VerificationView = {
  identity: {
    employeeName: string;
    vendorName: string;
    serviceName: string | null;
  };
  channels: { email: string | null; sms: string | null };
};

export function EmployeeVerifiedDecision(props: {
  purpose: Purpose;
  membershipId: string;
  bookingId?: string | null;
  contextHash?: string | null;
  decision: "ALLOW" | "DECLINE" | "DENY";
  title: string;
  decisionText: string;
  headers: Record<string, string>;
  submitUrl: string;
  onCancel: () => void;
  onComplete: (body: any) => void | Promise<void>;
}) {
  const [view, setView] = useState<VerificationView | null>(null);
  const [channel, setChannel] = useState<"email" | "sms" | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [staleContext, setStaleContext] = useState(false);

  const contextBody = {
    purpose: props.purpose,
    membershipId: props.membershipId,
    ...(props.bookingId ? { bookingId: props.bookingId } : {}),
    ...(props.contextHash ? { contextHash: props.contextHash } : {}),
  };

  function responseError(body: any, fallback: string) {
    setStaleContext(body?.staleContext === true || body?.code === "EMPLOYEE_SERVICE_ORDER_CONTEXT_CHANGED");
    return new Error(body?.error || fallback);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setStaleContext(false);
    void fetch("/api/employee/decision-verification/start", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...props.headers },
      body: JSON.stringify(contextBody),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.success === false) {
          throw responseError(body, "Identity verification is unavailable.");
        }
        if (active) setView(body as VerificationView);
      })
      .catch((nextError) => {
        if (active) setError(nextError instanceof Error ? nextError.message : "Identity verification is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [props.bookingId, props.contextHash, props.membershipId, props.purpose]);

  async function sendCode(nextChannel: "email" | "sms") {
    setWorking(true);
    setError("");
    setStaleContext(false);
    try {
      const response = await fetch("/api/employee/decision-verification/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...props.headers },
        body: JSON.stringify({ ...contextBody, channel: nextChannel }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false || !body?.challengeId) {
        throw responseError(body, "The verification code could not be sent.");
      }
      setChannel(nextChannel);
      setChallengeId(String(body.challengeId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The verification code could not be sent.");
    } finally {
      setWorking(false);
    }
  }

  async function verifyAndSubmit() {
    if (!challengeId || !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit verification code.");
      return;
    }
    setWorking(true);
    setError("");
    setStaleContext(false);
    try {
      const verifyResponse = await fetch("/api/employee/decision-verification/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...props.headers },
        body: JSON.stringify({ ...contextBody, challengeId, code }),
      });
      const verified = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || verified?.success === false) {
        throw responseError(verified, "Verification was not completed.");
      }
      const decisionResponse = await fetch(props.submitUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...props.headers },
        body: JSON.stringify({ membershipId: props.membershipId, decision: props.decision }),
      });
      const decisionBody = await decisionResponse.json().catch(() => ({}));
      if (!decisionResponse.ok || decisionBody?.success === false) {
        throw responseError(decisionBody, "Your choice could not be saved.");
      }
      await props.onComplete(decisionBody);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Your choice could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-lg border border-blue-400/30 bg-blue-950/30 p-4 text-white">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />
        <div>
          <p className="font-semibold">{props.title}</p>
          <p className="mt-1 text-sm leading-6 text-blue-100/80">{props.decisionText}</p>
        </div>
      </div>
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-blue-100/80"><Loader2 className="h-4 w-4 animate-spin" /> Preparing secure verification...</p>
      ) : null}
      {!loading && !challengeId ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">Step 1: Verify it is you</p>
          <p className="text-xs leading-5 text-blue-100/70">
            We will send a one-time code to contact information already associated with {view?.identity.employeeName || "this Employee"}.
          </p>
          <div className="flex flex-wrap gap-2">
            {view?.channels.email ? (
              <Button disabled={working} onClick={() => void sendCode("email")}>
                <Mail className="mr-2 h-4 w-4" /> Email {view.channels.email}
              </Button>
            ) : null}
            {view?.channels.sms ? (
              <Button disabled={working} onClick={() => void sendCode("sms")}>
                <MessageSquareText className="mr-2 h-4 w-4" /> Text {view.channels.sms}
              </Button>
            ) : null}
          </div>
          {!view?.channels.email && !view?.channels.sms ? (
            <p className="text-sm text-amber-200">No verified Employee contact is available. Ask the Vendor Manager to correct the Employee profile.</p>
          ) : null}
        </div>
      ) : null}
      {challengeId ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">Enter the code sent by {channel === "sms" ? "text" : "email"}</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-11 w-44 rounded-md border border-white/20 bg-slate-950 px-3 text-lg font-semibold tracking-[0.2em] text-white"
            aria-label="6-digit verification code"
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={working || code.length !== 6} onClick={() => void verifyAndSubmit()}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Verify and confirm
            </Button>
            <Button variant="outline" className="border-slate-500 bg-transparent text-white" disabled={working} onClick={props.onCancel}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-3 border-slate-500 bg-transparent text-white" disabled={working} onClick={props.onCancel}>Cancel</Button>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-red-200">{error}</p> : null}
      {staleContext ? (
        <Button
          variant="outline"
          className="mt-3 border-amber-300 bg-transparent text-amber-100"
          onClick={() => window.location.reload()}
        >
          Reload current Service Order
        </Button>
      ) : null}
    </div>
  );
}

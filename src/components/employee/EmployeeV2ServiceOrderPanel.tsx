"use client";

import {
  CheckCircle2,
  MapPin,
  Mic,
  ShieldCheck,
  UserRoundCheck,
  Video,
  XCircle,
} from "lucide-react";

import { EmployeeVerifiedDecision } from "@/components/employee/EmployeeVerifiedDecision";
import type { EmployeeV2ServiceOrderView } from "@/lib/recording/employee-v2-service-order";

type Decision = "ALLOW" | "DECLINE";

export function EmployeeV2ServiceOrderPanel(props: {
  view: EmployeeV2ServiceOrderView;
  membershipId: string;
  bookingId: string;
  headers: Record<string, string>;
  choice: Decision | null;
  onChoice: (decision: Decision) => void;
  onCancel: () => void;
  onComplete: (body: any) => void | Promise<void>;
}) {
  const status = props.view.participation.employeeStatus;
  return (
    <section className="mt-4 border-y border-blue-300/25 py-5" aria-labelledby={`v2-recording-${props.bookingId}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
            Job-specific recording request
          </p>
          <h2 id={`v2-recording-${props.bookingId}`} className="mt-1 text-lg font-bold text-white">
            Review this Service Order before recording
          </h2>
          <p className="mt-1 text-sm leading-6 text-blue-50/80">
            You received this because you are the assigned service professional. Your choice applies only to this Service Order and its current recording request.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-2 font-semibold text-blue-100"><MapPin className="h-4 w-4" /> Recording location</dt>
          <dd className="mt-1 text-blue-50/80">
            {props.view.scope.locationType}
            {props.view.scope.serviceLocation ? `: ${props.view.scope.serviceLocation}` : ""}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 font-semibold text-blue-100">
            {props.view.scope.audio === "Video with audio" ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            Recording format
          </dt>
          <dd className="mt-1 text-blue-50/80">{props.view.scope.audio}</dd>
        </div>
        <div>
          <dt className="font-semibold text-blue-100">Recording boundary</dt>
          <dd className="mt-1 text-blue-50/80">
            {props.view.scope.recordingBoundary}
            {props.view.scope.boundaryExplanation ? `: ${props.view.scope.boundaryExplanation}` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-blue-100">Intentionally included</dt>
          <dd className="mt-1 text-blue-50/80">{props.view.scope.intentionalParticipants.join(", ")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-blue-100">What may be recorded</dt>
          <dd className="mt-1 text-blue-50/80">{props.view.scope.recordingSubjects.join(", ")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-blue-100">Service Video stages</dt>
          <dd className="mt-1 text-blue-50/80">{props.view.scope.stages.join(" to ")}</dd>
        </div>
      </dl>

      <p className="mt-4 border-l-2 border-blue-300 pl-3 text-sm font-semibold leading-6 text-blue-100">
        {props.view.scope.privateUseNotice}
      </p>

      <div className="mt-5 flex items-start gap-3 border-t border-blue-300/20 pt-4">
        {status === "ALLOWED" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
        ) : status === "DECLINED" ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
        ) : (
          <UserRoundCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
        )}
        <div>
          <p className="font-semibold text-white">{props.view.nextState.title}</p>
          <p className="mt-1 text-sm leading-6 text-blue-50/80">{props.view.nextState.detail}</p>
        </div>
      </div>

      {props.view.participation.canDecide && !props.choice ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => props.onChoice("ALLOW")}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {props.view.policy.allow.label}
          </button>
          {status !== "DECLINED" ? (
            <button
              type="button"
              onClick={() => props.onChoice("DECLINE")}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300/70 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-200/10"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {props.view.policy.decline.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {props.choice ? (
        <div className="mt-4">
          <EmployeeVerifiedDecision
            purpose="EMPLOYEE_RECORDING_PARTICIPATION"
            membershipId={props.membershipId}
            bookingId={props.bookingId}
            contextHash={props.view.contextHash}
            decision={props.choice}
            title={
              props.choice === "ALLOW"
                ? "Allow recording for this Service Order"
                : "Decline recording for this Service Order"
            }
            decisionText={
              props.choice === "ALLOW"
                ? props.view.policy.allow.text
                : props.view.policy.decline.text
            }
            headers={props.headers}
            submitUrl={`/api/employee/jobs/${encodeURIComponent(props.bookingId)}/recording-participation`}
            onCancel={props.onCancel}
            onComplete={props.onComplete}
          />
        </div>
      ) : null}
    </section>
  );
}

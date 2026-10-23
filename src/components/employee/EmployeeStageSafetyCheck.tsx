"use client";

import { Check, LoaderCircle, LocateFixed, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

import {
  EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS,
  type EmployeeStageSafetyAcknowledgmentId,
} from "@/lib/recording/employee-stage-safety-contract";

type RecordingStage = "INTRO" | "IN_PROGRESS" | "COMPLETED";

type LocationProof = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  source: "browser_geolocation";
};

type PendingSubmission = {
  locationAttemptId: string;
  requestId: string;
};

function requestCurrentLocation(): Promise<LocationProof> {
  if (!navigator.geolocation) {
    return Promise.reject(
      new Error("This phone cannot verify location. Use a browser with location access enabled."),
    );
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) {
          reject(new Error("Location verification returned invalid coordinates. Try again from the service location."));
          return;
        }
        resolve({
          latitude,
          longitude,
          accuracyMeters: accuracy,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
          source: "browser_geolocation",
        });
      },
      () => reject(new Error("Location access was blocked. Allow precise location, then try again.")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  });
}

function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `employee-stage-safety-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function EmployeeStageSafetyCheck(props: {
  bookingId: string;
  stage: RecordingStage;
  serviceLocation: string | null | undefined;
  headers: Record<string, string>;
  onComplete: () => void | Promise<void>;
}) {
  const [acknowledged, setAcknowledged] = useState<
    Partial<Record<EmployeeStageSafetyAcknowledgmentId, boolean>>
  >({});
  const [status, setStatus] = useState<"idle" | "locating" | "submitting" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const pendingSubmission = useRef<PendingSubmission | null>(null);
  const allAcknowledged = EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS.every(
    (item) => acknowledged[item.id] === true,
  );
  const busy = status === "locating" || status === "submitting";

  const submit = async () => {
    if (!allAcknowledged || busy) return;
    setMessage(null);
    try {
      let pending = pendingSubmission.current;
      if (!pending) {
        setStatus("locating");
        const locationProof = await requestCurrentLocation();
        const locationResponse = await fetch(
          `/api/employee/jobs/${encodeURIComponent(props.bookingId)}/verify-location`,
          {
            method: "POST",
            headers: props.headers,
            body: JSON.stringify({
              recordingStage: props.stage,
              locationProof,
            }),
          },
        );
        const locationBody = await locationResponse.json().catch(() => ({}));
        if (!locationResponse.ok || locationBody?.verified !== true || !locationBody?.locationAttemptId) {
          throw new Error(
            locationBody?.message ||
              locationBody?.error ||
              "This phone could not verify the saved service location.",
          );
        }
        pending = {
          locationAttemptId: String(locationBody.locationAttemptId),
          requestId: newRequestId(),
        };
        pendingSubmission.current = pending;
      }

      setStatus("submitting");
      const response = await fetch(
        `/api/employee/jobs/${encodeURIComponent(props.bookingId)}/safety-check`,
        {
          method: "POST",
          headers: props.headers,
          body: JSON.stringify({
            recordingStage: props.stage,
            locationAttemptId: pending.locationAttemptId,
            requestId: pending.requestId,
            acknowledgments: Object.fromEntries(
              EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS.map((item) => [item.id, true]),
            ),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) {
        pendingSubmission.current = null;
        throw new Error(
          body?.message || body?.error || "The safety check could not be completed. Try again.",
        );
      }
      if (body?.recordingGate?.recordingUnlocked !== true) {
        pendingSubmission.current = null;
        throw new Error(
          body?.blocked?.resolution ||
            "The current recording requirements changed. Reload this Service Order before recording.",
        );
      }
      pendingSubmission.current = null;
      await props.onComplete();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The safety check could not be completed.");
      return;
    }
    setStatus("idle");
  };

  return (
    <section
      id={`service-order-safety-${props.bookingId}`}
      className="mt-4 rounded-2xl border border-blue-300/35 bg-blue-950/45 p-4 text-blue-50"
      aria-labelledby={`stage-safety-${props.bookingId}-${props.stage}`}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
        <div>
          <h4 id={`stage-safety-${props.bookingId}-${props.stage}`} className="text-base font-bold text-white">
            Complete the Service Order safety and location check
          </h4>
          <p className="mt-1 text-sm leading-6 text-blue-50/80">
            Confirm these conditions once before recording. The same check supports all three Service Videos while the assigned employee, recording scope, service location, and conditions remain unchanged.
          </p>
          {props.serviceLocation ? (
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-emerald-100">
              <LocateFixed className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{props.serviceLocation}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS.map((item) => {
          const checked = acknowledged[item.id] === true;
          return (
            <label
              key={item.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                checked
                  ? "border-blue-300 bg-blue-500/15"
                  : "border-white/15 bg-slate-950/55 hover:border-blue-300/60"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  setAcknowledged((current) => ({ ...current, [item.id]: event.target.checked }))
                }
                className="peer sr-only"
              />
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  checked ? "border-blue-200 bg-blue-600" : "border-blue-100/40 bg-slate-950"
                }`}
                aria-hidden="true"
              >
                {checked ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
              </span>
              <span className="text-sm leading-6 text-blue-50/90">{item.text}</span>
            </label>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-5 text-amber-100/90">
        If any item is not true, do not record. Correct the condition, wait for it to clear, or reframe the shot before completing this check. Stop and complete a fresh check if safety, privacy, recording setup, or location conditions change later.
      </p>

      {message ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-300/40 bg-red-950/60 px-3 py-2 text-sm font-semibold text-red-100">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!allAcknowledged || busy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4" aria-hidden="true" />}
        {status === "locating"
          ? "Verifying current location..."
          : status === "submitting"
            ? "Saving Service Order safety check..."
            : "Verify location and complete check"}
      </button>
    </section>
  );
}

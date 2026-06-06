"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { normalizeEmployeeJobStatusLabel, shouldShowEmployeeStartButton } from "@/lib/employee-job-status";
import {
  getCompletedEmployeeCaptureCount,
  getEmployeeCaptureActionLabel,
  getEmployeeCaptureDeviceLabel,
  getEmployeeCaptureStageHeading,
  getEmployeeCaptureSupportCopy,
  getEmployeeStageStep,
  getNextEmployeeCaptureStage,
} from "@/lib/employee-stage-capture";
import {
  STAGE_VIDEO_MAX_DURATION_SECONDS,
  formatStageVideoDuration,
  getStageVideoLimitCopy,
  getVideoFileDurationSeconds,
  isOverStageVideoLimit,
} from "@/lib/stage-video-guidance";

type EmployeeJob = {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  status: string;
  customer: { name: string | null; email: string | null; phone: string | null };
  bookingDate: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  stageProgress: { INTRO: boolean; IN_PROGRESS: boolean; COMPLETED: boolean };
  canMarkComplete: boolean;
};

type StageFeedbackState = {
  status: "uploading" | "success" | "error";
  message: string;
};

type PairedDeviceState = {
  deviceId: string;
  deviceUid: string;
  deviceName: string | null;
  deviceType: string;
  vendorId: string;
  membershipId: string;
  pairedAt: string | null;
  lastSeenAt: string | null;
  model: string | null;
  os: string | null;
  appVersion: string | null;
  status: string;
};

const STAGES = [
  { key: "INTRO", label: "Before / Intro", cue: "Show the area or condition before work begins." },
  { key: "IN_PROGRESS", label: "During / In Progress", cue: "Show active progress or work being performed." },
  { key: "COMPLETED", label: "After / Completed", cue: "Show the final result clearly." },
] as const;

const EMPLOYEE_JOBS_TIMEOUT_MS = 20000;
const EMPLOYEE_PAIR_TIMEOUT_MS = 15000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutHandle);
  }
}

function historyFingerprint(job: EmployeeJob): string {
  return [
    job.vendorId,
    job.vendorName,
    job.title,
    job.customer.name || "",
    job.customer.phone || "",
    job.bookingDate || "",
    String(job.status || "").trim().toUpperCase(),
    job.stageProgress.INTRO ? "1" : "0",
    job.stageProgress.IN_PROGRESS ? "1" : "0",
    job.stageProgress.COMPLETED ? "1" : "0",
  ].join("::");
}

function dedupeCompletedHistoryJobs(jobs: EmployeeJob[]): EmployeeJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const fingerprint = historyFingerprint(job);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function getOrCreateDeviceUid() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem("employee_device_uid");
  if (existing) return existing;
  const generated = `phone_${crypto.randomUUID()}`;
  localStorage.setItem("employee_device_uid", generated);
  return generated;
}

function shortDeviceLabel(device: PairedDeviceState | null): string {
  if (!device) return "";
  const rawName = String(device.deviceName || device.model || "").trim();
  const normalizedOs = String(device.os || "").trim();
  const combined = `${rawName} ${normalizedOs}`.toLowerCase();

  if (combined.includes("iphone")) return "iPhone";
  if (combined.includes("ipad")) return "iPad";
  if (combined.includes("android")) return "Android phone";
  if (combined.includes("electron") || combined.includes("codex/")) return "Employee browser";
  if (combined.includes("windows")) return "Windows browser";
  if (combined.includes("macintosh") || combined.includes("mac os")) return "Mac browser";
  if (combined.includes("linux")) return "Linux browser";
  if (rawName && !rawName.startsWith("Mozilla/") && rawName.length <= 50) return rawName;
  if (normalizedOs && normalizedOs.length <= 24) {
    return `${normalizedOs} ${device.deviceType === "HEADSET" ? "headset" : "device"}`;
  }
  return device.deviceType === "HEADSET" ? "Employee headset" : "Employee phone";
}

function getClientDeviceModelLabel(): string {
  if (typeof navigator === "undefined") return "Employee phone";
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Electron|Codex/i.test(ua)) return "Employee browser";
  if (/Windows/i.test(ua)) return "Windows browser";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac browser";
  if (/Linux/i.test(ua)) return "Linux browser";
  return "Employee phone";
}

function getClientDeviceOsLabel(): string {
  if (typeof navigator === "undefined") return "";
  const platform = navigator.platform || "";
  if (/iPhone|iPad|iPod/i.test(platform)) return "iOS";
  if (/Android/i.test(platform)) return "Android";
  if (/Win/i.test(platform)) return "Windows";
  if (/Mac/i.test(platform)) return "macOS";
  if (/Linux/i.test(platform)) return "Linux";
  return platform || "";
}

function isCompletedStatus(status: string | null | undefined): boolean {
  return String(status || "").trim().toUpperCase() === "COMPLETED";
}

function isAwaitingReviewStatus(status: string | null | undefined): boolean {
  return String(status || "").trim().toUpperCase() === "AWAITING_REVIEW";
}

function shouldAllowStageUpload(status: string | null | undefined): boolean {
  const normalized = String(status || "").trim().toUpperCase();
  return normalized !== "AWAITING_REVIEW" && normalized !== "COMPLETED";
}

function submitButtonLabel(status: string | null | undefined): string {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "AWAITING_REVIEW") return "Awaiting Manager Review";
  if (normalized === "COMPLETED") return "Completed";
  return "Submit for Manager Review";
}

function submitHelperText(job: EmployeeJob): string | null {
  const normalized = String(job.status || "").trim().toUpperCase();
  if (normalized === "AWAITING_REVIEW") return "All 3 stage videos are uploaded. Manager review is in progress.";
  if (normalized === "COMPLETED") return "All 3 stage videos are complete and manager-approved.";
  if (!job.canMarkComplete) return "Complete all 3 stage videos first.";
  return null;
}

export default function EmployeeJobsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<EmployeeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [stageFeedback, setStageFeedback] = useState<Record<string, StageFeedbackState>>({});
  const [pairedDevice, setPairedDevice] = useState<PairedDeviceState | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [showCompletedHistory, setShowCompletedHistory] = useState(false);
  const [focusedStageByJobId, setFocusedStageByJobId] = useState<Record<string, (typeof STAGES)[number]["key"]>>({});
  const userId = useMemo(() => String(user?.id || "").trim(), [user?.id]);

  const currentJobs = useMemo(
    () => jobs.filter((job) => !isCompletedStatus(job.status)),
    [jobs]
  );
  const completedJobs = useMemo(
    () => dedupeCompletedHistoryJobs(jobs.filter((job) => isCompletedStatus(job.status))),
    [jobs]
  );

  const loadJobs = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/employee/jobs", {
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        cache: "no-store",
      }, EMPLOYEE_JOBS_TIMEOUT_MS);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load assigned jobs.");
      setJobs(Array.isArray(json?.jobs) ? json.jobs : []);
    } catch (e) {
      const message =
        e instanceof Error && e.message === "Request timed out"
          ? "Assigned jobs took too long to load. Please retry."
          : e instanceof Error
            ? e.message
            : "Failed to load jobs";
      setError(message);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    void loadJobs();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const pair = async () => {
      const deviceUid = getOrCreateDeviceUid();
      try {
        const res = await fetchWithTimeout("/api/employee/device/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
          body: JSON.stringify({
            deviceUid,
            deviceType: "PHONE",
            model: getClientDeviceModelLabel(),
            os: getClientDeviceOsLabel(),
            appVersion: "employee-web-v1",
          }),
        }, EMPLOYEE_PAIR_TIMEOUT_MS);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.pairing?.deviceId) {
          setPairingError(json?.error || "Could not pair this device.");
          setPairedDevice(null);
          return;
        }
        setPairingError(null);
        setPairedDevice({
          deviceId: String(json.pairing.deviceId),
          deviceUid: String(json.pairing.deviceUid || deviceUid),
          deviceName: json.pairing.deviceName || null,
          deviceType: String(json.pairing.deviceType || "PHONE"),
          vendorId: String(json.pairing.vendorId || ""),
          membershipId: String(json.pairing.membershipId || ""),
          pairedAt: json.pairing.pairedAt ? String(json.pairing.pairedAt) : null,
          lastSeenAt: json.pairing.lastSeenAt ? String(json.pairing.lastSeenAt) : null,
          model: json.pairing.model || null,
          os: json.pairing.os || null,
          appVersion: json.pairing.appVersion || null,
          status: String(json.pairing.status || "active"),
        });
      } catch (e) {
        const message =
          e instanceof Error && e.message === "Request timed out"
            ? "Device pairing took too long. Reload to retry."
            : e instanceof Error
              ? e.message
              : "Could not pair this device.";
        setPairingError(message);
        setPairedDevice(null);
      }
    };
    void pair();
  }, [userId]);

  const startJob = async (jobId: string) => {
    setActionMessage(null);
    const res = await fetch(`/api/employee/jobs/${jobId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Failed to start job");
      return;
    }
    setActionMessage("Job started.");
    await loadJobs();
  };

  const completeJob = async (jobId: string) => {
    setActionMessage(null);
    const res = await fetch(`/api/employee/jobs/${jobId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Failed to complete job");
      return;
    }
    const nextStatus = String(json?.job?.status || "").trim().toUpperCase();
    setActionMessage(
      nextStatus === "AWAITING_REVIEW"
        ? "Submitted for manager review."
        : "Job update submitted."
    );
    await loadJobs();
  };

  const uploadStageVideo = async (
    job: EmployeeJob,
    stage: (typeof STAGES)[number]["key"],
    file: File,
    durationSeconds: number
  ) => {
    const uploadKey = `${job.id}:${stage}`;
    const hadExistingStageVideo = Boolean(job.stageProgress?.[stage]);
    setUploadingKey(uploadKey);
    setError(null);
    setActionMessage(null);
    setStageFeedback((prev) => ({
      ...prev,
      [uploadKey]: { status: "uploading", message: "Uploading..." },
    }));
    try {
      const deviceIdForUpload = pairedDevice?.deviceId || null;

      const createSessionRes = await fetch(`/api/vendors/${job.vendorId}/media/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({
          bookingId: job.id,
          vendorJobVideoStage: stage,
          sessionType: "JOB_SERVICE_VIDEO",
          replaceExisting: true,
          locationContext: "business",
          deviceId: deviceIdForUpload,
          deviceType: pairedDevice?.deviceType || "PHONE",
        }),
      });
      const createSessionJson = await createSessionRes.json().catch(() => ({}));
      if (!createSessionRes.ok || !createSessionJson?.session?.id) {
        throw new Error(
          createSessionJson?.message || createSessionJson?.error || "Failed to create stage session"
        );
      }
      const mediaSessionId = String(createSessionJson.session.id);

      const initRes = await fetch(`/api/vendors/${job.vendorId}/media/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({
          fileName: file.name,
          expectedBytes: file.size,
          mimeType: file.type || "video/mp4",
        }),
      });
      const initJson = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initJson?.sasUrl || !initJson?.assetId || !initJson?.blobKey) {
        throw new Error(initJson?.error || "Failed to initialize upload");
      }

      const putRes = await fetch(String(initJson.sasUrl), {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }

      const completeRes = await fetch(`/api/vendors/${job.vendorId}/media/upload/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({
          assetId: initJson.assetId,
          blobKey: initJson.blobKey,
          blobUrl: null,
          bytes: file.size,
          mimeType: file.type || "video/mp4",
          mediaSessionId,
          deviceId: deviceIdForUpload,
          durationSeconds,
        }),
      });
      const completeJson = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok || !completeJson?.success) {
        throw new Error(completeJson?.error || "Failed to finalize upload");
      }

      const stageRes = await fetch(`/api/employee/jobs/${job.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({ stage }),
      });
      const stageJson = await stageRes.json().catch(() => ({}));
      if (!stageRes.ok || !stageJson?.success) {
        throw new Error(stageJson?.error || "Failed to mark stage complete");
      }

      setActionMessage(
        hadExistingStageVideo
          ? "Stage video replaced successfully."
          : `${stage.replace("_", " ")} video uploaded.`
      );
      setStageFeedback((prev) => ({
        ...prev,
        [uploadKey]: {
          status: "success",
          message: hadExistingStageVideo ? "Stage video replaced successfully." : "Uploaded successfully",
        },
      }));
      setFocusedStageByJobId((current) => ({
        ...current,
        [job.id]: getNextEmployeeCaptureStage({
          ...job.stageProgress,
          [stage]: true,
        }),
      }));
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload stage video");
      setStageFeedback((prev) => ({
        ...prev,
        [uploadKey]: { status: "error", message: "Upload failed, try again" },
      }));
    } finally {
      setUploadingKey(null);
    }
  };

  const validateAndUploadStageVideo = async (
    job: EmployeeJob,
    stage: (typeof STAGES)[number]["key"],
    file: File
  ) => {
    const uploadKey = `${job.id}:${stage}`;
    try {
      const durationSeconds = await getVideoFileDurationSeconds(file);
      if (isOverStageVideoLimit(durationSeconds)) {
        setStageFeedback((prev) => ({
          ...prev,
          [uploadKey]: {
            status: "error",
            message: `Clip is ${formatStageVideoDuration(durationSeconds)}. Retake a ${formatStageVideoDuration(
              STAGE_VIDEO_MAX_DURATION_SECONDS
            )} max video.`,
          },
        }));
        return;
      }
      await uploadStageVideo(job, stage, file, durationSeconds);
    } catch {
      setStageFeedback((prev) => ({
        ...prev,
        [uploadKey]: {
          status: "error",
          message: "Could not read the video duration. Retake or choose a 30-second max clip.",
        },
      }));
    }
  };

  const renderJobCard = (job: EmployeeJob, historyMode = false) => {
    const normalizedStatus = String(job.status || "").trim().toUpperCase();
    const showUploadControls = !historyMode && shouldAllowStageUpload(normalizedStatus);
    const showStartButton = !historyMode && shouldShowEmployeeStartButton(normalizedStatus);
    const helperText = historyMode ? null : submitHelperText(job);
    const selectedStageKey =
      focusedStageByJobId[job.id] || getNextEmployeeCaptureStage(job.stageProgress);
    const selectedStage = STAGES.find((stage) => stage.key === selectedStageKey) || STAGES[0];
    const selectedStageDone = Boolean(job.stageProgress[selectedStage.key]);
    const selectedStageFeedbackKey = `${job.id}:${selectedStage.key}`;
    const completedStageCount = getCompletedEmployeeCaptureCount(job.stageProgress);
    const stageProgressLabel = `Step ${getEmployeeStageStep(selectedStage.key)} of ${STAGES.length}`;
    const captureDeviceLabel = getEmployeeCaptureDeviceLabel(pairedDevice);
    const captureSupportCopy = getEmployeeCaptureSupportCopy(pairedDevice);
    const stageActionLabel = getEmployeeCaptureActionLabel(selectedStage.key, selectedStageDone);

    return (
      <div key={job.id} className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{job.title}</p>
            <p className="text-xs text-gray-500">{job.vendorName}</p>
            <p className="mt-1 text-xs text-gray-600">
              Customer: {job.customer.name || "Unknown"}
              {job.customer.phone ? ` - ${job.customer.phone}` : ""}
            </p>
            {job.bookingDate ? (
              <p className="mt-1 text-[11px] text-gray-500">
                Service date: {new Date(job.bookingDate).toLocaleString()}
              </p>
            ) : null}
          </div>
          <span className="rounded border bg-gray-100 px-2 py-1 text-xs text-gray-700">
            {normalizeEmployeeJobStatusLabel(job.status)}
          </span>
        </div>

        {historyMode ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
            {STAGES.map((stage) => (
              <span
                key={`${job.id}:${stage.key}:history`}
                className={`rounded px-2 py-1 ${
                  job.stageProgress[stage.key]
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {stage.label}: {job.stageProgress[stage.key] ? "Uploaded" : "Missing"}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STAGES.map((stage) => {
                const done = Boolean(job.stageProgress[stage.key]);
                const selected = selectedStage.key === stage.key;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() =>
                      setFocusedStageByJobId((current) => ({
                        ...current,
                        [job.id]: stage.key,
                      }))
                    }
                    className={`rounded border p-3 text-left text-xs transition ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : done
                          ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300"
                          : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                    }`}
                  >
                    <p className="font-medium text-gray-900">{stage.label}</p>
                    <p className="mt-1 text-[11px] text-gray-600">{stage.cue}</p>
                    <p className={`mt-2 text-[11px] font-medium ${done ? "text-emerald-700" : "text-gray-500"}`}>
                      {done ? "Uploaded" : "Required"}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                    {stageProgressLabel}
                  </p>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {getEmployeeCaptureStageHeading(selectedStage.key)}
                  </h3>
                  <p className="text-xs text-gray-600">{selectedStage.cue}</p>
                </div>
                <div className="space-y-1 text-left sm:text-right">
                  <p className="text-xs font-medium text-gray-700">
                    {completedStageCount} of {STAGES.length} stages uploaded
                  </p>
                  <p className={`text-xs font-medium ${selectedStageDone ? "text-emerald-700" : "text-amber-700"}`}>
                    {selectedStageDone ? "This stage already has a video." : "This stage still needs a video."}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-gray-900">Capture source:</span> {captureDeviceLabel}
                </p>
                <p className="font-medium text-blue-700">{getStageVideoLimitCopy()}</p>
              </div>
              <p className="mt-2 text-xs text-gray-600">{captureSupportCopy}</p>

              {selectedStageDone ? (
                <p className="mt-2 text-xs text-amber-700">
                  Retaking this stage replaces the current video for this step.
                </p>
              ) : null}

              {showUploadControls ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={`${job.id}-${selectedStage.key}-upload`}
                    className={`inline-flex cursor-pointer items-center rounded border px-3 py-2 text-xs font-medium transition ${
                      uploadingKey === selectedStageFeedbackKey
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    {uploadingKey === selectedStageFeedbackKey ? "Uploading..." : stageActionLabel}
                  </label>
                  <input
                    id={`${job.id}-${selectedStage.key}-upload`}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    className="sr-only"
                    disabled={Boolean(uploadingKey)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void validateAndUploadStageVideo(job, selectedStage.key, file);
                      e.currentTarget.value = "";
                    }}
                  />
                  <span className="text-[11px] text-gray-500">
                    Choose camera or gallery on the phone. Headset capture uses the same stage flow later.
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-gray-500">
                  Uploads are locked while manager review is pending.
                </p>
              )}

              {stageFeedback[selectedStageFeedbackKey] ? (
                <p
                  className={`mt-2 text-[11px] ${
                    stageFeedback[selectedStageFeedbackKey].status === "error"
                      ? "text-red-700"
                      : stageFeedback[selectedStageFeedbackKey].status === "success"
                      ? "text-emerald-700"
                      : "text-blue-700"
                  }`}
                >
                  {stageFeedback[selectedStageFeedbackKey].message}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {job.rejectionReason && normalizedStatus === "IN_PROGRESS" ? (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Manager requested changes</p>
            <p className="mt-1">{job.rejectionReason}</p>
            <p className="mt-2 text-[11px] text-amber-900">
              Review the requested changes, re-upload the needed video stage, then submit again.
            </p>
            {job.rejectedAt ? (
              <p className="mt-1 text-[11px] text-amber-700">
                Rejected on {new Date(job.rejectedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}

        {!historyMode ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {showStartButton ? (
              <button
                type="button"
                onClick={() => void startJob(job.id)}
                className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
              >
                Start Job
              </button>
            ) : null}
            <button
              type="button"
              disabled={!job.canMarkComplete || isAwaitingReviewStatus(normalizedStatus) || isCompletedStatus(normalizedStatus)}
              onClick={() => void completeJob(job.id)}
              className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitButtonLabel(normalizedStatus)}
            </button>
            {helperText ? <span className="text-xs text-gray-500">{helperText}</span> : null}
          </div>
        ) : null}
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="reliance-operator-shell reliance-grid-lines min-h-screen p-4">
        <div className="mx-auto w-full max-w-2xl rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Checking employee access...</p>
          <p className="mt-2 text-sm text-gray-600">
            Reliance is confirming this employee session before loading assigned jobs.
          </p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="reliance-operator-shell reliance-grid-lines min-h-screen p-4">
        <div className="mx-auto w-full max-w-2xl rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Employee access required</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in with an employee-enabled account to open assigned jobs, device pairing, and stage uploads.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/auth/login?next=%2Femployee%2Fjobs"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Sign in
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Support &amp; Help
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reliance-operator-shell reliance-grid-lines min-h-screen p-4">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="reliance-operator-hero rounded-[28px] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
                Employee workspace
              </div>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Assigned Jobs</h1>
              <p className="mt-2 text-sm text-gray-600">
                Mobile-friendly employee workflow for Before, In Progress, and Completed stage videos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/help"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Support &amp; Help
              </Link>
              <Link
                href="/logout"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Sign Out
              </Link>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
            {pairedDevice ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-emerald-700">Device paired</p>
                  <p className="truncate text-gray-600">{shortDeviceLabel(pairedDevice)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  Active
                </span>
              </div>
            ) : pairingError ? (
              <div>
                <p className="font-semibold text-amber-800">Device not paired</p>
                <p className="text-amber-700">{pairingError}</p>
                <p className="mt-1 text-amber-700">
                  Reload to retry. Uploads will still work but will not be linked to this device.
                </p>
              </div>
            ) : (
              <p className="text-gray-600">Pairing this device...</p>
            )}
          </div>
        </div>

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}
        {actionMessage ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {actionMessage}
          </p>
        ) : null}

        {loading ? <p className="text-sm text-gray-600">Loading assigned jobs...</p> : null}

        {!loading && error && jobs.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-900">Employee workspace temporarily unavailable</p>
            <p className="mt-1 text-sm text-amber-800">
              Your assigned jobs could not be loaded right now. This usually means the connected database is paused or
              temporarily unavailable.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-amber-800">
              <li>1. Reload this page in a minute to retry.</li>
              <li>2. If the problem continues, ask your manager to confirm Reliance is fully online.</li>
              <li>3. Do not assume your job queue is empty until this warning clears.</li>
            </ul>
          </div>
        ) : null}

        {!loading && !error && jobs.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Welcome to your work view</p>
            <p className="mt-1 text-sm text-gray-600">
              You do not have any jobs assigned yet. When your manager assigns one, it will appear here.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-gray-700">
              <li>1. Make sure you are signed in on the phone you will use on-site.</li>
              <li>
                2. Confirm the device-paired indicator above shows{" "}
                <span className="font-semibold text-emerald-700">Active</span>.
              </li>
              <li>
                3. When a job appears, tap <span className="font-semibold">Start Job</span>, capture Before /
                During / After, then submit for manager review.
              </li>
            </ul>
          </div>
        ) : null}

        {!loading && currentJobs.length === 0 && completedJobs.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">No active jobs right now</p>
            <p className="mt-1 text-sm text-gray-600">
              Your actionable work queue is clear. Completed jobs are tucked into history so this page stays focused on
              current work.
            </p>
            <button
              type="button"
              onClick={() => setShowCompletedHistory((value) => !value)}
              className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {showCompletedHistory ? "Hide completed history" : `Show completed history (${completedJobs.length})`}
            </button>
          </div>
        ) : null}

        {currentJobs.map((job) => renderJobCard(job))}

        {completedJobs.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Completed history</p>
                <p className="mt-1 text-sm text-gray-600">
                  Older finished jobs are kept out of the main workflow so this screen stays focused on current work.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompletedHistory((value) => !value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {showCompletedHistory ? "Hide completed jobs" : `Show completed jobs (${completedJobs.length})`}
              </button>
            </div>

            {showCompletedHistory ? (
              <div className="mt-4 space-y-3">
                {completedJobs.slice(0, 8).map((job) => renderJobCard(job, true))}
                {completedJobs.length > 8 ? (
                  <p className="text-xs text-gray-500">
                    Showing the latest 8 completed jobs out of {completedJobs.length}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
